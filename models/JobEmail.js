import mongoose from 'mongoose';

const jobEmailSchema = new mongoose.Schema(
	{
		status: {
			type: Boolean,
			default: false,
		},
		payload: {
			type: mongoose.Schema.Types.Mixed,
			required: true,
		},
	},
	{
		collection: 'job_email',
		timestamps: true,
	}
);

const placementErpDb = mongoose.connection.useDb('placement_erp');

const JobEmail = placementErpDb.models.JobEmail || placementErpDb.model('JobEmail', jobEmailSchema);

export default JobEmail;