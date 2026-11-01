import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Pill, type PillTone } from '../../components/ui';
import { fetchSession } from '../../api/session';
import { useApi } from '../../api/useApi';
import type { DownloadRequest, ReportFormat, ReportTypeOption, ScopeCount, ScopeKey } from './types';
import {
  buildFilename, cancelExport, companionExport, createUpdated, downloadExport, ensureJobsLoaded,
  ILLUSTRATIVE_RETENTION_DAYS, regenerateOriginal, requestExport, retryExport, useExportJobs,
  type ExportJob, type ExportJobState,
} from './jobs';
import styles from './DownloadReport.module.css';

/*
 * Shared Download report dialog (docs/REPORTS.md, docs/SCREENS.md "Reports and downloads").
 * Port of design/html/DownloadReport.html. Exporting never calls the model, approves tests,
 * imports into Octane or starts a Harness run.
 */

const FORMAT_ORDER: ReportFormat[] = ['pdf', 'html', 'xlsx', 'csv'];
const FORMAT_INFO: Record<ReportFormat, { label: string; note: string }> = {
  pdf: { label: 'PDF', note: 'Paginated, selectable text' },
  html: { label: 'HTML', note: 'One file, opens offline' },
  xlsx: { label: 'Excel detail', note: '.xlsx with chart values' },
  csv: { label: 'CSV', note: 'One flat table, UTF-8' },
};

const STATE_TONE: Record<ExportJobState, PillTone> = {
  Queued: 'neutral', Generating: 'neutral', Ready: 'success', Failed: 'accent', Cancelled: 'neutral', Expired: 'warning',
};

const plural = (s: ScopeCount) => `${s.count.toLocaleString()} ${s.count === 1 ? s.unit.one : s.unit.many}`;

const utc = (iso?: string) =>
  iso
    ? `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).format(new Date(iso))} UTC`
    : '';

