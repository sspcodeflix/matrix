# Matrix: instructions for GitHub Copilot

Matrix (**M**ulti-**A**gent **T**esting, **R**easoning, **I**ntelligence & e**X**ecution) is the GenAI testing product (SundayAI "Testing Agent") for an enterprise bank. It finds functional coverage gaps, writes test cases and automation, and reports execution results.

The same rules are in `CLAUDE.md` and `AGENTS.md` for other assistants. Keep the three files in step when a rule changes.

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

## Where things are
- `docs/`: the specification. Read `PRODUCT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCREENS.md` and `REPORTS.md` before changing behaviour. `BACKLOG.md` is the build order. `OPEN_QUESTIONS.md` lists undecided items: do not guess them; leave a `TODO` and an interface.
- `design/html/`: static HTML references for every screen (`Dark-*` are dark variants), `design/screenshots/`: their PNGs, `design/tokens.css` / `tokens.json`: colours and fonts.
- `frontend/`: the React app (below). `backend/` (FastAPI) does not exist yet.
- `examples/`: sample skills for the `matrix-skills` repo.

## Stack
- Frontend: React 18, TypeScript, Vite, react-router-dom 6. No UI library.
- Backend (planned): Python 3.12, FastAPI, Pydantic v2, `pymongo` with `[encryption]`, background workers.
- MongoDB Enterprise, self-managed. No object store: large files (e.g. exports) go on the NAS.
- LLM: Tachyon gateway (Gemini models only). MLflow for prompts, skill versions, evals and traces. Playwright (Python) for the crawler.

## Non-negotiable product rules
- **Deterministic first.** Use rules, parsing and queries; call the model only where judgment is needed. The model never chooses its skills, tools or repos.
- **Generated code only through pull requests** on `matrix/*` branches. Never push to `main`.
- **Matrix never triggers test execution.** Harness runs tests (on HyperExecute) from Git events. The Runs screen is read-only: no run or rerun buttons.
- **Credentials never reach the model, logs, traces, exports or the UI.** Show "stored" status or secret references only, never values.
- **Every data table** has keyword search, per-column filters and pagination.
- Every Matrix-written test carries its requirement tag (e.g. `@Tag("FR-0218")`) and a `matrix` tag; every scan saves a snapshot; a `run_id` flows Harness → HyperExecute → Octane.
- **Coverage metrics follow `docs/METRICS.md`, "Coverage levels and CIO roll-up":** requirements are counted per application and once each; tests belong to a workspace; CIO coverage adds counts across measured applications and never averages percentages; unscanned applications are **Not measured**, not 0%; always show numerator, denominator, as-of time and scope.
- **Every AI output is rated** before it moves to the next stage: 1 to 5 stars and a one-line comment (required below 4 stars, with Refine with AI). Use `features/feedback/` (`FeedbackCard`, `useFeedbackGate`). Ratings are stored with the output and logged to its MLflow trace. See `docs/FEEDBACK.md`.
- **Journeys (crawler) data is "Observed behaviour"**: use it for navigation, never as expected results.
- **Cite sources**: generated output links to the requirement and context it used.
- Sample names in the designs (Payments Hub, FR-0218, PR #212, Priya N.) are placeholders. Never hard-code them in components.

## Frontend conventions (`frontend/src`)
- `routes.tsx`: all routes; screens are lazy-loaded. `nav.ts`: sidebar sections. `components/AppShell.tsx`: sidebar and top bar for every route except the landing page (`/`).
- `screens/<Name>/`: one folder per screen with `<Name>Screen.tsx` (default export), optional `<Name>.module.css`, and `api.ts`.
- **Data access:** each screen's `api.ts` exports typed interfaces and async functions (`fetchX`) that resolve sample data through `mock()` today, marked `// TODO(backend): GET /api/...`. Components read data only via `useApi(fetchX)` from `api/useApi.ts` and show `<Loading/>` / `<ErrorState/>`. Sample data lives only in `api.ts`.
- **Tables:** always use `components/DataTable.tsx` (search, column filters, chips, sort, pagination, selection, URL state). Give each table a unique `id`.
- **Dialogs:** `components/Dialog.tsx` (native `<dialog>`: focus trapped, Escape closes, focus returns to the opener).
- **Downloads:** call `useDownloadReport().open(request)` from `features/download/` behind a secondary `<DownloadButton>`. Formats and report types follow `docs/REPORTS.md`. A download never approves, imports or executes anything. Keep "Export Octane import sheet" separate from general downloads.
- **Shared UI:** `components/ui.tsx` (`Pill`, `Chip`, `PageHeader`, `StatCard`, `Card`, `DownloadButton`) and `components/Icon.tsx`. Global classes are in `styles/global.css` (`.page`, `.card`, `.btn.primary`, `.pill.tone-accent`, `.split > .main-col / .side-col`, …).
- **Theme:** `theme/ThemeContext.tsx` (System / Light / Dark, stored in localStorage, sets `data-theme` on `<html>`). There are no separate dark components.

## Design system
- **Colours come only from CSS variables in `styles/tokens.css`.** No hex values in components or CSS modules. Accent `#C8102E` is `var(--accent)` for fills and `var(--accent-text)` for text.
- Red means "needs attention / gap". Green = passed or covered. Amber = warning or stale.
- One red primary action per screen; other actions are secondary.
- Fonts: IBM Plex Sans for UI, IBM Plex Mono (`.mono`) for IDs, code and labels.
- Accessibility: real buttons, links and labelled inputs; 4.5:1 text contrast; interactive targets at least 44px; icon-only buttons have `aria-label`; keep focus outlines; announce async status with `role="status"`.
- Layout must work from 390px to 1920px with no horizontal page scroll; wide tables scroll inside their card.

## Commands
```bash
cd frontend
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

## When writing code
- Match the surrounding code: naming, comment density, file layout.
- Port new screens from `design/html/<Ref>.html`, treating the matching row in `docs/SCREENS.md` as authoritative where they differ.
- Update `docs/` when a decision changes. No em dashes in architecture diagrams.
