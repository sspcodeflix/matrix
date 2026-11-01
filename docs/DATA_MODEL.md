# Data model (MongoDB)

All documents carry `appId` where relevant, `createdAt`, `updatedAt`. IDs are strings unless noted. This is a starting schema; refine during build.

## Applications and components
**cios** `{ _id, name, orgUnit, source: { system, ref } }` (the owner holds the application-to-CIO roll-up; agents ask for it when implementing, see CLAUDE.md)

**apps** `{ _id: "ABCD", cioId, name, knowledgeOsRef, confluenceSpace, jiraProject, modules?: [..] }`

**workspaces** `{ _id: "App-abcd-web-ui", appId: "ABCD", label: "web-ui", octane: { sharedSpaceId, workspaceId }, jira?: { components?: [..], labels?: [..] }, octaneTestSet? }`

A workspace is also called a component (e.g. `App-abcd-web-ui`, `App-abcd-api`) and is the Octane workspace. The sidebar chooses the application; the top right chooses a workspace within it, or **All workspaces**.
- **Regression is application-level:** scans, gaps and KPIs cover every workspace of the application; choosing a workspace narrows the view. Every test case and automation script it writes belongs to one workspace (`workspaceId`).
- **Acceptance is workspace-level:** stories, test cases, automation, tags, sign-off and the Octane import sheet all belong to one workspace.

The `components` collection below holds code repositories and ZIP uploads found by a scan, not workspaces. Each may carry the `workspaceId` it belongs to.

**components** `{ _id, appId, name, role: "source"|"automation", type: "web"|"api"|"library"|"automation", frameworks: ["selenium","karate"], origin: "discovered"|"git"|"zip", discovery: { method: "custom_property"|"topic"|"name", confirmed: bool }, repoUrl?, ref?, commit?, zip?: { fileName, sha256, nasPath, expiresAt }, envUrls?: { sit, uat }, specUrl?, authMethod?, workspaceId? }`

## Scans (regression) and snapshots
**workflow_jobs** `{ _id, appId, workflow: "acceptance"|"regression", scope: {releaseId?, scanId?, storyIds?, requirementIds?, componentIds?}, startedBy, attemptId, parentAttemptId?, state: "queued"|"running"|"stop_requested"|"stopping"|"stopped"|"completed"|"failed", stage, version, fenceToken, childJobIds: [..], stop?: {requestedBy, requestedAt, acknowledgedAt?, stoppedAt?}, checkpointRef?, retainedOutputRefs: [..], inFlightEffects: [{operationId, kind, dispatchedAt, state, externalRef?}], completeness: {planned, completed, unprocessed, failed, unit}, lastHeartbeat, recoveryOwner?, errorCode? }`

State changes use an atomic version/fence check. Persist the stop fence before acknowledging it; a stale worker cannot dispatch new model/tool calls or external writes. Stop bookkeeping and reconciliation of previously dispatched effects remain permitted. An unresolved external outcome stays **Stopping** with an owner; a completion already committed wins the race. Completed outputs and decisions survive stopping. Continuation is an authorized new linked attempt using a supported checkpoint after validating source versions and permissions. See [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md); these jobs never control Harness/HyperExecute execution.

**scans** `{ _id: "S-022", appId, mode: "auto"|"manual", components: [{componentId, commit|sha256}], startedBy, startedAt, status, snapshot: { totalFRs, automatedFRs, matrixAutomatedFRs, gaps: {noTest, notAutomated, stale}, harnessRunId } }`

**requirement_status** (per scan) `{ scanId, appId, workspaceIds: [..] /* workspaces holding its tests; empty for an unassigned gap */, frId, module?, channel: "ui"|"api"|"batch", status: "covered"|"awaiting_evidence"|"no_test"|"not_automated"|"stale"|"override" /* covered only when a mapped test passed in the scan's own Harness run */, octaneCases: [..], automatedTests: [{testId, matrixWritten: bool, passed: bool}] }`
The snapshot is what Compare scans reads. Save one for every scan, including a stopped scan. Include snapshot completeness and the associated job/attempt; partial snapshots list unprocessed scope and are excluded from normal whole-application coverage deltas.

