#!/bin/bash

# Setup script for Stage 2 Security Infrastructure
# This script sets up Vault and migrates secrets

set -e

echo "🔐 Stage 2 Security Setup"
echo "=========================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Start Vault
echo "📦 Starting HashiCorp Vault..."
docker-compose -f docker-compose.vault.yml up -d

echo "⏳ Waiting for Vault to be ready..."
sleep 5

# Check Vault health
if docker exec gnani-vault vault status > /dev/null 2>&1; then
    echo "✅ Vault is running"
else
    echo "❌ Vault failed to start"
    exit 1
fi

echo ""
echo "🔑 Vault is ready!"
echo "   URL: http://localhost:8200"
echo "   Token: dev-root-token"
echo ""

# Ask if user wants to migrate secrets
read -p "Do you want to migrate secrets from .env to Vault? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Migrating secrets..."
    node scripts/migrate-secrets-to-vault.js
else
    echo "⏭️  Skipping secret migration"
    echo ""
    echo "To migrate secrets later, run:"
    echo "  node scripts/migrate-secrets-to-vault.js"
fi

echo ""
echo "✅ Stage 2 Security Setup Complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Review migrated secrets in Vault UI: http://localhost:8200"
echo "   2. Update .env with Vault configuration"
echo "   3. Remove sensitive values from .env file"
echo "   4. Restart your application"
echo ""
