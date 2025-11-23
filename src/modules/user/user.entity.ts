// src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';

// Interface for embedded schemas
export interface ISettings extends Document {
    wakeWord: string;
    preferredVoice: string;
    volume: number;
    theme: string;
    shortcuts: Map<string, string>;
}

export interface IDevice extends Document {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    lastActive: Date;
}

export interface IHistoryItem extends Document {
    query: string;
    response: string;
    timestamp: Date;
}

export interface IProfile extends Document {
    firstName?: string;
    lastName?: string;
    dob?: Date;
    locale: string;
    language: string;
    avatarUrl?: string;
}

export interface ISecurity extends Document {
    failedLoginAttempts: number;
    lastFailedLogin?: Date;
    mfaEnabled: boolean;
    recoveryEmail?: string;
}

// Main User Interface
export interface IUser extends Document {
    userId: string;
    username: string;
    email: string;
    passwordHash: string;
    roles: string[];
    permissions: string[];
    settings: ISettings;
    devices: IDevice[];
    history: IHistoryItem[];
    profile: IProfile;
    preferences: any;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    isActive: boolean;
    security: ISecurity;
    notes: string[];
    metadata: any;
}

// Embedded Schemas
const settingsSchema: Schema = new Schema({
    wakeWord: { type: String, default: 'Hey Gnani' },
    preferredVoice: { type: String, default: 'default' },
    volume: { type: Number, min: 0, max: 100, default: 75 },
    theme: { type: String, default: 'dark' },
    shortcuts: { type: Map, of: String }, // Map for custom command shortcuts
}, { _id: false });

const deviceSchema: Schema = new Schema({
    deviceId: { type: String, default: uuidv4, unique: true },
    deviceName: { type: String, required: true },
    deviceType: { type: String, required: true }, // e.g., 'mobile', 'desktop', 'web', 'speaker'
    lastActive: { type: Date, default: Date.now },
}, { _id: false });

const historyItemSchema: Schema = new Schema({
    query: { type: String, required: true },
    response: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const profileSchema: Schema = new Schema({
    firstName: String,
    lastName: String,
    dob: Date,
    locale: { type: String, default: 'en-US' },
    language: { type: String, default: 'en' },
    avatarUrl: String,
}, { _id: false });

const securitySchema: Schema = new Schema({
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLogin: Date,
    mfaEnabled: { type: Boolean, default: false },
    recoveryEmail: {
        type: String,
        validate: {
            validator: validator.isEmail,
            message: 'Invalid recovery email format'
        }
    }
}, { _id: false });

const userSchema = new Schema({
    userId: { type: String, default: uuidv4, unique: true, required: true, index: true }, // Added index
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        index: true // Added index
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: (value: string) => validator.isEmail(value),
            message: 'Invalid email format'
        },
        index: true // Added index
    },
    passwordHash: { type: String, required: true },
    roles: [{ type: String, enum: ['owner', 'admin', 'user', 'guest'], default: ['user'] }],
    permissions: [{ type: String }], // List of allowed system actions
    settings: { type: settingsSchema, default: {} },
    devices: { type: [deviceSchema], default: [] },
    history: [historyItemSchema],
    profile: { type: profileSchema, default: {} },
    preferences: { type: Schema.Types.Mixed, default: {} }, // Flexible JSON
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: Date,
    isActive: { type: Boolean, default: true },
    security: { type: securitySchema, default: {} },
    notes: [{ type: String }], // Array of arbitrary user notes
    metadata: { type: Schema.Types.Mixed, default: {} }, // Flexible JSON for future extensions
}, { timestamps: true }); // Mongoose handles createdAt and updatedAt automatically

// Ensure `updatedAt` is updated on save
userSchema.pre<IUser>('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
