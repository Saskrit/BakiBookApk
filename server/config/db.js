import mongoose from 'mongoose';

const DB_NAME = 'BakiBook';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('MONGODB_URI not set — running without database connection');
    return;
  }

  try {
    // Pool + timeouts matter when Atlas is in another region than the Oracle VM.
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      // Prefer the nearer replica when available (reduces multi-region lag).
      readPreference: 'primaryPreferred',
    });
    console.log(`MongoDB connected — Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};

export default connectDB;
