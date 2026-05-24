import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectMongo } from './config/db.js';
import { startJobEmailConsumer } from './redpanda/jobEmailConsumer.js';
import { startTokenCheckCron } from './zoho/tokenmanager.js';
import tokenLogRouter from './routes/tokenLogs.js';

dotenv.config();

const app = express();
let mongoConnected = false;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    mongo: mongoConnected ? 'connected' : 'skipped',
  });
});

async function startServer() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zoho-camp-testing';
  const authConfig = {
    clientId: process.env.ZOHO_CLIENT_ID || process.env.Client_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET || process.env.Client_Secret,
    refreshToken:
      process.env.ZOHO_REFRESH_TOKEN ||
      process.env.REFRESH_TOKEN ||
      process.env.Refresh_Token ||
      process.env.refresh_token,
  };

  try {
    await connectMongo(mongoUri);
    mongoConnected = true;
    app.use('/token-logs', tokenLogRouter);
    console.log(`[mongo] connected to ${mongoUri}`);

    await startJobEmailConsumer();
    console.log('[kafka] job.notification.send consumer started');
  } catch (error) {
    mongoConnected = false;
    console.warn(`[mongo] not connected, continuing without database: ${error.message}`);
  }

  startTokenCheckCron(authConfig);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[server] failed to start:', error.message);
  process.exit(1);
});
