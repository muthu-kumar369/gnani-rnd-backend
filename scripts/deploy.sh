#!/bin/bash

# Configuration
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
REGISTRY="gnani"
PROJ_DIR=$(dirname $(dirname $0))

echo "Deploying Gnani to ${ENVIRONMENT} (version: ${VERSION})"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|production)$ ]]; then
  echo "Error: Invalid environment. Must be development or production."
  exit 1
fi

# Build Docker image
echo "Building Docker image..."
docker build -t ${REGISTRY}/backend:${VERSION} ${PROJ_DIR}

# If separate registry is used, push here
# echo "Pushing to registry..."
# docker push ${REGISTRY}/backend:${VERSION}

# Deploy to Kubernetes
echo "Deploying to Kubernetes..."
# Note: This assumes kubectl context is already set
kubectl apply -k ${PROJ_DIR}/k8s/overlays/${ENVIRONMENT}

# Update deployment image
kubectl set image deployment/gnani-backend \
  backend=${REGISTRY}/backend:${VERSION} \
  -n gnani-${ENVIRONMENT}

# Wait for rollout
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/gnani-backend -n gnani-${ENVIRONMENT} --timeout=5m

# Verify deployment
echo "Verifying deployment..."
kubectl get pods -n gnani-${ENVIRONMENT} -l app=gnani-backend

echo "Deployment complete!"
