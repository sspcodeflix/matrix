import { mock } from '../../api/useApi';

/** docs/DATA_MODEL.md `stories.status`, plus `ready_for_uat` (all criteria tested and tests accepted, waiting for UAT sign-off). */
export type StoryStatus = 'not_started' | 'awaiting_review' | 'criterion_untested' | 'no_ac' | 'ready_for_uat' | 'signed_off';

export interface SignOff {
  userName: string;
  at: string;
  storyRevision: number;
  /** Story or a test changed after sign-off: renewed sign-off is needed before Octane export. */
  changedAfterSignoff: boolean;
}

export interface Story {
  _id: string;
  /** Workspace (component) the story belongs to, e.g. App-abcd-web-ui. Acceptance works inside one workspace. */
  workspaceId: string;
  title: string;
  revision: number;
  criteriaTotal: number;
  criteriaTested: number;
  testCount: number;
  status: StoryStatus;
  signoff?: SignOff;
  jiraUrl: string;
  /** Review queue item holding this story's generated tests, when one exists. */
  reviewId?: string;
  /**
   * AI stage whose output is waiting for QA in the story workspace (Story analysis, Test cases,
   * Automation, Tagging). Absent when nothing is generated yet or the story is past the AI stages.
   */
  aiStage?: AiStage;
}

/** The four AI stages per story (feedback `GenerationStage` values). */
export type AiStage = 'story_analysis' | 'test_cases' | 'automation' | 'test_tagging';

export type StepState = 'done' | 'review' | 'queued' | 'running';

/**
 * Release-level setup steps that run once per release (Matrix working). Per-story work after
 * this (tests, review, UAT sign-off, export) runs in parallel and is counted per story.
 */
export interface PipelineStep {
  key: 'pull' | 'understand';
  /** User outcome, e.g. "Check stories". */
  title: string;
  state: StepState;
  description: string;
  /** Services behind the step, shown in a collapsible details line. */
  tools: string[];
}

export interface AcceptanceData {
  release: { _id: string; name: string; jiraFixVersion: string; syncedAt: string; startedAt: string; /** ISO 8601 time of the Jira sync the page shows (export "data as of"). */ syncedAtIso: string };
  application: string;
  snapshot: string;
  pipeline: PipelineStep[];
  stories: Story[];
}

const jira = (key: string) => `#jira-${key}`; // TODO(backend): real Jira browse URL from apps.jiraProject

