import mongoose from 'mongoose';

export async function connectMongo(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is required');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(uri);
  return mongoose.connection;
}