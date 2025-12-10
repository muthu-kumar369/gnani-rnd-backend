import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedback extends Document {
    userId: string;
    conversationId: string;
    messageId: string;
    rating: 'positive' | 'negative';
    comment?: string;
    category?: string;
    timestamp: Date;
}

const feedbackSchema = new Schema<IFeedback>({
    userId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, index: true },
    rating: {
        type: String,
        required: true,
        enum: ['positive', 'negative']
    },
    comment: { type: String },
    category: {
        type: String,
        enum: ['accuracy', 'helpfulness', 'speed', 'other']
    },
    timestamp: { type: Date, default: Date.now, index: true }
});

// Compound index for unique feedback per message per user
feedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema);
