#!/bin/bash

# setup_system_packages.sh
# This script installs and updates essential system packages, Node.js, Python, MongoDB, and ChromaDB.

echo "Starting system package setup for GNANI backend..."

# --- 1. Update and install essential system packages ---
echo "Updating package lists and installing essential tools..."
sudo apt-get update
sudo apt-get install -y build-essential git curl wget unzip ffmpeg software-properties-common python3-venv python3-dev libsndfile1 espeak-ng

# --- 2. Install Python3 and pip (if not already installed) ---
echo "Checking for Python3 and pip..."
if ! command -v python3 &> /dev/null
then
    echo "Python3 not found. Installing Python3..."
    sudo apt-get install -y python3 python3-pip
else
    echo "Python3 already installed."
fi
if ! command -v pip3 &> /dev/null
then
    echo "pip3 not found. Installing pip3..."
    sudo apt-get install -y python3-pip
else
    echo "pip3 already installed."
fi


# --- 3. Install Node.js (latest stable) and npm ---
echo "Checking for Node.js..."
if ! command -v node &> /dev/null
then
    echo "Node.js not found. Installing Node.js..."
    # Using NodeSource PPA for the latest stable Node.js
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed."
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"


# --- 4. Install Docker and Docker Compose ---
echo "Checking for Docker..."
if ! command -v docker &> /dev/null
then
    echo "Docker not found. Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Please log out and log back in for Docker group changes to take effect."
else
    echo "Docker already installed."
fi

echo "Checking for Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null
then
    echo "Docker Compose not found. Installing Docker Compose..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "Docker Compose already installed."
fi



echo "System package setup complete."