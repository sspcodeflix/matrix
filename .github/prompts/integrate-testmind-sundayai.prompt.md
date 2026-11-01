---
description: Study the Testmind and SundayAI codebases, agree a data-store and caching strategy, then integrate them into Matrix as the Regression and Acceptance workflows, with tests.
mode: agent
---

# Integrate Testmind and SundayAI into Matrix

You are working in the Matrix repository (this workspace). Two existing codebases become Matrix workflows:

- **Testmind** (at `${input:testmindPath:path to the Testmind repository}`) becomes the **Regression** workflow.
- **SundayAI** (at `${input:sundayaiPath:path to the SundayAI repository}`) becomes the **Acceptance** workflow.

Work in the phases below, in order, slowly. **Every phase ends with a stop for human approval, and in Phase 4 so does every step.** Do not start the next phase or step until a person has replied "approved". Understand the data models (Phase 1) before proposing or changing anything.

## Working in agent mode with auto-approve
Auto-approve speeds up reading and testing; it does not remove the stops.
- Keep `docs/integration/PROGRESS.md` current: phase, step, what is done, what is waiting for approval, open questions. Read it first in every new session and continue from it.
- Work on a branch per step (`integration/<nn>-<short-name>`) and open a pull request. Never commit or push to `main`.
- Allowed without asking: reading files, searching, running tests, linters and builds, and starting disposable local databases for tests.
- Ask first: adding a dependency, deleting files, changing a migration that has run, anything that touches a network service other than a local test container.
- Never: connect to real bank systems (Jira, Octane, GitHub org, Harness, Tachyon, Knowledge OS) from tests, copy production or customer data into this repository, or write a real credential anywhere.

## Before anything else

