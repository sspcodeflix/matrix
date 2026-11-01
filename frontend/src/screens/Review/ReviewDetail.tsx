import { useId, useMemo, useState, type CSSProperties } from 'react';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import type { SessionUser } from '../../api/session';
import { FeedbackCard, useFeedbackGate } from '../../features/feedback';
import { acceptSet, exclusionNote, setRelease, type SetRelease, type TestCaseSet } from '../../features/testcases';
import { generationOf, saveTestDecision, storyOf, type DryRunResult, type ReviewItem, type ReviewTest } from './api';
import { toAccept, type ApprovalStatus } from './approval';
import { TestRow } from './TestRow';
import { KIND_LABEL, kindLine } from './reviewFormat';
import styles from './Review.module.css';

type Section = 'tests' | 'changes' | 'dryrun';

/** Who acts next on this item, in words (UI_UX_REVIEW "Ownership"). */
function nextActor(item: ReviewItem, approval: ApprovalStatus | undefined, canPostApproval: boolean, release?: SetRelease): { owner: string; detail: string } {
  if (release) {
    // Per-test decisions are provisional: only the set acceptance at the rated revision releases work.
    if (release.released) return { owner: 'Needs UAT', detail: 'sign-off in Huddle; automation continues in parallel' };
    const why = release.withdrawn ? 'a case or decision changed since the set was accepted, so ' : '';
    if (!release.included.length) return { owner: 'Needs QA', detail: 'every case is rejected: regenerate the set in the story or undo a rejection' };
    if (!release.feedbackReady) return { owner: 'Needs QA', detail: `${why}rate revision ${release.generation.outputRevision}, then accept the set` };
    return { owner: 'Needs QA', detail: `${why}accept the set to release it to UAT sign-off and automation` };
  }
  const open = item.tests.filter((t) => t.state !== 'accepted' && t.state !== 'rejected').length;
  const rejected = item.tests.filter((t) => t.state === 'rejected').length;
  if (approval?.kind === 'pending') return { owner: 'Waiting on GitHub', detail: 'approval request in progress' };
  if (rejected) return { owner: 'Needs QA', detail: `send back ${rejected === 1 ? 'the rejected test' : `${rejected} rejected tests`} to Matrix, or undo` };
  if (open) return { owner: 'Needs QA', detail: `${open} ${open === 1 ? 'test' : 'tests'} to decide` };
  if (!item.pr) return { owner: 'Needs UAT', detail: 'sign-off in Huddle' };
  if (item.pr.approval !== 'approved') {
    return { owner: 'Needs QA', detail: canPostApproval ? `approve PR #${item.pr.number}` : `approve PR #${item.pr.number} in GitHub` };
  }
  return { owner: 'Needs a person in GitHub to merge', detail: 'then Harness runs the tests from Git' };
}

const testsUnit = { one: 'test case', many: 'test cases' };

