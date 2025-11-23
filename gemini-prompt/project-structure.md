You are my Senior GNANI Backend Architect and Refactor Bot.

Context:

- The current directory contains a live, running Node.js backend project.
- Do **not** break runtime behavior or remove any working implementation.
- There are a few local folders that must be left untouched unless asked explicitly:
  - .venc
  - gemini-prompts
  - scripts
  - node_modules
  - .git
  - any hidden CI/CD folders (e.g., .github)
  - any other top-level folder you detect and recognise as tool-specific — treat them as protected by default.

Goal:
Upgrade and reorganize the existing project to the **ENTERPRISE-GRADE NODE.JS PROJECT STRUCTURE (2025 STANDARD)** while preserving behavior, tests, and runtime. Provide a safe, reversible migration plan and the exact changes needed to apply it.

Target directory tree to implement (create any missing folders/files, map existing code into the correct places):

/backend
package.json
pnpm-lock.yaml | package-lock.json
tsconfig.json
.env
.env.example
README.md
/src
app.ts
server.ts
grpc.ts
websocket.ts
/config
index.ts
database.config.ts
redis.config.ts
grpc.config.ts
env.config.ts
/constants
roles.ts
messages.ts
events.ts
errors.ts
/core
/http
HttpException.ts
error.middleware.ts
/logger
logger.ts
winston.config.ts
/security
auth.middleware.ts
jwt.utils.ts
/utils
crypto.util.ts
date.util.ts
string.util.ts
/database
index.ts
prisma/
migrations/
models/
/modules
/<feature> (repeat per domain)
<feature>.controller.ts
<feature>.service.ts
<feature>.repository.ts
<feature>.schema.ts
<feature>.entity.ts
<feature>.routes.ts
<feature>.grpc.ts
<feature>.socket.ts
**tests**/
/jobs
email.job.ts
audio-processing.job.ts
/queues
index.ts
job.queue.ts
audio.queue.ts
/middleware
cors.middleware.ts
rate-limit.middleware.ts
validation.middleware.ts
admin.middleware.ts
/routes
index.ts
health.routes.ts
/proto
user.proto
assistant.proto
audio.proto
/websocket
index.ts
assistant.socket.ts
user.socket.ts
/tests
integration/
unit/
/scripts
start-dev.sh
migrate.sh
build.sh
deploy.sh

Rules & behavior (must follow exactly unless you flag an ambiguity):

1. **Read everything first**: Recursively read every file and folder (including hidden files) to build a comprehensive map of current sources, routes, exports, and tests.

2. **Never delete or modify logic without explicit confirmation**: You may create copies, move files, refactor imports, and scaffold new files — but you must **ask for explicit confirmation** (showing the exact diff/commands) before any destructive operation (delete / overwrite / permanent rename).

3. **Backups & safe mode**:

   - By default produce a `dry-run` migration plan: list of moves/renames/creations and the exact patch (unified diff) that would be applied.
   - Suggest `git` commands (e.g., `git mv`, `git add -A`, `git commit -m "chore: restructure to enterprise layout"`) and a single `git stash`/branch workflow to preserve work.
   - If the repo has no git history, create file-by-file copies under `/backup/restructure-timestamp/` before any write.

4. **Mapping rules**:

   - Try to map existing files into the `modules/<feature>/` pattern by analyzing file names, exported classes, JSDoc, comments, route strings, and `app.use()` / `router.use()` usages.
   - If a single file contains multiple responsibilities (e.g., controller + service), split it into separate files **only** if you can do so without changing behavior; otherwise keep as-is and add a TODO note.
   - For ambiguous names, prefer non-breaking mapping: create adapters or index re-exports so old import paths continue to work until user opts to swap them.

5. **Rename conventions**:

   - Apply `kebab-case` for file names and folder names (e.g., `user.controller.ts`).
   - Keep top-level special folders (protected list above) unchanged.
   - Update import paths automatically where files move; create barrel files `index.ts` where it simplifies cross-imports.

