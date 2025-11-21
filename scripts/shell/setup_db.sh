#!/bin/bash

# setup_db.sh
# This script configures MongoDB and a Vector DB (Chroma), and includes
# scripts for database and collection initialization.

echo "Starting database setup..."

# --- 1. MongoDB Setup ---
echo "Verifying MongoDB service status..."
if systemctl is-active --quiet mongod; then
    echo "MongoDB service is running."
else
    echo "MongoDB service is not running. Attempting to start MongoDB..."
    sudo systemctl start mongod
    sleep 5 # Give MongoDB some time to start
    if systemctl is-active --quiet mongod; then
        echo "MongoDB service started successfully."
    else
        echo "Error: MongoDB service failed to start. Please check MongoDB installation."
        exit 1
    fi
fi

echo "MongoDB is ready. Mongoose (Node.js ORM) will handle database and collection creation/schema management."
echo "Placeholder for initializing GNANI database if needed (e.g., creating a dedicated user or specific configurations)."
# Example: Create a dedicated user for GNANI (if not using default admin)
# mongo admin --eval "db.createUser({ user: 'gnaniuser', pwd: 'gnanipassword', roles: [ { role: 'readWrite', db: 'gnani' } ] })"

# --- 2. Vector DB Setup (ChromaDB) ---
echo "Setting up ChromaDB (Python-based)..."

# Ensure Python virtual environment is activated for Chroma client
if [ -d ".venv" ]; then
    echo "Activating Python virtual environment..."
    source .venv/bin/activate
fi

# Python script to initialize ChromaDB collection
CHROMA_INIT_SCRIPT="init_chroma.py"
cat <<EOF > "$CHROMA_INIT_SCRIPT"
import chromadb
from chromadb.utils import embedding_functions

print("Initializing ChromaDB client and collection...")

try:
    # This will connect to a local ChromaDB instance running on default port
    # If ChromaDB is running as a separate server, you might use:
    # client = chromadb.HttpClient(host="localhost", port=8000)
    client = chromadb.Client() # Assumes a persistent client or in-memory
    print("ChromaDB client initialized.")

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

except Exception as e:
    print(f"Error initializing ChromaDB: {e}")
    exit(1)
EOF

echo "Running ChromaDB initialization script..."
python3 "$CHROMA_INIT_SCRIPT"
if [ $? -ne 0 ]; then
    echo "Error: ChromaDB initialization failed."
    deactivate 2>/dev/null # Deactivate if activated
    rm "$CHROMA_INIT_SCRIPT"
    exit 1
fi
rm "$CHROMA_INIT_SCRIPT" # Clean up the temporary script

# Deactivate virtual environment if it was activated
if [ -d ".venv" ]; then
    echo "Deactivating Python virtual environment..."
    deactivate
fi

echo "Database setup complete."
