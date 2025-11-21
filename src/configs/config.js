// backend/src/config/config.js
require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    GRPC_PORT: process.env.GRPC_PORT || 50051,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE_ERROR: process.env.LOG_FILE_ERROR || 'logs/error.log',
    LOG_FILE_COMBINED: process.env.LOG_FILE_COMBINED || 'logs/combined.log',
    ASR_ENGINE_PATH: process.env.ASR_ENGINE_PATH || './whisper_engine', // Placeholder path
    LLM_SERVER_URL: process.env.LLM_SERVER_URL || 'http://localhost:8080', // Placeholder URL for LLM API
    LLM_MODEL_PATH: process.env.LLM_MODEL_PATH || './models/llm-model.gguf', // Path to local LLM model
    LLM_API_KEY: process.env.LLM_API_KEY || 'your_llm_api_key_here', // API Key for external LLM (if applicable)
    LLM_MAX_TOKENS: parseInt(process.env.LLM_MAX_TOKENS || '200', 10),
    LLM_TEMPERATURE: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    LLM_STREAMING_ENABLED: (process.env.LLM_STREAMING_ENABLED === 'true'),
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani',
    JWT_SECRET: process.env.JWT_SECRET || 'supersecretjwtkey', // Default for development

    // Whisper Configuration
    WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH || './models/whisper-medium.pt', // Path to Whisper model
    WHISPER_LANGUAGE: process.env.WHISPER_LANGUAGE || 'en',
    WHISPER_SAMPLE_RATE: parseInt(process.env.WHISPER_SAMPLE_RATE || '16000', 10),
    WHISPER_COMPUTE_TYPE: process.env.WHISPER_COMPUTE_TYPE || 'float16', // e.g., 'float16', 'int8' for optimization
    WHISPER_PYTHON_PATH: process.env.WHISPER_PYTHON_PATH || 'python', // Path to Python executable for Whisper

    // System Execution & Electron Integration
    ALLOWED_ACTIONS: JSON.parse(process.env.ALLOWED_ACTIONS || '{"OPEN_APP":true, "SEARCH_WEB":true, "SET_TIMER":true, "CONTROL_VOLUME":true}'),
    MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10),

    // TTS Configuration
    TTS_ENGINE: process.env.TTS_ENGINE || 'coqui-tts', // e.g., 'coqui-tts', 'vits', 'google-cloud-tts'
    TTS_VOICE: process.env.TTS_VOICE || 'en_US/cmu-arctic_slt', // Specific voice
    TTS_LANGUAGE: process.env.TTS_LANGUAGE || 'en',
    TTS_SAMPLE_RATE: parseInt(process.env.TTS_SAMPLE_RATE || '22050', 10), // Common sample rate for TTS
    TTS_STREAM_CHUNK_SIZE: parseInt(process.env.TTS_STREAM_CHUNK_SIZE || '1024', 10), // Size of audio chunks for streaming
    TTS_PYTHON_PATH: process.env.TTS_PYTHON_PATH || 'python', // Path to Python executable for TTS
};
