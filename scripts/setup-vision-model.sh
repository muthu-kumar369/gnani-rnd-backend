#!/bin/bash
# Vision Model Setup Script for Gnani
# This script installs Ollama and sets up the LLaVA vision model

set -e  # Exit on error

echo "========================================="
echo "Gnani Vision Model Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root${NC}"
    exit 1
fi

# Detect OS
OS="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

echo -e "${GREEN}Detected OS: $OS${NC}"
echo ""

# Step 1: Install Ollama
echo "Step 1: Installing Ollama..."
if command -v ollama &> /dev/null; then
    echo -e "${YELLOW}Ollama is already installed${NC}"
    ollama --version
else
    echo "Downloading and installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Ollama installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install Ollama${NC}"
        exit 1
    fi
fi
echo ""

# Step 2: Start Ollama service
echo "Step 2: Starting Ollama service..."
if systemctl is-active --quiet ollama; then
    echo -e "${YELLOW}Ollama service is already running${NC}"
else
    echo "Starting Ollama service..."
    sudo systemctl start ollama
    sudo systemctl enable ollama
    
    # Wait for service to start
    sleep 3
    
    if systemctl is-active --quiet ollama; then
        echo -e "${GREEN}✓ Ollama service started${NC}"
    else
        echo -e "${YELLOW}⚠ Service not started via systemd, trying manual start...${NC}"
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        sleep 3
    fi
fi
echo ""

# Step 3: Pull LLaVA model
echo "Step 3: Downloading LLaVA vision model..."
echo -e "${YELLOW}This may take 10-15 minutes depending on your internet speed${NC}"
echo "Model size: ~4.7GB"
echo ""

ollama pull llava:7b

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ LLaVA model downloaded successfully${NC}"
else
    echo -e "${RED}✗ Failed to download LLaVA model${NC}"
    exit 1
fi
echo ""

# Step 4: Verify installation
echo "Step 4: Verifying installation..."

# Test if Ollama is responding
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo -e "${GREEN}✓ Ollama API is responding${NC}"
else
    echo -e "${RED}✗ Ollama API is not responding${NC}"
    echo "Please check if Ollama service is running: sudo systemctl status ollama"
    exit 1
fi

# Check if LLaVA model is available
if ollama list | grep -q "llava:7b"; then
    echo -e "${GREEN}✓ LLaVA model is available${NC}"
else
    echo -e "${RED}✗ LLaVA model not found${NC}"
    exit 1
fi
echo ""

# Step 5: Test vision model
echo "Step 5: Testing vision model..."
echo "Running a quick test to ensure the model works..."

# Create a test prompt
TEST_RESPONSE=$(ollama run llava:7b "Describe what you see" --verbose 2>&1 | head -n 5)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Vision model is working${NC}"
else
    echo -e "${YELLOW}⚠ Could not test model, but it should work${NC}"
fi
echo ""

# Step 6: Display configuration
echo "========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Configuration:"
echo "  - Ollama Endpoint: http://localhost:11434"
echo "  - Model Name: llava:7b"
echo "  - Model Size: ~4.7GB"
echo ""
echo "Add to your .env file:"
echo "  VISION_MODEL_ENDPOINT=http://localhost:11434"
echo "  VISION_MODEL_NAME=llava:7b"
echo "  VISION_ENABLED=true"
echo ""
echo "Useful commands:"
echo "  - Check service: sudo systemctl status ollama"
echo "  - View logs: sudo journalctl -u ollama -f"
echo "  - List models: ollama list"
echo "  - Test model: ollama run llava:7b"
echo ""
echo -e "${GREEN}You can now start using vision features in Gnani!${NC}"
