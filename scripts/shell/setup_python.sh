#!/bin/bash

# setup_python.sh
# This script sets up the Python virtual environment and installs Whisper/TTS dependencies.

echo "Starting Python environment setup..."

# Check if python3 and pip3 are available
if ! command -v python3 &> /dev/null || ! command -v pip3 &> /dev/null
then
    echo "Error: python3 or pip3 not found. Please run setup_system_packages.sh first."
    exit 1
fi

# --- 1. Create Python virtual environment ---
VENV_DIR=".venv"
if [ -d "$VENV_DIR" ]; then
    # Check if it's a valid venv, if not, remove it.
    if [ ! -f "$VENV_DIR/bin/activate" ]; then
        echo "Found an invalid virtual environment in $VENV_DIR. Removing it."
        rm -rf "$VENV_DIR"
        echo "Creating Python virtual environment in $VENV_DIR..."
        python3 -m venv "$VENV_DIR"
    else
        echo "Python virtual environment already exists in $VENV_DIR."
    fi
else
    echo "Creating Python virtual environment in $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi


# --- 2. Activate virtual environment ---
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# --- 3. Install necessary Python packages ---
echo "Installing Python packages: openai-whisper, numpy, scipy, torch (CPU), TTS (Coqui), chromadb..."
# openai-whisper (medium model)
pip install "openai-whisper[medium]"

# numpy, scipy
pip install numpy scipy

# torch (CPU version for broad compatibility)
# For GPU support (CUDA), uncomment the following line and comment out the CPU one:
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Dependencies for open-source TTS (Coqui TTS for example)
# Note: Coqui TTS might have specific system dependencies or installation nuances.
# This assumes a basic pip install is sufficient.
# You might need to adjust this based on the specific TTS library chosen.
pip install TTS

# Install chromadb within the virtual environment
pip install chromadb

echo "Python packages installed. Deactivating virtual environment..."
deactivate

echo "Python environment setup complete."
