# Screens

Every screen below is implemented in the React app under `frontend/src/screens/`, in light and dark themes. This document is the specification: where the app and this document differ, this document wins until it is updated.

## App shell (all app screens)
- **Sidebar**: application switcher; show a separate release/sprint scope where the workflow needs it. Regression remains application-scoped. Sections:
  - **Workflows:** Acceptance, Regression, Journeys
  - **Your work:** Review queue, Runs, Huddle
  - **Knowledge OS:** App context
  - **Admin:** Skills (lock icon, admin only), Prompt studio, User stats, Settings

  Badges show counts needing attention. Footer: Tachyon license status, signed-in user (SSO).
- Navigation grouping does not grant access: apply app/role permissions. Prompt studio access remains a TODO under [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 15.
- **Top bar**: breadcrumb, global search (also accepts `/` commands), one contextual action (e.g. Refresh), theme toggle (moon/sun), notifications.
- **One primary action per screen**, in red.

## Workspace switcher (shared)
The sidebar chooses the application (e.g. ABCD); the top right chooses one of its workspaces (e.g. `App-abcd-web-ui`), also called components, or **All workspaces**. Each workspace is its Octane workspace. Regression covers the whole application; choosing a workspace shows a labelled subset (requirements with tests in that workspace plus unassigned gaps), and its tables show a Workspaces column. Acceptance needs one workspace: with **All workspaces** selected it asks the user to choose, and opening a story selects that story's workspace. The Octane connection in Settings follows the choice. The choice is remembered per application.

## Data tables (every table)
- Toolbar: keyword search, Filters button with active-count badge, removable filter chips, Clear all.
- Header row with keyboard-operable sort controls and announced direction; **filter row** under the header: text inputs for free-text columns, dropdowns for fixed-value columns, ranges for meaningful numeric/date columns. Name action columns; non-data action columns need no filter.
- Footer: "Showing 1–N of M", rows per page, page buttons with previous/next.
- Wide tables scroll horizontally in their card. Filters belong in the URL so a filtered view can be shared (e.g. into Huddle). Filter server-side for large data.
- Define how keyword, tab and column filters combine and whether selection spans pages. Counts, eligible actions and pagination must agree with the filtered records; reset invalid page positions after a filter change.

## Stop processing (Acceptance and Regression)

- Show **Stop processing** beside the selected queued/running Matrix job's progress, with its job/attempt ID, scope, stage, completed count and remaining work. A screen waiting for human review has no active processing to stop. If multiple jobs are active, identify the one being stopped explicitly.
- Explain inline: **Stops this Matrix task. Completed results and existing PRs remain. Harness runs continue.** On acknowledgement, disable repeat submission and announce **Stop requested → Stopping → Stopped**. Do not report success merely because the request was sent; preserve the confirmed state on network failure.
- Keep retained drafts, existing PR links and partial-result counts visible. While stopping, identify any in-flight operation still settling. Stop does not undo decisions or cancel Git-triggered execution. Incomplete/unprocessed scope must not look fully assessed or covered.
- Offer **Continue from checkpoint** only for supported retained checkpoints, otherwise **Start a new attempt**. Both create an explicit new linked attempt after source/permission checks; never auto-resume. See [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md) for fencing, race handling and authorization.
- `frontend/src/screens/WorkflowProcessing/` demonstrates Acceptance and Regression processing, stopping and retained results using sample data, with the same controls and states in light and dark themes.

## Feedback on AI output (shared)
Every AI output (story analysis, test cases, automation, tags, Regression automation in Review) carries a rating card: 5 stars, a one-line comment required below 4 stars, and **Refine with AI** that suggests clearer wording the user may accept or ignore. The output's move-on action is disabled until it is rated, with the reason and a link to the card beside it. See [FEEDBACK.md](FEEDBACK.md). The shared React component is `frontend/src/features/feedback/`.

## Reports and downloads (shared)
The report catalogue, supported formats and content requirements are defined in [REPORTS.md](REPORTS.md). Downloads cover source health, decisions, coverage and gaps, test cases and review records, runs and scan comparisons, acceptance sign-offs, journeys, test readiness, skill/prompt evaluations and usage.

- **Download report** is a secondary action on the relevant screen; it does not compete with the screen's primary workflow action. Offer only formats supported by that report: reusable test cases as **Excel (.xlsx)**, coverage and other narrative reports as **PDF / HTML**, and tabular companions where the catalogue specifies them. Use report-specific labels, such as **Download test cases**.
- The options panel explicitly distinguishes **Selected rows**, **All matching filters (across all pages)** and **Full permitted scope**. Default to selected records when present, otherwise all matching filters; disable Selected rows when nothing is selected. Show application and relevant release/scan/run/evaluation or date range, report type, filters and authorized counts with their units. Selected stories or requirements may map to multiple test cases; preview both counts. Never silently limit an export to the visible page or include another app.
- Before generation, show the pinned scan/run, source or test version, comparison baseline where applicable, and **Data as of** time with time zone. Refresh the preview if its inputs change before generation, then freeze one source snapshot for the job. Preview eligible and excluded records with reasons, using only information the user may access. Explain whether drafts, unresolved items or missing evidence are included. Label whole-application coverage separately from selected/filtered subset totals. If no records qualify, show why and a useful way to revise the scope.
- Changing report type updates the supported formats, record counts, sections and **Generate [format]** label. Test-case workbooks offer XLSX; usage also supports CSV. Preserve compatible scope choices and explain any scope change. Report types and defaults come from the invoking screen, as listed below.
- **Octane import sheet** is a separate Acceptance action with its own signed-off revision and eligibility preview. The sheet targets the selected workspace (its Octane workspace) and names it in the preview. A general test-case workbook is not an Octane import file. Rendering completion means **Ready to download**; only after successful file delivery state **Sheet downloaded. Manual import into Octane remains.** A report download never implies approval, sign-off, import or execution.
- Generating a report creates a job with **Queued / Generating / Ready / Failed / Cancelled / Expired** states. Show real progress or a labelled indeterminate state, allow cancellation while supported, and let users leave and return through **Recent downloads** in the report menu. Announce status changes accessibly without taking focus; do not make a temporary toast the only route to the result.
- Recent downloads shows report name, scope, format, requester, data-as-of and generation times, status, expiry and the applicable **Download / Cancel / Retry / Regenerate** action. Distinguish the time the evidence was captured from the time the file was created. An expired file can be regenerated from an available snapshot; if that snapshot is unavailable, explain that a new report requires a new data snapshot.
- Design explicit states for no data, no eligible rows, permission denied or access changed, unavailable snapshot, report too large, generation/storage failure and expired download. State the applicable limit and offer narrower filters or another supported format; never silently truncate a report. Recheck access before downloading, and offer retry without discarding the chosen scope when it is still valid.
- Display retention and expiry from configuration. The reference's seven-day retention is illustrative, not an agreed policy; label placeholder values visibly until [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 16, is resolved.
- Immediately acknowledge Generate and prevent duplicate equivalent jobs. Offer the existing pending/ready job when scope, snapshot, format, template and permissions match; never reuse by title alone.
- On ready reports expose **Another format, same snapshot**. On expired reports distinguish **Regenerate original report** from **Create updated report**, with fresh scope/as-of preview for the latter. Show identifiable filenames and snapshot IDs in history. Detailed contracts are in [REPORTS.md](REPORTS.md).
- The interactive DownloadReport reference demonstrates these transitions locally. Its sample-file links open [illustrative output files](../design/report-samples/index.html), which use a separate labelled sample application; they are not live exports of the dialog's mock data. Production persistence, permissions and file generation remain to be implemented.

### Entry points and report presets

Each entry opens the shared dialog over its invoking screen and preserves that screen's filters/selection. The Regression backdrop in `DownloadReport` is one example, not a required navigation destination. [REPORTS.md](REPORTS.md) remains the source for full content and format requirements.

| Screen | Action and available reports |
|---|---|
| Overview | **Download report** for the whole page, plus a **Download** button on each section (coverage breakdown, trend, applications table) that opens the same dialog on that section's report. Selected applications in the table give a Selected scope. |
| Regression (`Workspace`) | **Download report**: coverage/gaps (PDF, HTML, XLSX); test-case XLSX from linked test-case views, with requirement-to-test counts made explicit. |
| Acceptance | **Download report**: test-case XLSX, criterion coverage and sign-off records (PDF, HTML, XLSX). Keep **Export Octane import sheet** separate. |
| Review | **Download review record**: PDF, HTML, XLSX; also expose **Download test cases** (XLSX) in Tests and run results (PDF, HTML, XLSX) in Dry run. |
| Compare / Runs | **Download report**: scan comparison / execution and failure results (PDF, HTML, XLSX), with the selected baseline or run pinned. |
| App context / Huddle | **Download report**: context health / decision records (PDF, HTML, XLSX). |
| Journeys | **Download report**: observed journey findings (PDF, HTML, XLSX). |
| Test identities / Test data | **Download report**: role/environment or data readiness (PDF, HTML, XLSX), excluding credentials and raw reserved records. |
| Skills / Prompt studio | **Download report**: skill or prompt evaluation (PDF, HTML, XLSX), preserving exact evaluated versions and sample/full-evaluation labels. |
| User stats | **Download report**: usage/adoption (XLSX, CSV, PDF, HTML), with permitted personal detail or aggregates. |

### Dialog layout and interaction

- Use a labelled modal dialog with initial focus inside it, a contained tab order, an inert background, Escape/Close dismissal and focus returned to the invoking control. Closing preserves an existing export job; **Cancel export** acts on a particular queued/generating job. Prefer **Close** for the dialog footer to distinguish these actions.
- Keep Close and the primary Generate action reachable at short viewport heights and increased zoom. Constrain the dialog to the viewport, scroll its body and retain a visible footer; on narrow screens stack or separately expose Recent downloads without burying Generate below the history.
- All interactive targets, including Recent downloads actions, are at least 44px with visible focus. Announce changed eligibility, errors and job status accessibly without moving focus unexpectedly.
- Keep a theme switch inside the download dialog header so it remains reachable while the background is inert. Both dialog variants share the same interaction assets and use semantic theme tokens for statuses, focus and buttons.
- The `DownloadReport` reference is limited to the viewport with a scrolling body and a fixed footer (Generate and Close stay visible at 1440×900, 1280×600 and 390×700), and its Recent downloads actions are 44px. Keyboard reachability and zoom still need verifying in the implemented dialog.

## Screen list
| File | Screen | Purpose |
|---|---|---|
| `Overview` (React only) | Overview | First screen after sign-in. If the user has never chosen a workspace, a **Choose your workspace** prompt (application and workspace, or all workspaces; **Decide later** asks again next time) opens first. The page then defaults to the portfolio (CIO) of the chosen application; **Show all CIOs** widens it. Portfolio filter; cards for functional coverage (numerator and denominator), applications measured (with stale and not measured), open gaps by tier, Matrix contribution and work waiting for review; coverage by CIO (or by application for one CIO) as 100% stacked bars by tier; monthly coverage trend with the Matrix-written share; applications table. Follows `METRICS.md`, "Coverage levels and CIO roll-up". |
| `Main` | Landing page | Hero "Finds the gaps. Writes the tests. Tracks every run.", acronym, problem, how it works (two workflows + hand-off, shared Huddle), integrations, personas, governance, CTA. |
| `Context` | App context | Sources table, needs-attention cards (conflicts, failed spec, stale doc), add source tiles, test retrieval, components. |
| `Acceptance` | Acceptance workflow | Jira fix version/sprint scope, KPIs, release-level stage counts (Story analysis, Test cases, Automation, Tagging, UAT sign-off), stories table, blocked-on-story card, UAT sign-off and regression hand-off. Each story opens a story workspace (`/acceptance/stories/:id` in the React app) with one panel per stage: AI output, citations, required rating card and the gated move-on action. Show signed-off story/test revisions and changed-after-sign-off state; keep general downloads and the eligible Octane import sheet distinct. |
| `Workspace` | Regression workflow | KPIs, 4-step pipeline, functional gaps table, sources, Huddle card, last run. Buttons: Compare scans, New scan, Write automation. |
| `NewScan` | New scan: auto-discover | Mode choice (Auto-discover recommended / Add yourself), discovery summary, Add a missing component, components table with confirm/correct/remove. Separate **Review scan** from **Start scan**; show blockers beside the action. The reference still combines the labels. |
| `NewScanGit` | New scan: manual, Git batch | Add components form (What? Where? Details), several URLs one per line, explicit role confirmation/correction, cleared input and receipt after adding. Preserve inputs through review and readiness failures. |
| `NewScanZip` | New scan: manual, ZIP batch | Multi-ZIP drop, **Files awaiting addition**, per-file ready/scanning state and Remove/Cancel scan actions, add only ready files, recalculate readiness. Explain patch delivery for automation ZIPs and the automation-component guard. |
| `Compare` | Compare scans | App ID + baseline + compare pickers, 4 KPIs, coverage trend (other vs Matrix), bridge, by-module table, coverage lost, counting rules. |
| `Review` | Review queue | Tabs Mine/Team/Waiting; requirement/evidence detail; Tests / Code changes / Dry run; per-test Accept / Reject (reason required) / Edit. Distinguish test acceptance from PR approval and merge; show repository, revision and acting identity. Post approval as the user only if policy allows; otherwise open GitHub (open question 13). New commits or changed evidence make earlier approvals stale. Include the download entry points above. |
| `Runs` | Runs | Read-only: runs table with Harness execution IDs and Git triggers; failure triage groups (product defect, test defect, environment, blocked). |
| `Huddle` | Huddle | Decisions list (pending/accepted/rejected), thread with proposer, reason, impact, comments, Accept/Reject; activity; people. |
| `Explore` | Journeys | Crawl scope/time/environment/roles, **Observed behaviour** label, journeys table and findings. Undocumented journeys go to Huddle; unconfirmed requirements show why. Cite the authoritative rule before proposing an expected outcome for an access finding. |
| `Skills` | Skills (admin) | Library table with eval pass rate vs 90% gate; detail with proposed version from rejections, v3 vs v4 evals, Promote. |
| `PromptStudio` | Prompt studio | Layered instructions (policy locked, then framework, app and session) for the resolved scope; draft edits; sandbox baseline/draft sample and full-dataset evaluations with checks and output diff. Show evaluated draft/hash, baseline commit and dataset version; mark old results stale after edits. Distinguish sample success, PR readiness and the promotion gate. Drafts table, evaluation downloads and Open PR on matrix-skills; promotion stays in Skills. |
| `DownloadReport` | Download report (interactive preview) | Shared dialog over the invoking screen; Regression is the supplied example. Format/scope preview, Generate and Recent downloads with local queued/generating/ready/cancelled transitions, duplicate suppression, original versus updated regeneration, filename previews and companion formats from a saved snapshot. Existing failed/expired examples remain; production permissions, persistence and remaining error variants are still required. |
| `WorkflowProcessing` | Stop processing (interactive preview) | Local Acceptance/Regression examples with Stop processing, Stop requested/Stopping/Stopped, completed and unprocessed work, retained-result detail and checkpoint continuation as a new linked attempt. Explicit sample-data and external-Harness boundary labels. |
| `Stats` | User stats | KPIs incl. tokens per accepted test; tests created acceptance vs regression; Tachyon per day; team license; by workflow; usage by person. |
| `Settings` | Settings · Connections | Tabs; connections GitHub, Confluence, Octane, Jira; access by role; policies (PR-only locked on, dry-run PRs, Jira comments, MCP sharing off); Tachyon usage. |
| `TestIdentities` | Settings · Test identities | Identities per role/env with secret reference and sign-in status; entitlement matrix source placeholder; credential handling. |
| `TestData` | Settings · Test data | Catalogue of data needs, availability, reservations, blocking tests, `@role` / `@data` example. |

## States to implement beyond the mock-ups
- Empty/no-results states, including new apps and no scans ("Trend appears after 3 scans"); permission/role variants.
- Scan configuration review and start; durable queued/running/partial/failed ingestion, scan and crawl jobs with leave/return, preserved inputs, completeness and supported recovery.
- Per-test assertion evidence, rejection reasons, explicit PR-approval effect and changed-after-review states; plain-language UAT sign-off and changed-after-sign-off detail.
- Report-type/format variants, queued/cancelled jobs, no eligible records, Octane inclusion/exclusion preview, changed-source preview, access/limit/storage errors, expiry and successful file-delivery receipt. Include short-height, narrow and zoomed dialog layouts.
- PAT can't read repo → Update PAT; secrets-store unavailable; Tachyon quota exceeded. Settings → Personal: PAT entry/replacement/removal with last four characters and expiry, System/Light/Dark theme, notifications.
