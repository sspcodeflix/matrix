// Journeys data is observed behaviour: use it for how to navigate, never as expected results.
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column, type TableView } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchJourneys, type Journey, type JourneysData } from './api';
import styles from './Journeys.module.css';

const VIEWS: TableView<Journey>[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'undocumented', label: 'No requirement', match: (j) => !j.matchedFR },
  { key: 'matched', label: 'Matched', match: (j) => !!j.matchedFR },
];

export default function JourneysScreen() {
  const { data, error, loading } = useApi(fetchJourneys);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <Journeys data={data} />;
}

function Journeys({ data }: { data: JourneysData }) {
  const download = useDownloadReport();
  const { crawl } = data;
  const [crawlQueued, setCrawlQueued] = useState(false);
  const [filtered, setFiltered] = useState<Journey[]>(data.journeys);
  const onFiltered = useCallback((rows: Journey[]) => setFiltered(rows), []);
  const undocumented = data.journeys.filter((j) => !j.matchedFR);

  const columns = useMemo<Column<Journey>[]>(
    () => [
      { key: 'name', header: 'Journey', value: (j) => j.name, render: (j) => <span style={{ fontWeight: 600 }}>{j.name}</span> },
      { key: 'steps', header: 'Steps', value: (j) => j.stepCount, filter: { type: 'none' } },
      {
        key: 'roles',
        header: 'Who can reach it',
        value: (j) => j.reachableBy.join(', '),
        render: (j) => <span className="secondary">{j.reachableBy.join(', ')}</span>,
      },
      {
        key: 'fr',
        header: 'Requirement',
        value: (j) => j.matchedFR ?? 'No requirement',
        render: (j) =>
          j.matchedFR ? (
            // TODO(backend): requirement detail route.
            <a href="#" className="mono" style={{ fontWeight: 500, textDecoration: 'none' }}>{j.matchedFR}</a>
          ) : (
            <Pill tone="accent">No requirement</Pill>
          ),
      },
      {
        key: 'tests',
        header: 'Manual tests',
        value: (j) => (j.manualTests > 0 ? 'Written' : 'None yet'),
        filter: { type: 'select', options: ['None yet', 'Written'] },
        render: (j) => <span className="secondary">{j.manualTests > 0 ? j.manualTests : 'None yet'}</span>,
      },
      {
        key: 'action',
        header: 'Next step',
        value: () => '',
        sortable: false,
        filter: { type: 'none' },
        render: (j) =>
          !j.matchedFR ? (
            <Link to="/huddle" style={{ fontWeight: 500, textDecoration: 'none' }}>In Huddle review</Link>
          ) : j.manualTests === 0 ? (
            <Link to="/acceptance" style={{ fontWeight: 500, textDecoration: 'none' }}>Write manual tests</Link>
          ) : (
            <Link to="/review" style={{ fontWeight: 500, textDecoration: 'none' }}>View tests</Link>
          ),
      },
    ],
    [],
  );

  const openDownload = () =>
    download.open({
      context: `Journeys · ${data.application} · crawl ${crawl._id} on ${crawl.env}`,
      reportTypes: [
        {
          key: 'journeys',
          label: 'Journey findings (Observed behaviour)',
          description: 'Crawl scope, observed paths, requirement mappings, undocumented and unreachable paths, access findings and linked Huddle decisions.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        filtered: {
          count: filtered.length,
          unit: { one: 'journey', many: 'journeys' },
          spec: filterSpec({ rows: filtered.map((j) => j._id).sort().join(',') }),
        },
        full: { count: data.journeys.length, unit: { one: 'journey', many: 'journeys' } },
      },
      snapshot: `Crawl ${crawl._id} · ${crawl.env} · ${crawl.startedLabel} · Observed behaviour`,
      snapshotId: crawl._id,
      snapshotCapturedAt: crawl.finishedAt,
      filters: filtered.length !== data.journeys.length ? 'Filtered journeys table' : undefined,
    });

  return (
    <div className="page">
      <PageHeader
        title="Journeys"
        subtitle={
          <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
            <span className="secondary" style={{ fontSize: 14 }}>
              Matrix clicks through the app as each test role and maps the journeys it finds.
            </span>
            <span>
              Last crawl {crawl.startedLabel} on {crawl.env} · {data.journeys.length} journeys · {crawl.roles.length} roles · added to{' '}
              <Link to="/context" style={{ fontWeight: 500, textDecoration: 'none' }}>App context</Link> automatically ·{' '}
              {/* TODO(backend): crawl settings live under Settings; no dedicated tab yet. */}
              <Link to="/settings" style={{ fontWeight: 500, textDecoration: 'none' }}>Crawl settings</Link>
            </span>
          </span>
        }
        actions={
          <>
            <DownloadButton onClick={openDownload} />
            {/* TODO(backend): POST /api/apps/{appId}/crawls (background worker, Playwright). */}
            <button type="button" className="btn primary" disabled={crawlQueued} onClick={() => setCrawlQueued(true)}>
              {crawlQueued ? 'Crawl queued' : 'Start crawl'}
            </button>
          </>
        }
      />

      {crawlQueued && (
        <div className="banner" role="status">
          <Icon name="info" />
          <span>
            Crawl queued on {crawl.env} as {crawl.roles.length} roles. You can leave this page; results replace this view when the crawl finishes.
          </span>
        </div>
      )}

      <div className={styles.observed} role="note" aria-label="Observed behaviour">
        <span className={styles.observedLabel}>Observed behaviour</span>
        <div className="stack grow" style={{ '--gap': '6px' } as CSSProperties}>
          <span style={{ fontSize: 13 }}>
            Everything on this page is what the crawler saw the app do. Matrix uses it to learn how to navigate, never as expected results.
            Expected outcomes come from cited requirements and rules.
          </span>
          <span className={styles.scope}>
            <span className="chip">env {crawl.env}</span>
            <span className="chip">{crawl.startedLabel} · {crawl.durationLabel}</span>
            <span className="chip">{crawl.screens} screens</span>
            {crawl.components.map((c) => <span key={c} className="chip">{c}</span>)}
            <span>Roles: {crawl.roles.join(', ')}</span>
          </span>
        </div>
      </div>

      <section className="stack" style={{ '--gap': '10px' } as CSSProperties} aria-labelledby="found-heading">
        <h2 id="found-heading" style={{ fontSize: 16 }}>What the crawl found</h2>
        <div className={styles.findings}>
          <article className={styles.finding}>
            <span className={styles.findingHead}>
              <span className={`${styles.big} ${styles.bigAccent}`}>{undocumented.length}</span>
              <h3 className={styles.findingTitle}>Undocumented journeys</h3>
            </span>
            <p className={styles.body}>The app does these, but no requirement describes them. Each one goes to Huddle for a decision.</p>
            <Link to="/huddle" className={styles.findingLink}>{data.undocumented.inHuddle} waiting in Huddle</Link>
          </article>

          <article className={styles.finding}>
            <span className={styles.findingHead}>
              <span className={styles.big}>{data.unconfirmed.length}</span>
              <h3 className={styles.findingTitle}>Requirements not confirmed</h3>
            </span>
            <p className={styles.body}>The crawl could not reach them, so they stay unconfirmed rather than missing.</p>
            <ul className={styles.reasons}>
              {data.unconfirmed.map((u) => (
                <li key={u.frId}><span className="mono">{u.frId}</span> <span className="secondary">{u.reason}</span></li>
              ))}
            </ul>
            <Link to="/regression" className={styles.findingLink}>See why in Regression</Link>
          </article>

          <article className={styles.finding}>
            <span className={styles.findingHead}>
              <span className={`${styles.big} ${styles.bigAccent}`}>{data.access.length}</span>
              <h3 className={styles.findingTitle}>{data.access.length === 1 ? 'Possible access problem' : 'Possible access problems'}</h3>
            </span>
            {data.access.map((a) => (
              <div key={a.journey + a.role} className="stack" style={{ '--gap': '8px' } as CSSProperties}>
                <p className={styles.body}>{a.summary}</p>
                <div className={styles.cite}>
                  <span className="eyebrow">Authoritative rule</span>
                  <p>{a.rule.text}</p>
                  <span className="mono">{a.rule.source} · {a.rule.frId}</span>
                </div>
              </div>
            ))}
            <Link to="/review" className={styles.findingLink}>Write a negative test</Link>
          </article>
        </div>
      </section>

      <div className={styles.tableWrap}>
        <DataTable
          id="journeys"
          title={<h2 style={{ fontSize: 16 }}>User journeys</h2>}
          rows={data.journeys}
          columns={columns}
          rowKey={(j) => j._id}
          views={VIEWS}
          searchLabel="Search journeys"
          searchPlaceholder="Search journeys"
          onFilteredChange={onFiltered}
          noun={{ one: 'journey', many: 'journeys' }}
        />
      </div>
    </div>
  );
}
