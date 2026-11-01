# Matrix: product overview

**Matrix** (Multi-Agent Testing, Reasoning, Intelligence & eXecution) is an agentic AI quality-engineering product. Tagline: **Finds the gaps. Writes the tests. Tracks every run.**

The problem it opens with: nobody owns the end-to-end view of functional coverage. Requirements live in Confluence and Knowledge OS, test cases in Octane, automation in Git. The gaps live between them.

## Personas
- **QA engineer**: runs scans, reviews what Matrix wrote, exports to Octane.
- **UAT user**: signs off acceptance tests per story in plain language.
- **Developer**: reviews automation PRs, fixes product defects.
- **Product owner**: answers Huddle decisions (scope, undocumented journeys).
- **Admin / stream owner**: manages skills, policies, connections, user stats.

## Workflows

### 1. Acceptance (what this release changes)
Starts from a **Jira fix version or sprint**.
1. **Story analysis**: pull stories and acceptance criteria from Jira; the story analyser extracts and refines each story into testable criteria, lists ambiguities and questions, links them to app context and cites its sources. Stories with no acceptance criteria are flagged (offer "Comment in Jira" / "Suggest criteria").
2. **Test cases**: the test case generator writes manual test cases per acceptance criterion (preconditions, ordered steps, expected results, role and data needs). QA reviews them, views them and downloads them as Excel.
3. **Automation**: the automation generator writes automation for accepted cases as a pull request on a `matrix/*` branch, each test tagged with its story and `matrix`. The Harness pipeline runs it from Git; Matrix never triggers execution.
4. **Test tagging**: Matrix suggests suite tags (smoke, regression, sanity, end-to-end) and a priority per test, with a reason; QA confirms or changes them. The tag vocabulary is configurable per application.
5. **Sign off and export**: UAT signs off per story; signed-off tests export as the Octane import sheet for that workspace (upload to Octane is manual today). Acceptance works inside one workspace (component, e.g. `App-abcd-web-ui`), which is also the Octane workspace.

Every AI output in these stages is rated before it moves on: 1 to 5 stars and a one-line comment, required below 4 stars, with **Refine with AI** for clearer comments. Ratings are stored with the output and logged to its MLflow trace. See [FEEDBACK.md](FEEDBACK.md).

Output: reviewed, tagged acceptance test cases and their automation per story. Hand-off: when a release ships, its signed-off acceptance tests join the regression suite according to their tags; the Regression workflow keeps them covered.

### 2. Regression (protect everything that already works)
Starts from an **application (app ID, e.g. ABCD)** and covers all of its workspaces; each test case and script it writes belongs to one workspace (e.g. `App-abcd-api`).
1. **Understand**: load the app context (Knowledge OS, DocuMind, Confluence, API specs, journeys).
2. **Identify gaps**: map every functional requirement to Octane test cases and the automation repo (Testmind): *no test*, *not automated*, *stale coverage*.
3. **Write automation**: write missing automation, open a PR on a `matrix/*` branch.
4. **Execute**: the Harness pipeline runs it on HyperExecute when the PR is opened or merged; results go to Octane.

**New scan**: choose how Matrix finds components:
- **Auto-discover from GitSaaS** (recommended): GraphQL discovery of repos tagged with the app ID, using the user's PAT; sorted into source and automation; anything missed can be added manually.
- **Add components yourself**: batches of Git links (one per line, `url@branch`) or ZIP uploads (several at once). For each batch: *What are you adding?* (Source / Automation) → *Where is it?* (Git link / ZIP). Role can be corrected per row. Any combination works. Automation from a ZIP gets its changes as a downloadable patch (no PR, no Harness run).
- Every component is pinned to a commit SHA or file hash. A scan needs at least one automation component.

**Compare scans**: for one app ID, compare two scans: automated coverage before/after, requirements newly automated by Matrix, open gaps, coverage lost, trend across scans. See `METRICS.md`.

**Stop processing**: Acceptance and Regression let an authorized user stop a named queued/running Matrix job. Show Stop requested → Stopping → Stopped; an in-flight operation may finish, completed work and existing PRs remain, and no new work starts after acknowledgement. This never stops Harness/HyperExecute or rolls back external writes. A supported checkpoint can continue only through an explicitly requested new linked attempt. Partial scans remain labelled incomplete. See [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md).

### 3. Journeys (crawler)
Matrix clicks through the web UIs **as each test identity** on SIT and maps user journeys. Results feed App context automatically as **observed** behaviour.
- **Undocumented journeys** (app does it, no requirement) go to Huddle for a decision.
- **Requirements not confirmed** (documented, crawl could not reach) are explained: role not crawled, date/data dependent, feature flag, blocked action, or possibly not built.
- **Access findings**: e.g. maker can approve own refund → possible entitlement defect → write a negative test.
- APIs: journeys record the API calls each UI journey makes; API specs list all endpoints; endpoints never called by any journey become API test gaps. Never probe APIs by guessing endpoints.

## Supporting areas
- **App context (Knowledge OS section)**: everything Matrix knows about an app: sources, embedding status, conflicts, test retrieval.
- **Review queue**: everything Matrix wrote that needs a decision, from both workflows.
- **Runs**: read-only monitoring of Harness executions, with failure triage.
- **Huddle**: shared decisions and context corrections (overrides, disputed gaps, sign-offs, undocumented journeys, source conflicts).
- **Skills (admin, locked)**: how Matrix writes tests; versions, evals, promotion.
- **User stats (admin)**: usage, Tachyon tokens, tests by workflow.
- **Settings**: connections (GitHub, Confluence, Octane, Jira), test identities, test data, access, policies, personal (PATs, theme).

## Downloadable reports
All important reports are downloadable from their working screen. Test cases from both workflows export to **Excel (.xlsx)** with ordered steps, expected results, review state and source links. Coverage, scan comparisons, execution results and sign-off records export to **PDF** and standalone **HTML**, with Excel detail for analysis. Journey findings, context/decision records, readiness and skill/prompt evaluation reports follow the same pattern; User stats supports Excel, CSV, PDF and HTML.

Each download has an explicit selection/filter scope, stable source versions, as-of time and counts. Exports preserve the user's access and the distinction between generated cases, approved cases and executed tests. The **Octane import sheet** is a separate signed-off-only Excel export; downloading it does not import cases or execute tests. See [REPORTS.md](REPORTS.md) for the catalogue, shared download journey and acceptance criteria.

Recent downloads offers companion formats from the **same snapshot**, and distinguishes **Regenerate original snapshot** from **Create updated report**. Repeated requests for the same authorized report reuse matching work rather than creating duplicate jobs. Use descriptive, safe filenames containing report/application/scope and version/as-of identifiers. Downloadable sample artifacts demonstrate the required formats and are clearly labelled illustrative; they are not live report results.
