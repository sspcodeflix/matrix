import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill, StatCard } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { useWorkspace } from '../../workspace/useWorkspace';
import { fetchOverview, inScopeOf, pct, rollup, type AppCoverage, type OverviewData } from './api';
import { CoverageBars, CoverageTrendChart, TierLegend, type BarRow } from './charts';
import styles from './Overview.module.css';

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

const regressionLink = (appId: string) => `/regression?app=${encodeURIComponent(appId)}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function OverviewScreen() {
  const { data, error } = useApi(fetchOverview);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading overview" />;
  return <Overview data={data} />;
}

function Overview({ data }: { data: OverviewData }) {
  const [params, setParams] = useSearchParams();
  // Default: the portfolio (CIO) of the application chosen after sign-in; `cio=all` shows every CIO.
  const { application } = useWorkspace();
  const homeCio = data.apps.find((a) => a.id === application.id)?.cioId ?? null;
  const cioId = params.get('cio') ?? homeCio;
  const cio = data.cios.find((c) => c.id === cioId) ?? null;
  const apps = useMemo(() => (cio ? data.apps.filter((a) => a.cioId === cio.id) : data.apps), [data.apps, cio]);
  const total = rollup(apps, data.staleAfterDays);
  const scopeName = cio ? cio.name : 'All CIOs';
  const cioName = (id: string) => data.cios.find((c) => c.id === id)?.name ?? id;
  const download = useDownloadReport();

  const setCio = (id: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('cio', id ?? 'all');
      return next;
    });

  // All CIOs: one bar per CIO. One CIO: one bar per application.
  const barRows: BarRow[] = cio
    ? apps.map((a) => ({
        id: a.id,
        label: <span className="mono">{a.id}</span>,
        sublabel: a.name,
        counts: a.scan?.counts,
      }))
    : data.cios.map((c) => {
        const r = rollup(data.apps.filter((a) => a.cioId === c.id), data.staleAfterDays);
        return {
          id: c.id,
          label: c.name,
          sublabel: `${r.measured} of ${r.total} apps measured`,
          counts: r.measured ? r : undefined,
          onSelect: () => setCio(c.id),
        };
      });

  const columns = useMemo<Column<AppCoverage>[]>(
    () => [
      {
        key: 'id', header: 'App', value: (a) => a.id, mono: true,
        // The link carries the application; Regression switches to it or explains why it cannot.
        render: (a) => <Link to={regressionLink(a.id)} title={`Open Regression for ${a.name}`}>{a.id}</Link>,
      },
      { key: 'name', header: 'Application', value: (a) => a.name },
      { key: 'cio', header: 'CIO', value: (a) => cioName(a.cioId), filter: { type: 'select' } },
      {
        key: 'coverage', header: 'Coverage', align: 'right',
        value: (a) => (a.scan ? pct(a.scan.counts.passing, inScopeOf(a.scan.counts)) : -1),
        filterValue: (a) => (a.scan ? 'Measured' : 'Not measured'),
        filter: { type: 'select', options: ['Measured', 'Not measured'] },
        render: (a) =>
          a.scan ? (
            <span><strong>{pct(a.scan.counts.passing, inScopeOf(a.scan.counts))}%</strong> <span className="muted small">{a.scan.counts.passing} of {inScopeOf(a.scan.counts)}</span></span>
          ) : (
            <span className={styles.notMeasured}>Not measured</span>
          ),
      },
      { key: 'noTest', header: 'No test', align: 'right', value: (a) => a.scan?.counts.noTest ?? -1, filter: { type: 'none' }, render: (a) => (a.scan ? a.scan.counts.noTest : '·') },
      { key: 'cases', header: 'Cases only', align: 'right', value: (a) => a.scan?.counts.casesOnly ?? -1, filter: { type: 'none' }, render: (a) => (a.scan ? a.scan.counts.casesOnly : '·') },
      { key: 'awaiting', header: 'Awaiting', align: 'right', value: (a) => a.scan?.counts.awaiting ?? -1, filter: { type: 'none' }, render: (a) => (a.scan ? a.scan.counts.awaiting : '·') },
      { key: 'matrix', header: 'Matrix-written', align: 'right', value: (a) => a.scan?.matrixWritten ?? -1, filter: { type: 'none' }, render: (a) => (a.scan ? a.scan.matrixWritten : '·') },
      { key: 'workspaces', header: 'Wksp', align: 'right', value: (a) => a.workspaces, filter: { type: 'none' } },
      {
        key: 'scan', header: 'Last scan', value: (a) => a.scan?.capturedAt ?? '',
        filterValue: (a) => (!a.scan ? 'No scan' : a.scan.ageDays > data.staleAfterDays ? 'Stale' : 'Current'),
        filter: { type: 'select', options: ['Current', 'Stale', 'No scan'] },
        render: (a) =>
          !a.scan ? <span className={styles.notMeasured}>None</span>
          : a.scan.ageDays > data.staleAfterDays ? <Pill tone="warning">Stale · {a.scan.ageDays}d</Pill>
          : <span className="small" title={`${a.scan.id} · ${fmtDate(a.scan.capturedAt)}`}>{a.scan.ageDays === 0 ? 'Today' : `${a.scan.ageDays}d ago`}</span>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const trend = data.trend[cio?.id ?? 'all'] ?? [];
  const reviews = apps.reduce((n, a) => n + a.pendingReviews, 0);
  const stories = apps.reduce((n, a) => n + a.acceptance.stories, 0);
  const signedOff = apps.reduce((n, a) => n + a.acceptance.signedOff, 0);
  const gaps = total.inScope - total.passing;
  const unit = { one: 'application', many: 'applications' };

  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppCoverage[]>(apps);
  const breakdownLabel = cio ? `Coverage by application · ${cio.name}` : 'Coverage by CIO';

  /** Every report shown on this page is downloadable; exports carry exact values, never only pictures. */
  const openDownload = (reportType: string) => {
    const records = (n: number, what: string) => ({ selected: `${plural(n, what)}`, filtered: `${plural(n, what)}`, full: `${plural(n, what)}` });
    download.open({
      context: `Overview · ${scopeName}`,
      defaultReportType: reportType,
      reportTypes: [
        {
          key: 'coverage-overview',
          label: 'Coverage overview (whole page)',
          description: 'Summary cards, coverage by CIO or application, monthly trend and the applications table, with numerators, denominators, tiers and scan dates.',
          formats: ['pdf', 'html', 'xlsx'],
          sections: 'Summary, coverage breakdown with exact values, trend values, applications, metric definitions',
        },
        {
          key: 'coverage-breakdown',
          label: breakdownLabel,
          description: 'One row per CIO or application: automated and passing, cases only, awaiting or stale, no test, in scope, percent, applications measured.',
          formats: ['xlsx', 'csv', 'pdf'],
          records: records(barRows.length, cio ? 'application' : 'CIO'),
        },
        {
          key: 'coverage-trend',
          label: `Coverage trend · ${scopeName}`,
          description: 'Monthly covered, in-scope and Matrix-written counts with percentages.',
          formats: ['xlsx', 'csv', 'pdf'],
          records: records(trend.length, 'month'),
        },
        {
          key: 'applications',
          label: 'Applications table',
          description: 'Every column of the table, including scan IDs, scan dates and stale or not measured status.',
          formats: ['xlsx', 'csv'],
        },
      ],
      scope: {
        selected: { count: selectedApps.length, unit, ids: [...selectedApps].sort() },
        filtered: {
          count: filteredApps.length,
          unit,
          spec: filterSpec({ cio: cio?.id ?? 'all', rows: filteredApps.map((a) => a.id).sort().join(',') }),
          hint: 'Applications matching the portfolio and the table filters',
        },
        full: { count: data.apps.length, unit, hint: 'Every application you can see, all CIOs' },
      },
      selectionHint: 'Select applications in the table to use this',
      snapshot: `Latest completed scan per application · ${total.measured} of ${total.total} measured`,
      snapshotCapturedAt: data.asOf,
      snapshotId: `OVERVIEW-${data.asOf.slice(0, 10)}`,
      // Portfolio-level report: name the file after the portfolio, not the current application.
      applicationName: cio ? cio.name : 'All CIOs',
      filters: cio ? `Portfolio: ${cio.name}` : 'All CIOs',
      comparison: `${scopeName}: ${total.passing} of ${total.inScope} requirements automated and passing (${pct(total.passing, total.inScope)}%)`,
    });
  };

  const sectionDownload = (reportType: string, name: string) => (
    <button type="button" className="btn" aria-haspopup="dialog" aria-label={`Download ${name}`} onClick={() => openDownload(reportType)}>
      <Icon name="download" size={16} strokeWidth={2} /> Download
    </button>
  );

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        subtitle={`${scopeName} · functional coverage from each application's latest completed scan · as of ${fmtDate(data.asOf)}`}
        actions={<DownloadButton onClick={() => openDownload('coverage-overview')} />}
      />

      <div className={styles.filters}>
        <label className="field">
          <span className="field-label">Portfolio (CIO)</span>
          <select className="select" value={cio?.id ?? ''} onChange={(e) => setCio(e.target.value || null)}>
            <option value="">All CIOs</option>
            {data.cios.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {cio && <button type="button" className="link-btn" onClick={() => setCio(null)}>Show all CIOs</button>}
        {cio && cio.id === homeCio && <span className="small muted" style={{ alignSelf: 'center' }}>Your portfolio: {application.name} ({application.id}) belongs to {cio.name}</span>}
      </div>

      <div className="kpis">
        <StatCard
          label="Functional coverage"
          value={`${pct(total.passing, total.inScope)}%`}
          tone="success"
          note={`${total.passing} of ${total.inScope} requirements automated and passing`}
        />
        <StatCard
          label="Applications measured"
          value={total.measured}
          unit={`of ${total.total}`}
          note={total.stale ? `${total.stale} with a stale scan · ${total.total - total.measured} not measured` : `${total.total - total.measured} not measured`}
        />
        <StatCard label="Open gaps" value={gaps} tone="accent" note={`${total.noTest} no test · ${total.casesOnly} cases only · ${total.awaiting} awaiting`} />
        <StatCard
          label="Matrix contribution"
          value={total.matrixWritten}
          unit={`${pct(total.matrixWritten, total.inScope)} pts`}
          note="Requirements covered by Matrix-written tests"
        />
        <StatCard label="Waiting for review" value={reviews} note={`Acceptance: ${signedOff} of ${stories} stories signed off`} />
      </div>

      <div className={styles.charts}>
        <section className={`card ${styles.chartCard}`} aria-labelledby="by-scope">
          <div className="spread">
            <div className="stack" style={{ gap: 2 }}>
              <h2 id="by-scope" style={{ fontSize: 16 }}>{breakdownLabel}</h2>
              <span className="small muted">{cio ? 'Each application counted once' : 'Select a CIO to see its applications'}</span>
            </div>
            {sectionDownload('coverage-breakdown', breakdownLabel)}
          </div>
          <TierLegend />
          <CoverageBars rows={barRows} caption={cio ? `Coverage by application for ${cio.name}` : 'Coverage by CIO'} />
          <p className="small muted">
            Percent = automated and passing ÷ in-scope requirements, adding counts across measured applications. Applications without a completed scan are not measured, not 0%.
          </p>
        </section>

        <section className={`card ${styles.chartCard}`} aria-labelledby="trend">
          <div className="spread">
            <div className="stack" style={{ gap: 2 }}>
              <h2 id="trend" style={{ fontSize: 16 }}>Coverage trend · {scopeName}</h2>
              <span className="small muted">Month end · since the first Matrix scan</span>
            </div>
            {trend.length > 0 && sectionDownload('coverage-trend', `coverage trend for ${scopeName}`)}
          </div>
          {trend.length ? <CoverageTrendChart points={trend} /> : <p className="muted">No completed scans yet.</p>}
        </section>
      </div>

      <DataTable
        id="ov-apps"
        title={<h2 style={{ fontSize: 16 }}>Applications</h2>}
        rows={apps}
        columns={columns}
        rowKey={(a) => a.id}
        rowLabel={(a) => a.name}
        selectable
        onSelectionChange={setSelectedApps}
        onFilteredChange={setFilteredApps}
        actions={sectionDownload('applications', 'applications table')}
        searchPlaceholder="Search by app ID, application or CIO"
        defaultPageSize={10}
        noun={{ one: 'application', many: 'applications' }}
        minWidth={980}
      />
    </div>
  );
}
