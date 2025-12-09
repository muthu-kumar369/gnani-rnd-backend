# Service Instrumentation Guide - OpenTelemetry Tracing

## Overview

This guide shows how to instrument the remaining critical services with OpenTelemetry distributed tracing.

## ✅ Already Instrumented

### LLM Service (`src/modules/llm/llm.service.ts`)
- ✅ `getLlmResponse()` - Main LLM request method
- ✅ `getToolDecision()` - Tool decision making
- ✅ `generateTitle()` - Title generation

---

## 📋 Services to Instrument

### 1. Session Coordinator (`src/modules/session/session.coordinator.ts`)

**Methods to Instrument:**
- `createSession()` - Session creation
- `handleAudioChunk()` - Audio processing
- `processTranscript()` - Transcript processing
- `endSession()` - Session cleanup

**Example:**
```typescript
// Add import at top
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';

// Wrap method
async createSession(userId: string, metadata?: any): Promise<Session> {
    return traceAsyncOperation('session.createSession', async () => {
        // existing code
    }, { 'user.id': userId });
}
```

---

### 2. Memory Manager (`src/modules/memory/memory.manager.ts`)

**Methods to Instrument:**
- `storeMemory()` - Store new memory
- `retrieveMemories()` - Retrieve relevant memories
- `summarizeConversation()` - Conversation summarization
- `decayMemories()` - Memory decay operation

**Example:**
```typescript
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';

async retrieveMemories(userId: string, query: string, limit: number): Promise<Memory[]> {
    return traceAsyncOperation('memory.retrieveMemories', async () => {
        // existing code
    }, { 
        'user.id': userId,
        'query.length': query.length,
        'limit': limit
    });
}
```

---

### 3. Vector Manager (`src/modules/vector/vector.manager.ts`)

**Methods to Instrument:**
- `search()` - Vector similarity search
- `addDocuments()` - Add documents to vector store
- `generateEmbedding()` - Generate embeddings
- `deleteCollection()` - Collection cleanup

**Example:**
```typescript
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';

async search(query: string, limit: number, filters?: any): Promise<SearchResult[]> {
    return traceAsyncOperation('vector.search', async () => {
        const startTime = Date.now();
        // existing code
        const duration = (Date.now() - startTime) / 1000;
        metrics.recordVectorSearch(duration, filters?.collection || 'default');
        return results;
    }, { 
        'query.length': query.length,
        'limit': limit,
        'collection': filters?.collection
    });
}
```

---

### 4. Tool Service (`src/modules/tool/tool.service.ts`)

**Methods to Instrument:**
- `execute()` - Tool execution
- `validateParameters()` - Parameter validation
- `cacheResult()` - Result caching

**Example:**
```typescript
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';

async execute(toolName: string, parameters: any): Promise<any> {
    return traceAsyncOperation('tool.execute', async () => {
        const startTime = Date.now();
        try {
            // existing code
            const duration = Date.now() - startTime;
            metrics.recordToolExecution(toolName, duration, 'success');
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            metrics.recordToolExecution(toolName, duration, 'failure');
            throw error;
        }
    }, { 
        'tool.name': toolName,
        'parameters.count': Object.keys(parameters).length
    });
}
```

---

### 5. Context Builder (`src/modules/session/context.builder.ts`)

**Methods to Instrument:**
- `buildContext()` - Build conversation context
- `retrieveLongTermContext()` - Retrieve long-term context
- `formatContext()` - Format context for LLM

**Example:**
```typescript
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';

async buildContext(sessionId: string, userId: string): Promise<Context> {
    return traceAsyncOperation('context.buildContext', async () => {
        // existing code
    }, { 
        'session.id': sessionId,
        'user.id': userId
    });
}
```

---

## Implementation Pattern

### Step 1: Add Import
```typescript
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';
```

### Step 2: Wrap Async Methods
```typescript
async methodName(params): Promise<ReturnType> {
    return traceAsyncOperation('service.methodName', async () => {
        // existing method code
    }, {
        // relevant attributes for tracing
        'key': 'value'
    });
}
```

### Step 3: Add Metrics (if applicable)
```typescript
return traceAsyncOperation('service.methodName', async () => {
    const startTime = Date.now();
    try {
        // existing code
        const duration = (Date.now() - startTime) / 1000;
        metrics.recordOperation(duration);
        return result;
    } catch (error) {
        metrics.incrementError();
        throw error;
    }
}, attributes);
```

---

## Tracing Attributes Best Practices

### Good Attributes:
- `user.id` - User identifier
- `session.id` - Session identifier
- `operation.type` - Type of operation
- `resource.name` - Resource being accessed
- `query.length` - Query/input length
- `result.count` - Number of results

### Avoid:
- Large text content (use length instead)
- Sensitive data (PII, passwords)
- Binary data
- Redundant information

---

## Testing Tracing

### 1. Start Monitoring Stack
```powershell
.\start-monitoring.ps1
```

### 2. Generate Traffic
Run the backend and make requests to generate traces.

### 3. View Traces in Jaeger
Open http://localhost:16686 and search for:
- Service: `gnani-backend`
- Operation: `llm.getLlmResponse`, `session.createSession`, etc.

### 4. Verify Trace Propagation
Check that traces show the full request flow:
```
HTTP Request
  └─ session.createSession
      └─ context.buildContext
          └─ memory.retrieveMemories
              └─ vector.search
      └─ llm.getLlmResponse
          └─ tool.execute (if needed)
```

---

## Metrics Integration

When instrumenting, also record metrics:

```typescript
return traceAsyncOperation('vector.search', async () => {
    const startTime = Date.now();
    const results = await this.performSearch(query);
    
    // Record metrics
    const duration = (Date.now() - startTime) / 1000;
    metrics.recordVectorSearch(duration, collection);
    
    return results;
}, attributes);
```

---

## Status

- ✅ LLM Service - **COMPLETE**
- ⏭️ Session Coordinator - **TODO**
- ⏭️ Memory Manager - **TODO**
- ⏭️ Vector Manager - **TODO**
- ⏭️ Tool Service - **TODO**
- ⏭️ Context Builder - **TODO**

---

## Notes

- Tracing adds minimal overhead (~1-2ms per span)
- Traces are sampled (not all requests are traced in production)
- Use meaningful span names: `service.method` format
- Add relevant attributes for debugging
- Integrate with existing metrics collection

---

**Created:** December 9, 2025  
**Status:** LLM Service instrumented, guide created for remaining services
