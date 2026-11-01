# Metrics definitions

## Required conventions (from the first real scan)
1. Every scan saves a snapshot (`scans.snapshot` + `requirement_status`).
2. Every Matrix-written test is tagged with its requirement ID and `matrix`.
3. `run_id` flows Harness → HyperExecute → Octane.

## Coverage levels and CIO roll-up
- **Requirements belong to the application.** Regression coverage is measured per application (e.g. ABCD): numerator and denominator are that application's in-scope functional requirements.
- **Tests belong to a workspace** (component, e.g. `App-abcd-api`). Every test case and script carries its `workspaceId`. A requirement can have tests in several workspaces; it still counts **once**.
- **Workspace views are breakdowns, not scores.** A workspace view shows the requirements with tests in that workspace plus gaps not yet assigned to a workspace, labelled as a subset. Workspace figures never add up to more than the application total.
- **Assigning a gap to a workspace:** when Matrix writes a test for an uncovered requirement, it suggests the workspace from the requirement's module or channel (UI, API, batch); QA confirms it.
- **Portfolio (CIO) view:** each application belongs to one CIO's portfolio; the owner holds the CIO roll-up mapping (see agent instruction below).
- **Each application belongs to one CIO.** CIO coverage = sum of covered requirements ÷ sum of in-scope requirements across the CIO's **measured** applications. Add counts; never average application percentages.
- **Not measured is not zero.** An application without a completed scan is **Not measured** and is excluded from the numerator and denominator. Always show "N of M applications measured", each application's scan date, and flag scans older than **15 days** as **Stale** (still counted, visibly flagged).
- **Coverage tiers, kept distinct:** **Automated and passing** (a mapped automated test passed in the scan's Harness run), **Has test cases, not automated** (Octane cases only), **No test**, and **Awaiting execution evidence** (automated, no qualifying run). Only the first counts as covered.
- **Excluded requirements** (accepted out-of-scope overrides) leave the denominator, are counted separately and are listed with their decision.
- **Matrix contribution** = covered requirements whose passing test is Matrix-written, as defined in Compare scans.
- Every overview number shows its numerator and denominator, as-of time and scope (organisation, CIO, application or workspace).

## Compare scans
- **Automated coverage** = requirements with at least one mapped test that **passed** in the scan's Harness run ÷ all functional requirements at the time of that scan.
- **Matrix-written** = test added in a merged Matrix PR and tagged with its requirement ID. Everything else is **other automation** (no attempt to attribute team tests individually).
- **Requirements newly automated by Matrix** = requirements automated in the later scan, not in the baseline, whose passing test is Matrix-written.
- **Where the change came from** (bridge): baseline % → effect of new requirements (denominator change) → other automation change → Matrix-written change → current %. Show the denominator effect separately so gains are not overstated.
- **Coverage lost** = automated in baseline, not in the later scan (stale or failing), with the reason.
- **Trend** starts at the first Matrix scan. No history before Matrix.
- **By module** only if requirements carry module tags in Knowledge OS; otherwise hide the table.
- Dropped as too hard to collect: per-requirement attribution of team tests, "mostly rewritten by team" reclassification.

## User stats
- Active users, tests written (acceptance vs regression), accepted as written (no edits before accepting), Tachyon tokens, share of team license, tokens per accepted test (count tokens from rejected attempts too).
- Tests created by workflow: totals, share, accepted-as-written rate per workflow, weekly trend.
- Usage by person: acceptance tests, regression tests, items reviewed, accepted as written, Tachyon tokens, share of license.
- Tachyon usage per day; by workflow (regression writing, acceptance writing, embeddings, journey labelling); license projection.

## Runs triage groups
- **Product defect** → raise Jira defect.
- **Test defect** → Matrix writes a fix PR (goes to Review queue).
- **Environment** → picked up by the next run (reruns happen from Git).
- **Blocked** (no test data / identity) → request data; blocked is not counted as failed.

## Downloaded reports
- PDF, HTML and spreadsheet representations of a report use the same frozen record set, source snapshots and metric definitions. Include the numerator, denominator, units, filters, as-of time and scan/run references; label selected or filtered subset totals separately from whole-application totals.
- If there is no qualifying execution evidence, report **Awaiting execution evidence**, not zero coverage or a pass. Keep case presence, review/sign-off and automated-and-passing coverage distinct. Mark in-progress runs and incomplete scans as partial, and keep blocked counts separate from failures.
- Export exact chart values and preserve the comparison denominator-change explanation. See [REPORTS.md](REPORTS.md).
- Companion formats and original-snapshot regeneration preserve the captured numerator, denominator, source versions and metric-definition version. Creating an updated report captures a new snapshot and as-of time; never present it as another format of the original report.

## Stopped and partial workflow attempts
- Save a snapshot for a stopped scan, retaining its pinned scope, completed/unprocessed requirements or components, qualifying evidence and completeness. Never interpret unprocessed items as uncovered, passed or zero, or extrapolate inspected items to whole-application coverage.
- Exclude incomplete scan snapshots from the default full-coverage trend and normal before/after coverage gains. They remain inspectable/downloadable as **Partial: processing stopped**, with clearly labelled subset counts and the missing scope. Missing qualifying execution evidence remains **Awaiting execution evidence**.
- A new continuation attempt links to the stopped attempt but has its own identity and identified input snapshot. Deduplicate reused test/output references when counting created tests; count actual recorded token usage, including pre-stop calls that finish later. Stopped is a distinct workflow outcome, not an execution failure, approval or sign-off.
- Existing Harness results remain unchanged when Matrix processing stops. Apply [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md); stopping never starts, cancels or reruns execution.
