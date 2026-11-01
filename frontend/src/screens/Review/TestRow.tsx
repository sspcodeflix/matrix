import { useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { REJECTION_REASONS, type RejectionReason, type ReviewTest } from './api';
import styles from './Review.module.css';

type Mode = 'view' | 'reject' | 'edit';

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/** One test in the Tests tab: Accept, Reject (reason required) or Edit. Decisions are Matrix records, not PR approvals. */
export function TestRow({ test, expanded, onToggle, onChange, last, lockReasonId }: {
  test: ReviewTest;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: ReviewTest) => void;
  last: boolean;
  /** Set while a PR approval is in flight: decisions are disabled and described by this element. */
  lockReasonId?: string;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [reason, setReason] = useState<RejectionReason | ''>('');
  const [note, setNote] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [title, setTitle] = useState(test.title);
  const [stepsText, setStepsText] = useState(test.steps.join('\n'));
  const [editError, setEditError] = useState<string | null>(null);
  const id = useId();
  const stepsId = `${id}-steps`;

  const decided = test.state === 'accepted' || test.state === 'rejected';
  const locked = !!lockReasonId;
  const lockProps = { disabled: locked, 'aria-describedby': lockReasonId };
  const reasonLabel = REJECTION_REASONS.find((r) => r.value === test.rejection?.reason)?.label;

  const submitReject = () => {
    if (locked) return;
    if (!reason) {
      setReasonError(true);
      return;
    }
    onChange({ ...test, state: 'rejected', rejection: { reason, note: note.trim() } });
    setMode('view');
  };

  const saveEdit = () => {
    if (locked) return;
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) return setEditError('Give the test a title.');
    if (steps.length === 0) return setEditError('Add at least one step.');
    onChange({ ...test, title: title.trim(), steps, state: 'edited', revision: test.revision + 1, rejection: undefined });
    setEditError(null);
    setMode('view');
  };

  const markClass =
    test.state === 'accepted' ? styles.markAccepted
    : test.state === 'rejected' ? styles.markRejected
    : test.state === 'stale' ? styles.markStale
    : '';

  return (
    <div className={styles.test} style={last ? { borderBottom: 0 } : undefined}>
      <div className={styles.testRow}>
        <span className={`${styles.mark} ${markClass}`} aria-hidden="true">
          {test.state === 'accepted' && <Icon name="check" size={14} strokeWidth={2.4} />}
          {test.state === 'rejected' && <Icon name="close" size={14} strokeWidth={2.4} />}
        </span>
        <span className={styles.testMain}>
          <button type="button" className={styles.testTitle} aria-expanded={expanded} aria-controls={stepsId} onClick={onToggle}>
            {test.title}
          </button>
          <span className={styles.testCovers}>
            Covers: {test.covers} · <span className="mono">{test._id}</span> · rev {test.revision}
          </span>
        </span>

        {test.state === 'accepted' && (
          <span className={`${styles.decision} ${styles.accepted}`}>
            Accepted
            <button type="button" className="link-btn" style={{ minHeight: 36, fontSize: 12 }} {...lockProps} onClick={() => onChange({ ...test, state: 'draft' })}>
              Undo<span className="sr-only"> acceptance of {test._id}</span>
            </button>
          </span>
        )}
        {test.state === 'rejected' && (
          <span className={`${styles.decision} ${styles.rejected}`}>
            Rejected: {reasonLabel}
            <button type="button" className="link-btn" style={{ minHeight: 36, fontSize: 12 }} {...lockProps} onClick={() => onChange({ ...test, state: 'draft', rejection: undefined })}>
              Undo<span className="sr-only"> rejection of {test._id}</span>
            </button>
          </span>
        )}
        {!decided && mode === 'view' && (
          <span className={styles.testActions}>
            {test.state === 'stale' && <Pill tone="warning">Changed since accepted (rev {test.acceptedRevision})</Pill>}
            {test.state === 'edited' && <Pill>Edited</Pill>}
            <button type="button" className="btn icon" aria-label={`Edit ${test._id}`} {...lockProps} onClick={() => setMode('edit')}>
              <PencilIcon />
            </button>
            <button type="button" className="btn" {...lockProps} onClick={() => setMode('reject')}>
              Reject<span className="sr-only"> {test._id}</span>
            </button>
            <button type="button" className="btn dark" {...lockProps} onClick={() => onChange({ ...test, state: 'accepted', acceptedRevision: undefined })}>
              Accept<span className="sr-only"> {test._id}</span>
            </button>
          </span>
        )}
      </div>

      {expanded && mode !== 'edit' && (
        <ol id={stepsId} className={styles.steps}>
          {test.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      {mode === 'reject' && (
        <form
          className={styles.panel}
          aria-label={`Reject ${test._id}`}
          onSubmit={(e) => {
            e.preventDefault();
            submitReject();
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-reason`}>Why are you rejecting it? (required)</label>
            <select
              id={`${id}-reason`}
              className="select"
              value={reason}
              aria-invalid={reasonError || undefined}
              aria-describedby={reasonError ? `${id}-reason-err` : undefined}
              onChange={(e) => {
                setReason(e.target.value as RejectionReason);
                setReasonError(false);
              }}
            >
              <option value="">Choose a reason</option>
              {REJECTION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {reasonError && <span id={`${id}-reason-err`} className={styles.error} role="alert">Choose a reason before rejecting.</span>}
          </div>
          <div className="field">
            <label htmlFor={`${id}-note`}>Note for Matrix (optional)</label>
            <textarea id={`${id}-note`} className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="small muted">Rejection reasons feed proposed skill changes; a person reviews those before they apply.</span>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode('view')}>Cancel</button>
            <button type="submit" className="btn dark" {...lockProps}>Reject test</button>
          </div>
        </form>
      )}

      {mode === 'edit' && (
        <form
          className={styles.panel}
          aria-label={`Edit ${test._id}`}
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-title`}>Title</label>
            <input id={`${id}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-edit-steps`}>Steps, one per line</label>
            <textarea id={`${id}-edit-steps`} className="textarea" rows={4} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
            <span className="small muted">Saving creates revision {test.revision + 1}. You still need to accept it.</span>
          </div>
          {editError && <span className={styles.error} role="alert">{editError}</span>}
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode('view')}>Cancel</button>
            <button type="submit" className="btn dark" {...lockProps}>Save changes</button>
          </div>
        </form>
      )}
    </div>
  );
}
