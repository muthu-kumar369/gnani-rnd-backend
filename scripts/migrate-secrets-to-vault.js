#!/usr/bin/env node

/**
 * Migrate secrets from .env file to HashiCorp Vault
 * Usage: node scripts/migrate-secrets-to-vault.js
 */

import { vaultService } from '../src/core/secrets/vault.service.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '../.env') });

const SECRETS_TO_MIGRATE = [
    'JWT_SECRET',
    'MONGODB_URI',
    'REDIS_URL',
    'OLLAMA_BASE_URL',
    'CHROMADB_URL',
    'SLACK_WEBHOOK_URL',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
];

async function migrateSecrets() {
    console.log('🔐 Starting secrets migration to Vault...\n');

    try {
        // Initialize Vault connection
        console.log('Connecting to Vault...');
        await vaultService.initialize();

        if (!vaultService.isAvailable()) {
            console.error('❌ Vault is not available. Please ensure Vault is running.');
            console.log('\nTo start Vault:');
            console.log('  docker-compose -f docker-compose.vault.yml up -d');
            process.exit(1);
        }

        console.log('✅ Connected to Vault successfully\n');

        let migratedCount = 0;
        let skippedCount = 0;

        // Migrate each secret
        for (const key of SECRETS_TO_MIGRATE) {
            const value = process.env[key];

            if (!value || value === '' || value.includes('your_') || value.includes('_here')) {
                console.log(`⏭️  Skipping ${key} (not set or placeholder value)`);
                skippedCount++;
                continue;
            }

            try {
                await vaultService.setSecret(key, value);
                console.log(`✅ Migrated ${key}`);
                migratedCount++;
            } catch (error) {
                console.error(`❌ Failed to migrate ${key}:`, error.message);
            }
        }

        console.log(`\n📊 Migration Summary:`);
        console.log(`   Migrated: ${migratedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log(`   Total: ${SECRETS_TO_MIGRATE.length}`);

        if (migratedCount > 0) {
            console.log('\n✅ Migration complete!');
            console.log('\n⚠️  Next steps:');
            console.log('   1. Update .env to point to Vault:');
            console.log('      VAULT_ADDR=http://localhost:8200');
            console.log('      VAULT_TOKEN=dev-root-token');
            console.log('   2. Remove sensitive values from .env (keep as empty or remove lines)');
            console.log('   3. Restart your application');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
migrateSecrets();
