import cacheService from '../../src/core/cache/cache.service.js';

describe('CacheService', () => {
    beforeEach(async () => {
        // Clear cache before each test
        await cacheService.flushAll();
    });

    describe('Basic Operations', () => {
        it('should set and get value', async () => {
            await cacheService.set('test-key', 'test-value');
            const value = await cacheService.get<string>('test-key');

            expect(value).toBe('test-value');
        });

        it('should return null for non-existent key', async () => {
            const value = await cacheService.get('non-existent');
            expect(value).toBeNull();
        });

        it('should set and get object', async () => {
            const obj = { name: 'Test', value: 123 };
            await cacheService.set('test-obj', obj);
            const retrieved = await cacheService.get<typeof obj>('test-obj');

            expect(retrieved).toEqual(obj);
        });

        it('should delete key', async () => {
            await cacheService.set('test-key', 'test-value');
            await cacheService.del('test-key');
            const value = await cacheService.get('test-key');

            expect(value).toBeNull();
        });

        it('should delete multiple keys', async () => {
            await cacheService.set('key1', 'value1');
            await cacheService.set('key2', 'value2');
            await cacheService.del(['key1', 'key2']);

            const value1 = await cacheService.get('key1');
            const value2 = await cacheService.get('key2');

            expect(value1).toBeNull();
            expect(value2).toBeNull();
        });
    });

    describe('TTL', () => {
        it('should respect TTL', async () => {
            await cacheService.set('test-key', 'test-value', 1); // 1 second TTL

            // Should exist immediately
            let value = await cacheService.get('test-key');
            expect(value).toBe('test-value');

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Should be expired
            value = await cacheService.get('test-key');
            expect(value).toBeNull();
        });

        it('should get TTL of key', async () => {
            await cacheService.set('test-key', 'test-value', 60);
            const ttl = await cacheService.ttl('test-key');

            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(60);
        });
    });

    describe('Pattern Operations', () => {
        it('should delete by pattern', async () => {
            await cacheService.set('user:123:profile', 'data1');
            await cacheService.set('user:123:settings', 'data2');
            await cacheService.set('user:456:profile', 'data3');

            await cacheService.delPattern('user:123:*');

            const profile = await cacheService.get('user:123:profile');
            const settings = await cacheService.get('user:123:settings');
            const other = await cacheService.get('user:456:profile');

            expect(profile).toBeNull();
            expect(settings).toBeNull();
            expect(other).toBe('data3');
        });
    });

    describe('Existence Check', () => {
        it('should check if key exists', async () => {
            await cacheService.set('test-key', 'test-value');

            const exists = await cacheService.exists('test-key');
            const notExists = await cacheService.exists('non-existent');

            expect(exists).toBe(true);
            expect(notExists).toBe(false);
        });
    });

    describe('Flush All', () => {
        it('should clear all cache', async () => {
            await cacheService.set('key1', 'value1');
            await cacheService.set('key2', 'value2');

            await cacheService.flushAll();

            const value1 = await cacheService.get('key1');
            const value2 = await cacheService.get('key2');

            expect(value1).toBeNull();
            expect(value2).toBeNull();
        });
    });

    describe('Stats', () => {
        it('should get cache stats', async () => {
            const stats = await cacheService.getStats();

            expect(stats).toHaveProperty('connected');
            expect(stats).toHaveProperty('dbSize');
            expect(stats.connected).toBe(true);
        });
    });
});
