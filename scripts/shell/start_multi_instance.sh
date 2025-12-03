#!/bin/bash

# scripts/shell/start_multi_instance.sh
# Start multiple backend instances for horizontal scaling

echo "========================================="
echo "Starting multiple backend instances..."
echo "========================================="

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "⚠️  .env file not found"
  echo "   Please create .env from .env.example"
  exit 1
fi

# Create logs directory
mkdir -p logs

# Kill existing instances
echo ""
echo "Stopping existing instances..."
pkill -f "node.*dist/index.js" || true
sleep 2

# Start 4 instances on different ports
echo ""
echo "Starting 4 backend instances..."

PORT=3001 GRPC_PORT=50051 npm run start > logs/instance-1.log 2>&1 &
echo "✅ Instance 1 started (HTTP: 3001, gRPC: 50051)"

PORT=3002 GRPC_PORT=50052 npm run start > logs/instance-2.log 2>&1 &
echo "✅ Instance 2 started (HTTP: 3002, gRPC: 50052)"

PORT=3003 GRPC_PORT=50053 npm run start > logs/instance-3.log 2>&1 &
echo "✅ Instance 3 started (HTTP: 3003, gRPC: 50053)"

PORT=3004 GRPC_PORT=50054 npm run start > logs/instance-4.log 2>&1 &
echo "✅ Instance 4 started (HTTP: 3004, gRPC: 50054)"

# Wait for instances to start
echo ""
echo "Waiting for instances to start..."
sleep 5

# Check if instances are running
echo ""
echo "Checking instance health..."
for port in 3001 3002 3003 3004; do
  curl -s http://localhost:$port/api/status/health > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ Instance on port $port is healthy"
  else
    echo "⚠️  Instance on port $port is not responding"
  fi
done

# Start Nginx if configured
if [ -f "nginx/nginx.conf" ] && command -v nginx &> /dev/null; then
  echo ""
  echo "Starting Nginx load balancer..."
  nginx -c $(pwd)/nginx/nginx.conf
  echo "✅ Nginx started"
  echo ""
  echo "Load balancer running on:"
  echo "  HTTP: http://localhost:80"
  echo "  gRPC: localhost:50050"
else
  echo ""
  echo "⚠️  Nginx not configured or not installed"
  echo "   Instances are running but not load balanced"
fi

echo ""
echo "========================================="
echo "✅ Multi-instance setup complete!"
echo "========================================="
echo ""
echo "Logs available in logs/ directory"
echo "To stop all instances: pkill -f 'node.*dist/index.js'"
echo ""
