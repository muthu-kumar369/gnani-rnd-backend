// src/models/User.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');

// Embedded Schemas
const settingsSchema = new mongoose.Schema({
    wakeWord: { type: String, default: 'Hey Gnani' },
    preferredVoice: { type: String, default: 'default' },
    volume: { type: Number, min: 0, max: 100, default: 75 },
    theme: { type: String, default: 'dark' },
    shortcuts: { type: Map, of: String }, // Map for custom command shortcuts
}, { _id: false });

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, default: uuidv4, unique: true },
    deviceName: { type: String, required: true },
    deviceType: { type: String, required: true }, // e.g., 'mobile', 'desktop', 'web', 'speaker'
    lastActive: { type: Date, default: Date.now },
}, { _id: false });

const historyItemSchema = new mongoose.Schema({
    query: { type: String, required: true },
    response: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const profileSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    dob: Date,
    locale: { type: String, default: 'en-US' },
    language: { type: String, default: 'en' },
    avatarUrl: String,
}, { _id: false });

const securitySchema = new mongoose.Schema({
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

// Main User Schema
const userSchema = new mongoose.Schema({
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
            validator: validator.isEmail,
            message: 'Invalid email format'
        },
        index: true // Added index
    },
    passwordHash: { type: String, required: true },
    roles: [{ type: String, enum: ['owner', 'admin', 'user', 'guest'], default: ['user'] }],
    permissions: [{ type: String }], // List of allowed system actions
    settings: { type: settingsSchema, default: {} },
    devices: [deviceSchema],
    history: [historyItemSchema],
    profile: { type: profileSchema, default: {} },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} }, // Flexible JSON
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: Date,
    isActive: { type: Boolean, default: true },
    security: { type: securitySchema, default: {} },
    notes: [{ type: String }], // Array of arbitrary user notes
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // Flexible JSON for future extensions
}, { timestamps: true }); // Mongoose handles createdAt and updatedAt automatically

// Ensure `updatedAt` is updated on save
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
