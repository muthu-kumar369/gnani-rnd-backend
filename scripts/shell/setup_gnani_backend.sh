#!/bin/bash

# setup_gnani_backend.sh
# Comprehensive setup script for the GNANI backend.
# This script orchestrates the installation of system packages,
# Python environment with Whisper/TTS, Node.js project, and database setup.
# It ensures idempotency and provides verification steps.

echo "=========================================="
echo " Starting Comprehensive GNANI Backend Setup "
echo "=========================================="

# Ensure scripts are executable
chmod +x scripts/shell/setup_system_packages.sh
chmod +x scripts/shell/setup_python.sh
chmod +x scripts/shell/setup_node.sh
chmod +x scripts/shell/setup_db.sh
chmod +x scripts/shell/verify_setup.sh

# --- 1. Install System Packages ---
echo ""
echo "--- Step 1/5: Installing System Packages (Node.js, Python, MongoDB, ChromaDB) ---"
scripts/shell/setup_system_packages.sh
if [ $? -ne 0 ]; then
    echo "Error: System package setup failed. Exiting."
    exit 1
fi

# --- 2. Setup Python Environment ---
echo ""
echo "--- Step 2/5: Setting up Python Environment (Virtualenv, Whisper, TTS) ---"
scripts/shell/setup_python.sh
if [ $? -ne 0 ]; then
    echo "Error: Python environment setup failed. Exiting."
    exit 1
fi

# --- 3. Setup Node.js Environment ---
echo ""
echo "--- Step 3/5: Setting up Node.js Environment (Project Init, NPM Packages, Folder Structure) ---"
scripts/shell/setup_node.sh
if [ $? -ne 0 ]; then
    echo "Error: Node.js environment setup failed. Exiting."
    exit 1
fi

# --- 4. Setup Databases (MongoDB, ChromaDB) ---
echo ""
echo "--- Step 4/5: Setting up Databases (MongoDB, ChromaDB) ---"
scripts/shell/setup_db.sh
if [ $? -ne 0 ]; then
    echo "Error: Database setup failed. Exiting."
    exit 1
fi

# --- 4b. Setup TEI (Embedding Service) ---
echo ""
echo "--- Step 4b/5: Setting up TEI (Text Embeddings Inference) ---"
chmod +x scripts/shell/setup_tei.sh
scripts/shell/setup_tei.sh
if [ $? -ne 0 ]; then
    echo "Error: TEI setup failed. Exiting."
    exit 1
fi

# --- 5. Verify Setup ---
echo ""
echo "--- Step 5/5: Verifying GNANI Backend Setup ---"
scripts/shell/verify_setup.sh
if [ $? -ne 0 ]; then
    echo "Verification completed with failures. Please review the logs above."
    exit 1
fi

echo ""
echo "=========================================="
echo " GNANI Backend Setup Complete Successfully!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Navigate to the project root directory."
echo "2. Create a '.env' file by copying '.env.template': cp .env.template .env"
echo "3. Edit the '.env' file with your actual environment variables (e.g., MongoDB credentials, API keys)."
echo "4. Activate the Python virtual environment if you want to run Python scripts manually: source .venv/bin/activate"
echo "5. Start the Node.js server: npm start (or node index.js)"
echo "6. Explore the generated folder structure in the 'src/' directory."
echo ""
echo "Remember to install any additional TTS models or Whisper models as needed."
