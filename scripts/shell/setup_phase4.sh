#!/bin/bash

# scripts/shell/setup_phase4.sh
# Master setup script for Phase 4 Foundation improvements
# This script orchestrates all Phase 4 setup tasks

echo "==========================================="
echo " Starting Phase 4 Foundation Setup "
echo "==========================================="

# Ensure scripts are executable
chmod +x scripts/shell/setup_phase4_llm_abstraction.sh
chmod +x scripts/shell/setup_phase4_testing.sh
chmod +x scripts/shell/setup_phase4_task_queue.sh
chmod +x scripts/shell/setup_phase4_memory_cleanup.sh
chmod +x scripts/shell/setup_phase4_horizontal_scaling.sh
chmod +x scripts/shell/start_multi_instance.sh

# --- 1. LLM Abstraction Layer ---
echo ""
echo "--- Step 1/5: Setting up LLM Abstraction Layer ---"
scripts/shell/setup_phase4_llm_abstraction.sh
if [ $? -ne 0 ]; then
    echo "Error: LLM Abstraction setup failed. Exiting."
    exit 1
fi

# --- 2. Testing Infrastructure ---
echo ""
echo "--- Step 2/5: Setting up Testing Infrastructure ---"
scripts/shell/setup_phase4_testing.sh
if [ $? -ne 0 ]; then
    echo "Error: Testing setup failed. Exiting."
    exit 1
fi

# --- 3. Task Queue ---
echo ""
echo "--- Step 3/5: Setting up Task Queue (BullMQ) ---"
scripts/shell/setup_phase4_task_queue.sh
if [ $? -ne 0 ]; then
    echo "Error: Task Queue setup failed. Exiting."
    exit 1
fi

# --- 4. Memory Cleanup ---
echo ""
echo "--- Step 4/5: Setting up Memory Cleanup Jobs ---"
scripts/shell/setup_phase4_memory_cleanup.sh
if [ $? -ne 0 ]; then
    echo "Error: Memory Cleanup setup failed. Exiting."
    exit 1
fi

# --- 5. Horizontal Scaling ---
echo ""
echo "--- Step 5/5: Setting up Horizontal Scaling ---"
scripts/shell/setup_phase4_horizontal_scaling.sh
if [ $? -ne 0 ]; then
    echo "Error: Horizontal Scaling setup failed. Exiting."
    exit 1
fi

echo ""
echo "==========================================="
echo " Phase 4 Foundation Setup Complete!"
echo "==========================================="
echo ""
echo "Phase 4 Improvements Installed:"
echo "✅ LLM Abstraction Layer (future-proof for multi-agent)"
echo "✅ Testing Infrastructure (Jest + Vitest)"
echo "✅ Task Queue (BullMQ for async operations)"
echo "✅ Memory Cleanup Jobs (automated maintenance)"
echo "✅ Horizontal Scaling (multi-instance support)"
echo ""
echo "Next Steps:"
echo "1. Ensure Ollama is running: ollama serve"
echo "2. Ensure Redis is running: redis-server"
echo "3. Run tests: npm test"
echo "4. Start backend: npm run dev"
echo "5. Or start multi-instance: bash scripts/shell/start_multi_instance.sh"
echo ""

