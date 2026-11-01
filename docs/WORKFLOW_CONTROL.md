# Stop processing in Acceptance and Regression

Users can stop queued or running **Matrix processing** for a specific Acceptance or Regression job attempt. This covers the selected job's remaining ingestion, analysis or generation work and its own child tasks. It does not stop another user's work, shared jobs outside that scope, report generation, or Harness/HyperExecute execution. Report jobs retain their separate Cancel action in [REPORTS.md](REPORTS.md).

Stopping is cooperative: an operation already in flight may finish. Completed drafts, decisions, snapshots, commits and PRs remain. Matrix does not close PRs, revert commits, remove Jira comments, undo sign-offs or roll back any external write as part of stopping. An existing or in-flight PR creation may still trigger Harness through Git; Matrix continues to monitor it.

## User journey

- Show **Stop processing** beside the active job's progress on Acceptance and Regression. Name the job/attempt, application, release or scan, current stage and affected items. If several jobs exist, require an explicit job selection; never interpret the action as stopping the whole application.
- Explain the effect inline: **Stops this Matrix task. Completed results and existing PRs remain. Harness runs continue.** No approval modal is required for this non-destructive action, and there is no Undo promise.
- After the server accepts the request, show **Stop requested**, then **Stopping**, then **Stopped**. Keep elapsed time, completed/remaining item counts and retained-result links visible. Announce status changes without moving focus. A request/network error is not a successful stop: show the last confirmed state and allow checking/retrying the same request.
- While stopping, name any operation still settling. On completion show what was retained and what was not processed, with links to drafts, existing PRs and the partial snapshot. Do not present Stopped as Failed, Completed or Paused.
- Offer **Continue from checkpoint** only when a supported checkpoint exists, otherwise **Start a new attempt**. Either is an explicit user action that creates a new linked attempt after scope, inputs and permissions are checked. Show changed inputs before continuing; keep the stopped attempt immutable. No automatic resume after navigation, login, a worker restart or a dependency recovery.

## State and execution contract

| State | Meaning |
|---|---|
| Queued / Running | The selected attempt may dispatch authorized work. |
| Stop requested | The API has durably recorded an authorized stop and installed the dispatch/write fence. Acknowledgement must not precede that fence. |
| Stopping | Workers are settling pre-stop operations and recording retained results/checkpoints. No new business work is dispatched. |
| Stopped | All tracked in-flight operations have finished or been safely cancelled and their outcomes reconciled. Remaining work will not start in this attempt. |

1. Serialize stop acceptance against job completion and work dispatch, using an atomic state/version check or equivalent fencing. If completion commits first, return **Completed** and its results; do not overwrite it with Stopped. Other terminal states are returned unchanged. Repeated stop requests are idempotent.
2. After stop acknowledgement, start no new child task, model call, tool execution, artifact publication, commit, PR creation or other business/external write for that attempt. Queue consumers, workers and the external-write/credential boundary must enforce the same fence; a UI flag alone is insufficient. A stale worker must not dispatch after losing its lease or fence version.
3. An operation dispatched before the fence may finish, including an external write. Stop supported local/sandbox operations safely; do not kill unrelated work. A late model response must not launch further tool calls or publish new generated tests. It may be retained as sanitized attempt evidence, clearly marked incomplete.
4. Status, audit, checkpoint and reconciliation writes remain permitted. Record the actual outcomes and identifiers of pre-stop operations, including any PR already created. Use correlation/idempotency identifiers and read-only reconciliation for uncertain external outcomes; do not repeat a write to discover whether it succeeded. If an outcome cannot be settled, keep **Stopping** with the uncertainty and recovery owner visible rather than claiming a completed stop or rollback.
5. Preserve committed results and every scan's snapshot. A stopped scan records the pinned input scope, completed/unprocessed items, unresolved outcomes and completeness. It is not a full-coverage result; apply [METRICS.md](METRICS.md). Stopping test generation never accepts a draft or signs off a story.
6. A new linked attempt reuses only a validated checkpoint. Check retained artifacts and external identifiers before scheduling remaining work so continuation cannot duplicate tests, commits, comments or PRs. Fresh inputs require a new identified snapshot; do not silently combine them with the stopped attempt's evidence.

## Permissions and audit

Reuse the workflow's existing start/control authority. By default, a user can stop only their own job while retaining the required application access and control permission. Stopping another user's job requires an explicit application-scoped **stop-any-job** permission; the feature grants no blanket QA, admin or stream-owner entitlement. Enforce this server-side at request acceptance and do not expose another job's details to an unauthorized caller.

Audit the request, requester, application/job/attempt scope, previous state, accepted fence/version, worker stopping/stopped transitions, retained outputs, unsettled effects and any linked continuation attempt. Log references and status, never credentials or raw sensitive payloads. See [SECURITY.md](SECURITY.md).

## Acceptance checks

- Stop a queued attempt before dispatch: it reaches Stopped and no task/model/external write starts.
- Stop an active batch: completed items remain, undispatched items do not start, and a late model response cannot start another tool call or publish a test.
- Stop during a PR write: reconcile and display the resulting PR once, without deleting it, duplicating it or stopping its Git-triggered Harness run.
- Race stop against completion and concurrent worker dispatch: the committed terminal outcome wins, and no new work crosses an acknowledged fence. Repeated requests produce one stop transition.
- Leave and return, or restart a worker, after stop acknowledgement: the same state and results remain; processing does not resume automatically.
- Attempt to stop another user's job without stop-any-job permission: deny it. With the explicit permission and existing workflow control authority, stop only the named job and its scoped children.
- Export a stopped scan: identify incomplete/unprocessed scope, retain completed evidence and do not present a whole-application coverage gain or pass.
- Continue a supported checkpoint: create a linked new attempt, retain the original snapshot and reuse existing output references without duplicate external writes.

These are implementation requirements; the static designs do not establish that processing can already be stopped.
