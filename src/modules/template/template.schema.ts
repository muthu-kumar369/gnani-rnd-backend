import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
    name: string;
    description: string;
    systemPrompt: string;
    icon: string;
    tags: string[];
    isPublic: boolean;
    createdBy: string; // User ID
    createdAt: Date;
    updatedAt: Date;
}

const TemplateSchema: Schema = new Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    icon: { type: String, default: 'MessageSquare' }, // Lucide icon name
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    createdBy: { type: String, required: true, index: true },
}, {
    timestamps: true
});

// Index for efficient searching
TemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema);
