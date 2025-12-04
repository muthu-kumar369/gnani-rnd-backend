import mongoose, { Schema, Document } from 'mongoose';

export interface ITool extends Document {
    name: string;
    description: string;
    version: string;
    author: string;
    icon: string;
    isEnabled: boolean;
    configSchema: Record<string, any>;
    config: Record<string, any>;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ToolSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    version: { type: String, default: '1.0.0' },
    author: { type: String, default: 'System' },
    icon: { type: String, default: 'Box' }, // Lucide icon name
    isEnabled: { type: Boolean, default: true },
    configSchema: { type: Object, default: {} }, // JSON Schema for config
    config: { type: Object, default: {} }, // Actual config values
    isSystem: { type: Boolean, default: false }, // System tools cannot be deleted
}, {
    timestamps: true
});

// Index for efficient searching
ToolSchema.index({ name: 'text', description: 'text' });

export const Tool = mongoose.model<ITool>('Tool', ToolSchema);
