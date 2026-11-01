# Matrix: instructions for Claude Code

Matrix (**M**ulti-**A**gent **T**esting, **R**easoning, **I**ntelligence & e**X**ecution) is the GenAI testing product (SundayAI "Testing Agent") for an enterprise bank. It finds functional coverage gaps, writes test cases and automation, and reports execution results. This repository holds the specification and the React frontend; the backend is built next.

Read these before writing code, in this order:
1. `docs/PRODUCT.md`: what Matrix does, the workflows and personas
2. `docs/ARCHITECTURE.md`: components, flows, the agent loop through Tachyon
3. `docs/DATA_MODEL.md`: MongoDB collections
4. `docs/SCREENS.md`: every screen; the React app in `frontend/` implements them
5. `docs/INTEGRATIONS.md`, `docs/SECURITY.md`, `docs/METRICS.md`
6. `docs/BACKLOG.md`: the build order. Follow it.
7. `docs/OPEN_QUESTIONS.md`: do not guess these; leave a clear TODO and an interface.

## Stack (recommended; confirm with the owner before scaffolding)
- Backend: Python 3.12, FastAPI, Pydantic v2, `pymongo` (with `[encryption]`), background worker for long jobs (scans, crawls, ingestion).
- Frontend: React + TypeScript + Vite. Styling from `design/tokens.css` (CSS variables, light and dark).
- Database: MongoDB Enterprise, self-managed (already decided). No object store exists; large files go on the NAS.
- LLM: Tachyon (enterprise gateway, Gemini models only) for generation and embeddings.
- Experiment tracking: MLflow (prompts and skill versions, evals, traces).
- Crawler: Playwright (Python).
- Deployment target: OpenShift (confirm).

