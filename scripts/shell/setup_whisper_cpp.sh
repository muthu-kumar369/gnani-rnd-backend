#!/bin/bash

# setup_whisper_cpp.sh
# Installs whisper.cpp for high-performance STT (3x faster than Python)
# This script is part of Month-3 Stage 3.1 implementation

echo "========================================="
echo "Whisper.cpp Setup Script"
echo "========================================="

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Detected OS: $OS"

# Install dependencies
echo ""
echo "Installing dependencies..."

if [ "$OS" == "linux" ]; then
    sudo apt-get update
    sudo apt-get install -y build-essential git cmake
elif [ "$OS" == "mac" ]; then
    brew install cmake
fi

# Clone whisper.cpp
echo ""
echo "Cloning whisper.cpp..."
TEMP_DIR="/tmp/whisper-cpp-install"
rm -rf $TEMP_DIR
git clone https://github.com/ggerganov/whisper.cpp.git $TEMP_DIR
cd $TEMP_DIR

# Compile
echo ""
echo "Compiling whisper.cpp..."
make

if [ $? -ne 0 ]; then
    echo "ERROR: Compilation failed"
    exit 1
fi

# Download model
echo ""
echo "Downloading Whisper base.en model..."
bash ./models/download-ggml-model.sh base.en

if [ $? -ne 0 ]; then
    echo "ERROR: Model download failed"
    exit 1
fi

# Install to project
echo ""
echo "Installing to project..."
INSTALL_DIR="$HOME/.gnani/whisper-cpp"
mkdir -p $INSTALL_DIR

# Copy binaries and models
# Copy binaries and models
if [ -f "bin/main" ]; then
    cp bin/main $INSTALL_DIR/
elif [ -f "main" ]; then
    cp main $INSTALL_DIR/
else
    echo "ERROR: Compiled binary 'main' not found in . or bin/"
    exit 1
fi

cp -r models $INSTALL_DIR/

# Also copy to project directory for Docker
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$PROJECT_DIR/whisper-cpp"
if [ -f "bin/main" ]; then
    cp bin/main "$PROJECT_DIR/whisper-cpp/"
elif [ -f "main" ]; then
    cp main "$PROJECT_DIR/whisper-cpp/"
fi
cp -r models "$PROJECT_DIR/whisper-cpp/"

echo ""
echo "========================================="
echo "Whisper.cpp installed successfully!"
echo "========================================="
echo ""
echo "Installation locations:"
echo "  - User: $INSTALL_DIR"
echo "  - Project: $PROJECT_DIR/whisper-cpp"
echo ""

# Test
echo "Testing whisper.cpp..."
if [ -f "$TEMP_DIR/samples/jfk.wav" ]; then
    echo "Running test with sample audio..."
    $INSTALL_DIR/main -m $INSTALL_DIR/models/ggml-base.en.bin -f $TEMP_DIR/samples/jfk.wav
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Test successful!"
    else
        echo ""
        echo "⚠️  Test failed, but installation completed"
    fi
else
    echo "Sample audio not found, skipping test"
fi

# Cleanup
cd -
rm -rf $TEMP_DIR

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Enable whisper.cpp in .env: USE_WHISPER_CPP=true"
echo "2. Restart backend: npm restart"
echo "3. Monitor latency: curl http://localhost:9464/metrics | grep stt_latency"
