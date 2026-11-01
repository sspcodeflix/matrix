# Matrix UI design and user experience review

Reviewed: 1 November 2026

The app shell, separation of Acceptance and Regression, and consistent table patterns give Matrix a clear foundation. The most important improvements concern decision-making: users need to understand what they are approving, what evidence supports it, which scope they are changing, and what happens next. Those issues should be addressed before polishing the visual details.

## Scope and interpretation

The initial review covered the product, architecture, data, screen, integration, security, metrics, backlog and open-question documents; the original 17 light-theme screens; representative dark-theme screens; and relevant HTML and token definitions. The subsequent visual audit covered 36 screenshots across 18 light/dark screen pairs, including Prompt studio. Download report and Workflow processing add two reference pairs, bringing the inventory to **40 screenshots across 20 pairs**. Follow-up checks focus on those additions and do not repeat a complete visual audit of every regenerated screen.

The repository now includes a React frontend under `frontend/`, backed by typed mock API functions. The current code review below distinguishes reproducible frontend behaviour from deliberately unfinished backend integrations. Earlier sections cover the design hand-off and its local HTML previews; their placeholder links are not production defects. No production-backend or screen-reader testing has been performed. Contrast figures and control sizes in the original source-based findings come from the earlier reference markup. Revalidate those historical line references and measurements against later changes.

Priorities:

- **P1:** Resolve before implementing or signing off the affected workflow. These affect informed decisions, core task completion or the project's accessibility requirements.
- **P2:** Resolve during the relevant milestone. These improve comprehension, efficiency and consistency.

## Latest re-review: workspace, story stages and feedback changes

Reviewed on 1 November 2026 after the previous checkpoint and its reported fixes.

**Assessment:** The workflow is easier to understand. The story workspace brings the output, evidence, rating and next action together. Regression gives review the primary action, names who acts next and puts service details behind disclosure controls. The mobile drawer and current-stage-first pipeline fix the previous layout problems. The remaining priority is consistency: the same output must carry the same decisions and revision across views, and application identity must survive navigation.

**Verification:** Read the updated frontend and the revised workspace, feedback and metrics requirements. Walked through Acceptance, a story workspace, Review, Regression, Overview, scan setup and Runs downloads using the local mock app. Inspected desktop light/dark layouts and Regression at 390px in dark, including keyboard navigation. Build passes; lint has zero errors and the same two Fast Refresh warnings. No backend, external GitHub approval, MLflow delivery, production authorization or full screen-reader audit was exercised. Findings below separate frontend behaviour from explicitly deferred integration work.

### Previous checkpoint: independently rechecked

| Earlier finding | Current assessment |
|---|---|
| C1: approval overwrites newer decisions | Original race fixed. Pending approval disables conflicting decisions; changed-commit responses leave approval stale. Browser checked. The new rating gate has a separate revision problem below. |
| C2: equal-sized selections reuse one export | Original key corrected. Selected IDs or normalized filter scope now determine export identity. Missing subset identity does not silently deduplicate. Source/store checked. |
| C3: links open unrelated review items | Earlier record links now carry an item/reference and a return path; missing targets have an explicit state. The story-to-Review return path works. Cross-application navigation is a separate remaining issue. |
| C4: actionable UAT work hidden | Predicate now includes UAT and renewal work; current sign-off totals exclude stale sign-offs. Source checked. |
| C5: discovery and manual setup use different drafts | Shared application-keyed draft fixes switching between discovery, Git and ZIP. The chosen application still needs to be used consistently by screen loaders. |
| C6: creation time substitutes for evidence time | Fixed in shared export state: capture time and creation time are separate; unknown capture time remains unknown. Runs preview shows the source capture time. |
| C7: missing/stale/excluded totals mixed | Original categories and predicates corrected. Qualifying execution evidence remains a distinct metrics-contract issue below. |
| Mobile task visibility and next action | Visually improved: navigation is a drawer and the active pipeline stage appears before completed stages. Keyboard containment still needs correction. |

### Remaining findings

#### R1. P1: The required rating is not enforced for the current revision on every completion path

**Evidence:** [feedback/hooks.ts](../frontend/src/features/feedback/hooks.ts), line 15, checks completeness of feedback without comparing its `outputRevision` to the current generation. [Review/api.ts](../frontend/src/screens/Review/api.ts), lines 292–300, retains a generation ID across revisions; for a PR its revision key uses the commit alone, ignoring local test edits.

**Browser reproduction:** Rate the regression output, then use the supplied changed-commit mock during approval. The approval correctly becomes stale and the feedback card says **Rate the new version**, but **Approve all** is still enabled with the previous revision's rating.

There is also an unrated completion path: [TestRow.tsx](../frontend/src/screens/Review/TestRow.tsx), line 109, permits individual acceptance; [ReviewDetail.tsx](../frontend/src/screens/Review/ReviewDetail.tsx), lines 25 and 123–127, declares a fully accepted non-PR set ready for UAT before requiring feedback. In the browser, accepting all six PAY-1490 cases individually produced **6 of 6 accepted / Needs UAT** without submitting any rating.

**Recommendation:** Define one completion predicate for the current output revision and apply it to every move-on path. Include edited test revisions in the output identity. Per-test decisions can remain provisional until the set has current feedback and is explicitly accepted. Preserve old feedback as history rather than treating it as approval for new content.

#### R2. P2: The story workspace and per-test Review disagree about rejected cases

**Evidence:** [AcceptanceStoryScreen.tsx](../frontend/src/screens/AcceptanceStory/AcceptanceStoryScreen.tsx), line 200, exposes **Per-test review in Review queue**. Review owns a separate item list in [ReviewScreen.tsx](../frontend/src/screens/Review/ReviewScreen.tsx), while [AcceptanceStory/api.ts](../frontend/src/screens/AcceptanceStory/api.ts), lines 383–400, accepts and generates from its own story test-case state.

**Browser reproduction:** Open PAY-1490, follow its per-test review link, reject TC-1490-01, then use the return link. The story view still shows that case as a draft. Rate the set and choose **Accept test cases and write automation**: the rejected case becomes accepted in the story view and automation is drafted from that separate set. The same test IDs also have different sample content between the two views.

**Recommendation:** Both views must use one versioned case set and shared decision state. Carry rejections, edits and ratings back to story-level completion, and block or explicitly exclude rejected cases before generation. This is coherence between two implemented frontend paths; server persistence remains separate backend work.

#### R3. P2: Application identity is lost during drill-down and scan setup

**Evidence:** [OverviewScreen.tsx](../frontend/src/screens/Overview/OverviewScreen.tsx), line 69, sends every application link to bare `/regression`. [NewScanScreen.tsx](../frontend/src/screens/NewScan/NewScanScreen.tsx), line 25, selects the session's default application rather than the application chosen in workspace context; the manual Git/ZIP entry points use the same pattern.

**Browser reproduction:** With Payments Hub selected, clicking **CRDP** in Overview opens **Regression · App-payh-web-ui (subset)**. The clicked application is not selected. Choosing Cards Portal also leaves scan setup tied to the default Payments Hub draft.

**Recommendation:** Carry application identity in drill-down navigation and use the chosen application for headings, loaders and draft keys. Preserve its workspace preference, or request a valid workspace explicitly. Do not silently open an unrelated application when a requested application has no available data. This frontend routing issue does not depend on implementing backend entitlement checks.

#### R4. P2: Same-name repositories can collide when added in one clock tick

**Evidence:** [NewScanGitScreen.tsx](../frontend/src/screens/NewScanGit/NewScanGitScreen.tsx), lines 45–52, accepts distinct repository URLs in a batch. [componentRules.ts](../frontend/src/screens/NewScanGit/componentRules.ts), line 66, builds each ID from only its basename and `Date.now()`.

**Trigger:** Add `team-a/shared-api` and `team-b/shared-api` in the same batch. If both IDs are created in the same millisecond, they are identical, and removal by ID removes both records. The helper-level check and a browser run with a controlled same-tick clock reproduced this: two rows became zero after removing one. An ordinary browser run did not collide, so this is timing-dependent, not a claim that every batch fails.

**Recommendation:** Use collision-free component IDs and a separate canonical repository identity for duplicate detection. Verify that removing one of two repositories with the same basename leaves the other intact even when the clock value is identical.

#### R5. P2: A multi-run report identifies only one run as its snapshot

**Evidence:** [RunsScreen.tsx](../frontend/src/screens/Runs/RunsScreen.tsx), lines 133–144, offers filtered/all-run scopes but derives snapshot identity and the partial-result warning from the selected run alone.

**Browser reproduction:** The download preview shows **7 runs in scope**, **Run #4821 pinned**, and a filename containing `RUN-4821`. Selected rows is disabled, so the selected detail run is not an explicit export scope.

**Recommendation:** Offer a clearly named selected-run export. Use a collection snapshot for multi-run reports, preserve each included run's identity, and derive partial/completeness warnings from all included runs. The report's scope, snapshot and filename must describe the same evidence.

#### R6. P2: Keyboard focus escapes the open mobile navigation drawer

**Evidence:** [AppShell.tsx](../frontend/src/components/AppShell.tsx), lines 54–63, focuses the drawer and handles Escape, but does not contain Tab navigation or make the obscured background inert.

**Browser reproduction:** At 390px, open navigation, focus Settings and press Tab. Focus moves to the background **Open navigation** button while the drawer and backdrop remain open.

**Recommendation:** Use modal drawer semantics with contained focus and an inert background, then restore focus when dismissed. Retain the visual improvement and check the same behaviour in both themes.

#### R7. P2: Regression coverage still lacks the execution-evidence gate

