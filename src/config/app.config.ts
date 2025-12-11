// STAGE 1: Centralized backend configuration with validation
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000').transform(Number),
    HOST: z.string().default('localhost'),

    // Database
    MONGODB_URI: z.string(),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379').transform(Number),
    REDIS_PASSWORD: z.string().optional(),

    // API
    API_VERSION: z.string().default('v1'),
    API_BASE_PATH: z.string().default('/api'),

    // LLM
    LLM_PROVIDER: z.enum(['ollama', 'localai', 'vllm', 'llamacpp']).default('ollama'),
    LLM_SERVER_URL: z.string().default('http://localhost:11434'),
    LLM_MODEL: z.string().default('llama2'),
    LLM_MAX_TOKENS: z.string().default('4096').transform(Number),
    LLM_TEMPERATURE: z.string().default('0.7').transform(Number),

    // Whisper
    WHISPER_PROVIDER: z.enum(['api', 'cpp']).default('cpp'),
    WHISPER_CPP_PATH: z.string().default('./whisper-cpp/main'),
    WHISPER_MODEL_PATH: z.string().default('./whisper-cpp/models/ggml-base.en.bin'),
    WHISPER_PYTHON_PATH: z.string().default('python'), // STAGE 1
    WHISPER_LANGUAGE: z.string().default('en'), // STAGE 1
    WHISPER_SAMPLE_RATE: z.string().default('16000').transform(Number), // STAGE 1
    WHISPER_COMPUTE_TYPE: z.string().default('int8'), // STAGE 1

    // ChromaDB
    CHROMA_HOST: z.string().default('localhost'),
    CHROMA_PORT: z.string().default('8000').transform(Number),

    // File Upload
    MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),
    UPLOAD_DIR: z.string().default('./uploads'),

    // Cache
    CACHE_TTL_SECONDS: z.string().default('3600').transform(Number),
    CACHE_MAX_KEYS: z.string().default('1000').transform(Number),

    // Security
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string().default('1h'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

    // Vault (optional)
    VAULT_ENABLED: z.string().default('false').transform(v => v === 'true'),
    VAULT_ADDR: z.string().optional(),
    VAULT_TOKEN: z.string().optional(),
});

const parseConfig = () => {
    try {
        return configSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Configuration validation failed:');
            error.issues.forEach((err: z.ZodIssue) => {
                console.error(`  ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};

export const config = parseConfig();
export default config;