## Acceptance
**releases** `{ _id, appId, jiraFixVersion, sprint? }`
**stories** `{ _id: "PAY-1482", workspaceId, releaseId, revision, contentHash, title, acceptanceCriteria: [{id, text}], status: "not_started"|"awaiting_review"|"criterion_untested"|"no_ac"|"signed_off" }`
**test_cases** `{ _id: "TC-0218-01", appId, workspaceId, revision, contentHash, workflow: "acceptance"|"regression", sourceRef: {type: "story"|"fr", id}, covers: "criterion text", steps: [..], expected, state: "draft"|"accepted"|"rejected"|"edited", tags?: [{name: "smoke"|"regression"|"sanity"|"e2e"|..., source: "suggested"|"confirmed"}], priority?, writtenWith: [{skill, version, commit}], sessionSkill?: {...}, citations: [chunkId] }`
**test_case_sets** `{ _id: "<storyId>:<draft>", appId, workspaceId, storyId, storyRevision, generationId, outputRevision, outputHash, draft, cases: [{testId, revision, contentHash, state, rejection?: {reason, note}}], acceptance?: { outputRevision, fingerprint, accepted: [testId], excluded: [testId], userId, at } }` (one versioned set per story, shared by the story page and the Review queue. Per-case Accept and Reject are provisional; only `acceptance`, written at the current `outputRevision` after that revision has `generation_feedback`, releases the set to UAT sign-off and automation. Rejected cases are listed in `excluded`. The server enforces the gate; the frontend rule in `frontend/src/features/testcases/` is the reference.)

**automation_drafts** `{ _id, appId, workspaceId, subject: {type: "story"|"fr", id}, generationId, outputRevision, basedOn: { setId, setOutputRevision, cases: [{testId, revision, contentHash}] }, repo: { componentId, branch: "matrix/…", indexedCommit }, pullRequestId?, status: "draft"|"pr_open"|"merged"|"outdated"|"superseded", outdated?: { reason: "test_cases_changed"|"repo_moved"|"skill_changed", detectedAt, changed: [testId] } }` (automation is **outdated** when the accepted set it was written from has a newer accepted revision, or any `basedOn.cases` hash no longer matches. Checked deterministically on every set acceptance; no model call.)

**signoffs** `{ storyId, storyRevision, tests: [{testId, revision, contentHash}], signedOffSnapshotRef, signedOffSnapshotHash, userId, at }`

Content changes create a new revision. The immutable signed-off snapshot preserves the approved story/criteria, full test contents, states and versioned citations; a pointer to mutable current records is insufficient. Retain it independently of disposable download files under the applicable evidence-retention policy. A changed story or test requires renewed sign-off before its new revision is eligible for Octane export; retain the prior decision as historical evidence. Do not reconstruct an old sign-off from current test text. Reviewer assignment remains open question 11.

## Review and code
**review_items** `{ _id, appId, kind: "regression_pr"|"acceptance"|"test_fix_pr", ref: {pr?, storyId?, frId?}, assignee, status, testIds: [..], dryRun?: { harnessExecId, passed, failed } }`
**rejections** `{ reviewItemId, testId, reason: "convention"|"wrong_assertion"|"misread_requirement"|"duplicate", note, userId }` (feeds proposed skill changes)
**pull_requests** `{ _id: 212, appId, repo, branch: "matrix/…", status, testsAdded: [..], mergedAt? }`

## Runs (read-only mirror)
**runs** `{ _id: "4821", harnessExecutionId: "7781", appId, trigger: "schedule"|"pr_opened"|"merge", branch, commit, passed, failed, blocked, durationSec, octaneUpload: "uploaded"|"not_uploaded"|"failed", runId /* Matrix id passed through */ }`
**failures** `{ runId, test, frId, group: "product_defect"|"test_defect"|"environment"|"blocked", evidence: {...}, action: {...} }`