**Evidence:** [RegressionScreen.tsx](../frontend/src/screens/Regression/RegressionScreen.tsx), lines 43–49, calls a fresh row with at least one case and script **Covered** without a qualifying run. Its row type lacks an awaiting-execution/evidence state. [METRICS.md](METRICS.md), under **Coverage levels and CIO roll-up**, requires a mapped test passing in the scan's Harness run; otherwise automation awaits execution evidence.

**Impact:** The new Overview's **automated and passing** coverage and Regression's case/script-presence calculation do not enforce the same meaning. This is a source/contract finding; the sample does not establish that any particular displayed requirement has a failed run.

**Recommendation:** Carry qualifying run evidence or an evidence-backed coverage state in the row model. Distinguish **Awaiting execution evidence** from **Covered**, and use that same classification in overview totals, table filters and exports.

### Design and journey observations after the changes

- **Keep the story workspace.** It materially reduces the need to reconstruct context across pages. Resolve the two review surfaces' shared state before presenting either as a completed QA hand-off.
- **Make the UAT branch explicit.** UAT becomes available after test-case acceptance while automation can continue. The five-step strip puts UAT last, suggesting a sequential dependency that the actual behaviour does not require. Show the parallel hand-off or label that dependency clearly.
- **Reduce summary density.** Acceptance has eight stage tiles, including zero-count states labelled **Needs QA**. At 1440px they wrap seven plus one, leaving a large empty area. A balanced grid or compact zero-count states would give the story table more room. Regression's seven KPI cards also create narrow, heavily wrapped labels; group secondary counts behind the main coverage summary.
- **Keep scope visible through every action.** The workspace subset label is useful. Apply it consistently to the next review action, application-wide pipeline summaries and downloads so users can tell when they leave the subset.
- **Keep the rating requirement, but centralize completion.** Users should not have to infer whether per-test acceptance, set acceptance or a rating is the action that releases work to UAT or automation.

**Order to address:** Correct R1 and R2 first, then application identity and component IDs, then report provenance and drawer keyboard behaviour. Align the coverage contract before connecting real metrics. Keep production APIs, server-side preferences, entitlement lists, MLflow feedback delivery and real stop-processing jobs marked as pending integration work, as the current documentation already does.

### Status of the latest re-review findings

Findings above are unchanged. Results below are from the mock app in the browser (Playwright) after the fixes; no backend, GitHub or screen-reader testing.

| Item | Status | What changed |
|---|---|---|
| R1 | Resolved | Ratings are stored per output revision; the gate counts only a rating for the current revision and names the gap ("Rate revision 2 first"). Review's output identity includes the PR head commit and every test revision. Per-test decisions are provisional; only an explicit set acceptance (Review **Accept set**, story **Accept test cases and write automation**) releases work, and it needs the current revision rated. Both reproductions are now blocked with a stated reason. |
| R2 | Resolved | One versioned test-case store (`features/testcases`) feeds both the story workspace and Review. Rejections and edits show in both. Rejected cases are excluded from release with the count and IDs stated; automation and tags are drafted only from included cases. |
| R3 | Resolved | Overview links carry the application (`/regression?app=…`); Regression, Compare and scan setup use the chosen application for headings, loaders and draft keys. Applications without data, or outside the user's list, get an explicit state. |
| R4 | Resolved | Component IDs use `crypto.randomUUID` (clock plus counter fallback); duplicates are detected by normalized `host/owner/repo`. Same-named repositories from different owners survive removing one, even with a frozen clock. |
| R5 | Resolved | Collection exports use one snapshot named by run range (`RUNS-4795-4832`) with every included run listed and partial warnings from all of them. **This run · #4821** is an explicit scope with its own snapshot `RUN-4821`, capture time and filename (scopes can now carry their own snapshot in the shared dialog). |
| R6 | Resolved | The open mobile drawer is a modal dialog: Tab and Shift+Tab stay inside, the page behind is inert, and Escape, the backdrop and Close return focus to **Open navigation**. |
| R7 | Resolved | Rows carry qualifying run evidence. Covered requires a mapped test passing in the scan's own run; otherwise **Awaiting execution evidence**. One classifier drives KPIs, views, filters, bulk eligibility and downloads, and the Overview PAYH row now matches Regression (26 / 4 / 2 / 6). **View run** opens that run in Runs. |
| UAT branch | Resolved | The story stepper shows that accepting test cases opens Automation and UAT sign-off in parallel. |
| Summary density | Resolved | Regression's seven KPI cards became one coverage summary with tier counts plus a secondary row. Acceptance shows tiles only for stages with work, in a balanced grid, and lists empty stages on one line. |
| Scope through actions | Resolved | With a workspace selected, the next-review action, pipeline summary and downloads carry the subset label; whole-application figures are labelled separately. |
| Centralized completion | Resolved | One release predicate and one release action per output; the gate reason or what will be released is shown beside it. |

Still open: the test-case and feedback stores are in memory until the backend exists; automation drafted from an earlier set is not yet marked outdated when the set changes; the Acceptance list reads its counts from its own sample rather than the shared test-case store.

## Previous React checkpoint: 1 November 2026

**Verdict:** The four-stage overview is understandable, and both desktop themes look consistent. The journey feels more complicated than necessary because users have to reconcile the primary button, the pipeline, the table and a separate Review or Huddle queue. Some of that friction is caused by concrete navigation and state bugs. Fixing these will improve usability more than adding visual decoration.

**Scope and checks:** Reviewed Acceptance, Regression, scan setup, Review, workflow processing, shared download state, routing, tables and the shell. Rendered Acceptance and Regression at 1440px in light and dark; inspected Regression at 390px in dark. Browser walkthroughs reproduced incorrect review destinations, the approval race and the disconnected scan drafts. Isolated store checks reproduced export deduplication and timestamp problems. `npm run build` passes. `npm run lint` finishes with zero errors and two existing Fast Refresh warnings in `DownloadReportContext.tsx` and `ThemeContext.tsx`. These are focused checks, not a full accessibility or production integration audit.

### Code findings, in priority order

#### C1. P1: A pending approval can overwrite a newer test decision

**Evidence:** [ReviewDetail.tsx](../frontend/src/screens/Review/ReviewDetail.tsx), lines 53–58, captures the current tests, waits for PR approval, then replaces the whole item with that captured state. The confirmation's Cancel button and close handler remain enabled at lines 262–267; individual decisions are still available after dismissal.

**Reproduction:** Open Review, choose **Approve all**, submit **Accept tests and approve PR**, dismiss with Cancel during the mock's 600ms request, then undo acceptance of the already accepted test. The browser showed **0 of 3 accepted**, followed by **3 of 3 accepted / Approved** when the earlier response completed. A newer decision was silently lost. This was reproduced entirely against mock data; no GitHub approval was sent.

**Recommendation:** Serialize conflicting decisions while approval is pending, and bind approval to the exact item/commit/test revisions reviewed. Ignore or reconcile stale responses instead of replacing a newer item. Handle failure explicitly and explain whether dismissing a dialog cancels a request or only closes the dialog.

#### C2. P1: Different report selections can resolve to the same export job

**Evidence:** [jobs.ts](../frontend/src/features/download/jobs.ts), lines 126–140, deduplicates using context, report, format, scope kind, snapshot and record count. [DownloadReportDialog.tsx](../frontend/src/features/download/DownloadReportDialog.tsx), lines 141–152, carries counts but no selected IDs or normalized filter criteria into the job request.

**Trigger and impact:** Select one requirement and request a report, then select a different single requirement and repeat. Both requests have the same key and the second reuses the first job. Different filters with equal counts collide too. The current export contract cannot distinguish the requested records; this must be corrected before real scoped files are generated.

**Recommendation:** Carry stable selected record IDs or a normalized filter/scope specification through the dialog and saved job. Include that identity in deduplication, with application, snapshot, report options and requester. Keep the count as display metadata. Verify that equal counts with different members create separate jobs, while an identical request reuses its job.

#### C3. P2: Review and sign-off actions lose the selected work item

**Evidence:** [AcceptanceScreen.tsx](../frontend/src/screens/Acceptance/AcceptanceScreen.tsx), lines 75–84, uses bare `/review` and `/huddle` links for story actions. [RegressionScreen.tsx](../frontend/src/screens/Regression/RegressionScreen.tsx), line 400, does the same for **Review diff**. [ReviewScreen.tsx](../frontend/src/screens/Review/ReviewScreen.tsx), lines 47–48, defaults to the first queue item when no item is supplied.

**Reproduction:** **Review tests** for PAY-1490 and **Review diff** for FR-0233 both opened the unrelated FR-0218 / PR #212 detail. The intended acceptance item is present in the queue, but the user must find it again. Story sign-off links likewise open a generic Huddle selection rather than the corresponding sign-off.

**Recommendation:** Carry the matching review/decision ID, queue and originating story or requirement in navigation. Open that item directly and provide a return link preserving the original filters. If no matching review or sign-off exists, show an explicit unavailable or creation state rather than selecting an unrelated record.

#### C4. P2: Acceptance hides actionable UAT work in its default view

**Evidence:** [AcceptanceScreen.tsx](../frontend/src/screens/Acceptance/AcceptanceScreen.tsx), lines 15 and 28–29, excludes `ready_for_uat` and changed-after-sign-off stories from **Needs action**. The signed-off total at line 102 includes stale sign-offs.

**Impact:** The fixture has two stories ready for UAT and one requiring renewed sign-off, but all three disappear from the default action queue. The UAT KPI displays four signed-off stories even though one signature applies to an older story revision.

**Recommendation:** Include pending UAT and renewal in actionable work. Show current sign-offs separately from renewals required. If this becomes an assigned-to-me view, make assignment explicit and retain a separate all-actionable view; do not infer reviewer assignment while its product decision remains open.

#### C5. P2: Adding a missing component switches to a different scan draft

