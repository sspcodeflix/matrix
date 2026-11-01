# Architecture

## Components
```
                     +---------------------------+
   Browser (React) ->|  Matrix API (FastAPI)     |
                     |  auth: SSO                |
                     +-----+---------------+-----+
                           |               |
              jobs queue   |               |  reads/writes
                           v               v
        +------------------------+   +-----------------------------+
        | Workers                |   | MongoDB Enterprise          |
        | - ingestion/embeddings |   | apps, scans, gaps, tests,   |
        | - discovery & scans    |   | embeddings, audit, caches,  |
        | - agent loop (write)   |   | encrypted credentials       |
        | - crawler (Playwright) |   +-----------------------------+
        | - run monitor          |
        +----+-----------+-------+     +-----------------------+
             |           |             | Credential broker     |
             |           +------------>| decrypts PATs per     |
             |                         | call, makes API call  |
             v                         +-----------+-----------+
     +---------------+                             |
     | Tachyon       |  Gemini (generation,        v
     | gateway       |  embeddings)       GitHub, Jira, Confluence,
     +---------------+                    Octane, Knowledge OS, DocuMind
             |
     +---------------+     Harness pipeline -> HyperExecute -> Octane
     | MLflow        |     (triggered from Git; Matrix only monitors)
     | traces, evals |
     +---------------+     NAS: ZIP uploads, MLflow artifacts, reports, model weights
```

## Key decisions
| Area | Decision |
|---|---|
| UI | Conventional web app (not chat-first). White and red, light and dark themes. |
| LLM | Tachyon gateway, Gemini only. Bring-your-own Tachyon license per team. |
| Embeddings | From Tachyon. Stored in MongoDB (BSON vector type). |
| Storage | MongoDB Enterprise, self-managed. No object store; NAS for files. |
| Learning loop | Re-embedding and storing vectors (accepted examples), not fine-tuning. |
| Tracking | MLflow for prompt and skill versions, evals and traces. Users' ratings of each generation are logged to its trace as human feedback ([FEEDBACK.md](FEEDBACK.md)). MLflow artifact store on NAS; backend store needs a SQL DB (MLflow does not run on MongoDB). |
| Execution | Harness pipeline on HyperExecute, triggered from Git. Matrix never starts or reruns pipelines. |
| Code changes | PR on `matrix/*` branches only. |
| Git access | Users' GitHub PATs (fine-grained). Read for source repos, read+write for automation repos. |
| Audit | MongoDB audit records, kept for reference (not published to GRC). |

## The agent loop (Write step)
Tachyon only answers model calls; Matrix runs skills and tools.
1. **Resolve skills** deterministically: auto-detect from repo contents → `.matrix/skills.yaml` in the automation repo → run override. Output: exact skills at exact Git commits. Model-driven skill discovery is switched off.
2. **Load** the skill files from the `matrix-skills` repo at those commits (cache in MongoDB keyed by `skill@commit`, plus in-memory).
3. **Build the request**:
   - system instruction: Matrix base policy (PR-only, no secrets, output format) + each resolved `SKILL.md` in precedence order (policy → framework → app → session instructions, labelled).
   - user content: the requirement, the gap, existing tests found, target path.
   - tools (function calling): `read_skill_file`, `search_repo`, `read_repo_file`, `write_file` (scratch branch only), `compile`, `run_skill_script` (library skills only, never session skills).
4. **Loop**: Gemini returns function calls → Matrix executes them in its sandbox → returns results → until done. Tool results from repos/Confluence are wrapped as data (prompt-injection guard); the policy block always comes first.
5. **Finish**: compile again, open the PR (labelled with the skill versions used), record the trace in MLflow.

Check with the Tachyon team: function calling pass-through, and context caching support (cache the skill block per app + skill-set hash; store the cache name/expiry pointer in MongoDB).

## Skills
- Source of truth: Git repo `matrix-skills` (`framework/*`, `apps/*`, each with `SKILL.md`, `references/`, `scripts/`, `evals/`; `CODEOWNERS`).
- MLflow: each version registered with its Git commit and eval scores.
- MongoDB: the live pointer per app, usage, proposed changes from review rejections.
- Promotion gate: ≥ 90% on golden datasets (compiles, green on HyperExecute, assertions trace to an FR).
- App config: `.matrix/skills.yaml` in each automation repo (see `examples/`), `@live` or pinned versions, per-path overrides.
- Session skills: per-run instructions or an attached `SKILL.md`; instructions only (no scripts), stored with the run, labelled on outputs, can be proposed to the library via PR.

