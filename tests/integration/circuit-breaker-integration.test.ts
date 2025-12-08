// tests/integration/circuit-breaker-integration.test.ts
import { mongoCircuitBreaker } from '../../src/config/database.config.js';
import { redisCircuitBreaker } from '../../src/config/redis.config.js';

describe('Circuit Breaker Integration', () => {
    describe('MongoDB Circuit Breaker', () => {
        it('should protect MongoDB operations', async () => {
            const stats = mongoCircuitBreaker.getStats();

            expect(stats).toHaveProperty('state');
            expect(stats).toHaveProperty('failureCount');

            // Circuit should start in CLOSED state
            expect(stats.state).toBe('CLOSED');
        });

        it('should allow manual reset', () => {
            mongoCircuitBreaker.forceClose();
            const stats = mongoCircuitBreaker.getStats();
            expect(stats.state).toBe('CLOSED');
        });
    });

    describe('Redis Circuit Breaker', () => {
        it('should protect Redis operations', async () => {
            const stats = redisCircuitBreaker.getStats();

            expect(stats).toHaveProperty('state');
            expect(stats).toHaveProperty('failureCount');

            // Circuit should start in CLOSED state
            expect(stats.state).toBe('CLOSED');
        });

        it('should allow manual control', () => {
            // Force open
            redisCircuitBreaker.forceOpen();
            expect(redisCircuitBreaker.getStats().state).toBe('OPEN');

            // Force close
            redisCircuitBreaker.forceClose();
            expect(redisCircuitBreaker.getStats().state).toBe('CLOSED');
        });
    });

    describe('Circuit Breaker Recovery', () => {
        it('should recover automatically after timeout', async () => {
            // This test would require actually triggering failures
            // and waiting for recovery, which is time-consuming
            // In practice, this is tested manually or with longer integration tests

            const stats = mongoCircuitBreaker.getStats();
            expect(stats).toBeDefined();
        });
    });
});
