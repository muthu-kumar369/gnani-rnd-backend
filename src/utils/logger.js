// backend/src/config/logger.js
const winston = require('winston');
const { LOG_LEVEL, LOG_FILE_ERROR, LOG_FILE_COMBINED } = require('../configs/config'); // Corrected path to config

// Base logger configuration
const createBaseLogger = (defaultMeta = {}) => {
    const transports = [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: LOG_FILE_ERROR,
            level: 'error',
            format: winston.format.json() // Ensure file logs are JSON
        }),
        new winston.transports.File({
            filename: LOG_FILE_COMBINED,
            format: winston.format.json() // Ensure file logs are JSON
        })
    ];

    return winston.createLogger({
        level: LOG_LEVEL,
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }), // Include stack trace for errors
            winston.format.splat(),
            winston.format.json() // Default format for all logs
        ),
        defaultMeta: defaultMeta, // Set default metadata
        transports: transports
    });
};

// Export a default logger for general use
const logger = createBaseLogger();

// Export the factory function to create contextual loggers
module.exports = {
    logger,
    createContextualLogger: (context) => createBaseLogger(context)
};
