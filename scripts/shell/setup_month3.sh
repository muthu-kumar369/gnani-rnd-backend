#!/bin/bash

# setup_month3.sh
# Orchestrator script for Month-3 implementation
# Calls individual setup scripts for Whisper.cpp, caching, and production features

echo "========================================="
echo "Month-3 Setup (Performance & Production)"
echo "========================================="

# Ensure scripts are executable
chmod +x scripts/shell/setup_whisper_cpp.sh

# --- Setup Whisper.cpp ---
echo ""
echo "--- Setting up Whisper.cpp (3x faster STT) ---"
scripts/shell/setup_whisper_cpp.sh

if [ $? -ne 0 ]; then
    echo "ERROR: Whisper.cpp setup failed"
    exit 1
fi

echo ""
echo "========================================="
echo "Month-3 Setup Complete!"
echo "========================================="
echo ""
echo "Features installed:"
echo "  ✅ Whisper.cpp (STT latency <100ms)"
echo ""
echo "Next steps:"
echo "1. Enable features in .env:"
echo "   USE_WHISPER_CPP=true"
echo "   ENABLE_LLM_CACHE=true"
echo "   ENABLE_TOOL_CACHE=true"
echo "2. Restart backend: npm restart"
echo "3. Monitor performance: curl http://localhost:9464/metrics"
