// src/modules/memory/entities/conversation-summary.entity.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationSummary extends Document {
    userId: string;
    conversationIds: string[];
    summary: string;
    messageCount: number;
    startTime: Date;
    endTime: Date;
    topics: string[];
    embeddingId?: string; // Reference to ChromaDB embedding ID
    embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    userRating: number; // 0-5 rating, default 0
    metadata: {
        intents?: string[];
        actions?: any[];
        [key: string]: any;
    };
    createdAt: Date;
    updatedAt: Date;
}

const conversationSummarySchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    conversationIds: [{
        type: String,
        required: true
    }],
    summary: {
        type: String,
        required: true
    },
    messageCount: {
        type: Number,
        required: true,
        default: 0
    },
    startTime: {
        type: Date,
        required: true,
        index: true
    },
    endTime: {
        type: Date,
        required: true
    },
    topics: [{
        type: String
    }],
    embeddingId: {
        type: String,
        index: true
    },
    embeddingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    userRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'conversation_summaries'
});

// Compound indexes for efficient queries
conversationSummarySchema.index({ userId: 1, createdAt: -1 });
conversationSummarySchema.index({ userId: 1, embeddingStatus: 1 });

const ConversationSummary = mongoose.model<IConversationSummary>(
    'ConversationSummary',
    conversationSummarySchema
);

export default ConversationSummary;
