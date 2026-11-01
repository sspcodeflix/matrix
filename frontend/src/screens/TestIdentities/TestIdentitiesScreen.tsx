// Reference: design/html/TestIdentities.html
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchTestIdentities, type IdentityStatus, type TestIdentitiesData, type TestIdentity } from './api';
import { SettingsHeader } from './SettingsHeader';
import styles from './TestIdentities.module.css';

const hhmm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(iso)) : '';

const STATUS_LABEL: Record<IdentityStatus, string> = {
  signed_in: 'Signed in',
  expiring: 'Expiring',
  failed: 'Failed',
  not_checked: 'Not checked',
};
const STATUS_DOT: Record<IdentityStatus, string> = {
  signed_in: 'var(--success)',
  expiring: 'var(--warning)',
  failed: 'var(--accent)',
  not_checked: 'var(--text-muted)',
};

type Row = TestIdentity & { checking?: boolean };

function statusText(r: Row) {
  if (r.checking) return 'Checking sign-in…';
  switch (r.status) {
    case 'signed_in': return `Signed in ${hhmm(r.lastLogin)}`;
    case 'failed': return `Sign-in failed: ${r.statusDetail ?? 'unknown error'}`;
    case 'expiring': return r.statusDetail ?? 'Credential expiring';
    default: return 'Not checked yet';
  }
}

export default function TestIdentitiesScreen() {
  const { data, error, loading } = useApi(fetchTestIdentities);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} />;
  return <TestIdentities data={data} />;
}

function TestIdentities({ data }: { data: TestIdentitiesData }) {
  const download = useDownloadReport();
  const [rows, setRows] = useState<Row[]>(data.identities);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);

  // Columns must be stable for DataTable; handlers only use state setters.
  const columns = useMemo<Column<Row>[]>(() => {
  const testSignIn = (r: Row) => {
    // TODO(backend): POST /api/test-identities/{id}/check — the credential broker signs in from the vault reference.
    setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, checking: true } : x)));
    setNotice(`Testing sign-in for ${r.role} on ${r.env}…`);
    window.setTimeout(() => {
      const now = new Date().toISOString();
      setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, checking: false, status: 'signed_in', statusDetail: undefined, lastLogin: now } : x)));
      setNotice(`${r.role} on ${r.env} signed in at ${hhmm(now)} UTC. The sign-in is written to the audit log.`);
    }, 900);
  };

  const action = (r: Row) => {
    if (r.status === 'failed') {
      return (
        <button type="button" className="link-btn" onClick={() => setNotice(`Sign-in for ${r.role} on ${r.env} failed (${r.statusDetail ?? 'unknown'}). Resolve it with the identity owner, then use Test sign-in. Matrix never shows the credential.`)}>
          Fix
        </button>
      );
    }
    if (r.status === 'expiring') {
      return (
        <button type="button" className="link-btn" onClick={() => setNotice(`Rotate the password for ${r.role} on ${r.env} in the vault at its reference. Matrix stores only the reference and picks up the new value on the next sign-in.`)}>
          Rotate
        </button>
      );
    }
    return (
      <button type="button" className="link-btn" disabled={r.checking} onClick={() => testSignIn(r)}>
        Test sign-in
      </button>
    );
  };

    return [
    { key: 'role', header: 'Role', value: (r) => r.role, render: (r) => <strong>{r.role}</strong>, filter: { type: 'select' }, sortable: true },
    { key: 'env', header: 'Environment', value: (r) => r.env, filter: { type: 'select', options: data.environments }, sortable: true },
    { key: 'secretRef', header: 'Credential (vault reference)', value: (r) => r.secretRef, mono: true, sortable: true },
    { key: 'ent', header: 'Expected entitlements', value: (r) => r.expectedEntitlements, sortable: true },
    {
      key: 'status',
      header: 'Status',
      value: (r) => STATUS_LABEL[r.status],
      filter: { type: 'select', options: Object.values(STATUS_LABEL) },
      sortable: true,
      render: (r) => (
        <span className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
          <span className="dot" style={{ background: r.checking ? 'var(--text-muted)' : STATUS_DOT[r.status] }} />
          {statusText(r)}
        </span>
      ),
    },
    { key: 'action', header: '', value: () => '', filter: { type: 'none' }, render: action },
  ];
  }, [data.environments]);

  const unit = { one: 'identity', many: 'identities' };
  const ready = rows.filter((r) => r.status === 'signed_in').length;
  const blocked = rows.filter((r) => r.status === 'failed').length;
  const filtersActive = filtered.length !== rows.length;

  const openReport = () =>
    download.open({
      context: 'Settings · Test identities',
      reportTypes: [
        {
          key: 'test-readiness',
          label: 'Test readiness',
          description: 'Role and environment readiness, authentication check time and status, blocked tests and recovery owner. No credentials or secret-store paths.',
          formats: ['pdf', 'html', 'xlsx'],
          sections: 'Summary, readiness by role and environment, sign-in checks, blocked tests, recovery owners',
          exclusions: 'Credentials, vault references and secret-store paths are never exported',
        },
      ],
      scope: {
        filtered: {
          count: filtered.length,
          unit,
          hint: 'Every page of the identities table, not just the rows shown',
          spec: filterSpec({ rows: filtered.map((r) => r._id).sort().join(',') }),
        },
        full: { count: rows.length, unit },
      },
      selectionHint: 'The identities table has no row selection',
      snapshot: `Identity sign-in checks · data as of ${new Date(data.dataAsOf).toUTCString().replace(' GMT', ' UTC')}`,
      snapshotId: `TI-${data.dataAsOf.slice(0, 10).replace(/-/g, '')}`,
      snapshotCapturedAt: data.dataAsOf,
      filters: filtersActive ? 'Current identities table search and column filters' : 'No filters applied',
      comparison: `Whole application, for comparison: ${ready} of ${rows.length} identities signed in, ${blocked} failing`,
    });

  const addIdentity = (row: Row) => {
    // TODO(backend): POST /api/apps/{appId}/test-identities (reference only; the secret is set in the vault).
    setRows((rs) => [...rs, row]);
    setAdding(false);
    setNotice(`${row.role} on ${row.env} added. Use Test sign-in to check it.`);
  };

  return (
    <div className="page">
      <div className="stack" style={{ '--gap': '16px' } as CSSProperties}>
        <SettingsHeader current="Test identities" />
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
        id="identities"
        title="Test identities"
        rows={rows}
        columns={columns}
        rowKey={(r) => r._id}
        searchLabel="Search identities"
        searchPlaceholder="Search by role, environment or vault path"
        pageSizes={[6, 25, 50]}
        noun={unit}
        onFilteredChange={setFiltered}
        actions={
          <>
            <DownloadButton onClick={openReport} />
            <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setAdding(true)}>Add identity</button>
          </>
        }
      />

      <div className={styles.cards}>
        <section className="card card-pad stack" aria-labelledby="es-heading">
          <div className="spread">
            <h2 id="es-heading" style={{ fontSize: 15 }}>Entitlement matrix</h2>
            <Pill tone="warning">{data.entitlementSource ? 'Connected' : 'Not connected'}</Pill>
          </div>
          <p className="secondary" style={{ lineHeight: 1.55 }}>
            Matrix compares what each identity can actually do with what it should be allowed to do. Connect the system where
            entitlements are defined.
          </p>
          <div className={styles.dashed}>
            {/* TODO(OPEN_QUESTIONS): entitlement source not decided; placeholder kept from the reference. */}
            <strong style={{ fontSize: 13 }}>Source: {data.entitlementSource ?? '[YOUR ENTITLEMENT SOURCE]'}</strong>
            <span className="small muted">For example an IAM system, the app's admin configuration, or an uploaded role matrix</span>
          </div>
          <div className="row">
            <button type="button" className="btn dark" onClick={() => setNotice('Connecting an entitlement source is not available yet: the source is still an open question.')}>
              Connect source
            </button>
            <button type="button" className="btn" onClick={() => setNotice('Role matrix upload is not available yet: the source format is still an open question.')}>
              Upload role matrix
            </button>
          </div>
        </section>

        <section className="card card-pad stack" aria-labelledby="cr-heading">
          <h2 id="cr-heading" style={{ fontSize: 15 }}>How credentials are handled</h2>
          <ul className={styles.list}>
            <li>Passwords and MFA seeds stay in the vault. Matrix stores only the reference.</li>
            <li>Identities exist in test environments only. Production sign-in is blocked.</li>
            <li>Every sign-in is written to the audit log with the run that used it.</li>
            <li>Tests declare a role, for example <span className="mono">@role("ops-checker")</span>, never an account.</li>
          </ul>
        </section>
      </div>

      <AddIdentityDialog open={adding} environments={data.environments} appId={rows[0]?.appId ?? ''} onClose={() => setAdding(false)} onAdd={addIdentity} />
    </div>
  );
}

