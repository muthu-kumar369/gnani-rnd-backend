#!/bin/bash

# setup_node.sh
# This script initializes the Node.js project, installs npm packages, creates
# the advanced MVC folder structure, and generates a .env template.

echo "Starting Node.js environment setup..."

# Check if node and npm are available
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null
then
    echo "Error: Node.js or npm not found. Please run setup_system_packages.sh first."
    exit 1
fi

# --- 1. Initialize Node.js project ---
if [ ! -f "package.json" ]; then
    echo "No package.json found. Initializing new Node.js project..."
    npm init -y
else
    echo "package.json already exists. Skipping npm init."
fi

# --- 2. Install Node.js packages ---
echo "Installing core Node.js packages..."
npm install express mongoose dotenv
npm install winston @grpc/grpc-js @grpc/proto-loader
npm install cors helmet morgan
# If you plan to use ChromaDB directly from Node.js, install the client here:
# npm install chromadb

# --- 3. Create Backend Folder Structure (Advanced MVC) ---
echo "Creating backend folder structure..."
mkdir -p src/{controllers,services,models,routes,middlewares,utils,configs,logs,scripts}
if [ ! -f "index.js" ]; then
    echo "Creating main entry point (index.js)..."
    cat <<EOF > index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger'); // Assuming a logger utility

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani';

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('GNANI Backend is running!');
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => logger.info('MongoDB connected'))
    .catch(err => logger.error('MongoDB connection error:', err));

// Start the server
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

EOF
else
    echo "index.js already exists. Skipping creation."
fi

if [ ! -f "src/utils/logger.js" ]; then
    echo "Creating a placeholder logger utility (src/utils/logger.js)..."
    cat <<EOF > src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'src/logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'src/logs/combined.log' }),
    ],
});

module.exports = logger;
EOF
else
    echo "src/utils/logger.js already exists. Skipping creation."
fi


# --- 4. Generate .env template ---
echo "Generating .env.template..."
if [ ! -f ".env.template" ]; then
    cat <<EOF > .env.template
# Application Port
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/gnani
DB_HOST=localhost
DB_PORT=27017
DB_NAME=gnani
DB_USER=
DB_PASSWORD=

# Vector DB Configuration (e.g., ChromaDB)
# For a local ChromaDB instance, you might not need all of these.
VECTOR_DB_HOST=localhost
VECTOR_DB_PORT=8000
COLLECTION_NAME=gnani_embeddings
API_KEY=

# Whisper/TTS Settings
MODEL_PATH=./models/whisper-medium.pt # Placeholder for Whisper model path
VOICE=default                     # Placeholder for TTS voice
LANGUAGE=en                       # Placeholder for TTS language
SAMPLE_RATE=16000                 # Placeholder for audio sample rate

# Security
JWT_SECRET=your_jwt_secret_key_here
EOF
else
    echo ".env.template already exists. Skipping creation."
fi

echo "Node.js environment setup complete."
echo "Please remember to create a '.env' file from '.env.template' and fill in your actual environment variables."