function deriveSnapshotId(r: DownloadRequest) {
  if (r.snapshotId) return r.snapshotId;
  const m = r.snapshot.match(/[A-Z]+-\d+|#\d+/);
  return m ? m[0].replace('#', 'RUN-') : 'snapshot';
}

interface FormState {
  typeKey: string;
  format: ReportFormat;
  scope: ScopeKey;
}

function scopesFor(request: DownloadRequest, type: ReportTypeOption | undefined) {
  return { ...request.scope, ...(type?.scope ?? {}) } as DownloadRequest['scope'];
}

function initialState(request: DownloadRequest): FormState {
  const type = request.reportTypes.find((t) => t.key === request.defaultReportType) ?? request.reportTypes[0];
  const scopes = scopesFor(request, type);
  return {
    typeKey: type?.key ?? '',
    format: type?.formats[0] ?? 'pdf',
    scope: (scopes.selected?.count ?? 0) > 0 ? 'selected' : 'filtered',
  };
}

export function DownloadReportDialog({ request, onClose }: { request: DownloadRequest | null; onClose: () => void }) {
  const [lastRequest, setLastRequest] = useState<DownloadRequest | null>(request);
  const [form, setForm] = useState<FormState | null>(request ? initialState(request) : null);
  const [formNotice, setFormNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { jobs, message } = useExportJobs();
  const session = useApi(fetchSession);

  // Reset the configuration each time a screen opens the dialog with a new request.
  if (request !== lastRequest) {
    setLastRequest(request);
    setForm(request ? initialState(request) : null);
    setFormNotice('');
    setHighlight(null);
  }

  useEffect(() => {
    if (!request) return;
    ensureJobsLoaded();
    // Initial focus on the chosen report type, as in the reference.
    const raf = requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('input[name="dl-type"]:checked')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [request]);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`dl-job-${highlight}`)?.scrollIntoView({ block: 'nearest' });
    const t = window.setTimeout(() => setHighlight(null), 2500);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const open = !!request && !!form;
  const type = request?.reportTypes.find((t) => t.key === form?.typeKey);
  const scopes = request ? scopesFor(request, type) : null;
  const requester = session.data?.user.name ?? 'me';
  const application = request?.applicationName ?? session.data?.application.name ?? 'app';

  const allFormats = request
    ? FORMAT_ORDER.filter((f) => request.reportTypes.some((t) => t.formats.includes(f)))
    : [];

  const chooseType = (t: ReportTypeOption) => {
    if (!form || !request) return;
    const next: FormState = { ...form, typeKey: t.key };
    const notices: string[] = [];
    if (!t.formats.includes(form.format)) {
      next.format = t.formats[0];
      notices.push(`${t.label} supports ${t.formats.map((f) => f.toUpperCase()).join(', ')}; format changed to ${next.format.toUpperCase()}.`);
    }
    const s = scopesFor(request, t);
    if (form.scope === 'selected' && (s.selected?.count ?? 0) === 0) {
      next.scope = 'filtered';
      notices.push('Nothing is selected for this report, so scope changed to all matching filters.');
    }
    setForm(next);
    setFormNotice(notices.join(' '));
  };

  const current = scopes && form ? (form.scope === 'selected' ? scopes.selected : scopes[form.scope]) : undefined;
  const emptyScope = !current || current.count === 0;

  const scopeLabel = (key: ScopeKey) => {
    if (!scopes) return '';
    const own = key === 'selected' ? scopes.selected : scopes[key];
    if (own?.label) return own.label;
    if (key === 'selected') return scopes.selected?.count ? `Selected rows (${plural(scopes.selected)})` : 'Selected rows (0)';
    if (key === 'filtered') return `All matching current filters (${plural(scopes.filtered)})`;
    return `Entire permitted scope (${plural(scopes.full)})`;
  };

  // The chosen scope may carry its own snapshot (one run versus a collection).
  const snap = request
    ? {
        id: current?.snapshot?.id ?? deriveSnapshotId(request),
        text: current?.snapshot?.text ?? request.snapshot,
        capturedAt: current?.snapshot ? current.snapshot.capturedAt : request.snapshotCapturedAt,
      }
    : null;

  const generate = () => {
    if (!request || !form || !type || !current || creating || emptyScope) return;
    setCreating(true);
    const input = {
      reportKey: type.key,
      title: type.label,
      format: form.format,
      formats: type.formats,
      context: request.context,
      application,
      scopeKey: form.scope,
      scopeLabel: scopeLabel(form.scope).replace('All matching current filters', 'All matching filters'),
      count: current.count,
      // Record identity (C2): without it a subset scope is never deduplicated.
      ids: form.scope === 'selected' ? current.ids : undefined,
      spec: form.scope === 'filtered' ? current.spec : undefined,
      snapshotId: snap!.id,
      // Source capture time (C6); null when the screen did not supply it, never "now".
      capturedAt: snap!.capturedAt ?? null,
      requester,
    };
    // Acknowledge immediately ("Creating export…"); the short delay stands in for the POST.
    window.setTimeout(() => {
      const { job } = requestExport(input);
      setHighlight(job.id);
      setCreating(false);
    }, 250);
  };

  const recordsText = () => {
    if (!form || !current) return '';
    const custom = type?.records?.[form.scope];
    return custom ?? `${plural(current)} in scope`;
  };

  const filtersText = () => {
    if (!form || !request) return '';
    if (form.scope === 'full') return 'Entire permitted application scope; current filters excluded';
    if (form.scope === 'selected') return `Selected rows only${request.filters ? ` (selected while viewing ${request.filters})` : ''}`;
    return request.filters ?? 'No filters applied';
  };

  const footer = (
    <div className={styles.foot}>
      <span className={styles.meta}>Closing keeps any report that is generating; find it in Recent downloads.</span>
      <div className={styles.footActions}>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button
          type="button"
          className="btn primary"
          onClick={generate}
          disabled={creating || emptyScope}
          aria-describedby={emptyScope ? 'dl-empty-reason' : undefined}
        >
          {creating ? 'Creating export…' : `Generate ${form?.format.toUpperCase() ?? ''}`}
        </button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={request?.title ?? 'Download report'}
      subtitle={request?.context}
      footer={footer}
      width={980}
    >
      {request && form && scopes && (
        <div className={styles.body}>
          <form
            ref={formRef}
            className={styles.form}
            aria-label="New report"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Report</legend>
              {request.reportTypes.map((t) => (
                <label key={t.key} className={styles.opt}>
                  <input type="radio" name="dl-type" checked={form.typeKey === t.key} onChange={() => chooseType(t)} />
                  <span className={styles.optText}>
                    {t.label}
                    <small>{t.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Format</legend>
              <div className={styles.formats}>
                {allFormats.map((f) => {
                  const supported = !!type?.formats.includes(f);
                  return (
                    <label key={f} className={`${styles.opt} ${supported ? '' : styles.disabled}`}>
                      <input
                        type="radio"
                        name="dl-format"
                        checked={form.format === f}
                        disabled={!supported}
                        onChange={() => setForm({ ...form, format: f })}
                      />
                      <span className={styles.optText}>
                        {FORMAT_INFO[f].label}
                        <small>{supported ? (type?.formatNotes?.[f] ?? FORMAT_INFO[f].note) : `Not available for ${type?.label ?? 'this report'}`}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Scope</legend>
              {(['selected', 'filtered', 'full'] as ScopeKey[]).map((key) => {
                const s = key === 'selected' ? scopes.selected : scopes[key];
                const disabled = key === 'selected' && !(s && s.count > 0);
                const hint =
                  key === 'selected'
                    ? disabled
                      ? request.selectionHint ?? 'Select rows in the table to use this'
                      : s?.hint ?? 'Only the rows you selected, across every page'
                    : key === 'filtered'
                      ? s?.hint ?? 'Every page, not just the rows shown'
                      : s?.hint ?? 'Ignores the current view and filters';
                return (
                  <label key={key} className={`${styles.opt} ${disabled ? styles.disabled : ''}`}>
                    <input
                      type="radio"
                      name="dl-scope"
                      checked={form.scope === key}
                      disabled={disabled}
                      onChange={() => {
                        setForm({ ...form, scope: key });
                        setFormNotice('');
                      }}
                    />
                    <span className={styles.optText}>
                      {scopeLabel(key)}
                      <small>{hint}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <p className="sr-only" role="status" aria-live="polite">{formNotice}</p>
            {formNotice && <p className={styles.meta}>{formNotice}</p>}

            {emptyScope && (
              <div className="banner warning" id="dl-empty-reason">
                <Icon name="warning" />
                <span>
                  No {current?.unit.many ?? 'records'} are in this scope, so there is nothing to export. Change the filters on the
                  screen, or choose another scope. A summary report never turns missing evidence into a zero or a pass.
                </span>
              </div>
            )}

            <div>
              <span className={styles.sectionLabel}>What will be in the file</span>
              <dl className={styles.preview}>
                <dt>Snapshot</dt>
                <dd>{snap!.text}</dd>
                <dt>Data as of</dt>
                <dd>
                  {snap!.capturedAt ? (
                    <>{utc(snap!.capturedAt)} <span className={styles.meta}>(source capture time, not the export time)</span></>
                  ) : (
                    // TODO(C6): every invoking screen should pass snapshotCapturedAt from its snapshot metadata.
                    <span className={styles.illustrative}>Capture time unknown. The file will say so rather than show the export time.</span>
                  )}
                </dd>
                <dt>Filters</dt>
                <dd>{filtersText()}</dd>
                <dt>Records</dt>
                <dd>
                  {form.scope !== 'full' && <span className={styles.subset}>Subset total: </span>}
                  {recordsText()}
                </dd>
                {request.comparison && (
                  <>
                    <dt>Context</dt>
                    <dd>
                      {request.comparison}
                      {form.scope !== 'full' && <span className={styles.meta}> (whole scope, not part of the subset totals)</span>}
                    </dd>
                  </>
                )}
                {type?.exclusions && (
                  <>
                    <dt>Excluded</dt>
                    <dd>{type.exclusions}</dd>
                  </>
                )}
                <dt>Sections</dt>
                <dd>{type?.sections ?? 'Summary, detail and source references'}</dd>
                <dt>File name</dt>
                <dd className={styles.filename}>
                  {buildFilename(application, form.typeKey, snap!.id, snap!.capturedAt ?? null, '<report-ID>', form.format)}
                </dd>
              </dl>
            </div>

            <p className={styles.note}>
              The file is a dated snapshot. Downloading does not approve tests, import anything into Octane or start a Harness
              run. Files are kept for {ILLUSTRATIVE_RETENTION_DAYS} days{' '}
              <span className={styles.illustrative}>(illustrative; retention policy not yet agreed)</span>.
              {/* TODO(OPEN_QUESTIONS #16): retention, size limits and classification label from configuration. */}
            </p>
          </form>

          <RecentDownloads jobs={jobs} message={message} highlight={highlight} requester={requester} onHighlight={setHighlight} />
        </div>
      )}
    </Dialog>
  );
}

function RecentDownloads({ jobs, message, highlight, requester, onHighlight }: {
  jobs: ExportJob[];
  message: string;
  highlight: string | null;
  requester: string;
  onHighlight: (id: string) => void;
}) {
  return (
    <section className={styles.recent} aria-labelledby="dl-recent-title">
      <div className="spread">
        <h3 id="dl-recent-title" style={{ fontSize: 14 }}>Recent downloads</h3>
        <span className="chip">Simulated locally</span>
      </div>
      <p className={styles.meta} role="status" aria-live="polite">{message}</p>
      {jobs.length === 0 ? (
        <p className={styles.meta}>No exports yet.</p>
      ) : (
        <ul className={styles.jobs} aria-label="Export history">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} highlighted={highlight === job.id} requester={requester} onHighlight={onHighlight} />
          ))}
        </ul>
      )}
    </section>
  );
}

function JobCard({ job, highlighted, requester, onHighlight }: {
  job: ExportJob;
  highlighted: boolean;
  requester: string;
  onHighlight: (id: string) => void;
}) {
  const [companion, setCompanion] = useState<ReportFormat>(() => job.formats.find((f) => f !== job.format) ?? job.format);
  const [showUpdated, setShowUpdated] = useState(false);
  const fmt = job.format.toUpperCase();
  const others = job.formats.filter((f) => f !== job.format);
  const pick = (r: { job: ExportJob } | undefined) => r && onHighlight(r.job.id);

  return (
    <li id={`dl-job-${job.id}`} className={`${styles.job} ${highlighted ? styles.highlight : ''}`}>
      <div className={styles.jobTop}>
        <strong>{job.title} · {fmt}</strong>
        <Pill tone={STATE_TONE[job.state]}>{job.state}</Pill>
      </div>
      {job.state === 'Generating' && (
        <div className={styles.bar} role="progressbar" aria-label={`Generating ${job.title}`} aria-valuetext="In progress">
          <span />
        </div>
      )}
      <span className={styles.meta}>
        {job.scopeLabel} · snapshot <span className="mono">{job.snapshotId}</span> ·{' '}
        {job.capturedAt ? `data as of ${utc(job.capturedAt)}` : 'capture time unknown'}
      </span>
      <span className={styles.meta}>
        {job.state === 'Queued' && 'Waiting for a worker · '}
        Created {utc(job.createdAt)} · {job.requester}
        {job.sizeKb ? ` · ${job.sizeKb} KB` : ''}
        {job.state === 'Ready' && job.expiresAt && ` · expires ${utc(job.expiresAt)} (illustrative)`}
        {job.state === 'Expired' && job.expiresAt && ` · expired ${utc(job.expiresAt)}`}
      </span>
      {job.error && <span className={styles.meta} style={{ color: 'var(--danger-text)' }}>{job.error}</span>}
      <code className={styles.filename}>{job.filename}</code>

      <div className={styles.actions}>
        {(job.state === 'Queued' || job.state === 'Generating') && (
          <button type="button" className="btn" onClick={() => cancelExport(job.id)}>Cancel export</button>
        )}
        {job.state === 'Ready' && (
          <>
            <button type="button" className="btn" onClick={() => downloadExport(job.id)}>
              <Icon name="download" size={16} /> Download
            </button>
            {others.length > 0 && (
              <>
                <select
                  className="select"
                  aria-label={`Companion format for ${job.id}`}
                  value={companion}
                  onChange={(e) => setCompanion(e.target.value as ReportFormat)}
                >
                  {others.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
                <button type="button" className="btn" onClick={() => pick(companionExport(job.id, companion, requester))}>
                  Another format, same snapshot
                </button>
              </>
            )}
          </>
        )}
        {(job.state === 'Failed' || job.state === 'Cancelled') && (
          <button type="button" className="btn" disabled={!job.snapshotRetained} onClick={() => retryExport(job.id)}>
            Retry same snapshot
          </button>
        )}
        {job.state === 'Expired' && (
          <>
            <button
              type="button"
              className="btn"
              disabled={!job.snapshotRetained}
              onClick={() => pick(regenerateOriginal(job.id, requester))}
            >
              Regenerate original report
            </button>
            <button type="button" className="btn" aria-expanded={showUpdated} onClick={() => setShowUpdated((v) => !v)}>
              Create updated report
            </button>
          </>
        )}
      </div>
      {job.state === 'Expired' && !job.snapshotRetained && (
        <span className={styles.meta}>The original snapshot is no longer retained, so a new report needs a new data snapshot.</span>
      )}
      {job.state === 'Expired' && showUpdated && (
        <div className={styles.updated}>
          <p className={styles.meta}>
            Updated report preview: the same records ({job.scopeLabel}) from a new capture of current data, taken when you
            generate (now about {utc(new Date().toISOString())}). The new report gets a new snapshot ID and its own
            &quot;data as of&quot; time; the historical snapshot <span className="mono">{job.snapshotId}</span>
            {job.capturedAt ? ` (data as of ${utc(job.capturedAt)})` : ''} stays unchanged.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                pick(createUpdated(job.id, requester));
                setShowUpdated(false);
              }}
            >
              Generate updated {fmt}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
