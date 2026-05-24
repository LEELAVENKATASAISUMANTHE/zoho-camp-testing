import axios from 'axios';
import cron from 'node-cron';
import TokenLog from '../models/TokenLog.js';

const ZOHO_TOKEN_ENDPOINT = 'https://accounts.zoho.in/oauth/v2/token';
const EXPIRY_BUFFER = 5 * 60 * 1000;

const tokenStore = {
	accessToken: null,
	refreshToken: null,
	expiresAt: 0,
};

let tokenJob = null;

async function saveTokensToMongo() {
	try {
		await TokenLog.findOneAndUpdate(
			{},
			{
				accessToken: tokenStore.accessToken,
				refreshToken: tokenStore.refreshToken,
				expiresAt: tokenStore.expiresAt ? new Date(tokenStore.expiresAt) : null,
			},
			{
				upsert: true,
				returnDocument: 'after',
				setDefaultsOnInsert: true,
			}
		);

		console.log('[token-manager] token saved to mongo');
	} catch (error) {
		console.warn('[token-manager] failed to save token to mongo', {
			message: error.message,
		});
	}
}

export const isTokenValid = () =>
	tokenStore.accessToken &&
	Date.now() < tokenStore.expiresAt - EXPIRY_BUFFER;

export async function refreshTokens({
	clientId,
	clientSecret,
	refreshToken,
}) {
	const body = new URLSearchParams({
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
	});

	const { data } = await axios.post(ZOHO_TOKEN_ENDPOINT, body, {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		timeout: 15000,
	});

	if (!data?.access_token) {
		throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
	}

	tokenStore.accessToken = data.access_token;
	tokenStore.refreshToken = data.refresh_token || refreshToken;
	tokenStore.expiresAt = Date.now() + (Number(data.expires_in || 0) * 1000);

	await saveTokensToMongo();

	console.log('[token-manager] token refreshed');

	return {
		access_token: tokenStore.accessToken,
		refresh_token: tokenStore.refreshToken,
		expires_in: data.expires_in,
	};
}

export const getStoredTokens = () => ({
	access_token: tokenStore.accessToken,
	refresh_token: tokenStore.refreshToken,
	expires_at: tokenStore.expiresAt,
	is_valid: isTokenValid(),
});

export function startTokenCheckCron(authConfig) {
	if (tokenJob) return tokenJob;

	if (authConfig?.refreshToken) {
		tokenStore.refreshToken = authConfig.refreshToken;
	}

	tokenJob = cron.schedule('*/5 * * * *', async () => {
		try {
			if (isTokenValid()) {
				console.log('[token-manager] token valid');
				return;
			}

			if (
				!authConfig?.clientId ||
				!authConfig?.clientSecret ||
				!tokenStore.refreshToken
			) {
				console.warn('[token-manager] missing auth config');
				return;
			}

			console.log('[token-manager] refreshing token');

			await refreshTokens({
				clientId: authConfig.clientId,
				clientSecret: authConfig.clientSecret,
				refreshToken: tokenStore.refreshToken,
			});
		} catch (error) {
			console.error('[token-manager] refresh failed', {
				message: error.message,
				status: error.response?.status,
				data: error.response?.data,
			});
		}
	});

	return tokenJob;
}