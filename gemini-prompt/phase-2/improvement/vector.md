You are acting as a senior AI systems engineer with expertise in large 
AI agent architectures, vector databases, embeddings, and production-grade 
migration of ML components with zero downtime.

Your task is to analyze the entire backend project located in the directory gnani-rnd-backend inside WSL. You must read, understand, and evaluate the complete architecture.

Your job is to analyze the whole codebase and understand the full flow of how 
vector embeddings are used across Gnani.

Current embedding layer uses "@xenova/transformers".  
We want to remove the Xenova-based embedding implementation and replace it with a
fully local, minimum-RAM HuggingFace TEI (Text Embeddings Inference) solution using a
small model like "all-MiniLM-L6-v2" or "bge-small-en".

The objective is:

**→ Analyze the full existing code flow**  
**→ Detect all areas where embeddings are created, stored, or used**  
**→ Understand how the current system integrates with memory, context, RAG, retrieval**  
**→ Keep ALL existing functionality fully intact**  
**→ Remove only the Xenova embedding implementation**  
**→ Replace the embedding layer with the TEI-based module without breaking anything**  
**→ Produce clean, production-ready code that fits perfectly into the current architecture**

Your tasks:

1. **Analyze the entire project** (all files I paste):
   - Map out the embedding pipeline from input → embedding → storage → retrieval → model context.
   - Identify where and how the Xenova transformer embedding function is used.
   - Identify all direct and indirect dependencies.
   - Identify potential breakage points during migration.
   - Identify reusable parts that should remain unchanged.
   - Explain how embeddings currently contribute to the system logic.

2. **Explain clearly what must stay, what must be deleted, and what must be replaced.**
   - Provide a complete dependency impact map.
   - Recommend structure-preserving refactoring steps.

3. **Design the new embedding architecture** using:
   - HuggingFace TEI running locally in Docker
   - A minimum-memory embedding model (<1.2GB RAM)
   - A lightweight Node.js client wrapper
   - A simple class/module that becomes a drop-in replacement for the old Xenova code
   - Same function signatures wherever possible to avoid breaking existing imports

4. **Generate the complete replacement implementation:**
   - TEI Docker run command (optimized for minimum RAM)
   - New `EmbeddingService` or `EmbeddingManager` class
   - Updated imports and integrations
   - Any required changes in memory, tools, retrieval, or utility modules
   - Ensure no business logic is broken

5. **Refactor the complete codebase**:
   - Provide updated versions of all files that need changes
   - Show only the modified or new code sections
   - Preserve all working features
   - Ensure backward compatibility with the existing flow

6. **Provide a step-by-step migration plan:**
   - What to remove (Xenova files, functions, utils)
   - What to add (TEI client, Docker config)
   - How to roll out the migration safely
   - How to test correctness and verify embedding consistency
   - How to benchmark memory usage on a low RAM machine

7. **Output format (very important):**
   - Part 1 → Project-wide embedding flow analysis  
   - Part 2 → What remains vs what is replaced  
   - Part 3 → New TEI architecture (diagrams + explanation)  
   - Part 4 → Full replacement code for the embedding layer  
   - Part 5 → Refactored modules/files across the project  
   - Part 6 → Migration procedure  
   - Part 7 → Final recommendations  


Setup instructions for WSL:
You must generate detailed steps to:

Install dependencies

Configure Python environment (if embeddings require Python)

Install embedding model locally inside WSL

Ensure backend can call the embedding model

Ensure everything works inside the existing docker-compose or local environment if used

Upgrade the project to a production-ready long-term memory architecture using a real embedding model without breaking anything in the current backend.
