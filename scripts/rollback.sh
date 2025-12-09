#!/bin/bash

ENVIRONMENT=${1:-production}

echo "Rolling back Gnani in ${ENVIRONMENT}..."

# Rollback deployment
kubectl rollout undo deployment/gnani-backend -n gnani-${ENVIRONMENT}

# Wait for rollback
kubectl rollout status deployment/gnani-backend -n gnani-${ENVIRONMENT} --timeout=5m

# Verify rollback
kubectl get pods -n gnani-${ENVIRONMENT} -l app=gnani-backend

echo "Rollback complete!"
