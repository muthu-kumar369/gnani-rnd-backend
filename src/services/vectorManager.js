// src/services/vectorManager.js
const { ChromaClient } = require('chromadb');
const logger = require('../utils/logger');
const { VECTOR_DB_HOST, VECTOR_DB_PORT, COLLECTION_NAME, API_KEY } = require('../configs/config');

// Placeholder for an embedding function. In a real scenario, this would use an actual embedding model.
// For this stage, we'll return a dummy embedding.
async function getDummyEmbedding(text) {
    logger.debug(`Generating dummy embedding for text: "${text}"`);
    // A simple hash or fixed vector for testing
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(1536).fill(hash % 1000 / 1000); // Return a fixed-size array for simulation
}


class VectorManager {
    constructor() {
        this.client = null;
        this.collection = null;
        this.initializeChromaDB();
        logger.info('VectorManager initialized.');
    }

    async initializeChromaDB() {
        try {
            const chromaDbUrl = `http://${VECTOR_DB_HOST}:${VECTOR_DB_PORT}`;
            this.client = new ChromaClient({ path: chromaDbUrl });
            
            // Basic check for connection
            await this.client.heartbeat();
            logger.info(`ChromaDB client connected to ${chromaDbUrl}`);

            this.collection = await this.client.getOrCreateCollection({ name: COLLECTION_NAME });
            logger.info(`ChromaDB collection '${COLLECTION_NAME}' ready.`);
        } catch (error) {
            logger.error(`Failed to connect or initialize ChromaDB: ${error.message}`);
            this.client = null; // Mark as not connected
            this.collection = null;
            // Optionally, implement retry logic here
        }
    }

    /**
     * Retrieves top-K relevant embeddings based on a query for a user.
     * @param {string} userId - The ID of the user.
     * @param {string} query - The current user query.
     * @param {number} topK - The number of top relevant results to retrieve.
     * @returns {Promise<Array<string>>} An array of relevant document strings.
     */
    async getRelevantEmbeddings(userId, query, topK = 3) {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot retrieve embeddings. Returning empty array.');
            return [];
        }

        try {
            // Generate embedding for the query
            const queryEmbedding = await getDummyEmbedding(query); // Replace with actual embedding model

            // Query ChromaDB for relevant documents
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: topK,
                where: { userId: userId }, // Filter by user to get personalized results
                // include: ['documents', 'metadatas', 'distances']
            });

            if (results.documents && results.documents.length > 0) {
                logger.debug(`Retrieved ${results.documents[0].length} relevant embeddings for query "${query}"`);
                return results.documents[0]; // documents is an array of arrays, so take the first inner array
            }
            logger.debug(`No relevant embeddings found for query "${query}"`);
            return [];
        } catch (error) {
            logger.error(`Error retrieving embeddings from ChromaDB for user ${userId}, query "${query}": ${error.message}`);
            return [];
        }
    }

    /**
     * Adds an embedding to the vector database.
     * @param {string} userId - The ID of the user.
     * @param {string} documentId - Unique ID for the document/chunk.
     * @param {string} documentContent - The text content to embed.
     * @param {Object} metadata - Additional metadata for the embedding.
     */
    async addEmbedding(userId, documentId, documentContent, metadata = {}) {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot add embedding.');
            return;
        }

        try {
            const embedding = await getDummyEmbedding(documentContent);
            await this.collection.add({
                embeddings: [embedding],
                metadatas: [{ userId: userId, ...metadata }],
                documents: [documentContent],
                ids: [documentId]
            });
            logger.debug(`Embedding added for user ${userId}, documentId ${documentId}`);
        } catch (error) {
            logger.error(`Error adding embedding to ChromaDB for user ${userId}, documentId ${documentId}: ${error.message}`);
        }
    }
}

module.exports = new VectorManager();
