// tests/unit/logger.test.ts
import logger, { createContextualLogger } from '../../src/core/logger/logger.js';

describe('Logger', () => {
    it('should create logger with default metadata', () => {
        expect(logger).toBeDefined();
        expect(logger.defaultMeta).toHaveProperty('service', 'gnani-backend');
        expect(logger.defaultMeta).toHaveProperty('environment');
        expect(logger.defaultMeta).toHaveProperty('version');
    });

    it('should create contextual logger with custom context', () => {
        const contextLogger = createContextualLogger({ module: 'TestModule' });

        expect(contextLogger).toBeDefined();
        expect(contextLogger.defaultMeta).toHaveProperty('service', 'gnani-backend');
        expect(contextLogger.defaultMeta).toHaveProperty('context');
    });

    it('should include service name in metadata', () => {
        expect(logger.defaultMeta).toHaveProperty('service', 'gnani-backend');
    });

    it('should include environment in metadata', () => {
        expect(logger.defaultMeta).toHaveProperty('environment');
        expect(typeof logger.defaultMeta.environment).toBe('string');
    });

    it('should include version in metadata', () => {
        expect(logger.defaultMeta).toHaveProperty('version');
        expect(typeof logger.defaultMeta.version).toBe('string');
    });

    it('should have correct log levels', () => {
        expect(logger.level).toBeDefined();
        expect(['error', 'warn', 'info', 'debug']).toContain(logger.level);
    });
});
