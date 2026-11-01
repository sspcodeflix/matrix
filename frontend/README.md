# Matrix frontend

React 18 + TypeScript + Vite. Screens are ported from `../design/html/` and follow `../docs/SCREENS.md`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

- `src/routes.tsx`: routes. `src/nav.ts`: sidebar.
- `src/screens/<Name>/`: one folder per screen; `api.ts` holds typed sample data behind `fetchX()` functions until the FastAPI backend exists.
- `src/components/`: AppShell, DataTable (search, column filters, pagination), Dialog, shared UI and icons.
- `src/features/download/`: the shared Download report dialog and export jobs.
- `src/styles/tokens.css`: copy of `../design/tokens.css`. Colours come only from these variables; light and dark follow `data-theme`.

Project rules for assistants and contributors: `../CLAUDE.md`, `../AGENTS.md`, `../.github/copilot-instructions.md`.
