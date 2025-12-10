// STAGE 1: Centralized backend configuration with validation
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    HOST: z.string().default('localhost'),

    // Database
    MONGODB_URI: z.string(),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().transform(Number).default('6379'),
    REDIS_PASSWORD: z.string().optional(),

    // API
    API_VERSION: z.string().default('v1'),
    API_BASE_PATH: z.string().default('/api'),

    // LLM
    LLM_PROVIDER: z.enum(['ollama', 'localai', 'vllm', 'llamacpp']).default('ollama'),
    LLM_SERVER_URL: z.string().default('http://localhost:11434'),
    LLM_MODEL: z.string().default('llama2'),
    LLM_MAX_TOKENS: z.string().transform(Number).default('4096'),
    LLM_TEMPERATURE: z.string().transform(Number).default('0.7'),

    // Whisper
    WHISPER_PROVIDER: z.enum(['api', 'cpp']).default('cpp'),
    WHISPER_CPP_PATH: z.string().default('./whisper-cpp/main'),
    WHISPER_MODEL_PATH: z.string().default('./whisper-cpp/models/ggml-base.en.bin'),
    WHISPER_PYTHON_PATH: z.string().default('python'), // STAGE 1
    WHISPER_LANGUAGE: z.string().default('en'), // STAGE 1
    WHISPER_SAMPLE_RATE: z.string().transform(Number).default('16000'), // STAGE 1
    WHISPER_COMPUTE_TYPE: z.string().default('int8'), // STAGE 1

    // ChromaDB
    CHROMA_HOST: z.string().default('localhost'),
    CHROMA_PORT: z.string().transform(Number).default('8000'),

    // File Upload
    MAX_FILE_SIZE_MB: z.string().transform(Number).default('50'),
    UPLOAD_DIR: z.string().default('./uploads'),

    // Cache
    CACHE_TTL_SECONDS: z.string().transform(Number).default('3600'),
    CACHE_MAX_KEYS: z.string().transform(Number).default('1000'),

    // Security
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string().default('1h'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

    // Vault (optional)
    VAULT_ENABLED: z.string().transform(v => v === 'true').default('false'),
    VAULT_ADDR: z.string().optional(),
    VAULT_TOKEN: z.string().optional(),
});

const parseConfig = () => {
    try {
        return configSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Configuration validation failed:');
            error.errors.forEach(err => {
                console.error(`  ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};

export const config = parseConfig();
export default config;
