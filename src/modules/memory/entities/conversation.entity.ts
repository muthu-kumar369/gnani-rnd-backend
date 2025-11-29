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
