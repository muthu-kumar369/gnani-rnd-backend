#!/bin/bash

# scripts/shell/setup_phase4_testing.sh
# Setup Testing Infrastructure for Phase 4

echo "========================================="
echo "Setting up Testing Infrastructure..."
echo "========================================="

# Install backend test dependencies
echo ""
echo "Installing backend test dependencies..."
npm install --save-dev @jest/globals @types/jest jest ts-jest supertest

# Create test directories
echo ""
echo "Creating test directories..."
mkdir -p tests/unit/llm
mkdir -p tests/unit/session
mkdir -p tests/unit/memory
mkdir -p tests/integration

echo ""
echo "✅ Testing infrastructure setup complete!"