1. Read `.github/copilot-instructions.md`, `CLAUDE.md` and `AGENTS.md`, then `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `docs/FEEDBACK.md`, `docs/METRICS.md`, `docs/BACKLOG.md` and `docs/OPEN_QUESTIONS.md`. These are the specification. Where Testmind or SundayAI behave differently, the docs win unless a person decides otherwise.
2. Follow **Agent discipline** (end of this file) for everything you write.
3. Do not edit the Testmind or SundayAI repositories. Treat them as read-only sources.
4. Do not use em dashes in anything you write: docs, code, comments, commit messages. Use a colon, a comma, parentheses or a new sentence.

## Phase 1: Understand both codebases (read only)

Read the code, not only the READMEs. Every claim you write must cite a file path and line range. Where you cannot tell, write **Unknown** and add it to the questions list; do not guess.

Start with Matrix itself: the collections in `docs/DATA_MODEL.md` and the types the frontend already uses in `frontend/src/screens/*/api.ts` and `frontend/src/features/*/api.ts` (each `TODO(backend)` there is the contract for one endpoint). Then read Testmind and SundayAI.

Write these files under `docs/integration/`:

### `TESTMIND.md` and `SUNDAYAI.md`
For each codebase:
- Purpose and the user-visible workflow, step by step.
- Entry points (APIs, CLIs, jobs, schedulers), modules and how a request flows through them.
- **Every LLM call:** file and line, model, prompt template, inputs, output shape, temperature, whether output is structured, and an estimate of tokens per call and calls per run. This feeds the caching plan.
- External integrations (Jira, Confluence, Knowledge OS, Octane, GitHub, Harness, others) and how they authenticate.
- **Data stores and data models:** every table, collection, file or cache, with fields, keys, indexes, relationships, volumes if visible, and who reads and writes it.
- How secrets and user credentials are stored and used.
- Existing tests: framework, what is covered, what is not, how to run them.
- What maps to which Matrix stage, and for each part: **keep**, **adapt** or **drop**, with a reason.

### `DATA_MODEL_MAP.md`: write this before any other plan
For every Matrix collection in `docs/DATA_MODEL.md`:
- The frontend types and files that read or write it.
- Which Testmind or SundayAI table, collection or file supplies each field, field by field, with the source path and line.
- Mismatches: missing fields, different keys or IDs, different meanings of the same name (for example "component", "workspace", "status", "covered"), different scoping of applications and Octane workspaces.
- Existing data: what must be migrated, what can be rebuilt by a rescan or resync, and what is dropped. Say how history (old scans, ratings, sign-offs) is kept.
- Entities in Testmind or SundayAI with no Matrix home, and a proposal for each (add a collection, add fields, or drop with a reason).

Mark every proposed change to `docs/DATA_MODEL.md` as **Proposed**; do not edit `docs/DATA_MODEL.md` in this phase.

### `STAGE_MAPPING.md`
Two tables, one per workflow. Rows are Matrix stages; columns are the Testmind or SundayAI code that implements it, the gap to the Matrix spec, and the work needed.
- Regression (Testmind): Understand app context, Identify gaps, Write automation, Review, Monitor Harness results (read only: Matrix never triggers execution).
- Acceptance (SundayAI): Story analysis, Test cases (view, Excel download, Octane import sheet), Automation, Test tagging, UAT sign-off and export, required feedback on every AI output (`docs/FEEDBACK.md`).

**Stop here.** Summarise the data model findings in under 30 lines, list the questions, and ask a person to approve `TESTMIND.md`, `SUNDAYAI.md`, `DATA_MODEL_MAP.md` and `STAGE_MAPPING.md`.

## Phase 2: Agree the data stores, caching and plan (documents only)

Write these under `docs/integration/`, based on the approved Phase 1 documents.

### `DATA_STORES.md`: what goes in SQL and what goes in MongoDB
MongoDB Enterprise (self-managed) is already decided as Matrix's primary database. MLflow already requires a SQL backend store. Start from those facts.

1. List every entity from Testmind, SundayAI and `docs/DATA_MODEL.md` in one table with: entity, source system, access patterns (reads, writes, queries, joins), volume and growth, consistency needs, retention, owner, **proposed store**, and **reason**.
2. Default to **MongoDB**. Propose **SQL** for an entity only when one of these holds, and say which:
   - a tool that requires SQL owns it (MLflow backend store);
   - the existing system depends on relational features and migrating would cost more than it saves (estimate both);
   - it needs relational reporting or constraints that MongoDB cannot meet with schema validation, indexes and transactions.
3. One source of truth per entity. If data appears in both stores, name the owner and how the copy is kept in step. Do not add a second SQL database without a stated reason.
4. For each MongoDB collection: JSON Schema validator, indexes (including unique, partial and TTL), shard or partition key if relevant, and which fields are encrypted.
5. For each SQL table (if any): columns, types, keys, indexes and the migration tool (Alembic).
6. **Applications and workspaces.** An application (e.g. `ABCD`) has workspaces, also called components (e.g. `App-abcd-web-ui`, `App-abcd-api`); each workspace is an Octane workspace. Regression works at application level, but every test case and script it writes belongs to one workspace. Acceptance works inside one workspace. See `workspaces` in `docs/DATA_MODEL.md`. Map how Testmind and SundayAI scope applications, components and Octane today to this model. Each application belongs to one CIO; ask the owner for the application-to-CIO roll-up before creating `cios` data (do not invent it). Coverage roll-ups follow `docs/METRICS.md`, "Coverage levels and CIO roll-up".
7. **Knowledge OS chunks in MongoDB.** Store chunks and embeddings in MongoDB as a **re-synced, versioned copy**; Knowledge OS remains the source of truth and is never edited from Matrix. Design:
   - `chunks` and `embeddings` as in `docs/DATA_MODEL.md`: keyed by source, source version and content hash; tagged with app, component, trust tier and embedding model version; PII masked before storage.
   - Incremental resync: only changed source versions are re-chunked and re-embedded; removed sources are marked, not silently deleted.
   - Vector search: confirm `$vectorSearch` on the deployed self-managed cluster (needs `mongot`). If it is not available, document the fallback (in-app cosine per application) and its limits.

### `CACHING.md`: reduce token usage
Use the LLM-call inventory to estimate current tokens per run, then propose caching in this order, with the expected saving for each:
1. **Do not call the model.** Deterministic rules, parsing and queries first (`CLAUDE.md`). Skip regeneration when inputs are unchanged: compare content hashes of the story or requirement, retrieved chunk versions, skill commits and prompt template version, and reuse the existing accepted output.
2. **Prompt or context caching** for the stable prefix (policy, skills, app conventions), keyed by app and skill-set hash. Assemble prompts with stable parts first and variable parts last. Confirm that Tachyon passes Gemini context caching through (`docs/INTEGRATIONS.md`); store the cache name and expiry in MongoDB.
3. **Response cache** for structured, deterministic calls: key on model and version, prompt template version, skill commits, retrieved chunk IDs and versions, and input content hash. Store in a MongoDB collection with a TTL. Never share a cached response across applications or across users whose permissions differ.
4. **Embedding cache** keyed by `sha256(text)` plus model version, so unchanged text is never re-embedded.
5. **Retrieval cache** per query and index version, with a short TTL.
6. **Skill file cache** keyed by `skill@commit`.

For every cache, state the key, invalidation rule, TTL, size limit and what must never be cached (credentials, other users' data, outputs awaiting review). Measure tokens per stage and cache hit rate in MLflow before and after.

### `INTEGRATION_PLAN.md`
An ordered list of small steps, each one reviewable pull request. For each step: goal, files touched, tests added, risk, how to verify, how to roll back. Group the steps by workflow and stage. End with **Open questions** for a person to answer.

**Stop here.** Summarise in under 30 lines and ask a person to approve `DATA_STORES.md`, `CACHING.md` and `INTEGRATION_PLAN.md` or say what to change.

## Phase 3: Create the agreed collections and tables

Only after Phase 2 is approved, and only for the entities approved in `DATA_STORES.md`:

1. **MongoDB:** an idempotent migration script under `backend/migrations/` that creates each collection with its JSON Schema validator, indexes (unique, partial, TTL), vector index definitions and client-side field-level encryption settings from `docs/SECURITY.md`. Running it twice must change nothing.
2. **SQL** (only if approved): Alembic migrations with upgrade and downgrade.
3. **Tests:** run the migrations against a disposable MongoDB (and SQL database if used), for example with testcontainers. Assert that validators reject invalid documents, unique and TTL indexes exist, and a second run is a no-op.
4. Update `docs/DATA_MODEL.md` to match exactly what was created.

**Stop here** and ask a person to approve before integrating code.

## Phase 4: Integrate, one step at a time

Take the approved plan one step per pull request. After each pull request, stop, report what changed and how it was verified, and wait for approval before the next step. For each step:

1. Port or adapt the code into `backend/` behind clear interfaces (repository classes for data, a Tachyon client for every model call, the credential broker for every user credential). Do not copy unused code, dead branches or duplicate utilities.
2. Keep Matrix rules: deterministic first; the model never chooses its tools, skills or repos; generated code only through pull requests on `matrix/*` branches; Matrix never triggers execution; every Matrix-written test carries its requirement tag and `matrix`; every AI output gets required feedback logged to its MLflow trace (`docs/FEEDBACK.md`); cite sources.
3. Replace the frontend mock for that stage (`frontend/src/screens/<Screen>/api.ts` or `frontend/src/features/<feature>/api.ts`) with real API calls, keeping the same types, and delete the sample data it replaces. Apply the **Implementation reminders** in `.github/copilot-instructions.md` (server-side rating gate, persisted test-case sets, outdated automation, one source per fact).
4. **Tests, required for every step:**
   - Unit tests (pytest) for every new or changed function, including error paths and edge cases. No network in unit tests: mock Tachyon, Jira, GitHub, Octane and Knowledge OS with recorded fixtures.
   - Repository tests against a real disposable MongoDB.
   - Contract tests for each external integration's request and response shape.
   - Frontend: add Vitest and Testing Library when the first real API call lands; test loading, error and empty states and the feedback gate.
   - LLM quality is measured with golden datasets and evals in MLflow, not with unit tests.
   - Coverage of new backend code at least 85% lines and branches; explain any exclusion.
   - All tests, `npm run build` and `npm run lint` pass before the step is done.
5. After each workflow is integrated, run an end-to-end walkthrough: one acceptance story from Jira to the Octane import sheet, and one regression requirement from scan to Harness results. Include a failed request, a low rating with a required comment and a stopped job.

## Credentials

User credentials never reach the model, logs, traces or exports (`docs/SECURITY.md`).

- **Credentials Matrix must reuse** (GitHub and Jira PATs): these cannot be hashed, because a hash cannot be turned back into the token. Keep them **encrypted** with MongoDB client-side field-level encryption, decrypted only by the credential broker.
- **Salted fingerprint for every stored credential:** HMAC-SHA-256 of the credential, keyed with the **salt provided by the deploying team**. Read that salt from the secret store (an OpenShift Secret mounted only into the credential broker), never from code, config files or the database. Use the fingerprint to detect duplicates, rotation and reuse without decrypting.
- **Secrets Matrix only verifies** (for example Matrix-issued API keys): store only a hash. Use Argon2id with a random per-record salt, and add the team-provided salt as a pepper. Store the algorithm and parameters with the hash so they can be upgraded.
- Tests must prove that no credential appears in logs, MLflow traces, error messages or exports, and that losing the database alone does not reveal a credential.

## Agent discipline

These rules apply to Copilot, Devin, Codex, Claude and any other agent working here.

- **Change only what the task needs.** No speculative features, no "while I'm here" refactors, no new abstractions without a second real use.
- **No filler.** Do not add boilerplate docs, placeholder files, example code, sample data or comments that restate the code. Every comment explains why, not what.
- **No invented facts.** Do not invent APIs, field names, columns, endpoints, versions or policy values. If something is unknown, leave a `TODO` with the open question and stop for an answer where it matters.
- **Reuse before adding.** Search for an existing function, component or dependency first. Add a dependency only with a stated reason.
- **Small, reviewable changes.** One concern per pull request. Never push to `main`.
- **Delete what you replace.** Do not leave old and new versions side by side.
- **Tests prove behaviour**, not line counts. Do not write tests that only assert mocks were called.
- **Match the surrounding code:** naming, structure and comment density.
- **No em dashes** in anything you write.
- **Report honestly:** say what was verified, what was not and what is still open.

## Definition of done

- Phase 1 and Phase 2 documents approved, with every claim cited and every unknown listed.
- Approved collections and tables created by idempotent, tested migrations, and `docs/DATA_MODEL.md` matches them.
- Each integrated stage: tests pass, coverage target met, mocks replaced, feedback logged to MLflow, token use and cache hit rate measured.
- End-to-end walkthroughs pass for one acceptance story and one regression requirement.
- No credential appears anywhere except encrypted in MongoDB and in the broker's memory.