**Evidence:** [NewScanScreen.tsx](../frontend/src/screens/NewScan/NewScanScreen.tsx), line 42, owns an auto-discovery component list locally. Its **Add a missing component** link at line 213 opens Git setup, whose separate [draftStore.ts](../frontend/src/screens/NewScanGit/draftStore.ts), lines 25–30, loads another draft.

**Reproduction:** The discovered scan had five components, including an automation repository. Following **Add a missing component** showed a different two-component list with zero automation and a new readiness blocker. Returning to discovery remounts the initial list and loses local confirmations. Git and ZIP share their own store, but discovery does not participate in it.

**Recommendation:** Use one application-scoped scan draft across discovery, Git and ZIP. Keep component identities, confirmations, removals and pinned versions when switching input methods. Persist the draft at the existing backend boundary so refresh and later return can restore it too.

#### C6. P2: Export metadata reports generation time as source capture time

**Evidence:** [DownloadReportDialog.tsx](../frontend/src/features/download/DownloadReportDialog.tsx), lines 141–152, sends a snapshot ID without its source timestamp. [jobs.ts](../frontend/src/features/download/jobs.ts), line 144, substitutes the current time when `asOf` is missing, and uses it for the job and filename.

**Impact:** A report preview can identify older source data while Recent downloads presents the generation time as **data as of**. The pinned evidence appears fresher than it is; creating a file did not refresh the scan.

**Recommendation:** Pass structured snapshot metadata with a required `capturedAt`, separate from export `createdAt`. Preserve it for every format and retry. A useful check is that an export created today from yesterday's snapshot keeps yesterday's evidence timestamp.

#### C7. P2: Regression totals mix missing, stale and excluded coverage

**Evidence:** [RegressionScreen.tsx](../frontend/src/screens/Regression/RegressionScreen.tsx), lines 69–70, includes `stale` in **No test** and all overrides in **Not automated**. The fixture's stale requirement already has both an Octane case and an automation script. Accepting its separate out-of-scope override removes that override from gaps but not from the automation KPI.

**Recommendation:** Derive table states, summary totals and export summaries from consistent predicates. Show missing tests, stale coverage and missing automation separately. Explain exclusions and their scope. Keep test presence, automation presence and execution results as distinct measures.

### How to make Acceptance and Regression easier to follow

Keep the stage overview, the full-width tables, row-level actions, evidence links and the red highlight for work needing attention. The current desktop layout is orderly. The changes below focus on making the user's next decision clear.

| Area | Current source of complexity | Recommended behaviour |
|---|---|---|
| Next action | Regression says **Needs your review at step 3** while its strongest button offers generation for all gaps. | Put **Review generated changes** first when review is the current task. Keep generation available for explicitly eligible work, with selected/filtered/all scope stated. |
| Parallel work | Acceptance shows **Sign off and export: Queued** while some stories already have sign-offs and others are ready for UAT. | At release level, show counts by stage and actionable queues. Use a sequential progress bar for a specific job, labelled with its scope. Do not imply every story must wait for every other story. |
| Ownership | Automated stages, QA decisions, UAT approval and external execution have similar presentation. | Label the current owner: **Matrix working**, **Needs QA**, **Needs UAT**, or **Waiting on Git/Harness**. Name the resulting output beside each action. |
| Detail density | Knowledge OS, DocuMind, Tachyon, Testmind, GitHub and Harness appear across the overview. | Lead with user outcomes such as **Check requirements**, **Review tests** and **View results**. Keep service names and traces in expandable evidence/details. |
| Acceptance completion | Review, UAT and export are spread across separate queues and controls. | Keep the story identity visible through **Review tests → UAT sign-off → Export eligible tests**. Show missing criteria, outdated sign-off and export exclusions beside that story. Label the manual Octane import step clearly. |
| Regression completion | Setup, generation, review and execution monitoring are disconnected. | Preserve the scan/requirement/PR/run identity through **Scan → Review gaps → Generate → Review PR → Monitor Harness results**. Distinguish PR validation from post-merge or scheduled runs; Matrix remains read-only for execution. |
| Bulk eligibility | The bulk predicate at `RegressionScreen.tsx:77–79` includes stale rows and unresolved overrides, while their row actions direct users to Review or Huddle. | Define one eligibility rule for bulk and row actions. Explain blocked or already-in-review rows and resolve the intended override policy before generation. |
| Stop and return | Processing is explicitly a local preview, and the generation notice drops its job ID when linking to it. | When connecting real jobs, show **View progress** and **Stop processing** against the actual job and scope. Preserve partial outputs and the return path. Keep the current preview labelled as a demonstration until then. |

**Narrow screens need a different presentation.** At 390px, the full sidebar becomes a long block above the page, so the first screen contains navigation rather than the task. The 820px pipeline starts with completed stages while the active review stage sits off-screen. See [AppShell.module.css](../frontend/src/components/AppShell.module.css), lines 5–10, and [Regression.module.css](../frontend/src/screens/Regression/Regression.module.css), lines 16–20. Collapse navigation into a drawer, place the next action near the page title, and show the current stage first with expandable history. Horizontal scrolling remains reasonable for the detailed data table. Apply the same structure to light and dark themes.

**Suggested order:** First protect decisions and export identity (C1–C2), then repair record navigation and scan continuity (C3–C5), then reconcile evidence metadata and totals (C6–C7). Follow with the next-action hierarchy and narrow-screen layout. Re-run task walkthroughs for one acceptance story and one regression requirement from entry to downloadable evidence, including missing criteria, renewed sign-off, failed requests and stopping a job.

### Status of the React findings

The findings above are unchanged. All results below are from mock data in the browser; no backend, GitHub or screen-reader testing.

| Item | Status | What changed |
|---|---|---|
| C1 | Resolved | Approval is bound to the item, PR head commit and test revisions. While it is pending, conflicting decisions are disabled with a stated reason. A response is applied only if those are unchanged; otherwise the approval is marked stale. Failures are shown with Try again. The dialog stays open and says the request continues if closed. Reproduction steps no longer lose the newer decision. |
| C2 | Resolved | Export de-duplication keys on selected record IDs or a normalized filter spec, plus snapshot, report, format, application and requester. Count is display only. Requests without identity are never reused. Two different one-row selections now create two jobs. |
| C3 | Resolved | Shared `navigation.ts` carries `item`, `ref` and a `from` return path. Review and Huddle open the exact record, show **Back to …** with the original filters, and show an explicit empty state (e.g. **No review for FR-0233 yet**) instead of an unrelated item. |
| C4 | Resolved | **Needs action** includes stories ready for UAT and renewals. Current sign-offs are counted separately from **Renewal required**. |
| C5 | Resolved | One application-scoped scan draft is shared by discovery, Git and ZIP. Confirmations, removals and additions survive switching, and a refresh (mock save + sessionStorage). **Discard draft** added. |
| C6 | Resolved | Jobs carry `capturedAt` separately from `createdAt`; the filename uses capture time. A missing capture time shows **Capture time unknown** instead of the current time. |
| C7 | Resolved | Table states, KPIs, view counts, bulk eligibility and download summaries share one set of predicates. No test, stale, not automated and overrides are separate measures. Rows needing Review or Huddle are excluded from bulk generation with the reason listed. |
| Next action | Resolved | Regression's primary is **Review generated changes** when review is the current stage; generation is secondary with its scope stated. Acceptance picks its primary from the earliest stage needing a person. |
| Ownership and detail density | Resolved | Stages carry text owner labels (**Matrix working**, **Needs QA**, **Needs UAT**, **Waiting on Git/Harness**) and lead with outcomes; service names moved to collapsible details. Review shows a **Next:** owner line. |
| Parallel work | Resolved | Acceptance shows release-level stage counts that filter the table, instead of one sequential pipeline. |
| Narrow screens | Resolved | Below 900px the sidebar is a drawer behind a menu button (Escape and route change close it; focus returns). Below 700px the current stage is shown first, completed stages collapse, and the next action sits under the title. |
| Stop and return | Partial | Generation notices keep their job ID in the **View progress** link. Processing remains a labelled local preview until real jobs exist. |

Still open: if a draft exists both locally and on the server, the scan draft needs a rule for which wins (needs the backend). When several stories await review, the Acceptance primary opens the first. Regression's gaps-step summary is scan-time text and does not change when an override is decided locally.

## Reference design status: 1 November 2026

This section records the earlier PNG review, status table and follow-up verification of the HTML references. The React code review above is the latest implementation assessment. The original findings further down are unchanged and keep their numbers; line numbers cited there refer to the files as first reviewed. Workspace, Acceptance, Main and the three New scan screens have changed since, so find those references by their on-screen text.

**Evidence basis.** All 36 screenshots (18 screens in light and dark, including Prompt studio) were opened; the 24 revised images across 12 screen pairs were inspected again after the revision captured at about 01:35–01:40 Asia/Dubai. All images are 1440px desktop captures and do not establish behaviour at smaller widths or increased zoom. Checks at 1280px and 1920px were reported by the author of the revision and were not independently rendered. A PNG cannot prove keyboard operation, focus behaviour, backend enforcement, actual scrolling, permissions or persistence. Prompt studio's disabled **Open PR** attribute was checked in the HTML; no live workflow or MLflow integration was exercised. These are design-progress observations, not completed backend behaviour.

**Assessment.** The revision is materially easier to use. Keep these changes:
- Full-width tables resolve the clipping in Regression, Compare, App context, Test data, Skills, Test identities and Acceptance.
- Acceptance makes **Review 6 tests** the primary action.
- All three New scan screens explain what blocks **Review and start** and link to it; the Git batch clears and confirms what was added; the ZIP batch adds only scanned files.
- Prompt studio distinguishes a passing sample from full evaluations and disables **Open PR** until evaluations run.
- The landing page is about 16% shorter (4,914px to 4,107px), and its copy and tagline (**Finds the gaps. Writes the tests. Tracks every run.**) assign execution to Harness.

