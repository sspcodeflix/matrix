# Downloadable reports and exports

All important Matrix reports must be downloadable from the screen where users inspect the underlying work. This is a product requirement for the implementation; the static references do not yet implement it. Deliver each report with its feature milestone in [BACKLOG.md](BACKLOG.md).

Use **Excel (.xlsx)** for structured test cases and detailed records, **PDF** for a paginated report, and **HTML (.html)** for a standalone report that opens in a browser. Retain **CSV** for flat usage data. Downloads are generated deterministically from saved records and evidence; exporting does not call the model, approve tests, promote a skill or trigger execution.

## Report catalogue

| Report | Entry screen | Required formats | Essential content |
|---|---|---|---|
| Test cases, acceptance and regression | Acceptance, Review; linked test-case views from Regression | XLSX | Test IDs, requirement/story and criterion links, title, preconditions, ordered steps, expected results, role/data-need references, review/sign-off state, revision and source citations. Include drafts only with explicit state labels. |
| Octane import sheet | Acceptance | XLSX, dedicated import template | Only eligible signed-off acceptance tests at the signed-off revision, for the story's workspace, which is its Octane workspace. Preview included/excluded tests and reasons. Keep the agreed Octane column mapping separate from the general test-case workbook. |
| Coverage overview and portfolio (CIO) roll-up | Overview | PDF, HTML, XLSX for the whole page; XLSX, CSV, PDF for the coverage breakdown and the trend; XLSX, CSV for the applications table | Portfolio scope, applications measured, stale and not measured, tiers (automated and passing, cases only, awaiting or stale, no test) with numerator and denominator per CIO and application, monthly trend values with Matrix-written counts, scan IDs and dates, metric definitions per `METRICS.md`. Every chart is exported as exact values, not only as a picture. |
| Coverage and gaps | Regression; Acceptance for criterion coverage | PDF, HTML, XLSX detail | Scope, numerator/denominator, criteria with cases versus automated-and-passing coverage, requirement-to-test traceability, gaps by type/module, stale evidence and pending work. Include scan/run references and completeness. |
| Scan comparison | Compare | PDF, HTML, XLSX detail | Both scan snapshots, before/after coverage, denominator changes, Matrix contribution, lost coverage and reasons, trend values and module detail where available. |
| Execution results and failure analysis | Runs, Review dry-run detail | PDF, HTML, XLSX detail | Run IDs, trigger, branch/commit, environment, timestamps, pass/fail/blocked counts, duration, triage groups, requirement links and Octane upload status. Identify in-progress results as partial. |
| Review and UAT sign-off record | Review, Acceptance | PDF, HTML, XLSX detail | Reviewed version, decisions and reasons, assertion evidence references, reviewer/signatory and time, pending items and changed-after-approval state. Export/download/import and PR approval/merge remain separate states. |
| Journey findings | Journeys | PDF, HTML, XLSX detail | Crawl/environment/role scope, observed paths, requirement mappings, unexplained or unreachable paths, access findings and linked Huddle decisions. Label observations **Observed behaviour**; cite authoritative sources separately for expected outcomes. |
| Context health and decisions | App context, Huddle | PDF, HTML, XLSX detail | Source/version/freshness metadata, unresolved conflicts, generation eligibility, decisions/reasons/owners and affected work. Include necessary cited excerpts only, not a bulk copy of source documents. |
| Test readiness | Test identities, Test data | PDF, HTML, XLSX detail | Role/environment readiness, authentication-check time/status, data-need availability/reservations, blocked tests and recovery owner/status. Export no credentials, secret-store paths or raw reserved records. |
| Skill and prompt evaluation | Skills, Prompt studio | PDF, HTML, XLSX detail | Exact skill commits/draft revision, dataset/sample version, baseline versus candidate results, checks, token use, MLflow references and gate outcome. Distinguish sample from full evaluation and stale from current results. |
| Usage and adoption | User stats | XLSX, CSV, PDF, HTML | Period/time zone, workflow totals, tokens, trends and defined denominators. Preserve the role-based visibility and adoption/coaching purpose from [SECURITY.md](SECURITY.md). |

