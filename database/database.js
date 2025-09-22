import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL;
    
    if (!mongoUrl) {
      throw new Error("MongoDB connection string not found in environment variables");
    }

    //This will Only connect if not already connected
    if (mongoose.connection.readyState === 0) {
      const conn = await mongoose.connect(mongoUrl);

      console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
  } catch (error) {
    console.error("Database connection error:", error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

export default connectDB;