## Huddle
**decisions** `{ _id, appId, release?, type: "override"|"disputed_gap"|"context_correction"|"signoff"|"undocumented_journey"|"source_conflict", subject, proposedBy, reason, impact, status: "pending"|"accepted"|"rejected", comments: [{userId, text, at}] }`

## App context
**sources** `{ _id, appId, type: "knowledge_os"|"confluence"|"documind"|"api_spec"|"pdf"|"word"|"journeys", componentId?, version, status, trustTier, updatedAt, issues: [..] }`
**api_endpoints** `{ appId, componentId, method, path, params, responses, description, specVersion }`
**chunks** `{ _id, appId, componentId?, sourceId, sourceVersion, text, trustTier, piiMasked: true }`
**repo_indexes** `{ _id: "<componentId>:<branch>", appId, workspaceId?, componentId, branch, indexedCommit, headCommit, commitsBehind, indexedAt, trigger: "push"|"schedule"|"scan"|"manual", status: "current"|"behind"|"indexing"|"failed", counts: { filesChanged, chunksAdded, chunksRemoved, embedded, reused }, embeddingModel, errorCode? }` (one row per automation repository and branch. Code chunks use `chunks.sourceId = componentId` and `sourceVersion = commit`, plus `path`. See ARCHITECTURE.md, "Automation repository index".)

**embeddings** `{ _id: "<sha256(text)>:<model>@<version>", appId, kind, sourceId, sourceVersion, model, modelVersion, dims, status: "accepted"|"draft", vector: BinData(vector float32) }`
Vector index filter fields: `appId`, `kind`, `status`, `modelVersion`. Confirm `$vectorSearch` support on the cluster (self-managed needs `mongot`); fall back to in-app cosine per app.

## Journeys
**crawls** `{ _id, appId, env: "SIT-2", identities: [..], startedAt, screens, journeys }`
**journeys** `{ _id, appId, crawlId, name, steps: [{screen, route, action}], apiCalls: [{method, path}], reachableBy: [role], matchedFR?, state: "observed"|"confirmed"|"in_huddle"|"possible_defect" }`

## Skills
**skill_cache** `{ _id: "selenium-java-pageobject@a1b2c3d", skill, commit, files: {"SKILL.md": "...", ...}, sha256, lastUsedAt }` (TTL index on `lastUsedAt`)
**skill_bindings** `{ appId, workflow, skills: [{name, version: "live"|"v3", commit}] }` (mirror of `.matrix/skills.yaml`)
**skill_proposals** `{ skill, fromVersion, text, evidence: [rejectionIds], status }`
**prompt_drafts** `{ _id: "D-031", appId, revision, contentHash, workflow, layer: "framework"|"app"|"session", skill?, baseVersion?, baseCommit?, text, authorId, status: "editing"|"needs_work"|"pr_open"|"promoted"|"session_only", prUrl?, expiresAt }` (TTL on `expiresAt`, 30 days placeholder)
**prompt_runs** `{ _id: "PS-0417", draftId, draftRevision, draftHash, evaluatedInputSnapshotRef, evaluatedInputSnapshotHash, evaluationScope: "sample"|"full_dataset", datasetId, datasetVersion, sampleId?, sampleVersion?, baseline: {version, commit}, results: {baseline: {...}, draft: {...}}, tokens, mlflowRunId, at }` (sandbox only; never linked to a live scan or PR)

The immutable evaluated-input snapshot preserves the sanitized instructions, policy/skill commits, inputs and evaluation configuration used by that run. Record dataset/sample versions at evaluation time; capturing current data later during export is insufficient. Preserve the snapshot separately from the mutable draft and report-file expiry under the evidence-retention policy. Editing a draft leaves past results intact but marks them as belonging to an earlier revision; current readiness only uses matching evaluated inputs. Sample checks never substitute for full-dataset evaluation. Base-policy ownership/access remain open question 15.
**gemini_cache** `{ _id: "<appId>:<workflow>:<skillsetHash>", cacheName, expiresAt, tokens }`

