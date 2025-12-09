# Stage 2 Security Setup Script (PowerShell)
# This script sets up Vault and migrates secrets

Write-Host "🔐 Stage 2 Security Setup" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Start Vault
Write-Host "📦 Starting HashiCorp Vault..." -ForegroundColor Yellow
docker-compose -f docker-compose.vault.yml up -d

Write-Host "⏳ Waiting for Vault to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check Vault health
try {
    docker exec gnani-vault vault status | Out-Null
    Write-Host "✅ Vault is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Vault failed to start" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔑 Vault is ready!" -ForegroundColor Green
Write-Host "   URL: http://localhost:8200" -ForegroundColor White
Write-Host "   Token: dev-root-token" -ForegroundColor White
Write-Host ""

# Ask if user wants to migrate secrets
$response = Read-Host "Do you want to migrate secrets from .env to Vault? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "🔄 Migrating secrets..." -ForegroundColor Yellow
    node scripts/migrate-secrets-to-vault.js
} else {
    Write-Host "⏭️  Skipping secret migration" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To migrate secrets later, run:" -ForegroundColor White
    Write-Host "  node scripts/migrate-secrets-to-vault.js" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Stage 2 Security Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Review migrated secrets in Vault UI: http://localhost:8200" -ForegroundColor White
Write-Host "   2. Update .env with Vault configuration" -ForegroundColor White
Write-Host "   3. Remove sensitive values from .env file" -ForegroundColor White
Write-Host "   4. Restart your application" -ForegroundColor White
Write-Host ""
