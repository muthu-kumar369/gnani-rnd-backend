# Gnani Backend - Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Database Setup](#database-setup)
- [Monitoring Setup](#monitoring-setup)
- [Production Checklist](#production-checklist)

---

## Prerequisites

### Required Software
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB:** v6.0 or higher
- **Redis:** v7.0 or higher
- **Docker:** v20.10 or higher (for containerized deployment)
- **Kubernetes:** v1.24 or higher (for K8s deployment)

### Optional Tools
- **k6:** For load testing
- **Prometheus:** For metrics collection
- **Grafana:** For dashboards
- **Jaeger:** For distributed tracing

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/gnani-backend.git
cd gnani-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Configure the following variables in `.env`:

#### Core Configuration
```env
NODE_ENV=production
PORT=3000
APP_VERSION=1.0.0
```

#### Database
```env
MONGODB_URI=mongodb://localhost:27017/gnani
MONGODB_MAX_POOL_SIZE=100
MONGODB_MIN_POOL_SIZE=10
```

#### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

#### LLM Server
```env
LLM_SERVER_URL=http://localhost:8080
LLM_MODEL_NAME=llama-3-8b
LLM_MAX_TOKENS=2048
LLM_TEMPERATURE=0.7
```

#### Security
```env
JWT_SECRET=your-super-secret-jwt-key-change-this
SESSION_SECRET=your-session-secret-change-this
```

#### Monitoring (Optional)
```env
JAEGER_ENDPOINT=http://localhost:14268/api/traces
PROMETHEUS_PORT=9090
```

#### CORS
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

---

## Local Development

### 1. Start Dependencies
```bash
# Start MongoDB
mongod --dbpath ./data/db

# Start Redis
redis-server
```

### 2. Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Verify Health
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Docker Deployment

### 1. Build Docker Image
```bash
docker build -t gnani-backend:latest .
```

### 2. Run with Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    image: gnani-backend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/gnani
      - REDIS_HOST=redis
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  mongo-data:
  redis-data:
```

Start services:
```bash
docker-compose up -d
```

### 3. Verify Deployment
```bash
docker-compose ps
docker-compose logs -f backend
```

---

## Kubernetes Deployment

### 1. Create Namespace
```bash
kubectl create namespace gnani
```

### 2. Create Secrets
```bash
kubectl create secret generic gnani-secrets \
  --from-literal=mongodb-uri='mongodb://mongo:27017/gnani' \
  --from-literal=redis-password='your-redis-password' \
  --from-literal=jwt-secret='your-jwt-secret' \
  -n gnani
```

### 3. Apply Manifests
```bash
# Apply all K8s manifests
kubectl apply -f k8s/ -n gnani
```

### 4. Verify Deployment
```bash
# Check pods
kubectl get pods -n gnani

# Check services
kubectl get svc -n gnani

# Check logs
kubectl logs -f deployment/gnani-backend -n gnani
```

### 5. Access Service
```bash
# Port forward for testing
kubectl port-forward svc/gnani-backend 3000:3000 -n gnani

# Or use LoadBalancer/Ingress
kubectl get ingress -n gnani
```

---

## Database Setup

### 1. MongoDB Initialization

Connect to MongoDB:
```bash
mongosh mongodb://localhost:27017/gnani
```

Create indexes:
```javascript
// Conversations
db.conversations.createIndex({ userId: 1, createdAt: -1 });
db.conversations.createIndex({ conversationId: 1 }, { unique: true });

// Messages
db.messages.createIndex({ conversationId: 1, timestamp: 1 });
db.messages.createIndex({ userId: 1, timestamp: -1 });

// Sessions
db.sessions.createIndex({ sessionId: 1 }, { unique: true });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ lastActivity: 1 }, { expireAfterSeconds: 3600 });