## App context and retrieval
- Sources: Knowledge OS (by reference, resynced; never copied as a second truth), Confluence, DocuMind, API specs, PDF/Word uploads, Journeys (observed).
- API specs are **parsed into structured records** (endpoints, params, responses); only descriptions are embedded.
- Every chunk is tagged: app, component, source, source version, embedding model version, trust tier.
- Trust ranking: Knowledge OS > Confluence > DocuMind > uploaded documents > journeys; older content ranks lower. Conflicts between similar-rank sources are flagged and sent to Huddle; Matrix uses neither until resolved.
- Personal data in uploaded documents is masked at ingestion.

## Automation repository index
Matrix keeps an embedded index of each automation repository so it can find existing page objects, helpers and tests before writing new ones, and so the gap scan can map tests to requirements.

- **Trigger:** a GitHub Actions workflow in each automation repository runs on push to the default branch and on a nightly schedule (the backstop for missed pushes). It sends only the repository, branch and commit to Matrix; it sends no code and no credentials. Matrix then reads the repository itself. How the workflow authenticates to Matrix and which credential Matrix uses to read is open question 19.
- **Incremental:** Matrix diffs `indexedCommit..commit`, re-chunks only changed files and drops chunks of deleted files. A chunk whose text hash is unchanged reuses its embedding (`embeddings._id` is `sha256(text):model@version`), so a typical push embeds a few chunks, not the repository.
- **Tracking:** `repo_indexes` records the indexed commit, the branch head and how many commits it is behind. App context shows **Current**, **Behind by N commits** or **Failed** per repository. A scan or a Write step pins a commit; if the index is not at that commit, Matrix indexes it first (trigger `scan`) instead of using an older index.
- **Outdated automation:** separate from the index. Each `automation_drafts` row records the accepted test-case set revision and case hashes it was written from. A newer accepted set, or a changed case hash, marks it **Outdated** with the changed case IDs; the Review item and the story page show it and offer to regenerate only those tests.

## Requirement ↔ journey matching (Journeys "not confirmed")
1. Only UI-channel requirements are compared (batch/API requirements are checked against specs and runs).
2. Evidence, cheapest first: recorded API calls vs endpoints mapped to the FR → term matching (screens, buttons, labels, routes) → embedding similarity → Gemini judge only for borderline candidates.
3. "Not confirmed" only if no journey passes and the component was crawled with every role that has a test identity. Then classify the reason (role, date/data, flag, blocked action, possibly not built).
Thresholds need tuning against known matches (golden datasets).

## Crawler guardrails
SIT/UAT only, allowlisted hosts, rate limits, destructive actions blocked unless the environment is marked safe, screenshots masked, sign-in only through test identities from the vault/secret store.

## Report generation and downloads
The API validates export scope and permissions and queues a report job. A worker captures the permitted records and source versions, then renders XLSX, PDF, standalone HTML or CSV deterministically. Each format uses the same captured report dataset and versioned metric definitions; no model call or external test execution is needed. Store job metadata in MongoDB and private artifacts/captured datasets on the existing NAS. Stream downloads through the API with a fresh permission check; do not expose NAS paths. A cleanup worker expires the files and updates job state. See [REPORTS.md](REPORTS.md) for the report catalogue, job lifecycle and policy TODOs.

Use immutable report datasets to group companion formats and regenerate original artifacts. Request idempotency plus atomic equivalent-job creation suppress duplicate exports. Updated reports explicitly capture a new dataset; permissions are revalidated before reuse or delivery.

## Stopping Matrix processing
Acceptance and Regression expose an authorized stop request for a specific Matrix job attempt. The API atomically records a stop fence before acknowledging **Stop requested**. Workers check it before claiming units, model/tool calls, further child scheduling and external writes. They drain/cancel supported in-flight work and reconcile effects already dispatched, then mark **Stopped** only when tracked effects are settled. Unknown remote outcomes remain **Stopping** with a recovery owner; they are not silently retried or described as rolled back.

Completed drafts, snapshots and existing PRs remain. A stopped scan saves explicit completeness; unprocessed items are not coverage gaps or passing evidence. Continued processing requires an explicit new linked attempt from a supported checkpoint, with source/permission validation and duplicate-output guards. The control never starts, stops or reruns Harness/HyperExecute. See [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md) for state transitions, races and acceptance checks.
