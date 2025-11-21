// src/services/cacheManager.ts
import NodeCache from 'node-cache';
import logger from '../utils/logger.js';

class CacheManager {
    private cache: NodeCache;

    constructor(ttlSeconds = 3600) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2, useClones: false });
        this.cache.on('del', (key, value) => {
            logger.debug(`Cache entry for key ${key} deleted.`);
        });
        this.cache.on('expired', (key, value) => {
            logger.debug(`Cache entry for key ${key} expired.`);
        });
        logger.info('CacheManager initialized.');
    }

    set(key: string, value: any, ttl?: number): boolean {
        if (!key || value === undefined) {
            logger.warn('Attempted to set cache with invalid key or undefined value.');
            return false;
        }
        if (ttl !== undefined) {
            return this.cache.set(key, value, ttl);
        }
        return this.cache.set(key, value);
    }

    get<T>(key: string): T | undefined {
        if (!key) {
            logger.warn('Attempted to GET cache with invalid key.');
            return undefined;
        }
        const value = this.cache.get<T>(key);
        if (value !== undefined) {
            logger.debug(`Cache GET: ${key} (Hit)`);
        } else {
            logger.debug(`Cache GET: ${key} (Miss)`);
        }
        return value;
    }

    has(key: string): boolean {
        if (!key) return false;
        return this.cache.has(key);
    }

    del(key: string): number {
        if (!key) return 0;
        return this.cache.del(key);
    }

    flush(): void {
        this.cache.flushAll();
        logger.info('Cache flushed.');
    }

    size(): number {
        return this.cache.getStats().keys;
    }
}

export default new CacheManager();
