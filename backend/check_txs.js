import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Transaction from './models/Transaction.js';
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const txs = await Transaction.find({ type: { $in: ['inbound', 'outbound'] } }).sort({createdAt: -1}).limit(5);
  console.log('Recent Txs:', txs);
  process.exit();
});
