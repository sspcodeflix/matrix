# Integrations

| System | Used for | Access | Notes |
|---|---|---|---|
| **GitHub (GitSaaS)** | Discovery (GraphQL), reading source/automation, branches and PRs, check status | User's fine-grained PAT | Read for source repos; read+write for automation repos. Validate scopes when the PAT is saved. |
| **Jira** | Fix versions, stories, acceptance criteria; optional comment for missing AC | User's PAT (Jira OAuth 2.0 later) | Policy toggle controls whether Matrix may comment. |
| **Confluence** | Requirements pages (space per app) | Connection in Settings | Source in App context. |
| **Octane** | Test cases, test sets, execution results | Connection in Settings; one Octane workspace per Matrix workspace (component, e.g. App-abcd-api) | Regression reads cases across all workspaces of the application; Acceptance and each written test target one workspace. Test cases are pulled automatically; upload of new cases is manual via the dedicated Matrix-generated Excel import sheet of eligible signed-off acceptance tests. Keep its template separate from general test-case downloads; verify the workspace's required columns before implementation. Downloading does not confirm import. HyperExecute uploads results. See `REPORTS.md`. |
| **Knowledge OS** | Enterprise app context | Existing enterprise service | Referenced and resynced; no AST parsing needed. |
| **DocuMind** | Verified engineering docs | Existing service | Source in App context. |
| **Tachyon** | Gemini generation and embeddings | Team license (bring your own) | Confirm function-calling pass-through and context caching. Send `run_id` and skill commits in headers for tracing and billing. |
| **GitHub Actions** | Keep the automation repository index fresh | Workflow in each automation repository; auth to Matrix is open question 19 | Runs on push to the default branch and nightly. Sends repository, branch and commit only. Matrix re-indexes incrementally. See ARCHITECTURE.md, "Automation repository index". |
| **Harness** | Pipeline `matrix-regression` | Read-only from Matrix (monitor executions, webhooks) | Triggered from Git. Agree inputs with pipeline owners: `branch`, `tests` (IDs/tags), `environment`, `run_id`, `data_reservation_id`. PR trigger on `matrix/*` branches gives reviewers a dry run. Identities come from Harness secrets. |
| **HyperExecute** | Test execution | Read-only logs/screenshots for triage | Uploads results to Octane. |
| **MLflow** | Prompt/skill versions, evals, traces | Service account | Artifact store on NAS; backend store SQL. |
| **Grafana / observability** | Telemetry | Existing platform | Emit metrics for scans, runs, tokens. |

## GitHub discovery (auto-discover mode)
1. Find repos for the app ID: repository **custom property** `app_id=<id>` (most reliable; read via REST if not in GraphQL), then **topic** `app-<id>`, then name match (always needs confirmation).
2. Classify by contents, not names:
   - automation: Selenium/Karate/TestNG dependencies, `hyperexecute.yaml`, only `src/test`
   - web UI: frontend `package.json`
   - API: OpenAPI spec or web framework
3. Pin each to the commit at discovery time.

## ZIP uploads
One component per ZIP, ≤ 500 MB (placeholder), malware and secret scanning, block path traversal, store on NAS, delete after 30 days (placeholder). Automation from ZIP → changes delivered as a patch.

## Future (not in POC)
- MCP server exposing read-only app context to approved agents (Copilot first), per app, audited.
- GitHub App instead of user PATs (short-lived tokens, bot for branches/PRs, user tokens for approvals).
- Entitlement source integration (IAM / app admin config).
