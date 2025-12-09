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

    // Stage 2: Circuit breaker metrics
    public circuitBreakerState: client.Gauge;
    public circuitBreakerFailures: client.Gauge;
    public circuitBreakerTrips: client.Counter;

    // Stage 3: Error metrics
    public errorCounter: client.Counter;

    // Stage 6: HTTP size metrics
    public httpRequestSize: client.Histogram;
    public httpResponseSize: client.Histogram;

    // Stage 7: Database metrics
    public dbConnectionPoolSize: client.Gauge;
    public dbQueryDuration: client.Histogram;
    public dbOperationsTotal: client.Counter;

    // Stage 1 Monitoring: Additional required metrics
    public sessionCheckpointTotal: client.Counter;
    public sessionRecoveryTotal: client.Counter;
    public vectorSearchDuration: client.Histogram;
    public embeddingGenerationDuration: client.Histogram;
    public toolCacheHitTotal: client.Counter;
    public rateLimitExceededTotal: client.Counter;
    public llmRequestTotal: client.Counter;
    public llmTokensTotal: client.Counter;
    public ttsGenerationDuration: client.Histogram;
    public audioQualitySNR: client.Gauge;
    public vadTriggerTotal: client.Counter;
    public memoryRetrievalTotal: client.Counter;
    public summarizationTotal: client.Counter;
    public grpcRequestTotal: client.Counter;
    public grpcRequestDuration: client.Histogram;
    public websocketConnectionsActive: client.Gauge;
    public redisOperationDuration: client.Histogram;
    public redisMemoryBytes: client.Gauge;

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

        // Stage 2: Circuit breaker metrics
        this.circuitBreakerState = new client.Gauge({
            name: 'circuit_breaker_state',
            help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
            labelNames: ['circuit', 'state'],
        });
        this.registry.registerMetric(this.circuitBreakerState);

        this.circuitBreakerFailures = new client.Gauge({
            name: 'circuit_breaker_failures',
            help: 'Number of failures in circuit breaker',
            labelNames: ['circuit'],
        });
        this.registry.registerMetric(this.circuitBreakerFailures);

        this.circuitBreakerTrips = new client.Counter({
            name: 'circuit_breaker_trips_total',
            help: 'Total number of times circuit breaker opened',
            labelNames: ['circuit'],
        });
        this.registry.registerMetric(this.circuitBreakerTrips);

        // Stage 3: Error metrics
        this.errorCounter = new client.Counter({
            name: 'error_total',
            help: 'Total number of errors',
            labelNames: ['code', 'category', 'severity'],
        });
        this.registry.registerMetric(this.errorCounter);

        // Stage 6: HTTP size metrics
        this.httpRequestSize = new client.Histogram({
            name: 'http_request_size_bytes',
            help: 'Size of HTTP requests in bytes',
            labelNames: ['method', 'route'],
            buckets: [100, 1000, 10000, 100000, 1000000],
        });
        this.registry.registerMetric(this.httpRequestSize);

        this.httpResponseSize = new client.Histogram({
            name: 'http_response_size_bytes',
            help: 'Size of HTTP responses in bytes',
            labelNames: ['method', 'route'],
            buckets: [100, 1000, 10000, 100000, 1000000],
        });
        this.registry.registerMetric(this.httpResponseSize);

        // Stage 7: Database metrics
        this.dbConnectionPoolSize = new client.Gauge({
            name: 'db_connection_pool_size',
            help: 'Current database connection pool size',
            labelNames: ['state'], // state: active, idle
        });
        this.registry.registerMetric(this.dbConnectionPoolSize);

        this.dbQueryDuration = new client.Histogram({
            name: 'db_query_duration_seconds',
            help: 'Duration of database queries',
            labelNames: ['operation', 'collection'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        });
        this.registry.registerMetric(this.dbQueryDuration);

        this.dbOperationsTotal = new client.Counter({
            name: 'db_operations_total',
            help: 'Total number of database operations',
            labelNames: ['operation', 'collection', 'status'],
        });
        this.registry.registerMetric(this.dbOperationsTotal);

        // Stage 1 Monitoring: Additional metrics
        this.sessionCheckpointTotal = new client.Counter({
            name: 'session_checkpoint_total',
            help: 'Total number of session checkpoints',
            labelNames: ['session_id', 'status'],
        });
        this.registry.registerMetric(this.sessionCheckpointTotal);

        this.sessionRecoveryTotal = new client.Counter({
            name: 'session_recovery_total',
            help: 'Total number of session recovery attempts',
            labelNames: ['status'],
        });
        this.registry.registerMetric(this.sessionRecoveryTotal);

        this.vectorSearchDuration = new client.Histogram({
            name: 'vector_search_duration_seconds',
            help: 'Duration of vector search operations',
            labelNames: ['collection'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
        });
        this.registry.registerMetric(this.vectorSearchDuration);

        this.embeddingGenerationDuration = new client.Histogram({
            name: 'embedding_generation_duration_seconds',
            help: 'Duration of embedding generation',
            buckets: [0.1, 0.5, 1, 2, 5],
        });
        this.registry.registerMetric(this.embeddingGenerationDuration);

        this.toolCacheHitTotal = new client.Counter({
            name: 'tool_cache_hit_total',
            help: 'Total tool cache hits',
            labelNames: ['tool_name'],
        });
        this.registry.registerMetric(this.toolCacheHitTotal);

        this.rateLimitExceededTotal = new client.Counter({
            name: 'rate_limit_exceeded_total',
            help: 'Total rate limit exceeded events',
            labelNames: ['endpoint'],
        });
        this.registry.registerMetric(this.rateLimitExceededTotal);

        this.llmRequestTotal = new client.Counter({
            name: 'llm_request_total',
            help: 'Total LLM requests',
            labelNames: ['model', 'status'],
        });
        this.registry.registerMetric(this.llmRequestTotal);

        this.llmTokensTotal = new client.Counter({
            name: 'llm_tokens_total',
            help: 'Total tokens processed',
            labelNames: ['model', 'type'],
        });
        this.registry.registerMetric(this.llmTokensTotal);

        this.ttsGenerationDuration = new client.Histogram({
            name: 'tts_generation_duration_seconds',
            help: 'TTS generation duration',
            buckets: [0.1, 0.5, 1, 2, 5],
        });
        this.registry.registerMetric(this.ttsGenerationDuration);

        this.audioQualitySNR = new client.Gauge({
            name: 'audio_quality_snr_db',
            help: 'Audio quality SNR in dB',
            labelNames: ['session_id'],
        });
        this.registry.registerMetric(this.audioQualitySNR);

        this.vadTriggerTotal = new client.Counter({
            name: 'vad_trigger_total',
            help: 'Total VAD triggers',
            labelNames: ['session_id'],
        });
        this.registry.registerMetric(this.vadTriggerTotal);

        this.memoryRetrievalTotal = new client.Counter({
            name: 'memory_retrieval_total',
            help: 'Total memory retrievals',
            labelNames: ['type'],
        });
        this.registry.registerMetric(this.memoryRetrievalTotal);

        this.summarizationTotal = new client.Counter({
            name: 'summarization_total',
            help: 'Total summarization operations',
            labelNames: ['type'],
        });
        this.registry.registerMetric(this.summarizationTotal);

        this.grpcRequestTotal = new client.Counter({
            name: 'grpc_request_total',
            help: 'Total gRPC requests',
            labelNames: ['method', 'status'],
        });
        this.registry.registerMetric(this.grpcRequestTotal);

        this.grpcRequestDuration = new client.Histogram({
            name: 'grpc_request_duration_seconds',
            help: 'gRPC request duration',
            labelNames: ['method'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
        });
        this.registry.registerMetric(this.grpcRequestDuration);

        this.websocketConnectionsActive = new client.Gauge({
            name: 'websocket_connections_active',
            help: 'Active WebSocket connections',
        });
        this.registry.registerMetric(this.websocketConnectionsActive);

        this.redisOperationDuration = new client.Histogram({
            name: 'redis_operation_duration_seconds',
            help: 'Redis operation duration',
            labelNames: ['operation'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
        });
        this.registry.registerMetric(this.redisOperationDuration);

        this.redisMemoryBytes = new client.Gauge({
            name: 'redis_memory_bytes',
            help: 'Redis memory usage in bytes',
        });
        this.registry.registerMetric(this.redisMemoryBytes);

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
    incrementLLMCacheHit(): void {
        this.cacheHitsTotal.inc({ cache_type: 'llm_response', tool: 'llm_service' });
    }

    incrementLLMCacheMiss(): void {
        this.cacheMissesTotal.inc({ cache_type: 'llm_response', tool: 'llm_service' });
    }

    // Stage 1 Monitoring: Helper methods
    incrementSessionCheckpoint(sessionId: string, status: 'success' | 'failure'): void {
        this.sessionCheckpointTotal.inc({ session_id: sessionId, status });
    }

    incrementSessionRecovery(status: 'success' | 'failed'): void {
        this.sessionRecoveryTotal.inc({ status });
    }

    recordVectorSearch(duration: number, collection: string): void {
        this.vectorSearchDuration.observe({ collection }, duration);
    }

    recordEmbeddingGeneration(duration: number): void {
        this.embeddingGenerationDuration.observe(duration);
    }

    incrementToolCacheHit(toolName: string): void {
        this.toolCacheHitTotal.inc({ tool_name: toolName });
    }

    incrementRateLimitExceeded(endpoint: string): void {
        this.rateLimitExceededTotal.inc({ endpoint });
    }

    incrementLLMRequest(model: string, status: 'success' | 'failure'): void {
        this.llmRequestTotal.inc({ model, status });
    }

    incrementLLMTokens(model: string, type: 'input' | 'output', count: number): void {
        this.llmTokensTotal.inc({ model, type }, count);
    }

    recordTTSGeneration(duration: number): void {
        this.ttsGenerationDuration.observe(duration);
    }

    setAudioQualitySNR(sessionId: string, snr: number): void {
        this.audioQualitySNR.set({ session_id: sessionId }, snr);
    }

    incrementVADTrigger(sessionId: string): void {
        this.vadTriggerTotal.inc({ session_id: sessionId });
    }

    incrementMemoryRetrieval(type: string): void {
        this.memoryRetrievalTotal.inc({ type });
    }

    incrementSummarization(type: string): void {
        this.summarizationTotal.inc({ type });
    }

    incrementGRPCRequest(method: string, status: number): void {
        this.grpcRequestTotal.inc({ method, status: status.toString() });
    }

    recordGRPCDuration(method: string, duration: number): void {
        this.grpcRequestDuration.observe({ method }, duration);
    }

    setWebSocketConnections(count: number): void {
        this.websocketConnectionsActive.set(count);
    }

    recordRedisOperation(operation: string, duration: number): void {
        this.redisOperationDuration.observe({ operation }, duration);
    }

    setRedisMemory(bytes: number): void {
        this.redisMemoryBytes.set(bytes);
    }
}

export default new Metrics();
