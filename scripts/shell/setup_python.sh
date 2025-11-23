#!/bin/bash

# setup_python.sh
# This script sets up the Python virtual environment and installs Whisper/TTS dependencies.

echo "Starting Python environment setup..."

# Check if python3 and pip3 are available
if ! command -v python3 &> /dev/null || ! command -v pip3 &> /dev/null
then
    echo "Error: python3 or pip3 not found. Please ensure they are installed or run setup_system_packages.sh first."
    exit 1
fi

echo "Using Python version: $(python3 --version)"

# --- 1. Create Python virtual environment ---
VENV_DIR=".venv"
if [ -d "$VENV_DIR" ]; then
    if [ -f "$VENV_DIR/bin/activate" ]; then
        echo "Python virtual environment already exists and is valid in $VENV_DIR."
    else
        echo "Found an invalid virtual environment in $VENV_DIR. Removing it and recreating."
        rm -rf "$VENV_DIR"
        echo "Creating Python virtual environment in $VENV_DIR..."
        python3.11 -m venv "$VENV_DIR" || { echo "Error: Failed to create virtual environment. Ensure python3-venv is installed. (e.g., sudo apt install python3-venv)"; exit 1; }
    fi
else
    echo "Creating Python virtual environment in $VENV_DIR..."
    python3.11 -m venv "$VENV_DIR" || { echo "Error: Failed to create virtual environment. Ensure python3-venv is installed. (e.g., sudo apt install python3-venv)"; exit 1; }
fi


# --- 2. Activate virtual environment ---
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate" || { echo "Error: Failed to activate virtual environment."; exit 1; }

# --- 3. Install necessary Python packages ---
echo "Installing Python packages: openai-whisper, numpy, scipy, torch (CPU), TTS (Coqui), chromadb..."
# openai-whisper (medium model)
pip install --timeout 600 openai-whisper || { echo "Error: Failed to install openai-whisper."; deactivate; exit 1; }

# numpy, scipy
pip install --timeout 600 numpy || { echo "Error: Failed to install numpy."; deactivate; exit 1; }
pip install --timeout 600 soundfile gTTS pyttsx3 || { echo "Error: Failed to install soundfile/gTTS/pyttsx3."; deactivate; exit 1; }

# torch (CPU version for broad compatibility)
# For GPU support (CUDA), uncomment the following line and comment out the CPU one:
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install --timeout 600 torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu || { echo "Error: Failed to install torch."; deactivate; exit 1; }

# Dependencies for open-source TTS (Coqui TTS for example)
# Note: Coqui TTS might have specific system dependencies or installation nuances.
# This assumes a basic pip install is sufficient.
# You might need to adjust this based on the specific TTS library chosen.
pip install --timeout 600 TTS || { echo "Error: Failed to install TTS."; deactivate; exit 1; }

# Install chromadb within the virtual environment
pip install --timeout 600 chromadb || { echo "Error: Failed to install chromadb."; deactivate; exit 1; }

# --- 4. Add a Python dependency test block ---
echo "Verifying Python dependencies..."
python3 - << 'EOF'
import numpy
import soundfile
import torch
import whisper
print("Python dependencies installed successfully!")
EOF

echo "Python packages installed. Deactivating virtual environment..."
deactivate || { echo "Error: Failed to deactivate virtual environment."; exit 1; }

echo "Python environment setup complete."
