import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../workspace/useWorkspace';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { ErrorState, Loading, PageHeader, Pill } from '../../components/ui';
import { useTheme, type ThemePreference } from '../../theme/ThemeContext';
import {
  fetchSettings,
  type ApplicationRow,
  type Connection,
  type Policy,
  type RoleAccess,
  type SettingsData,
  type StoredCredential,
} from './api';
import styles from './Settings.module.css';

type TabKey = 'applications' | 'connections' | 'access' | 'policies' | 'personal';

const TABS: ({ key: TabKey; label: string } | { route: string; label: string })[] = [
  { key: 'applications', label: 'Applications' },
  { key: 'connections', label: 'Connections' },
  { route: '/settings/test-identities', label: 'Test identities' },
  { route: '/settings/test-data', label: 'Test data' },
  { key: 'access', label: 'Access' },
  { key: 'policies', label: 'Policies' },
  { key: 'personal', label: 'Personal' },
];

const statusDot: Record<Connection['status'], string> = {
  connected: 'var(--success)',
  expiring: 'var(--warning)',
  not_connected: 'var(--accent)',
};

export default function SettingsScreen() {
  const { data, error, loading } = useApi(fetchSettings);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Loading settings" />;
  return <Settings data={data} />;
}

function Settings({ data }: { data: SettingsData }) {
  const workspace = useWorkspace();
  const [params] = useSearchParams();
  const requested = params.get('tab') as TabKey | null;
  const tab: TabKey = TABS.some((t) => 'key' in t && t.key === requested) ? (requested as TabKey) : 'connections';

  const [connections, setConnections] = useState(data.connections);
  const [policies, setPolicies] = useState(data.policies);
  const [credentials, setCredentials] = useState(data.credentials);

  const tabLink = (key: TabKey) => {
    const next = new URLSearchParams();
    if (key !== 'connections') next.set('tab', key);
    const s = next.toString();
    return { search: s ? `?${s}` : '' };
  };

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle={`${workspace.application.name} (${workspace.application.id})${workspace.current ? ` · ${workspace.current.id}` : ''} · changes are recorded in the audit log`} />

      <nav className="tabs" aria-label="Settings sections">
        {TABS.map((t) =>
          'key' in t ? (
            <Link key={t.key} className="tab" to={tabLink(t.key)} aria-current={t.key === tab ? 'page' : undefined} replace>
              {t.label}
            </Link>
          ) : (
            <Link key={t.route} className="tab" to={t.route}>{t.label}</Link>
          ),
        )}
      </nav>

      {tab === 'applications' && <ApplicationsTab rows={data.applications} />}
      {tab === 'connections' && (
        <div className={styles.layout}>
          <div className="stack" style={{ '--gap': '20px' } as CSSProperties}>
            <ConnectionsCard connections={connections} setConnections={setConnections} credentials={credentials} />
            <AccessTable roles={data.roles} />
          </div>
          <div className="stack" style={{ '--gap': '20px' } as CSSProperties}>
            <PoliciesCard policies={policies} setPolicies={setPolicies} />
            <TachyonCard tachyon={data.tachyon} />
          </div>
        </div>
      )}
      {tab === 'access' && (
        <div className="stack" style={{ '--gap': '16px' } as CSSProperties}>
          <AccessTable roles={data.roles} />
          <p className="small muted">
            Roles come from SSO groups. Navigation grouping does not grant access; permissions are checked per app and role.
            {/* TODO(OPEN_QUESTIONS #15): who may use Prompt studio. */}
          </p>
        </div>
      )}
      {tab === 'policies' && (
        <div className={styles.twoCol}>
          <PoliciesCard policies={policies} setPolicies={setPolicies} />
          <TachyonCard tachyon={data.tachyon} />
        </div>
      )}
      {tab === 'personal' && (
        <PersonalTab credentials={credentials} setCredentials={setCredentials} notifications={data.notifications} />
      )}
    </div>
  );
}

/* ---------- Applications ---------- */

