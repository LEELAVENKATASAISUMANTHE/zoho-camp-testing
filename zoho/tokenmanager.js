import axios from 'axios';
import cron from 'node-cron';

const ZOHO_TOKEN_ENDPOINT = 'https://accounts.zoho.in/oauth/v2/token';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const tokenStore = {
	accessToken: null,
	refreshToken: null,
	expiresAt: 0,
};

let tokenCheckJob = null;

export function isExistingTokenValid() {
	return Boolean(tokenStore.accessToken) && Date.now() < tokenStore.expiresAt - EXPIRY_BUFFER_MS;
}

export async function refreshTokens({ clientId, clientSecret, refreshToken }) {
	if (!clientId || !clientSecret || !refreshToken) {
		throw new Error('clientId, clientSecret, and refreshToken are required');
	}

	const body = new URLSearchParams({
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
	});

	const response = await axios.post(ZOHO_TOKEN_ENDPOINT, body, {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		timeout: 15000,
	});

	console.log('[token-manager] zoho token response:', response.data);

	const accessToken = response.data?.access_token;
	const nextRefreshToken = response.data?.refresh_token || refreshToken;
	const expiresIn = Number(response.data?.expires_in || 0);

	if (!accessToken) {
		throw new Error(`Zoho did not return an access token. Response: ${JSON.stringify(response.data)}`);
	}

	tokenStore.accessToken = accessToken;
	tokenStore.refreshToken = nextRefreshToken;
	tokenStore.expiresAt = Date.now() + (expiresIn * 1000);

	return {
		access_token: tokenStore.accessToken,
		refresh_token: tokenStore.refreshToken,
		expires_in: expiresIn,
	};
}

export function getStoredTokens() {
	return {
		access_token: tokenStore.accessToken,
		refresh_token: tokenStore.refreshToken,
		expires_at: tokenStore.expiresAt,
		is_valid: isExistingTokenValid(),
	};
}

export function startTokenCheckCron(authConfig) {
	if (tokenCheckJob) {
		return tokenCheckJob;
	}

	if (authConfig?.refreshToken && !tokenStore.refreshToken) {
		tokenStore.refreshToken = authConfig.refreshToken;
	}

	tokenCheckJob = cron.schedule('* * * * *', async () => {
		try {
			if (isExistingTokenValid()) {
				console.log('[token-manager] access token is valid');
				return;
			}

			if (!authConfig?.clientId || !authConfig?.clientSecret || !tokenStore.refreshToken) {
				console.warn('[token-manager] token check skipped because auth config or refresh token is missing');
				return;
			}

			console.log('[token-manager] access token expired or near expiry, refreshing now');
			await refreshTokens({
				clientId: authConfig.clientId,
				clientSecret: authConfig.clientSecret,
				refreshToken: tokenStore.refreshToken,
			});
			console.log('[token-manager] token refresh complete');
		} catch (error) {
			console.error('[token-manager] minute cron check failed:', {
				message: error.message,
				status: error.response?.status,
				data: error.response?.data,
			});
		}
	});

	return tokenCheckJob;
}
