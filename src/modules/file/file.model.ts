// src/modules/file/file.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IFile extends Document {
    userId: string;
    fileName: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    storageMode: 's3' | 'local';
    parsedContent: string;
    uploadedAt: Date;
}

const fileSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileKey: {
        type: String,
        required: true,
        unique: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    storageMode: {
        type: String,
        enum: ['s3', 'local'],
        required: true
    },
    parsedContent: {
        type: String,
        default: ''
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'files'
});

// Index for user file queries
fileSchema.index({ userId: 1, uploadedAt: -1 });

const File = mongoose.model<IFile>('File', fileSchema);

export default File;
