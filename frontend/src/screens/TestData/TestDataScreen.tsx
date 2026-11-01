import { useMemo, useState, type CSSProperties } from 'react';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { SettingsHeader } from '../TestIdentities/SettingsHeader';
import { fetchTestData, type DataSource, type DataStatus, type TestDataData, type TestDataNeed } from './api';
import styles from './TestData.module.css';

const SOURCE_LABEL: Record<DataSource, string> = {
  provisioning_api: 'Provisioning API',
  synthetic: 'Synthetic',
  masked_copy: 'Masked copy',
  fixture: 'Static fixture',
  none: 'None',
};
const STATUS_LABEL: Record<DataStatus, string> = { healthy: 'Healthy', low: 'Low', missing: 'Missing' };
const AVAILABLE_COLOR: Record<DataStatus, string> = {
  healthy: 'var(--success-text)',
  low: 'var(--warning-text)',
  missing: 'var(--danger-text)',
};
const bucket = (n: number) => (n === 0 ? '0' : n <= 10 ? '1–10' : '10+');

export default function TestDataScreen() {
  const { data, error, loading } = useApi(fetchTestData);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <TestData data={data} />;
}

// TODO(backend): POST /api/test-data/{needId}/requests — notifies the test data team (owner TBD).
const requestMessage = (needId: string) =>
  `Request for ${needId} sent to the test data team. Blocked tests stay blocked, not failed, until data exists.`;

const key = (n: TestDataNeed) => `${n.env}:${n._id}`;