function ApplicationsTab({ rows }: { rows: ApplicationRow[] }) {
  const columns = useMemo<Column<ApplicationRow>[]>(
    () => [
      { key: 'name', header: 'Application', value: (a) => a.name, render: (a) => <strong>{a.name}</strong> },
      { key: 'release', header: 'Release', value: (a) => a.release },
      { key: 'repo', header: 'Automation repo', value: (a) => a.repo, mono: true },
      { key: 'jira', header: 'Jira project', value: (a) => a.jiraProject, mono: true },
      { key: 'confluence', header: 'Confluence space', value: (a) => a.confluenceSpace, mono: true },
    ],
    [],
  );
  return (
    <DataTable
      id="apps"
      title="Applications"
      rows={rows}
      columns={columns}
      rowKey={(a) => a.id}
      searchLabel="Search applications"
      searchPlaceholder="Search by application, repo or project"
      noun={{ one: 'application', many: 'applications' }}
    />
  );
}

/* ---------- Connections ---------- */

function ConnectionsCard({ connections, setConnections, credentials }: {
  connections: Connection[];
  setConnections: (c: Connection[]) => void;
  credentials: StoredCredential[];
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<Connection | null>(null);

  useEffect(() => {
    if (!testing) return;
    const t = setTimeout(() => {
      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      // TODO(backend): POST /api/connections/test; each check uses the stored credential via the credential broker.
      setConnections(connections.map((c) => (c.status === 'not_connected' ? c : { ...c, lastSync: now })));
      const ok = connections.filter((c) => c.status !== 'not_connected').length;
      const warn = connections.filter((c) => c.status === 'expiring').length;
      setResult(`${ok} of ${connections.length} connections responded${warn ? ` · ${warn} token expiring soon` : ''}.`);
      setTesting(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [testing, connections, setConnections]);

  const { current: workspace, workspaces, application } = useWorkspace();
  // Octane: one workspace per component; it follows the workspace chosen at the top right.
  const scopeOf = useCallback(
    (c: Connection) =>
      c.id !== 'octane' ? c.scope
      : workspace ? `Workspace ${workspace.octane.workspaceId}`
      : `${workspaces.length} workspaces for ${application.id}: ${workspaces.map((w) => w.octane.workspaceId).join(', ')}`,
    [workspace, workspaces, application],
  );

  const columns = useMemo<Column<Connection>[]>(
    () => [
      {
        key: 'service', header: 'Service', value: (c) => c.service,
        render: (c) => (
          <span className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
            <span className="dot" style={{ background: statusDot[c.status] }} aria-hidden="true" />
            <strong>{c.service}</strong>
          </span>
        ),
      },
      { key: 'scope', header: 'Scope', value: scopeOf },
      {
        key: 'status', header: 'Status', value: (c) => c.statusText,
        filter: { type: 'select' },
        render: (c) => (c.status === 'expiring' ? <Pill tone="warning">{c.statusText}</Pill> : c.status === 'not_connected' ? <Pill tone="accent">{c.statusText}</Pill> : c.statusText),
      },
      { key: 'sync', header: 'Last sync', value: (c) => c.lastSync, mono: true },
      {
        key: 'action', header: 'Actions', value: () => '', filter: { type: 'none' }, sortable: false,
        render: (c) =>
          c.status === 'expiring' && c.usesPersonalToken ? (
            <Link className="link-btn" to={{ search: '?tab=personal' }}>Renew token<span className="sr-only"> for {c.service}</span></Link>
          ) : (
            <button type="button" className="link-btn" aria-haspopup="dialog" onClick={() => setConfiguring(c)}>
              Configure<span className="sr-only"> {c.service}</span>
            </button>
          ),
      },
    ],
    [scopeOf],
  );

  const cred = configuring ? credentials.find((k) => k.system === configuring.service) : undefined;

  return (
    <>
      <DataTable
        id="conn"
        title="Connections"
        rows={connections}
        columns={columns}
        rowKey={(c) => c.id}
        searchLabel="Search connections"
        searchPlaceholder="Search by service or scope"
        pageSizes={[4, 25, 50]}
        minWidth={680}
        noun={{ one: 'connection', many: 'connections' }}
        actions={
          <button type="button" className="btn" disabled={testing} onClick={() => { setResult(null); setTesting(true); }}>
            {testing ? 'Testing…' : 'Test all'}
          </button>
        }
      />
      <div aria-live="polite">
        {result && (
          <div className="banner success" role="status">
            <Icon name="check" />
            <span className="grow">{result}</span>
            <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={() => setResult(null)}>Dismiss</button>
          </div>
        )}
      </div>
      <Dialog open={!!configuring} onClose={() => setConfiguring(null)} title={`Configure ${configuring?.service ?? ''}`} subtitle={configuring ? scopeOf(configuring) : undefined} width={560}>
        {configuring && (
          <div className="stack">
            <dl className={styles.dl}>
              <dt>Status</dt><dd>{configuring.statusText}</dd>
              <dt>Last sync</dt><dd className="mono">{configuring.lastSync}</dd>
              <dt>Credential</dt>
              <dd>
                {configuring.usesPersonalToken
                  ? cred?.stored ? 'Your personal access token · stored' : 'Your personal access token · not stored'
                  : 'Service account held in the secrets store · stored'}
              </dd>
            </dl>
            {configuring.usesPersonalToken && (
              <p className="small muted">Personal tokens are managed under <Link to={{ search: '?tab=personal' }} onClick={() => setConfiguring(null)}>Settings · Personal</Link>.</p>
            )}
            {/* TODO(backend): edit scope (space, project, repo, workspace) via PATCH /api/connections/{id}. */}
            <p className="small muted">Scope changes are made by an admin and recorded in the audit log.</p>
          </div>
        )}
      </Dialog>
    </>
  );
}

function AccessTable({ roles }: { roles: RoleAccess[] }) {
  const columns = useMemo<Column<RoleAccess>[]>(
    () => [
      { key: 'role', header: 'Role', value: (r) => r.role, filter: { type: 'select' }, render: (r) => <strong>{r.role}</strong> },
      { key: 'group', header: 'SSO group', value: (r) => r.ssoGroup, mono: true },
      { key: 'can', header: 'Can', value: (r) => r.can },
    ],
    [],
  );
  return (
    <DataTable
      id="roles"
      title="Access by role"
      rows={roles}
      columns={columns}
      rowKey={(r) => r.role}
      searchLabel="Search roles"
      searchPlaceholder="Search by role or SSO group"
      pageSizes={[4, 25, 50]}
      minWidth={560}
      noun={{ one: 'role', many: 'roles' }}
    />
  );
}

/* ---------- Policies and usage ---------- */

function PoliciesCard({ policies, setPolicies }: { policies: Policy[]; setPolicies: (p: Policy[]) => void }) {
  return (
    <section className="card card-pad" aria-labelledby="pol-heading">
      <h2 id="pol-heading" style={{ fontSize: 14, marginBottom: 4 }}>Policies</h2>
      <ul className={styles.policies}>
        {policies.map((p) => (
          <li key={p.id}>
            <input
              id={`pol-${p.id}`}
              type="checkbox"
              checked={p.enabled}
              disabled={p.locked}
              aria-describedby={`pol-${p.id}-desc`}
              onChange={(e) => {
                // TODO(backend): PATCH /api/policies/{id}; recorded in the audit log.
                setPolicies(policies.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)));
              }}
            />
            <label htmlFor={`pol-${p.id}`} className="stack" style={{ '--gap': '2px' } as CSSProperties}>
              <span style={{ fontWeight: 500 }}>
                {p.title}{' '}
                {p.locked && (
                  <span className="chip">
                    <Icon name="lock" size={11} strokeWidth={2.2} />
                    always on
                  </span>
                )}
              </span>
              <span id={`pol-${p.id}-desc`} className="small secondary" style={{ fontSize: 13 }}>{p.description}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TachyonCard({ tachyon }: { tachyon: SettingsData['tachyon'] }) {
  return (
    <section className="card card-pad stack" aria-labelledby="use-heading" style={{ '--gap': '10px' } as CSSProperties}>
      <h2 id="use-heading" style={{ fontSize: 14 }}>Tachyon usage</h2>
      <div className="spread" style={{ fontSize: 13 }}>
        <span>Team license · this month</span>
        <span className="mono small">{tachyon.licenseUsedPct}%</span>
      </div>
      <div className={styles.track} role="meter" aria-label="Team license used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tachyon.licenseUsedPct}>
        <span style={{ width: `${tachyon.licenseUsedPct}%` }} />
      </div>
      <ul className={styles.usage}>
        {tachyon.byWorkflow.map((w) => (
          <li key={w.workflow} className="spread">
            <span>{w.workflow}</span>
            <span className="mono small">{w.pct}%</span>
          </li>
        ))}
      </ul>
      <Link to="/stats" className="small">See usage by person in User stats</Link>
    </section>
  );
}

/* ---------- Personal ---------- */

const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follow the operating system setting' },
  { value: 'light', label: 'Light', hint: 'White and red' },
  { value: 'dark', label: 'Dark', hint: 'Dark surfaces, same accent' },
];

const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000);
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function PersonalTab({ credentials, setCredentials, notifications }: {
  credentials: StoredCredential[];
  setCredentials: (c: StoredCredential[]) => void;
  notifications: SettingsData['notifications'];
}) {
  const { preference, setPreference } = useTheme();
  const [notify, setNotify] = useState(notifications);
  const [replacing, setReplacing] = useState<StoredCredential | null>(null);
  const [removing, setRemoving] = useState<StoredCredential | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={styles.twoCol}>
      <div className="stack" style={{ '--gap': '20px' } as CSSProperties}>
        <section className="card card-pad stack" aria-labelledby="pat-heading">
          <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
            <h2 id="pat-heading" style={{ fontSize: 14 }}>Personal access tokens</h2>
            <p className="small muted">
              Encrypted at rest and read only by the credential broker for actions you trigger. Matrix never shows a token after it is saved,
              and tokens never reach the model, logs or traces.
            </p>
          </div>
          <div aria-live="polite">
            {notice && (
              <div className="banner success" role="status">
                <Icon name="check" />
                <span className="grow">{notice}</span>
              </div>
            )}
          </div>
          <ul className={styles.pats}>
            {credentials.map((c) => {
              const days = c.expires ? daysUntil(c.expires) : undefined;
              return (
                <li key={c.system}>
                  <div className="stack grow" style={{ '--gap': '4px' } as CSSProperties}>
                    <span className="row" style={{ '--gap': '8px' } as CSSProperties}>
                      <strong>{c.system}</strong>
                      {c.stored ? (
                        days !== undefined && days <= 7 ? (
                          <Pill tone="warning">{days <= 0 ? 'Expired' : `Expires in ${days} ${days === 1 ? 'day' : 'days'}`}</Pill>
                        ) : (
                          <Pill tone="success">Stored</Pill>
                        )
                      ) : (
                        <Pill tone="accent">Not stored</Pill>
                      )}
                    </span>
                    {c.stored ? (
                      <span className="small secondary">
                        <span className="mono" aria-label={`Token ending in ${c.last4}`}>•••• {c.last4}</span>
                        {c.expires && <> · expires {fmtDate(c.expires)}</>}
                        {c.scopesChecked && <> · scopes checked: {c.scopesChecked}</>}
                      </span>
                    ) : (
                      <span className="small muted">Add a token to let Matrix act as you in {c.system}.</span>
                    )}
                  </div>
                  <div className="row">
                    <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setReplacing(c)}>
                      {c.stored ? 'Replace' : 'Add token'}<span className="sr-only"> {c.system} token</span>
                    </button>
                    {c.stored && (
                      <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => setRemoving(c)}>
                        Remove<span className="sr-only"> {c.system} token</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card card-pad stack" aria-labelledby="notify-heading">
          <h2 id="notify-heading" style={{ fontSize: 14 }}>Notifications</h2>
          <ul className={styles.policies}>
            {notify.map((n) => (
              <li key={n.id}>
                <input
                  id={`notify-${n.id}`}
                  type="checkbox"
                  checked={n.enabled}
                  onChange={(e) => setNotify(notify.map((x) => (x.id === n.id ? { ...x, enabled: e.target.checked } : x)))}
                />
                <label htmlFor={`notify-${n.id}`}>{n.label}</label>
              </li>
            ))}
          </ul>
          {/* TODO(backend): PATCH /api/me/notifications */}
        </section>
      </div>

      <section className="card card-pad stack" aria-labelledby="theme-heading">
        <fieldset className={styles.fieldset}>
          <legend id="theme-heading" style={{ fontSize: 14, fontWeight: 600 }}>Theme</legend>
          <p className="small muted" style={{ marginBottom: 8 }}>Also available from the moon/sun toggle in the top bar.</p>
          <div className={styles.themeOptions}>
            {THEME_OPTIONS.map((o) => (
              <label key={o.value} className={styles.themeOption}>
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={preference === o.value}
                  onChange={() => setPreference(o.value)}
                />
                <span className="stack" style={{ '--gap': '2px' } as CSSProperties}>
                  <span style={{ fontWeight: 500 }}>{o.label}</span>
                  <span className="small muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {/* TODO(backend): persist users.theme via PATCH /api/me. */}
      </section>

      <TokenDialog
        credential={replacing}
        onClose={() => setReplacing(null)}
        onSave={(system, last4, expires) => {
          setCredentials(credentials.map((c) => (c.system === system ? { ...c, stored: true, last4, expires, scopesChecked: 'pending check' } : c)));
          setNotice(`${system} token stored. Only the last four characters are kept for display.`);
          setReplacing(null);
        }}
      />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.system ?? ''} token?`}
        width={480}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setRemoving(null)}>Cancel</button>
            <button
              type="button"
              className="btn dark"
              onClick={() => {
                if (!removing) return;
                // TODO(backend): DELETE /api/me/credentials/{system}
                setCredentials(credentials.map((c) => (c.system === removing.system ? { system: c.system, stored: false } : c)));
                setNotice(`${removing.system} token removed.`);
                setRemoving(null);
              }}
            >
              Remove token
            </button>
          </>
        }
      >
        <p className="secondary">Matrix will no longer act as you in {removing?.system}. Actions that need it ask you to add a token again.</p>
      </Dialog>
    </div>
  );
}

function TokenDialog({ credential, onClose, onSave }: {
  credential: StoredCredential | null;
  onClose: () => void;
  onSave: (system: StoredCredential['system'], last4: string, expires?: string) => void;
}) {
  const [expires, setExpires] = useState('');
  const [hasValue, setHasValue] = useState(false);
  const formId = 'pat-form';

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!credential) return;
    const input = e.currentTarget.elements.namedItem('token') as HTMLInputElement;
    const value = input.value.trim();
    if (value.length < 8) return;
    // TODO(backend): PUT /api/me/credentials/{system} sends the token once to the credential broker (encrypted at rest).
    // The value is never kept in React state, logged, or shown again.
    const last4 = value.slice(-4);
    input.value = '';
    setHasValue(false);
    onSave(credential.system, last4, expires || undefined);
    setExpires('');
  };

  return (
    <Dialog
      open={!!credential}
      onClose={onClose}
      title={`${credential?.stored ? 'Replace' : 'Add'} ${credential?.system ?? ''} token`}
      subtitle="Paste a personal access token. It is stored encrypted and never shown again."
      width={520}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form={formId} className="btn dark" disabled={!hasValue}>Save token</button>
        </>
      }
    >
      <form id={formId} className="stack" onSubmit={submit} autoComplete="off">
        <div className="field">
          <label htmlFor="pat-token">Token</label>
          <input
            id="pat-token"
            name="token"
            type="password"
            className="input mono"
            autoComplete="off"
            spellCheck={false}
            minLength={8}
            onChange={(e) => setHasValue(e.target.value.trim().length >= 8)}
          />
        </div>
        <div className="field">
          <label htmlFor="pat-expires">Expiry date (optional)</label>
          <input id="pat-expires" type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      </form>
    </Dialog>
  );
}
