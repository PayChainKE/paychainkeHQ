import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paychain')
  .then(async () => {
    const db = mongoose.connection.db;
    const allMerchants = await db.collection('merchants').find({}).toArray();
    console.log("All merchants:");
    allMerchants.forEach(m => console.log(`- Email: ${m.email}, Phone: ${m.phone}`));
    mongoose.connection.close();
  });
