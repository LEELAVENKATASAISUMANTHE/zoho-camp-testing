import axios from 'axios';
import { getCurrentAccessTokenFromMongo, isTokenValid, refreshTokens } from './tokenmanager.js';

const ZOHO_CREATE_LIST_URL =
	'https://campaigns.zoho.com/api/v1.1/addlistandcontacts';
const ZOHO_ADD_CONTACTS_URL =
	'https://campaigns.zoho.com/api/v1.1/addlistsubscribersinbulk';

function getAuthConfig() {
	return {
		clientId: process.env.ZOHO_CLIENT_ID || process.env.Client_ID,
		clientSecret: process.env.ZOHO_CLIENT_SECRET || process.env.Client_Secret,
		refreshToken:
			process.env.ZOHO_REFRESH_TOKEN ||
			process.env.REFRESH_TOKEN ||
			process.env.Refresh_Token ||
			process.env.refresh_token,
	};
}

async function ensureValidAccessToken() {
	// Try to get token from memory/Mongo
	const token = await getCurrentAccessTokenFromMongo();

	// If token is valid, use it
	if (isTokenValid()) {
		return token;
	}

	// Token is invalid or missing, refresh it
	const authConfig = getAuthConfig();
	if (!authConfig?.clientId || !authConfig?.clientSecret || !authConfig?.refreshToken) {
		throw new Error('Cannot refresh token: missing auth config (clientId, clientSecret, refreshToken)');
	}

	console.log('[zoho-contact-list] token invalid or expired, refreshing...');

	const refreshResult = await refreshTokens({
		clientId: authConfig.clientId,
		clientSecret: authConfig.clientSecret,
		refreshToken: authConfig.refreshToken,
	});

	return refreshResult.access_token;
}

async function createListAndAddContacts(listName, emailArray, jobId, totalStudents, accessToken) {
	const MAX_EMAILS_PER_REQUEST = 10;

	// Create list with first batch of emails
	const firstBatch = emailArray.slice(0, MAX_EMAILS_PER_REQUEST);
	const createPayload = {
		resfmt: 'JSON',
		listname: listName,
		signupform: 'private',
		mode: 'newlist',
		listdescription: `Job ID: ${jobId}, Total Students: ${totalStudents}`,
		emailids: firstBatch.join(','),
	};

	console.log('[zoho-contact-list] creating list with first batch', {
		listName,
		emailCount: firstBatch.length,
	});

	const createResponse = await axios.post(
		ZOHO_CREATE_LIST_URL,
		new URLSearchParams(createPayload),
		{
			headers: {
				Authorization: `Zoho-oauthtoken ${accessToken}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			timeout: 20000,
		}
	);

	if (createResponse.data.code !== '0') {
		throw new Error(
			`Failed to create list: ${createResponse.data.message || 'Unknown error'}`
		);
	}

	const listkey = createResponse.data.listkey;
	console.log('[zoho-contact-list] list created successfully', { listkey });

	// If there are more than 10 emails, add remaining in batches
	if (emailArray.length > MAX_EMAILS_PER_REQUEST) {
		for (let i = MAX_EMAILS_PER_REQUEST; i < emailArray.length; i += MAX_EMAILS_PER_REQUEST) {
			const batch = emailArray.slice(i, i + MAX_EMAILS_PER_REQUEST);
			const addPayload = {
				resfmt: 'JSON',
				listkey: listkey,
				emailids: batch.join(','),
			};

			console.log('[zoho-contact-list] adding contacts batch', {
				batchStart: i,
				emailCount: batch.length,
			});

			const addResponse = await axios.post(
				ZOHO_ADD_CONTACTS_URL,
				new URLSearchParams(addPayload),
				{
					headers: {
						Authorization: `Zoho-oauthtoken ${accessToken}`,
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					timeout: 20000,
				}
			);

			if (addResponse.data.code !== '0') {
				throw new Error(
					`Failed to add contacts: ${addResponse.data.message || 'Unknown error'}`
				);
			}

			console.log('[zoho-contact-list] contacts batch added', { batchStart: i });
		}
	}

	return {
		createPayload,
		createResponse: createResponse.data,
		totalEmails: emailArray.length,
		batches: Math.ceil(emailArray.length / MAX_EMAILS_PER_REQUEST),
	};
}

export async function createZohoContactList(jobEmailDoc) {
	try {
		const jobId = jobEmailDoc?.payload?.jobId;
		const eligibleStudents = jobEmailDoc?.payload?.eligibleStudents || [];

		// Ensure we have a valid access token (refresh if needed)
		const accessToken = await ensureValidAccessToken();

		if (!accessToken) {
			throw new Error('Failed to obtain valid access token');
		}

		// Extract email addresses, prioritizing personal email over college email
		const emailArray = eligibleStudents
			.map((s) => s.email || s.college_email)
			.filter(Boolean);

		if (emailArray.length === 0) {
			throw new Error('No email addresses found in eligible students');
		}

		const listName = `job-${jobId}`;
		const result = await createListAndAddContacts(
			listName,
			emailArray,
			jobId,
			eligibleStudents.length,
			accessToken
		);

		console.log('[zoho-contact-list] complete workflow finished', {
			listName,
			totalEmails: result.totalEmails,
			batches: result.batches,
		});

		return {
			payload: {
				list_name: listName,
				job_id: jobId,
				total_students: eligibleStudents.length,
				email_count: emailArray.length,
			},
			response: result.createResponse,
		};
	} catch (error) {
		console.error('[zoho-contact-list] failed', {
			message: error.message,
			status: error.response?.status,
			data: error.response?.data,
		});

		throw error;
	}
}