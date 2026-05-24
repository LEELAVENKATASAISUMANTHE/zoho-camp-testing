import JobEmail from '../models/JobEmail.js';
import { createConsumer } from './setup.js';

export function startJobEmailConsumer() {
	const { start } = createConsumer({
		topic: 'job.notification.send',
		groupId: 'placement-email-consumer-group',
		handler: async (payload) => {
			await JobEmail.create({
				status: false,
				payload,
			});

			console.log('[job-email-consumer] saved message to placement_erp.job_email');
		},
	});

	return start();
}