Light and dark variants keep these improvements consistently.

### Original findings

| # | Finding | Status | What remains | Milestone |
|---|---|---|---|---|
| 1 | Meaning of approval | Open | **Approve all** still appears with **1 of 3 accepted**, and the GitHub submission consequence sits in small footer text. Explain the submission beside the button. Keep the GitHub redirect alternative until [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) item 13 is resolved. A new PR commit or changed evidence must not silently inherit an earlier approval; show what changed and keep the decision history. | M3 |
| 2 | Assertion-level evidence in Review | Open | Only one test shows steps. Give every test **View steps and expected result** and its source evidence before approval. | M3 |
| 3 | UAT sign-off, export and hand-off | Open | Story sign-off and export states not designed. Reviewer assignment blocked on [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) item 11. | M5 |
| 4 | Test presence vs verified coverage | Open | Rename **Criteria tested** to reflect case presence. Fixtures disagree: Acceptance's 38/41 conflicts with visible zero-test stories; Compare shows 15/34 automated beside 23 open gaps, and its module coverage-lost values total one while the card reports two. | M2 (wording), M4 (Compare) |
| 5 | Observed journeys vs expected behaviour | Open | Put **Observed behaviour** on the Journeys screen; link negative-test proposals to the authoritative rule. | M6 |
| 6 | 44px targets, focus, keyboard states | Partial | Done on Prompt studio and on the buttons changed in the revision. Remaining: 40px sidebar links and shell buttons on every screen, 16px checkboxes, 22px filter-chip remove, 32px Review decision buttons. | M0 |
| 7 | Dark-theme semantic text colours | Partial | Prompt studio uses `tokens.css`. Remaining: raw `#C8102E` small text on Dark-Main; white on `#9AA1AC` avatars in Dark-Huddle and Dark-Stats. Root cause is hard-coded hex in the reference HTML; build React from tokens. | M0 |
| 8 | Readiness before long-running work | Partial | Scan setup readiness done (see above). Remaining: separate reviewing configuration from starting a scan; queued, running, partial and failed states for scans, crawls and ingestion; leaving and returning restores the saved job and inputs, and partial failures name missing coverage, owner and next action. | M1, M2, M6 |
| 9 | Room for the main work area | Partial | Table width done. Remaining: sticky IDs on wide tables, narrow and zoom layouts, collapsible pipeline. | M0, M2 |
| 10 | Scope and current next action | Partial | Acceptance done. Regression still offers **Write automation for 11 gaps** while 3 are in an open PR; application vs release scope; **Rescan** vs **New scan** labels. | M2 |
| 11 | Table and sample-state contract | Open | Huddle shows 5 cards with "1–4 of 14"; Gaps view contains a Covered row; Acceptance **Needs action** contains a signed-off story; Explore has no Steps filter. Badge counts disagree with screens (App context: 3 attention cards vs badge 2; Journeys: **3 waiting in Huddle** vs badge 1); define whether badges count personal or team work. Action columns on App context and Journeys are unnamed. | M0 and a shared fixture |
| 12 | Analytical colours and scores | Open | Compare's red **+24 pts** still uses gap red for positive attribution; add exact chart values. App context's 0.91 / 0.87 scores need a relevance label and **Excluded from generation** for conflicting results. User stats charts have no visible scales or per-period values; that screen also needs the adoption-and-coaching statement and the intended audience for named usage. | M1, M4, M7 |
| Landing | Layout and copy | Mostly done | Hero paragraph is still long; reduce it to the outcome and the execution hand-off. The trust line under the hero repeats Governance. Richer preview and workflow visual not adopted (post-POC). Icon proposal: see **Matrix icon and wordmark**. | — |

### Other screen observations

Not covered by a numbered finding.

| Screen | Observation | Recommendation |
|---|---|---|
| Auto-discovery | Discovered roles have no visible correction route. | Allow correcting a discovered role in the row. |
| Git batch | **Check the suggested role** has no explicit acknowledgement. | Provide a confirm action for the suggested role; collapse completed batch input where helpful. |
| ZIP batch | **Clear** was removed in the revision, leaving no way to remove a staged file or cancel its scan. The native empty file picker can be confused with the staged list. | **Resolved in the reference:** each staged file has **Remove** or **Cancel scan**, and the list is labelled **Files awaiting addition**. Remaining: recalculate readiness after a removal (behaviour, not visible in a static reference). |
| Huddle | The comment box has no visible submission action; the dark comment field differs from other inputs. | Add **Post comment** with a saved state; collapse activity/people panels to give the decision room. |
| Runs | Blocked tests appear only in the detail area; trigger controls are duplicated; selection styling resembles failure styling. | Show blocked counts in the summary and table. Keep the read-only execution model. |
| Settings | The Connections tab repeats Policies and Access, which have their own tabs; **Test connections** and **Test all** compete. | Summarize and link instead of repeating; explain each test action's scope. |
| Test identities | Expected entitlements appear while the entitlement source says not connected. | Explain entitlement provenance; show owner and recovery steps behind Fix/Rotate. |
| Test data | After the revision, **Blocking tests** sits below the full-width code example. Whether **Available** excludes reservations is undefined. | **Partly resolved in the reference:** Blocking tests and Reserved right now now come before the code example. Remaining: define whether **Available** excludes reservations; show request owner, status and the route back to readiness. |
| Skills | **pending** is styled green; **Add skill** and **Promote** are both red; the promotion-gate result is not summarized. | Neutral pending style; one primary action; mark required vs informational checks; show affected applications. An informational pending metric need not block promotion. |

### Prompt studio

Keep the locked policy layer, visible instruction order, and sample comparison with checks and token use.

1. **Resolved in the reference: PR prerequisite.** The checklist says full evaluations have not run, **Open PR** is disabled, and **Run evals on golden dataset** is the primary action. The blocker now links to that action (**Run evals**). Backend enforcement untested.
2. **P1: Tie results to the exact draft.** Show the evaluated draft revision, baseline commit and sample or dataset version in the result summary. After edits, mark older results **For an earlier revision** and offer a rerun. The reporting update now specifies immutable evaluated-input snapshots, draft hashes and dataset/sample versions in [DATA_MODEL.md](DATA_MODEL.md) and M7 of [BACKLOG.md](BACKLOG.md). This resolves the specification gap; implementation and the visible stale-result state remain open. Sample success cannot substitute for full evaluation, and PR readiness stays distinct from promotion readiness.
3. **P2: Show what a check proves.** Make check rows expand to the relevant assertion or evidence. Replace the truncated sample-task selection with a readable summary.
4. **P2: Give editing and comparison room.** Offer focused editing and an expandable output diff; keep sample controls and readiness near the editor; move draft history to a separate or collapsible view while keeping its search, filters and pagination.
5. **P2: Make the PR scope reviewable.** Preview the exact skill files, changes and affected bindings or apps. State whether session instructions are excluded or proposed for the library. Base-policy ownership and access stay under [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) item 15.

### Backlog follow-ups

[BACKLOG.md](BACKLOG.md) carries the original findings as "UX" items. These follow-ups have now been added to it under the milestones shown:

| Milestone | Item | Done when |
|---|---|---|
| M0 | Global search and `/` commands (specified in [SCREENS.md](SCREENS.md)) | Supported searches and commands, keyboard entry and exit, results and no-results states are defined and respect application access, or the feature is explicitly deferred and the visible affordance adjusted. |
| M2 | Scan review and staged-file recovery | Reviewing configuration is separate from starting a scan; a staged ZIP can be removed or its scan cancelled without losing other inputs; suggested roles have a confirm or correct route. |
| M1, M2, M6 | Durable ingestion, scan and crawl recovery | See finding 8 above. The backlog names recovery only for scans. |
| M3 | Approval freshness | See finding 1 above. |
| M6 | Blocked-test recovery and data meaning | See Test data above. Entitlement and provisioning integrations stay unresolved. |

### Downloadable reports: required addition

**P1 product requirement, implementation pending:** all important reports must be downloadable. The earlier references exposed only an Octane sheet, a format-unspecified Compare report and User stats CSV. The references now include shared download entry points and the Download report dialog described below; working file generation is still pending.

| Output | Required download |
|---|---|
| Acceptance and regression test cases | Excel (.xlsx), including ordered steps, expected results, state, revisions and citations. Keep the signed-off-only Octane import template separate. |
| Coverage, gaps, scan comparisons and execution results | PDF and standalone HTML, plus Excel detail. Preserve snapshots, denominators, missing-evidence states and blocked counts. |
| Review decisions and UAT sign-off | PDF/HTML evidence record and Excel register, with reviewed version, signer, time and remaining hand-offs. |
| Journeys, context/decisions and test readiness | PDF/HTML summary and Excel detail, with observation labels, source versions and recovery status. Exclude credentials and raw test records. |
| Skill/prompt evaluations and usage | PDF/HTML reports and Excel detail; retain CSV for usage. Bind evaluations to exact draft/dataset versions and apply existing role visibility. |

Use one secondary **Download report** action with report-specific formats, explicit selected/filtered/full-scope choices, counts across all pages and an as-of/version preview. Show queued, generating, ready, failed, cancelled and expired states with Recent downloads so users can leave and return. PDF must be legible and selectable, HTML must open offline, and Excel must preserve complete test steps and source links. Downloading must not imply approval, Octane import or Harness execution.

