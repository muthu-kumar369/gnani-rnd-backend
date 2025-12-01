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
echo "Starting TEI Docker container..."

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
    echo "Stopping and removing existing container..."
    docker rm -f "$CONTAINER_NAME"
fi

# Get absolute path for volume mount (WSL compatibility)
# In WSL, PWD might be /mnt/d/..., which Docker understands
ABS_MODEL_DIR="$(cd "$MODEL_DIR/onnx" && pwd)"

echo "Mounting model from: $ABS_MODEL_DIR"

docker run -d \
  -p 8080:80 \
  -v "$ABS_MODEL_DIR:/data" \
  --name "$CONTAINER_NAME" \
  --shm-size 1g \
  --restart always \
  "$IMAGE_NAME" \
  --model-id /data \
  --port 80

if [ $? -eq 0 ]; then
    echo "TEI container started successfully."
else
    echo "Error: Failed to start TEI container."
    exit 1
fi
