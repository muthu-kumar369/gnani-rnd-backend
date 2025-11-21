// src/services/queryProcessor.js
const textCleaner = require('../utils/textCleaner');
const intentClassifier = require('./intentClassifier');
const cacheManager = require('./cacheManager');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
// const User = require('../models/User'); // User model is no longer directly accessed here

class QueryProcessor {
    constructor() {
        this.logger = createContextualLogger({ module: 'QueryProcessor' }); // Create a logger instance
        this.logger.info('QueryProcessor initialized.');
        auditService.logEvent('QUERY_PROCESSOR_INIT', null, null, {}, 'success');
        // Map to store short-term session memory: sessionId -> array of { query, response }
        this.sessionMemory = new Map();
        this.MAX_SESSION_MEMORY = 5; // Keep last 5 interactions
    }

    /**
     * Processes a raw transcript: cleans, classifies, and checks cache.
     * @param {string} sessionId - The ID of the current session.
     * @param {string} userId - The ID of the user.
     * @param {string} rawTranscript - The raw transcript from ASR.
     * @returns {Promise<Object>} Processed query object (cleanedText, intent, cacheHit).
     */
    async processTranscript(sessionId, userId, rawTranscript) {
        this.logger.debug(`Processing transcript for session ${sessionId}, user ${userId}: "${rawTranscript}"`);
        auditService.logEvent('QUERY_PROCESSING_START', userId, sessionId, { rawTranscript }, 'info');

        // 1. Text Cleaning & Normalization
        const cleanedText = textCleaner.clean(rawTranscript);
        if (!cleanedText) {
            this.logger.warn(`Empty or invalid cleaned text for session ${sessionId}.`);
            auditService.logEvent('QUERY_CLEANING', userId, sessionId, { rawTranscript, cleanedText: '', reason: 'Empty/Invalid' }, 'warning');
            return {
                cleanedText: '',
                intent: 'empty',
                cacheHit: false
            };
        }
        auditService.logEvent('QUERY_CLEANING', userId, sessionId, { rawTranscript, cleanedText }, 'success');

        // Generate cache key
        const cacheKey = `${userId}:${cleanedText}`;

        // 2. Caching - Check before classification
        const cachedResult = cacheManager.get(cacheKey);
        if (cachedResult && cachedResult.cleanedText && cachedResult.intent) {
            this.logger.info(`Cache HIT for session ${sessionId}, query "${cleanedText}".`);
            metrics.incCacheHit('queryProcessor');
            auditService.logEvent('QUERY_CACHE_LOOKUP', userId, sessionId, { query: cleanedText, cacheKey }, 'success', 'cache_hit');
            return { ...cachedResult, cacheHit: true };
        }
        this.logger.info(`Cache MISS for session ${sessionId}, query "${cleanedText}".`);
        metrics.incCacheMiss('queryProcessor');
        auditService.logEvent('QUERY_CACHE_LOOKUP', userId, sessionId, { query: cleanedText, cacheKey }, 'info', 'cache_miss');

        // 3. Intent Classification
        const intent = intentClassifier.classify(cleanedText);
        this.logger.info(`Classified intent for session ${sessionId}: "${intent}"`);
        auditService.logEvent('INTENT_CLASSIFICATION', userId, sessionId, { cleanedText, intent }, 'success');

        const result = {
            cleanedText,
            intent,
            cacheHit: false // Always false for new computations
        };

        // Cache the result
        cacheManager.set(cacheKey, { cleanedText, intent });
        auditService.logEvent('QUERY_CACHE_STORE', userId, sessionId, { query: cleanedText, cacheKey }, 'success');

        auditService.logEvent('QUERY_PROCESSING_END', userId, sessionId, { cleanedText, intent }, 'success');
        return result;
    }

    /**
     * Adds an interaction to the session's short-term memory.
     * @param {string} sessionId - The ID of the session.
     * @param {string} query - The user's query.
     * @param {string} response - GNANI's response.
     */
    addInteractionToMemory(sessionId, query, response) {
        if (!this.sessionMemory.has(sessionId)) {
            this.sessionMemory.set(sessionId, []);
        }
        const memory = this.sessionMemory.get(sessionId);
        memory.push({ query, response, timestamp: new Date().toISOString() });

        if (memory.length > this.MAX_SESSION_MEMORY) {
            memory.shift();
        }
        this.logger.debug(`Interaction added to session ${sessionId} memory.`);
        auditService.logEvent('SESSION_MEMORY_UPDATE', null, sessionId, { query, response }, 'info');
    }

    /**
     * Retrieves the short-term memory for a session.
     * @param {string} sessionId - The ID of the session.
     * @returns {Array} Array of interaction objects.
     */
    getSessionMemory(sessionId) {
        return this.sessionMemory.get(sessionId) || [];
    }

    /**
     * Clears the short-term memory for a session.
     * @param {string} sessionId - The ID of the session.
     */
    clearSessionMemory(sessionId) {
        this.sessionMemory.delete(sessionId);
        this.logger.debug(`Session memory cleared for ${sessionId}.`);
        auditService.logEvent('SESSION_MEMORY_CLEAR', null, sessionId, {}, 'info');
    }
}

module.exports = new QueryProcessor();