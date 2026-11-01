import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useApi } from '../api/useApi';
import { fetchSession, type Session } from '../api/session';
import { WorkspaceProvider } from '../workspace/WorkspaceContext';
import { useWorkspace } from '../workspace/useWorkspace';
import { WorkspacePrompt } from '../workspace/WorkspacePrompt';
import { Loading } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { DownloadReportProvider } from '../features/download/DownloadReportContext';
import { Icon, MatrixLogo, type IconName } from './Icon';
import { navSections } from '../nav';
import styles from './AppShell.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface RouteHandle {
  title: string;
}

export function AppShell() {
  const { data: session } = useApi(fetchSession);
  if (!session) return <Loading />;
  return (
    <WorkspaceProvider session={session}>
      <Shell session={session} />
    </WorkspaceProvider>
  );
}

function Shell({ session }: { session: Session }) {
  const workspace = useWorkspace();
  // TODO(backend): application switcher in the sidebar; until then the session's application.
  const { application } = workspace;
  const { resolved, toggle } = useTheme();
  const matches = useMatches();
  const { pathname, search } = useLocation();
  // Stop-processing preview belongs to whichever workflow it is showing.
  const processingFor = new URLSearchParams(search).get('workflow') === 'acceptance' ? 'acceptance' : 'regression';
  const alsoActive = (key: string, prefixes?: string[]) =>
    prefixes?.some((p) => pathname.startsWith(p)) || (pathname.startsWith('/processing') && key === processingFor);
  const title = (matches[matches.length - 1]?.handle as RouteHandle | undefined)?.title ?? '';
  const nextTheme = resolved === 'dark' ? 'light' : 'dark';

  // Below 900px the sidebar is a drawer, so the first screen shows the task, not navigation.
  const [navOpen, setNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const mainColumn = useRef<HTMLDivElement>(null);
  const skipLink = useRef<HTMLAnchorElement>(null);
  const closeNav = (restoreFocus = true) => {
    setNavOpen(false);
    if (!restoreFocus) return;
    // Lift inert now: the effect cleanup runs after this render, too late for focus().
    [mainColumn.current, skipLink.current].forEach((b) => b && (b.inert = false));
    menuButton.current?.focus();
  };

  useEffect(() => setNavOpen(false), [pathname]);

  // The open drawer is modal: the rest of the shell is inert and Tab cycles inside the drawer.
  useEffect(() => {
    if (!navOpen) return;
    const el = sidebar.current;
    const background = [mainColumn.current, skipLink.current];
    background.forEach((b) => b && (b.inert = true));
    (el?.querySelector<HTMLElement>('a[aria-current="page"]') ?? el?.querySelector<HTMLElement>('a'))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNav();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((f) => f.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!el.contains(active) || (e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      background.forEach((b) => b && (b.inert = false));
    };
  }, [navOpen]);

  return (
    <DownloadReportProvider>
      <div className={styles.shell}>
        <a ref={skipLink} href="#main" className={styles.skip}>Skip to content</a>
        {navOpen && <div className={styles.backdrop} onClick={() => closeNav()} aria-hidden="true" />}
        <aside
          id="app-nav"
          ref={sidebar}
          className={`${styles.sidebar} ${navOpen ? styles.open : ''}`}
          aria-label="Main navigation"
          role={navOpen ? 'dialog' : undefined}
          aria-modal={navOpen ? true : undefined}
        >
          <div className="row" style={{ gap: 10, padding: '4px 8px', flexWrap: 'nowrap' }}>
            <MatrixLogo />
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Matrix</span>
            <button
              type="button"
              className={`btn icon ${styles.drawerClose}`}
              aria-label="Close navigation"
              onClick={() => closeNav()}
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="app-switch" className="eyebrow" style={{ padding: '0 8px' }}>Application</label>
            {/* TODO: application switcher menu (OPEN_QUESTIONS: multi-app access). */}
            <button id="app-switch" type="button" className={styles.appSwitch}>
              <span className="stack" style={{ gap: 1 }}>
                <span>{application.name}</span>
                <span className="small muted" style={{ fontWeight: 400 }}>{application.release} · {application.id}</span>
              </span>
              <Icon name="chevronDown" size={16} />
            </button>
          </div>

          <nav aria-label="Pages" className={styles.nav}>
            {navSections.map((section) => (
              <div key={section.label ?? 'top'} className="stack" style={{ gap: 2 }}>
                {section.label && <span className={`eyebrow ${styles.section}`}>{section.label}</span>}
                {section.items.map((item) => {
                  const badge = session.navBadges[item.key];
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      className={styles.link}
                      aria-current={alsoActive(item.key, item.alsoActive) ? 'page' : undefined}
                    >
                      <Icon name={item.icon as IconName} />
                      <span className="row" style={{ gap: 6 }}>
                        {item.label}
                        {item.adminOnly && <Icon name="lock" size={13} strokeWidth={2.2} label="Admin only" />}
                      </span>
                      {badge && (
                        <span className={`chip ${badge.tone === 'accent' ? 'tone-accent' : ''}`} style={{ marginLeft: 'auto' }}>
                          {badge.label}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="stack" style={{ marginTop: 'auto', gap: 10 }}>
            {(
              <div className={styles.llm}>
                <span className="dot" style={{ background: session.llm.healthy ? 'var(--success)' : 'var(--accent)' }} />
                <span>{session.llm.label}</span>
              </div>
            )}
            {(
              <div className="row" style={{ gap: 10, padding: 8, flexWrap: 'nowrap' }}>
                <span className={styles.avatar}>{session.user.initials}</span>
                <span className="stack" style={{ gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{session.user.name}</span>
                  <span className="small muted">{session.user.role}</span>
                </span>
              </div>
            )}
          </div>
        </aside>

        <div ref={mainColumn} className={styles.main}>
          <header className={styles.topbar}>
            <button
              ref={menuButton}
              type="button"
              className={`btn icon ${styles.menuButton}`}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="app-nav"
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <nav aria-label="Breadcrumb" className={`row muted ${styles.crumbs}`} style={{ gap: 8 }}>
              <span>{application.name}</span>
              <span aria-hidden="true">/</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }} aria-current="page">{title}</span>
            </nav>
            {/* TODO(M0): global search across requirements, tests and runs (BACKLOG M0). */}
            <label className={styles.search}>
              <Icon name="search" size={16} strokeWidth={2} />
              <span className="sr-only">Search Matrix</span>
              <input type="search" placeholder="Search requirements, tests, runs, or type / for a command" />
              <kbd className="mono small">/</kbd>
            </label>
            <div className="row" style={{ marginLeft: 'auto' }}>
              <label className={styles.workspace}>
                <span className="eyebrow" aria-hidden="true">Workspace</span>
                <select
                  className="select mono"
                  aria-label="Workspace"
                  value={workspace.current?.id ?? ''}
                  onChange={(e) => workspace.setWorkspace(e.target.value || null)}
                >
                  <option value="">All workspaces</option>
                  {workspace.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.id}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn icon"
                aria-label={`Switch to ${nextTheme} theme`}
                title={`Switch to ${nextTheme} theme`}
                onClick={toggle}
              >
                <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button type="button" className="btn icon" aria-label="Notifications">
                <Icon name="bell" />
              </button>
            </div>
          </header>
          <WorkspacePrompt allWorkspaces={session.workspaces} />
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </DownloadReportProvider>
  );
}
