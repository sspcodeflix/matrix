import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import {
  SOURCE_TYPE_LABEL, fetchContext, testRetrieval,
  type ContextData, type RetrievalChunk, type Source, type SourceStatus, type SourceType,
} from './api';
import styles from './Context.module.css';

const STATUS_LABEL: Record<SourceStatus, string> = { embedded: 'Embedded', syncing: 'Syncing', failed: 'Failed', stale: 'Stale' };
const STATUS_COLOR: Record<SourceStatus, string> = {
  embedded: 'var(--success)', syncing: 'var(--text-muted)', failed: 'var(--accent)', stale: 'var(--warning)',
};
const ACTION_LABEL: Record<Source['action'], string> = {
  resync: 'Resync', update_spec: 'Update spec', fix: 'Fix', replace: 'Replace', view: 'View',
};

const TILES: { type: SourceType; title: string; hint: string }[] = [
  { type: 'pdf', title: 'PDF or Word', hint: 'Upload a document' },
  { type: 'api_spec', title: 'API spec', hint: 'OpenAPI file or URL' },
  { type: 'knowledge_os', title: 'Knowledge OS', hint: 'Link an app entry' },
  { type: 'confluence', title: 'Confluence', hint: 'Link a space or page' },
  { type: 'documind', title: 'DocuMind', hint: 'Link verified docs' },
  { type: 'journeys', title: 'Journey crawl', hint: 'Use discovered journeys' },
];

const SYNC_MS = 1500;

export default function ContextScreen() {
  const { data, error, loading } = useApi(fetchContext);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <AppContext data={data} />;
}

interface AddRequest { type: SourceType; replaceId?: string }

