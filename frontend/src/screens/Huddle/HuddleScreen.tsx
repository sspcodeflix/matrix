// Reference: design/html/Huddle.html
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { useWorkTarget } from '../../navigation';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import {
  DECISION_TYPE_LABEL, fetchHuddle,
  type ActivityItem, type Decision, type DecisionStatus, type DecisionType, type HuddleData, type Person,
} from './api';
import styles from './Huddle.module.css';

const PAGE_SIZE = 4;
const STATUS_LABEL: Record<DecisionStatus, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };
const STATUS_TONE = { pending: 'accent', accepted: 'success', rejected: 'neutral' } as const;
const nowLabel = () => new Date().toTimeString().slice(0, 5);

/**
 * Resolves a cross-screen target (UI_UX_REVIEW C3): `item` is a decision ID; `ref` a story or
 * requirement ID, preferring a pending decision (e.g. a sign-off awaiting UAT) over settled ones.
 * Returns `missing` instead of falling back to an unrelated decision.
 */
function resolveTarget(decisions: Decision[], item: string | null, ref: string | null) {
  if (item) {
    const d = decisions.find((x) => x._id === item);
    return d ? { id: d._id, missing: null } : { id: undefined, missing: { id: item, byRef: false } };
  }
  if (ref) {
    const r = ref.trim().toLowerCase();
    const hits = decisions.filter((x) => x.frId?.toLowerCase() === r || x.storyId?.toLowerCase() === r);
    const d = hits.find((x) => x.status === 'pending') ?? hits[0];
    return d ? { id: d._id, missing: null } : { id: undefined, missing: { id: ref.trim(), byRef: true } };
  }
  return null;
}

export default function HuddleScreen() {
  const { data, error, loading } = useApi(fetchHuddle);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <Huddle initial={data} />;
}

function Avatar({ person }: { person?: Person }) {
  return (
    <span className={`${styles.avatar} ${styles[person?.tone ?? 'muted']}`} aria-hidden="true">
      {person?.initials ?? '?'}
    </span>
  );
}

