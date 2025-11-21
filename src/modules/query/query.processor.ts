// src/services/queryProcessor.ts
import textCleaner from '../../utils/text.cleaner.js';
import intentClassifier from '../nlp/intent-classifier.service.js';
import cacheManager from '../../core/cache/cache.manager.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import { Logger } from 'winston';

interface Interaction {
    query: string;
    response: string;
    timestamp: string;
}

class QueryProcessor {
    private logger: Logger;
    private sessionMemory: Map<string, Interaction[]>;
    private MAX_SESSION_MEMORY: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'QueryProcessor' });
        this.logger.info('QueryProcessor initialized.');
        auditService.logEvent('QUERY_PROCESSOR_INIT', null, null, {}, 'success');
        this.sessionMemory = new Map();
        this.MAX_SESSION_MEMORY = 5;
    }

    async processTranscript(sessionId: string, userId: string, rawTranscript: string): Promise<{ cleanedText: string; intent: string; cacheHit: boolean; }> {
        this.logger.debug(`Processing transcript for session ${sessionId}, user ${userId}: "${rawTranscript}"`);
        auditService.logEvent('QUERY_PROCESSING_START', userId, sessionId, { rawTranscript }, 'info');

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

        const cacheKey = `${userId}:${cleanedText}`;
        const cachedResult = cacheManager.get<{ cleanedText: string; intent: string; }>(cacheKey);
        if (cachedResult && cachedResult.cleanedText && cachedResult.intent) {
            this.logger.info(`Cache HIT for session ${sessionId}, query "${cleanedText}".`);
            metrics.incCacheHit('queryProcessor');
            auditService.logEvent('QUERY_CACHE_LOOKUP', userId, sessionId, { query: cleanedText, cacheKey }, 'success');
            return { ...cachedResult, cacheHit: true };
        }
        this.logger.info(`Cache MISS for session ${sessionId}, query "${cleanedText}".`);
        metrics.incCacheMiss('queryProcessor');
        auditService.logEvent('QUERY_CACHE_LOOKUP', userId, sessionId, { query: cleanedText, cacheKey }, 'info');

        const intent = intentClassifier.classify(cleanedText);
        this.logger.info(`Classified intent for session ${sessionId}: "${intent}"`);
        auditService.logEvent('INTENT_CLASSIFICATION', userId, sessionId, { cleanedText, intent }, 'success');

        const result = {
            cleanedText,
            intent,
            cacheHit: false
        };

        cacheManager.set(cacheKey, { cleanedText, intent });
        auditService.logEvent('QUERY_CACHE_STORE', userId, sessionId, { query: cleanedText, cacheKey }, 'success');

        auditService.logEvent('QUERY_PROCESSING_END', userId, sessionId, { cleanedText, intent }, 'success');
        return result;
    }

    addInteractionToMemory(sessionId: string, query: string, response: string): void {
        if (!this.sessionMemory.has(sessionId)) {
            this.sessionMemory.set(sessionId, []);
        }
        const memory = this.sessionMemory.get(sessionId)!;
        memory.push({ query, response, timestamp: new Date().toISOString() });

        if (memory.length > this.MAX_SESSION_MEMORY) {
            memory.shift();
        }
        this.logger.debug(`Interaction added to session ${sessionId} memory.`);
        auditService.logEvent('SESSION_MEMORY_UPDATE', null, sessionId, { query, response }, 'info');
    }

    getSessionMemory(sessionId: string): Interaction[] {
        return this.sessionMemory.get(sessionId) || [];
    }

    clearSessionMemory(sessionId: string): void {
        this.sessionMemory.delete(sessionId);
        this.logger.debug(`Session memory cleared for ${sessionId}.`);
        auditService.logEvent('SESSION_MEMORY_CLEAR', null, sessionId, {}, 'info');
    }
}

export default new QueryProcessor();
