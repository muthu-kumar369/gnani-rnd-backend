// src/modules/memory/entities/conversation.entity.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationMessage extends Document {
    userId: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;

    // NEW: Lifecycle status
    status: 'draft' | 'pending' | 'streaming' | 'completed' | 'failed' | 'stale' | 'cancelled';

    // NEW: Soft delete support
    deletedAt?: Date;
    deletedBy?: string;
    deletionReason?: string;

    // NEW: Generation tracking
    generationIndex: number;      // 0, 1, 2... for multiple generations
    generationId: string;          // Unique ID for this generation
    parentMessageId?: string;      // The user message this responds to (for assistant messages)

    // NEW: Streaming state
    streamState?: {
        streamId: string;
        startedAt: Date;
        finishedAt?: Date;
        cancelToken?: string;
        sequenceNumber: number;      // Last received chunk sequence
        partialContent?: string;     // Buffer for incomplete streams
    };

    // NEW: Versioning for edits
    version: number;               // Increments on edit
    editHistory?: Array<{
        version: number;
        content: string;
        editedAt: Date;
        editedBy: string;
    }>;

    metadata: {
        intent?: string;
        action?: any;
        cacheHit?: boolean;
        processingTime?: number;

        // NEW: Tracking fields
        regeneratedFrom?: string;    // Original message ID if regenerated
        editedFrom?: string;         // Original message ID if edited
        regeneratedAfterEdit?: boolean;
        editedMessageVersion?: number;
        model?: string;              // Model used for generation
        template?: string;           // Template ID used
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
    conversationId: {
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

    // NEW: Lifecycle status
    status: {
        type: String,
        enum: ['draft', 'pending', 'streaming', 'completed', 'failed', 'stale', 'cancelled'],
        default: 'completed',
        index: true
    },

    // NEW: Soft delete support
    deletedAt: {
        type: Date,
        default: null,
        index: true
    },
    deletedBy: {
        type: String,
        default: null
    },
    deletionReason: {
        type: String,
        default: null
    },

    // NEW: Generation tracking
    generationIndex: {
        type: Number,
        default: 0,
        index: true
    },
    generationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    parentMessageId: {
        type: String,
        default: null,
        index: true
    },

    // NEW: Streaming state
    streamState: {
        streamId: { type: String },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        cancelToken: { type: String },
        sequenceNumber: { type: Number, default: 0 },
        partialContent: { type: String }
    },

    // NEW: Versioning for edits
    version: {
        type: Number,
        default: 1
    },
    editHistory: {
        type: [{
            version: { type: Number, required: true },
            content: { type: String, required: true },
            editedAt: { type: Date, required: true },
            editedBy: { type: String, required: true }
        }],
        default: []
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
conversationMessageSchema.index({ conversationId: 1, timestamp: 1 });
conversationMessageSchema.index({ userId: 1, createdAt: 1 });
conversationMessageSchema.index({ content: 'text' }); // Text index for search

// NEW: Indexes for message lifecycle queries
conversationMessageSchema.index({ conversationId: 1, deletedAt: 1, timestamp: 1 });
conversationMessageSchema.index({ parentMessageId: 1, generationIndex: 1 });
conversationMessageSchema.index({ 'streamState.streamId': 1 }, { sparse: true });
conversationMessageSchema.index({ status: 1, deletedAt: 1 });

// TTL index for auto-deletion (30 days by default)
// This will be set dynamically based on env config
conversationMessageSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days in seconds
);

// Pre-save hook to generate generationId if not provided
conversationMessageSchema.pre('save', function (next) {
    if (!this.generationId) {
        const baseId = this.parentMessageId || this._id;
        this.generationId = `gen_${baseId}_${this.generationIndex}`;
    }
    next();
});

const ConversationMessage = mongoose.model<IConversationMessage>(
    'ConversationMessage',
    conversationMessageSchema
);

export default ConversationMessage;
