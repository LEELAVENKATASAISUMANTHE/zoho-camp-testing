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
		zohoContactListPayload: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		zohoContactListResponse: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		zohoContactListSyncedAt: {
			type: Date,
			default: null,
		},
		zohoContactListError: {
			type: String,
			default: null,
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