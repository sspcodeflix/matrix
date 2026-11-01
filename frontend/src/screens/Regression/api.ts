import { mock } from '../../api/useApi';

/** requirement_status (per scan), docs/DATA_MODEL.md. */
export type RequirementStatus = 'covered' | 'no_test' | 'not_automated' | 'stale' | 'override';

export interface RequirementRow {
  frId: string;
  title: string;
  module: string;
  /**
   * Workspaces (components, e.g. App-abcd-api) holding this requirement's tests. A requirement can
   * have tests in several and still counts once; a gap with no tests yet has none (docs/METRICS.md).
   */
  workspaceIds: string[];
  status: RequirementStatus;
  /** Octane cases mapped to the requirement. */
  octaneCases: number;
  octaneStale: boolean;
  /** Automated scripts mapped to the requirement. */
  scripts: number;
  scriptsStale: boolean;
  /** Huddle decision id when an override is pending. */
  decisionId?: string;
  /** Review queue item id when generated automation for this requirement is waiting for review. */
  reviewId?: string;
  /** PR number of that review item, for the row label. */
  reviewPr?: number;
  /**
   * Execution evidence for the mapped automated tests: the Harness run and whether at least one
   * mapped test passed in it. Absent when no run has executed them. Only a pass in the scan's
   * own run (RegressionData.lastRun.runId) counts as covered (docs/METRICS.md).
   */
  lastRun?: { runId: string; passed: boolean };
}

export type StepState = 'done' | 'review' | 'queued' | 'running';

/** Who the stage is waiting on. Shown as text, never colour alone. */
export type StepOwner = 'matrix' | 'qa' | 'uat' | 'external';

export interface PipelineStep {
  key: string;
  /** User outcome, e.g. "Check requirements". */
  name: string;
  state: StepState;
  owner: StepOwner;
  summary: string;
  /** Services and evidence behind the stage, shown in a collapsible details line. */
  tools: string;
  link?: { label: string; to: string; external?: boolean };
  /** Exact Review item the stage is waiting on, when known. */
  review?: { item: string; ref: string; label: string };
  /** Shown instead of a link when the step cannot be opened yet. */
  waitingNote?: string;
}

export interface SourceRow {
  name: string;
  detail: string;
  health: 'ok' | 'attention';
  /** In-app route when the source links to another Matrix screen. */
  to?: string;
}

export interface HuddleOverride {
  decisionId: string;
  frId: string;
  release: string;
  proposedBy: string;
  proposedAgo: string;
  reason: string;
  participants: string[];
}

export interface LastRun {
  runId: string;
  passed: number;
  failed: number;
  duration: string;
  branch: string;
  when: string;
  octaneUpload: 'uploaded' | 'not_uploaded' | 'failed';
}

export interface RegressionData {
  /** Application the scan belongs to. */
  appId: string;
  scanId: string;
  scanAsOf: string;
  /** ISO 8601 capture time of the scan snapshot (export "data as of"). */
  scanCapturedAt: string;
  scopeNote: string;
  repo: string;
  pipelineStarted: string;
  /** Where the requirements come from, e.g. the Confluence space. */
  requirementsSource: string;
  steps: PipelineStep[];
  requirements: RequirementRow[];
  sources: SourceRow[];
  huddle: HuddleOverride | null;
  lastRun: LastRun;
}

const SCAN_RUN = '4821';
/** Case and script exist; `passed` is whether a mapped test passed in the scan's run. */
const automated = (frId: string, title: string, module: string, octaneCases: number, scripts: number, passed = true): Omit<RequirementRow, 'workspaceIds'> => ({
  frId, title, module, status: 'covered', octaneCases, octaneStale: false, scripts, scriptsStale: false,
  lastRun: { runId: SCAN_RUN, passed },
});

// TODO(backend): GET /api/apps/{appId}/regression (latest scan snapshot + requirement_status rows,
// each with its mapped tests' result in the scan's Harness run); 404 when the app has no scan.
// Sample names and numbers are placeholders from the design kit.

