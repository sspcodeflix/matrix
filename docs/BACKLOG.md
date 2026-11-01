# Build order (POC)

Build in this order. Each milestone ends with something demoable. Items marked UX come from `UI_UX_REVIEW.md`; build them in the same milestone as the feature.

## M0: Foundations
- Repo scaffold (backend, frontend, docs), CI, lint, tests.
- SSO sign-in stub (real SSO behind an interface), roles per app.
- MongoDB connection, collections and indexes from `DATA_MODEL.md`.
- `SecretStore` interface + MongoDB client-side encryption implementation; credential broker; Settings → Personal (add/replace/remove PAT, theme).
- Tachyon client (generation with function calling, embeddings), MLflow tracing wrapper, audit logger.
- App shell in React: sidebar, top bar, theme toggle, tokens, shared DataTable component (search, column filters, pagination, URL state).
- Reporting foundations per [REPORTS.md](REPORTS.md): shared export-job and snapshot contracts, deterministic XLSX/PDF/HTML/CSV renderers, authorized NAS artifact storage/download contract, expiry and audit. Shared **Download report** options, eligibility preview, accessible job states and persistent Recent downloads per [SCREENS.md](SCREENS.md).
- Reporting refinements: companion formats reuse the same captured snapshot; separate regeneration of an available original snapshot from creation of an updated report; suppress duplicate requests within the same authorized requester/scope/snapshot/format/template context; use safe descriptive filenames. Validate downloadable illustrative XLSX/PDF/HTML samples against the report contract, with matching values and explicit sample labels.
- Workflow control foundations per [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md): durable stop request, atomic dispatch/write fence, scoped worker acknowledgement, checkpoint/effect reconciliation, authorization and audit. Stop/completion races and stale workers must not start new business work after an acknowledged stop.
- UX (review 6, 7, 11): shared controls with 44px targets, visible focus, keyboard sorting with announced direction, selected tab state; all colours from `tokens.css`, none hard-coded; DataTable rules for combining keyword, tab and column filters, range filters on numeric and date columns, cross-page selection, and counts that match the visible rows.
- UX: error states for Tachyon quota, expired or under-scoped PAT, and secrets store unavailable; Settings → Personal with role variants.
- UX: global search and `/` commands (SCREENS.md): define the supported searches and commands, keyboard entry and exit, results and no-results states, and respect application access. Otherwise defer explicitly and remove the visible `/` hint.

## M1: App context
- Sources: Knowledge OS (reference + resync), Confluence space, DocuMind, API spec (structured parse), PDF/Word upload (PII masking).
- Chunking, tagging, embeddings cache (`hash + model version`), vector search (or in-app fallback).
- Automation repository index: GitHub Actions trigger (push and nightly), incremental re-index by commit diff, `repo_indexes` status in App context (open question 19).
- Conflict detection between sources → Huddle decision. Test retrieval panel.
- UX (review 12): label retrieval scores as relevance; show **Eligible for generation** vs **Excluded: unresolved conflict** with a link to the Huddle decision.
- UX: durable ingestion jobs. Leaving and returning restores the job and inputs; a partial failure names the missing sources, the owner and the next action.
- Downloads: source-health/context report and Huddle decision record, with source versions, conflicts, decision status and evidence links, in the formats specified by [REPORTS.md](REPORTS.md).

## M2: Regression scan
- New scan: auto-discover (GraphQL with PAT, custom property → topic → name), manual batches (Git links, ZIPs), role per row, pinning, guards.
- Gap analysis (Testmind integration) → `requirement_status` + scan snapshot.
- Regression screen: KPIs, pipeline, gaps table.
- Downloads: coverage and gap reports in PDF/HTML, with the catalogue's tabular companion; pin the scan snapshot and retain scope, counting rules, citations and eligible/excluded counts.
- UX (review 4, 8, 10): coverage wording (**Has test cases**, **Automated and passing**, **Awaiting execution evidence**) with numerator and denominator; scan progress page with queued, running, partial and failed states and recovery; Gaps view shows **Ready to write / Generating / In review / Blocked** and bulk generation counts only eligible gaps; separate application and release scope.
- UX: New scan separates **Review scan** from **Start scan**; a staged ZIP can be removed or its scan cancelled without losing other inputs, and readiness recalculates; suggested and discovered roles have a confirm or correct action in the row. Leaving and returning restores the scan job and inputs; completed components stay visible and partial failures name missing coverage, owner and next action.
- **Stop processing** on queued/running Regression scans: show Stop requested → Stopping → Stopped for the selected job; retain completed items and a labelled partial snapshot. Test leave/return, repeated stops and completion races. Offer an explicit new linked attempt from a supported checkpoint, never automatic resume or a full-coverage claim from incomplete work.

