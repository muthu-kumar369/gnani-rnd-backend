import mongoose, { Schema, Document } from 'mongoose';

export interface ISharedConversation extends Document {
    conversationId: string;
    userId: string;
    shareId: string;
    isPublic: boolean;
    expiresAt?: Date;
    viewCount: number;
    createdAt: Date;
}

const sharedConversationSchema = new Schema<ISharedConversation>({
    conversationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    shareId: { type: String, required: true, unique: true, index: true },
    isPublic: { type: Boolean, default: true },
    expiresAt: { type: Date },
    viewCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Index for cleanup of expired shares
sharedConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SharedConversation = mongoose.model<ISharedConversation>('SharedConversation', sharedConversationSchema);

export default SharedConversation;
