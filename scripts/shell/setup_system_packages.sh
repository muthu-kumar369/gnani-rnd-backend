#!/bin/bash

# setup_system_packages.sh
# This script installs and updates essential system packages, Node.js, Python, MongoDB, and ChromaDB.

echo "Starting system package setup for GNANI backend..."

# --- 1. Update and install essential system packages ---
echo "Updating package lists and installing essential tools..."
sudo apt-get update
sudo apt-get install -y build-essential git curl wget unzip ffmpeg software-properties-common python3.10-venv

# --- 2. Install Python3 and pip (if not already installed) ---
echo "Checking for Python3 and pip..."
if ! command -v python3 &> /dev/null
then
    echo "Python3 not found. Installing Python3..."
    sudo apt-get install -y python3.10 python3-pip
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
# Ensure pip is up to date
pip3 install --upgrade pip

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

# --- 4. Install MongoDB (latest stable) ---
echo "Checking for MongoDB..."
if ! dpkg -s mongodb-org &> /dev/null
then
    echo "MongoDB not found. Installing MongoDB..."
    # Import the public key used by the package management system
    sudo apt-get install -y gnupg
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    # Create a list file for MongoDB
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    # Reload local package database
    sudo apt-get update
    # Install MongoDB packages
    sudo apt-get install -y mongodb-org
    # Start MongoDB service
    sudo systemctl enable mongod
    sudo systemctl start mongod
    echo "MongoDB installed and started. Status:"
    sudo systemctl status mongod --no-pager
else
    echo "MongoDB already installed."
    echo "MongoDB service status:"
    sudo systemctl status mongod --no-pager
fi

# --- 5. Install Vector DB (ChromaDB - Python-based for simplicity) ---
# Note: For production, consider dedicated Vector DB installations like Weaviate/Milvus.
echo "Checking for ChromaDB (Python package)..."
if ! pip3 show chromadb &> /dev/null
then
    echo "ChromaDB not found. Installing ChromaDB..."
    pip3 install chromadb
else
    echo "ChromaDB already installed."
fi

echo "System package setup complete."