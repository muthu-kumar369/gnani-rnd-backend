#!/bin/bash

# setup_tei.sh
# Automates the setup of HuggingFace Text Embeddings Inference (TEI)
# specifically for environments with network restrictions (like WSL)
# by manually downloading the model and mounting it.

MODEL_ID="sentence-transformers/all-MiniLM-L6-v2"
MODEL_DIR="data/models/all-MiniLM-L6-v2"
CONTAINER_NAME="tei-embedding"
IMAGE_NAME="ghcr.io/huggingface/text-embeddings-inference:cpu-1.5"

echo "----------------------------------------------------------------"
echo "Setting up HuggingFace TEI (Text Embeddings Inference)"
echo "----------------------------------------------------------------"

# 1. Install git-lfs if not present
if ! command -v git-lfs &> /dev/null; then
    echo "git-lfs could not be found. Attempting to install..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y git-lfs
        git lfs install
    else
        echo "Error: git-lfs is required but not installed. Please install it manually."
        exit 1
    fi
else
    echo "git-lfs is already installed."
    git lfs install
fi

# 2. Download Model
if [ -d "$MODEL_DIR" ]; then
    echo "Model directory $MODEL_DIR already exists."
    # Check if model.onnx exists inside onnx subdirectory
    if [ ! -f "$MODEL_DIR/onnx/model.onnx" ]; then
        echo "Model files incomplete. Pulling latest..."
        cd "$MODEL_DIR" || exit
        git lfs pull
        cd - || exit
    fi
else
    echo "Downloading model $MODEL_ID..."
    mkdir -p "$(dirname "$MODEL_DIR")"
    git clone "https://huggingface.co/$MODEL_ID" "$MODEL_DIR"
    cd "$MODEL_DIR" || exit
    git lfs pull
    cd - || exit
fi

# 3. Organize Model Files for TEI (ONNX)
# TEI expects config.json and tokenizer.json in the same directory as model.onnx
echo "Organizing model files for TEI..."
mkdir -p "$MODEL_DIR/onnx"
# Copy config files if they don't exist in onnx/
if [ ! -f "$MODEL_DIR/onnx/config.json" ]; then
    cp "$MODEL_DIR"/*.json "$MODEL_DIR/onnx/"
    cp "$MODEL_DIR"/vocab.txt "$MODEL_DIR/onnx/" 2>/dev/null || true
    cp -r "$MODEL_DIR/1_Pooling" "$MODEL_DIR/onnx/" 2>/dev/null || true
fi

# Ensure the actual ONNX model is in place (overwriting pointers if necessary)
# This handles the case where git clone only got pointers
if [ -f "$MODEL_DIR/onnx/model.onnx" ]; then
    # Simple check: if file is small (<1KB), it might be a pointer. Real model is ~90MB.
    FILE_SIZE=$(stat -c%s "$MODEL_DIR/onnx/model.onnx")
    if [ "$FILE_SIZE" -lt 1000 ]; then
        echo "Detected git-lfs pointer. Copying actual model file..."
        cp "$MODEL_DIR/model.onnx" "$MODEL_DIR/onnx/model.onnx" 2>/dev/null || true
        cp "$MODEL_DIR/model_qint8_avx512.onnx" "$MODEL_DIR/onnx/model_quantized.onnx" 2>/dev/null || true
    fi
fi

# 4. Run Docker Container
echo "Model setup complete."
echo "Please run 'docker-compose up -d' to start the TEI service along with other backend services."
