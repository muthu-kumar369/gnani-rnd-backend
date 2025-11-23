// backend/src/utils/logger.ts
import winston, { Logger } from "winston";
import {
  LOG_LEVEL,
  LOG_FILE_ERROR,
  LOG_FILE_COMBINED,
} from "../../config/env.config.js";

const createBaseLogger = (defaultMeta: object = {}): Logger => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: LOG_FILE_ERROR,
      level: "error",
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: LOG_FILE_COMBINED,
      format: winston.format.json(),
    }),
  ];

  return winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: defaultMeta,
    transports: transports,
  });
};

const logger: Logger = createBaseLogger();

export const createContextualLogger = (context: object): Logger =>
  createBaseLogger({ context });

export default logger;