## M3: Write and review
- Skill resolution (auto-detect → `.matrix/skills.yaml` → run override), skill cache, agent loop, PR on `matrix/*` with FR + `matrix` tags.
- Review queue: Tests / Code changes / Dry run tabs, accept/reject with reasons, approvals posted to GitHub as the user.
- Rejections → skill proposals.
- Downloads: test-case Excel workbook (.xlsx) and review record per [REPORTS.md](REPORTS.md), preserving requirement/criterion mapping, steps, expected results, citations, versions and review state. Keep general workbooks distinct from Octane import sheets.
- UX (review 1, 2): name the approval action and its effect (test acceptance vs PR approval vs merge), with repo, PR, revision and identity beside it; per-test **Evidence used** (excerpt, source version, freshness, conflict status); highlight changed assertions after a rejection.
- UX: attach session instructions or a `SKILL.md` to a real run (instructions only, labelled on outputs).
- UX: approval freshness. Keep the GitHub redirect variant until open question 13 is resolved. A new PR commit or changed source evidence never inherits an earlier approval; show what changed, which review is now required, and the decision history.
- Apply workflow stop fencing to Regression generation and tool/external-write dispatch. Preserve completed drafts/commits/PRs; reconcile writes already in flight without retrying or rolling them back. Do not stop Git-triggered Harness/HyperExecute execution. A late model response cannot trigger more tool calls after stop acknowledgement.

## M4: Runs and compare
- Harness execution monitoring (webhook), HyperExecute logs, Octane upload status.
- Failure triage groups; test-fix PRs.
- Compare scans per `METRICS.md`.
- Downloads: run/failure and scan-comparison reports in PDF/HTML plus XLSX data, with immutable run/scan identifiers, baseline, filters, data-as-of time and counting rules. Reports remain read-only evidence; they never trigger execution.
- UX (review 4, 12): one consistent Compare fixture; attribution colours that don't use gap red; **View chart data** table; identify PR dry runs vs post-merge runs and their triggers.

## M5: Acceptance
- Jira fix version → stories → **story analysis** (refined, testable criteria with questions and citations) → **test cases** (QA review, Excel download) → **automation** (PR on `matrix/*`) → **test tagging** (suggested suite tags and priority, QA confirms; tag vocabulary configurable per app) → UAT sign-off → Octane import sheet export. Missing-AC handling. Hand-off to regression by tag.
- Required feedback on every AI output per [FEEDBACK.md](FEEDBACK.md): 1 to 5 stars and a one-line comment (required below 4), **Refine with AI** for the comment, gate on the stage's move-on action, `generations` and `generation_feedback` collections, and MLflow trace logging. Applies to Regression automation in Review too.
- Downloads: Acceptance test-case XLSX, criterion-coverage and sign-off PDF/HTML with XLSX detail per [REPORTS.md](REPORTS.md); a separate signed-off Octane import sheet with an included/excluded preview and an explicit manual-import hand-off. Include story/test versions and changed-after-sign-off status.
- Persist immutable signed-off story/criterion and test snapshots per [DATA_MODEL.md](DATA_MODEL.md). A content edit requires renewed sign-off before the edited revision can enter the Octane sheet; retain historical decisions and export their actual reviewed contents.
- UX (review 3): plain-language story view for UAT with criteria-to-test mapping, sign-off meaning, signer and version; changed-after-sign-off state; export summary of included and excluded tests; **Sheet downloaded. Manual import into Octane remains.**; link each handed-off test to its regression work. Reviewer assignment stays a TODO (open question 11).
- **Stop processing** on queued/running Acceptance processing: stop only the named job and its remaining scoped items; preserve completed cases and existing review/sign-off decisions. Show completed versus unprocessed stories, inline stop effects and a new linked continuation attempt when supported. Stopping neither signs off cases nor cancels another workflow or report job.
- Persist `test_case_sets`, `generations` and `generation_feedback`; server-side rating gate and set acceptance. `automation_drafts` with Outdated detection on each set acceptance.

## M6: Journeys
- Crawler per test identity (SIT), guardrails, journey map, API calls recorded, matching to requirements, findings to Huddle, observed source in App context.
- Test identities and test data screens; reservations; blocked group in Runs.
- Downloads: journey/findings and test-readiness reports per [REPORTS.md](REPORTS.md), identifying observed behaviour, crawl environment/time/roles, authoritative requirement links and readiness blockers. Export readiness summaries without credentials, secret references or raw sensitive test records.
- UX (review 5): label crawl results **Observed behaviour** with environment, crawl time and role; link the authoritative rule for any expected outcome, otherwise route to Huddle first.
- UX: durable crawls (leave and return, partial failures name the unreached roles or screens). Blocked-test recovery: blocked work and reservations come before implementation help, **Available** states whether it excludes reservations, and data requests show owner, status and the route back to readiness. Entitlement and provisioning integrations stay unresolved (open questions 8 and 9).

## M7: Admin
- Skills library (Git + MLflow + live pointer), evals and 90% gate, promote/rollback.
- Prompt studio: layered system instruction view, skill drafts and session instructions, sandbox side-by-side runs on golden samples, open PR on matrix-skills.
- Persist immutable evaluated-input snapshots, draft revision/hash, baseline commit and dataset/sample versions. Mark results stale after edits and derive current readiness only from matching inputs; distinguish sample/full-dataset evaluation and PR/promotion gates.
- User stats.
- Policies.
- Downloads: skill/prompt evaluation and user/team usage reports per [REPORTS.md](REPORTS.md), with version/dataset provenance and the viewer's permitted scope; preserve the same role restrictions as the source screens.
- UX: Skills promotion shows affected apps, bindings that change and rollback; User stats role variants and the adoption-and-coaching statement (HR decision stays a TODO, open question 14).
