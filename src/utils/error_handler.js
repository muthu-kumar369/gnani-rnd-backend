// backend/src/utils/error_handler.js
const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
    logger.error(`Error: ${err.message}, Stack: ${err.stack}`);

    // Set a default status code and message if not already set
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message
    });
}

module.exports = errorHandler;
