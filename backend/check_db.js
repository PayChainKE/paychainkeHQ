import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paychain')
  .then(async () => {
    const db = mongoose.connection.db;
    const merchants = await db.collection('merchants').find({ phone: '0790889066' }).toArray();
    console.log("Found merchants by exact phone:", merchants.map(m => ({ email: m.email, phone: m.phone })));

    // Try a regex search in case there are spaces or +254
    const allMerchants = await db.collection('merchants').find({}).toArray();
    const matches = allMerchants.filter(m => m.phone && m.phone.includes('0790889066'));
    console.log("Matches by includes:", matches.map(m => ({ email: m.email, phone: m.phone })));
    
    mongoose.connection.close();
  });
