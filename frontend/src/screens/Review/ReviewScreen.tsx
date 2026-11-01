// Reference: design/html/Review.html
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { fetchSession } from '../../api/session';
import { Icon } from '../../components/Icon';
import { ErrorState, Loading } from '../../components/ui';
import { useWorkTarget } from '../../navigation';
import { isCurrentComplete } from '../../features/feedback';
import { getSet, updateCase, useTestCaseStore } from '../../features/testcases';
import {
  approvePullRequest, fetchReviewQueue, fromReviewTest, generationOf, storyOf, toReviewTest, withSet, type QueueKey, type ReviewItem,
} from './api';
import { applyApproval, bindApproval, isBindingCurrent, toAccept, type ApprovalStatus } from './approval';
import { ReviewDetail } from './ReviewDetail';
import { kindLine } from './reviewFormat';
import styles from './Review.module.css';

const QUEUES: { key: QueueKey; label: string; heading: string }[] = [
  { key: 'mine', label: 'Mine', heading: 'Waiting on you' },
  { key: 'team', label: 'Team', heading: 'Waiting on your team' },
  { key: 'waiting', label: 'Waiting on others', heading: 'Waiting on others' },
];
const PAGE_SIZE = 5;

export default function ReviewScreen() {
  const queue = useApi(fetchReviewQueue);
  const session = useApi(fetchSession);
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [approvals, setApprovals] = useState<Record<string, ApprovalStatus>>({});
  const target = useWorkTarget();
  // Acceptance items show their story's shared test-case set (UI_UX_REVIEW R2).
  useTestCaseStore();
  // Latest items, read when an approval response arrives (it may arrive after newer decisions).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  if (items === null && queue.data) setItems(queue.data.items);

  const error = queue.error ?? session.error;
  if (error) return <ErrorState error={error} />;
  if (!items || !queue.data || !session.data) return <Loading />;
  const user = session.data.user;
  const setOf = (i: ReviewItem) => {
    const storyId = storyOf(i);
    return storyId ? getSet(storyId) : undefined;
  };
  const shown = items.map((i) => withSet(i, setOf(i)));

  /** Decisions on a story's cases go to the shared set; other items keep their own tests. */
  const change = (next: ReviewItem) => {
    const storyId = storyOf(next);
    const set = setOf(next);
    if (storyId && set) {
      for (const t of next.tests) {
        const c = set.cases.find((x) => x._id === t._id);
        if (c && JSON.stringify(toReviewTest(c)) !== JSON.stringify(t)) void updateCase(storyId, fromReviewTest(c, t));
      }
      return;
    }
    setItems((list) => (list ?? []).map((i) => (i._id === next._id ? next : i)));
  };

  const setApproval = (id: string, status: ApprovalStatus | null) =>
    setApprovals((a) => {
      const next = { ...a };
      if (status) next[id] = status;
      else delete next[id];
      return next;
    });

  /** Sends "Accept tests and approve PR" bound to the item's current revisions; applies the answer only if they still hold. */
  const approve = async (item: ReviewItem) => {
    // Same completion predicate as the button: the current revision (commit and test revisions) is rated.
    if (!item.pr || approvals[item._id]?.kind === 'pending' || !isCurrentComplete(generationOf(item))) return;
    const binding = bindApproval(item);
    const pr = item.pr.number;
    setApproval(item._id, { kind: 'pending', binding });
    try {
      const res = await approvePullRequest(binding);
      const now = itemsRef.current?.find((i) => i._id === item._id);
      if (now && isBindingCurrent(now, binding) && res.headCommit === binding.headCommit) {
        setItems((list) => (list ?? []).map((i) => (i._id === item._id ? applyApproval(i, binding) : i)));
        const n = toAccept(binding);
        setApproval(item._id, {
          kind: 'approved',
          message: `Accepted ${n} ${n === 1 ? 'test' : 'tests'} in Matrix and approved PR #${pr} at ${binding.headCommit} on GitHub (as ${user.name}). A person merges it in GitHub.`,
        });
      } else {
        const moved = res.headCommit !== binding.headCommit;
        setItems((list) =>
          (list ?? []).map((i) => (i._id === item._id && i.pr ? { ...i, pr: { ...i.pr, approval: 'stale', headCommit: res.headCommit } } : i)),
        );
        setApproval(item._id, {
          kind: 'stale',
          message: moved
            ? `Needs re-approval. GitHub recorded your approval at ${binding.headCommit}, but commit ${res.headCommit} landed on the branch while it was sent, so that approval is stale. Matrix did not record any acceptance. Review the new changes and approve again.`
            : `Needs re-approval. The tests changed while the approval was sent, so Matrix kept your newer decisions and did not record acceptance. The GitHub approval at ${binding.headCommit} is stale. Approve again when you are done.`,
        });
      }
    } catch (e) {
      setApproval(item._id, {
        kind: 'failed',
        message: `Approval failed: ${(e as Error).message} Nothing was recorded: no tests were accepted and PR #${pr} is not approved. Your decisions are unchanged; try again.`,
      });
    }
  };

  // Cross-screen target (UI_UX_REVIEW C3): `item` is the review item ID; `ref` the story or requirement ID.
  const itemParam = params.get('item');
  const refParam = target.ref?.trim() || null;
  const refMatches = (i: ReviewItem, ref: string) =>
    [i.requirement.id, i.ref.storyId, i.ref.frId].some((v) => v?.toLowerCase() === ref.toLowerCase());
  const targeted = itemParam
    ? shown.find((i) => i._id === itemParam)
    : refParam
      ? shown.find((i) => refMatches(i, refParam) && i.queue === params.get('queue')) ?? shown.find((i) => refMatches(i, refParam))
      : undefined;
  const missing = (itemParam || refParam) && !targeted ? { id: itemParam ?? refParam ?? '', byRef: !itemParam } : null;

  const active = QUEUES.find((q) => q.key === targeted?.queue) ?? QUEUES.find((q) => q.key === params.get('queue')) ?? QUEUES[0];
  const inQueue = shown.filter((i) => i.queue === active.key);
  const kw = keyword.trim().toLowerCase();
  const matches = kw
    ? inQueue.filter((i) =>
        [i.title, i.summary, kindLine(i), i.requirement.id, i.ref.storyId ?? '', i.ref.frId ?? '', i.pr ? `#${i.pr.number}` : '']
          .some((v) => v.toLowerCase().includes(kw)),
      )
    : inQueue;
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const selected = missing ? undefined : targeted ?? matches[0] ?? inQueue[0];

  const setParam = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );

  return (
    <div className="page" style={{ gap: 20 }}>
      <div className="stack" style={{ '--gap': '14px' } as CSSProperties}>
        <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
          {target.back && (
            <Link to={target.back.to} className={`row ${styles.back}`} style={{ '--gap': '4px' } as CSSProperties}>
              <Icon name="chevronLeft" size={16} />
              {target.back.label}
            </Link>
          )}
          <h1>Review queue</h1>
        </div>
        <div role="tablist" aria-label="Queues" className={styles.queueTabs}>
          {QUEUES.map((q) => (
            <button
              key={q.key}
              type="button"
              role="tab"
              aria-selected={q.key === active.key}
              className={styles.queueTab}
              onClick={() => {
                setParam({ queue: q.key === 'mine' ? null : q.key, item: null, ref: null });
                setPage(1);
                setKeyword('');
              }}
            >
              {q.label}
              <span className={styles.count}>{shown.filter((i) => i.queue === q.key).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.queueCol}>
          <section aria-labelledby="q-heading" className="card">
            <div className={styles.queueHead}>
              <h2 id="q-heading" style={{ fontSize: 14 }}>{active.heading}</h2>
              <label className={styles.search}>
                <Icon name="search" size={16} strokeWidth={2} />
                <span className="sr-only">Search review queue</span>
                <input
                  type="search"
                  placeholder="Search by FR, story or PR"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="muted small" style={{ padding: 14 }}>
                {inQueue.length === 0 ? 'Nothing waiting here.' : 'No items match your search.'}
              </p>
            ) : (
              <ul className={styles.queueItems}>
                {visible.map((i) => (
                  <li key={i._id}>
                    <button
                      type="button"
                      className={styles.queueItem}
                      aria-current={selected?._id === i._id ? 'true' : undefined}
                      onClick={() => setParam({ item: i._id, ref: null, queue: i.queue === 'mine' ? null : i.queue })}
                    >
                      <span className="spread" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <span className={styles.queueKind}>{kindLine(i)}</span>
                        <span className="small muted">{i.age}</span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{i.title}</span>
                      <span className="small muted">
                        {i.summary}
                        {active.key !== 'mine' && ` · ${i.assignee}`}
                      </span>
                      {approvals[i._id]?.kind === 'pending' && <span className="small muted">Approval request in progress</span>}
                      {approvals[i._id]?.kind === 'failed' && <span className={`small ${styles.errorText}`}>Approval failed</span>}
                      {approvals[i._id]?.kind === 'stale' && <span className="small muted">Needs re-approval</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.queueFoot}>
              <span role="status">
                {matches.length === 0 ? '0 of 0' : `${start + 1}–${start + visible.length} of ${matches.length}`}
              </span>
              <nav className="row" style={{ '--gap': '4px' } as CSSProperties} aria-label="Queue pages">
                <button type="button" className="btn icon" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  <Icon name="chevronLeft" size={16} />
                </button>
                <button type="button" className="btn icon" aria-label="Next page" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                  <Icon name="chevronRight" size={16} />
                </button>
              </nav>
            </div>
          </section>
        </div>

        <div className={styles.detailCol}>
          {missing ? (
            <section className="card card-pad stack" aria-labelledby="rv-missing" style={{ '--gap': '10px' } as CSSProperties}>
              <h2 id="rv-missing" style={{ fontSize: 16 }}>
                {missing.byRef ? <>No review for <span className="mono">{missing.id}</span> yet</> : <>Review item <span className="mono">{missing.id}</span> was not found</>}
              </h2>
              <p className="secondary small">
                {missing.byRef
                  ? 'A review item appears here when Matrix writes test cases for this story (Acceptance) or opens a matrix/* pull request for this requirement (Regression). Nothing else in the queue is about it.'
                  : 'It may have been completed or removed. Nothing else is shown in its place.'}
              </p>
              <span className="row">
                {target.back && <Link to={target.back.to} className="btn">{target.back.label}</Link>}
                <button type="button" className="btn" onClick={() => setParam({ item: null, ref: null })}>Show the review queue</button>
              </span>
            </section>
          ) : selected ? (
            <ReviewDetail
              key={selected._id}
              item={selected}
              caseSet={setOf(selected)}
              user={user}
              canPostApproval={queue.data.canPostApproval}
              snapshot={queue.data.snapshot}
              approval={approvals[selected._id]}
              onApprove={() => approve(selected)}
              onClearApproval={() => setApproval(selected._id, null)}
              onChange={change}
            />
          ) : (
            <div className="card card-pad muted">Select an item to review.</div>
          )}
        </div>
      </div>
    </div>
  );
}