function Huddle({ initial }: { initial: HuddleData }) {
  const download = useDownloadReport();
  const [decisions, setDecisions] = useState(initial.decisions);
  const [activity, setActivity] = useState(initial.activity);
  const target = useWorkTarget();
  const targetKey = `${target.item ?? ''}|${target.ref ?? ''}`;
  const pageOf = (id: string | undefined) => {
    const i = decisions.findIndex((d) => d._id === id);
    return i < 0 ? 1 : Math.floor(i / PAGE_SIZE) + 1;
  };
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    const t = resolveTarget(initial.decisions, target.item, target.ref);
    return t ? t.id : (initial.decisions.find((d) => d.status === 'pending' && d.frId) ?? initial.decisions[0])?._id;
  });
  const [missing, setMissing] = useState(() => resolveTarget(initial.decisions, target.item, target.ref)?.missing ?? null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(() => pageOf(selectedId));
  const [creating, setCreating] = useState(false);

  // A new link into Huddle while it is open re-targets without losing local decisions.
  const [seenTarget, setSeenTarget] = useState(targetKey);
  if (seenTarget !== targetKey) {
    setSeenTarget(targetKey);
    const t = resolveTarget(decisions, target.item, target.ref);
    if (t) {
      setSelectedId(t.id);
      setMissing(t.missing);
      setQuery('');
      setStatusFilter('');
      setPage(pageOf(t.id));
    }
  }
  const select = (id: string) => {
    setSelectedId(id);
    setMissing(null);
  };

  const people = useMemo(() => new Map(initial.people.map((p) => [p.userId, p])), [initial.people]);
  const me = people.get(initial.currentUserId);
  const personName = (id: string) => people.get(id)?.name ?? 'Unknown';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decisions.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (!q) return true;
      return [d.listTitle, d.subject, d.frId ?? '', d.storyId ?? '', d.origin ?? '', DECISION_TYPE_LABEL[d.type], personName(d.proposedBy)]
        .some((s) => s.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const selected = decisions.find((d) => d._id === selectedId);

  const log = (text: string) =>
    setActivity((a) => [{ id: `local-${Date.now()}`, userId: initial.currentUserId, text, at: nowLabel() } satisfies ActivityItem, ...a]);

  // TODO(backend): POST /api/decisions/{id}/accept | /reject; the server records the audit entry.
  const decide = (d: Decision, status: 'accepted' | 'rejected') => {
    setDecisions((all) => all.map((x) => (x._id === d._id ? { ...x, status, age: 'Just now' } : x)));
    log(`${me?.name ?? 'You'} ${status}: ${d.listTitle}`);
  };

  // TODO(backend): POST /api/decisions/{id}/comments.
  const addComment = (d: Decision, text: string) => {
    setDecisions((all) =>
      all.map((x) => (x._id === d._id ? { ...x, comments: [...x.comments, { userId: initial.currentUserId, text, at: 'Just now' }] } : x)),
    );
  };

  // TODO(backend): POST /api/apps/{appId}/decisions.
  const create = (d: Decision) => {
    setDecisions((all) => [d, ...all]);
    select(d._id);
    setPage(1);
    setQuery('');
    setStatusFilter('');
    log(`${me?.name ?? 'You'} proposed: ${d.listTitle}`);
  };

  const openDownload = () =>
    download.open({
      context: `Huddle · ${initial.application} · ${initial.release}`,
      reportTypes: [
        {
          key: 'decisions',
          label: 'Decision records',
          description: 'Decisions with status, reason, proposer, impact, comments and affected work.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        selected: selected ? { count: 1, unit: { one: 'decision', many: 'decisions' }, ids: [selected._id] } : undefined,
        filtered: { count: filtered.length, unit: { one: 'decision', many: 'decisions' }, spec: filterSpec({ q: query, status: statusFilter }) },
        full: { count: decisions.length, unit: { one: 'decision', many: 'decisions' } },
      },
      snapshot: `${initial.release} decisions · data as of ${initial.dataAsOf}`,
      filters: [statusFilter && `Status: ${STATUS_LABEL[statusFilter]}`, query && `Search: “${query}”`].filter(Boolean).join(' · ') || undefined,
    });

  return (
    <div className="page">
      {target.back && (
        <Link to={target.back.to} className={`row ${styles.back}`} style={{ '--gap': '4px', marginBottom: -12 } as CSSProperties}>
          <Icon name="chevronLeft" size={16} />
          {target.back.label}
        </Link>
      )}
      <PageHeader
        title="Huddle"
        subtitle={`Shared decisions and context for ${initial.application} · ${initial.release}`}
        actions={
          <>
            <DownloadButton onClick={openDownload} />
            <button type="button" className="btn dark" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} />
              New decision
            </button>
          </>
        }
      />

      <div className={styles.layout}>
        <div className={styles.listCol}>
          <section className={`card ${styles.panel}`} aria-labelledby="dl-heading">
            <div className={styles.panelHead}>
              <h2 id="dl-heading">Decisions</h2>
              <span className="small muted">{initial.application} · {initial.release}</span>
            </div>
            <div className="row">
              <label className={styles.search}>
                <Icon name="search" size={16} />
                <span className="sr-only">Search decisions</span>
                <input
                  type="search"
                  placeholder="Search decisions, FR, people"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
              </label>
              <button
                type="button"
                className="btn icon"
                aria-label={statusFilter ? `Filters, 1 active` : 'Filters'}
                aria-expanded={showFilters}
                aria-controls="decision-filters"
                onClick={() => setShowFilters((s) => !s)}
              >
                <Icon name="filter" size={16} />
              </button>
            </div>
            {showFilters && (
              <div id="decision-filters" className="field">
                <label htmlFor="decision-status">Status</label>
                <select
                  id="decision-status"
                  className="select"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as DecisionStatus | ''); setPage(1); }}
                >
                  <option value="">All statuses</option>
                  {(Object.keys(STATUS_LABEL) as DecisionStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]} · {decisions.filter((d) => d.status === s).length}</option>
                  ))}
                </select>
              </div>
            )}

            {pageRows.map((d) => (
              <button
                key={d._id}
                type="button"
                className={styles.item}
                aria-current={d._id === selectedId}
                onClick={() => select(d._id)}
              >
                <span className={styles.itemTop}>
                  <Pill tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Pill>
                  <span className={styles.meta}>{d.age}</span>
                </span>
                <span className={styles.itemTitle}>{d.listTitle}</span>
                <span className={styles.meta}>{d.origin ?? `${DECISION_TYPE_LABEL[d.type]} · ${personName(d.proposedBy)}`}</span>
              </button>
            ))}
            {pageRows.length === 0 && <p className="secondary small">No decisions match the current search and filters.</p>}

            <div className={styles.listFoot}>
              <span role="status">
                {filtered.length === 0 ? '0 decisions' : `${start + 1}–${start + pageRows.length} of ${filtered.length} decisions`}
              </span>
              <span className="row" style={{ '--gap': '4px' } as CSSProperties}>
                <button type="button" className="btn icon" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  <Icon name="chevronLeft" size={16} />
                </button>
                <button type="button" className="btn icon" aria-label="Next page" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                  <Icon name="chevronRight" size={16} />
                </button>
              </span>
            </div>
          </section>
        </div>

        <div className={styles.mainCol}>
          {missing ? (
            <section className="card card-pad stack" aria-labelledby="hd-missing" style={{ '--gap': '10px' } as CSSProperties}>
              <h2 id="hd-missing" style={{ fontSize: 16 }}>
                {missing.byRef ? <>No decision or sign-off for <span className="mono">{missing.id}</span> yet</> : <>Decision <span className="mono">{missing.id}</span> was not found</>}
              </h2>
              <p className="secondary small">
                {missing.byRef
                  ? 'A UAT sign-off appears here once every acceptance criterion of the story has accepted test cases in Review. Other decisions about it appear when someone proposes one with New decision. Nothing else is shown in its place.'
                  : 'It may have been withdrawn, or belong to another application or release. Nothing else is shown in its place.'}
              </p>
              <span className="row">
                {target.back && <Link to={target.back.to} className="btn">{target.back.label}</Link>}
                <button type="button" className="btn" onClick={() => setMissing(null)}>Show all decisions</button>
              </span>
            </section>
          ) : selected ? (
            <Thread
              key={selected._id}
              decision={selected}
              people={people}
              currentUserId={initial.currentUserId}
              onDecide={decide}
              onComment={addComment}
            />
          ) : (
            <section className="card card-pad secondary">Select a decision to see its thread.</section>
          )}
        </div>

        <div className={styles.sideCol}>
          <section className={`card ${styles.panel}`} aria-labelledby="act-heading">
            <div className={styles.panelHead}>
              <h2 id="act-heading">Activity</h2>
              <span className="small muted">from the audit log</span>
            </div>
            <ul className={styles.activity} aria-live="polite">
              {activity.map((a) => (
                <li key={a.id}>
                  <Avatar person={people.get(a.userId)} />
                  <span className="grow" style={{ fontSize: 13 }}>{a.text}</span>
                  <span className={styles.time}>{a.at}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={`card ${styles.panel}`} aria-labelledby="ppl-heading">
            <div className={styles.panelHead}>
              <h2 id="ppl-heading">In this huddle</h2>
            </div>
            <ul className={styles.activity}>
              {initial.people.map((p) => (
                <li key={p.userId}>
                  <Avatar person={p} />
                  <span style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span> <span className="muted">· {p.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <NewDecisionDialog
        open={creating}
        onClose={() => setCreating(false)}
        release={initial.release}
        proposedBy={initial.currentUserId}
        onCreate={(d) => { create(d); setCreating(false); }}
      />
    </div>
  );
}

function Thread({ decision: d, people, currentUserId, onDecide, onComment }: {
  decision: Decision;
  people: Map<string, Person>;
  currentUserId: string;
  onDecide: (d: Decision, status: 'accepted' | 'rejected') => void;
  onComment: (d: Decision, text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const proposer = people.get(d.proposedBy);
  const pending = d.status === 'pending';
  const ownProposal = d.proposedBy === currentUserId;
  const disabledReason = !pending
    ? `This decision was ${d.status}. Propose a new decision to change it.`
    : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onComment(d, text);
    setDraft('');
  };

  return (
    <section className="card" aria-labelledby="th-heading">
      <div className={styles.threadHead}>
        <span className="row">
          {pending ? <Pill tone="accent">{ownProposal ? 'Pending review' : 'Pending your review'}</Pill> : <Pill tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Pill>}
          <span className="chip">{DECISION_TYPE_LABEL[d.type]}</span>
        </span>
        <h2 id="th-heading" className={styles.threadTitle}>
          {d.frId && <span className="mono">{d.frId} </span>}
          {d.storyId && <span className="mono">{d.storyId}{d.storyRevision ? ` rev ${d.storyRevision}` : ''} </span>}
          {d.subject}
        </h2>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={!pending}
            aria-describedby={disabledReason ? 'decide-reason' : undefined}
            onClick={() => onDecide(d, 'rejected')}
          >
            Reject
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pending}
            aria-describedby={disabledReason ? 'decide-reason' : undefined}
            onClick={() => onDecide(d, 'accepted')}
          >
            Accept
          </button>
          {disabledReason && <span id="decide-reason" className="small muted" role="status">{disabledReason}</span>}
        </div>
      </div>
      <div className={styles.facts}>
        <div className={styles.fact}>
          <span className="eyebrow">Proposed by</span>
          <span className={styles.factValue} style={{ fontWeight: 500 }}>
            {proposer ? `${proposer.name} · ${proposer.role}` : 'Unknown'}
          </span>
        </div>
        <div className={styles.fact}>
          <span className="eyebrow">Reason</span>
          <span className={styles.factValue}>{d.reason}</span>
        </div>
        <div className={styles.fact}>
          <span className="eyebrow">{d.status === 'accepted' ? 'Impact' : 'If accepted'}</span>
          <span className={styles.factValue}>{d.impact}</span>
        </div>
      </div>
      <div className={styles.comments}>
        {d.comments.length === 0 && <p className="small muted">No comments yet.</p>}
        {d.comments.map((c, i) => {
          const p = people.get(c.userId);
          return (
            <div key={i} className={styles.comment}>
              <Avatar person={p} />
              <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                <span style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{p?.name ?? 'Unknown'}</span> <span className="muted">· {c.at}</span>
                </span>
                <p className={styles.commentText}>{c.text}</p>
              </div>
            </div>
          );
        })}
        <form className="field" onSubmit={submit}>
          <label htmlFor={`comment-${d._id}`}>Add a comment</label>
          <textarea
            id={`comment-${d._id}`}
            className="textarea"
            rows={2}
            style={{ minHeight: 60 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn" disabled={!draft.trim()}>Post comment</button>
          </div>
        </form>
      </div>
    </section>
  );
}

function NewDecisionDialog({ open, onClose, onCreate, release, proposedBy }: {
  open: boolean;
  onClose: () => void;
  onCreate: (d: Decision) => void;
  release: string;
  proposedBy: string;
}) {
  const [type, setType] = useState<DecisionType>('override');
  const [frId, setFrId] = useState('');
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState('');
  const valid = subject.trim() && reason.trim();

  const reset = () => { setType('override'); setFrId(''); setSubject(''); setReason(''); setImpact(''); };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const fr = frId.trim() || undefined;
    onCreate({
      _id: `local-${Date.now()}`,
      release,
      type,
      frId: fr,
      subject: subject.trim(),
      listTitle: fr ? `${fr} ${subject.trim()}` : subject.trim(),
      proposedBy,
      reason: reason.trim(),
      impact: impact.trim() || 'Not stated',
      status: 'pending',
      age: 'Just now',
      comments: [],
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New decision"
      subtitle="Proposed decisions stay pending until someone accepts or rejects them."
      width={560}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="new-decision" className="btn dark" disabled={!valid}>Propose decision</button>
        </div>
      }
    >
      <form id="new-decision" className="card-pad stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="nd-type">Type</label>
          <select id="nd-type" className="select" value={type} onChange={(e) => setType(e.target.value as DecisionType)}>
            {(Object.keys(DECISION_TYPE_LABEL) as DecisionType[]).map((t) => (
              <option key={t} value={t}>{DECISION_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nd-fr">Requirement (optional)</label>
          <input id="nd-fr" className="input mono" placeholder="FR-…" value={frId} onChange={(e) => setFrId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nd-subject">Decision</label>
          <input id="nd-subject" className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nd-reason">Reason</label>
          <textarea id="nd-reason" className="textarea" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nd-impact">If accepted</label>
          <input id="nd-impact" className="input" value={impact} onChange={(e) => setImpact(e.target.value)} />
        </div>
      </form>
    </Dialog>
  );
}
