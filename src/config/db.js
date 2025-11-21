// src/config/db.js
const mongoose = require('mongoose');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const logger = createContextualLogger({ module: 'DB' }); // Create a logger instance for this module
const { MONGODB_URI } = require('./config');

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('MongoDB connected successfully');
    } catch (err) {
        logger.error(`MongoDB connection error: ${err.message}`);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