function AddIdentityDialog({ open, environments, appId, onClose, onAdd }: {
  open: boolean;
  environments: string[];
  appId: string;
  onClose: () => void;
  onAdd: (r: Row) => void;
}) {
  const [role, setRole] = useState('');
  const [env, setEnv] = useState(environments[0] ?? '');
  const [ref, setRef] = useState('vault://');
  const [ent, setEnt] = useState('');
  const [tried, setTried] = useState(false);

  const refValid = /^vault:\/\/[\w./-]+$/.test(ref) && ref.length > 'vault://'.length;
  const valid = role.trim() && env && refValid;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    onAdd({
      _id: `ti-new-${Date.now()}`, appId, role: role.trim(), env, secretRef: ref, expectedEntitlements: ent.trim() || 'Not stated',
      lastLogin: null, status: 'not_checked',
    });
    setRole(''); setRef('vault://'); setEnt(''); setTried(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add identity"
      subtitle="Matrix stores only the vault reference. Never paste a password here."
      width={560}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-identity" className="btn primary">Add identity</button>
        </>
      }
    >
      <form id="add-identity" className="card-pad stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="ai-role">Role</label>
          <input id="ai-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-invalid={tried && !role.trim()} />
          {tried && !role.trim() && <span className="small" style={{ color: 'var(--danger-text)' }}>Enter the role this identity plays.</span>}
        </div>
        <div className="field">
          <label htmlFor="ai-env">Environment (test environments only)</label>
          <select id="ai-env" className="select" value={env} onChange={(e) => setEnv(e.target.value)}>
            {environments.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ai-ref">Credential vault reference</label>
          <input id="ai-ref" className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} aria-invalid={tried && !refValid} aria-describedby="ai-ref-hint" />
          <span id="ai-ref-hint" className="small" style={{ color: tried && !refValid ? 'var(--danger-text)' : 'var(--text-muted)' }}>
            A reference such as vault://team/app/env/role. The password and MFA seed stay in the vault.
          </span>
        </div>
        <div className="field">
          <label htmlFor="ai-ent">Expected entitlements</label>
          <input id="ai-ent" className="input" value={ent} onChange={(e) => setEnt(e.target.value)} />
        </div>
      </form>
    </Dialog>
  );
}
