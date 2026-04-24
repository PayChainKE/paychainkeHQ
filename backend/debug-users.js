const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Database Name:', mongoose.connection.name);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    const users = await User.find({});
    console.log('Total users (User model):', users.length);
    
    // Also try checking the waitlist to see if we are in the right DB
    const db = mongoose.connection.db;
    const rawUsers = await db.collection('users').find({}).toArray();
    console.log('Raw "users" collection count:', rawUsers.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkUsers();
