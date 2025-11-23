#!/bin/bash

# setup_db.sh
# This script configures MongoDB and a Vector DB (Chroma), and includes
# scripts for database and collection initialization.

echo "Starting database setup..."

echo "Bringing up MongoDB and ChromaDB with Docker Compose..."
docker compose up -d
if [ $? -ne 0 ]; then
    echo "Error: Docker Compose failed to start databases. Please check Docker and docker-compose.yml configuration."
    exit 1
fi
echo "Databases started successfully."



# --- 2. Vector DB Setup (ChromaDB) ---
echo "Setting up ChromaDB (Python-based)..."

# Ensure Python virtual environment is activated for Chroma client
# We assume the virtual environment is already activated by setup_python.sh
# and python is available in PATH
if [ ! -d ".venv" ]; then
    echo "Warning: Python virtual environment not found. Please run setup_python.sh first."
fi

# Python script to initialize ChromaDB collection
CHROMA_INIT_SCRIPT="init_chroma.py"
cat <<EOF > "$CHROMA_INIT_SCRIPT"
import chromadb
from chromadb.utils import embedding_functions
import time

print("Initializing ChromaDB client and collection...")

# Wait for ChromaDB to be ready
# This is a simple retry mechanism; for production, consider a more robust health check
max_retries = 10
retry_delay = 5 # seconds
client = None
for i in range(max_retries):
    try:
        client = chromadb.HttpClient(host="localhost", port=8000)
        client.heartbeat() # Attempt to connect and get a heartbeat
        print("ChromaDB client initialized and connected.")
        break
    except Exception as e:
        print(f"Attempt {i+1}/{max_retries}: Could not connect to ChromaDB at localhost:8000. Retrying in {retry_delay} seconds... (Error: {e})")
        time.sleep(retry_delay)
if client is None:
    print("Error: Failed to connect to ChromaDB after multiple retries. Please ensure the Dockerized ChromaDB is running.")
    exit(1)

# You might want to use a specific embedding function
# For example, using a SentenceTransformers embedding function
# sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
# For now, let's create a collection without a specific embedding function, Chroma will use its default

collection_name = "gnani_embeddings"

# Check if collection already exists
existing_collections = client.list_collections()
if any(col.name == collection_name for col in existing_collections):
    print(f"Collection '{collection_name}' already exists. Skipping creation.")
    collection = client.get_collection(name=collection_name)
else:
    print(f"Creating collection '{collection_name}'...")
    collection = client.create_collection(name=collection_name) # , embedding_function=sentence_transformer_ef)
    print(f"Collection '{collection_name}' created.")

print(f"Successfully connected to ChromaDB and ensured collection '{collection_name}' exists.")
EOF

echo "Running ChromaDB initialization script..."
./.venv/bin/python "$CHROMA_INIT_SCRIPT"
if [ $? -ne 0 ]; then
    echo "Error: ChromaDB initialization failed."
    rm "$CHROMA_INIT_SCRIPT"
    exit 1
fi
rm "$CHROMA_INIT_SCRIPT" # Clean up the temporary script

# No need to deactivate here, as it's handled by setup_python.sh
# if [ -d ".venv" ]; then
#     echo "Deactivating Python virtual environment..."
#     deactivate
# fi

echo "Database setup complete."
