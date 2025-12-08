// src/modules/session/session.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
    sessionId: string;
    userId: string;
    conversationId: string;
    state: 'IDLE' | 'LISTENING' | 'PROCESSING' | 'THINKING' | 'GENERATING' | 'SPEAKING' | 'TOOL_EXECUTING' | 'ERROR';

    // Audio state - stores reference to S3/local storage, not raw data
    audioBuffer: {
        storageUrl: string | null;  // S3 URL or local file path
        sampleRate: number;
        totalDuration: number;
        chunkCount: number;
    } | null;

    pendingTranscript: {
        text: string;
        isFinal: boolean;
        timestamp: Date;
    } | null;

    // Context snapshot
    contextSnapshot: {
        recentMessages: any[];
        relevantMemories: any[];
        systemPrompt: string;
        timestamp: Date;
    } | null;

    // LLM state
    llmState: {
        requestId: string | null;
        partialResponse: string;
        model: string;
        isStreaming: boolean;
    } | null;

    // Metadata
    createdAt: Date;
    lastActivity: Date;
    lastCheckpoint: Date;
    expiresAt: Date;

    // Recovery info
    recoveryAttempts: number;
    lastRecoveryAt: Date | null;

    // Session metadata
    metadata: {
        grpcCallActive: boolean;
        deviceInfo: any;
        [key: string]: any;
    };
}

const SessionSchema = new Schema<ISession>({
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    state: {
        type: String,
        enum: ['IDLE', 'LISTENING', 'PROCESSING', 'THINKING', 'GENERATING', 'SPEAKING', 'TOOL_EXECUTING', 'ERROR'],
        default: 'IDLE'
    },

    // Audio buffer - stores reference only
    audioBuffer: {
        storageUrl: String,  // S3 URL or local path
        sampleRate: Number,
        totalDuration: Number,
        chunkCount: Number
    },

    pendingTranscript: {
        text: String,
        isFinal: Boolean,
        timestamp: Date
    },

    contextSnapshot: {
        recentMessages: [Schema.Types.Mixed],
        relevantMemories: [Schema.Types.Mixed],
        systemPrompt: String,
        timestamp: Date
    },

    llmState: {
        requestId: String,
        partialResponse: String,
        model: String,
        isStreaming: Boolean
    },

    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    lastCheckpoint: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },

    recoveryAttempts: { type: Number, default: 0 },
    lastRecoveryAt: Date,

    metadata: { type: Schema.Types.Mixed, default: {} }
});

// TTL index for automatic cleanup
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for common queries
SessionSchema.index({ userId: 1, lastActivity: -1 });
SessionSchema.index({ state: 1, lastActivity: -1 });

// Cleanup audio files when session is deleted
SessionSchema.pre('deleteOne', async function () {
    const session = await this.model.findOne(this.getFilter());
    if (session?.audioBuffer?.storageUrl) {
        // TODO: Delete audio file from S3/local storage
        // This will be implemented in the audio storage service
    }
});

export default mongoose.model<ISession>('Session', SessionSchema);