function AppContext({ data }: { data: ContextData }) {
  const download = useDownloadReport();
  const [sources, setSources] = useState(data.sources);
  const [filtered, setFiltered] = useState<Source[]>(data.sources);
  const onFiltered = useCallback((rows: Source[]) => setFiltered(rows), []);
  const [adding, setAdding] = useState<AddRequest | null>(null);

  // Local simulation of the ingestion worker: syncing sources finish after a short delay.
  // TODO(backend): poll GET /api/apps/{appId}/context/sources for job state.
  const syncing = sources.some((s) => s.status === 'syncing');
  useEffect(() => {
    if (!syncing) return;
    const t = setTimeout(() => {
      setSources((all) =>
        all.map((s) => (s.status === 'syncing' ? { ...s, status: 'embedded', statusDetail: undefined, updatedLabel: 'Just now' } : s)),
      );
    }, SYNC_MS);
    return () => clearTimeout(t);
  }, [syncing]);

  // TODO(backend): POST /api/apps/{appId}/context/sources/{id}/resync.
  const resync = (ids: string[]) =>
    setSources((all) => all.map((s) => (ids.includes(s._id) ? { ...s, status: 'syncing', statusDetail: undefined } : s)));
  const resyncable = sources.filter((s) => s.status === 'embedded' && s.action === 'resync');

  const componentName = (s: Source) => (s.componentIds.length ? s.componentIds.join(', ') : 'All');

  const columns = useMemo<Column<Source>[]>(
    () => [
      {
        key: 'name',
        header: 'Source',
        value: (s) => s.name,
        render: (s) => (
          <span className={styles.srcName}>
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <span className="mono muted" style={{ fontSize: 11 }}>{s.locator}</span>
          </span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        value: (s) => SOURCE_TYPE_LABEL[s.type],
        filter: { type: 'select', options: Object.values(SOURCE_TYPE_LABEL) },
        render: (s) => (
          <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
            {SOURCE_TYPE_LABEL[s.type]}
            {s.type === 'journeys' && <span className="chip tone-warning">observed</span>}
          </span>
        ),
      },
      {
        key: 'component',
        header: 'Component',
        value: (s) => componentName(s),
        filter: { type: 'text' },
      },
      { key: 'content', header: 'Content', value: (s) => s.content, filter: { type: 'none' } },
      {
        key: 'status',
        header: 'Status',
        value: (s) => STATUS_LABEL[s.status],
        filter: { type: 'select', options: Object.values(STATUS_LABEL) },
        render: (s) => (
          <span className={styles.status} role={s.status === 'syncing' ? 'status' : undefined}>
            <span className="dot" style={{ background: STATUS_COLOR[s.status] }} />
            {s.statusDetail ?? (s.status === 'syncing' ? 'Syncing…' : STATUS_LABEL[s.status])}
          </span>
        ),
      },
      { key: 'updated', header: 'Updated', value: (s) => s.updatedAt, render: (s) => s.updatedLabel, filter: { type: 'none' } },
      {
        key: 'action',
        header: 'Action',
        value: () => '',
        sortable: false,
        filter: { type: 'none' },
        render: (s) => {
          const label = ACTION_LABEL[s.action];
          if (s.action === 'view') return <Link to="/journeys" style={{ fontWeight: 500, textDecoration: 'none' }}>{label}</Link>;
          // TODO(backend): fixing a spec happens in its Git repo; link to the file once known.
          if (s.action === 'fix') return <a href="#" style={{ fontWeight: 500, textDecoration: 'none' }} aria-label={`Fix ${s.name}`}>{label}</a>;
          if (s.action === 'resync') {
            return (
              <button
                type="button"
                className="link-btn"
                disabled={s.status === 'syncing'}
                aria-label={`Resync ${s.name}`}
                onClick={() => resync([s._id])}
              >
                {s.status === 'syncing' ? 'Syncing' : label}
              </button>
            );
          }
          return (
            <button type="button" className="link-btn" aria-label={`${label}: ${s.name}`} onClick={() => setAdding({ type: s.type, replaceId: s._id })}>
              {label}
            </button>
          );
        },
      },
    ],
    [],
  );

  const issues = sources.filter((s) => s.status === 'failed' || s.status === 'stale').length + data.attention.filter((a) => a.kind === 'conflict').length;

  const openDownload = () =>
    download.open({
      context: `App context · ${data.application}`,
      reportTypes: [
        {
          key: 'context-health',
          label: 'Context health and decisions',
          description: 'Source, version and freshness metadata, unresolved conflicts, generation eligibility and decisions. Cited excerpts only.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        filtered: {
          count: filtered.length,
          unit: { one: 'source', many: 'sources' },
          spec: filterSpec({ rows: filtered.map((s) => s._id).sort().join(',') }),
        },
        full: { count: sources.length, unit: { one: 'source', many: 'sources' } },
      },
      snapshot: `Context refreshed ${data.summary.refreshedLabel} · ${issues} open issues`,
      snapshotId: `CTX-${data.summary.refreshedAt.replace(/[-:]/g, '').slice(0, 13)}`,
      snapshotCapturedAt: data.summary.refreshedAt,
      filters: filtered.length !== sources.length ? 'Filtered sources table' : undefined,
    });

  const addSource = (req: AddRequest, values: { name: string; locator: string; component: string }) => {
    // TODO(backend): POST /api/apps/{appId}/context/sources (ingestion worker; large files to the NAS).
    if (req.replaceId) {
      setSources((all) =>
        all.map((s) => (s._id === req.replaceId ? { ...s, locator: values.locator || s.locator, status: 'syncing', statusDetail: undefined } : s)),
      );
      return;
    }
    setSources((all) => [
      ...all,
      {
        _id: `local-${Date.now()}`,
        type: req.type,
        name: values.name,
        locator: values.locator,
        componentIds: values.component ? [values.component] : [],
        content: 'Ingesting',
        status: 'syncing',
        updatedAt: new Date().toISOString(),
        updatedLabel: 'Just now',
        action: 'resync',
      },
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="App context"
        subtitle={
          <span className="stack" style={{ '--gap': '4px' } as CSSProperties}>
            <span className="secondary" style={{ fontSize: 14 }}>
              Everything Matrix knows about {data.application}. Acceptance, Regression and Journeys retrieve from here.
            </span>
            <span>
              {sources.length} sources · {data.summary.chunks.toLocaleString('en-GB')} chunks embedded · stored in {data.summary.store} · refreshed {data.summary.refreshedLabel}
            </span>
          </span>
        }
        actions={
          <>
            <DownloadButton onClick={openDownload} />
            <button type="button" className="btn" disabled={resyncable.length === 0} onClick={() => resync(resyncable.map((s) => s._id))}>
              Resync all
            </button>
            <button type="button" className="btn primary" onClick={() => setAdding({ type: 'pdf' })}>
              Add source
            </button>
          </>
        }
      />

      <section className="stack" style={{ '--gap': '10px' } as CSSProperties} aria-labelledby="attn-heading">
        <h2 id="attn-heading" style={{ fontSize: 16 }}>Needs attention</h2>
        <div className={styles.cards}>
          {data.attention.map((a) => (
            <article key={a.id} className={styles.attn}>
              <h3 className={styles.attnTitle}>{a.title}</h3>
              <p className={styles.body}>{a.body}</p>
              {a.action.to ? (
                <Link to={a.action.to} className={styles.attnLink}>{a.action.label}</Link>
              ) : (
                // TODO(backend): deep link to the failing source or replacement flow.
                <a href={a.action.href ?? '#'} className={styles.attnLink}>{a.action.label}</a>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="split">
        <div className={`main-col ${styles.tableWrap}`}>
          <DataTable
            id="sources"
            title={<h2 style={{ fontSize: 16 }}>Sources</h2>}
            rows={sources}
            columns={columns}
            rowKey={(s) => s._id}
            searchLabel="Search sources"
            searchPlaceholder="Search sources"
            onFilteredChange={onFiltered}
            noun={{ one: 'source', many: 'sources' }}
            minWidth={900}
          />
        </div>
        <div className="side-col" style={{ alignItems: 'start' }}>
          <section className={`card ${styles.panel}`} aria-labelledby="add-heading">
            <div className={styles.panelHead}><h2 id="add-heading">Add a source</h2></div>
            <div className={styles.tiles}>
              {TILES.map((t) => (
                <button key={t.type} type="button" className={styles.tile} onClick={() => setAdding({ type: t.type })}>
                  <span className={styles.tileTitle}>{t.title}</span>
                  <span className="small muted">{t.hint}</span>
                </button>
              ))}
            </div>
            <p className={styles.note}>Each source is tagged with this app and a component, so workflows only retrieve what applies to them.</p>
          </section>

          <Retrieval chunks={data.retrieval.chunks} sampleQuery={data.retrieval.sampleQuery} />

          <section className={`card ${styles.panel}`} aria-labelledby="cmp-heading">
            <div className={styles.panelHead}>
              <h2 id="cmp-heading">Components</h2>
              {/* TODO(backend): component management lives with application settings. */}
              <Link to="/settings" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Manage</Link>
            </div>
            <ul className={styles.components}>
              {data.components.map((c) => (
                <li key={c.id}><span className="mono">{c.id}</span><span className="muted">{c.kind}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <AddSourceDialog
        request={adding}
        components={data.components.map((c) => c.id)}
        existing={adding?.replaceId ? sources.find((s) => s._id === adding.replaceId) : undefined}
        onClose={() => setAdding(null)}
        onSubmit={(req, values) => { addSource(req, values); setAdding(null); }}
      />
    </div>
  );
}

function Retrieval({ chunks, sampleQuery }: { chunks: RetrievalChunk[]; sampleQuery: string }) {
  const [query, setQuery] = useState(sampleQuery);
  const [results, setResults] = useState<RetrievalChunk[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      setBusy(true);
      testRetrieval(chunks, q).then((r) => { setResults(r); setBusy(false); });
    },
    [chunks],
  );
  useEffect(() => run(sampleQuery), [run, sampleQuery]);

  const conflicts = useMemo(() => {
    if (!results) return [];
    const groups = new Map<string, number[]>();
    results.forEach((r, i) => r.conflictGroup && groups.set(r.conflictGroup, [...(groups.get(r.conflictGroup) ?? []), i + 1]));
    return [...groups.values()].filter((g) => g.length > 1);
  }, [results]);

  const submit = (e: FormEvent) => { e.preventDefault(); run(query); };

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="test-heading">
      <div className={styles.panelHead}><h2 id="test-heading">Test retrieval</h2></div>
      <p className={styles.note}>Check what a workflow would find for a question, before it runs.</p>
      <form onSubmit={submit} className="row" style={{ flexWrap: 'nowrap' }}>
        <label className={`${styles.search} grow`}>
          <Icon name="search" size={16} />
          <span className="sr-only">Test retrieval query</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={!query.trim() || busy}>Test</button>
      </form>
      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="small muted">Retrieving…</p>}
        {!busy && results && results.length === 0 && <p className="small muted">No chunks match this question. Try other words.</p>}
        {!busy && results && results.length > 0 && (
          <ol className={styles.results}>
            {results.map((r, i) => (
              <li key={r.id}>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}><span className="sr-only">Result {i + 1}: </span>{r.text}</span>
                <span className={styles.resultMeta}>
                  <span>{r.citation}</span>
                  <span className="mono" aria-label={`score ${r.score}`}>{r.score.toFixed(2)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {!busy && conflicts.map((g) => (
          <p key={g.join()} className={styles.conflict}>
            Results {g.slice(0, -1).join(', ')} and {g[g.length - 1]} conflict. See Needs attention.
          </p>
        ))}
      </div>
    </section>
  );
}

function AddSourceDialog({ request, existing, components, onClose, onSubmit }: {
  request: AddRequest | null;
  existing?: Source;
  components: string[];
  onClose: () => void;
  onSubmit: (req: AddRequest, values: { name: string; locator: string; component: string }) => void;
}) {
  const [type, setType] = useState<SourceType>('pdf');
  const [name, setName] = useState('');
  const [locator, setLocator] = useState('');
  const [component, setComponent] = useState('');

  useEffect(() => {
    if (!request) return;
    setType(request.type);
    setName(existing?.name ?? '');
    setLocator('');
    setComponent(existing?.componentIds[0] ?? '');
  }, [request, existing]);

  const replacing = !!request?.replaceId;
  const isFile = type === 'pdf' || type === 'word' || (type === 'api_spec' && replacing);
  const valid = replacing ? !!locator : !!name.trim() && !!locator.trim();
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!request || !valid) return;
    onSubmit({ ...request, type }, { name: name.trim(), locator: locator.trim(), component });
  };

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title={replacing ? `Replace ${existing?.name ?? 'source'}` : 'Add source'}
      subtitle="Sources are tagged with this app and a component. Credentials for linked systems come from your connections, never this form."
      width={560}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-source" className="btn dark" disabled={!valid}>
            {replacing ? 'Replace and re-embed' : 'Add and embed'}
          </button>
        </div>
      }
    >
      <form id="add-source" className="card-pad stack" onSubmit={submit}>
        {!replacing && (
          <div className="field">
            <label htmlFor="as-type">Type</label>
            <select id="as-type" className="select" value={type} onChange={(e) => setType(e.target.value as SourceType)}>
              {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).map((t) => (
                <option key={t} value={t}>{SOURCE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
        )}
        {!replacing && (
          <div className="field">
            <label htmlFor="as-name">Name</label>
            <input id="as-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="as-loc">{isFile ? 'File' : type === 'api_spec' ? 'OpenAPI URL' : type === 'journeys' ? 'Crawl environment' : 'Space, page or entry'}</label>
          {isFile ? (
            <input
              id="as-loc"
              type="file"
              className="input"
              style={{ paddingTop: 10 }}
              accept={type === 'api_spec' ? '.yaml,.yml,.json' : '.pdf,.doc,.docx'}
              onChange={(e) => setLocator(e.target.files?.[0]?.name ?? '')}
            />
          ) : (
            <input id="as-loc" className="input" value={locator} onChange={(e) => setLocator(e.target.value)} />
          )}
        </div>
        {!replacing && (
          <div className="field">
            <label htmlFor="as-cmp">Component</label>
            <select id="as-cmp" className="select" value={component} onChange={(e) => setComponent(e.target.value)}>
              <option value="">All components</option>
              {components.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </form>
    </Dialog>
  );
}
