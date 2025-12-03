// src/shared/errors/error-handler.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import { GnaniError } from './error-types.js';

class ErrorHandler {
  private logger = createContextualLogger({ module: 'ErrorHandler' });

  handle(error: Error, context: string = 'unknown'): void {
    // Log error
    this.logger.error(error.message, {
      context,
      stack: error.stack,
      type: error.constructor.name
    });

    // Track metrics (if metrics system supports it)
    try {
      if (typeof metrics.incrementErrors === 'function') {
        metrics.incrementErrors(error.constructor.name, context);
      }
    } catch (metricsError) {
      // Silently fail if metrics not available yet
    }

    // Categorize and handle
    if (error instanceof GnaniError) {
      this.handleOperationalError(error, context);
    } else {
      this.handleProgrammerError(error, context);
    }
  }

  private handleOperationalError(error: GnaniError, context: string): void {
    this.logger.warn('Operational error occurred', {
      code: error.code,
      message: error.message,
      context
    });

    // Operational errors are expected, don't crash
    // Just log and continue
  }

  private handleProgrammerError(error: Error, context: string): void {
    this.logger.error('Programmer error occurred', {
      message: error.message,
      stack: error.stack,
      context
    });

    // For programmer errors, we might want to alert
    // but still try to continue
    this.sendAlert(error, context);
  }

  private sendAlert(error: Error, context: string): void {
    // Send to monitoring service (e.g., Sentry, PagerDuty)
    this.logger.error('ALERT: Critical error', {
      error: error.message,
      context
    });
  }

  async handleAsync(
    fn: () => Promise<any>,
    context: string = 'async-operation'
  ): Promise<any> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error as Error, context);
      throw error;
    }
  }
}

export default new ErrorHandler();