The complete catalogue and acceptance checks are in [REPORTS.md](REPORTS.md). [PRODUCT.md](PRODUCT.md), [SCREENS.md](SCREENS.md) and [BACKLOG.md](BACKLOG.md) now carry this requirement, with storage, metrics and access rules in the corresponding technical documents. Sign-offs and prompt evaluations now have immutable source-snapshot contracts so a report cannot substitute later edits for approved/evaluated content. Shared export foundations belong in M0; each report ships with its feature milestone. The static references now show a secondary **Download report** action on Regression, Acceptance, Review (**Download review record**), Compare, Runs, Journeys, App context, Huddle, Test identities, Test data, Skills, Prompt studio and User stats; Acceptance's Octane action is renamed **Export Octane import sheet** and kept separate. [DownloadReport.html](../design/html/DownloadReport.html) shows the shared dialog (report type, format, selected/filtered/full scope with counts, as-of preview) and Recent downloads with generating, ready, failed and expired states. Remaining: dialog variants per report, the Octane eligibility preview, empty/limit/access-denied states, and working file generation.

#### Follow-up on SCREENS.md and the new dialog

The 19 entries in [SCREENS.md](SCREENS.md) each have light/dark HTML and PNG files. The new [light](../design/screenshots/DownloadReport.png) and [dark](../design/screenshots/Dark-DownloadReport.png) download dialogs clearly group report type, format, scope, file contents and Recent downloads. Keep the explicit cross-page count, retry-same-snapshot action and separation from Octane import.

Remaining reference refinements, now specified in SCREENS.md. **Update:** the quick fixes marked *Resolved in the reference* below were applied afterwards and verified in the browser at 1440×900, 1280×600 and 390×700; Generate, Close and the close icon stayed in view at all three sizes.

