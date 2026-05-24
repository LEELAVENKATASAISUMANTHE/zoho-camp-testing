import axios from 'axios';
import { getCurrentAccessTokenFromMongo } from './tokenmanager.js';

const ZOHO_CONTACT_LIST_URL =
	'https://campaigns.zoho.in/api/v1.1/createcontactlist';

function buildStudentList(eligibleStudents = []) {
	return eligibleStudents.map((student) => ({
		student_id: student.student_id || null,
		complete_name: student.complete_name || null,
		branch: student.branch || null,
		graduation_year: student.graduation_year || null,
		email: student.email || null,
		college_email: student.college_email || null,
		mobile: student.mobile || null,
	}));
}

export function buildJobContactList(jobEmailDoc) {
	const jobId = jobEmailDoc?.payload?.jobId;
	const eligibleStudents = jobEmailDoc?.payload?.eligibleStudents || [];

	return {
		list_name: `job-${jobId}`,
		job_id: jobId,
		total_students: eligibleStudents.length,
		students: buildStudentList(eligibleStudents),
	};
}

export async function createZohoContactList(jobEmailDoc) {
	try {
		const payload = buildJobContactList(jobEmailDoc);

		const accessToken = await getCurrentAccessTokenFromMongo();

		if (!accessToken) {
			throw new Error('No valid access token found in MongoDB');
		}

		const { data } = await axios.post(
			ZOHO_CONTACT_LIST_URL,
			payload,
			{
				headers: {
					Authorization: `Zoho-oauthtoken ${accessToken}`,
					'Content-Type': 'application/json',
				},
				timeout: 20000,
			}
		);

		console.log('[zoho-contact-list] contact list created');

		return {
			payload,
			response: data,
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