#!/bin/bash

# scripts/shell/setup_phase4_llm_abstraction.sh
# Setup LLM Abstraction Layer for Phase 4

echo "========================================="
echo "Setting up LLM Abstraction Layer..."
echo "========================================="

# Create directories
echo "Creating directories..."
mkdir -p src/core/llm
mkdir -p src/config
mkdir -p tests/unit/llm

# Check if Ollama is running
echo ""
echo "Checking Ollama availability..."
curl -s http://localhost:11434/api/tags > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Ollama is running"
else
  echo "⚠️  Ollama is not running"
  echo "   Note: Ollama is required for LLM functionality"
  echo "   You can start it later with: ollama serve"
fi

# Update .env.example if needed
echo ""
echo "Updating .env.example..."
if ! grep -q "LLM_CODE_MODEL" .env.example 2>/dev/null; then
  cat >> .env.example << 'EOF'

# LLM Provider Configuration (Phase 4)
LLM_PROVIDER=ollama
LLM_CODE_MODEL=llama3.1:8b
LLM_PLANNING_MODEL=llama3.1:8b
EOF
  echo "✅ Added LLM configuration to .env.example"
else
  echo "✅ LLM configuration already exists in .env.example"
fi

echo ""
echo "✅ LLM Abstraction Layer setup complete!"
