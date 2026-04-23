const mongoose = require('mongoose');
require('dotenv').config();

// Consolidated database cleanup script for PayChainKE
// This script moves data from redundant collections to the primary ones and drops the duplicates.

async function cleanup() {
  const URI = process.env.MONGODB_URI;
  if (!URI) {
    console.error('Error: MONGODB_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);
    console.log('📋 Existing collections:', colNames.join(', '));

    async function consolidate(fromName, toName) {
      if (colNames.includes(fromName) && colNames.includes(toName)) {
        console.log(`➡️ Consolidating ${fromName} into ${toName}...`);
        const fromCol = db.collection(fromName);
        const toCol = db.collection(toName);
        
        const docs = await fromCol.find({}).toArray();
        if (docs.length > 0) {
          console.log(`📡 Moving ${docs.length} documents...`);
          for (const doc of docs) {
            if (doc.email) {
              await toCol.updateOne({ email: doc.email }, { $setOnInsert: doc }, { upsert: true });
            } else {
              await toCol.insertOne(doc);
            }
          }
        }
        console.log(`🗑️ Dropping redundant collection: ${fromName}`);
        await fromCol.drop();
      } else if (colNames.includes(fromName)) {
        console.log(`🏷️ Renaming ${fromName} to ${toName}...`);
        await db.collection(fromName).rename(toName);
      } else {
        console.log(`ℹ️ ${fromName} not found, skipping.`);
      }
    }

    // 1. Newsletter Consolidation
    // Target: newsletter
    // Redundant: newsletters, newslettersubscribers
    await consolidate('newsletters', 'newsletter');
    await consolidate('newslettersubscribers', 'newsletter');

    // 2. Waitlist Consolidation
    // Target: waitlist
    // Redundant: waitlists
    await consolidate('waitlists', 'waitlist');

    console.log('\n✨ Database cleanup complete! Only the correct collections remained.');
    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  }
}

cleanup();
