// Reference: design/html/NewScan.html
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Application } from '../../api/session';
import { useWorkspace } from '../../workspace/useWorkspace';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ErrorState, Loading } from '../../components/ui';
import { confirmComponent, fetchDiscovery, saveDefaultComponents, type DiscoveryResult } from './api';
import { DiscardDraft, ReadinessNote, ReviewStep } from './DraftParts';
import { useScanDraft, type ScanDraftStore } from './draftStore';
import {
  membershipButtonId, needsMembership, needsRole, ORIGIN_OPTIONS, originLabel, originNote, plural, readiness,
  roleButtonId, roleLabel, STATUS_OPTIONS, statusLabel, statusText, statusTone, summaryLine, typeLabel, versionLabel,
  type ScanComponent,
} from './scanDraft';
import styles from './NewScan.module.css';

const TABLE_ID = 'components';

export default function NewScanScreen() {
  // The application chosen in workspace context (sidebar or drill-down), not the session default.
  const { application: app } = useWorkspace();
  return <DiscoveryLoader key={app.id} app={app} />;
}

function DiscoveryLoader({ app }: { app: Application }) {
  const discovery = useApi(() => fetchDiscovery(app.id, app.name), [app.id]);
  const store = useScanDraft(app.id);
  const { draft, actions } = store;
  // Lives here so a notice (e.g. "Draft discarded") survives the brief reseed after a discard.
  const notice = useState<Notice>({ text: '', undo: false });

  // Discovery seeds the application's draft once; later visits keep confirmations and removals.
  useEffect(() => {
    if (draft && discovery.data && !draft.discoverySeeded) actions.seedFromDiscovery(discovery.data.components);
  }, [draft, discovery.data, actions]);
  useEffect(() => {
    if (draft && draft.mode !== 'auto') actions.setMode('auto');
  }, [draft, actions]);

  const error = discovery.error ?? store.error;
  if (error) return <ErrorState error={error} />;
  if (!discovery.data || !draft?.discoverySeeded) return <Loading />;
  return <NewScan app={app} found={discovery.data} store={store} notice={notice} />;
}

interface Notice { text: string; undo: boolean }

