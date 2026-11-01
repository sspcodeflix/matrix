import { mock } from './useApi';

export type Tone = 'accent' | 'neutral';

/** An application, e.g. ABCD. Regression works at this level. */
export interface Application {
  id: string;
  name: string;
  release: string;
}

/**
 * A workspace (also called a component) of an application, e.g. App-abcd-web-ui. It is also
 * the Octane workspace. Acceptance works inside one workspace; Regression writes each test
 * and script into one workspace.
 */
export interface Workspace {
  id: string;
  appId: string;
  /** Short label, e.g. "web-ui". */
  label: string;
  octane: { sharedSpaceId: string; workspaceId: string };
}

export interface SessionUser {
  initials: string;
  name: string;
  role: string;
  isAdmin: boolean;
}

/** Sidebar badge per route key, e.g. regression: { label: '11 gaps', tone: 'accent' }. */
export type NavBadges = Partial<Record<string, { label: string; tone: Tone }>>;

export interface Session {
  workspaces: Workspace[];
  application: Application;
  applications: Application[];
  user: SessionUser;
  llm: { label: string; healthy: boolean };
  navBadges: NavBadges;
}

// TODO(backend): GET /api/session. Sample names are placeholders from the design kit.
const sample: Session = {
  workspaces: [
    { id: 'App-payh-web-ui', appId: 'PAYH', label: 'web-ui', octane: { sharedSpaceId: '1001', workspaceId: 'App-payh-web-ui' } },
    { id: 'App-payh-api', appId: 'PAYH', label: 'api', octane: { sharedSpaceId: '1001', workspaceId: 'App-payh-api' } },
    { id: 'App-payh-batch', appId: 'PAYH', label: 'batch', octane: { sharedSpaceId: '1001', workspaceId: 'App-payh-batch' } },
    { id: 'App-crdp-web-ui', appId: 'CRDP', label: 'web-ui', octane: { sharedSpaceId: '1001', workspaceId: 'App-crdp-web-ui' } },
  ],
  application: { id: 'PAYH', name: 'Payments Hub', release: 'Release 26.11' },
  applications: [
    { id: 'PAYH', name: 'Payments Hub', release: 'Release 26.11' },
    { id: 'CRDP', name: 'Cards Portal', release: 'Release 26.10' },
  ],
  user: { initials: 'PN', name: 'Priya N.', role: 'QA Engineer · SSO', isAdmin: true },
  llm: { label: 'Tachyon · Gemini · team license', healthy: true },
  navBadges: {
    acceptance: { label: '6 stories', tone: 'accent' },
    regression: { label: '12 gaps', tone: 'accent' },
    journeys: { label: '3 new', tone: 'neutral' },
    review: { label: '3', tone: 'accent' },
    runs: { label: '6 failed', tone: 'neutral' },
    huddle: { label: '1', tone: 'neutral' },
    context: { label: '2 issues', tone: 'accent' },
  },
};

export const fetchSession = () => mock(sample);