// TODO(backend): GET /api/apps/{appId}/acceptance?release={releaseId}. Sample names are placeholders.
const sample: AcceptanceData = {
  release: { _id: 'rel-26.11', name: 'Release 26.11', jiraFixVersion: 'PAY-26.11', syncedAt: 'today, 09:30', startedAt: 'today 09:30', syncedAtIso: '2026-11-01T09:30:00+04:00' },
  application: 'Payments Hub',
  snapshot: 'Jira sync today 09:30 (GST)',
  pipeline: [
    { key: 'pull', title: 'Check stories', state: 'done', description: '12 stories and 41 acceptance criteria from fix version PAY-26.11.', tools: ['Jira'] },
    { key: 'understand', title: 'Check requirements', state: 'done', description: 'Each criterion linked to app context. 1 story has no acceptance criteria.', tools: ['Knowledge OS', 'DocuMind'] },
  ],
  stories: [
    { _id: 'PAY-1482', workspaceId: 'App-payh-web-ui', title: 'Partial refund on a settled card payment', revision: 1, criteriaTotal: 4, criteriaTested: 0, testCount: 0, status: 'not_started', jiraUrl: jira('PAY-1482'), aiStage: 'story_analysis' },
    { _id: 'PAY-1507', workspaceId: 'App-payh-web-ui', title: 'Chargeback reversal updates the merchant ledger', revision: 1, criteriaTotal: 3, criteriaTested: 0, testCount: 0, status: 'not_started', jiraUrl: jira('PAY-1507') },
    { _id: 'PAY-1490', workspaceId: 'App-payh-web-ui', title: 'Merchant sees refund status in the portal', revision: 2, criteriaTotal: 3, criteriaTested: 3, testCount: 6, status: 'awaiting_review', jiraUrl: jira('PAY-1490'), reviewId: 'rv-1490', aiStage: 'test_cases' },
    { _id: 'PAY-1503', workspaceId: 'App-payh-batch', title: 'Multi-currency fee rounding, half-even', revision: 1, criteriaTotal: 2, criteriaTested: 1, testCount: 4, status: 'criterion_untested', jiraUrl: jira('PAY-1503') },
    { _id: 'PAY-1501', workspaceId: 'App-payh-batch', title: 'Settlement cut-off override on public holidays', revision: 1, criteriaTotal: 0, criteriaTested: 0, testCount: 0, status: 'no_ac', jiraUrl: jira('PAY-1501') },
    { _id: 'PAY-1495', workspaceId: 'App-payh-api', title: 'Retry on acquirer timeout, maximum 3 attempts', revision: 3, criteriaTotal: 5, criteriaTested: 5, testCount: 9, status: 'signed_off', signoff: { userName: 'Meera K.', at: '10:12', storyRevision: 3, changedAfterSignoff: false }, jiraUrl: jira('PAY-1495') },
    { _id: 'PAY-1511', workspaceId: 'App-payh-web-ui', title: 'Refund reference shown on the customer statement', revision: 1, criteriaTotal: 3, criteriaTested: 2, testCount: 5, status: 'criterion_untested', jiraUrl: jira('PAY-1511') },
    { _id: 'PAY-1488', workspaceId: 'App-payh-api', title: 'Duplicate payment detection within 60 seconds', revision: 2, criteriaTotal: 4, criteriaTested: 4, testCount: 3, status: 'signed_off', signoff: { userName: 'Meera K.', at: 'yesterday', storyRevision: 2, changedAfterSignoff: false }, jiraUrl: jira('PAY-1488'), reviewId: 'rv-1488' },
    { _id: 'PAY-1479', workspaceId: 'App-payh-api', title: 'Merchant payout hold after a fraud flag', revision: 4, criteriaTotal: 3, criteriaTested: 3, testCount: 4, status: 'signed_off', signoff: { userName: 'Arjun S.', at: '2 days ago', storyRevision: 3, changedAfterSignoff: true }, jiraUrl: jira('PAY-1479') },
    { _id: 'PAY-1476', workspaceId: 'App-payh-api', title: 'Card BIN lookup falls back to the cached table', revision: 1, criteriaTotal: 2, criteriaTested: 2, testCount: 2, status: 'signed_off', signoff: { userName: 'Arjun S.', at: '3 days ago', storyRevision: 1, changedAfterSignoff: false }, jiraUrl: jira('PAY-1476') },
    { _id: 'PAY-1499', workspaceId: 'App-payh-batch', title: 'Settlement file includes interchange fees', revision: 1, criteriaTotal: 6, criteriaTested: 6, testCount: 11, status: 'ready_for_uat', jiraUrl: jira('PAY-1499') },
    { _id: 'PAY-1493', workspaceId: 'App-payh-web-ui', title: 'Merchant can download a monthly fee summary', revision: 2, criteriaTotal: 6, criteriaTested: 6, testCount: 10, status: 'ready_for_uat', jiraUrl: jira('PAY-1493') },
  ],
};

export const fetchAcceptance = () => mock(sample);

// TODO(backend): POST /api/apps/{appId}/acceptance/write-tests { storyIds } -> workflow_jobs entry.
export const requestWriteTests = (storyIds: string[]) => mock({ jobId: 'job-acc-0412', storyIds });

// TODO(backend): POST /api/apps/{appId}/acceptance/octane-sheet -> export job; GET .../download streams the file.
/** The sheet targets the Octane workspace of the current Matrix workspace. */
// TODO(backend): POST /api/exports (report: octane_import, storyIds at signed-off revisions); the server uses the session's workspace.
export const generateOctaneSheet = (octaneWorkspaceId: string, storyIds: string[]) =>
  mock({ fileName: `matrix_octane-import_${octaneWorkspaceId}_${storyIds.length}-stories.xlsx` }, 900);
