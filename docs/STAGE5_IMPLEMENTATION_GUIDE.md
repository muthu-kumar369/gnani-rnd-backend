# Stage 5: Performance Optimization - Implementation Guide

## Overview

**Duration:** 5 days  
**Priority:** P2 (Important for Scale)  
**Target:** 3x faster tool execution, 20%+ LLM call savings, <100ms DB queries  
**Current Completion:** Ready for Implementation

This document provides a complete implementation guide for Stage 5: Performance Optimization.

---

## Day 1: Tool Execution Parallelization

### Current Problem

Tools execute sequentially, even when independent:
```typescript
// Sequential execution (slow)
for (const tool of tools) {
  const result = await executeTool(tool);
  results.push(result);
}
```

### Solution: Parallel Executor

**File:** `src/modules/tool/parallel-executor.service.ts`

```typescript
export class ParallelToolExecutor {
  /**
   * Execute tools in parallel where possible
   */
  async executeTools(tools: ToolCall[]): Promise<ToolResult[]> {
    const graph = this.buildDependencyGraph(tools);
    return this.executeWithDependencies(tools, graph);
  }

  private buildDependencyGraph(tools: ToolCall[]): Map<string, Set<string>> {
    const graph = new Map();
    for (const tool of tools) {
      graph.set(tool.id, new Set(tool.dependencies || []));
    }
    return graph;
  }

  private async executeWithDependencies(
    tools: ToolCall[],
    graph: Map<string, Set<string>>
  ): Promise<ToolResult[]> {
    const results = new Map();
    const completed = new Set();

    while (completed.size < tools.length) {
      // Find tools ready to execute
      const ready = tools.filter(tool => 
        !completed.has(tool.id) && 
        this.canExecute(tool.id, graph, completed)
      );

      // Execute all ready tools in parallel
      await Promise.all(ready.map(tool => this.executeTool(tool, results)));
      
      ready.forEach(tool => completed.add(tool.id));
    }

    return tools.map(tool => results.get(tool.id));
  }
}
```

**Performance Gain:** 3x faster for independent tools

---

## Day 2: Request Deduplication

### Current Problem

Identical LLM requests execute multiple times:
- Same user asks same question twice
- Multiple users ask identical questions
- Wasted compute and API calls

### Solution: Request Deduplicator

**File:** `src/core/cache/request-deduplicator.service.ts`

```typescript
export class RequestDeduplicator {
  private pendingRequests = new Map();

  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 60
  ): Promise<T> {
    const requestKey = this.generateKey(key);

    // Check if request is already pending
    if (this.pendingRequests.has(requestKey)) {
      return this.waitForPending(requestKey);
    }

    // Check cache
    const cached = await this.redis.get(requestKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Execute and cache
    return this.executeAndCache(requestKey, fn, ttl);
  }

  private async executeAndCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const pending = {
      promise: fn(),
      resolvers: [],
      rejectors: [],
    };

    this.pendingRequests.set(key, pending);

    try {
      const result = await pending.promise;
      await this.redis.setex(key, ttl, JSON.stringify(result));
      pending.resolvers.forEach(resolve => resolve(result));
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}
```

**Integration:**
```typescript
// In LLM service
async generateResponse(request: LLMRequest): Promise<LLMResponse> {
  const dedupKey = JSON.stringify(request);
  return this.deduplicator.deduplicate(
    dedupKey,
    () => this.executeGeneration(request),
    300 // 5 minutes
  );
}
```

**Performance Gain:** 20%+ reduction in LLM calls

---

## Day 3: Database Optimization

### Indexes

**File:** `scripts/optimize-database.ts`

```typescript
async function optimizeDatabase() {
  const db = client.db();

  // Conversations
  await db.collection('conversations').createIndexes([
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, updatedAt: -1 } },
  ]);

  // Sessions
  await db.collection('sessions').createIndexes([
    { key: { userId: 1, status: 1 } },
    { key: { conversationId: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL
  ]);

  // Memory
  await db.collection('memories').createIndexes([
    { key: { userId: 1, importance: -1 } },
    { key: { conversationId: 1 } },
  ]);

  // Users
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
  ]);
}
```