Reports are scoped to the current application and permitted records. No new access to per-person usage, prompts, source content or test identities is granted by exporting.

## Shared download journey

1. Put a secondary **Download report** action in the relevant page or detail toolbar. Use **Download test cases** for the workbook and keep **Export Octane import sheet** distinct. Preserve the screen's primary task.
2. Open a labelled dialog with report type, supported format and scope. Offer **Selected records (N)** when selection exists, **All matching current filters (N)** across every page, and **Entire permitted scope (N)** as an explicit alternative. Default to selected records when present, otherwise current filters. Never silently export only the visible page or silently expand beyond the selection.
3. Show application, workflow, release/scan/run/crawl/evaluation or date range, filters, record count, data-as-of time and included sections. Report units must be explicit: selected stories may contain multiple test cases. Show eligible/excluded counts with reasons for Octane and other gated outputs. Users can inspect the scope before generating.
4. Capture a stable source snapshot/version set and generate from it. If data changed since preview, refresh the preview before generating; do not combine old KPIs with new rows. Filtered/selected reports label subset totals; any whole-scope comparison is separately labelled. PDFs, HTML and spreadsheets for the same report snapshot agree.
5. Show **Queued → Generating → Ready**, plus **Failed**, **Cancelled** and **Expired**. Users can leave and return through **Recent downloads** in the download menu. Include named progress, creation time, scope, format, size, expiry and an actionable error. Allow cancellation while queued/generating. Do not imply a percentage unless progress can be measured.
6. Download the ready file through the authenticated application. Retrying a failed render uses its captured snapshot when retained; regenerating from current data is a new export with a new as-of time. Expired files offer regeneration with that distinction visible. Successful file delivery does not assert that the user opened it or that Octane imported it.

For no matching records, explain the empty scope and offer filter changes. A summary report may explicitly report no data, but missing execution evidence must not become a zero or a pass. When limits are exceeded, explain the limit and offer a narrower scope or clearly labelled parts with a manifest; never silently truncate. Access-denied, source-unavailable, rendering-failed and storage-unavailable states preserve the user's configuration.

## File content and presentation

### Reusing and identifying a report

- Show the source snapshot/revision, record unit and absolute as-of time in Recent downloads. Use a deterministic filename such as `matrix_<app>_<report-type>_<scope-id>_<as-of-UTC>_<report-id>.<extension>`, with safe characters and a length limit. Preview the filename before download.
- A ready report offers **Download another format from this snapshot**. Companion artifacts share a report-dataset ID/hash, source manifest, metric/template versions and as-of time. They may have separate artifact/job IDs. Recheck access; never silently recapture current data for a companion.
- On an expired artifact offer **Regenerate original report** if its immutable dataset or complete source manifest remains available. Offer **Create updated report** separately with a fresh preview and dataset ID. If the original cannot be reconstructed, explain that limitation and disable original regeneration; do not substitute current data.
- Acknowledge Generate immediately with **Creating export…**. Idempotency keys prevent double submissions. Reuse an eligible pending/ready job for the same requester, effective permissions, source dataset, scope, format and template version, or explicitly create a new job; a match on report title alone is insufficient. Changed permissions or evidence require fresh validation.
- Lead the report with assessed scope, result, recorded gaps/blockers and known next actions/owners, followed by full detail. Template summaries use recorded facts and preserve uncertainty.

Representative files and their frozen fixture/generator are in [design/report-samples](../design/report-samples/). These are illustrative acceptance examples, not exports of real bank data. Inspect complete test steps, long text, multiple PDF pages, offline HTML, source links and matching companion totals. The working download service remains to be built.

### Format requirements

Every file includes report ID, title, application and scope, source/as-of time, generation time with time zone, active filters, included/excluded counts, source revisions and template/metric-definition version. Link requirements, tests, source citations, PRs, scans and runs as applicable. Links to live Matrix records require normal access and may show newer state; the exported values remain a dated snapshot.

