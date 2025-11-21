#!/bin/bash

# verify_setup.sh
# This script verifies the successful setup of MongoDB, Node.js environment,
# Python environment with Whisper/TTS, and ChromaDB.

echo "Starting GNANI backend setup verification..."

# Function to report success or failure
report_status() {
    if [ $? -eq 0 ]; then
        echo "SUCCESS: $1"
    else
        echo "FAILURE: $1"
        EXIT_CODE=1
    fi
}

EXIT_CODE=0

# --- 1. Verify MongoDB Connection ---
echo "--- Verifying MongoDB Connection ---"
if systemctl is-active --quiet mongod; then
    echo "MongoDB service is running."
    # Try connecting with mongosh shell
    mongosh --eval 'db.adminCommand("ping")' > /dev/null 2>&1
    report_status "MongoDB connection (ping)"
else
    echo "MongoDB service is not running."
    report_status "MongoDB service check"
fi

# --- 2. Verify Node.js Dependencies ---
echo "--- Verifying Node.js Environment ---"
if [ -d "node_modules" ]; then
    echo "Node.js 'node_modules' directory found."
    # Check if a critical package like express is resolvable
    node -e "require('express')" > /dev/null 2>&1
    report_status "Node.js 'express' package resolvable"
else
    echo "Node.js 'node_modules' directory not found. Please run 'npm install' or 'setup_node.sh'."
    report_status "Node.js 'node_modules' directory check"
fi

# --- 3. Verify Python Virtual Environment and Packages ---
echo "--- Verifying Python Environment (Whisper/TTS) ---"
VENV_DIR=".venv"
if [ -d "$VENV_DIR" ]; then
    echo "Python virtual environment found. Activating..."
    source "$VENV_DIR/bin/activate"
    report_status "Python virtual environment activation"

    # Check for whisper and TTS imports
    python -c "import whisper" > /dev/null 2>&1
    report_status "Python 'whisper' package import"
    python -c "import TTS" > /dev/null 2>&1
    report_status "Python 'TTS' package import"

    echo "Deactivating Python virtual environment..."
    deactivate
else
    echo "Python virtual environment not found. Please run 'setup_python.sh'."
    report_status "Python virtual environment check"
fi

# --- 4. Verify Vector DB (Chroma) Connection ---
echo "--- Verifying ChromaDB Connection ---"
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
fi

CHROMA_VERIFY_SCRIPT="verify_chroma.py"
cat <<EOF > "$CHROMA_VERIFY_SCRIPT"
import chromadb

print("Attempting to connect to ChromaDB and list collections...")
try:
    client = chromadb.Client() # Assumes a persistent client or in-memory
    collections = client.list_collections()
    print(f"Successfully connected to ChromaDB. Found {len(collections)} collections.")
    for col in collections:
        print(f"- Collection: {col.name}")
except Exception as e:
    print(f"Error connecting to ChromaDB: {e}")
    exit(1)
EOF
python3 "$CHROMA_VERIFY_SCRIPT" > /dev/null 2>&1
report_status "ChromaDB connection and collection listing"
if [ $? -ne 0 ]; then
    echo "ChromaDB verification failed. See output above for details."
fi
rm "$CHROMA_VERIFY_SCRIPT"
if [ -d "$VENV_DIR" ]; then
    deactivate
fi

# --- 5. Sample Whisper/TTS Audio Test (Placeholder) ---
echo "--- Running Sample Whisper/TTS Audio Test ---"
echo "To run a full Whisper/TTS test, you would typically:"
echo "  1. Activate the Python virtual environment: source .venv/bin/activate"
echo "  2. Download a small audio file (e.g., a .wav or .mp3)."
echo "  3. Run Whisper: python -c \"import whisper; model = whisper.load_model('tiny'); result = model.transcribe('your_audio.wav'); print(result['text'])\""
echo "  4. Run TTS: python -c \"from TTS.api import TTS; tts = TTS(model_name='tts_models/en/ljspeech/tacotron2-DDC'); tts.tts_to_file(text='Hello, this is a test.', file_path='tts_output.wav')\""
echo "  5. Deactivate virtual environment: deactivate"
echo "Manual audio tests are recommended for full verification."
echo "Placeholder for automated audio test. Skipping for now."

echo "GNANI backend setup verification complete. Overall status: $([ $EXIT_CODE -eq 0 ] && echo "SUCCESS" || echo "FAILURE")"
exit $EXIT_CODE