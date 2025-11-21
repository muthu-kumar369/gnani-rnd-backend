// src/utils/metrics.ts
import client from 'prom-client';
import logger from '../logger/logger.js';

class Metrics {
    public registry: client.Registry;
    public httpRequestCounter: client.Counter;
    public httpRequestDurationSeconds: client.Histogram;
    public activeSessionsGauge: client.Gauge;
    public whisperTranscriptionCounter: client.Counter;
    public llmCallCounter: client.Counter;
    public ttsSynthesisCounter: client.Counter;
    public actionDispatchCounter: client.Counter;
    public cacheHitCounter: client.Counter;
    public cacheMissCounter: client.Counter;

    constructor() {
        this.registry = new client.Registry();
        client.collectDefaultMetrics({ register: this.registry });

        this.httpRequestCounter = new client.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status'],
        });
        this.registry.registerMetric(this.httpRequestCounter);

        this.httpRequestDurationSeconds = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5],
        });
        this.registry.registerMetric(this.httpRequestDurationSeconds);

        this.activeSessionsGauge = new client.Gauge({
            name: 'active_sessions_total',
            help: 'Total number of active user sessions',
        });
        this.registry.registerMetric(this.activeSessionsGauge);

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

    incHttpRequest(method: string, route: string, status: number): void {
        this.httpRequestCounter.inc({ method, route, status });
    }

    observeHttpRequestDuration(duration: number, method: string, route: string, status: number): void {
        this.httpRequestDurationSeconds.observe({ method, route, status }, duration);
    }

    setActiveSessions(count: number): void {
        this.activeSessionsGauge.set(count);
    }

    incWhisperTranscription(sessionId: string, status: string): void {
        this.whisperTranscriptionCounter.inc({ sessionId, status });
    }

    incLlmCall(sessionId: string, intent: string, status: string): void {
        this.llmCallCounter.inc({ sessionId, intent, status });
    }

    incTtsSynthesis(sessionId: string, language: string, voice: string, status: string): void {
        this.ttsSynthesisCounter.inc({ sessionId, language, voice, status });
    }

    incActionDispatch(sessionId: string, action: string, status: string): void {
        this.actionDispatchCounter.inc({ sessionId, action, status });
    }

    incCacheHit(cacheName: string): void {
        this.cacheHitCounter.inc({ cacheName });
    }

    incCacheMiss(cacheName: string): void {
        this.cacheMissCounter.inc({ cacheName });
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}

export default new Metrics();
