// backend/src/configs/config.ts
import dotenv from 'dotenv';
dotenv.config();

export const PORT: number = Number(process.env.PORT) || 3000;
export const GRPC_PORT: number = Number(process.env.GRPC_PORT) || 50051;
export const LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';
export const LOG_FILE_ERROR: string = process.env.LOG_FILE_ERROR || 'logs/error.log';
export const LOG_FILE_COMBINED: string = process.env.LOG_FILE_COMBINED || 'logs/combined.log';
export const ASR_ENGINE_PATH: string = process.env.ASR_ENGINE_PATH || './whisper_engine'; // Placeholder path
export const LLM_SERVER_URL: string = process.env.LLM_SERVER_URL || 'http://localhost:8080'; // Placeholder URL for LLM API
export const LLM_MODEL_PATH: string = process.env.LLM_MODEL_PATH || './models/llm-model.gguf'; // Path to local LLM model
export const LLM_API_KEY: string = process.env.LLM_API_KEY || 'your_llm_api_key_here'; // API Key for external LLM (if applicable)
export const LLM_MAX_TOKENS: number = parseInt(process.env.LLM_MAX_TOKENS || '200', 10);
export const LLM_TEMPERATURE: number = parseFloat(process.env.LLM_TEMPERATURE || '0.7');
export const LLM_STREAMING_ENABLED: boolean = (process.env.LLM_STREAMING_ENABLED === 'true');
export const MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnani';
export const JWT_SECRET: string = process.env.JWT_SECRET || 'supersecretjwtkey'; // Default for development

// Whisper Configuration
export const WHISPER_MODEL_PATH: string = process.env.WHISPER_MODEL_PATH || './models/whisper-medium.pt'; // Path to Whisper model
export const WHISPER_LANGUAGE: string = process.env.WHISPER_LANGUAGE || 'en';
export const WHISPER_SAMPLE_RATE: number = parseInt(process.env.WHISPER_SAMPLE_RATE || '16000', 10);
export const WHISPER_COMPUTE_TYPE: string = process.env.WHISPER_COMPUTE_TYPE || 'float16'; // e.g., 'float16', 'int8' for optimization
export const WHISPER_PYTHON_PATH: string = process.env.WHISPER_PYTHON_PATH || 'python'; // Path to Python executable for Whisper

// System Execution & Electron Integration
export const ALLOWED_ACTIONS: Record<string, boolean> = JSON.parse(process.env.ALLOWED_ACTIONS || '{"OPEN_APP":true, "SEARCH_WEB":true, "SET_TIMER":true, "CONTROL_VOLUME":true}');
export const MAX_CONCURRENT_SESSIONS: number = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10);

// TTS Configuration
export const TTS_ENGINE: string = process.env.TTS_ENGINE || 'coqui-tts'; // e.g., 'coqui-tts', 'vits', 'google-cloud-tts'
export const TTS_VOICE: string = process.env.TTS_VOICE || 'en_US/cmu-arctic_slt'; // Specific voice
export const TTS_LANGUAGE: string = process.env.TTS_LANGUAGE || 'en';
export const TTS_SAMPLE_RATE: number = parseInt(process.env.TTS_SAMPLE_RATE || '22050', 10); // Common sample rate for TTS
export const TTS_STREAM_CHUNK_SIZE: number = parseInt(process.env.TTS_STREAM_CHUNK_SIZE || '1024', 10); // Size of audio chunks for streaming
export const TTS_PYTHON_PATH: string = process.env.TTS_PYTHON_PATH || 'python'; // Path to Python executable for TTS
