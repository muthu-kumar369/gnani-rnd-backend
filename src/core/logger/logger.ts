// backend/src/core/logger/logger.ts
// Stage 5: Enhanced structured logging
import winston, { Logger } from "winston";
import {
  LOG_LEVEL,
  LOG_FILE_ERROR,
  LOG_FILE_COMBINED,
} from "../../config/env.config.js";
import { piiDetector } from "../security/pii-detector.service.js";

const createBaseLogger = (defaultMeta: object = {}): Logger => {
  // Stage 5: JSON format for structured logging
  const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // Stage 5: Conditional console format (colorized for dev, JSON for prod)
  const consoleFormat = process.env.NODE_ENV === 'development'
    ? winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
    : jsonFormat;

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: LOG_FILE_ERROR,
      level: "error",
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: LOG_FILE_COMBINED,
      format: jsonFormat,
    }),
  ];

  return winston.createLogger({
    level: LOG_LEVEL,
    format: jsonFormat,
    // Stage 5: Enhanced default metadata
    defaultMeta: {
      service: 'gnani-backend',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      ...defaultMeta
    },
    transports: transports,
  });
};

const logger: Logger = createBaseLogger();

export const createContextualLogger = (context: object): Logger => {
  const baseLogger = createBaseLogger({ context });

  // SECURITY: Wrap logger methods to mask PII
  const piiMaskingEnabled = process.env.PII_MASKING_ENABLED === 'true';

  if (!piiMaskingEnabled) {
    return baseLogger;
  }

  return {
    ...baseLogger,
    info: (message: string, metadata?: any) => {
      const maskedMessage = piiDetector.maskPII(message);
      const maskedMetadata = piiDetector.maskPIIInObject(metadata);
      baseLogger.info(maskedMessage, maskedMetadata);
    },
    warn: (message: string, metadata?: any) => {
      const maskedMessage = piiDetector.maskPII(message);
      const maskedMetadata = piiDetector.maskPIIInObject(metadata);
      baseLogger.warn(maskedMessage, maskedMetadata);
    },
    error: (message: string, metadata?: any) => {
      const maskedMessage = piiDetector.maskPII(message);
      const maskedMetadata = piiDetector.maskPIIInObject(metadata);
      baseLogger.error(maskedMessage, maskedMetadata);
    },
    debug: (message: string, metadata?: any) => {
      const maskedMessage = piiDetector.maskPII(message);
      const maskedMetadata = piiDetector.maskPIIInObject(metadata);
      baseLogger.debug(maskedMessage, maskedMetadata);
    },
  } as Logger;
};

export default logger;

