# Database Connection Details

This document provides instructions for connecting to the MongoDB and ChromaDB instances used by the Gnani backend.

## MongoDB Connection (for MongoDB Compass)

The MongoDB instance is configured for local development. You can connect to it using MongoDB Compass with the following details:

**Connection String:**
`mongodb://localhost:27017/gnani_db`

**Individual Parameters:**
*   **Hostname:** `localhost`
*   **Port:** `27017`
*   **Authentication:** None (default for local development)
*   **Database Name:** `gnani_db` (or `gnani` if you're using the default in `database.config.ts`)

**Steps to Connect using MongoDB Compass:**
1.  Open MongoDB Compass.
2.  Click on "New Connection" or the "+" icon to add a new connection.
3.  Paste the "Connection String" provided above into the "URI" field.
4.  Alternatively, manually enter the "Hostname" (`localhost`) and "Port" (`27017`).
5.  Ensure "Authentication" is set to "None" or "Direct Connection".
6.  Click "Connect".

## ChromaDB Connection

ChromaDB is a vector database typically accessed programmatically, not via a GUI tool like MongoDB Compass. It runs as an HTTP server.

**Connection Details:**
*   **Host:** `localhost`
*   **Port:** `8000`
*   **Base URL:** `http://localhost:8000`
*   **Collection Name:** `gnani_collection`

**How to Verify ChromaDB is Running:**
You can check if the ChromaDB server is running by accessing its health endpoint from your terminal:

```bash
curl http://localhost:8000/api/v1/heartbeat
```

If ChromaDB is running, this command should return a JSON response, typically `{ "nanoseconds": <some_number> }`.

**How to Interact with ChromaDB:**
Interaction with ChromaDB is usually done through its Python or JavaScript client libraries within the application code. You won't typically browse its contents with a GUI. The Gnani backend application will handle interactions with ChromaDB.

If you need to manually interact or inspect ChromaDB, you would typically do so via Python scripts using the `chromadb` client library.