// Sample mapping of modules to workspaces (components); real rows carry workspaceId from the scan.
const moduleWorkspace: Record<string, string> = {
  Authorisation: 'App-payh-api', Refunds: 'App-payh-web-ui', Disputes: 'App-payh-web-ui',
  Fees: 'App-payh-batch', Settlement: 'App-payh-batch', Reporting: 'App-payh-web-ui',
};
// Requirements with tests in a second workspace too (e.g. UI and API both tested).
const alsoIn: Record<string, string> = { 'FR-0202': 'App-payh-web-ui', 'FR-0206': 'App-payh-api' };
function inWorkspaces(rows: Omit<RequirementRow, 'workspaceIds'>[]): RequirementRow[] {
  return rows.map((r) => {
    const hasTests = r.octaneCases > 0 || r.scripts > 0;
    const home = moduleWorkspace[r.module] ?? 'App-payh-api';
    return { ...r, workspaceIds: hasTests ? [home, ...(alsoIn[r.frId] ? [alsoIn[r.frId]] : [])] : [] };
  });
}

const sample: RegressionData = {
  appId: 'PAYH',
  scanId: 'S-022',
  scanAsOf: 'today, 09:42',
  scanCapturedAt: '2026-11-01T09:42:00+04:00',
  scopeNote: 'Every functional requirement in Knowledge OS against Octane and the automation repo',
  repo: 'pay-hub-automation@main',
  pipelineStarted: 'started today 09:38',
  requirementsSource: 'Confluence PAY · Knowledge OS',
  steps: [
    {
      key: 'understand', name: 'Check requirements', state: 'done', owner: 'matrix',
      summary: '38 functional requirements found in 61 Confluence pages.',
      tools: 'Knowledge OS · DocuMind', link: { label: 'View context', to: '/context' },
    },
    {
      key: 'gaps', name: 'Review gaps', state: 'done', owner: 'matrix',
      summary: '12 gaps across 38 requirements: 6 with no test, 4 with cases only, 1 stale, 1 awaiting execution evidence.',
      tools: 'Testmind · Octane · GitHub', link: { label: 'View gaps', to: '#gaps-heading' },
    },
    {
      key: 'write', name: 'Review tests', state: 'review', owner: 'qa',
      summary: 'Automation for FR-0218 is written and waiting for your review in PR #212.',
      tools: 'Tachyon · GitHub PR on matrix/regression-automation',
      review: { item: 'rv-212', ref: 'FR-0218', label: 'Review PR #212' },
    },
    {
      key: 'execute', name: 'View results', state: 'queued', owner: 'external',
      summary: 'Runs after a person merges PR #212. Results appear in Runs and Octane.',
      tools: 'Harness · HyperExecute · Octane', waitingNote: 'Starts after merge',
    },
  ],
  requirements: inWorkspaces([
    { frId: 'FR-0214', title: 'Partial refund on a settled card payment', module: 'Refunds', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0226', title: 'Chargeback reversal updates the merchant ledger', module: 'Disputes', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0218', title: 'Retry on acquirer timeout, maximum 3 attempts', module: 'Authorisation', status: 'not_automated', octaneCases: 2, octaneStale: false, scripts: 0, scriptsStale: false, reviewId: 'rv-212', reviewPr: 212 },
    { frId: 'FR-0233', title: 'Settlement cut-off override on public holidays', module: 'Settlement', status: 'stale', octaneCases: 1, octaneStale: true, scripts: 1, scriptsStale: true, lastRun: { runId: SCAN_RUN, passed: true } },
    { frId: 'FR-0231', title: 'Multi-currency fee rounding, half-even', module: 'Fees', status: 'override', octaneCases: 1, octaneStale: false, scripts: 0, scriptsStale: false, decisionId: 'D-113' },
    { frId: 'FR-0216', title: 'Refund to an expired card routes to the original account', module: 'Refunds', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0228', title: 'Dispute evidence upload rejects files over 10 MB', module: 'Disputes', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0235', title: 'Settlement report lists reversed payments separately', module: 'Settlement', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0240', title: 'Fee schedule change applies from the next billing cycle', module: 'Fees', status: 'no_test', octaneCases: 0, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0211', title: '3-D Secure challenge fallback to frictionless flow', module: 'Authorisation', status: 'not_automated', octaneCases: 3, octaneStale: false, scripts: 0, scriptsStale: false },
    { frId: 'FR-0237', title: 'Settlement retry after a GL rejection', module: 'Settlement', status: 'not_automated', octaneCases: 1, octaneStale: false, scripts: 0, scriptsStale: false },
    automated('FR-0221', 'Daily settlement file to the GL, cut-off 23:00', 'Settlement', 4, 3),
    automated('FR-0201', 'Card authorisation approves within the merchant limit', 'Authorisation', 6, 5),
    automated('FR-0202', 'Declined authorisation returns the issuer reason code', 'Authorisation', 4, 4),
    automated('FR-0203', 'Pre-authorisation hold expires after 7 days', 'Authorisation', 3, 2),
    automated('FR-0204', 'Incremental authorisation on an open hold', 'Authorisation', 2, 2),
    automated('FR-0205', 'Authorisation reversal releases the hold', 'Authorisation', 3, 3),
    automated('FR-0206', 'Full refund on a settled card payment', 'Refunds', 5, 4),
    automated('FR-0207', 'Refund cannot exceed the captured amount', 'Refunds', 3, 3),
    automated('FR-0208', 'Refund status visible in the merchant portal', 'Refunds', 2, 2),
    automated('FR-0209', 'Refund webhook sent to the merchant', 'Refunds', 2, 1),
    automated('FR-0210', 'Duplicate refund requests are rejected', 'Refunds', 2, 2),
    automated('FR-0212', 'Dispute opened from an issuer notification', 'Disputes', 4, 3),
    automated('FR-0213', 'Dispute deadline reminder at 5 days', 'Disputes', 2, 2),
    automated('FR-0215', 'Dispute accepted debits the merchant', 'Disputes', 3, 2),
    automated('FR-0217', 'Dispute won credits the merchant', 'Disputes', 3, 2),
    // Both mapped tests failed in run #4821 (locator change; fix PR #209): awaiting execution evidence.
    automated('FR-0219', 'Manual settlement by an operations user', 'Settlement', 2, 1, false),
    automated('FR-0220', 'Settlement batch totals reconcile to the ledger', 'Settlement', 5, 4),
    automated('FR-0222', 'Settlement holds for flagged merchants', 'Settlement', 3, 2),
    automated('FR-0223', 'Weekend settlement rolls to the next business day', 'Settlement', 2, 2),
    automated('FR-0224', 'Interchange fee applied per card scheme', 'Fees', 4, 3),
    automated('FR-0225', 'Fee invoice generated monthly', 'Fees', 2, 2),
    automated('FR-0227', 'Daily transaction report export', 'Reporting', 3, 2),
    automated('FR-0229', 'Report filters by merchant and date range', 'Reporting', 2, 2),
    automated('FR-0230', 'Report access limited to the merchant role', 'Reporting', 2, 1),
    automated('FR-0232', 'Monthly volume report per card scheme', 'Reporting', 2, 2),
    automated('FR-0234', 'Velocity check blocks repeated declines', 'Authorisation', 3, 3),
    automated('FR-0236', 'Settlement file encrypted in transit', 'Settlement', 1, 1),
  ]),
  sources: [
    { name: 'Knowledge OS', detail: 'synced 09:42', health: 'ok' },
    { name: 'Confluence · PAY', detail: '61 pages', health: 'ok' },
    { name: 'Octane · PAY-R26.11', detail: '212 cases', health: 'ok' },
    { name: 'GitHub · pay-hub-automation', detail: 'main · your PAT', health: 'ok' },
    { name: 'From acceptance · 26.11', detail: '18 tests to automate', health: 'attention', to: '/acceptance' },
  ],
  huddle: {
    decisionId: 'D-113',
    frId: 'FR-0231',
    release: '26.11',
    proposedBy: 'Rohan I.',
    proposedAgo: '2h ago',
    reason: 'fee rounding ships in 26.12.',
    participants: ['PN', 'RI', 'MK'],
  },
  lastRun: {
    runId: SCAN_RUN, passed: 158, failed: 6, duration: '14m',
    branch: 'matrix/regression-automation', when: 'today 03:10', octaneUpload: 'uploaded',
  },
};

/** The application's latest regression scan, or null when it has none yet. Only the sample app has one. */
export const fetchRegression = (appId: string) => mock<RegressionData | null>(appId === sample.appId ? sample : null);

// TODO(backend): POST /api/apps/{appId}/regression/write-automation { frIds } -> workflow job (PR on a matrix/* branch).
export const requestAutomation = (frIds: string[]) => mock({ accepted: frIds.length, jobId: 'job-reg-0413' });

// TODO(backend): POST /api/huddle/decisions/{id} { status: 'accepted' | 'rejected' }.
export const decideOverride = (decisionId: string, status: 'accepted' | 'rejected') => mock({ decisionId, status });

// TODO(backend): POST /api/apps/{appId}/sources/resync.
export const resyncSources = () => mock({ ok: true }, 900);