export function ReviewDetail({ item, caseSet, user, canPostApproval, snapshot, approval, onApprove, onClearApproval, onChange }: {
  item: ReviewItem;
  /** The story's shared test-case set, for acceptance items (features/testcases). */
  caseSet?: TestCaseSet;
  user: SessionUser;
  canPostApproval: boolean;
  snapshot: string;
  /** Approval request state, owned by the screen so it outlives this view and the dialog. */
  approval?: ApprovalStatus;
  onApprove: () => void;
  onClearApproval: () => void;
  onChange: (next: ReviewItem) => void;
}) {
  const download = useDownloadReport();
  const [section, setSection] = useState<Section>('tests');
  const [expanded, setExpanded] = useState<string | null>(() => item.tests.find((t) => t.state !== 'accepted')?._id ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackNote, setSendBackNote] = useState('');
  const [sendBackError, setSendBackError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tabsId = useId();
  const pendingApproval = approval?.kind === 'pending' ? approval.binding : null;
  const lockReasonId = `${tabsId}-lock`;

  // Close the confirmation once the request settles successfully or goes stale; the result is on the page.
  const [seenKind, setSeenKind] = useState(approval?.kind);
  if (seenKind !== approval?.kind) {
    setSeenKind(approval?.kind);
    if (approval?.kind === 'approved' || approval?.kind === 'stale') setConfirmOpen(false);
  }

  const tests = item.tests;
  const accepted = tests.filter((t) => t.state === 'accepted').length;
  const rejected = tests.filter((t) => t.state === 'rejected');
  const pending = tests.filter((t) => t.state !== 'accepted' && t.state !== 'rejected');
  const added = item.changes.reduce((n, f) => n + f.added, 0);
  const removed = item.changes.reduce((n, f) => n + f.removed, 0);
  const runPassed = item.dryRun?.results.filter((r) => r.status === 'passed').length ?? 0;
  const runTotal = item.dryRun?.results.length ?? 0;
  const context = `Review · ${item.appName} · ${kindLine(item)}`;

  const updateTest = async (next: ReviewTest) => {
    // Decisions are locked while an approval is in flight, so they never race it.
    if (pendingApproval) return;
    // A newer decision supersedes the last approval result.
    if (approval) onClearApproval();
    // Any test change after a PR approval makes that approval stale.
    const pr = item.pr && item.pr.approval === 'approved' && next.state !== 'accepted' ? { ...item.pr, approval: 'stale' as const } : item.pr;
    onChange({ ...item, pr, tests: tests.map((t) => (t._id === next._id ? next : t)) });
    await saveTestDecision(item._id, next);
  };

  const release = caseSet ? setRelease(caseSet) : undefined;
  const storyId = storyOf(item);

  const approveAll = () => {
    if (release && storyId) {
      // Explicit set acceptance: the one action that releases the cases to UAT sign-off and automation.
      const r = release;
      setConfirmOpen(false);
      acceptSet(storyId, user.name).then(
        () => setNotice(`Accepted the set at revision ${r.generation.outputRevision}: ${r.included.length} test cases released to UAT sign-off and automation. ${exclusionNote(r)}`.trim()),
        (e: Error) => setNotice(`Not accepted: ${e.message}.`),
      );
      return;
    }
    const nextTests = tests.map((t) => (t.state === 'rejected' ? t : { ...t, state: 'accepted' as const, acceptedRevision: undefined }));
    setNotice(null);
    if (item.pr && canPostApproval) {
      // The screen sends the request bound to these exact revisions; the dialog stays open until it settles.
      onApprove();
      return;
    } else {
      onChange({ ...item, tests: nextTests });
      setNotice(
        item.pr
          ? `Accepted ${pending.length} tests in Matrix. Approve PR #${item.pr.number} in GitHub; Matrix can't post approvals under the current policy.`
          : `Accepted ${pending.length} test cases. They go to UAT sign-off next.`,
      );
    }
    setConfirmOpen(false);
  };

  const openConfirm = () => {
    if (approval && approval.kind !== 'pending') onClearApproval();
    setConfirmOpen(true);
  };

  const sendBack = () => {
    if (!sendBackNote.trim()) {
      setSendBackError(true);
      return;
    }
    // TODO(backend): POST /api/review-items/{id}/send-back { note } -> Matrix revises on the same matrix/* branch.
    setSendBackOpen(false);
    setNotice(`Sent back to Matrix with your note. It will revise ${item.pr ? `PR #${item.pr.number}` : 'the test cases'} and return it to your queue.`);
    setSendBackNote('');
  };

  const generation = generationOf(item, caseSet);
  const feedbackGate = useFeedbackGate([generation]);
  const feedbackId = `${tabsId}-feedback`;

  const approveBlocker =
    release ? (release.released ? `${release.reason}; released to UAT sign-off and automation.` : release.canAccept ? null : `${release.reason}.`)
    : pendingApproval ? 'Approval request in progress.'
    : pending.length === 0 && (!item.pr || item.pr.approval === 'approved') ? 'Everything here is already accepted.'
    : rejected.length > 0 ? `${rejected.length} rejected ${rejected.length === 1 ? 'test' : 'tests'}: send back instead, or undo the rejection.`
    : !feedbackGate.ready ? `${feedbackGate.reason}. Every AI output is rated before it moves on.`
    : null;
  const approveLabel = item.pr ? 'Approve all' : release ? 'Accept set' : 'Accept all';
  const acceptCount = pendingApproval ? toAccept(pendingApproval) : release ? release.toAccept : pending.length;
  const excludedNote = release ? exclusionNote(release) : '';

  // Record identity for exports (UI_UX_REVIEW C2, C6): the item's tests at the reviewed revision.
  const snapshotId = `${item._id.toUpperCase()}${item.pr ? `-${item.pr.headCommit}` : ''}`;
  const testScope = {
    count: tests.length,
    unit: testsUnit,
    ids: tests.map((t) => t._id),
    spec: filterSpec({ item: item._id, commit: item.pr?.headCommit, tests: tests.map((t) => `${t._id}@${t.revision}`).join(',') }),
  };
  const runScope = {
    count: runTotal,
    unit: { one: 'test result', many: 'test results' },
    ids: item.dryRun?.results.map((r) => r.testId) ?? [],
    spec: filterSpec({ item: item._id, run: item.dryRun?.runId }),
  };
  const next = nextActor(item, approval, canPostApproval, release);

  const openTestCases = () =>
    download.open({
      title: 'Download test cases',
      context,
      reportTypes: [{ key: 'test-cases', label: 'Test cases', description: 'Test IDs, requirement links, ordered steps, expected results, review state, revision and sources. Drafts and rejected cases are labelled.', formats: ['xlsx'] }],
      scope: { filtered: testScope, full: testScope },
      snapshot,
      snapshotId,
      snapshotCapturedAt: item.capturedAt,
      filters: `Review item: ${kindLine(item)}`,
    });

  const openReviewRecord = () =>
    download.open({
      title: 'Download review record',
      context,
      reportTypes: [{ key: 'review-record', label: 'Review record', description: 'Reviewed version, decisions and reasons, reviewer and time, pending items. PR approval and merge are separate states.', formats: ['pdf', 'html', 'xlsx'] }],
      scope: { filtered: testScope, full: testScope },
      snapshot: item.pr ? `${snapshot} · ${item.pr.repo} @ ${item.pr.headCommit}` : snapshot,
      snapshotId,
      snapshotCapturedAt: item.capturedAt,
    });

  const openRunResults = () =>
    download.open({
      title: 'Download run results',
      context,
      reportTypes: [{ key: 'execution-results', label: 'Execution results', description: 'Run IDs, trigger, branch and commit, pass/fail/blocked counts, duration and requirement links.', formats: ['pdf', 'html', 'xlsx'] }],
      scope: { filtered: runScope, full: runScope },
      snapshot: `Harness execution #${item.dryRun?.harnessExecId}`,
      snapshotId: `RUN-${item.dryRun?.harnessExecId}`,
      snapshotCapturedAt: item.dryRun?.reportedAt,
    });

  const sectionTab = (key: Section, label: string, count: string) => (
    <button
      type="button"
      role="tab"
      id={`${tabsId}-${key}`}
      aria-selected={section === key}
      aria-controls={`${tabsId}-panel`}
      className={styles.queueTab}
      onClick={() => setSection(key)}
    >
      {label}
      <span className={styles.count}>{count}</span>
    </button>
  );

  return (
    <section aria-labelledby="rd-heading" className="card">
      <div className={styles.detailHead}>
        <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <span className={styles.kicker}>{KIND_LABEL[item.kind]} · {item.appName} · {item.pr ? `PR #${item.pr.number}` : item.ref.storyId}</span>
          <h2 id="rd-heading" className={styles.detailTitle}>{item.title}</h2>
          <span className={styles.nextActor}>
            Next: <strong>{next.owner}</strong> · {next.detail}
          </span>
          <span className={styles.meta}>
            Written by Matrix {item.writtenAgo}
            <span aria-hidden="true">·</span>
            {item.dryRun ? (
              <span className="row" style={{ '--gap': '6px', color: runPassed === runTotal ? 'var(--success-text)' : 'var(--danger-text)' } as CSSProperties}>
                <span className="dot" style={{ background: runPassed === runTotal ? 'var(--success)' : 'var(--accent)' }} aria-hidden="true" />
                Dry run via Harness passed {runPassed} of {runTotal}
              </span>
            ) : (
              <span>No dry run: test cases only</span>
            )}
          </span>
        </div>
        <div className="stack" style={{ '--gap': '6px', alignItems: 'flex-end' } as CSSProperties}>
          <div className="row">
            <button
              type="button"
              className="btn"
              aria-haspopup="dialog"
              disabled={!!pendingApproval}
              aria-describedby={pendingApproval ? lockReasonId : undefined}
              onClick={() => setSendBackOpen(true)}
            >
              Send back
            </button>
            <button
              type="button"
              className="btn primary"
              aria-haspopup="dialog"
              disabled={!!approveBlocker}
              aria-describedby={approveBlocker ? `${tabsId}-blocker` : release?.canAccept ? `${tabsId}-release` : undefined}
              onClick={openConfirm}
            >
              {approveLabel}
            </button>
          </div>
          {approveBlocker && (
            <span id={`${tabsId}-blocker`} className="small muted">
              {approveBlocker}
              {!feedbackGate.ready && !pendingApproval && (
                <>
                  {' '}
                  <a href={`#${feedbackId}`} onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(feedbackId);
                    el?.scrollIntoView({ block: 'center' });
                    el?.querySelector<HTMLElement>('input')?.focus();
                  }}>Rate it</a>
                </>
              )}
            </span>
          )}
          {release?.canAccept && (
            <span id={`${tabsId}-release`} className="small muted" style={{ textAlign: 'right' }}>
              Releases {release.included.length} test {release.included.length === 1 ? 'case' : 'cases'} at revision {release.generation.outputRevision} to UAT sign-off and automation. {excludedNote}
            </span>
          )}
        </div>
      </div>

      <div className={styles.requirement}>
        <span className="spread" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            <span className="mono" style={{ fontWeight: 500 }}>{item.requirement.id}</span> · {item.requirement.title}
          </span>
          {/* TODO(integration): link to the cited source chunk. */}
          <a href={item.requirement.sourceUrl} className="row" style={{ '--gap': '4px', fontSize: 13, fontWeight: 500, textDecoration: 'none' } as CSSProperties}>
            {item.requirement.sourceLabel} <Icon name="external" size={14} />
          </a>
        </span>
        <p>{item.requirement.text}</p>
      </div>

      <div className={styles.approval}>
        {item.pr ? (
          <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
            <span className="secondary">
              Accepting a test records your QA decision in Matrix. Approving the pull request is a separate GitHub review; merging stays with a person in GitHub.
            </span>
            <dl className={styles.identity}>
              <dt>Repository</dt><dd className="mono">{item.pr.repo} · {item.pr.branch}</dd>
              <dt>Revision</dt><dd className="mono">{item.pr.headCommit}</dd>
              <dt>Approves as</dt><dd>{user.name} {canPostApproval ? '(posted by Matrix with your GitHub PAT)' : '(in GitHub; policy does not let Matrix post approvals)'}</dd>
              <dt>PR approval</dt>
              <dd>
                {item.pr.approval === 'approved' && <Pill tone="success">Approved · not merged</Pill>}
                {item.pr.approval === 'stale' && <Pill tone="warning">Stale: changed since you approved</Pill>}
                {item.pr.approval === 'none' && <Pill>Not approved</Pill>}
              </dd>
            </dl>
          </div>
        ) : (
          <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
            <span className="secondary">
              No pull request: these are the story's acceptance test cases, the same set as in its story workspace.
              Accept and Reject per test are provisional. Only <strong>{approveLabel}</strong>, after you rate the current revision, releases the set to UAT sign-off and automation.
            </span>
            {release && (
              <dl className={styles.identity}>
                <dt>Revision</dt><dd className="mono">{release.generation.outputRevision}</dd>
                <dt>Set</dt>
                <dd>
                  {release.released ? <Pill tone="success">Accepted · released to UAT and automation</Pill>
                    : release.withdrawn ? <Pill tone="warning">Changed since the set was accepted</Pill>
                    : <Pill>Not accepted</Pill>}
                </dd>
              </dl>
            )}
          </div>
        )}
      </div>

      {pendingApproval && item.pr && (
        <div className="banner warning" role="status" style={{ margin: '12px 20px 0' }}>
          <Icon name="lock" />
          <span id={lockReasonId}>
            Approving PR #{item.pr.number} at <span className="mono">{pendingApproval.headCommit}</span> for the {pendingApproval.tests.length} test revisions you reviewed.
            Waiting on GitHub. Test decisions and Send back are locked until it responds, so nothing can conflict with this approval.
            Closing the dialog does not cancel the request.
          </span>
        </div>
      )}
      {approval?.kind === 'approved' && (
        <div className="banner success" role="status" style={{ margin: '12px 20px 0' }}>
          <Icon name="check" />
          <span>{approval.message}</span>
        </div>
      )}
      {approval?.kind === 'stale' && (
        <div className="banner warning" role="status" style={{ margin: '12px 20px 0' }}>
          <Icon name="warning" />
          <span>{approval.message}</span>
        </div>
      )}
      {approval?.kind === 'failed' && (
        <div className="banner accent" role="alert" style={{ margin: '12px 20px 0' }}>
          <Icon name="warning" />
          <span className="grow">{approval.message}</span>
          <button type="button" className="btn" aria-haspopup="dialog" onClick={openConfirm}>Try again</button>
        </div>
      )}
      {notice && (
        <div className="banner success" role="status" style={{ margin: '12px 20px 0' }}>
          <Icon name="check" />
          <span>{notice}</span>
        </div>
      )}

      <div className={styles.sectionTabs}>
        <div role="tablist" aria-label="Review sections" className="row" style={{ '--gap': '20px' } as CSSProperties}>
          {sectionTab('tests', 'Tests', `${accepted} of ${tests.length} accepted`)}
          {sectionTab('changes', 'Code changes', item.changes.length ? `+${added} −${removed}` : 'none')}
          {sectionTab('dryrun', 'Dry run', item.dryRun ? `#${item.dryRun.harnessExecId}` : 'none')}
        </div>
        {section === 'tests' && (
          <button type="button" className={`link-btn ${styles.tabAction}`} style={{ fontSize: 13 }} aria-haspopup="dialog" onClick={openTestCases}>
            Download test cases
          </button>
        )}
        {section === 'dryrun' && item.dryRun && (
          <button type="button" className={`link-btn ${styles.tabAction}`} style={{ fontSize: 13 }} aria-haspopup="dialog" onClick={openRunResults}>
            Download run results
          </button>
        )}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${section}`}>
        {section === 'tests' &&
          tests.map((t, i) => (
            <TestRow
              key={t._id}
              test={t}
              last={i === tests.length - 1}
              expanded={expanded === t._id}
              onToggle={() => setExpanded(expanded === t._id ? null : t._id)}
              onChange={updateTest}
              lockReasonId={pendingApproval ? lockReasonId : undefined}
            />
          ))}
        {section === 'changes' && <CodeChanges item={item} />}
        {section === 'dryrun' && <DryRun item={item} />}
      </div>

      <div id={feedbackId} style={{ padding: '0 20px 16px' }}>
        <FeedbackCard
          key={`${generation.generationId}@${generation.outputRevision}`}
          generation={generation}
          userId={user.name}
          title={item.pr ? 'Rate this generated automation' : 'Rate these generated test cases'}
        />
      </div>

      <div className={styles.detailFoot}>
        <span>
          Written with {item.writtenWith.join(' and ')}
          {item.pr && (canPostApproval ? ' · approvals are posted to GitHub as you' : ' · approve the PR in GitHub')}
        </span>
        <span className={styles.footLinks}>
          <button type="button" className={`link-btn ${styles.smallLink}`} aria-haspopup="dialog" onClick={openReviewRecord}>
            Download review record
          </button>
          {/* TODO(integration): MLflow trace URL for this generation. */}
          <a href={item.mlflowUrl}>Trace in MLflow</a>
        </span>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={item.pr ? `Approve PR #${item.pr.number}?` : release ? 'Accept this test case set?' : 'Accept all test cases?'}
        width={560}
        footer={
          <div className="row" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>{pendingApproval ? 'Close' : 'Cancel'}</button>
            <button type="button" className="btn primary" disabled={!!pendingApproval} onClick={approveAll}>
              {pendingApproval ? 'Sending approval…' : approval?.kind === 'failed' ? 'Try again' : item.pr && canPostApproval ? 'Accept tests and approve PR' : release ? 'Accept set' : 'Accept tests'}
            </button>
          </div>
        }
      >
        <div className="stack" style={{ padding: '16px 20px' }}>
          <p>This does two separate things:</p>
          <ol className="stack" style={{ '--gap': '6px', margin: 0, paddingLeft: 20 } as CSSProperties}>
            <li>Records <strong>acceptance</strong> of {acceptCount} remaining {acceptCount === 1 ? 'test' : 'tests'} in Matrix.</li>
            {release && (
              <li>
                Releases the set at revision {release.generation.outputRevision} ({release.included.length} test cases) to UAT sign-off and automation, which run in parallel.
                {excludedNote && <> {excludedNote}</>}
              </li>
            )}
            {item.pr && (canPostApproval ? (
              <li>Posts a GitHub <strong>approval</strong> on <span className="mono">{item.pr.repo}</span> PR #{item.pr.number} at <span className="mono">{item.pr.headCommit}</span> (as {user.name})</li>
            ) : (
              <li>Matrix can't post the PR approval under the current policy. Approve it in GitHub yourself (<a href={item.pr.url}>open PR #{item.pr.number}</a>).</li>
            ))}
          </ol>
          <p className="secondary">
            {item.pr ? 'Nothing is merged. A person merges in GitHub, and Harness runs the tests from Git. New commits make this approval stale.' : 'Any later edit or decision change withdraws the release until the set is rated and accepted again.'}
          </p>
          {pendingApproval && (
            <p role="status" className="small">
              Sending to GitHub. Closing this dialog does not cancel the request: it continues, and the result appears on the page.
              Test decisions stay locked until then.
            </p>
          )}
          {approval?.kind === 'failed' && <p role="alert" className={`small ${styles.error}`}>{approval.message}</p>}
        </div>
      </Dialog>

      <Dialog
        open={sendBackOpen}
        onClose={() => setSendBackOpen(false)}
        title="Send back to Matrix"
        width={560}
        footer={
          <div className="row" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="btn" onClick={() => setSendBackOpen(false)}>Cancel</button>
            <button type="button" className="btn dark" onClick={sendBack}>Send back</button>
          </div>
        }
      >
        <div className="field" style={{ padding: '16px 20px' }}>
          <label htmlFor={`${tabsId}-sendback`}>What should Matrix change? (required)</label>
          <textarea
            id={`${tabsId}-sendback`}
            className="textarea"
            rows={4}
            value={sendBackNote}
            aria-invalid={sendBackError || undefined}
            aria-describedby={sendBackError ? `${tabsId}-sendback-err` : undefined}
            onChange={(e) => {
              setSendBackNote(e.target.value);
              setSendBackError(false);
            }}
          />
          {sendBackError && <span id={`${tabsId}-sendback-err`} className={styles.error} role="alert">Tell Matrix what to change before sending it back.</span>}
        </div>
      </Dialog>
    </section>
  );
}

