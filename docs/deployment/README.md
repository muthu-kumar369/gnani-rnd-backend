# Gnani Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker registry access
- Secrets configured in Vault

## Quick Start

### Deploy to Development

```bash
./scripts/deploy.sh development
```

### Deploy to Production

```bash
./scripts/deploy.sh production v1.2.3
```

### Rollback

```bash
./scripts/rollback.sh production
```

## Manual Deployment

### 1. Build and Push Image

```bash
docker build -t gnani/backend:v1.2.3 .
docker push gnani/backend:v1.2.3
```

### 2. Apply Kubernetes Manifests

```bash
kubectl apply -k k8s/overlays/production
```

### 3. Update Deployment

```bash
kubectl set image deployment/gnani-backend \
  backend=gnani/backend:v1.2.3 \
  -n gnani-production
```

### 4. Monitor Rollout

```bash
kubectl rollout status deployment/gnani-backend -n gnani-production
```

## Health Checks

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- Startup: `GET /health/startup`

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n gnani-production
kubectl logs <pod-name> -n gnani-production
```

### Deployment stuck

```bash
kubectl rollout status deployment/gnani-backend -n gnani-production
kubectl get events -n gnani-production
```
