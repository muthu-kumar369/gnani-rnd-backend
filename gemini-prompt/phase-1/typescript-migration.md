You are my Senior GNANI Backend Architect.

Load and analyze the entire current project from this directory (recursively read all files and folders).

Goal:
Migrate the existing working JavaScript Node.js project to **TypeScript with full ESM support**, without breaking any existing behavior, API routes, gRPC flow, WebSocket flow, or runtime logic.

Important Constraints:

- DO NOT remove or rewrite any existing logic unless it is 100% safe.
- All existing code paths must continue working exactly as before.
- Only ADD typings, TS configs, adapters, compatibility shims, and safe refactors.
- Output everything in a DRY-RUN format first. Do NOT modify the filesystem until I explicitly confirm.

Protected folders (do not modify unless a file inside is JS source code):

- .venc
- gemini-prompts
- scripts
- node_modules
- .git
- .github
- any tooling folders you detect

=======================================
TARGET MIGRATION PLAN (TO IMPLEMENT)
=======================================

1. Convert project to TypeScript with ESM:

   - Add `tsconfig.json` with correct ESM settings:
     "module": "ESNext"
     "moduleResolution": "bundler"
     "target": "ES2022"
     "allowImportingTsExtensions": true
     "rootDir": "src"
     "outDir": "dist"
     "types": ["node"]
   - Add `"type": "module"` in package.json if not already present.
   - Introduce build scripts:
     "build": "tsc"
     "dev": "tsx src/app.ts"
   - Preserve the current dev workflow.

2. Identify ALL .js source files and convert them safely:

   - Rename only source files to `.ts`
   - For files using JSX/React (if any) rename to `.tsx`
   - Any ambiguous files (config, migrations, scripts) remain `.js` unless safe to convert.

3. Convert CommonJS → ESM safely:

   - Replace `require()` with `import` only when safe.
   - Replace `module.exports` with `export` ONLY if you confirm it won't break runtime.
   - Provide compatibility wrappers for modules still needing CJS format.
   - If the project has mixed CJS/ESM, create compatibility shims automatically.

4. Add Types:

   - Add TypeScript types incrementally, starting with:
     - Request/response types for controllers
     - Service method signatures
     - Model types (Prisma / Mongoose / raw SQL)
     - DTOs / Schemas / Validation types
   - Avoid risky or breaking type changes.
   - Use `any` temporarily when type inference is unclear — annotate and mark TODOs.

5. Update Imports:

   - Convert relative imports to ESM style with explicit extensions:
     import x from "./file.js" → "./file.ts"
   - Replace incorrect path extensions automatically.
   - Suggest optional tsconfig `"paths"` aliasing to shorten imports.

6. Preserve Runtime Behavior:

   - No function signature changes
   - No renaming of exported functions/classes/objects
   - No rewriting core logic
   - If a file contains side-effect imports, preserve them exactly

7. Add Missing Type Packs:

   - @types/node
   - @types/express
   - @types/ws
   - @types/cors
   - and any others based on detected dependencies
   - DO NOT install packages; only suggest list

8. Generate a full DRY-RUN REPORT including:

   - List of all JS files → TS files mapping
   - List of safe import rewrites
   - All required new files (tsconfig.json, env.d.ts, etc.)
   - All proposed diffs (unified diff format)
   - A dependency list (which @types packages required)
   - Any warnings: cyclic imports, ambiguous exports, dynamic requires

9. Final Output Requirements:
   A. Proposed new directory + file mapping  
   B. Complete patches (unified diff) for each converted file  
   C. Required config files with full content  
   D. List of new scaffolds (e.g., global types, utility types)  
   E. Migration commands (git mv, rename, apply diff)  
   F. Post-migration verification checklist (scripts to run, tests, lints)

10. DO NOT APPLY CHANGES until I explicitly respond:  
     APPLY TS MIGRATION

=====================================================
Start by reading the complete project and produce:

- Inventory of all JS files
- Recommended TS conversion plan
- tsconfig.json proposal
- package.json script updates
- Inline diffs (dry-run only)
- # Safety notes

End your output with:

**TS MIGRATION DRY-RUN READY**