function TestData({ data }: { data: TestDataData }) {
  const download = useDownloadReport();
  const [needs, setNeeds] = useState<TestDataNeed[]>(data.needs);
  const [env, setEnv] = useState(data.defaultEnv);
  const [filtered, setFiltered] = useState<TestDataNeed[]>([]);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<TestDataNeed | null>(null);

  const rows = useMemo(() => (env ? needs.filter((n) => n.env === env) : needs), [needs, env]);

  // Columns must be stable for DataTable; handlers only use state setters.
  const columns = useMemo<Column<TestDataNeed>[]>(() => {
  const topUp = (n: TestDataNeed) => {
    // TODO(backend): POST /api/test-data/{needId}/top-up — provisions more records from the need's source.
    setNotice(`Top-up requested for ${n._id} on ${n.env} from ${SOURCE_LABEL[n.source]}.`);
    window.setTimeout(() => {
      setNeeds((ns) => ns.map((x) => (key(x) === key(n) ? { ...x, available: x.available + 20, status: 'healthy' } : x)));
      setNotice(`${n._id} on ${n.env} topped up: 20 more records available.`);
    }, 900);
  };

  const requestData = (needId: string) => setNotice(requestMessage(needId));

  const action = (n: TestDataNeed) => {
    if (n.status === 'missing') return <button type="button" className="link-btn" onClick={() => requestData(n._id)}>Request data</button>;
    if (n.status === 'low') return <button type="button" className="link-btn" onClick={() => topUp(n)}>Top up</button>;
    return <button type="button" className="link-btn" aria-haspopup="dialog" onClick={() => setDetail(n)}>Details</button>;
  };

    return [
    { key: 'need', header: 'Data need', value: (n) => n._id, mono: true, sortable: true },
    { key: 'desc', header: 'Description', value: (n) => n.description, sortable: true },
    { key: 'source', header: 'Source', value: (n) => SOURCE_LABEL[n.source], filter: { type: 'select', options: Object.values(SOURCE_LABEL) }, sortable: true },
    {
      key: 'available',
      header: 'Available',
      value: (n) => n.available,
      filter: { type: 'select', options: ['0', '1–10', '10+'], match: (n, v) => bucket(n.available) === v },
      sortable: true,
      render: (n) => <strong style={{ color: AVAILABLE_COLOR[n.status] }}>{n.available}</strong>,
    },
    { key: 'reserved', header: 'Reserved', value: (n) => String(n.reserved), filter: { type: 'none' } },
    {
      key: 'status',
      header: 'Status',
      value: (n) => STATUS_LABEL[n.status],
      filter: { type: 'select', options: Object.values(STATUS_LABEL) },
      sortable: true,
      render: (n) =>
        n.status === 'missing' ? (
          <span className={styles.solid}>{STATUS_LABEL[n.status]}</span>
        ) : (
          <Pill tone={n.status === 'low' ? 'warning' : 'success'}>{STATUS_LABEL[n.status]}</Pill>
        ),
    },
    { key: 'action', header: '', value: () => '', filter: { type: 'none' }, render: action },
  ];
  }, []);

  const unit = { one: 'data need', many: 'data needs' };
  const healthy = needs.filter((n) => n.status === 'healthy').length;
  const missing = needs.filter((n) => n.status === 'missing').length;
  const blockedTotal = data.blocking.reduce((s, b) => s + b.blockedTests, 0);

  const openReport = () =>
    download.open({
      context: `Settings · Test data${env ? ` · ${env}` : ''}`,
      reportTypes: [
        {
          key: 'data-readiness',
          label: 'Data readiness',
          description: 'Data-need availability and reservations by environment, blocked tests and recovery owner and status. No raw reserved records.',
          formats: ['pdf', 'html', 'xlsx'],
          sections: 'Summary, availability by data need and environment, reservation counts, blocked tests, recovery actions',
          exclusions: 'Raw test-data records and reserved record contents are never exported; reservations appear as counts',
        },
      ],
      scope: {
        filtered: {
          count: filtered.length,
          unit,
          hint: `Every page in ${env || 'all environments'}, not just the rows shown`,
          spec: filterSpec({ env: env || 'all', rows: filtered.map(key).sort().join(',') }),
        },
        full: { count: needs.length, unit, hint: 'All environments; ignores the environment choice and table filters' },
      },
      selectionHint: 'The data catalogue has no row selection',
      snapshot: `Test data catalogue · data as of ${new Date(data.dataAsOf).toUTCString().replace(' GMT', ' UTC')}`,
      snapshotId: `TD-${data.dataAsOf.slice(0, 10).replace(/-/g, '')}`,
      snapshotCapturedAt: data.dataAsOf,
      filters: `Environment: ${env || 'All'}${filtered.length !== rows.length ? ' · table search and column filters' : ''}`,
      comparison: `Whole application, for comparison: ${healthy} of ${needs.length} data needs healthy, ${missing} missing, ${blockedTotal} tests blocked`,
    });

  return (
    <div className="page">
      <div className="stack" style={{ '--gap': '16px' } as CSSProperties}>
        <SettingsHeader current="Test data" />
      </div>

      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {notice && (
        <div className="banner">
          <Icon name="info" />
          <span className="grow">{notice}</span>
          <button type="button" className="btn icon" aria-label="Dismiss message" onClick={() => setNotice('')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <DataTable
        id="testdata"
        title="Test data catalogue"
        rows={rows}
        columns={columns}
        rowKey={key}
        searchLabel="Search test data"
        searchPlaceholder="Search by data need or description"
        pageSizes={[6, 25, 50]}
        noun={unit}
        onFilteredChange={setFiltered}
        actions={
          <>
            <label className="row" style={{ '--gap': '6px' } as CSSProperties}>
              <span className="small secondary">Environment</span>
              <select className="select" value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="">All</option>
                {data.environments.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
            <DownloadButton onClick={openReport} />
            <button
              type="button"
              className="btn"
              onClick={() => setNotice('Adding a data need is not available yet. Tests declare needs with @data; Matrix lists them here once a scan finds them.')}
            >
              Add data need
            </button>
          </>
        }
      />

      <div className={styles.cards}>
        <section className="card attention card-pad stack" aria-labelledby="bl-heading">
          <div className="spread">
            <h2 id="bl-heading" style={{ fontSize: 15 }}>Blocking tests</h2>
            {blockedTotal > 0 && <span className={styles.solid}>{blockedTotal} {blockedTotal === 1 ? 'test' : 'tests'}</span>}
          </div>
          {data.blocking.length === 0 ? (
            <p className="secondary">No tests are blocked by missing data.</p>
          ) : (
            data.blocking.map((b) => (
              <p key={b.needId} className="secondary" style={{ lineHeight: 1.55 }}>
                <span className="mono" style={{ color: 'var(--text)' }}>{b.needId}</span> has no data, so {b.blockedTests} regression{' '}
                {b.blockedTests === 1 ? 'test was' : 'tests were'} blocked in run #{b.runId} instead of failing.
              </p>
            ))
          )}
          {data.blocking.length > 0 && (
            <div className="stack" style={{ '--gap': '8px', alignItems: 'flex-start' } as CSSProperties}>
              <button type="button" className="btn dark" onClick={() => setNotice(data.blocking.map((b) => requestMessage(b.needId)).join(' '))}>
                Request from test data team
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setNotice(`Synthetic data generation for ${data.blocking.map((b) => b.needId).join(', ')} needs review before tests use it. TODO: generator not connected.`)}
              >
                Generate synthetic
              </button>
            </div>
          )}
        </section>

        <section className="card card-pad stack" aria-labelledby="rs-heading">
          <h2 id="rs-heading" style={{ fontSize: 15 }}>Reserved right now</h2>
          <ul className={styles.reservations}>
            {data.reservations.map((r) => (
              <li key={r.runId}>
                <span className="secondary">{r.label}</span>
                <span className="mono small muted">{r.records} {r.records === 1 ? 'record' : 'records'}</span>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ lineHeight: 1.5 }}>
            Records are locked per run so parallel HyperExecute sessions never share an account, then reset when the run ends.
          </p>
        </section>

        <section className="card card-pad stack" aria-labelledby="hd-heading">
          <h2 id="hd-heading" style={{ fontSize: 15 }}>How tests ask for data</h2>
          <pre className="code">{data.example}</pre>
          <p className="secondary" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Tests name the data they need, never a specific record. Matrix picks, reserves and releases it.
          </p>
        </section>
      </div>

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?._id ?? 'Data need'} subtitle={detail ? `${detail.env} · ${detail.description}` : undefined} width={520}>
        {detail && (
          <dl className={`card-pad ${styles.detail}`}>
            <dt>Source</dt><dd>{SOURCE_LABEL[detail.source]}</dd>
            <dt>Available</dt><dd>{detail.available}</dd>
            <dt>Reserved</dt><dd>{String(detail.reserved)}</dd>
            <dt>Status</dt><dd>{STATUS_LABEL[detail.status]}</dd>
            <dt>Records</dt><dd className="muted">Individual records are not shown; Matrix reserves and releases them per run.</dd>
          </dl>
        )}
      </Dialog>
    </div>
  );
}
