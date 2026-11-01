# Security

## User PATs (GitHub, Jira) for the POC
- **Encrypt at rest with MongoDB client-side field-level encryption** (`pymongo[encryption]`, explicit encryption, algorithm `AEAD_AES_256_CBC_HMAC_SHA_512_Random`).
  - Master key: 96 random bytes in an OpenShift Secret, mounted only into the credential broker pod.
  - Data keys in the `encryption.__keyVault` collection (unique partial index on `keyAltNames`), key alt name `matrix-user-tokens`.
  - Rotate with `rewrap_many_data_key`. Later: switch the KMS provider from `local` to KMIP / HSM (config change).
- **Salted fingerprint**: alongside the encrypted token, store an HMAC-SHA-256 fingerprint keyed with a salt provided by the deploying team, read from an OpenShift Secret mounted only into the broker. Use it to detect duplicate, rotated or reused tokens without decrypting. Tokens themselves cannot be hashed, because Matrix must replay them.
- **Secrets Matrix only verifies** (e.g. Matrix-issued API keys): store only an Argon2id hash with a random per-record salt, plus the team-provided salt as a pepper; record the algorithm and parameters with the hash.
- **Write-only entry**: masked field → straight to encryption → stored; UI shows only last 4 and expiry.
- **Narrow tokens**: GitHub fine-grained PATs only, limited repos, ≤ 90-day expiry; reject classic/broad tokens. Jira tokens must have an expiry. Validate on save.
- **Credential broker**: the only component that decrypts. The agent process and the model never see tokens. Redact token patterns (`ghp_`, `github_pat_`, Jira formats) from logs, MLflow traces and errors.
- **Use only for user-triggered actions.** Background jobs use service credentials.
- **Lifecycle**: expiry warnings (14 and 3 days), delete on disconnect, delete when the identity provider deprovisions the user, delete if unused 90 days.
- **Audit** every decrypt/use (user, system, action, target, run ID).
- Lock down the namespace: only the broker service account may read the master-key secret. Ask whether etcd encryption is enabled.
- Wrap all of this behind a small `SecretStore` interface (`store`, `read`, `delete`) so moving to the bank's vault later is a config change.
- Record the POC exception with the security team.

## Prompt injection
- Repo files, Confluence pages, PDFs and crawled pages are **data**: wrap them as tool results / quoted data, never as instructions.
- The policy block is always first in the system instruction.
- Session skills cannot override policy (PR-only, no secrets, no main).

## Generated code
- PRs only, on `matrix/*` branches, enforced by a GitHub ruleset as well as by Matrix.
- Library skill scripts run in a sandbox; session skills cannot run scripts.

## Uploads and crawling
- ZIPs: size limit, malware + secret scan, path-traversal check, retention, NAS storage.
- Documents: personal data masked at ingestion.
- Crawler: test environments only, allowlisted hosts, rate limits, destructive actions blocked, screenshots masked, test identities only.

## Test identities
Credentials in the secret store (Harness secrets for pipeline runs). Matrix stores only references. Tests declare a role (`@role("ops-checker")`) and data need (`@data("…")`), never an account or a record.

## Per-person stats
User stats can be read as performance scores. Before wider rollout: admins/stream owners see named rows; others see role-level totals; label "for adoption and coaching, not performance review". Check with HR / works council.

## Report downloads
Exports retain the same application, field and role restrictions as their source. Check authorization at request, generation and download; deny delivery if the user has lost access. Use allowlisted fields and existing evidence masking; exclude credentials, secret references/paths, raw reserved records and unredacted logs or traces. Store artifacts and temporary report inputs privately on the NAS and serve through authenticated endpoints. Audit export and download metadata without file contents. Escape HTML and render source text as literal spreadsheet values; neutralize formula-like CSV cells. Apply configurable expiry and cleanup to artifacts and captured inputs; downloaded local copies cannot be recalled. Retention, limits and required classification labels remain TODOs under `OPEN_QUESTIONS.md` item 16. See [REPORTS.md](REPORTS.md).

Companion formats, original-snapshot regeneration and duplicate-job reuse must recheck the same app/field/role permissions; a matching artifact does not grant access. Scope deduplication to the authorized requester and request identity, without revealing another user's jobs. Filenames must be sanitized and omit credentials, secret paths and sensitive source text. Sample artifacts contain illustrative data only and are visibly labelled.

## Stopping workflow processing
Stopping Acceptance/Regression work reuses the job's existing start/control authority and current application access. Own-job control is the default; another user's job requires an explicit application-scoped stop-any-job permission, not a blanket role grant. Validate the named job/attempt and its child scope on the server. Stop acceptance atomically fences new dispatch and business/external writes, including at the credential/external-write boundary; only bookkeeping and reconciliation of already dispatched operations may proceed. A stop never authorizes rollback or Harness/HyperExecute control. Audit who requested and accepted the stop, state/fence transitions, retained or uncertain effects and linked continuation, without payloads or secrets. See [WORKFLOW_CONTROL.md](WORKFLOW_CONTROL.md).
