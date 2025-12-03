#!/bin/bash

# scripts/deploy-production.sh

set -e

echo "🚀 Starting Production Deployment..."

# Configuration
APP_NAME="gnani-backend"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_CHECK_URL="http://localhost:3000/api/health"

# 1. Pre-deployment Checks
echo "🔍 Running pre-deployment checks..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

# 2. Run Tests
echo "🧪 Running tests..."
npm run test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Aborting deployment."
    exit 1
fi

# 3. Build Docker Images
echo "🏗️ Building Docker images..."
docker-compose -f $DOCKER_COMPOSE_FILE build

# 4. Deploy
echo "🚢 Deploying to production..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# 5. Health Check
echo "💓 Verifying health..."
MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f $HEALTH_CHECK_URL > /dev/null; then
        HEALTHY=true
        break
    fi
    echo "Waiting for service to be healthy... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTHY" = true ]; then
    echo "✅ Deployment successful! Service is healthy."
else
    echo "❌ Deployment failed. Service is unhealthy."
    echo "🔄 Rolling back..."
    docker-compose -f $DOCKER_COMPOSE_FILE down
    # Ideally, you would tag images and rollback to previous tag here
    exit 1
fi

echo "🎉 Deployment complete!"
