# Audio Stream Error - Fix Summary (Round 2)

## Problem
User reported "IPC: Stream error {message: 'Audio stream not active.'}" again.

## Root Cause
Even though memory *storage* was made non-blocking, the **memory retrieval** (specifically from ChromaDB) was still blocking the prompt generation.
If ChromaDB was slow to respond (or hanging), the backend would wait indefinitely to build the prompt. Meanwhile, the frontend or gRPC stream would timeout, leading to the "Audio stream not active" error when the backend finally tried to send the response.

## Solution
Added a **2-second timeout** to the long-term memory retrieval in `MemoryManager`:

```typescript
// src/modules/memory/memory.manager.ts

// Race against a 2-second timeout
const timeoutPromise = new Promise<string[]>((_, reject) => 
    setTimeout(() => reject(new Error('Long-term memory retrieval timed out')), 2000)
);

longTermMemories = await Promise.race([longTermPromise, timeoutPromise]);
```

## Benefits
- **Resilience**: If ChromaDB is slow/down, the system gracefully skips long-term memory instead of crashing or hanging.
- **Responsiveness**: Guarantees that prompt building proceeds within a reasonable time.
- **Stability**: Prevents stream timeouts caused by backend delays.

## Files Modified
- `src/modules/memory/memory.manager.ts`

## Testing
Restart the backend. The system should now be robust against vector database latency.
