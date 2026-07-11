const mongoose = require('mongoose');

async function connectDB() {
  mongoose.set('strictQuery', true);

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in the environment.');
  }

  await mongoose.connect(uri, {
    // Mongoose 8 uses sensible defaults; options kept explicit for clarity.
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] disconnected — Mongoose will attempt to reconnect.');
  });

  console.log(`[MongoDB] connected → ${mongoose.connection.name}`);
}

module.exports = connectDB;