function NewScan({ app, found, store, notice }: {
  app: Application;
  found: DiscoveryResult;
  store: ScanDraftStore;
  notice: [Notice, (n: Notice) => void];
}) {
  const navigate = useNavigate();
  const { actions } = store;
  const draft = store.draft!;
  const components = draft.components;
  const [{ text: message, undo: undoable }, setNotice] = notice;

  const r = readiness(components);
  const discovered = components.filter((c) => c.origin === 'discovered');
  const unconfirmed = components.filter(needsMembership);
  const byMethod = (m: 'custom_property' | 'topic' | 'name') => discovered.filter((c) => c.discovery?.method === m).length;
  const lastRemoved = draft.removed[draft.removed.length - 1]?.component;

  const say = useCallback((text: string, canUndo = false) => setNotice({ text, undo: canUndo }), [setNotice]);

  const columns: Column<ScanComponent>[] = useMemo(
    () => [
      { key: 'name', header: 'Component', value: (c) => c.name, render: (c) => <span className={styles.name}>{c.name}</span> },
      { key: 'role', header: 'Role', value: (c) => roleLabel(c.role), filter: { type: 'select', options: ['Source', 'Automation'] } },
      { key: 'type', header: 'Type', value: typeLabel, filter: { type: 'select' } },
      {
        key: 'origin', header: 'Comes from', value: originLabel, filter: { type: 'select', options: ORIGIN_OPTIONS },
        render: (c) => (
          <span className={styles.origin}>
            <span className={styles.originChip}>{originLabel(c)}</span>
            <span className={styles.originNote}>{originNote(c)}</span>
          </span>
        ),
      },
      { key: 'version', header: 'Version', value: versionLabel, mono: true, filter: { type: 'none' } },
      {
        key: 'status', header: 'Status', value: statusLabel, filter: { type: 'select', options: STATUS_OPTIONS },
        render: (c) => (
          <span className={styles.status}>
            <span className="dot" style={{ background: statusTone(c) }} aria-hidden="true" />
            {statusText(c)}
          </span>
        ),
      },
      {
        key: 'actions', header: 'Actions', sortable: false, filter: { type: 'none' }, value: () => '',
        render: (c) => (
          <span className={styles.rowActions}>
            {needsMembership(c) && (
              <button
                type="button" id={membershipButtonId(c)} className="btn"
                onClick={() => {
                  actions.confirmMembership(c._id);
                  void confirmComponent(c._id);
                  say(`${c.name} confirmed as part of ${found.appId}.`);
                }}
                aria-label={`Confirm ${c.name} belongs to ${found.appId}`}
              >
                Confirm
              </button>
            )}
            {!needsMembership(c) && needsRole(c) && (
              <button
                type="button" id={roleButtonId(c)} className="btn"
                onClick={() => {
                  actions.confirmRole(c._id);
                  say(`${c.name} confirmed as ${roleLabel(c.role).toLowerCase()}.`);
                }}
                aria-label={`Confirm role ${roleLabel(c.role)} for ${c.name}`}
              >
                Confirm role
              </button>
            )}
            <button
              type="button" className={styles.removeBtn} aria-label={`Remove ${c.name}`}
              onClick={() => {
                actions.remove(c._id);
                say(`${c.name} removed from this scan.`, true);
              }}
            >
              Remove
            </button>
          </span>
        ),
      },
    ],
    [actions, found.appId, say],
  );

  const undoRemove = () => {
    const back = actions.undoRemove();
    say(back ? `${back.name} added back.` : '');
  };
  const rediscover = () => {
    // Re-adds discovered repositories that were removed; keeps confirmations already made.
    const names = actions.rediscover(found.components);
    say(
      names.length
        ? `Discovery ran again for ${found.appId}. Listed again: ${names.join(', ')}.`
        : `Discovery ran again for ${found.appId}. Every match is already in this scan.`,
    );
  };

  const summary = summaryLine(r);
  const step = draft.step === 'review' && (r.blocker === null || draft.startedScanId) ? 2 : 1;

  return (
    <div className="page">
      <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
        <Link className={styles.back} to="/regression">Back to Regression</Link>
        <h1>New regression scan</h1>
        <span className="secondary">Bring in the source and automation for {app.name}.</span>
      </div>

      <ol className={styles.stepper} aria-label="Scan steps">
        <li className={`${styles.stepItem} ${step === 2 ? styles.stepDone : ''}`} aria-current={step === 1 ? 'step' : undefined}>
          <span className={styles.stepNum}>{step === 2 ? <Icon name="check" size={12} strokeWidth={2.4} /> : 1}</span>Add components
        </li>
        <li aria-hidden="true" className={styles.stepLine} />
        <li className={styles.stepItem} aria-current={step === 2 ? 'step' : undefined}>
          <span className={styles.stepNum}>2</span>Review and start
        </li>
      </ol>

      {step === 1 ? (
        <>
          <section aria-labelledby="mode-heading" className="stack" style={{ '--gap': '10px' } as CSSProperties}>
            <h2 id="mode-heading" style={{ fontSize: 16 }}>How should Matrix find the components?</h2>
            <fieldset className={styles.modes}>
              <legend className="sr-only">Discovery mode</legend>
              <label className={styles.mode}>
                <input type="radio" name="mode" value="auto" defaultChecked />
                <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                  <span className={styles.modeTitle}>
                    Auto-discover from GitSaaS <span className="chip tone-success">Recommended</span>
                  </span>
                  <span className={styles.modeText}>
                    Matrix finds every repository tagged with this app ID, using your PAT, and sorts them into source and
                    automation. You can still add anything it misses.
                  </span>
                </span>
              </label>
              <label className={styles.mode}>
                <input type="radio" name="mode" value="manual" onChange={() => navigate('/scans/new/git')} />
                <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                  <span className={styles.modeTitle}>Add components yourself</span>
                  <span className={styles.modeText}>
                    Add components from Git links or ZIP files, one or many at a time. Source and automation can come from either.
                  </span>
                </span>
              </label>
            </fieldset>
          </section>

          <section aria-labelledby="disc-heading" className={`card ${styles.disc}`}>
            <div className={styles.discMain}>
              <h2 id="disc-heading" style={{ fontSize: 16 }}>
                Discovered {plural(discovered.length, 'repository', 'repositories')} for {found.appId}
              </h2>
              <p className="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Matched by repository tags in GitSaaS.{' '}
                {unconfirmed.length
                  ? `${unconfirmed.length === 1 ? 'One' : unconfirmed.length} matched by name only and ${unconfirmed.length === 1 ? 'needs' : 'need'} your confirmation.`
                  : 'Every match is confirmed.'}
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={rediscover}>Run discovery again</button>
                <Link className="btn" to="/scans/new/git">Add a missing component</Link>
              </div>
            </div>
            <ul className={styles.discList}>
              <li>
                <span>Custom property <span className="mono">{found.customProperty}</span></span>
                <span className={styles.count}>{plural(byMethod('custom_property'), 'repo')}</span>
              </li>
              <li>
                <span>Topic <span className="mono">{found.topic}</span></span>
                <span className={styles.count}>{plural(byMethod('topic'), 'repo')}</span>
              </li>
              <li>
                <span>Name match only</span>
                <span className={styles.count} style={unconfirmed.length ? { color: 'var(--danger-text)' } : undefined}>
                  {unconfirmed.length ? `${unconfirmed.length} to confirm` : `${plural(byMethod('name'), 'repo')}, confirmed`}
                </span>
              </li>
            </ul>
          </section>

          <div className={styles.tableWrap}>
          <div role="status" aria-live="polite">
            {message && (
              <div className="banner" style={{ marginBottom: 16 }}>
                <Icon name="info" size={16} />
                <span className="grow">{message}</span>
                {undoable && lastRemoved && (
                  <button type="button" className="link-btn" onClick={undoRemove}>Undo<span className="sr-only"> removing {lastRemoved.name}</span></button>
                )}
              </div>
            )}
          </div>

            <DataTable
              id={TABLE_ID}
              title={<h2 style={{ fontSize: 16 }}>Components in this scan</h2>}
              rows={components}
              columns={columns}
              rowKey={(c) => c._id}
              searchLabel="Search components"
              searchPlaceholder="Search components"
              pageSizes={[5, 25, 50]}
              noun={{ one: 'component', many: 'components' }}
              emptyMessage="No components in this scan. Run discovery again or add a component."
              minWidth={1000}
            />
          </div>

          <div className={`card ${styles.footer}`}>
            <div className={styles.footerText}>
              <strong style={{ fontSize: 14 }}>{summary}</strong>
              <span id="start-blocker" className={styles.blocker}>
                {r.discovered} discovered, {r.manual} added manually.{' '}
                <ReadinessNote readiness={r} onHidden={(m) => say(m)} />
              </span>
              <span className={styles.draftNote}>
                Draft saved automatically for {app.name}. Components added from Git or ZIP appear here too.
              </span>
            </div>
            <div className="row">
              <DiscardDraft store={store} appName={app.name} onDiscarded={(m) => say(m)} />
              <button
                type="button"
                className="btn"
                disabled={!components.length}
                onClick={() => {
                  void saveDefaultComponents(app.id, components.map((c) => c._id));
                  say(`Saved these ${plural(components.length, 'component')} as the default for ${found.appId}.`);
                }}
              >
                Save as default for this app
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={r.blocker !== null}
                aria-describedby="start-blocker"
                onClick={() => actions.setStep('review')}
              >
                Review and start
              </button>
            </div>
          </div>
        </>
      ) : (
        <ReviewStep store={store} appId={app.id} />
      )}
    </div>
  );
}
