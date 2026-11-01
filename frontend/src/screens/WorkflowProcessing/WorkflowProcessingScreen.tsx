// Reference: design/html/WorkflowProcessing.html (+ design/assets/workflow-control.js), docs/WORKFLOW_CONTROL.md
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { ErrorState, Loading } from '../../components/ui';
import { fetchProcessingFixture, type JobState, type ProcessingFixture, type WorkflowKey } from './api';
import styles from './WorkflowProcessing.module.css';

interface Attempt {
  id: string;
  completed: number;
  state: 'stopped' | 'completed';
}

interface Sim {
  state: JobState;
  /** True between clicking Stop and the server acknowledging it (fence installed). */
  requesting: boolean;
  completed: number;
  sequence: number;
  parent: string | null;
  history: Attempt[];
}

const STATE_LABEL: Record<JobState, string> = {
  running: 'Running',
  stop_requested: 'Stop requested',
  stopping: 'Stopping',
  stopped: 'Stopped',
  completed: 'Completed',
};

export default function WorkflowProcessingScreen() {
  const { data, error, loading } = useApi(fetchProcessingFixture);
  if (error) return <ErrorState error={new Error('The sample data could not be loaded. Reload this page to try the local processing preview.')} />;
  if (loading || !data) return <Loading />;
  return <Processing fixture={data} />;
}

