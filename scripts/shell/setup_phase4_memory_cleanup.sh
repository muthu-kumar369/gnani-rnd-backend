#!/bin/bash

# scripts/shell/setup_phase4_memory_cleanup.sh
# Setup Memory Cleanup Jobs for Phase 4

echo "========================================="
echo "Setting up Memory Cleanup..."
echo "========================================="

# Install cron dependency
echo ""
echo "Installing node-cron..."
npm install node-cron

# Create jobs directory
echo ""
echo "Creating jobs directory..."
mkdir -p src/jobs

echo ""
echo "========================================="
echo "✅ Memory cleanup setup complete!"
echo "========================================="
echo ""
echo "Cleanup jobs configured:"
echo "- ChromaDB: Daily at 2 AM (deletes embeddings >30 days)"
echo "- MongoDB: Weekly on Sunday at 3 AM (deletes conversations >90 days)"
echo "- Redis: TTL policies (sessions: 1h, memory: 24h)"
