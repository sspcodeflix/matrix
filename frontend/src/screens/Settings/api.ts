import { mock } from '../../api/useApi';

export type ConnectionStatus = 'connected' | 'expiring' | 'not_connected';

export interface Connection {
  id: string;
  service: string;
  scope: string;
  status: ConnectionStatus;
  statusText: string;
  /** Local time of last sync, HH:MM. */
  lastSync: string;
  /** True when the connection uses the signed-in user's PAT (renewed under Personal). */
  usesPersonalToken: boolean;
}

export interface RoleAccess {
  role: string;
  ssoGroup: string;
  can: string;
}

export interface Policy {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  /** Locked policies cannot be changed by anyone (PR-only delivery). */
  locked?: boolean;
}

export interface ApplicationRow {
  id: string;
  name: string;
  release: string;
  repo: string;
  jiraProject: string;
  confluenceSpace: string;
}

/**
 * user_credentials: { _id: "<userId>:<system>", token (encrypted, never sent to the browser), last4, expires, scopesChecked }.
 * The API returns only metadata; the token value never leaves the credential broker.
 */
export interface StoredCredential {
  system: 'GitHub' | 'Jira';
  stored: boolean;
  last4?: string;
  /** ISO date. */
  expires?: string;
  scopesChecked?: string;
}

export interface SettingsData {
  applications: ApplicationRow[];
  connections: Connection[];
  roles: RoleAccess[];
  policies: Policy[];
  tachyon: { licenseUsedPct: number; byWorkflow: { workflow: string; pct: number }[] };
  credentials: StoredCredential[];
  notifications: { id: string; label: string; enabled: boolean }[];
}

// TODO(backend): GET /api/settings (workspace) and GET /api/me/credentials (metadata only).
// Sample names are placeholders from the design kit.
const sample: SettingsData = {
  applications: [
    { id: 'app-payments-hub', name: 'Payments Hub', release: 'Release 26.11', repo: 'pay-hub-automation', jiraProject: 'PAY', confluenceSpace: 'PAY' },
    { id: 'app-cards-portal', name: 'Cards Portal', release: 'Release 26.10', repo: 'cards-portal-tests', jiraProject: 'CRD', confluenceSpace: 'CARDS' },
  ],
  connections: [
    { id: 'confluence', service: 'Confluence', scope: 'Space PAY', status: 'connected', statusText: 'Connected', lastSync: '09:42', usesPersonalToken: false },
    { id: 'jira', service: 'Jira', scope: 'Project PAY · your PAT', status: 'expiring', statusText: 'Token expires in 5 days', lastSync: '09:30', usesPersonalToken: true },
    { id: 'github', service: 'GitHub', scope: 'pay-hub-automation · your PAT', status: 'connected', statusText: 'Connected', lastSync: '11:05', usesPersonalToken: true },
    { id: 'octane', service: 'Octane', scope: 'Workspace from the top bar · regression set', status: 'connected', statusText: 'Connected', lastSync: '03:24', usesPersonalToken: false },
  ],
  roles: [
    { role: 'QA', ssoGroup: 'sg-pay-qa', can: 'Review, run, write' },
    { role: 'UAT', ssoGroup: 'sg-pay-uat', can: 'Sign off acceptance' },
    { role: 'Developer', ssoGroup: 'sg-pay-dev', can: 'Review PRs, fix tests' },
    { role: 'Admin', ssoGroup: 'sg-genai-admin', can: 'Skills, policies' },
  ],
  policies: [
    { id: 'pr-only', title: 'Generated code goes through a pull request', description: 'Matrix never pushes to main. A person merges every change.', enabled: true, locked: true },
    { id: 'dry-run', title: 'Dry-run PRs on HyperExecute', description: 'Run written automation on its branch before review, so reviewers see results.', enabled: true },
    { id: 'jira-comments', title: 'Allow Matrix to comment in Jira', description: 'Used to ask for missing acceptance criteria. Posts with the user’s own PAT.', enabled: true },
    { id: 'mcp-sharing', title: 'Share app context with external agents over MCP', description: 'Read-only, per app, audited. For Copilot and other approved agents.', enabled: false },
  ],
  tachyon: {
    licenseUsedPct: 62,
    byWorkflow: [
      { workflow: 'Regression writing', pct: 48 },
      { workflow: 'Acceptance writing', pct: 31 },
      { workflow: 'Embeddings', pct: 14 },
      { workflow: 'Run triage', pct: 7 },
    ],
  },
  credentials: [
    { system: 'GitHub', stored: true, last4: '7f3a', expires: '2027-02-14', scopesChecked: 'repo (pay-hub-automation)' },
    { system: 'Jira', stored: true, last4: 'q9ZK', expires: '2026-11-06', scopesChecked: 'read, comment (PAY)' },
  ],
  notifications: [
    { id: 'review', label: 'Items waiting for my review', enabled: true },
    { id: 'runs', label: 'Failed runs on PRs I opened', enabled: true },
    { id: 'pat', label: 'Personal access token about to expire', enabled: true },
    { id: 'digest', label: 'Weekly coverage digest', enabled: false },
  ],
};

export const fetchSettings = () => mock(sample);