## Test identities and data
**test_identities** `{ _id, appId, role, env, secretRef, expectedEntitlements, lastLogin, status }`
**test_data_needs** `{ _id: "card-payment.settled.aed.gt500", appId, description, source: "provisioning_api"|"synthetic"|"masked_copy"|"fixture", available, status }`
**reservations** `{ needId, runId, records: [...], until }`

## Report exports
**report_datasets** `{ _id, appId, requestedBy, sourceManifestRef, sourceManifestHash, dataAsOf, scopeHash, metricDefinitionVersion, templateVersion, retainedUntil?, completeness }` (immutable permitted report inputs; shared by companion formats and original regeneration)

**generations** `{ _id, appId, workflow: "acceptance"|"regression", stage: "story_analysis"|"test_cases"|"automation"|"test_tagging", subjectId, outputRevision, outputHash, outputRef, skills: [{name, commit}], model, mlflowTraceId, createdBy, createdAt, supersededBy? }`

**generation_feedback** `{ _id, appId, generationId, outputRevision, stage, userId, rating: 1-5, comment, commentOriginal?, commentRefinedByAi: bool, refineTraceId?, mlflow: { traceId, assessmentId? }, version, createdAt, updatedAt }`

One current record per user and generation revision; a comment is required when `rating < 4`. Editing after the output has moved on creates a new `version`. Index `{generationId, userId}` and `{appId, stage, createdAt}`. See [FEEDBACK.md](FEEDBACK.md).

**report_exports** `{ _id, appId, requestedBy, reportType, format: "xlsx"|"pdf"|"html"|"csv", scope: { workflow?, releaseId?, scanIds?, runIds?, crawlId?, evaluationIds?, period?, selectionMode: "selected"|"filtered"|"all_permitted", selectedIds?, filters, sort? }, counts: { requested, included, excluded, unit }, status: "queued"|"generating"|"ready"|"failed"|"cancelled"|"expired", dataAsOf?, sourceManifestRef?, sourceManifestHash?, templateVersion, metricDefinitionVersion?, generatedAt?, artifact?: { storageRef, fileName, mediaType, sizeBytes, sha256 }, expiresAt?, errorCode? }`

Each export also carries `reportDatasetId`, `idempotencyKey`, `permissionScopeHash`, `dedupeKey` and optional `regeneratedFromExportId`. Unique request idempotency prevents duplicate submissions; serialize equivalent active-job creation by a key covering requester, effective permissions, dataset, scope, format and template version. Recheck authorization before reusing or downloading an artifact. Original regeneration and companion formats retain `reportDatasetId`; updated reports create a new dataset after preview.

The manifest captures the exact record set and immutable source versions or sanitized report inputs; mutable IDs alone are insufficient. Use the same captured data for each format of a report. Store large manifests, captured datasets and artifacts on the NAS; `storageRef` is internal and never a public path. Index requester/application/creation time, job status and expiry for history and cleanup. Enforce current app, field and role permissions when generating and downloading. A cleanup worker deletes NAS artifacts and captured inputs before marking the export expired; a MongoDB TTL index alone is insufficient. Retention and limits remain TODOs under `OPEN_QUESTIONS.md` item 16. See [REPORTS.md](REPORTS.md).

## Users, credentials, usage, audit
**users** `{ _id (SSO subject), name, roles: per app, theme: "system"|"light"|"dark" }`
**user_credentials** `{ _id: "<userId>:<system>", token: BinData(encrypted), last4, expires, scopesChecked }` (see SECURITY.md)
**usage** `{ userId, appId, day, tachyonTokens, byWorkflow: {...}, testsRequested: {acceptance, regression}, reviewed, acceptedAsWritten }`
**audit** `{ at, userId, action, target, runId?, details }` (every credential use, sign-in, decision, promotion, export request/completion/download; export events identify the report and scope, not file contents)