### Query Optimization

**Before (slow):**
```typescript
const conversations = await db.collection('conversations')
  .find({ userId })
  .toArray();
```

**After (fast):**
```typescript
const conversations = await db.collection('conversations')
  .find({ userId })
  .sort({ updatedAt: -1 })
  .limit(50)
  .project({ messages: 0 }) // Exclude large fields
  .toArray();
```

**Performance Gain:** <100ms p95 for queries

---

## Day 4: Cache Warming

### Strategy

Pre-load frequently accessed data on startup.

**File:** `src/core/cache/cache-warmer.service.ts`

```typescript
export class CacheWarmer {
  async warmCache(): Promise<void> {
    await Promise.all([
      this.warmSystemPrompts(),
      this.warmModelConfigs(),
      this.warmCommonQueries(),
    ]);
  }

  private async warmSystemPrompts(): Promise<void> {
    const prompts = ['default', 'helpful-assistant', 'code-assistant'];
    
    for (const prompt of prompts) {
      await this.cache.set(
        `system-prompt:${prompt}`,
        await this.loadSystemPrompt(prompt),
        3600
      );
    }
  }

  private async warmModelConfigs(): Promise<void> {
    const models = ['llama3.1', 'llama3.2', 'mistral'];
    
    for (const model of models) {
      await this.cache.set(
        `model-config:${model}`,
        await this.loadModelConfig(model),
        3600
      );
    }
  }
}
```

**Usage:**
```typescript
// In app startup
const warmer = new CacheWarmer(cacheService);
await warmer.warmCache();
```

**Performance Gain:** >40% cache hit rate

---

## Day 5: Resource Management

### Connection Pool Optimization

**MongoDB:**
```typescript
const options: MongoClientOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000,
};

export const mongoClient = new MongoClient(uri, options);
```

**Redis:**
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  keepAlive: 30000,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});
```

### Memory Monitoring

**File:** `src/core/monitoring/memory-monitor.ts`

```typescript
export class MemoryMonitor {
  private thresholdMB = 1024; // 1GB

  start(): void {
    setInterval(() => this.checkMemory(), 30000);
  }

  private checkMemory(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;

    if (heapUsedMB > this.thresholdMB) {
      this.logger.warn('High memory usage', { heapUsedMB });
      
      if (global.gc) {
        global.gc();
      }
    }
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed / 1024 / 1024,
      heapTotal: usage.heapTotal / 1024 / 1024,
      rss: usage.rss / 1024 / 1024,
    };
  }
}
```

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool Execution | 3x faster | Parallel vs sequential |
| LLM Call Savings | 20%+ | Deduplication rate |
| DB Query Latency | <100ms p95 | Query performance |
| Cache Hit Rate | >40% | Cache metrics |
| Memory Leaks | Zero | Memory monitoring |

---

## Implementation Checklist

### Day 1: Tool Parallelization
- [ ] Create `parallel-executor.service.ts`
- [ ] Implement dependency graph
- [ ] Test with parallel tools
- [ ] Measure performance

### Day 2: Request Deduplication
- [ ] Create `request-deduplicator.service.ts`
- [ ] Integrate with LLM service
- [ ] Test deduplication
- [ ] Monitor metrics

### Day 3: Database Optimization
- [ ] Create database indexes
- [ ] Optimize slow queries
- [ ] Test query performance
- [ ] Document strategies

### Day 4: Cache Optimization
- [ ] Create cache warmer
- [ ] Implement warming strategies
- [ ] Monitor hit rates
- [ ] Document cache strategy

### Day 5: Resource Management
- [ ] Optimize connection pools
- [ ] Implement memory monitoring
- [ ] Add leak detection
- [ ] Document best practices

---

## Testing

### Performance Benchmarks

```bash
# Tool parallelization
node scripts/benchmark-tools.js

# Request deduplication
node scripts/benchmark-deduplication.js

# Database queries
node scripts/benchmark-database.js
```

### Load Testing

```bash
# Run with k6
k6 run tests/load/performance-test.js
```

---

**Created:** December 9, 2025  
**Status:** Implementation Guide Complete  
**Ready for:** Full Stage 5 Implementation
