import { useMemo, useState, type CSSProperties } from 'react';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { DownloadButton, ErrorState, Loading, PageHeader, StatCard } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchStats, type PersonUsage, type StatsData } from './api';
import { DailyTokensChart, WeeklyTestsChart } from './Charts';
import styles from './Stats.module.css';

const peopleUnit = { one: 'person', many: 'people' };
const avatarTones = [
  { bg: 'var(--inverse-bg)', fg: 'var(--inverse-text)' },
  { bg: 'var(--bg-chip)', fg: 'var(--text)' },
  { bg: 'var(--accent)', fg: 'var(--on-accent)' },
];

const fmtM = (m: number) => `${m.toFixed(1)}M`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function acceptedTone(v: number) {
  if (v >= 70) return 'var(--success-text)';
  if (v >= 50) return 'var(--warning-text)';
  return 'var(--danger-text)';
}

export default function StatsScreen() {
  const { data, error, loading } = useApi(fetchStats);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Loading user stats" />;
  return <Stats data={data} />;
}

function Stats({ data }: { data: StatsData }) {
  const download = useDownloadReport();
  const [filtered, setFiltered] = useState<PersonUsage[]>(data.people);

  const acceptance = data.weekly.reduce((n, w) => n + w.acceptance, 0);
  const regression = data.weekly.reduce((n, w) => n + w.regression, 0);
  const tests = acceptance + regression;
  const licensePct = pct(data.license.usedM, data.license.totalM);
  const workflowTotal = data.byWorkflow.reduce((n, w) => n + w.tokensM, 0);
  const first = data.weekly[0];
  const last = data.weekly[data.weekly.length - 1];

  const maxTokens = Math.max(...data.people.map((p) => p.tachyonTokensM), 0);
  const columns = useMemo<Column<PersonUsage>[]>(
    () => [
      {
        key: 'user', header: 'User', value: (p) => p.name,
        render: (p) => {
          const tone = avatarTones[[...p.userId].reduce((n, c) => n + c.charCodeAt(0), 0) % avatarTones.length];
          return (
            <span className="row" style={{ '--gap': '10px', flexWrap: 'nowrap' } as CSSProperties}>
              <span className={styles.avatar} style={{ background: tone.bg, color: tone.fg }} aria-hidden="true">{p.initials}</span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</span>
            </span>
          );
        },
      },
      { key: 'acceptance', header: 'Acceptance tests', value: (p) => p.acceptance },
      { key: 'regression', header: 'Regression tests', value: (p) => p.regression },
      { key: 'reviewed', header: 'Items reviewed', value: (p) => p.reviewed },
      {
        key: 'accepted', header: 'Accepted as written', value: (p) => p.acceptedAsWritten,
        render: (p) => <span className="mono small" style={{ color: acceptedTone(p.acceptedAsWritten), fontWeight: 500 }}>{p.acceptedAsWritten}%</span>,
      },
      { key: 'tokens', header: 'Tachyon tokens', value: (p) => p.tachyonTokensM, mono: true, render: (p) => fmtM(p.tachyonTokensM) },
      {
        key: 'share', header: 'Share of license', filter: { type: 'none' },
        value: (p) => pct(p.tachyonTokensM, data.license.totalM),
        render: (p) => {
          const share = pct(p.tachyonTokensM, data.license.totalM);
          return (
            <span className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
              <span className={styles.meter} aria-hidden="true" title="Relative to the heaviest user"><span style={{ width: `${pct(p.tachyonTokensM, maxTokens)}%` }} /></span>
              <span className="mono small">{share}%</span>
            </span>
          );
        },
      },
    ],
    [data.license.totalM, maxTokens],
  );

  const openDownload = () =>
    download.open({
      context: `User stats · ${data.appName} · ${data.period}`,
      reportTypes: [
        {
          key: 'usage',
          label: 'Usage and adoption',
          description: 'Workflow totals, tokens, trends and defined denominators, with permitted personal detail or aggregates.',
          formats: ['xlsx', 'csv', 'pdf', 'html'],
        },
      ],
      scope: {
        filtered: {
          count: filtered.length,
          unit: peopleUnit,
          spec: filterSpec({ period: data.period, rows: filtered.map((p) => p.userId).sort().join(',') }),
        },
        full: { count: data.people.length, unit: peopleUnit },
      },
      snapshot: data.snapshot,
      snapshotCapturedAt: data.snapshotCapturedAt,
      snapshotId: data.snapshotId,
      filters: `Period: ${data.period}`,
      comparison: `Team license: ${fmtM(data.license.usedM)} of ${fmtM(data.license.totalM)} tokens`,
    });

  return (
    <div className="page">
      <PageHeader
        title="User stats"
        subtitle={`How Matrix is used · ${data.appName} · ${data.period.toLowerCase()}`}
        actions={
          <>
            <label className="sr-only" htmlFor="stats-period">Period</label>
            {/* TODO(backend): other periods once GET /api/stats accepts `period`. */}
            <select id="stats-period" className="select" value={data.period} disabled title="Other periods are not available yet">
              <option>{data.period}</option>
            </select>
            <DownloadButton onClick={openDownload} />
          </>
        }
      />

      <div className="kpis">
        <StatCard label="Active users" value={data.activeUsers} note="used Matrix this month" />
        <StatCard label="Tests written" value={tests} note={`${acceptance} acceptance · ${regression} regression`} />
        <StatCard label="Accepted as written" value={data.acceptedAsWritten} unit="%" note="no edits before accepting" />
        <StatCard label="Tachyon tokens" value={fmtM(data.license.usedM)} note={`${licensePct}% of the team license`} />
        <StatCard
          label="Tokens per accepted test"
          value={`${data.tokensPerAcceptedTestK}k`}
          note={`${data.tokensPerAcceptedTestK <= data.tokensPerAcceptedTestPrevK ? 'down' : 'up'} from ${data.tokensPerAcceptedTestPrevK}k last month`}
        />
      </div>

      <section className="card" aria-labelledby="tc-heading">
        <div className="card-pad stack">
          <div className="spread">
            <h2 id="tc-heading" style={{ fontSize: 16 }}>Tests created: acceptance vs regression</h2>
            <span className="small muted">{tests} tests · {data.period.toLowerCase()}</span>
          </div>
          <div className={styles.testsRow}>
            <div className={styles.series}>
              <span className="row small secondary" style={{ '--gap': '8px' } as CSSProperties}>
                <span className={styles.swatch} style={{ background: 'var(--text)' }} />Acceptance
              </span>
              <span className={styles.big}>{acceptance} <small>{pct(acceptance, tests)}%</small></span>
              <span className="small muted">Test cases from Jira stories · {data.acceptanceAcceptedAsWritten}% accepted as written</span>
            </div>
            <div className={styles.series}>
              <span className="row small secondary" style={{ '--gap': '8px' } as CSSProperties}>
                <span className={styles.swatch} style={{ background: 'var(--accent)' }} />Regression
              </span>
              <span className={styles.big}>{regression} <small>{pct(regression, tests)}%</small></span>
              <span className="small muted">Automation for gaps · {data.regressionAcceptedAsWritten}% accepted as written</span>
            </div>
            <div className={styles.weekly}>
              <WeeklyTestsChart weeks={data.weekly} />
              <span className="sr-only">
                Weekly totals rise from {first.acceptance + first.regression} to {last.acceptance + last.regression}.
              </span>
            </div>
          </div>
          <div className={styles.split} aria-hidden="true">
            <span style={{ flexBasis: `${pct(acceptance, tests)}%`, background: 'var(--text)' }} />
            <span style={{ flexBasis: `${pct(regression, tests)}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <div className="stack" style={{ '--gap': '20px' } as CSSProperties}>
          <section className="card" aria-labelledby="ty-heading">
            <div className="card-pad stack">
              <div className="spread">
                <h2 id="ty-heading" style={{ fontSize: 16 }}>Tachyon usage per day</h2>
                <span className="small muted">Tokens, all workflows · weekends shown lighter</span>
              </div>
              <DailyTokensChart days={data.daily} />
            </div>
          </section>

          <DataTable
            id="people"
            title="Usage by person"
            rows={data.people}
            columns={columns}
            rowKey={(p) => p.userId}
            searchLabel="Search people"
            searchPlaceholder="Search by name"
            onFilteredChange={setFiltered}
            pageSizes={[6, 25, 50]}
            minWidth={760}
            noun={peopleUnit}
            actions={<span className="small muted">{data.period} · {data.appName}</span>}
          />
        </div>

        <div className="stack" style={{ '--gap': '20px' } as CSSProperties}>
          <section className="card card-pad stack" aria-labelledby="lic-heading">
            <h2 id="lic-heading" style={{ fontSize: 14 }}>Team license</h2>
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <span className={styles.big}>{licensePct}%</span>
              <span className="small muted">{fmtM(data.license.usedM)} of {fmtM(data.license.totalM)} tokens</span>
            </div>
            <div
              className={styles.track}
              role="meter"
              aria-label="Team license used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={licensePct}
            >
              <span style={{ width: `${licensePct}%` }} />
            </div>
            <p className="small muted">At the current pace the license reaches about {data.license.projectedPct}% by month end.</p>
          </section>

          <section className="card card-pad stack" aria-labelledby="wf-heading">
            <h2 id="wf-heading" style={{ fontSize: 14 }}>Tachyon by workflow</h2>
            <ul className={styles.wfList}>
              {data.byWorkflow.map((w) => {
                const share = pct(w.tokensM, workflowTotal);
                return (
                  <li key={w.workflow}>
                    <span className="spread" style={{ gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{w.workflow}</span>
                      <span className="mono small muted">{fmtM(w.tokensM)} · {share}%</span>
                    </span>
                    <span className={styles.track} aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
