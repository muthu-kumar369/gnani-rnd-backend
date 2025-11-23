require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger'); // Assuming a logger utility

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani';

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('GNANI Backend is running!');
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => logger.info('MongoDB connected'))
    .catch(err => logger.error('MongoDB connection error:', err));

// Start the server
app.listen(PORT, () => {
    logger.info();
});