- **Keep Generate visible** *(Resolved in the reference: the dialog is limited to the viewport, its body scrolls, and the footer stays visible)*: the footer and Generate PDF action sat below the captured viewport in both earlier PNGs. The overlay has scrolling in the HTML, so this is a visibility issue in the supplied view, not proof of an unreachable control. Use a viewport-constrained dialog with a scrolling body and visible footer; verify short-height, zoom and keyboard operation.
- **Complete interaction variants:** selecting Test cases must restrict the format to XLSX and update counts, sections and the Generate label. Include the Octane eligibility preview, queued/cancelled jobs and empty/access/limit errors. Preserve the invoking screen's context and return focus on Close.
- **Clarify scope and policy** *(Resolved in the reference: the preview says "11 gaps in scope" and labels coverage "Whole application, for comparison"; the retention value is visibly marked illustrative)*: the preview mixed 11 filtered gaps with 27/38 whole-app coverage; label the latter as a whole-application comparison. The seven-day retention is only a sample value while open question 16 remains unresolved; label it visibly as illustrative or use configured policy copy.
- **Finish dialog accessibility** *(Partly resolved in the reference: Recent downloads actions and the Test identities/Test data download buttons are 44px; the footer reads **Close** and job actions read **Cancel export**; Review's Tests tab has **Download test cases**. Remaining: focus containment, Escape, restored focus and status announcements, which need a working dialog)*: Recent downloads actions had a 36px CSS minimum height; raise their interactive targets to 44px. Specify focus containment, inert background, Escape/Close, restored focus and accessible status announcements. Name dialog dismissal **Close** and job cancellation **Cancel export**.

SCREENS.md now also spells out each screen's report choices, selected-versus-filtered defaults, changed-source previews, Ready versus Downloaded, immutable sign-off/evaluation states, separate scan review/start actions and the conditional GitHub approval path. These are specification updates; the HTML/PNGs were not changed in this follow-up.

#### Additional refinements after the dialog update

The latest light-theme DownloadReport PNG shows Generate PDF and Close in the footer within the captured viewport. The points below are additional recommendations, not claims of runtime defects. Keep them proportionate to the POC.

| Area | Observation and recommendation |
|---|---|
| Recognizing a saved report | **Demonstrated:** ready report cards now include snapshot/scope, absolute timestamps and predictable filenames. Carry the same naming and record-unit contract into the production service. |
| Recovering an expired report | **Demonstrated:** the preview separates **Regenerate original report** from **Create updated report**, with an updated-data preview before generation. Production must disable original recovery when the original evidence is unavailable. |
| Matching companion formats | **Demonstrated:** ready coverage cards offer **Another format, same snapshot**. Companion previews retain the snapshot ID; the actual sample PDF, HTML and XLSX share one frozen fixture. Production must enforce this through immutable datasets and current authorization. |
| Repeated Generate actions | **Demonstrated:** submission disables Generate immediately; equivalent pending/ready example jobs are reused and identified. Backend idempotency and atomic equivalent-job creation remain implementation requirements. |
| Reviewing the actual files | **Delivered:** a multi-sheet test-case workbook and coverage Excel/PDF/HTML examples contain long text, ordered steps, missing evidence and source links. The five-page PDF and offline HTML are inspectable; fixture, generator, validator and artifact hashes are included in the sample pack. |
| Report reading order | Make the opening summary answer the reader's task: what was assessed, the result, unresolved gaps/blockers and the next owner/action where recorded. Follow with traceability and full detail. This can use deterministic templates and recorded facts; do not invent conclusions or owners. Keep comparisons tied to compatible scopes and snapshots. |
| Repeat use | As a later refinement, remember the user's preferred format per report type. Recalculate scope from the current selection/filters and show it every time; do not silently reuse a previous application's scope. If Recent downloads grows, show a few entries and an explicit history view instead of lengthening the creation form indefinitely. |

The strongest next validation is a complete walkthrough from a filtered requirement list to an exported workbook/report and back to its cited Matrix evidence.

#### Implemented in the design hand-off: report refinements and Stop processing

- **Report interaction preview:** [DownloadReport.html](../design/html/DownloadReport.html) and its dark variant now demonstrate immediate submission feedback, duplicate-job suppression, original versus updated report recovery, filenames and companion formats from the same source snapshot. Test-case format selection restricts output to XLSX. These are local simulated jobs; production generation, authorization and persistence are pending.
- **Actual sample files:** [Report samples](../design/report-samples/index.html) includes a test-case workbook, a coverage workbook, a multipage PDF and offline HTML from one frozen illustrative fixture. The sample application is explicitly different from the dialog fixture; these files demonstrate output quality, not live bank results. The fixture, generator and checksums accompany them.
- **Stop processing:** [WorkflowProcessing.html](../design/html/WorkflowProcessing.html) and its dark variant demonstrate Acceptance and Regression processing, an acknowledged stop, settlement of in-flight work, retained results and continuation as a new linked attempt. The original workflow screens link to the preview; their existing waiting-for-review state is not falsely labelled running.
- **Worker contract:** [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md) specifies atomic stop fencing, idempotency, completion races, in-flight effects, permissions, preserved outputs and partial-snapshot semantics. Stopping Matrix processing never stops Harness/HyperExecute, removes PRs or undoes completed decisions. This contract is linked into the product, screen, architecture, data-model, security, metrics and backlog documents.
- **Validation scope:** browser checks pass for report format restriction, existing/new-job deduplication, original/updated recovery, companion snapshot identity and focus containment. Generate/Close remain visible at 1440×900, 1280×600 and 390×700. Workflow checks cover stopping, preserved work, linked continuation, keyboard operation and narrow layouts. Both workbooks pass OOXML/internal-link checks and LibreOffice open/resave; all 19 test steps are retained. The five-page PDF has selectable text; HTML loads offline with working anchors and no external requests. Artifact regeneration is byte-identical in the checked environment. See [sample validation results](../design/report-samples/validation.json). These checks do not establish backend cancellation or production export correctness.

The five additional report recommendations above now have concrete preview/artifact examples and implementation contracts. Personal format preferences and extended history navigation remain optional later refinements.

**Light/dark parity follow-up:** Acceptance and Regression were checked separately in both themes for Running → Stopping → Stopped, retained results, checkpoint continuation and matching navigation. The report dialog's format restrictions, duplicate prevention, focus containment and visible mobile actions were checked in both themes. A theme switch is now inside each dialog header. Twelve [workflow state captures](../design/screenshots/states/) cover the two workflows, two themes and three states; the two primary report-dialog PNGs show the viewport-sized modal. These remain local preview checks, with no backend jobs connected.

### Priorities

1. Reconcile coverage figures, selected views, badge scope and pagination with the visible records (findings 4 and 11).
2. Finish Review approval semantics and the Acceptance sign-off, export and hand-off states (findings 1 to 3).
3. Attach Prompt studio results to immutable draft and dataset versions (now specified in [DATA_MODEL.md](DATA_MODEL.md); show them in the result summary).
4. Define test-data availability versus reservations and the data-request route back to readiness.
5. Shorten the hero copy, fix the remaining dark-theme small-text contrast, and neutralize the Skills pending state.
6. Design the remaining download states and the Octane eligibility preview, then implement the shared download journey and each milestone's report formats, verifying scope, complete test steps, consistent metrics and access restrictions against [REPORTS.md](REPORTS.md).

## What to retain

- **Distinct workflow entry points.** Acceptance starts from release changes; Regression starts from the application. This matches users' different reasons for visiting Matrix.
- **A familiar workspace.** Sidebar navigation, breadcrumbs, predictable cards and list/detail views suit recurring enterprise work.
- **Evidence close to decisions.** The requirement summary in Review and proposer/reason/impact structure in Huddle are useful foundations.
- **Consistent table controls.** Keyword search, column filters and pagination are already specified. Keep this shared contract as the application grows.
- **Useful status distinctions.** Runs explicitly separates blocked tests from failures. App context surfaces conflicts and failed sources instead of presenting everything as healthy.
- **A coherent visual system.** IBM Plex Sans/Mono, restrained surfaces and light/dark tokens are appropriate. Most body and muted text colors have good contrast; the exceptions below are specific.

## Matrix icon and wordmark

**Assessment:** Keep the current direction. The three-by-three rounded-square grid looks orderly and appropriate beside the IBM Plex wordmark in the light and dark Workspace screenshots. The grid connects naturally to the name Matrix; the single red cell can suggest a coverage gap needing attention. This is a design interpretation, not evidence that users already understand that meaning.

The main weakness is distinctiveness: a nine-square grid also resembles an app launcher. The wordmark currently provides much of the identity. A complete redesign is not necessary for the POC.

**Recommended exploration:** retain the grid and test an outlined red cell in the same middle-right position, with eight solid cells around it. This could make the idea of a gap more explicit and preserve a difference in monochrome. Use a sturdy outline; compare the candidate with the current filled cell at actual 16px, 24px and 32px sizes. Retain a filled-cell small-size variant if the outline becomes unclear.

Keep the wordmark beside the icon in the landing header and expanded sidebar. In dark mode, test a brighter red for the accent cell so it retains visual emphasis alongside the light cells; preserve the brand red in the light version. Package the eventual choice as a shared SVG with light, dark and monochrome variants. These are proposals only; the existing icon has not been changed.

## Landing page layout recommendations

**Overall assessment:** The landing page has a strong visual foundation, particularly its first screen. The large headline on the left and product preview on the right establish a clear reading order. The whitespace, IBM Plex typography and restrained red accents suit an enterprise testing product. Keep this direction and refine the pacing and hierarchy further down the page.

These comments refer to [Main.png](../design/screenshots/Main.png) and [Main.html](../design/html/Main.html). They are design recommendations to validate, not measured conversion or usability results.

### What to preserve

- The split hero: a clear proposition beside a concrete view of the product.
- The white/red identity, generous margins and strong heading hierarchy.
- The distinction between Acceptance and Regression, including their hand-off.
- The visible SSO entry point and a closing action that brings users into the workspace.

### Recommended refinements

| Priority | Area | Recommendation | Reason |
|---|---|---|---|
| P2 | Hero | Shorten the supporting paragraph to the problem, outcome and next step. Keep integration details further down. Reduce the visual prominence of the acronym explanation and dotted background behind text. | The headline and product preview should receive attention before terminology and supporting detail. |
| P2 | Product preview | Give the preview more usable width and simplify its contents to a few readable requirements, their coverage states and one next action. Use the actual product design as it develops; keep sample data clearly illustrative. Avoid shrinking a full dashboard into an unreadable thumbnail. | The preview can demonstrate how a user finds and acts on a gap, making the proposition more concrete. |
| P2 | Page length | Retain the removal of the repeated capabilities section. Further tighten the problem statement, integrations and personas where they repeat the hero or workflow. Keep generous spacing between major ideas, with smaller gaps inside related content. | The revised page is about 16% shorter; further changes should improve reading order without removing useful adoption information. |
| P2 | Workflow explanation | Replace the two dense numbered text columns with a compact diagram showing two independent paths and their connection. Keep a short description under each step. | The relationship between Acceptance and Regression is a product differentiator and deserves more visual emphasis. |
| P2 | Section variety | Use a small number of deliberate formats: hero preview, workflow diagram, concise capability rows, integration strip and compact trust statements. Keep cards where items need comparison or a distinct action. | Changing the presentation to match the content improves hierarchy and avoids making every section look equally important. |
| P2 | Supporting information | Present integrations in a compact strip grouped by their purpose. Reduce each persona to its main task and benefit. Keep governance near the closing action, with links to detailed policies. Give planned capabilities less prominence than available functionality. | Supporting information should answer adoption questions without competing with the core product story. |
| P2 | Calls to action | Keep one dominant action in the hero and repeat it at the end. Make “See how it works” visually secondary and link it to the workflow section. Use authentication-aware labels so “Open workspace” and “Sign in with SSO” have a predictable outcome. | Users should understand how to start and what the next screen will be. |

### Suggested page sequence

1. **Hero and readable product preview:** what Matrix helps users accomplish, with one primary action.
2. **Brief problem statement and workflow diagram:** why coverage gaps occur, then how each workflow addresses them.
3. **Core capabilities with product evidence:** a short set of outcome-led explanations, using selected UI details where they clarify the task.
4. **Adoption information:** compact integrations, persona benefits and governance statements.
5. **Closing workspace action and footer.**

For the workflow diagram, show Acceptance starting from a Jira release or sprint and Regression starting from an application. Connect them through signed-off acceptance tests joining regression when the release ships. Preserve the manual Octane import step and Git-triggered Harness execution; a shorter visual should still explain those responsibilities accurately. The detailed hand-off decisions remain open as described in finding 3 below.

On smaller screens, stack the hero copy and preview, keep the primary action easy to reach, and turn the workflow paths into readable vertical sequences. Reduce the amount shown in the preview before reducing its text size. Apply the dark-theme contrast and interaction requirements from findings 6 and 7.

**Next refinement:** the repeated lower-page content has already been reduced. Give the product preview more prominence and make the workflow relationship visual. These changes should improve the page's pacing while preserving its existing identity. Validate whether a first-time visitor can explain what Matrix does, choose the relevant workflow and identify how to begin.

### Visual direction to prototype

**Make the product's evidence trail the main visual idea.** Show a requirement becoming source-linked tests, a reviewable PR and a recorded Harness result. Carry the same requirement identifier and evidence links through the landing-page example and the application. This gives Matrix a recognizable visual story tied to its purpose.

| Element | Proposed treatment | Detail that makes it useful |
|---|---|---|
| Hero composition | Retain the split layout; start with roughly five columns for copy and seven for the product example on a wide screen. Use a bold two- or three-line heading and a short supporting paragraph. | Keep the example readable at laptop widths. Stack it below the copy on smaller screens. These proportions are starting points to validate, not fixed breakpoints. |
| Interactive product example | Add four selectable stops: **Requirement → Generated test → Pull request → Harness result**. Each reveals a short artifact, its status and the supporting evidence. | Label the content **Illustrative example**. Use actions such as **Preview test** and **Inspect example PR**. Selecting a stop changes the preview locally; it must not appear to start real work. Keep it user-controlled, with no automatic cycling. |
| Workflow section | Use two connected tracks with independent starting points, concise stage labels and clear outputs. Make the release hand-off visually distinct from the stages inside each workflow. | Show manual Octane import and Git-triggered execution explicitly. The same information must remain readable in a vertical layout and without relying on color. |
| Product evidence sections | Use a larger annotated UI detail beside a short explanation: a gap with its source, a test with its expected result, or a review with its revision history. | Give each section one point. Keep essential text as real selectable text; annotations should help users understand the UI rather than add decorative labels. |
| Typography and spacing | Keep IBM Plex Sans for reading and IBM Plex Mono for IDs and technical references. Give headings, requirement titles and test steps clear visual priority; use smaller secondary text for metadata. | Keep generous space between major sections, but tighten spacing within related content. Establish a small shared spacing scale so the site feels consistent. Do not reduce working text or controls to make a layout fit. |
| Color and depth | Use white or dark neutral surfaces, restrained borders and a subtle raised treatment for the main product preview. Preserve brand red for primary actions, green for passed/covered and amber for warnings. | Use labels and icons to distinguish a selected control from an error. Keep positive analytical results visually distinct from red gap indicators. Use the semantic dark-theme tokens already defined. |
| Interaction feedback | Design hover, focus, pressed, loading, saved and error states together. Use brief transitions when opening evidence, changing preview steps or updating a review state. | Start with roughly 120–180 ms for small transitions, then validate. Respect reduced-motion preferences, keep information available without hover, and retain 44px interaction targets. Announce saved or failed actions accessibly. |

**Suggested hero copy to explore:**

> Find the gaps. Review the tests that close them.
>
> Connect requirements to test coverage, inspect the evidence, and review generated tests and automation. Follow Git-triggered execution through Harness, with results linked back to the requirement.

Use **Open workspace** as the primary action and **Explore an example** as a secondary action if the interactive example is implemented. The primary action should explain or perform SSO when needed. This is proposed copy, not a change to the product's agreed tagline.

### Make the working screens feel equally considered

The same visual care should continue after sign-in. Give the current task most of the space: the requirement and evidence when assessing a gap, the expected result when reviewing a test, and plain-language criteria during UAT sign-off. Compress completed pipeline stages into an expandable history and emphasize the current stage, its owner and its next action.

Use a consistent detail-panel pattern for requirement evidence, linked work and revision history. On a narrow screen, open that detail as a full page and preserve the route back to the original list. After a decision is saved, update the remaining count and offer the next eligible item while retaining access to the just-completed decision. This makes repeated work feel deliberate and efficient.

## User journey recommendations

These recommendations describe the intended experience across screens. Implement them within the existing milestones and role permissions; keep unresolved integration and policy choices behind the interfaces specified in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

### From the landing page to the first useful result

| Moment | Recommended experience | Next state and recovery |
|---|---|---|
| Arriving or following a shared link | Preserve the intended destination through SSO. A link to a specific review should open that review with its application and scope visible. | If access is unavailable, explain which application or permission is needed and provide the established access-request route. Preserve the destination for a later return. |
| Choosing work for a new application | Offer **Test this release** and **Find regression gaps**, each with a short explanation and its starting input. Keep Journeys as a supporting route when available. | Open only the setup needed for that workflow. Returning users should be able to continue existing work directly. Do not show unavailable milestones as working features. |
| Completing setup | Show a short readiness checklist for the chosen task: relevant connections, source/context readiness and scope. Distinguish personal credentials from shared configuration owned by an administrator. | Each incomplete item has a direct action and an owner. Preserve completed setup and form input when a credential check fails or the user leaves. |
| Reviewing a new scan | Summarize the application, included components, roles, pinned versions, unresolved warnings and eventual PR or patch delivery. | Start from a clearly ready state, or take the user directly to the blocking input. Explain how partial source availability would limit the result before proceeding. |
| Following progress | Open a durable scan page with a scan identifier, real stages, elapsed time and last update. Let users leave and return without losing context. | Show which component failed and what that means for completeness. Expose supported recovery actions. Use percentages or time estimates only when backed by real progress information. |
| Reaching results | Present the scan scope and completeness, then the gaps that need a decision. Make **Review gaps** the next action and show where the evidence comes from. | Distinguish actionable gaps from work already generating, awaiting review or blocked. Link directly to existing work instead of inviting duplicate requests. |

### From a gap to an informed decision

Keep the selected requirement visible as the user moves through **Gap evidence → Proposed tests → Review → PR → Run evidence**. A requirement detail should combine the authoritative source, existing coverage, why the gap was identified, proposed work and target repository. Let the user return to the same filtered table and position.

Before generation, show the eligible scope and any excluded items. During generation, show its saved state. When it reaches review, open the evidence and generated work together. If a test is rejected, carry the reason into the next revision and highlight the changed assertions for the reviewer. Show a changed source or PR revision explicitly rather than presenting a previous approval as current.

After PR approval, show a clear receipt of what was submitted and where. Keep merge, Harness execution and Octane reporting as separately identified external states. A passing run should link back to the appropriate requirement and snapshot; it should not silently change the meaning of an earlier scan.

### Give UAT a focused completion path

An eligible story should open a reading-focused view with acceptance criteria, reviewed tests, evidence and unresolved issues. Make the sign-off meaning and reviewed version explicit. Once signed off, show the recorded decision and the next eligible action.

Export should be a separate summary of included and excluded stories with reasons. After the download, use a completion message such as **Sheet downloaded. Manual import into Octane remains.** Show the agreed import owner and instructions when those are defined. Keep reviewer assignment and import confirmation as open decisions. The later regression hand-off should link to the receiving work so the user can follow what happened to the signed-off tests.

### Help users return and collaborate

Add a compact **Continue your work** area to existing workflow entry pages. Show a few relevant items such as **Resume scan setup**, **Review changed tests**, **Resolve source conflict** or **View completed Harness run**. Distinguish **Needs you** from **Waiting on others**, with an owner, reason and timestamp. Avoid creating another dashboard that duplicates the Review queue and Huddle.

Notifications should link to the exact decision or result. Reserve attention badges for actionable changes and make their scope clear. A completed hand-off should retain a link to its receiving record. If permissions or prerequisites change, preserve the saved work and explain how to continue.

### Highest-impact changes to make first

1. **Lead with a readable, inspectable product example.** A visitor should understand the evidence trail without reading every section.
2. **Guide the first successful task.** Make workflow selection, readiness and the first result a continuous path.
3. **Keep evidence and decisions together.** Reduce navigation between a gap, its sources, generated tests and review.
4. **Make waiting and completion explicit.** Every important action should show what changed, what remains and who acts next.
5. **Apply the visual system to every interaction state.** Include narrow layouts, keyboard focus, loading, empty, error and recovery states alongside the polished default screens.

Measure these proposals with task completion, time to the first useful result, time to find supporting evidence, recovery success and users' understanding of the next action. Treat visual appeal and journey quality as related goals; do not infer success from screenshots or activity counts alone.

## Original source-based priority findings

These findings record the initial hand-off review. Use the current PNG review above for the latest visual observations; recheck the original HTML line references and source measurements before implementing a fix.

### 1. P1: Make the meaning of approval explicit

**Evidence:** [Review.html](../design/html/Review.html), lines 167, 179 and 218. The page offers **Approve all** while only **1 of 3** tests is accepted. The explanation that approvals are posted to GitHub as the signed-in user is in the footer.

**User impact:** Accepting a generated test and submitting a PR review are different decisions, but the current wording does not establish whether the button performs one or both. A passing dry run also does not establish that the expected results are correct.

**Recommendation:** Separate per-test acceptance from PR-review submission, or explicitly name a combined action, such as **Accept remaining 2 and approve PR**. Place the repository, PR, revision and submission identity beside the action. Show how rejected tests, pending checks and new commits affect readiness. Keep the GitHub redirect variant until the bank resolves approvals outside GitHub in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 13.

**Design acceptance check:** A reviewer can explain the action's effect before clicking and can distinguish test acceptance, PR approval and merge.

### 2. P1: Put assertion-level evidence inside the review task

**Evidence:** [Review.html](../design/html/Review.html), lines 172, 186, 195 and 208, shows a requirement link and short “Covers” descriptions. The design does not show the context excerpts and source versions supporting each test's expected result.

**User impact:** The reviewer can see a coverage claim but cannot efficiently verify its basis. Opening a technical trace is too indirect for routine test review.

**Recommendation:** Add an expandable **Evidence used** section per test: requirement or acceptance criterion, relevant excerpt, source/version, freshness and conflict status, and the expected result it supports. Preserve the compact summary, with technical traces as a secondary route. If evidence changes after generation, show that the test needs review against the new source.

**Design acceptance check:** The reviewer can trace an assertion to its supporting requirement and context without leaving the review flow.

### 3. P1: Complete the UAT sign-off, export and hand-off journey

**Evidence:** [Acceptance.html](../design/html/Acceptance.html), lines 131 and 320–336, provides an export action, sign-off progress, **Open in Huddle**, and **18 tests ready / Go to regression**. The supplied Review detail depicts a regression PR; the supplied Huddle detail depicts an override. The actual per-story UAT sign-off surface is not illustrated.

**User impact:** A central persona lacks a complete task flow. “Signed off,” “exported,” “imported into Octane,” and “ready for regression” can be mistaken for the same state.

**Recommendation:** Design a plain-language story detail with criteria-to-test mapping, unresolved issues, sign-off meaning, signer and version. Include not-ready and changed-after-sign-off states. Before export, show which signed-off tests are included and which are excluded. Show the manual Octane import hand-off and distinguish a downloaded sheet from a confirmed import. Explain release eligibility and link each transferred test to its subsequent automation work.

**Open decisions:** Keep acceptance reviewer assignment as a TODO under [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 11. The exact release hand-off trigger, ownership and import confirmation method also need specification; do not imply an automatic integration that has not been agreed.

### 4. P1: Distinguish test presence from verified coverage

**Evidence:** [Acceptance.html](../design/html/Acceptance.html), line 241, says **Criteria tested** although this workflow creates and reviews cases. [Workspace.html](../design/html/Workspace.html), lines 144–146, labels a KPI **Covered** with an Octane-case subtitle. [METRICS.md](METRICS.md) defines automated coverage using a mapped test that passed in the scan's Harness run.

**User impact:** Written cases can look like execution evidence. Users may compare percentages that represent different stages and denominators.

**Recommendation:** Use **Criteria with test cases**, **Reviewed**, **Signed off**, and **Automated and passing** consistently. Show the numerator/denominator, relevant scan and run, verification time and environment where applicable. Include **Awaiting execution evidence** rather than implying zero or verified coverage when a scan has no qualifying run. Retain the useful denominator-change explanation in Compare.

**Also reconcile sample data:** [Compare.html](../design/html/Compare.html), lines 140 and 154, shows 15/34 automated requirements but 23 open gaps. If gaps count uncovered requirements, that baseline is 19; if they count separate findings, name the different unit. Acceptance shows 38/41 criteria with cases, yet two zero-test stories have four and three criteria and another has one untested criterion. Use one coherent fixture for the next design revision. These are prototype consistency issues, not verified calculation defects.

### 5. P1: Keep observed journeys visibly separate from expected behaviour

**Evidence:** [Explore.html](../design/html/Explore.html), lines 148–150 and 170, offers **Write a negative test** and **Write manual tests**. The access finding says “The rules say it should not” without identifying the rule. The explicit **observed** badge appears on the separate [App context](../design/html/Context.html) source row, line 169.

**User impact:** Users could interpret discovered behaviour or reachability as an approved business rule or permission.

**Recommendation:** Label journey evidence **Observed behaviour** on the Journeys screen and in test previews. Include environment, crawl time, role and evidence. For an expected outcome, link the authoritative requirement or entitlement rule. If none is available, route the finding to a decision before presenting it as an established expectation. Explain incomplete role coverage and unreachable journeys without implying that the functionality is absent.

The entitlement source remains unresolved under [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), item 8.

### 6. P1: Bring controls and keyboard states up to the project's accessibility rules

**Evidence:** [Workspace.html](../design/html/Workspace.html) uses 22×22px filter-removal controls at line 240, 16×16px selection checkboxes at lines 246 and 258 without enlarged labels, and 40×40px shell controls at lines 117–118. [Review.html](../design/html/Review.html), lines 198–199, uses 32px decision/edit controls. The project requires targets of at least 44px.

Search inputs remove outlines without a replacement focus treatment in [Workspace.html](../design/html/Workspace.html), lines 109 and 237. Its sorting arrows are inside plain table headers, and the selected gap-view buttons rely on visual styling.

**Recommendation:** Provide at least 44×44px interactive areas, while retaining compact icon artwork where useful. Specify visible focus, keyboard-operable sorting, announced sort direction, selected tab/view states, and focus movement into and out of dialogs or detail panels. Preserve the accessible labels already present. Apply these requirements to shared components in M0.

**Design acceptance check:** The implemented flow can be completed by keyboard with visible focus, named controls and understandable state changes. This still needs actual assistive-technology testing.

### 7. P1: Use semantic text colors consistently in dark mode

**Evidence:** Small labels and workflow numbers in [Dark-Main.html](../design/html/Dark-Main.html), including lines 44, 142, 156 and 212, use raw brand red. Calculated contrast:

| Foreground / background | Contrast | Comment |
|---|---:|---|
| `#C8102E` / `#17191D` | 2.99:1 | Below the project's 4.5:1 text requirement |
| `#C8102E` / `#0F1012` | 3.24:1 | Below the text requirement |
| `#FF6B7D` / `#17191D` | 6.41:1 | Existing dark accent-text token works |
| White / `#9AA1AC` | 2.60:1 | Low-contrast avatar initials in Dark-Huddle and Dark-Stats |

**Recommendation:** Use `--accent-text` from [tokens.css](../design/tokens.css) for dark-theme text and keep brand fill colors separate from text colors. Adjust avatar foreground/background pairings. Check focus, hover, warning, disabled and selected states in both themes. The body-text palette does not need a wholesale replacement.

### 8. P1: Show readiness and recovery before starting long-running work

**Evidence:** [NewScan.html](../design/html/NewScan.html), lines 185–187, says one component needs confirmation while showing **Review and start**. [NewScanZip.html](../design/html/NewScanZip.html), lines 169–172, shows one ZIP still scanning beside **Add 2 to scan**; lines 202–205 show zero automation components beside the start-related action. Step two is named but has no supplied detail design. [SCREENS.md](SCREENS.md) already acknowledges missing loading and error states.

**User impact:** The hand-off does not establish whether these actions advance to review, start work, or wait for prerequisites. A user may only discover a blocker after completing a long form.

**Recommendation:** Distinguish **Review scan** from **Start scan**. Design a readiness summary showing component roles, immutable versions, unresolved confirmations, permission checks and PR versus patch delivery. Let users review incomplete input, but explain which blockers prevent execution and link directly to their resolution. For ZIP automation, state explicitly that delivery is a patch and no Harness run follows from Matrix.

For scans, crawls and ingestion, specify queued/running/partially completed/failed states, progress, last update, saved work and the supported recovery action. Preserve inputs after PAT or quota failures; offer retry only where the operation supports it. ZIP size and retention values remain policy TODOs.

### 9. P2: Give the main work area more room

**Evidence:** In [Workspace.png](../design/screenshots/Workspace.png), requirement IDs wrap, longer requirements occupy several lines, and filter values are truncated. Sources, Huddle and Last run compete with the main table in a secondary column. [Compare.png](../design/screenshots/Compare.png) and [TestData.png](../design/screenshots/TestData.png) show right-edge table/filter content cut off in the initial view; horizontal scrolling is provided in the reference.

**Recommendation:** Prioritize table width, keep short IDs unbroken, and provide practical minimum widths for filters. Move secondary information below the main task or into a collapsible panel. Keep search, column filters and pagination as required; improve their layout rather than removing them. Use clear overflow affordances and consider sticky identifiers for wide tables.

Specify laptop and zoom layouts: collapsed sidebar, stacked/current-stage pipeline, and a queue-to-detail pattern on narrow screens. The current four-stage pipeline has an 820px minimum width in [Workspace.html](../design/html/Workspace.html), line 174; horizontally scrolling a data table should not be the only responsive strategy for the entire workflow.

### 10. P2: Clarify scope and make the next action reflect current work

**Evidence:** [Workspace.html](../design/html/Workspace.html), lines 29 and 127, combines a release-bearing selector with **Regression · whole application**. Its **Write automation for 11 gaps** action at line 133 remains visible when line 204 says automation for three gaps is already in an open PR. [Huddle.html](../design/html/Huddle.html), line 183, says an accepted override removes a gap from one release and returns it in another.

**User impact:** Users cannot readily tell whether an action affects the application, a release, selected rows or every filtered gap. Existing work might appear eligible for generation again.

**Recommendation:** Separate application scope from release scope and show which scope each workflow uses. Preview an override's effect on release eligibility and coverage without implying that it rewrites historical snapshots. Expose **Ready to write**, **Generating**, **In review** and **Blocked** states. Show the eligible and selected counts beside bulk generation; link existing work to review. Distinguish **Rescan current configuration** from **New scan configuration** in the adjacent entry points.

### 11. P2: Finish the table and sample-state contract

**Evidence:** The selected **Gaps** view includes a **Covered** row in [Workspace.html](../design/html/Workspace.html), lines 228 and 314. Acceptance's **Needs action** view includes a signed-off story. [Huddle.html](../design/html/Huddle.html) displays five cards while its footer at line 168 says **1–4**. Several numeric columns have no filter in their reference filter row, including Steps in [Explore.html](../design/html/Explore.html), line 169.

**Recommendation:** Derive sample cards, tabs, rows and pagination from a consistent fixture. Specify range filters for meaningful numeric/date columns and clarify exceptions for non-data action columns. Define how keyword, tab and column filters combine; reset invalid page positions; and state whether selection spans pages or all matching results. Implement URL-backed filter state as already required by [SCREENS.md](SCREENS.md).

**Design acceptance check:** The displayed count, active filters, available actions and visible rows tell the same story, including no-results and partially selected states.

### 12. P2: Make analytical colors and scores unambiguous

**Evidence:** Compare uses red for positive Matrix contribution, including **+24 pts** and the chart series ([Compare.html](../design/html/Compare.html), lines 143–145 and 162). Red elsewhere means gaps or attention. App context displays unexplained scores such as 0.91 and 0.87 alongside conflicting sources, while saying those sources will not be used ([Context.html](../design/html/Context.html), lines 138 and 198–217).

**Recommendation:** Keep brand red for primary actions, but distinguish attribution from status through consistent labels and chart treatments. Label retrieval scores as relevance, not confidence or correctness. Show **Eligible for generation** versus **Excluded: unresolved conflict**, with a direct link to the decision. Move infrastructure details such as MongoDB and embedding counts into diagnostic detail unless needed for the user's task.

Compare already has a useful chart summary. Add an accessible **View chart data** alternative for exact per-scan values currently held in bar `title` attributes; the module table answers a different question.

## Additional screen-specific comments

| Area | Comment and recommended design change |
|---|---|
| Landing page | [Main.html](../design/html/Main.html), line 46, says Matrix executes tests. Align explanatory copy with Git-triggered Harness execution, for example “Writes tests and tracks their execution through Harness.” Review the “Runs them” tagline against that ownership boundary. |
| Regression pipeline | Distinguish PR validation from post-merge regression. [Workspace.html](../design/html/Workspace.html), lines 215–217, says execution starts after merge while Review already shows a PR dry run. Both can exist; the UI should identify each run and its trigger. |
| Runs | Preserve the read-only explanation and failure groups. Surface blocked counts in the run summary/table as well as the expanded triage area, and make **Request data** lead to a tracked request with an owner/status. Do not introduce a Matrix rerun action. |
| Huddle | Keep proposer/reason/impact. Add a visible submit action for the comment field, which currently ends at a textarea ([Huddle.html](../design/html/Huddle.html), line 188). Show decision ownership, resolution and links back to affected work. Distinguish a discussion comment from acceptance of the decision. |
| Settings and first use | Design Settings → Personal in M0, as the backlog requires. Show PAT entry/replacement/removal, last four characters, expiry and validation feedback, plus System/Light/Dark selection. Explain personal credentials versus shared application connections. Include a first-app path to connect sources and start a scan. |
| Roles and User stats | Provide explicit admin/stream-owner and ordinary-user variants. The references use a QA persona even on admin screens; this is a missing role variant, not evidence of an access-control defect. Named usage and CSV export need the same visibility rules. Add the adoption/coaching purpose statement from [SECURITY.md](SECURITY.md), and retain the HR decision as a TODO. Avoid styling personal acceptance rates as performance grades. |
| Skills | Before **Promote v4**, show affected apps, exact version, eval evidence and which bindings will change. Design the post-promotion result and rollback path already requested in the backlog. Keep detailed traces behind the decision summary. |
| Test identities | The failed-sign-in and expiring-password states are useful. Add an owner and a specific recovery action, with the relevant environment visible. Clearly distinguish last successful authentication from current availability. Keep the entitlement-source choice unresolved. |
| Test data | Explain whether “Available” includes reserved records. Design request/provisioning progress and reservation details, including release/expiry behaviour, so a blocked test has a clear route back to readiness. Keep the provisioning/team choice behind the open integration decision. |

## Suggested implementation order

Follow [BACKLOG.md](BACKLOG.md); incorporate these revisions into the existing milestones rather than creating a parallel redesign project.

1. **M0:** Shared controls, focus and contrast; responsive shell/table contract; Personal settings and role variants.
2. **M1–M2:** Evidence eligibility and conflicts; scan readiness/recovery; explicit scope and coverage vocabulary.
3. **M3–M4:** Assertion evidence, approval semantics, generation eligibility, execution states and consistent metrics.
4. **M5–M6:** Complete UAT sign-off/export/hand-off flow; observed-journey boundaries; identity and data recovery tasks.
5. **M7:** Promotion impact/rollback and appropriately scoped usage reporting.

## Validate the revised designs with task walkthroughs

Before treating these designs as complete, walk representative QA, UAT and administrator users through these tasks:

- Add an app, resolve a missing PAT or unconfirmed component, start a scan, leave and return to its progress.
- Explain a coverage figure and find the source/run evidence behind it.
- Review one correct and one incorrect generated test, then explain exactly what PR approval will submit.
- Sign off a story, export only eligible tests, identify the manual Octane step, and locate its regression hand-off.
- Assess an undocumented journey without treating observed behaviour as the expected result.
- Resolve a blocked test caused by an identity or data issue without looking for a Matrix rerun button.

Repeat the core review and table tasks with keyboard-only input, increased zoom, and light/dark themes. Record task success, wrong turns, time to find evidence and misunderstandings of action scope. These checks remain future validation work; this review does not claim user-test results.
