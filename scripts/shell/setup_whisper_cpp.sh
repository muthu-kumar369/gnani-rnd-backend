#!/bin/bash

# setup_whisper_cpp.sh
# Installs whisper.cpp for high-performance STT (5-10x faster than Python)
# Updated with correct build process for latest whisper.cpp

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

# Set installation directory
INSTALL_DIR="$HOME/.gnani/whisper.cpp"

# Backup old installation if exists
if [ -d "$INSTALL_DIR" ]; then
    echo ""
    echo "Backing up existing installation..."
    mv "$INSTALL_DIR" "$HOME/.gnani/whisper.cpp.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Clone whisper.cpp
echo ""
echo "Cloning whisper.cpp..."
git clone https://github.com/ggerganov/whisper.cpp.git "$INSTALL_DIR"

if [ $? -ne 0 ]; then
    echo "ERROR: Git clone failed"
    exit 1
fi

cd "$INSTALL_DIR"

# Compile using cmake (modern build system)
echo ""
echo "Compiling whisper.cpp..."
make -j4

if [ $? -ne 0 ]; then
    echo "ERROR: Compilation failed"
    exit 1
fi

# Verify binary was created
if [ ! -f "build/bin/whisper-cli" ]; then
    echo "ERROR: Binary 'whisper-cli' not found in build/bin/"
    echo "Checking for alternative locations..."
    find . -name "whisper-cli" -type f
    exit 1
fi

echo "✅ Compilation successful! Binary: build/bin/whisper-cli"

# Download model
echo ""
echo "Downloading Whisper base.en model (142MB)..."
bash ./models/download-ggml-model.sh base.en

if [ $? -ne 0 ]; then
    echo "ERROR: Model download failed"
    exit 1
fi

# Verify model was downloaded
if [ ! -f "models/ggml-base.en.bin" ]; then
    echo "ERROR: Model file not found"
    exit 1
fi

echo "✅ Model downloaded successfully!"

echo ""
echo "========================================="
echo "Whisper.cpp installed successfully!"
echo "========================================="
echo ""
echo "Installation location: $INSTALL_DIR"
echo "Binary: $INSTALL_DIR/build/bin/whisper-cli"
echo "Model: $INSTALL_DIR/models/ggml-base.en.bin"
echo ""

# Test with sample audio
echo "Testing whisper.cpp with sample audio..."
if [ -f "samples/jfk.wav" ]; then
    echo "Running test transcription..."
    ./build/bin/whisper-cli -m models/ggml-base.en.bin -f samples/jfk.wav -nt -l en -t 4 2>&1 | grep -E "And so|fellow Americans"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Test successful! Whisper.cpp is working correctly."
    else
        echo ""
        echo "⚠️  Test completed but output verification failed"
        echo "Running full test output:"
        ./build/bin/whisper-cli -m models/ggml-base.en.bin -f samples/jfk.wav
    fi
else
    echo "Sample audio not found, skipping test"
fi

echo ""
echo "========================================="
echo "Setup complete!"
echo "========================================="
echo ""
echo "Audio Format Requirements:"
echo "  - Format: WAV (RIFF)"
echo "  - Codec: PCM 16-bit"
echo "  - Channels: Mono (1)"
echo "  - Sample Rate: 16000 Hz"
echo ""
echo "Next steps:"
echo "1. Whisper.cpp is now the default STT service"
echo "2. To use Python Whisper instead: export USE_WHISPER_CPP=false"
echo "3. Restart backend: npm run dev"
echo "4. Test by speaking into the application"
echo ""
echo "Performance:"
echo "  - Whisper.cpp: ~100-200ms latency"
echo "  - Python Whisper: ~500ms+ latency"
echo "  - Whisper.cpp is 5-10x faster!"
echo ""
