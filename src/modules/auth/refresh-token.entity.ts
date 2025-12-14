import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    revoked: boolean;
    replacedByToken?: string;
    deviceId?: string;
    userAgent?: string;
}

const refreshTokenSchema = new Schema({
    userId: { type: String, ref: 'User', required: true, index: true },
    token: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    replacedByToken: { type: String },
    deviceId: { type: String },
    userAgent: { type: String }
}, {
    timestamps: false, // We use createdAt manually, updated not really needed for immutable tokens
    collection: 'refresh_tokens'
});

// TTL Index to automatically clean up expired tokens (optional, but good practice)
// Expires after 'expiresAt'
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