// Audit logs
db.auditlogs.createIndex({ userId: 1, timestamp: -1 });
db.auditlogs.createIndex({ category: 1, severity: 1, timestamp: -1 });
db.auditlogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days
```

### 2. Database Migrations

Run migrations:
```bash
npm run migrate
```

Rollback (if needed):
```bash
npm run migrate:rollback
```

---

## Monitoring Setup

### 1. Prometheus

Deploy Prometheus:
```bash
cd monitoring
docker-compose up -d prometheus
```

Access Prometheus UI: `http://localhost:9090`

Verify targets: `http://localhost:9090/targets`

### 2. Grafana

Deploy Grafana:
```bash
docker-compose up -d grafana
```

Access Grafana UI: `http://localhost:3001`
- Default credentials: `admin/admin`

Import dashboards:
1. Go to Dashboards → Import
2. Upload JSON files from `monitoring/grafana/dashboards/`

### 3. Jaeger (Optional)

Deploy Jaeger:
```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 14268:14268 \
  jaegertracing/all-in-one:latest
```

Access Jaeger UI: `http://localhost:16686`

---

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Secrets rotated and secured
- [ ] Database indexes created
- [ ] Connection pooling configured (100 max, 10 min)
- [ ] Rate limiting enabled
- [ ] CORS configured for production origins
- [ ] Logging level set to `info` or `warn`
- [ ] Monitoring stack deployed
- [ ] Alerts configured

### Security
- [ ] JWT secret is strong and unique
- [ ] Redis password set
- [ ] MongoDB authentication enabled
- [ ] HTTPS/TLS enabled
- [ ] Security headers configured (Helmet)
- [ ] Input validation enabled
- [ ] Rate limiting active
- [ ] Audit logging enabled

### Performance
- [ ] Connection pooling: 100 max, 10 min
- [ ] Redis caching enabled
- [ ] LLM response caching (1h TTL)
- [ ] Database indexes created
- [ ] Query optimization enabled

### Monitoring
- [ ] Prometheus metrics endpoint accessible
- [ ] Grafana dashboards imported
- [ ] Alert rules configured
- [ ] Log aggregation setup
- [ ] Distributed tracing enabled (Jaeger)

### High Availability
- [ ] Multiple replicas (3+ recommended)
- [ ] Health checks configured
- [ ] Readiness probes configured
- [ ] Circuit breakers enabled
- [ ] Graceful shutdown implemented
- [ ] Session persistence enabled

### Testing
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Load tests completed (1000+ concurrent users)
- [ ] Smoke tests in staging

---

## Common Commands

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build TypeScript
npm run test         # Run tests
npm run test:coverage # Run tests with coverage
npm run lint         # Run linter
```

### Production
```bash
npm start            # Start production server
npm run migrate      # Run database migrations
npm run health       # Check health status
```

### Docker
```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f backend    # View logs
docker-compose restart backend    # Restart backend
```

### Kubernetes
```bash
kubectl get pods -n gnani                    # List pods
kubectl logs -f deployment/gnani-backend -n gnani  # View logs
kubectl rollout restart deployment/gnani-backend -n gnani  # Restart
kubectl scale deployment/gnani-backend --replicas=5 -n gnani  # Scale
```

---

## Troubleshooting

### Backend Won't Start
1. Check environment variables
2. Verify MongoDB connection
3. Verify Redis connection
4. Check logs: `docker-compose logs backend`

### High Memory Usage
1. Check connection pool size
2. Review cache size
3. Check for memory leaks in logs
4. Scale horizontally

### Database Connection Issues
1. Verify MongoDB is running
2. Check connection string
3. Verify network connectivity
4. Check circuit breaker state

### Redis Connection Issues
1. Verify Redis is running
2. Check Redis password
3. Verify network connectivity
4. Check Redis memory usage

---

## Support

For issues and questions:
- **Documentation:** https://docs.gnani.ai
- **GitHub Issues:** https://github.com/your-org/gnani-backend/issues
- **Email:** support@gnani.ai

---

## License

MIT License - see LICENSE file for details
