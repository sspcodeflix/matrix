// Reference: design/html/Runs.html
// Read-only monitoring. Matrix never starts or reruns execution: Harness runs tests from Git.
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column, type TableView } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchRuns, type FailureGroup, type Run, type RunsData, type TriageGroup } from './api';
import styles from './Runs.module.css';

const GROUP_LABEL: Record<FailureGroup, string> = {
  product_defect: 'Product defect',
  test_defect: 'Test defect',
  environment: 'Environment',
  blocked: 'Blocked',
};

const OCTANE_LABEL: Record<Run['octaneUpload'], string> = {
  uploaded: 'Uploaded',
  not_uploaded: 'Not uploaded',
  failed: 'Failed',
};

const TRIGGER_VIEWS: TableView<Run>[] = [
  { key: 'all', label: 'All triggers', match: () => true },
  { key: 'schedule', label: 'Schedule', match: (r) => r.trigger === 'schedule' },
  { key: 'pr', label: 'Pull request', match: (r) => r.trigger === 'pr_opened' },
  { key: 'merge', label: 'Merge', match: (r) => r.trigger === 'merge' },
];

const formatDuration = (sec?: number) => (sec === undefined ? '' : sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const byRunId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export default function RunsScreen() {
  const { data, error, loading } = useApi(fetchRuns);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <Runs data={data} />;
}

function Runs({ data }: { data: RunsData }) {
  const download = useDownloadReport();
  const firstWithTriage = data.runs.find((r) => data.triage[r._id]) ?? data.runs[0];
  // `?run=<id>` (e.g. from Regression's "View run") opens that run's triage.
  const [params] = useSearchParams();
  const linked = data.runs.find((r) => r._id === params.get('run'));
  const [selectedId, setSelectedId] = useState((linked ?? firstWithTriage)?._id);
  const [filtered, setFiltered] = useState<Run[]>(data.runs);
  const onFiltered = useCallback((rows: Run[]) => setFiltered(rows), []);
  const selected = data.runs.find((r) => r._id === selectedId);

  const columns = useMemo<Column<Run>[]>(
    () => [
      {
        key: 'run',
        header: 'Run',
        value: (r) => r._id,
        render: (r) => (
          <>
            <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
              <button
                type="button"
                className={`link-btn ${styles.runLink}`}
                aria-pressed={r._id === selectedId}
                aria-label={`Show triage for run #${r._id}`}
                onClick={() => setSelectedId(r._id)}
              >
                #{r._id}
              </button>
              {r.status === 'in_progress' && <Pill tone="warning">In progress · partial</Pill>}
              {r._id === selectedId && <span className="chip">viewing</span>}
            </span>
            <span className={styles.sub}>Harness {r.harnessExecutionId}</span>
          </>
        ),
      },
      { key: 'trigger', header: 'Trigger', value: (r) => r.triggerLabel },
      { key: 'branch', header: 'Branch', value: (r) => r.branch, mono: true },
      {
        key: 'result',
        header: 'Passed / failed',
        value: (r) => (r.failed > 0 ? 'Has failures' : 'All passed'),
        filter: { type: 'select', options: ['Has failures', 'All passed'] },
        render: (r) => (
          <span>
            <span className={styles.passed}>{r.passed}</span> /{' '}
            <span className={r.failed > 0 ? styles.failed : undefined}>{r.failed}</span>
            {r.blocked > 0 && <span className="muted small"> · {r.blocked} blocked</span>}
          </span>
        ),
      },
      {
        key: 'duration',
        header: 'Duration',
        value: (r) => r.durationSec ?? -1,
        render: (r) => (r.status === 'in_progress' ? <span className="muted">Running</span> : formatDuration(r.durationSec)),
        filter: { type: 'none' },
      },
      {
        key: 'started',
        header: 'Started',
        value: (r) => r.startedAt,
        render: (r) => r.startedLabel,
        filter: { type: 'none' },
      },
      {
        key: 'octane',
        header: 'Octane',
        value: (r) => OCTANE_LABEL[r.octaneUpload],
        filter: { type: 'select', options: Object.values(OCTANE_LABEL) },
        render: (r) => (
          <Pill tone={r.octaneUpload === 'uploaded' ? 'success' : r.octaneUpload === 'failed' ? 'accent' : 'neutral'}>
            {OCTANE_LABEL[r.octaneUpload]}
          </Pill>
        ),
      },
    ],
    [selectedId],
  );

  // One collection snapshot for the whole export (UI_UX_REVIEW R5): every run captured on this
  // screen, named by its run-ID range and dated by the newest included capture. Each scope lists
  // its own run IDs and derives the partial-result warning from all of its runs, not the viewed one.
  const openDownload = () => {
    const runUnit = { one: 'run', many: 'runs' };
    const ids = (runs: Run[]) => runs.map((r) => r._id).sort(byRunId);
    const all = ids(data.runs);
    const snapshotId = all.length > 1 ? `RUNS-${all[0]}-${all[all.length - 1]}` : `RUN-${all[0] ?? 'none'}`;
    const capturedAt = data.runs.reduce((max, r) => (r.capturedAt > max ? r.capturedAt : max), '') || data.capturedAt;
    const records = (runs: Run[]) => {
      const live = runs.filter((r) => r.status === 'in_progress').map((r) => `#${r._id}`);
      const status = live.length
        ? `${live.join(', ')} still in progress, ${live.length === 1 ? 'its' : 'their'} results are partial`
        : 'all completed';
      return `${plural(runs.length, 'run')} in scope: ${ids(runs).map((id) => `#${id}`).join(', ')} · ${status}`;
    };
    const selectedRuns = selected ? [selected] : [];
    download.open({
      context: `Runs · ${data.application} · ${data.release}`,
      reportTypes: [
        {
          key: 'execution',
          label: 'Execution results and failure analysis',
          description: 'Run IDs, trigger, branch and commit, pass/fail/blocked counts, triage groups, requirement links and Octane upload status.',
          formats: ['pdf', 'html', 'xlsx'],
          records: { selected: records(selectedRuns), filtered: records(filtered), full: records(data.runs) },
        },
      ],
      scope: {
        selected: selected
          ? {
              count: 1,
              unit: runUnit,
              ids: [selected._id],
              label: `This run · #${selected._id}`,
              hint: 'The run open in triage below',
              snapshot: {
                id: `RUN-${selected._id}`,
                text: `Run #${selected._id} (Harness execution ${selected.harnessExecutionId}) as captured from Harness`,
                capturedAt: selected.capturedAt,
              },
            }
          : undefined,
        filtered: { count: filtered.length, unit: runUnit, ids: ids(filtered), spec: filterSpec({ rows: ids(filtered).join(',') }) },
        full: { count: data.runs.length, unit: runUnit, ids: all },
      },
      selectionHint: 'Choose a run in the table to export just that run',
      snapshotId,
      snapshotCapturedAt: capturedAt,
      snapshot: `Runs snapshot ${snapshotId} · ${plural(all.length, 'run')} captured from Harness (${all.map((id) => `#${id}`).join(', ')}) · data as of ${data.dataAsOf}`,
      filters: filtered.length !== data.runs.length ? 'Filtered runs table' : undefined,
    });
  };

  return (
    <div className="page">
      <PageHeader
        title="Runs"
        subtitle={`Read-only view of the Harness pipeline ${data.pipeline.name}. Runs start from Git: a schedule, a pull request or a merge.`}
        actions={
          <>
            <DownloadButton onClick={openDownload} />
            {/* TODO(backend): Harness pipeline URL from the app's Harness connection. */}
            <a className="btn" href={data.pipeline.harnessUrl}>
              Open pipeline in Harness
              <Icon name="external" size={14} />
            </a>
          </>
        }
      />

      <div className={styles.tableWrap}>
      <DataTable
        id="runs"
        title={<h2 style={{ fontSize: 16 }}>Recent runs</h2>}
        rows={data.runs}
        columns={columns}
        rowKey={(r) => r._id}
        views={TRIGGER_VIEWS}
        searchLabel="Search runs"
        searchPlaceholder="Search by run id, branch or trigger"
        onFilteredChange={onFiltered}
        noun={{ one: 'run', many: 'runs' }}
        rowLabel={(r) => `run #${r._id}`}
      />
      </div>

      {selected && <Triage run={selected} groups={data.triage[selected._id]} />}
    </div>
  );
}

function Triage({ run, groups }: { run: Run; groups?: TriageGroup[] }) {
  const failures = groups?.filter((g) => g.group !== 'blocked') ?? [];
  const blocked = groups?.filter((g) => g.group === 'blocked') ?? [];
  const failedCount = failures.reduce((n, g) => n + g.tests.length, 0);
  const blockedCount = blocked.reduce((n, g) => n + g.tests.length, 0);
  const partial = run.status === 'in_progress';

  let heading = `Run #${run._id}`;
  if (groups) {
    heading += ` · why ${plural(failedCount, 'test')} failed`;
    if (blockedCount > 0) heading += ` and ${blockedCount} ${blockedCount === 1 ? 'was' : 'were'} blocked`;
  }

  return (
    <section className="card card-pad stack" aria-labelledby="tri-heading" style={{ '--gap': '14px' } as CSSProperties}>
      <div className="spread">
        <h2 id="tri-heading" style={{ fontSize: 16 }}>{heading}</h2>
        <span className="small muted">
          Grouped by Matrix from HyperExecute logs and screenshots ·{' '}
          {/* TODO(backend): Harness execution URL. */}
          <a href={run.harnessUrl} style={{ textDecoration: 'none', fontWeight: 500 }}>View execution in Harness</a>
        </span>
      </div>

      {partial && (
        <div className="banner warning" role="status">
          <Icon name="info" />
          <span>
            Run #{run._id} is still in progress in Harness. Counts so far are partial: {run.passed} passed, {run.failed} failed.
            Triage appears when the run completes.
          </span>
        </div>
      )}

      {!groups && !partial && (
        <p className="secondary">
          {run.failed + run.blocked === 0
            ? `All ${run.passed} tests passed. Nothing to triage.`
            : 'Triage for this run is not available yet.'}
        </p>
      )}

      {failures.length > 0 && (
        <div className={styles.groups}>
          {failures.map((g) => <GroupCard key={g.group + g.title} group={g} />)}
        </div>
      )}
      {blocked.length > 0 && (
        <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
          <span className="eyebrow">Blocked, counted separately from failures</span>
          <div className={styles.groups}>
            {blocked.map((g) => <GroupCard key={g.group + g.title} group={g} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function GroupCard({ group }: { group: TriageGroup }) {
  const [requested, setRequested] = useState(false);
  const tone = group.group === 'test_defect' || group.group === 'blocked' ? 'tone-warning' : '';
  const a = group.action;

  return (
    <article className={styles.group}>
      <span className={styles.groupHead}>
        <span className={`pill ${group.group === 'product_defect' ? styles.solid : tone}`}>{GROUP_LABEL[group.group]}</span>
        <span className={styles.count} aria-label={`${group.tests.length} tests`}>{group.tests.length}</span>
      </span>
      <h3 className={styles.groupTitle}>{group.title}</h3>
      <p className={styles.summary}>{group.summary}</p>
      <ul className={styles.tests}>
        {group.tests.map((t) => (
          <li key={t.test}>
            <span>{t.test}</span>
            <span className="mono small muted" style={{ fontSize: 11 }}>{t.frId}</span>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        {a.kind === 'raise_jira' ? (
          // TODO(backend): POST /api/jira/defects through the credential broker (user's Jira PAT).
          <button type="button" className="btn dark" disabled={requested} onClick={() => setRequested(true)}>
            {requested ? 'Jira defect requested' : a.label}
          </button>
        ) : a.href && a.href.startsWith('/') ? (
          <Link className="btn" to={a.href}>{a.label}</Link>
        ) : (
          // TODO(backend): external Harness link.
          <a className="btn" href={a.href ?? '#'}>{a.label}</a>
        )}
        {a.note && <span className={styles.note}>{a.note}</span>}
        {requested && <span className={styles.note} role="status">Defect will be raised in Jira with this evidence.</span>}
      </div>
    </article>
  );
}
