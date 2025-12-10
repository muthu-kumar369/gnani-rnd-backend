import mongoose, { Schema, Document } from 'mongoose';

export interface IFolder extends Document {
    userId: string;
    name: string;
    color?: string;
    icon?: string;
    conversationIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

const folderSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        default: '#22d3ee',
    },
    icon: {
        type: String,
        default: '📁',
    },
    conversationIds: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true,
});

// Index for user's folders
folderSchema.index({ userId: 1, updatedAt: -1 });

const Folder = mongoose.model<IFolder>('Folder', folderSchema);

export default Folder;
