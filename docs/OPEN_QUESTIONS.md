# Open questions

Do not guess these. Build behind an interface and leave a clear TODO.

1. **Stack and hosting**: confirm Python/FastAPI + React, and OpenShift as the target.
2. **Tachyon**: does it pass through Gemini function calling (`tools`) and context caching? API shape (Gemini-native or OpenAI-compatible)?
3. **MongoDB vector search**: is `$vectorSearch` (with `mongot`) supported on the self-managed cluster? Version?
4. **MLflow backend store**: which SQL database does the existing MLflow use?
5. **GitHub**: Enterprise Cloud or Server (API URL)? Are repository custom properties (`app_id`) set, or only topics? Fine-grained PAT approval policy on the org?
6. **Jira**: Cloud or Data Center? Is writing comments with a user PAT allowed?
7. **Harness pipeline**: does it accept `tests`, `environment`, `run_id`, `data_reservation_id` inputs? Is there a PR trigger on `matrix/*` branches?
8. **Entitlements**: where is the role/entitlement matrix defined (IAM, app admin config, document)?
9. **Test data**: is there a test data team or provisioning API?
10. **Knowledge OS**: do requirements carry module/feature tags (needed for Compare scans "by module")?
11. **Acceptance**: who reviews acceptance tests, QA or UAT users? (If UAT, show plain-language tests without code.)
12. **Policies**: final values for ZIP size limit and retention, PAT max expiry, crawl environments.
13. **Approvals inside Matrix**: does the bank allow approving PRs outside the GitHub UI? If not, the Approve button opens the PR in GitHub.
14. **User stats**: HR / works-council position on per-person usage data.
15. **Base policy and Prompt studio access**: where is the Matrix base policy stored and who may change it? Who may open Prompt studio and draft library skills (anyone on the app team, skill owners, admins)? CODEOWNERS still gates the PR.
16. **Report export policy and import template**: confirm retention for disposable NAS reports/captured datasets separately from signed-off/evaluated evidence snapshots, export row/file-size limits, required classification labels, and the target Octane workspace's import columns/required fields. Keep these configurable or behind a template interface; do not invent policy values. XLSX test cases and PDF/HTML reports are required, as specified in `REPORTS.md`.
17. **Workspaces**: confirm the naming rule (`App-<app>-<part>`), that each workspace is exactly one Octane workspace, how Jira stories map to a workspace (Jira component, label or project), and which code repositories belong to which workspace.
18. **CIO ownership** (resolved in part): the owner has the application-to-CIO roll-up and provides it when implementing. Staleness is fixed at 15 days. Still to confirm: how often the roll-up changes and how updates reach Matrix.
19. **Automation repository index trigger**: can GitHub Actions runners reach Matrix on OpenShift (or do we need self-hosted runners or a GitHub webhook instead)? How does the workflow prove who it is (GitHub OIDC token verified by Matrix is preferred over a stored secret)? Which credential does Matrix use to read the repository on a pipeline trigger, given that reads otherwise use the triggering user's PAT (a read-only GitHub App installation is one option)? Should a repository that is behind block generation, or only show a warning?
