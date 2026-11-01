import { Link } from 'react-router-dom';
import { fetchSession } from '../../api/session';
import { useApi } from '../../api/useApi';
import { PageHeader } from '../../components/ui';

// TODO: align these targets with the Settings screen's own tab routing once it is ported.
const TABS = [
  { label: 'Applications', to: '/settings?tab=applications' },
  { label: 'Connections', to: '/settings' },
  { label: 'Test identities', to: '/settings/test-identities' },
  { label: 'Test data', to: '/settings/test-data' },
  { label: 'Access', to: '/settings?tab=access' },
  { label: 'Policies', to: '/settings?tab=policies' },
  { label: 'Personal', to: '/settings?tab=personal' },
];

/** Settings title and section tabs shared by the Test identities and Test data pages. */
export function SettingsHeader({ current }: { current: 'Test identities' | 'Test data' }) {
  const session = useApi(fetchSession);
  const app = session.data?.application.name;
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={`${app ? `${app} workspace` : 'Workspace'} · changes are recorded in the audit log`}
      />
      <nav aria-label="Settings sections" className="tabs">
        {TABS.map((t) => (
          <Link key={t.label} to={t.to} className="tab" aria-current={t.label === current ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