- **Test-case workbook:** separate Summary, Test cases, Steps and Sources sheets, linked by stable test ID and revision. Steps have sequence, action and expected result so multi-step cases are not flattened or truncated. Summary records the scope and state counts. Use readable widths, wrapped text, frozen headers and filters; keep IDs as text and dates/counts as appropriate typed cells. General downloads may include draft/rejected cases with their states; the Octane template has its own eligibility and exact column contract.
- **Other workbooks:** a summary plus appropriately named detail sheets and source references. Include underlying chart values. Export records from the chosen scope, including columns needed to interpret metrics, rather than copying rendered table cells.
- **PDF:** selectable text, readable tables, repeating headers and page numbers, sensible page breaks, labelled charts and numerical alternatives. Use a print-friendly light layout regardless of app theme. Long tables must remain complete and legible rather than being shrunk to fit one page.
- **HTML:** one self-contained file with embedded styles/charts, semantic headings and tables, local section links and numerical chart data. It opens offline without a server, remote fonts, scripts or trackers. Live evidence links remain optional navigation and require access. Escape untrusted content; the report is a static snapshot.
- **CSV:** UTF-8, one clearly defined flat table, consistent quoting, explicit units and time zone. Include report/scope/version metadata in columns so the file remains interpretable on its own. Use XLSX when related tables or ordered test steps are required.

Coverage and execution reports follow [METRICS.md](METRICS.md): case presence is not verified coverage, missing qualifying run evidence is **Awaiting execution evidence**, and blocked tests are separate from failures. A downloaded report never starts or reruns a Harness pipeline.

## Delivery and storage contract

The API validates report type, format, scope and permissions, then creates an export job. A worker reads an immutable report dataset or versioned source manifest, renders a versioned template, and stores the file on the existing NAS. MongoDB holds the job, source/format metadata and opaque artifact reference; do not put large files in MongoDB or introduce an object store. See [DATA_MODEL.md](DATA_MODEL.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

Check access at request, generation and download, including the report's permitted fields. If access has changed, deny delivery or create a newly scoped report with a new preview; never deliver an earlier broader artifact. Store artifacts privately, stream through an authorized endpoint, and audit request, completion and download without logging file contents. The history belongs to the requester by default; wider history visibility needs the corresponding role permission.

Use an allowlist of report fields. Exclude PATs, passwords, cookies, authorization headers, secret references/paths, raw test-data records and unredacted logs/traces. Apply existing masking to evidence. Write imported text as literal spreadsheet cells and neutralize formula-like values in CSV; do not create formulas/macros or executable HTML from source content. These rules apply to generated artifacts and temporary files.

Retention, record/size limits and required classification labels remain configurable TODOs under [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 16. A cleanup worker removes expired NAS artifacts and export-only captured datasets, then marks jobs expired; MongoDB TTL alone cannot delete NAS files. Signed-off and evaluated evidence snapshots follow a separate evidence-retention policy and must not be deleted just because a downloaded report expires. Downloaded local copies cannot be recalled by the application. The chosen policy must be shown before downloading.

## Acceptance checks

- Export a filtered result spanning several pages and a selection spanning pages; each contains exactly the previewed records, with no silent omissions or expansion.
- Export one case with multiple steps and citations; the workbook preserves every action, expected result, identifier, state and source link.
- Export coverage in PDF, HTML and XLSX from one snapshot; totals and denominators agree with each other and the source. A scan with no qualifying run says **Awaiting execution evidence**.
- Generate an Octane sheet containing only eligible signed-off revisions; show exclusions and **Sheet downloaded. Manual import into Octane remains.**
- Export an in-progress run and a journey report; preserve partial-result and observed-behaviour labels and separate blocked counts.
- Open HTML offline and PDF with selectable text; inspect long tables and exact chart values. Check the export dialog and job updates with keyboard and assistive technology.
- Leave during generation and return to the same job; test cancellation, failed rendering, expiry and source changes without losing configuration or mislabelling a fresh report as the old snapshot.
- Submit Generate twice and request a companion format: no duplicate equivalent job is created, and companion source values/hash remain identical. Original regeneration preserves evidence; updated generation explicitly creates a new source dataset and timestamp.
- Revoke access after generation and verify download is denied. Verify role-limited usage exports and absence of secrets, executable cell content and raw reserved records.

These are implementation acceptance criteria, not checks already performed on a working export feature.