## Non-negotiable rules
- **Deterministic first.** Use rules, parsing and database queries wherever they work; call the model only where judgment is needed. The model never chooses which skills, tools or repos it gets; Matrix resolves those deterministically and passes an explicit list.
- **Generated code only through pull requests** on `matrix/*` branches. Never push to `main`. A human merges.
- **Execution is not triggered by Matrix.** Tests run through the Harness pipeline (on HyperExecute), triggered from Git (PR opened, merge, schedule). The Runs screen is read-only monitoring.
- **Credentials never reach the model, logs or traces.** User PATs (GitHub, Jira) are encrypted at rest and read only by the credential broker for the action the user triggered. See `docs/SECURITY.md`.
- **Every data table** has keyword search, per-column filters and pagination (see `docs/SCREENS.md`, "Data tables").
- **Every Matrix-written test** carries its requirement tag (e.g. `@Tag("FR-0218")`) and a `matrix` tag. Every scan saves a snapshot. A `run_id` flows Harness → HyperExecute → Octane. Metrics depend on these three conventions.
- **Coverage metrics follow `docs/METRICS.md`, "Coverage levels and CIO roll-up":** requirements are counted per application and once each; tests belong to a workspace; CIO coverage adds counts across measured applications and never averages percentages; unscanned applications are **Not measured**, not 0%; always show numerator, denominator, as-of time and scope.
- **Every AI output is rated** before it moves to the next stage: 1 to 5 stars and a one-line comment (required below 4 stars, with Refine with AI). Ratings are stored with the output and logged to its MLflow trace. See `docs/FEEDBACK.md`.
- **Journeys (crawler) data is "observed behaviour"**: use it for how to navigate, never as expected results.
- **Cite sources**: anything Matrix writes links back to the requirement and context chunks it used.
- No em dashes in architecture diagrams.
- Sample names and numbers in the designs (Payments Hub, FR-0218, PR #212, Priya N.) are placeholders. Do not hard-code them.

## Agent discipline (Copilot, Devin, Codex, Claude and any other agent)
- Change only what the task needs. No speculative features, unrequested refactors or new abstractions without a second real use.
- No filler: no boilerplate docs, placeholder files, example code, sample data or comments that restate the code.
- No invented facts: never invent APIs, fields, columns, endpoints, versions or policy values. Leave a `TODO` with the open question instead.
- Reuse before adding: search for an existing function, component or dependency first; add a dependency only with a stated reason.
- Small, reviewable changes, one concern per pull request. Delete what you replace.
- Tests must prove behaviour, not just call mocks.
- No em dashes in anything you write.
- **Ask the owner for the CIO roll-up.** When implementing on the office machine, ask the owner for the application-to-CIO (portfolio) mapping and its source before writing `cios` data, seeds or the roll-up import. Never invent or guess CIO names, ownership or application lists.
- Report honestly what was verified, what was not and what is still open.

## Implementation reminders (raise these when the work is reached)
Owner decisions already made. When a task touches one of these, apply it and tell the owner what is still open; do not re-decide it.

- **CIO roll-up:** the owner holds the application-to-CIO (portfolio) mapping. Ask for it and its source before creating `cios` data, seeds or the import. Ask how often it changes and how updates should reach Matrix.
- **Stale scans:** an application's coverage is **Stale** when its latest completed scan is older than **15 days**. Stale still counts, with a visible flag. Applications with no completed scan are **Not measured**, never 0%.
- **Levels:** applications are IDs like `ABCD`; workspaces (also called components) are like `App-abcd-web-ui` and each is one Octane workspace. Regression is application-level and its tests and scripts belong to one workspace each; Acceptance is workspace-level. Coverage rules: `docs/METRICS.md`, "Coverage levels and CIO roll-up".
- **First sign-in:** if the user has never chosen a workspace, show **Choose your workspace** (application plus one workspace, or all workspaces; **Decide later** asks again next sign-in). Then open the Overview on that application's portfolio (CIO view); **Show all CIOs** widens it.
- **Persist the choice on the server.** The frontend stores the application and workspace choice in `localStorage` (`frontend/src/workspace/`). Replace it with a per-user preference in the backend, send the workspace with every API call, and enforce that the user may access that application and workspace.
- **Real workspace list:** the prompt and the top-right selector must list only the applications and workspaces the user is entitled to, from the backend. The current lists are sample data in `frontend/src/api/session.ts`.
- **Workspace for new tests:** when Matrix writes a test for an unassigned gap, suggest the workspace from the requirement's module or channel and let QA confirm it. Confirm with the owner how Jira stories map to a workspace (open question 17).
- **Persist workflow state in the backend.** Test-case sets and AI ratings are held in browser memory today (`frontend/src/features/testcases/`, `frontend/src/features/feedback/`) and reset on reload. Store them in `test_case_sets`, `generations` and `generation_feedback` (`docs/DATA_MODEL.md`). The server is the authority for the rating gate and set acceptance: port the frontend rules (rating per output revision, accept only at the current revision, rejected cases excluded) with unit tests, and make the frontend call the API instead of deciding.
- **Track outdated automation.** Every `automation_drafts` row records the accepted set revision and case hashes it was written from. On each set acceptance, compare deterministically and mark changed automation **Outdated** with the changed case IDs; offer to regenerate only those. No model call decides this.
- **Keep the automation repository index fresh.** A GitHub Actions workflow in each automation repository (push to the default branch, plus nightly) tells Matrix the new commit; Matrix re-indexes only the changed files and reuses embeddings whose text hash is unchanged. Track it in `repo_indexes` and show Current / Behind by N / Failed in App context. Scans and the Write step index the commit they pin before using it. See `docs/ARCHITECTURE.md`, "Automation repository index". Ask the owner about open question 19 (runner reachability, OIDC auth, read credential) before writing the workflow or its endpoint.
- **Wire screens to real data, one source per fact.** Each `frontend/src/screens/*/api.ts` and `frontend/src/features/*/api.ts` function marked `TODO(backend)` is the contract for one endpoint: keep its types, replace `mock(...)` with the call, and delete the sample data it replaces. A number shown in two places must come from the same query: the Acceptance list's stage counts must aggregate `test_case_sets` and `generation_feedback`, not a separate sample. Regression and Overview coverage must use one server-side classifier that mirrors `frontend/src/screens/Regression/coverage.ts` and `rollup()` in `frontend/src/screens/Overview/api.ts`, with the same test cases on both sides.

## Design system
- Colours: white and red. Accent `#C8102E`. Full light and dark tokens in `design/tokens.css` / `design/tokens.json`.
- Fonts: IBM Plex Sans (UI), IBM Plex Mono (IDs, code, labels).
- Red means "needs attention / gap". Green = passed or covered, amber = warning or stale.
- Theme: System / Light / Dark setting in Settings → Personal, plus a quick toggle in the top bar.
- Accessibility: real buttons, links and labelled inputs; 4.5:1 text contrast; touch targets ≥ 44px; icon-only buttons have `aria-label`.

## Repository layout to create
```
matrix/
  backend/        FastAPI app, workers, integrations, credential broker
  frontend/       React app
  skills/         local copy of the matrix-skills repo for development (see examples/)
  docs/           keep these docs; update them when decisions change
```
