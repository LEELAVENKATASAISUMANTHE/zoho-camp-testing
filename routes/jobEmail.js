import { Router } from 'express';
import JobEmail from '../models/JobEmail.js';
import { createZohoContactList } from '../zoho/jobContactList.js';

const router = Router();

function parseBoolean(value) {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		return value.toLowerCase() === 'true';
	}

	return null;
}

router.get('/', async (req, res) => {
	try {
		const status = parseBoolean(req.query.status);
		const query = status === null ? {} : { status };
		const jobs = await JobEmail.find(query).sort({ createdAt: -1 });

		res.json(jobs);
	} catch (error) {
		res.status(500).json({ message: 'Failed to fetch job emails', error: error.message });
	}
});

router.get('/status/:status', async (req, res) => {
	try {
		const status = parseBoolean(req.params.status);

		if (status === null) {
			return res.status(400).json({ message: 'status must be true or false' });
		}

		const jobs = await JobEmail.find({ status }).sort({ createdAt: -1 });
		res.json(jobs);
	} catch (error) {
		res.status(500).json({ message: 'Failed to fetch filtered job emails', error: error.message });
	}
});

router.get('/job/:jobId', async (req, res) => {
	try {
		const jobId = Number(req.params.jobId);

		if (Number.isNaN(jobId)) {
			return res.status(400).json({ message: 'jobId must be a number' });
		}

		const job = await JobEmail.findOne({ 'payload.jobId': jobId });

		if (!job) {
			return res.status(404).json({ message: 'Job email not found' });
		}

		res.json(job);
	} catch (error) {
		res.status(500).json({ message: 'Failed to fetch job email', error: error.message });
	}
});

router.patch('/job/:jobId/status', async (req, res) => {
	try {
		const jobId = Number(req.params.jobId);
		const nextStatus = parseBoolean(req.body.status);

		if (Number.isNaN(jobId)) {
			return res.status(400).json({ message: 'jobId must be a number' });
		}

		if (nextStatus === null) {
			return res.status(400).json({ message: 'status must be true or false' });
		}

		const job = await JobEmail.findOneAndUpdate(
			{ 'payload.jobId': jobId },
			{ status: nextStatus },
			{ returnDocument: 'after' }
		);

		if (!job) {
			return res.status(404).json({ message: 'Job email not found' });
		}

		if (nextStatus === true) {
			try {
				const contactListResult = await createZohoContactList(job);

				const updatedJob = await JobEmail.findOneAndUpdate(
					{ 'payload.jobId': jobId },
					{
						zohoContactListPayload: contactListResult.payload,
						zohoContactListResponse: contactListResult.response,
						zohoContactListSyncedAt: new Date(),
						zohoContactListError: null,
					},
					{ returnDocument: 'after' }
				);

				return res.json(updatedJob);
			} catch (contactListError) {
				await JobEmail.findOneAndUpdate(
					{ 'payload.jobId': jobId },
					{
						zohoContactListError: contactListError.message,
					},
					{ returnDocument: 'after' }
				);

				return res.status(502).json({
					message: 'Status updated, but Zoho contact list creation failed',
					error: contactListError.message,
				});
			}
		}

		res.json(job);
	} catch (error) {
		res.status(500).json({ message: 'Failed to update job email status', error: error.message });
	}
});

router.patch('/job/:jobId/mark-true', async (req, res) => {
	try {
		const jobId = Number(req.params.jobId);

		if (Number.isNaN(jobId)) {
			return res.status(400).json({ message: 'jobId must be a number' });
		}

		const job = await JobEmail.findOneAndUpdate(
			{ 'payload.jobId': jobId },
			{ status: true },
			{ returnDocument: 'after' }
		);

		if (!job) {
			return res.status(404).json({ message: 'Job email not found' });
		}

		const contactListResult = await createZohoContactList(job);

		const updatedJob = await JobEmail.findOneAndUpdate(
			{ 'payload.jobId': jobId },
			{
				zohoContactListPayload: contactListResult.payload,
				zohoContactListResponse: contactListResult.response,
				zohoContactListSyncedAt: new Date(),
				zohoContactListError: null,
			},
			{ returnDocument: 'after' }
		);

		res.json(updatedJob);
	} catch (error) {
		res.status(500).json({ message: 'Failed to mark job email true', error: error.message });
	}
});

export default router;