# Stage 1: Session Persistence - Integration Guide

## Files Created

1. ✅ `src/modules/session/session.model.ts` - MongoDB schema
2. ✅ `src/modules/session/session.persistence.ts` - Persistence service  
3. ✅ `src/jobs/session-cleanup.job.ts` - Cleanup cron job

## Session Coordinator Integration

### Changes Required in `session.coordinator.ts`

#### 1. Import Added ✅
```typescript
import sessionPersistence from './session.persistence.js';
```

#### 2. Checkpoint Counter Added ✅
```typescript
private checkpointCounters: Map<string, number> = new Map();
```

#### 3. Modify `startSession()` Method

**Add after line 122 (after returning sessionId and conversationId):**

```typescript
// Stage 1: Persist to MongoDB
try {
    await sessionPersistence.saveSession({
        sessionId,
        userId,
        conversationId: convId,
        state: 'IDLE',
        audioBuffer: null,
        pendingTranscript: null,
        contextSnapshot: null,
        llmState: null,
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {}
    });
    this.logger.debug(`Session persisted to MongoDB: ${sessionId}`);
} catch (error: any) {
    this.logger.error(`Failed to persist session to MongoDB: ${error.message}`);
    // Continue anyway - MongoDB persistence is not critical for session start
}
```

#### 4. Modify `processAudioChunk()` Method

**Add after line 186 (after updating Redis state):**

```typescript
// Stage 1: Checkpoint every 10 chunks
if (this.shouldCheckpoint(sessionId)) {
    this.checkpointSession(sessionId).catch(err =>
        this.logger.error(`Failed to checkpoint session: ${err.message}`)
    );
}
```

#### 5. Add Checkpoint Helper Methods

**Add at end of class (before closing brace):**

```typescript
/**
 * Stage 1: Check if session should be checkpointed
 */
private shouldCheckpoint(sessionId: string): boolean {
    const count = (this.checkpointCounters.get(sessionId) || 0) + 1;
    this.checkpointCounters.set(sessionId, count);

    if (count >= 10) {
        this.checkpointCounters.set(sessionId, 0);
        return true;
    }
    return false;
}

/**
 * Stage 1: Checkpoint session to MongoDB
 */
private async checkpointSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await sessionPersistence.checkpoint(sessionId, {
        sessionId,
        userId: session.userId,
        conversationId: session.conversationId,
        state: 'IDLE', // TODO: Track actual state
        lastActivity: new Date(),
        metadata: session.metadata
    });
}
```

#### 6. Enhance `recoverSession()` Method

**Replace entire method (lines 133-164):**

```typescript
async recoverSession(sessionId: string): Promise<Session | null> {
    this.logger.info(`Attempting to recover session: ${sessionId}`);

    // Stage 1: Try MongoDB first (most complete state)
    try {
        const persistedSession = await sessionPersistence.loadSession(sessionId);

        if (persistedSession) {
            this.logger.info(`Session recovered from MongoDB: ${sessionId}`);

            // Reconstruct in-memory session
            const session: Session = {
                userId: persistedSession.userId,
                conversationId: persistedSession.conversationId,
                createdAt: persistedSession.createdAt.getTime(),
                lastActivity: Date.now(),
                timeoutId: null,
                onTranscriptionCallback: async () => {},
                onLlmChunkCallback: async () => {},
                onLlmCompleteCallback: async () => {},
                onToolStatusCallback: async () => {},
                metadata: persistedSession.metadata || {}
            };

            this.sessions.set(sessionId, session);

            // Re-initialize components
            await this.audioProcessor.initialize(sessionId);

            // TODO: Restore audio buffer from S3/local if exists
            if (persistedSession.audioBuffer?.storageUrl) {
                this.logger.info(`Audio buffer available at: ${persistedSession.audioBuffer.storageUrl}`);
            }

            // TODO: Restore pending transcript if exists
            if (persistedSession.pendingTranscript) {
                this.logger.info(`Restored pending transcript: ${persistedSession.pendingTranscript.text}`);
            }

            this.resetSessionTimeout(sessionId);

            return session;
        }
    } catch (error: any) {
        this.logger.error(`Failed to recover from MongoDB: ${error.message}`);
    }

    // Fallback to Redis (partial state)
    const state = await sessionMemory.getSessionState(sessionId);
    if (!state || !state.userId) {
        this.logger.warn(`Session not found in MongoDB or Redis: ${sessionId}`);
        return null;
    }

    this.logger.info(`Session recovered from Redis (partial): ${sessionId}`);

    // Reconstruct session object
    const session: Session = {
        userId: state.userId,
        conversationId: state.conversationId || sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        timeoutId: null,
        onTranscriptionCallback: async () => {},
        onLlmChunkCallback: async () => {},
        onLlmCompleteCallback: async () => {},
        onToolStatusCallback: async () => {},
        metadata: state.metadata || {}
    };

    this.sessions.set(sessionId);
    await this.audioProcessor.initialize(sessionId);
    this.resetSessionTimeout(sessionId);

    return session;
}
```

#### 7. Modify `endSession()` Method

**Find the `endSession()` method and add before `return true;`:**

```typescript
// Stage 1: Delete from MongoDB
try {
    await sessionPersistence.deleteSession(sessionId);
    this.logger.debug(`Session deleted from MongoDB: ${sessionId}`);
} catch (error: any) {
    this.logger.error(`Failed to delete session from MongoDB: ${error.message}`);
}

// Cleanup checkpoint counter
this.checkpointCounters.delete(sessionId);
```

## Register Cleanup Job

### In `src/app.ts`

**Add import:**
```typescript
import { startSessionCleanupJob } from './jobs/session-cleanup.job.js';
```

**Add after other job starts (around line 56):**
```typescript
// Stage 1: Start session cleanup job
startSessionCleanupJob();
logger.info('Session cleanup job started');
```

## Testing Checklist

### Manual Tests

- [ ] Start session → Check MongoDB for session document
- [ ] Send 10 audio chunks → Verify checkpoint created
- [ ] Restart backend → Recover session successfully
- [ ] Wait for expiration → Verify cleanup job removes session
- [ ] Check logs for persistence errors

### Verification Queries

```bash
# Check session in MongoDB
mongosh gnani
db.sessions.findOne({ sessionId: "your-session-id" })

# Check all active sessions
db.sessions.find({ expiresAt: { $gt: new Date() } }).count()

# Check expired sessions
db.sessions.find({ expiresAt: { $lt: new Date() } }).count()
```

## Notes

- Audio buffer storage (S3/local) will be implemented in future stage
- For now, `audioBuffer.storageUrl` will be null
- Checkpoint happens every 10 audio chunks OR 5 minutes
- Session TTL is 24 hours (vs previous 30 minutes)
- MongoDB persistence is non-blocking - errors are logged but don't fail operations
