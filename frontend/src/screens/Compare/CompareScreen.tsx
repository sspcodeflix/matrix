import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { DownloadButton, ErrorState, Loading, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import type { Application } from '../../api/session';
import { useWorkspace } from '../../workspace/useWorkspace';
import { fetchAppScans, type AppScans, type ModuleSnapshot } from './api';
import { CoverageBridge, CoverageTrend, type BridgeRow } from './charts';
import styles from './Compare.module.css';

const TABLE_ID = 'modules';

interface ModuleRow {
  module: string;
  requirements: number;
  before: number | null;
  after: number;
  change: number | null;
  matrix: number;
  lost: number;
  openGaps: number;
}

const changeCategory = (c: number | null) => (c === null ? 'New module' : c > 0 ? 'Improved' : c < 0 ? 'Got worse' : 'No change');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;

export default function CompareScreen() {
  const [params, setParams] = useSearchParams();
  const { application, applications, selectApplication } = useWorkspace();
  const setParam = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });

  // A link may carry `?app=`; switch the workspace context to it, as Regression does.
  const requested = params.get('app');
  const target = requested ? applications.find((a) => a.id === requested) : application;
  useEffect(() => {
    if (!requested || !target) return;
    selectApplication(target.id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('app');
      return next;
    }, { replace: true });
  }, [requested, target, selectApplication, setParams]);

  if (!target) {
    return (
      <div className="page">
        <h1>Compare scans</h1>
        <div className="banner warning" role="alert">
          <span>
            <span className="mono">{requested}</span> is not one of your Matrix applications, so there are no scans to compare.{' '}
            <Link to="/regression/compare">Compare scans for {application.name}</Link>
          </span>
        </div>
      </div>
    );
  }
  return (
    <CompareLoader
      key={target.id}
      app={target}
      applications={applications}
      baselineParam={params.get('base')}
      compareParam={params.get('with')}
      onApp={(id) => {
        selectApplication(id);
        setParam({ base: null, with: null });
      }}
      onBaseline={(id) => setParam({ base: id })}
      onCompare={(id) => setParam({ with: id })}
    />
  );
}

