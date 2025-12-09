import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionEvent extends Document {
    sessionId: string;
    type: string; // 'audio', 'transcript', 'llm_request', 'llm_response', 'tool_exec', 'error'
    data: any;
    timestamp: Date;
    metadata?: any;
}

const SessionEventSchema = new Schema({
    sessionId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed }
}, {
    timestamps: true,
    collection: 'session_events'
});

// Index for efficient retrieval by session and time
SessionEventSchema.index({ sessionId: 1, timestamp: 1 });

export const SessionEvent = mongoose.model<ISessionEvent>('SessionEvent', SessionEventSchema);
