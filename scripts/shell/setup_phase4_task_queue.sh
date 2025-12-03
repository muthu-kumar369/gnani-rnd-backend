#!/bin/bash

# scripts/shell/setup_phase4_task_queue.sh
# Setup Task Queue (BullMQ) for Phase 4

echo "========================================="
echo "Setting up Task Queue (BullMQ)..."
echo "========================================="

# Install dependencies
echo ""
echo "Installing BullMQ and dependencies..."
npm install bullmq ioredis

# Check Redis
echo ""
echo "Checking Redis availability..."
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Redis is running"
else
  echo "⚠️  Redis is not running"
  echo "   Note: Redis is required for task queue"
  echo "   Start Redis with: redis-server"
fi

# Create queue directories
echo ""
echo "Creating queue directories..."
mkdir -p src/queues
mkdir -p src/jobs

echo ""
echo "✅ Task Queue setup complete!"
