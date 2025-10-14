import mongoose from "mongoose";

const connectDb = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("❌Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDb;
