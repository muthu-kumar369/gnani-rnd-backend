// src/core/shutdown/shutdown-manager.ts
import { createContextualLogger } from '../logger/logger.js';
import { Server } from 'http';
import mongoose from 'mongoose';
import redisClient from '../../config/redis.config.js';
import sessionCoordinator from '../../modules/session/session.coordinator.js';

const logger = createContextualLogger({ module: 'ShutdownManager' });

class ShutdownManager {
  private isShuttingDown = false;
  private httpServer: Server | null = null;

  setHttpServer(server: Server) {
    this.httpServer = server;
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();

      // Step 2: Wait for active sessions to complete (with timeout)
      await this.drainActiveSessions();

      // Step 3: Close database connections
      await this.closeDatabases();

      // Step 4: Cleanup resources
      await this.cleanup();

      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error: any) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  }

  private async stopAcceptingConnections(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer) {
        logger.info('Stopping HTTP server from accepting new connections');
        this.httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async drainActiveSessions(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    let waited = 0;

    logger.info('Waiting for active sessions to complete...');

    while (waited < maxWaitTime) {
      const activeSessions = sessionCoordinator.getActiveSessionCount();
      
      if (activeSessions === 0) {
        logger.info('All sessions completed');
        return;
      }

      logger.info(`Waiting for ${activeSessions} active sessions...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    logger.warn(`Timeout waiting for sessions, forcing shutdown`);
  }

  private async closeDatabases(): Promise<void> {
    logger.info('Closing database connections...');

    // Close MongoDB
    try {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting MongoDB', { error: error.message });
    }

    // Close Redis
    try {
      await redisClient.quit();
      logger.info('Redis disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting Redis', { error: error.message });
    }
  }

  private async cleanup(): Promise<void> {
    logger.info('Cleaning up resources...');
    
    // Add any additional cleanup here
    // e.g., close file handles, stop background jobs, etc.
  }
}

export default new ShutdownManager();
