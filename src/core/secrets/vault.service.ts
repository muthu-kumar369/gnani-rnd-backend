import vault from 'node-vault';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'VaultService' });

export class VaultService {
    private client: any;
    private readonly secretPath = 'secret/data/gnani';
    private initialized = false;

    constructor() {
        this.client = vault({
            endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
            token: process.env.VAULT_TOKEN,
        });
    }

    /**
     * Initialize Vault and load secrets
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Test connection
            await this.client.health();
            logger.info('Connected to Vault successfully');

            // Load secrets into memory (cached)
            await this.loadSecrets();
            this.initialized = true;
        } catch (error: any) {
            logger.error('Failed to connect to Vault', { error: error.message });
            logger.warn('Falling back to .env file for secrets');
            // Don't throw - allow fallback to .env
        }
    }

    /**
     * Get a secret value
     */
    async getSecret(key: string): Promise<string> {
        try {
            const result = await this.client.read(`${this.secretPath}/${key}`);
            return result.data.data.value;
        } catch (error: any) {
            logger.error(`Failed to read secret: ${key}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Set a secret value
     */
    async setSecret(key: string, value: string): Promise<void> {
        try {
            await this.client.write(`${this.secretPath}/${key}`, {
                data: { value },
            });
            logger.info(`Secret updated: ${key}`);
        } catch (error: any) {
            logger.error(`Failed to write secret: ${key}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Load all secrets into environment variables (for backward compatibility)
     */
    private async loadSecrets(): Promise<void> {
        const secretKeys = [
            'JWT_SECRET',
            'MONGODB_URI',
            'REDIS_URL',
            'OLLAMA_BASE_URL',
            'CHROMADB_URL',
            'SLACK_WEBHOOK_URL',
            'SMTP_PASSWORD',
            'SMTP_USERNAME',
        ];

        for (const key of secretKeys) {
            try {
                const value = await this.getSecret(key);
                process.env[key] = value;
                logger.debug(`Loaded secret from Vault: ${key}`);
            } catch (error) {
                logger.warn(`Secret not found in Vault: ${key}, using .env fallback`);
            }
        }
    }

    /**
     * Rotate a secret (generate new value and update)
     */
    async rotateSecret(key: string, generator: () => string): Promise<void> {
        const newValue = generator();
        await this.setSecret(key, newValue);
        process.env[key] = newValue;
        logger.info(`Secret rotated: ${key}`);
    }

    /**
     * Check if Vault is available
     */
    isAvailable(): boolean {
        return this.initialized;
    }
}

// Singleton instance
export const vaultService = new VaultService();
