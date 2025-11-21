// src/utils/metrics.js
const client = require('prom-client'); // For Prometheus metrics
const logger = require('./logger'); // Import the logger

class Metrics {
    constructor() {
        // Create a Registry to register your metrics
        this.registry = new client.Registry();

        // Enable default metrics collection
        client.collectDefaultMetrics({ register: this.registry });

        // Example: Counter for total requests
        this.httpRequestCounter = new client.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status'],
        });
        this.registry.registerMetric(this.httpRequestCounter);

        // Example: Histogram for request duration
        this.httpRequestDurationSeconds = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5],
        });
        this.registry.registerMetric(this.httpRequestDurationSeconds);

        // Example: Gauge for active sessions
        this.activeSessionsGauge = new client.Gauge({
            name: 'active_sessions_total',
            help: 'Total number of active user sessions',
        });
        this.registry.registerMetric(this.activeSessionsGauge);

        // Custom metrics for GNANI
        this.whisperTranscriptionCounter = new client.Counter({
            name: 'gnani_whisper_transcriptions_total',
            help: 'Total number of Whisper transcriptions',
            labelNames: ['sessionId', 'status'],
        });
        this.registry.registerMetric(this.whisperTranscriptionCounter);

        this.llmCallCounter = new client.Counter({
            name: 'gnani_llm_calls_total',
            help: 'Total number of LLM calls',
            labelNames: ['sessionId', 'intent', 'status'],
        });
        this.registry.registerMetric(this.llmCallCounter);

        this.ttsSynthesisCounter = new client.Counter({
            name: 'gnani_tts_syntheses_total',
            help: 'Total number of TTS syntheses',
            labelNames: ['sessionId', 'language', 'voice', 'status'],
        });
        this.registry.registerMetric(this.ttsSynthesisCounter);

        this.actionDispatchCounter = new client.Counter({
            name: 'gnani_action_dispatches_total',
            help: 'Total number of system action dispatches',
            labelNames: ['sessionId', 'action', 'status'],
        });
        this.registry.registerMetric(this.actionDispatchCounter);

        this.cacheHitCounter = new client.Counter({
            name: 'gnani_cache_hits_total',
            help: 'Total number of cache hits',
            labelNames: ['cacheName'],
        });
        this.registry.registerMetric(this.cacheHitCounter);

        this.cacheMissCounter = new client.Counter({
            name: 'gnani_cache_misses_total',
            help: 'Total number of cache misses',
            labelNames: ['cacheName'],
        });
        this.registry.registerMetric(this.cacheMissCounter);

        logger.info('Metrics initialized.');
    }

    /**
     * Increments an HTTP request counter.
     * @param {string} method - HTTP method (GET, POST, etc.).
     * @param {string} route - The route path.
     * @param {number} status - HTTP status code.
     */
    incHttpRequest(method, route, status) {
        this.httpRequestCounter.inc({ method, route, status });
    }

    /**
     * Observes HTTP request duration.
     * @param {number} duration - Duration in seconds.
     * @param {string} method - HTTP method.
     * @param {string} route - The route path.
     * @param {number} status - HTTP status code.
     */
    observeHttpRequestDuration(duration, method, route, status) {
        this.httpRequestDurationSeconds.observe({ method, route, status }, duration);
    }

    /**
     * Sets the number of active sessions.
     * @param {number} count - The current count of active sessions.
     */
    setActiveSessions(count) {
        this.activeSessionsGauge.set(count);
    }

    /**
     * Increments the Whisper transcription counter.
     * @param {string} sessionId - The ID of the session.
     * @param {string} status - 'success' or 'failure'.
     */
    incWhisperTranscription(sessionId, status) {
        this.whisperTranscriptionCounter.inc({ sessionId, status });
    }

    /**
     * Increments the LLM call counter.
     * @param {string} sessionId - The ID of the session.
     * @param {string} intent - The classified intent.
     * @param {string} status - 'success' or 'failure'.
     */
    incLlmCall(sessionId, intent, status) {
        this.llmCallCounter.inc({ sessionId, intent, status });
    }

    /**
     * Increments the TTS synthesis counter.
     * @param {string} sessionId - The ID of the session.
     * @param {string} language - The language used for TTS.
     * @param {string} voice - The voice used for TTS.
     * @param {string} status - 'success' or 'failure'.
     */
    incTtsSynthesis(sessionId, language, voice, status) {
        this.ttsSynthesisCounter.inc({ sessionId, language, voice, status });
    }

    /**
     * Increments the action dispatch counter.
     * @param {string} sessionId - The ID of the session.
     * @param {string} action - The action type.
     * @param {string} status - 'success' or 'failure'.
     */
    incActionDispatch(sessionId, action, status) {
        this.actionDispatchCounter.inc({ sessionId, action, status });
    }

    /**
     * Increments the cache hit counter.
     * @param {string} cacheName - Name of the cache.
     */
    incCacheHit(cacheName) {
        this.cacheHitCounter.inc({ cacheName });
    }

    /**
     * Increments the cache miss counter.
     * @param {string} cacheName - Name of the cache.
     */
    incCacheMiss(cacheName) {
        this.cacheMissCounter.inc({ cacheName });
    }

    /**
     * Gets the Prometheus metrics in a string format.
     * @returns {Promise<string>} Prometheus metrics string.
     */
    async getMetrics() {
        return this.registry.metrics();
    }
}

module.exports = new Metrics();
