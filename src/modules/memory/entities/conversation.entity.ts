// src/modules/memory/entities/conversation.entity.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationMessage extends Document {
    userId: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata: {
        intent?: string;
        action?: any;
        cacheHit?: boolean;
        processingTime?: number;
        [key: string]: any;
    };
    attachments?: Array<{
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        parsedContent: string;
    }>;
    tokenUsage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
        model: string;
    };
    parentId?: string;
    children?: string[];
    branchIndex?: number;
    timestamp: Date;
    createdAt: Date;
}

const conversationMessageSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    attachments: {
        type: [{
            fileId: { type: String, required: true },
            fileName: { type: String, required: true },
            fileSize: { type: Number, required: true },
            mimeType: { type: String, required: true },
            parsedContent: { type: String, default: '' }
        }],
        default: []
    },
    tokenUsage: {
        inputTokens: { type: Number },
        outputTokens: { type: Number },
        totalTokens: { type: Number },
        estimatedCost: { type: Number },
        model: { type: String }
    },
    parentId: {
        type: String,
        default: null,
        index: true
    },
    children: {
        type: [String],
        default: []
    },
    branchIndex: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    collection: 'conversation_messages'
});

// Compound indexes for efficient queries
conversationMessageSchema.index({ userId: 1, timestamp: -1 });
conversationMessageSchema.index({ sessionId: 1, timestamp: 1 });
conversationMessageSchema.index({ userId: 1, createdAt: 1 });
conversationMessageSchema.index({ content: 'text' }); // Text index for search

// TTL index for auto-deletion (30 days by default)
// This will be set dynamically based on env config
conversationMessageSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days in seconds
);

const ConversationMessage = mongoose.model<IConversationMessage>(
    'ConversationMessage',
    conversationMessageSchema
);

export default ConversationMessage;
