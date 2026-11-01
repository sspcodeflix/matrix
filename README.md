# Matrix

Matrix (**M**ulti-**A**gent **T**esting, **R**easoning, **I**ntelligence & e**X**ecution) is the GenAI testing product for the bank: it finds functional coverage gaps, writes test cases and automation, and reports execution results. This repository holds the specification, the designs and the React frontend (mock data). The backend is built next, by integrating Testmind (Regression) and SundayAI (Acceptance).

## Start here (GitHub Copilot)
1. Open the repository in VS Code with GitHub Copilot in **agent** mode. `.github/copilot-instructions.md` is read automatically.
2. Run the prompt `.github/prompts/integrate-testmind-sundayai.prompt.md` (type `/integrate-testmind-sundayai` in Copilot Chat) and give it the local paths of the Testmind and SundayAI repositories.
3. It works in four phases and stops for your approval after each one, and after every step in Phase 4:
   1. Understand Testmind, SundayAI and the Matrix data model; map them field by field (read only, writes `docs/integration/`).
   2. Agree what goes in MongoDB and SQL, the caching plan and the step-by-step integration plan.
   3. Create the agreed collections and tables with tested migrations.
   4. Integrate one small pull request at a time, replacing frontend mocks with real APIs.
4. Progress is kept in `docs/integration/PROGRESS.md`, so a new session continues where the last one stopped.

Other assistants: `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex, Devin and others) hold the same rules.

## Run the frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build && npm run lint
```
All data is sample data from each screen's `api.ts`; names and numbers are placeholders.

## Contents
- `docs/`: the specification. Read in this order: `PRODUCT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCREENS.md`, `INTEGRATIONS.md`, `SECURITY.md`, `METRICS.md`, `FEEDBACK.md`, `REPORTS.md`, `BACKLOG.md` (build order), `OPEN_QUESTIONS.md` (do not guess these).
- `frontend/`: React, TypeScript and Vite app with every screen.
- `design/`: tokens (light and dark) and sample report exports.
- `examples/`: `.matrix/skills.yaml`, the `matrix-skills` layout and a `SecretStore` for user PATs.