6. **Small automatic corrections (allowed)**:

   - Replace **hard-coded secrets** with `process.env` references and add to `.env.example` (do not add secret values).
   - Replace synchronous blocking calls in hot-paths (like `fs.readFileSync` used per-request) with async equivalents and annotate changes in the diff. If risky, flag and propose both options.
   - Detect obvious circular dependencies and either: (a) create a small adapter file to break the cycle, or (b) report clearly with file references and suggested minimal fix — do not attempt complex behavioral refactors without confirmation.
   - Add missing DTO (schema) files for request validation if routes lack validation — scaffold `*.schema.ts` with `zod` or `joi` example and mark as scaffolded.
   - Add logging wrapper (`core/logger/logger.ts`) if no logger present; do not replace existing logging calls — create adapter functions that reuse the existing logger if present.

7. **TypeScript & linting**:

   - If the project is TypeScript, attempt to standardize `tsconfig.json` (preserve existing `compilerOptions` where present). Suggest additions (e.g., `paths`, `rootDir`, `outDir`) but do not overwrite without confirmation.
   - If JavaScript, propose a TypeScript migration checklist (not automatic).
   - Recommend ESLint + Prettier setup and create `.eslintrc` / `.prettierrc` scaffolds if missing (do not run installs).

8. **gRPC / Proto handling**:

   - Move `.proto` files into `/src/proto`. Ensure that any generated stubs or import paths are updated.
   - If server uses `@grpc/grpc-js` or similar, verify bootstrap file(s) exist (`grpc.ts`) and confirm ports/addresses come from config.

9. **Tests & CI**:

   - Detect test frameworks (jest/mocha). Do not change tests. If moving files breaks tests, update test imports in the dry-run plan.
   - Propose a CI job snippet to run unit and integration tests in the new structure (example YAML).

10. **Outputs required from you (the assistant)**:
    A. A **dry-run report** containing:

    - Full file inventory of repo (paths + size + first export/signature).
    - Proposed new directory tree (what moves/renames to perform).
    - For each change: original path → new path, reason, and patch (unified diff).
    - List of new scaffolded files and their contents.
    - Any detected issues (circular deps, hard-coded secrets, missing environment variables, missing schema/validation) with clear remediation options.
    - Exact `git` commands / shell commands to apply the changes safely (or a single `git apply` patch).
      B. A short, prioritized migration checklist (what to run first: tests, linter, start dev server, run smoke tests).
      C. A final "apply plan" that waits for my explicit confirmation before performing writes.

11. **When generating diffs / patches**:

    - Use unified diff format and ensure moves are done via `git mv` where possible.
    - Include updated import path examples for the top 20 most-touching files.

12. **Reporting style**:

    - Be concise, practical, and show examples.
    - For every automatic code edit, include a one-line explanation of why it was safe.

13. **Execution flow**:

    1. Scan and analyze whole repo and produce dry-run report (A + B above). Output only — **no changes yet**.
    2. Wait for my confirmation. After I confirm, re-run to produce the exact `git` and filesystem commands to execute the migration; then apply them if I reply "APPLY MIGRATION".
    3. After applying, run or suggest commands to run tests and dev server, and produce a summary of runtime smoke-test results (errors/warnings if available).

14. **Edge cases**:

    - If the repo includes a monorepo (multiple packages), detect and handle it: apply structure to the backend package only (ask if there is ambiguity).
    - If package uses non-standard file extensions (.mjs, .cjs), preserve them.

15. **Do not**:
    - publish any secrets or tokens to new files, `.env.example` must remain secret-free.
    - remove or delete files without confirmation.

Finish the dry-run analysis and produce the full report (inventory + proposed tree + diffs + commands). Start in **dry-run** mode only. Conclude your dry-run output with the single line:

**Enterprise dry-run ready — review the proposed changes and reply with `APPLY MIGRATION` to apply, or `CANCEL` to abort.**
