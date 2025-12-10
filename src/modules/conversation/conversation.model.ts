import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
    userId: string;
    conversationId: string;
    title: string;
    systemPrompt: string;
    currentTemplate?: string;  // Template ID currently applied to this conversation
    currentModel?: string;     // Model ID currently selected for this conversation
    folderId?: string;         // Folder ID (STAGE R6)
    tags?: string[];           // Tags (STAGE R6)
    isDeleted: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const conversationSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    conversationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        default: 'New Conversation'
    },
    systemPrompt: {
        type: String,
        default: 'You are Gnani, a helpful AI assistant.'
    },
    currentTemplate: {
        type: String,
        required: false
    },
    currentModel: {
        type: String,
        required: false,
        default: 'gemma:2b'  // Default to gemma:2b for low RAM usage
    },
    folderId: {
        type: String,
        required: false,
        index: true
    },
    tags: {
        type: [String],
        default: [],
        index: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'conversations'
});

// Index for listing user's active conversations
conversationSchema.index({ userId: 1, isDeleted: 1, updatedAt: -1 });

// Text index for title search
conversationSchema.index({ title: 'text' });

// STAGE 12: Compound indexes for optimized queries
conversationSchema.index({ userId: 1, updatedAt: -1 }); // List conversations sorted by date
conversationSchema.index({ userId: 1, title: 'text' }); // Search conversations by title
// Note: pinned field would need to be added to schema first
// conversationSchema.index({ userId: 1, pinned: -1, updatedAt: -1 }); // Pinned conversations first

// STAGE 27: Full-text search index
conversationSchema.index({
    title: 'text',
    systemPrompt: 'text'
});

const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
