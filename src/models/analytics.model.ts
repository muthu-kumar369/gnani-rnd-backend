import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
    userId: string;
    conversationId?: string;
    event: string;
    metadata: {
        tokens?: number;
        cost?: number;
        model?: string;
        duration?: number;
    };
    timestamp: Date;
}

const analyticsSchema = new Schema<IAnalytics>({
    userId: { type: String, required: true, index: true },
    conversationId: { type: String, index: true },
    event: {
        type: String,
        required: true,
        enum: ['message_sent', 'tokens_used', 'conversation_created', 'file_uploaded']
    },
    metadata: {
        tokens: { type: Number },
        cost: { type: Number },
        model: { type: String },
        duration: { type: Number }
    },
    timestamp: { type: Date, default: Date.now, index: true }
});

// Index for efficient queries
analyticsSchema.index({ userId: 1, timestamp: -1 });
analyticsSchema.index({ event: 1, timestamp: -1 });

export const Analytics = mongoose.model<IAnalytics>('Analytics', analyticsSchema);