function CodeChanges({ item }: { item: ReviewItem }) {
  if (!item.changes.length) {
    return (
      <div className={styles.tabBody}>
        <span className="muted">
          {item.pr ? 'No file changes in this pull request yet.' : 'Acceptance test cases have no code. Automation is written in Regression after the release ships.'}
        </span>
      </div>
    );
  }
  return (
    <div className={styles.tabBody}>
      {item.pr && (
        <span className="small muted">
          Branch <span className="mono">{item.pr.branch}</span> · head <span className="mono">{item.pr.headCommit}</span> ·{' '}
          {/* TODO(integration): GitHub PR URL. */}
          <a href={item.pr.url}>View on GitHub</a>
        </span>
      )}
      {item.changes.map((f) => (
        <div key={f.path} className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <div className={styles.fileHead}>
            <span className="mono" style={{ overflowWrap: 'anywhere' }}>{f.path}</span>
            <span className="mono"><span className={styles.adds}>+{f.added}</span> <span className={styles.dels}>−{f.removed}</span></span>
          </div>
          <pre className="code" aria-label={`Diff of ${f.path}`}>
            {f.lines.map((l, i) => (
              <span key={i} className={l.kind === 'add' ? 'diff-add' : l.kind === 'del' ? 'diff-del' : undefined} style={l.kind === 'ctx' ? { display: 'block' } : undefined}>
                {l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}
                {l.text}
              </span>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

function DryRun({ item }: { item: ReviewItem }) {
  const columns = useMemo<Column<DryRunResult>[]>(() => [
    { key: 'testId', header: 'Test', value: (r) => r.testId, mono: true },
    { key: 'name', header: 'Method', value: (r) => r.name, mono: true },
    {
      key: 'status', header: 'Result', value: (r) => r.status, filter: { type: 'select', options: ['passed', 'failed', 'blocked'] },
      render: (r) => <Pill tone={r.status === 'passed' ? 'success' : r.status === 'failed' ? 'accent' : 'warning'}>{r.status[0].toUpperCase() + r.status.slice(1)}</Pill>,
    },
    { key: 'duration', header: 'Duration', value: (r) => r.durationSec, align: 'right', filter: { type: 'none' }, render: (r) => `${r.durationSec}s` },
  ], []);

  if (!item.dryRun) {
    return (
      <div className={styles.tabBody}>
        <span className="muted">No dry run. Harness runs a dry run when Matrix opens a pull request; acceptance test cases have none.</span>
      </div>
    );
  }
  return (
    <div className={styles.tabBody}>
      <span className="small muted">
        Harness execution <span className="mono">#{item.dryRun.harnessExecId}</span> · triggered by {item.dryRun.trigger} · run ID{' '}
        <span className="mono">{item.dryRun.runId}</span>. Matrix doesn't start runs; this mirrors what Harness reported.
      </span>
      <div className={styles.tableFix}>
        <DataTable
          id={`dryrun-${item._id}`}
          rows={item.dryRun.results}
          columns={columns}
          rowKey={(r) => r.testId}
          noun={{ one: 'result', many: 'results' }}
          minWidth={520}
        />
      </div>
    </div>
  );
}
