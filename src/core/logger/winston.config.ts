// Winston logger configuration
import winston from 'winston';

const winstonConfig = {
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
        // Add file transports or other transports as needed
    ],
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    exitOnError: false, // Do not exit on handled exceptions
};

export default winstonConfig;