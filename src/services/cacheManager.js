// src/services/cacheManager.js
const NodeCache = require('node-cache'); // Using a simple in-memory cache library
const logger = require('../utils/logger');

class CacheManager {
    constructor(ttlSeconds = 3600) { // Default TTL: 1 hour
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2, useClones: false });
        this.cache.on('del', (key, value) => {
            logger.debug(`Cache entry for key ${key} deleted.`);
        });
        this.cache.on('expired', (key, value) => {
            logger.debug(`Cache entry for key ${key} expired.`);
        });
        logger.info('CacheManager initialized.');
    }

    /**
     * Stores data in the cache.
     * @param {string} key - The cache key.
     * @param {*} value - The data to store.
     * @param {number} [ttl] - Time to live in seconds for this entry. Overrides default.
     * @returns {boolean} True if data was set, false otherwise.
     */
    set(key, value, ttl) {
        if (!key || value === undefined) {
            logger.warn('Attempted to set cache with invalid key or undefined value.');
            return false;
        }
        const success = this.cache.set(key, value, ttl);
        if (success) {
            logger.debug(`Cache SET: ${key}`);
        } else {
            logger.error(`Failed to SET cache for key: ${key}`);
        }
        return success;
    }

    /**
     * Retrieves data from the cache.
     * @param {string} key - The cache key.
     * @returns {*} The cached data, or undefined if not found.
     */
    get(key) {
        if (!key) {
            logger.warn('Attempted to GET cache with invalid key.');
            return undefined;
        }
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger.debug(`Cache GET: ${key} (Hit)`);
        } else {
            logger.debug(`Cache GET: ${key} (Miss)`);
        }
        return value;
    }

    /**
     * Checks if a key exists in the cache.
     * @param {string} key - The cache key.
     * @returns {boolean} True if the key exists, false otherwise.
     */
    has(key) {
        if (!key) return false;
        return this.cache.has(key);
    }

    /**
     * Deletes a key from the cache.
     * @param {string} key - The cache key.
     * @returns {number} The number of deleted entries (0 or 1).
     */
    del(key) {
        if (!key) return 0;
        return this.cache.del(key);
    }

    /**
     * Clears the entire cache.
     */
    flush() {
        this.cache.flushAll();
        logger.info('Cache flushed.');
    }

    /**
     * Returns the number of keys in the cache.
     * @returns {number}
     */
    size() {
        return this.cache.getStats().keys;
    }
}

module.exports = new CacheManager();
