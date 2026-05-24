import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    accessToken: {
      type: String,
      required: true,
      trim: true,
    },
    refreshToken: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'tokens',
    timestamps: true,
  }
);

const TokenLog = mongoose.model('TokenLog', tokenSchema);

export default TokenLog;