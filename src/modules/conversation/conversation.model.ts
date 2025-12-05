import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
    userId: string;
    sessionId: string;
    title: string;
    systemPrompt: string;
    currentTemplate?: string;  // Template ID currently applied to this conversation
    currentModel?: string;     // Model ID currently selected for this conversation
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
    sessionId: {
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

const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
