import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Application } from '../../api/session';
import { DataTable, type Column } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { Chip } from '../../components/ui';
import { confirmComponent, saveDefaultComponents } from '../NewScan/api';
import { DiscardDraft, ReadinessNote, ReviewStep } from '../NewScan/DraftParts';
import type { ScanDraftStore } from '../NewScan/draftStore';
import {
  membershipButtonId, needsMembership, needsRole, ORIGIN_OPTIONS, originLabel, originNote, readiness, roleButtonId,
  roleLabel, STATUS_OPTIONS, statusLabel, statusText, statusTone, summaryLine, typeLabel, versionLabel,
  componentLabel, type ComponentRole, type ScanComponent,
} from '../NewScan/scanDraft';
import styles from './NewScan.module.css';

export type BatchWhere = 'git' | 'zip';

interface Props {
  app: Application;
  where: BatchWhere;
  role: ComponentRole;
  onRoleChange: (role: ComponentRole) => void;
  /** The application's scan draft, already loaded. Shared with discovery and the other input method. */
  store: ScanDraftStore;
  /** "3. Details" content for the chosen source. */
  details: ReactNode;
  /** Add button plus its status receipt. */
  addRow: ReactNode;
}

/** Shared page for the manual new-scan flow; the Git and ZIP screens supply the batch details. */
export function ManualScanLayout({ app, where, role, onRoleChange, store, details, addRow }: Props) {
  const navigate = useNavigate();
  const { actions } = store;
  const draft = store.draft!;
  const components = draft.components;
  const [notice, setNotice] = useState<{ text: string; undo: boolean } | null>(null);

  useEffect(() => {
    if (draft.mode !== where) actions.setMode(where);
  }, [draft.mode, where, actions]);

  const r = readiness(components);
  const justAdded = components.filter((c) => c.addedNow);
  const lastRemoved = draft.removed[draft.removed.length - 1]?.component;
  const attention = r.blocker?.kind === 'membership' || r.blocker?.kind === 'role';
  const reviewing = draft.step === 'review' && (r.blocker === null || !!draft.startedScanId);

  const summaryNote = (() => {
    if (justAdded.length === 0) return '';
    const fromGit = justAdded.filter((c) => c.origin === 'git').length;
    const fromZip = justAdded.length - fromGit;
    const origin = fromGit && fromZip ? 'from Git links and ZIPs' : fromGit ? 'from Git links' : 'from ZIPs';
    return `${justAdded.length} just added ${origin}.`;
  })();

  const columns = useMemo<Column<ScanComponent>[]>(() => [
    {
      key: 'name', header: 'Component', value: (c) => `${c.name} ${componentLabel(c)}`,
      render: (c) => (
        <span className="stack" style={{ '--gap': '2px' } as CSSProperties}>
          <strong>{c.name}</strong>
          {componentLabel(c) !== c.name && <span className="mono small muted">{componentLabel(c)}</span>}
        </span>
      ),
    },
    {
      key: 'role', header: 'Role', value: (c) => roleLabel(c.role), filter: { type: 'select', options: ['Source', 'Automation'] },
      render: (c) => (
        <select
          className={styles.roleSelect}
          aria-label={`Role for ${componentLabel(c)}`}
          value={c.role}
          onChange={(e) => actions.update(c._id, { role: e.target.value as ComponentRole, roleConfirmed: true })}
        >
          <option value="source">Source</option>
          <option value="automation">Automation</option>
        </select>
      ),
    },
    { key: 'type', header: 'Type', value: typeLabel, filter: { type: 'select' } },
    {
      key: 'origin', header: 'Comes from', value: originLabel, filter: { type: 'select', options: ORIGIN_OPTIONS },
      render: (c) => (
        <span className={styles.origin}>
          <span className={`${styles.originTag} ${c.origin === 'zip' ? styles.originZip : ''}`}>{originLabel(c)}</span>
          <span className={styles.originNote}>{originNote(c)}</span>
        </span>
      ),
    },
    { key: 'version', header: 'Version', value: versionLabel, mono: true, filter: { type: 'none' }, render: (c) => <span style={{ whiteSpace: 'nowrap' }}>{versionLabel(c)}</span> },
    {
      key: 'status', header: 'Status', value: statusLabel, filter: { type: 'select', options: STATUS_OPTIONS },
      render: (c) => (
        <span className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
          <span className="dot" style={{ background: statusTone(c) }} aria-hidden="true" />
          {statusText(c)}
        </span>
      ),
    },
    {
      key: 'action', header: 'Action', value: () => '', filter: { type: 'none' }, sortable: false,
      render: (c) => (
        <span className="row" style={{ '--gap': '12px', flexWrap: 'nowrap' } as CSSProperties}>
          {needsMembership(c) && (
            <button
              type="button" id={membershipButtonId(c)} className="link-btn" style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                actions.confirmMembership(c._id);
                void confirmComponent(c._id);
              }}
            >
              Confirm
              <span className="sr-only"> {c.name} belongs to {app.name}</span>
            </button>
          )}
          {!needsMembership(c) && needsRole(c) && (
            <button type="button" id={roleButtonId(c)} className="link-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => actions.confirmRole(c._id)}>
              Confirm role
              <span className="sr-only"> {roleLabel(c.role)} for {c.name}</span>
            </button>
          )}
          <button
            type="button" className="link-btn" aria-label={`Remove ${componentLabel(c)}`}
            onClick={() => {
              actions.remove(c._id);
              setNotice({ text: `${componentLabel(c)} removed from this scan.`, undo: true });
            }}
          >
            Remove
          </button>
        </span>
      ),
    },
  ], [actions, app.name]);

  const saveDefault = async () => {
    const res = await saveDefaultComponents(app.id, components.map((c) => c._id));
    setNotice({ text: `Saved ${res.saved} components as the default for ${app.name}.`, undo: false });
  };
  const undoRemove = () => {
    const back = actions.undoRemove();
    setNotice(back ? { text: `${back.name} added back.`, undo: false } : null);
  };

  return (
    <div className="page">
      <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
        <Link to="/regression" className={styles.back}>Back to Regression</Link>
        <h1>New regression scan</h1>
        <span className="secondary">Bring in the source and automation for {app.name}.</span>
      </div>

      <ol className={styles.stepper} aria-label="Scan setup steps">
        <li className={`${styles.stepItem} ${reviewing ? styles.stepDone : ''}`} aria-current={reviewing ? undefined : 'step'}>
          <span className={styles.stepNum} aria-hidden="true">1</span>Add components
        </li>
        <li aria-hidden="true" className={styles.stepLine} />
        <li className={styles.stepItem} aria-current={reviewing ? 'step' : undefined}>
          <span className={styles.stepNum} aria-hidden="true">2</span>Review and start
        </li>
      </ol>

      {reviewing ? (
        <ReviewStep store={store} appId={app.id} />
      ) : (
        <>
          <section aria-labelledby="mode-heading" className="stack" style={{ '--gap': '10px' } as CSSProperties}>
            <h2 id="mode-heading" style={{ fontSize: 16 }}>How should Matrix find the components?</h2>
            <div className={styles.choices} role="radiogroup" aria-labelledby="mode-heading">
              <label className={styles.choice}>
                <input type="radio" name="mode" value="auto" checked={false} onChange={() => navigate('/scans/new')} />
                <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                  <span className={styles.choiceTitle}>Auto-discover from GitSaaS <Chip tone="success">Recommended</Chip></span>
                  <span className={styles.choiceBody}>
                    Matrix finds every repository tagged with this app ID, using your PAT, and sorts them into source and automation. You can still add anything it misses.
                  </span>
                </span>
              </label>
              <label className={styles.choice}>
                <input type="radio" name="mode" value="manual" checked readOnly />
                <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                  <span className={styles.choiceTitle}>Add components yourself</span>
                  <span className={styles.choiceBody}>
                    Add components from Git links or ZIP files, one or many at a time. Source and automation can come from either.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section aria-labelledby="add-heading" className={`card ${styles.addCard}`}>
            <div className="spread">
              <h2 id="add-heading" style={{ fontSize: 16 }}>Add components</h2>
              <span className="small muted">Add as many batches as you need. Any combination works.</span>
            </div>

            <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
              <span id="what-heading" className={styles.stepLabel}>1. What are you adding?</span>
              <span className={styles.hint} style={{ marginTop: -4 }}>
                Applies to everything in this batch. You can change it for any component in the list below.
              </span>
              <div className={`${styles.choices} ${styles.choicesTight}`} role="radiogroup" aria-labelledby="what-heading">
                <RadioCard name="what" checked={role === 'source'} onSelect={() => onRoleChange('source')} title="Source code" body="The application Matrix reads to understand behaviour" />
                <RadioCard name="what" checked={role === 'automation'} onSelect={() => onRoleChange('automation')} title="Automation tests" body="The test repo Matrix writes new tests into" />
              </div>
            </div>

            <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
              <span id="where-heading" className={styles.stepLabel}>2. Where is it?</span>
              <div className={`${styles.choices} ${styles.choicesTight}`} role="radiogroup" aria-labelledby="where-heading">
                <RadioCard name="where" checked={where === 'git'} onSelect={() => navigate('/scans/new/git')} title="Git link" body="A repository URL, read with your PAT" />
                <RadioCard name="where" checked={where === 'zip'} onSelect={() => navigate('/scans/new/zip')} title="ZIP upload" body="A ZIP file of the code" />
              </div>
            </div>

            <div className="stack">
              <span className={styles.stepLabel}>3. Details</span>
              {details}
            </div>

            {addRow}
          </section>

          <div className={styles.tableFix}>
            <div role="status" aria-live="polite">
              {notice && (
                <div className="banner" style={{ marginBottom: 16 }}>
                  <Icon name="info" size={16} />
                  <span className="grow">{notice.text}</span>
                  {notice.undo && lastRemoved && (
                    <button type="button" className="link-btn" onClick={undoRemove}>
                      Undo<span className="sr-only"> removing {lastRemoved.name}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          <DataTable
            id="scan-components"
            title={<h2 style={{ fontSize: 16 }}>Components in this scan</h2>}
            rows={components}
            columns={columns}
            rowKey={(c) => c._id}
            searchLabel="Search components"
            searchPlaceholder="Search components"
            pageSizes={[5, 25, 50]}
            minWidth={980}
            noun={{ one: 'component', many: 'components' }}
            emptyMessage="No components yet. Add Git links or ZIPs above."
          />
          </div>

          <div className={`card ${styles.summary}`}>
            <div className="stack" style={{ '--gap': '4px', flex: '1 1 360px', minWidth: 0 } as CSSProperties}>
              <span style={{ fontWeight: 600 }}>{summaryLine(r)}</span>
              <span className="small muted" style={{ fontSize: 13 }}>
                {r.discovered} discovered, {r.manual} added from Git or ZIP.{summaryNote && ` ${summaryNote}`}
              </span>
              <span id="start-blocker" className={`${styles.blocker} ${attention ? styles.blockerAttention : ''}`}>
                <ReadinessNote readiness={r} onHidden={(m) => setNotice({ text: m, undo: false })} />
              </span>
              <span className={styles.hint}>Draft saved automatically for {app.name}. Discovery shows the same list.</span>
            </div>
            <div className="row">
              <DiscardDraft store={store} appName={app.name} onDiscarded={(m) => setNotice({ text: m, undo: false })} />
              <button type="button" className="btn" disabled={components.length === 0} onClick={saveDefault}>
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
      )}
    </div>
  );
}

function RadioCard({ name, checked, onSelect, title, body }: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <label className={`${styles.choice} ${styles.choiceSmall}`}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span className="stack" style={{ '--gap': '2px' } as CSSProperties}>
        <span className={styles.choiceTitle}>{title}</span>
        <span className={styles.choiceBody}>{body}</span>
      </span>
    </label>
  );
}
