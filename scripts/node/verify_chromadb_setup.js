// scripts/node/verify_chromadb_setup.js
// This script demonstrates connecting to a ChromaDB instance and creating a collection.
// It uses the chromadb client library for Node.js.
// Make sure ChromaDB is running and accessible at VECTOR_DB_HOST:VECTOR_DB_PORT.

const { ChromaClient } = require('chromadb');
const logger = require('../../src/utils/logger');
const { VECTOR_DB_HOST, VECTOR_DB_PORT, COLLECTION_NAME } = require('../../src/configs/config');

async function verifyChromaDBSetup() {
    let client;
    try {
        // Initialize ChromaDB client
        // For a local instance, usually 'http://localhost:8000'
        const chromaDbUrl = `http://${VECTOR_DB_HOST}:${VECTOR_DB_PORT}`;
        client = new ChromaClient({ path: chromaDbUrl });
        logger.info(`Attempting to connect to ChromaDB at: ${chromaDbUrl}`);

        // Check if the client is connected (ping the server)
        const heartbeat = await client.heartbeat();
        logger.info(`ChromaDB connection successful. Heartbeat: ${heartbeat.nanoseconds} ns`);

        // Get or create a collection
        const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });
        logger.info(`ChromaDB collection '${COLLECTION_NAME}' accessed/created successfully.`);
        logger.info(`Collection ID: ${collection.id}`);

        // You can add more verification steps here, e.g., adding a dummy embedding
        // await collection.add({
        //     embeddings: [[1.1, 2.2, 3.3]],
        //     metadatas: [{ source: "test" }],
        //     documents: ["This is a test document."],
        //     ids: ["test-doc-id"],
        // });
        // logger.info("Added a dummy embedding to the collection.");

        logger.info('ChromaDB setup verification completed successfully.');

    } catch (error) {
        logger.error(`ChromaDB setup verification failed: ${error.message}`);
        logger.error('Please ensure ChromaDB is running and accessible.');
        process.exit(1);
    }
}

// Ensure the script is executable
if (require.main === module) {
    verifyChromaDBSetup();
}