function Processing({ fixture }: { fixture: ProcessingFixture }) {
  const [params, setParams] = useSearchParams();
  const workflow: WorkflowKey = params.get('workflow') === 'acceptance' ? 'acceptance' : 'regression';
  const current = fixture.workflows[workflow];
  const total = current.units.length;

  const initialSim = (): Sim => ({
    state: 'running', requesting: false, completed: fixture.initialCompleted, sequence: 1, parent: null, history: [],
  });
  const [sim, setSim] = useState<Sim>(initialSim);
  const [showResults, setShowResults] = useState(false);
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<Attempt | null>(null);

  const timers = useRef<number[]>([]);
  const stopBtn = useRef<HTMLButtonElement>(null);
  const continueBtn = useRef<HTMLButtonElement>(null);
  const newBtn = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<'stop' | 'continue' | 'new' | null>(null);

  const attemptId = (seq = sim.sequence) => `${current.attemptPrefix}-${String(seq).padStart(2, '0')}`;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const reset = useCallback(() => {
    clearTimers();
    setSim(initialSim());
    setShowResults(false);
    setDetail(null);
    setMessage(
      `Local ${current.label} example running. ${fixture.initialCompleted} drafts are saved; one draft is in progress. No live job is connected.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

  // Switching workflow (URL) restarts the example; timers never outlive the page.
  useEffect(() => {
    reset();
    return clearTimers;
  }, [reset]);

  // Move focus to the next sensible action after a transition, mirroring the reference script.
  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === 'stop') stopBtn.current?.focus();
    if (target === 'continue') continueBtn.current?.focus();
    if (target === 'new') newBtn.current?.focus();
  }, [sim]);

  useEffect(() => {
    if (detail) detailRef.current?.focus();
  }, [detail]);

  const stop = () => {
    if (sim.state !== 'running' || sim.requesting) return;
    setSim((s) => ({ ...s, requesting: true }));
    setMessage('Sending stop request…');
    // 1. Server records the stop and installs the dispatch fence, then acknowledges.
    later(fixture.ackDelayMs, () => {
      setSim((s) => ({ ...s, requesting: false, state: 'stop_requested' }));
      setMessage('Stop requested. No new units will start. The current demo unit is finishing safely; completed work remains saved.');
      // 2. Workers settle the in-flight operation.
      later(fixture.settleDelayMs, () => {
        setSim((s) => ({ ...s, state: 'stopping' }));
        setMessage('Stopping. Waiting for the current demo unit to reach a safe boundary and record a checkpoint.');
        // 3. In-flight operation finished and reconciled.
        later(fixture.stopDelayMs, () => {
          const hadFocus = document.activeElement === stopBtn.current || document.activeElement === document.body;
          setSim((s) => {
            const completed = Math.min(s.completed + 1, total);
            const state = completed === total ? 'completed' : 'stopped';
            setMessage(
              state === 'completed'
                ? 'The final demo unit finished before stopping. All drafts are saved; human review is still required.'
                : `Stopped at a safe checkpoint. ${completed} drafts are saved; ${total - completed} units remain. Nothing already published was undone.`,
            );
            if (hadFocus) focusAfter.current = state === 'completed' || !current.checkpointSupported ? 'new' : 'continue';
            return { ...s, completed, state };
          });
        });
      });
    });
  };

  const continueFromCheckpoint = () => {
    if (sim.state !== 'stopped' || !current.checkpointSupported) return;
    const prior = attemptId();
    focusAfter.current = 'stop';
    setSim((s) => ({ ...s, history: [...s.history, { id: prior, completed: s.completed, state: 'stopped' }], sequence: s.sequence + 1, parent: prior, state: 'running' }));
    setMessage(`New linked demo attempt ${attemptId(sim.sequence + 1)} continues ${prior}. ${sim.completed} saved drafts are reused; only the remaining units are scheduled.`);
  };

  const startNew = () => {
    if (sim.state !== 'stopped' && sim.state !== 'completed') return;
    const prior: Attempt = { id: attemptId(), completed: sim.completed, state: sim.state };
    focusAfter.current = 'stop';
    setSim((s) => ({ ...s, history: [...s.history, prior], sequence: s.sequence + 1, parent: null, completed: 0, state: 'running' }));
    setMessage(`New demo attempt ${attemptId(sim.sequence + 1)} starts with freshly checked inputs. Previous saved drafts remain in history.`);
  };

  const { state, requesting, completed } = sim;
  const active = state === 'running' || state === 'stop_requested' || state === 'stopping';
  const pct = Math.round((completed / total) * 100);
  const stepStatus = (i: number) => {
    if (i < current.currentStep) return 'Saved';
    if (i > current.currentStep) return 'Not started by this preview';
    return state === 'completed' ? 'Drafts saved' : STATE_LABEL[state];
  };
  const title = state === 'stopped' ? 'Processing stopped' : state === 'completed' ? 'Draft work complete' : current.activity;
  const note =
    state === 'stop_requested' || state === 'stopping'
      ? 'Stop requested. Waiting for the current operation to reach a safe boundary.'
      : state === 'stopped'
        ? 'No new units will start in this attempt.'
        : state === 'completed'
          ? 'Continue to human review in the real workflow.'
          : 'Completed work is kept. Stop takes effect at the next safe boundary.';
  const output = current.output.charAt(0).toUpperCase() + current.output.slice(1);

  return (
    <div className="page" style={{ gap: 22 }}>
      <div className={styles.heading}>
        <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <span className={styles.previewTag}>Interactive design preview • sample data · {fixture.appName}</span>
          <h1>{current.label} processing</h1>
          <p className="muted">{current.scope}</p>
        </div>
        <div className={styles.switcher} role="group" aria-label="Preview workflow">
          {(['acceptance', 'regression'] as WorkflowKey[]).map((w) => (
            <button key={w} type="button" aria-pressed={w === workflow} onClick={() => setParams({ workflow: w }, { replace: true })}>
              {fixture.workflows[w].label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.previewInfo}>
        <p>
          Try <strong>Stop processing</strong> to see a safe stop, saved drafts and checkpoint continuation. All state changes
          stay in this page; no real jobs or external actions run.
        </p>
        <button type="button" className="link-btn" style={{ padding: '0 8px' }} onClick={reset}>Reset example</button>
      </div>

      <section className={`card ${styles.processing}`} aria-labelledby="activity-title">
        <div className="spread">
          <h2 id="activity-title" style={{ fontSize: 18 }}>{title}</h2>
          <span className={styles.status} data-state={state}>
            <span className={styles.statusDot} aria-hidden="true" />
            {STATE_LABEL[state]}
          </span>
        </div>
        <div className={styles.attempt}>
          <code>{attemptId()}</code>
          <span aria-hidden="true">·</span>
          <span>Pinned input <code>{fixture.sourceVersion}</code></span>
          {sim.parent && <><span aria-hidden="true">·</span><span>Continues <code>{sim.parent}</code></span></>}
        </div>

        <ol className={styles.steps} aria-label="Workflow stages">
          {current.steps.map((name, i) => (
            <li key={name} className={i < current.currentStep ? styles.done : i === current.currentStep ? styles.current : undefined}>
              {name}
              <span>{stepStatus(i)}</span>
            </li>
          ))}
        </ol>

        <div className={styles.progressLabel}>
          <span>{completed} of {total} {current.output} saved</span>
          <strong>{pct}%</strong>
        </div>
        <div
          className={styles.progress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of ${total} ${current.output} saved`}
          aria-label="Saved work"
        >
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        <p className={styles.statusMessage} role="status" aria-live="polite" aria-atomic="true">{message}</p>

        <div className={styles.actions}>
          {active && (
            <button
              ref={stopBtn}
              type="button"
              className={`btn ${styles.stop}`}
              disabled={state !== 'running' || requesting}
              aria-describedby="stop-effect"
              onClick={stop}
            >
              {requesting ? 'Requesting stop…' : state === 'running' ? 'Stop processing' : 'Stopping…'}
            </button>
          )}
          {state === 'stopped' && current.checkpointSupported && (
            <button ref={continueBtn} type="button" className="btn primary" onClick={continueFromCheckpoint}>Continue from checkpoint</button>
          )}
          {(state === 'stopped' || state === 'completed') && (
            <button ref={newBtn} type="button" className="btn" onClick={startNew}>Start new attempt</button>
          )}
          <button type="button" className="btn" aria-expanded={showResults} aria-controls="output-list" onClick={() => setShowResults((v) => !v)}>
            {showResults ? 'Hide partial results' : 'View partial results'}
          </button>
          <p className={styles.actionNote}>{note}</p>
        </div>
        {active && (
          <p id="stop-effect" className={styles.effect}>
            Stops this Matrix task. Completed results and existing PRs remain. Harness runs continue.
          </p>
        )}

        {state === 'stopped' && (
          <div className={styles.checkpoint}>
            <strong>Completed work retained · <code>{fixture.checkpointPrefix}-{workflow.toUpperCase()}-{sim.sequence}</code></strong>
            <p>
              {current.checkpointSupported
                ? 'This example has unchanged pinned inputs and a valid checkpoint. Continue creates a new linked attempt and reuses saved drafts; the stopped attempt stays in history.'
                : 'This example cannot safely reuse its checkpoint. Start a new attempt with freshly checked inputs; saved drafts remain available in the stopped attempt.'}
            </p>
          </div>
        )}
      </section>

      <div className={styles.lower}>
        <section className="card" aria-labelledby="saved-heading">
          <div className="card-head">
            <h2 id="saved-heading" style={{ fontSize: 16 }}>Saved work</h2>
            <span className="eyebrow">Partial results</span>
          </div>
          <div className={styles.saved}>
            <div><strong>{completed}</strong><span>Drafts saved</span></div>
            <div><strong>{total - completed}</strong><span>Unfinished units</span></div>
            <div><strong>{state === 'running' || state === 'stop_requested' || state === 'stopping' ? 1 : 0}</strong><span>Currently in progress</span></div>
          </div>
          <div className={styles.outputBody}>
            <p>{output} are saved with their source references. Drafts still need review; partial work is not a completed coverage snapshot.</p>
            <ul id="output-list" className={styles.outputList} hidden={!showResults}>
              {current.units.slice(0, completed).map((u) => (
                <li key={u.id}>
                  <div><strong>{u.title}</strong><code>{u.id} · {fixture.sourceVersion}</code></div>
                  <span className={styles.savedLabel}>✓ Saved draft</span>
                </li>
              ))}
              {completed === 0 && <li><span className="small muted">No drafts saved in this attempt yet.</span></li>}
            </ul>
            {sim.history.length > 0 && (
              <section className={styles.history} aria-labelledby="history-heading">
                <h3 id="history-heading">Linked attempt history</h3>
                <ul>
                  {sim.history.map((a) => (
                    <li key={a.id}>
                      <button type="button" className="link-btn" onClick={() => setDetail(a)}>
                        {a.id} · {a.completed} drafts saved · {a.state === 'completed' ? 'Completed' : 'Stopped'}
                      </button>
                    </li>
                  ))}
                </ul>
                {detail && (
                  <div ref={detailRef} className={styles.historyNote} tabIndex={-1}>
                    <strong>{detail.id} · {detail.state === 'completed' ? 'Completed' : 'Stopped'} demo attempt</strong>
                    <p>Its {detail.completed} saved drafts remain unchanged. The current attempt is {attemptId()}.</p>
                    <ul>
                      {current.units.slice(0, detail.completed).map((u) => <li key={u.id}>{u.id}: {u.title} · Saved draft</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="boundary-heading">
          <div className="card-head">
            <h2 id="boundary-heading" style={{ fontSize: 16 }}>What stopping means</h2>
          </div>
          <div className={styles.safe}>
            <p><strong>Current attempt only.</strong><br />New units stop being scheduled. The current operation reaches a safe boundary before the attempt is marked stopped.</p>
            <p><strong>Keep what is already saved.</strong><br />Completed drafts and source references remain available. A partial result does not become an approved test or a full coverage result.</p>
            <p>{current.externalNote}</p>
          </div>
        </section>
      </div>

      <div className="row" style={{ '--gap': '16px' } as CSSProperties}>
        <Link className="btn" to={workflow === 'acceptance' ? '/acceptance' : '/regression'}>Back to {current.label}</Link>
        <span className="muted">Reloading or resetting starts the local example again.</span>
      </div>
    </div>
  );
}
