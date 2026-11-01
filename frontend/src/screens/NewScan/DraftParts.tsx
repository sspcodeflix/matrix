import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { startScan } from './api';
import type { ScanDraftStore } from './draftStore';
import {
  membershipButtonId, originLabel, plural, readiness, roleButtonId, roleLabel, summaryLine, typeLabel, versionLabel,
  type Readiness, type ScanComponent,
} from './scanDraft';
import styles from './NewScan.module.css';

/** Moves focus to a row's confirm button; reports when filters or paging hide it. */
function focusById(id: string, name: string, onHidden: (message: string) => void) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  } else {
    onHidden(`${name} is hidden by the current search, filters or page. Clear them to confirm or remove it.`);
  }
}

function NameLinks({ components, buttonId, onHidden }: {
  components: ScanComponent[];
  buttonId: (c: ScanComponent) => string;
  onHidden: (message: string) => void;
}) {
  return (
    <>
      {components.map((c, i) => (
        <span key={c._id}>
          {i > 0 && (i === components.length - 1 ? ' and ' : ', ')}
          <button type="button" className={styles.inlineLink} onClick={() => focusById(buttonId(c), c.name, onHidden)}>
            {c.name}
          </button>
        </span>
      ))}
    </>
  );
}

/** The first readiness blocker, shown beside "Review and start" on every input method. */
export function ReadinessNote({ readiness: r, onHidden }: { readiness: Readiness; onHidden: (message: string) => void }) {
  const b = r.blocker;
  if (!b) return <>Ready to review.</>;
  switch (b.kind) {
    case 'empty':
      return <>Add at least one component before the scan can start.</>;
    case 'membership':
      return (
        <>
          Confirm or remove <NameLinks components={b.components} buttonId={membershipButtonId} onHidden={onHidden} /> before the scan can start.
        </>
      );
    case 'role':
      return (
        <>
          Check the suggested role for <NameLinks components={b.components} buttonId={roleButtonId} onHidden={onHidden} /> before the scan can start.
        </>
      );
    case 'no-source':
      return <>Add at least one source component before the scan can start.</>;
    case 'no-automation':
      return <>Add at least one automation component so Matrix can map existing tests.</>;
  }
}

/** Two-step "Discard draft" control. Clears the draft everywhere it is saved. */
export function DiscardDraft({ store, appName, onDiscarded }: {
  store: ScanDraftStore;
  appName: string;
  onDiscarded: (message: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const d = store.draft;
  if (!d) return null;
  const hasWork = d.components.length > 0 || d.removed.length > 0 || d.discoverySeeded;
  if (asking) {
    return (
      <span className={styles.discardAsk} role="group" aria-label="Discard draft">
        <span className="small">
          Discard this draft for {appName}? Its {plural(d.components.length, 'component')}, confirmations and removals are cleared.
        </span>
        <span className="row" style={{ '--gap': '8px' } as CSSProperties}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              store.actions.discard();
              setAsking(false);
              onDiscarded(`Draft discarded. A new draft for ${appName} has started.`);
            }}
          >
            Discard draft
          </button>
          <button type="button" className="btn ghost" onClick={() => setAsking(false)} autoFocus>Keep draft</button>
        </span>
      </span>
    );
  }
  return (
    <button type="button" className="btn ghost" disabled={!hasWork} onClick={() => setAsking(true)}>
      Discard draft
    </button>
  );
}

/** Step 2, shared by all input methods. */
export function ReviewStep({ store, appId }: { store: ScanDraftStore; appId: string }) {
  const [starting, setStarting] = useState(false);
  const d = store.draft!;
  const r = readiness(d.components);
  const summary = summaryLine(r);
  const start = () => {
    setStarting(true);
    startScan(appId, d.components).then((res) => {
      setStarting(false);
      store.actions.markStarted(res.scanId);
    });
  };

  return (
    <section aria-labelledby="review-heading" className={`card ${styles.review}`}>
      <h2 id="review-heading" style={{ fontSize: 16 }}>Review scan</h2>
      <p className="secondary" style={{ fontSize: 13 }}>
        {summary}. Matrix pins each component to the commit or file hash below, maps requirements to existing tests and
        saves a snapshot for Compare scans. Starting a scan does not run any tests; Harness runs them from Git.
      </p>
      <ul className={styles.reviewList}>
        {d.components.map((c) => (
          <li key={c._id}>
            <strong className={styles.reviewName}>{c.name}</strong>
            <span className="secondary">{roleLabel(c.role)} · {typeLabel(c)} · {originLabel(c)}</span>
            <span className="mono small">{versionLabel(c)}</span>
          </li>
        ))}
      </ul>
      <div className="row" role="status">
        {d.startedScanId ? (
          <div className="banner success grow">
            <Icon name="check" size={16} />
            <span>
              Scan <span className="mono">{d.startedScanId}</span> queued with {summary}. It saves a snapshot when it finishes.{' '}
              <Link to="/processing?workflow=regression">Follow processing</Link> or <Link to="/regression">go back to Regression</Link>.
            </span>
            <button type="button" className="btn" onClick={() => store.actions.discard()}>Set up another scan</button>
          </div>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => store.actions.setStep('components')} disabled={starting}>
              Back to components
            </button>
            <button type="button" className="btn primary" onClick={start} disabled={starting || r.blocker !== null}>
              {starting ? 'Starting…' : 'Start scan'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
