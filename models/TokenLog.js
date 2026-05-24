import mongoose from 'mongoose';

const tokenLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'info',
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    collection: 'token_logs',
    timestamps: true,
  }
);

const TokenLog = mongoose.model('TokenLog', tokenLogSchema);

export default TokenLog;