function CompareLoader({ app, applications, ...rest }: {
  app: Application;
  applications: Application[];
  baselineParam: string | null;
  compareParam: string | null;
  onApp: (id: string) => void;
  onBaseline: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const scans = useApi(() => fetchAppScans(app.id, app.name), [app.id]);
  if (scans.error) return <ErrorState error={scans.error} />;
  if (!scans.data) return <Loading label={`Loading scans for ${app.name}`} />;
  return <Compare applications={applications} data={scans.data} {...rest} />;
}

function Compare({ applications, data, baselineParam, compareParam, onApp, onBaseline, onCompare }: {
  applications: Application[];
  data: AppScans;
  baselineParam: string | null;
  compareParam: string | null;
  onApp: (id: string) => void;
  onBaseline: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const download = useDownloadReport();
  const [filtered, setFiltered] = useState<ModuleRow[]>([]);

  const baselineOptions = data.scans.filter((s) => s.pickable === 'baseline');
  const compareOptions = data.scans.filter((s) => s.pickable === 'compare');
  const a = data.scans.find((s) => s.scanId === (baselineParam ?? data.defaultBaseline));
  const b = data.scans.find((s) => s.scanId === (compareParam ?? data.defaultCompare));
  const indexOf = (id: string) => data.scans.findIndex((s) => s.scanId === id);
  const ordered = a && b && indexOf(a.scanId) < indexOf(b.scanId);

  const rows = useMemo<ModuleRow[]>(() => {
    if (!a || !b) return [];
    const before = data.modules[a.scanId] ?? [];
    const after = data.modules[b.scanId] ?? [];
    const ai = indexOf(a.scanId);
    const bi = indexOf(b.scanId);
    const lostInRange = data.lost.filter((l) => {
      const i = indexOf(l.lostInScanId);
      return i > ai && i <= bi;
    });
    return after.map((m: ModuleSnapshot) => {
      const prev = before.find((p) => p.module === m.module);
      return {
        module: m.module,
        requirements: m.requirements,
        before: prev ? prev.automatedPct : null,
        after: m.automatedPct,
        change: prev ? m.automatedPct - prev.automatedPct : null,
        matrix: Math.max(0, m.matrixAutomated - (prev?.matrixAutomated ?? 0)),
        lost: lostInRange.filter((l) => l.module === m.module).length,
        openGaps: m.openGaps,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, a?.scanId, b?.scanId]);

  const columns: Column<ModuleRow>[] = useMemo(
    () => [
      { key: 'module', header: 'Module', value: (r) => r.module, render: (r) => <strong style={{ fontWeight: 600 }}>{r.module}</strong> },
      { key: 'reqs', header: 'Requirements', value: (r) => r.requirements, filter: { type: 'none' } },
      { key: 'before', header: a?.label ?? 'Baseline', value: (r) => r.before ?? -1, render: (r) => (r.before === null ? '—' : `${r.before}%`), filter: { type: 'none' } },
      { key: 'after', header: b?.label ?? 'Compared', value: (r) => r.after, render: (r) => `${r.after}%`, filter: { type: 'none' } },
      {
        key: 'change', header: 'Change', value: (r) => changeCategory(r.change),
        filter: { type: 'select', options: ['Improved', 'No change', 'Got worse', 'New module'] },
        render: (r) =>
          r.change === null ? <span className="muted">New module</span> : (
            <span className={r.change > 0 ? styles.up : r.change < 0 ? styles.down : undefined}>{signed(r.change)} pts</span>
          ),
      },
      {
        key: 'matrix', header: 'Newly automated by Matrix', value: (r) => (r.matrix > 0 ? 'Some' : 'None'),
        filter: { type: 'select', options: ['Some', 'None'] }, render: (r) => r.matrix,
      },
      {
        key: 'lost', header: 'Coverage lost', value: (r) => (r.lost > 0 ? 'Some lost' : 'None lost'),
        filter: { type: 'select', options: ['Some lost', 'None lost'] },
        render: (r) => <span className={r.lost > 0 ? styles.lostCount : undefined}>{r.lost}</span>,
      },
      { key: 'gaps', header: 'Open gaps', value: (r) => r.openGaps, filter: { type: 'none' } },
    ],
    [a?.label, b?.label],
  );

  const header = (
    <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
      <Link className={styles.back} to="/regression">Back to Regression</Link>
      <h1>Compare scans · {data.appName}</h1>
      <span className="secondary">
        How much automated coverage {data.appName} gained between two regression scans, and how much came from Matrix.
      </span>
    </div>
  );

  const covA = a ? a.otherPct + a.matrixPct : 0;
  const covB = b ? b.otherPct + b.matrixPct : 0;
  const newReqEffect = a && b ? Math.round((100 * a.automatedFRs) / b.totalFRs) - covA : 0;
  const matrixPts = a && b ? b.matrixPct - a.matrixPct : 0;
  const otherPts = covB - covA - newReqEffect - matrixPts;
  const newReqs = a && b ? b.totalFRs - a.totalFRs : 0;
  const lost = a && b && ordered
    ? data.lost.filter((l) => indexOf(l.lostInScanId) > indexOf(a.scanId) && indexOf(l.lostInScanId) <= indexOf(b.scanId))
    : [];
  const trend = ordered ? data.scans.slice(0, indexOf(b!.scanId) + 1) : data.scans;

  const bridge: BridgeRow[] = a && b
    ? [
        { label: `Coverage on ${a.label}`, value: covA, kind: 'level' },
        { label: plural(newReqs, 'new requirement'), value: newReqEffect, kind: 'newReqs' },
        { label: 'Other automation changes', value: otherPts, kind: 'other' },
        { label: 'Matrix-written tests', value: matrixPts, kind: 'matrix' },
        { label: `Coverage on ${b.label}`, value: covB, kind: 'level' },
      ]
    : [];

  const openDownload = () => {
    if (!a || !b) return;
    const unit = { one: 'module', many: 'modules' };
    download.open({
      title: 'Download report',
      context: `Compare scans · ${data.appName} · ${a.scanId} → ${b.scanId}`,
      applicationName: data.appName,
      reportTypes: [
        {
          key: 'scan-comparison',
          label: 'Scan comparison',
          description: 'Both scan snapshots, before/after coverage, denominator changes, Matrix contribution, lost coverage with reasons, trend values and module detail.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        filtered: { count: filtered.length, unit, spec: filterSpec({ rows: filtered.map((r) => r.module).sort().join(',') }) },
        full: { count: rows.length, unit },
      },
      snapshot: `Baseline ${a.scanId} (${a.date}) · compared with ${b.scanId} (${b.date})`,
      snapshotId: `${a.scanId}-${b.scanId}`,
      // The newer scan's capture time; the baseline keeps its own date in the snapshot text.
      snapshotCapturedAt: b.capturedAt,
      comparison: `Whole application: ${covA}% → ${covB}% automated coverage (${a.automatedFRs} of ${a.totalFRs} → ${b.automatedFRs} of ${b.totalFRs} requirements)`,
    });
  };

  return (
    <div className="page">
      {header}

      <div className="card">
        <div className={styles.pickers}>
          <label className={styles.picker} style={{ flexBasis: 220 }}>
            Application
            <select className="select" value={data.appId} onChange={(e) => onApp(e.target.value)}>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
            </select>
          </label>
          <label className={styles.picker}>
            Baseline scan
            <select className="select" value={a?.scanId ?? ''} onChange={(e) => onBaseline(e.target.value)} disabled={!baselineOptions.length}>
              {!baselineOptions.length && <option value="">No scans</option>}
              {baselineOptions.map((s) => <option key={s.scanId} value={s.scanId}>{s.scanId} · {s.date}</option>)}
            </select>
          </label>
          <label className={styles.picker}>
            Compare with
            <select className="select" value={b?.scanId ?? ''} onChange={(e) => onCompare(e.target.value)} disabled={!compareOptions.length}>
              {!compareOptions.length && <option value="">No scans</option>}
              {compareOptions.map((s) => (
                <option key={s.scanId} value={s.scanId}>{s.scanId} · {s.date}{s.latest ? ' (latest)' : ''}</option>
              ))}
            </select>
          </label>
          <DownloadButton onClick={openDownload} />
        </div>
      </div>

      {!a || !b ? (
        <div className="banner" role="status">
          <span>
            No saved regression scans for {data.appName} (<span className="mono">{data.appId}</span>) yet. Run a{' '}
            <Link to="/scans/new">new scan</Link> to start a baseline; Compare needs two scans.
          </span>
        </div>
      ) : !ordered ? (
        <div className="banner warning" role="alert">
          <span>The baseline scan must be older than the scan you compare it with. Pick an earlier baseline or a later scan.</span>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className={`card ${styles.kpi}`}>
              <span className="small muted">Automated coverage</span>
              <span className={styles.kpiValue}>{covA}% → {covB}%</span>
              <span className="small muted">
                {signed(covB - covA)} pts · {a.automatedFRs} of {a.totalFRs} → {b.automatedFRs} of {b.totalFRs} requirements
              </span>
            </div>
            <div className={`card ${styles.kpi}`}>
              <span className="small muted">From Matrix-written tests</span>
              <span className={styles.kpiValue} style={{ color: 'var(--accent-text)' }}>{signed(matrixPts)} pts</span>
              <span className="small muted">
                {plural(b.matrixAutomatedFRs - a.matrixAutomatedFRs, 'requirement')} newly automated
              </span>
            </div>
            <div className={`card ${styles.kpi}`}>
              <span className="small muted">Matrix tests merged</span>
              <span className={styles.kpiValue}>{b.matrixTestsMerged - a.matrixTestsMerged}</span>
              <span className="small muted">from {plural(b.matrixPrsMerged - a.matrixPrsMerged, 'merged Matrix PR')}</span>
            </div>
            <div className={`card ${styles.kpi}`}>
              <span className="small muted">Open gaps</span>
              <span className={styles.kpiValue}>{a.openGaps} → {b.openGaps}</span>
              <span className="small muted">
                {a.openGaps >= b.openGaps ? `${plural(a.openGaps - b.openGaps, 'gap')} closed since baseline` : `${plural(b.openGaps - a.openGaps, 'gap')} more than baseline`}
              </span>
            </div>
          </div>

          <div className="split">
            <div className="main-col" style={{ gap: 16 }}>
              <section aria-labelledby="tr-heading" className={`card ${styles.chartCard}`}>
                <div className="spread">
                  <h2 id="tr-heading" style={{ fontSize: 16 }}>Automated coverage across scans</h2>
                  <div className={styles.legend}>
                    <span><i className={styles.swatch} style={{ background: 'var(--inverse-bg)' }} />Other automation</span>
                    <span><i className={styles.swatch} style={{ background: 'var(--accent)' }} />Matrix-written automation</span>
                    <span><i className={styles.swatch} style={{ background: 'var(--border)' }} />Manual only or no test</span>
                  </div>
                </div>
                <CoverageTrend scans={trend} baselineId={a.scanId} compareId={b.scanId} />
                <span className="small muted">
                  Outlined: the two scans being compared. The trend starts at the first Matrix scan. Percentages are of all
                  functional requirements at the time of each scan.
                </span>
              </section>

              <div className={styles.tableWrap}>
                <DataTable
                  id={TABLE_ID}
                  title={<h2 style={{ fontSize: 16 }}>By module</h2>}
                  rows={rows}
                  columns={columns}
                  rowKey={(r) => r.module}
                  onFilteredChange={setFiltered}
                  searchLabel="Search modules"
                  searchPlaceholder="Search modules"
                  pageSizes={[6, 25, 50]}
                  noun={{ one: 'module', many: 'modules' }}
                  minWidth={900}
                />
              </div>
            </div>

            <div className="side-col" style={{ gap: 16 }}>
              <section aria-labelledby="br-heading" className={`card ${styles.sideCard}`}>
                <h2 id="br-heading">Where the change came from</h2>
                <CoverageBridge rows={bridge} />
                <p className="small muted" style={{ lineHeight: 1.5 }}>
                  New requirements lower the percentage because the total grows; they are shown separately so the gain is not overstated.
                </p>
              </section>

              <section aria-labelledby="lost-heading" className={`card ${styles.sideCard}`}>
                <div className="spread" style={{ gap: 8 }}>
                  <h2 id="lost-heading">Coverage lost since {a.label}</h2>
                  <Pill tone={lost.length ? 'accent' : 'success'}>{plural(lost.length, 'requirement')}</Pill>
                </div>
                {lost.length ? (
                  <ul className={styles.lostList}>
                    {lost.map((l) => (
                      <li key={l.frId}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}><span className="mono">{l.frId}</span> {l.title}</span>
                        <span className="small muted">{l.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small muted">No requirement lost automated coverage between these scans.</p>
                )}
              </section>

              <section aria-labelledby="rule-heading" className={`card ${styles.sideCard}`}>
                <h2 id="rule-heading">How this is counted</h2>
                <ul className={styles.rules}>
                  <li>Coverage comes from each scan's saved snapshot: a requirement is automated when a mapped test passed in that scan's Harness run.</li>
                  <li>Matrix-written means added in a merged Matrix PR and tagged with its requirement ID. Everything else counts as other automation.</li>
                  <li>Every scan is pinned to commits, so the same two scans always give the same answer.</li>
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
