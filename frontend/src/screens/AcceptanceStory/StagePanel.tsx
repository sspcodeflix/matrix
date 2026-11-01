import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { Chip, Pill } from '../../components/ui';
import { FeedbackCard, useFeedbackGate, type Generation } from '../../features/feedback';
import type { StageKey, StageState } from './api';
import { STAGE_META, fmtTime } from './meta';
import styles from './AcceptanceStory.module.css';

/**
 * One AI stage: output, evidence, feedback card and stage actions. "Move on" is disabled until
 * this output (this revision) is rated, with a comment below 4 stars.
 */
export function StagePanel({ stage, state, userId, previousTitle, busy, onAccept, onRegenerate, children, extraActions, release }: {
  stage: StageKey;
  state: StageState;
  userId: string;
  previousTitle?: string;
  busy: 'accept' | 'regenerate' | null;
  onAccept: () => void;
  onRegenerate: (instruction: string) => void;
  children: ReactNode;
  extraActions?: ReactNode;
  /** Set-level release rules beyond the rating (test cases): a blocker, and what accepting releases. */
  release?: { blocker?: string; note?: ReactNode };
}) {
  const meta = STAGE_META[stage];
  const headingId = useId();
  const reasonId = useId();
  const instrId = useId();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = useState('');
  const generation = state.generation;
  const gate = useFeedbackGate(generation ? [generation] : []);
  const blocker = gate.ready ? release?.blocker : undefined;

  const focusFeedback = () => {
    const el = feedbackRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  };

  return (
    <section className={`card ${styles.panel}`} aria-labelledby={headingId} id={`panel-${stage}`}>
      <div className={styles.panelHead}>
        <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
          <h2 id={headingId} style={{ fontSize: 18 }}>{meta.title}</h2>
          <span className="small secondary">{meta.output}</span>
        </div>
        <StatusPill state={state} />
      </div>

      {state.status === 'not_started' && (
        <div className="banner" role="status">
          <Icon name="info" />
          <span>Starts when {previousTitle ?? 'the previous stage'} is accepted.</span>
        </div>
      )}

      {generation && <GenerationMeta generation={generation} />}

      {state.instruction && state.status === 'needs_review' && (
        <div className="banner" role="status">
          <Icon name="sparkle" />
          <span>Regenerated as revision {generation?.outputRevision} with your instruction: “{state.instruction}”. Rate the new output.</span>
        </div>
      )}

      {busy === 'regenerate' ? <p className="muted" role="status">Matrix is regenerating this output…</p> : state.status !== 'not_started' && children}

      {generation && (
        <div ref={feedbackRef} className={styles.feedbackWrap}>
          <FeedbackCard key={`${generation.generationId}@${generation.outputRevision}`} generation={generation} userId={userId} title={meta.feedbackTitle} />
        </div>
      )}

      {state.status === 'accepted' && (
        <p className="small secondary">
          <Icon name="check" size={14} /> Accepted by {state.acceptedBy}, {fmtTime(state.acceptedAt)}. {meta.acceptedNote}
        </p>
      )}

      {state.status === 'needs_review' && generation && (
        <div className={styles.actions}>
          <div className={styles.regen}>
            <div className="field">
              <label htmlFor={instrId}>Instruction for regeneration <span className="muted">(optional)</span></label>
              <input
                id={instrId}
                className="input"
                value={instruction}
                maxLength={300}
                placeholder="e.g. Add a negative case for each criterion"
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => {
                onRegenerate(instruction);
                setInstruction('');
              }}
            >
              <Icon name="regression" size={16} />
              {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          <span className="small muted">Regenerating creates revision {generation.outputRevision + 1}, which needs its own rating.</span>
          <div className={styles.moveOn}>
            <button
              type="button"
              className="btn primary"
              disabled={!gate.ready || !!blocker || busy !== null}
              aria-describedby={!gate.ready || blocker || release?.note ? reasonId : undefined}
              onClick={onAccept}
            >
              {busy === 'accept' ? 'Accepting…' : meta.accept}
            </button>
            {!gate.ready ? (
              <span id={reasonId} className={styles.reason}>
                {gate.reason} (with a comment below 4 stars).
                <button type="button" className="link-btn" onClick={focusFeedback}>Go to rating</button>
              </span>
            ) : blocker ? (
              <span id={reasonId} className={styles.reason}>{blocker}.</span>
            ) : release?.note ? (
              <span id={reasonId} className="small secondary">{release.note}</span>
            ) : null}
            {extraActions}
          </div>
        </div>
      )}
      {state.status !== 'needs_review' && extraActions && <div className={styles.moveOn}>{extraActions}</div>}
    </section>
  );
}

function StatusPill({ state }: { state: StageState }) {
  switch (state.status) {
    case 'accepted': return <Pill tone="success">Accepted</Pill>;
    case 'needs_review': return <Pill tone="accent">Needs your review</Pill>;
    case 'generating': return <Pill>Matrix generating</Pill>;
    case 'not_started': return <Pill>Not started</Pill>;
  }
}

function GenerationMeta({ generation: g }: { generation: Generation }) {
  return (
    <div className={styles.genMeta}>
      <Chip>rev {g.outputRevision}</Chip>
      <Chip>{g.model}</Chip>
      {g.skills.map((s) => <Chip key={s}>{s}</Chip>)}
      {/* TODO(integration): MLflow trace link. */}
      <a href="#" className={`mono small ${styles.trace}`}>trace {g.mlflowTraceId}</a>
      <span className="small muted">generated {fmtTime(g.generatedAt)}</span>
    </div>
  );
}
