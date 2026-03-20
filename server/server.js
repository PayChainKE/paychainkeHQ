// Minimal Express server scaffold for the Contact API.
// If your project already has an app/server file, add the line below to mount routes:
// app.use('/api/contact', require('./routes/contactRoutes'));

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const contactRoutes = require('./routes/contactRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Mount contact routes
app.use('/api/contact', contactRoutes);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paychain';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error', err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Contact API listening on ${PORT}`));

module.exports = app;
