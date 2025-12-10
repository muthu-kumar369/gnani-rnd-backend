import mongoose, { Schema, Document } from 'mongoose';

export interface IPlugin extends Document {
    pluginId: string;
    name: string;
    version: string;
    author: string;
    description: string;
    icon: string;
    category: 'productivity' | 'utility' | 'integration' | 'ui' | 'other';
    downloads: number;
    rating: number;
    code: string; // Plugin code (for security, this would be sandboxed)
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const pluginSchema = new Schema({
    pluginId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    version: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    icon: {
        type: String,
        default: '🔌',
    },
    category: {
        type: String,
        enum: ['productivity', 'utility', 'integration', 'ui', 'other'],
        default: 'other',
    },
    downloads: {
        type: Number,
        default: 0,
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },
    code: {
        type: String,
        required: true,
    },
    verified: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Index for searching plugins
pluginSchema.index({ name: 'text', description: 'text' });
pluginSchema.index({ category: 1, downloads: -1 });

const Plugin = mongoose.model<IPlugin>('Plugin', pluginSchema);

export default Plugin;
