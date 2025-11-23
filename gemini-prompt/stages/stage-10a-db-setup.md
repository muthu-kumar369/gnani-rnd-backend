You are my Senior GNANI Backend Engineer.

Stage 10a Goal: Setup and improve **MongoDB** and **Vector Database** for GNANI backend while preserving all previous functionality and flow. This stage focuses on environment setup, configuration, and schema improvement. Actual functionality and usage will be implemented in Stage 10b.

Requirements:

1. **Reference Previous Setup**

- Review MongoDB schemas and setup from earlier stages (Stage 2 and others)
- **Do not disturb or remove existing flow**; only improve or extend if needed
- Ensure **backward compatibility** with current backend code and Node.js/Mongoose models

2. **MongoDB Setup & Improvement**

- Install or verify MongoDB on Linux (WSL or native)
- Use Node.js and **Mongoose** for schema management
- Existing schemas (User, Session, Settings) should be checked and improved for:
  - Multi-user, multi-session support
  - Future extensibility (metadata, preferences)
  - Indexes for faster queries
- Include `.env` configuration for DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- Include **sample test scripts** to verify connection, retrieval, and insertion
- Ensure logging and error handling for setup verification

3. **Vector Database Setup**

- Install and configure an open-source vector database (Chroma, Weaviate, Milvus) on Linux
- Provide environment configuration via `.env`:
  - VECTOR_DB_HOST, VECTOR_DB_PORT, COLLECTION_NAME, API_KEY (if needed)
- Include **setup scripts** to create initial database and collection(s) for embeddings
- Functional integration (CRUD operations, embedding insert/retrieval) will be handled in Stage 10b

4. **Error Handling & Logging**

- Log all setup steps, success/failure, and timestamps
- Handle any installation or connection errors gracefully

5. **Future Integration Notes**

- MongoDB → existing users, sessions, and settings for backend
- Vector DB → long-term memory embeddings
- Stage 10b will implement the functionality to:
  - Load user settings
  - Retrieve embeddings from vector DB
  - Merge short-term + long-term memory for LLM prompts
  - Provide personalized context-aware responses
- Ensure setup is multi-user and multi-session ready

Instructions for Gemini:

- Generate Node.js **MongoDB setup code using Mongoose**, preserving existing schemas
- Generate **vector DB setup scripts** (Chroma/Weaviate/Milvus) with initial collection
- Include error handling, logging, and sample verification scripts
- Include detailed comments explaining each step
- Ensure all existing backend flow is preserved; only improvements/extensions allowed
- Functional integration of Vector DB and user settings will be implemented in Stage 10b
