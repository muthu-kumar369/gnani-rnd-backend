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
    public actionDispatchCounter: client.Counter;
    // Old cache counters removed
    
    // Month-2: Enhanced metrics
    public errorsTotal: client.Counter;
    public sessionsTotal: client.Counter;
    public sttLatency: client.Histogram;
    public llmLatency: client.Histogram;
    public llmTokensPerSecond: client.Histogram;
    public toolExecutionDuration: client.Histogram;
    public audioBufferSize: client.Gauge;
    public memoryUsage: client.Gauge;
    
    // Month-3: Cache metrics
    public cacheHitsTotal: client.Counter;
    public cacheMissesTotal: client.Counter;
    public cacheHitRate: client.Gauge;
    public audioBufferOverflow: client.Counter;
    public audioBufferWarning: client.Counter;

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

        this.actionDispatchCounter = new client.Counter({
            name: 'gnani_action_dispatches_total',
            help: 'Total number of system action dispatches',
            labelNames: ['sessionId', 'action', 'status'],
        });
        this.registry.registerMetric(this.actionDispatchCounter);

        this.registry.registerMetric(this.actionDispatchCounter);

        // Old cache counters removed (replaced by Month-3 metrics below)

        // Month-2: Enhanced metrics
        this.errorsTotal = new client.Counter({
            name: 'gnani_errors_total',
            help: 'Total number of errors',
            labelNames: ['type', 'context'],
        });
        this.registry.registerMetric(this.errorsTotal);

        this.sessionsTotal = new client.Counter({
            name: 'gnani_sessions_total',
            help: 'Total number of sessions created',
            labelNames: ['status'],
        });
        this.registry.registerMetric(this.sessionsTotal);

        this.sttLatency = new client.Histogram({
            name: 'gnani_stt_latency_ms',
            help: 'STT processing latency in milliseconds',
            buckets: [50, 100, 200, 500, 1000, 2000, 5000],
        });
        this.registry.registerMetric(this.sttLatency);

        this.llmLatency = new client.Histogram({
            name: 'gnani_llm_latency_ms',
            help: 'LLM response latency in milliseconds',
            buckets: [100, 200, 500, 1000, 2000, 5000, 10000],
        });
        this.registry.registerMetric(this.llmLatency);

        this.llmTokensPerSecond = new client.Histogram({
            name: 'gnani_llm_tokens_per_second',
            help: 'LLM tokens generated per second',
            buckets: [10, 20, 50, 100, 200, 500],
        });
        this.registry.registerMetric(this.llmTokensPerSecond);

        this.toolExecutionDuration = new client.Histogram({
            name: 'gnani_tool_execution_duration_ms',
            help: 'Tool execution duration in milliseconds',
            labelNames: ['tool_name', 'status'],
            buckets: [100, 500, 1000, 5000, 10000, 30000],
        });
        this.registry.registerMetric(this.toolExecutionDuration);

        this.audioBufferSize = new client.Gauge({
            name: 'gnani_audio_buffer_size_bytes',
            help: 'Current audio buffer size in bytes',
            labelNames: ['session_id'],
        });
        this.registry.registerMetric(this.audioBufferSize);

        this.memoryUsage = new client.Gauge({
            name: 'gnani_memory_usage_bytes',
            help: 'Memory usage in bytes',
            labelNames: ['type'],
        });
        this.registry.registerMetric(this.memoryUsage);

        // Month-3: Cache metrics
        this.cacheHitsTotal = new client.Counter({
            name: 'gnani_cache_hits_total',
            help: 'Total cache hits',
            labelNames: ['cache_type', 'tool'],
        });
        this.registry.registerMetric(this.cacheHitsTotal);

        this.cacheMissesTotal = new client.Counter({
            name: 'gnani_cache_misses_total',
            help: 'Total cache misses',
            labelNames: ['cache_type', 'tool'],
        });
        this.registry.registerMetric(this.cacheMissesTotal);

        this.cacheHitRate = new client.Gauge({
            name: 'gnani_cache_hit_rate',
            help: 'Cache hit rate (0-1)',
            labelNames: ['cache_type'],
        });
        this.registry.registerMetric(this.cacheHitRate);

        this.audioBufferOverflow = new client.Counter({
            name: 'gnani_audio_buffer_overflow_total',
            help: 'Total number of audio buffer overflows',
            labelNames: ['session_id'],
        });
        this.registry.registerMetric(this.audioBufferOverflow);

        this.audioBufferWarning = new client.Counter({
            name: 'gnani_audio_buffer_warning_total',
            help: 'Total number of audio buffer warnings',
            labelNames: ['session_id'],
        });
        this.registry.registerMetric(this.audioBufferWarning);

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

    incActionDispatch(sessionId: string, action: string, status: string): void {
        this.actionDispatchCounter.inc({ sessionId, action, status });
    }

    incCacheHit(cacheName: string): void {
        this.cacheHitsTotal.inc({ cache_type: cacheName, tool: 'unknown' });
    }

    incCacheMiss(cacheName: string): void {
        this.cacheMissesTotal.inc({ cache_type: cacheName, tool: 'unknown' });
    }

    // Month-2: Enhanced metric methods
    incrementErrors(type: string, context: string): void {
        this.errorsTotal.inc({ type, context });
    }

    incrementSessions(status: 'started' | 'ended'): void {
        this.sessionsTotal.inc({ status });
    }

    recordSTTLatency(duration: number): void {
        this.sttLatency.observe(duration);
    }

    recordLLMLatency(duration: number): void {
        this.llmLatency.observe(duration);
    }

    recordLLMTokensPerSecond(tokensPerSecond: number): void {
        this.llmTokensPerSecond.observe(tokensPerSecond);
    }

    recordToolExecution(toolName: string, duration: number, status: 'success' | 'failure'): void {
        this.toolExecutionDuration.observe({ tool_name: toolName, status }, duration);
    }

    incrementAudioBufferOverflow(sessionId: string): void {
        this.audioBufferOverflow.inc({ session_id: sessionId });
    }

    incrementAudioBufferWarning(sessionId: string): void {
        this.audioBufferWarning.inc({ session_id: sessionId });
    }

    setAudioBufferSize(sessionId: string, size: number): void {
        this.audioBufferSize.set({ session_id: sessionId }, size);
    }

    updateMemoryUsage(): void {
        const usage = process.memoryUsage();
        this.memoryUsage.set({ type: 'rss' }, usage.rss);
        this.memoryUsage.set({ type: 'heapTotal' }, usage.heapTotal);
        this.memoryUsage.set({ type: 'heapUsed' }, usage.heapUsed);
        this.memoryUsage.set({ type: 'external' }, usage.external);
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}

export default new Metrics();
