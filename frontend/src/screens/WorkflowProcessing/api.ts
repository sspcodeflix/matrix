import { mock } from '../../api/useApi';

export type WorkflowKey = 'acceptance' | 'regression';

/** Local preview states; mirror workflow_jobs.state in docs/DATA_MODEL.md. */
export type JobState = 'running' | 'stop_requested' | 'stopping' | 'stopped' | 'completed';

export interface WorkflowScenario {
  label: string;
  scope: string;
  activity: string;
  /** Plural noun for the units of output, e.g. "automation drafts". */
  output: string;
  attemptPrefix: string;
  checkpointSupported: boolean;
  steps: string[];
  /** Index of the stage this attempt is working on. */
  currentStep: number;
  units: { id: string; title: string }[];
  externalNote: string;
}

export interface ProcessingFixture {
  appName: string;
  sourceVersion: string;
  checkpointPrefix: string;
  /** Simulated delays for the stop transitions (ms). */
  ackDelayMs: number;
  settleDelayMs: number;
  stopDelayMs: number;
  initialCompleted: number;
  workflows: Record<WorkflowKey, WorkflowScenario>;
}

const units = (prefix: string, titles: string[]) =>
  titles.map((title, i) => ({ id: `${prefix}-${String(i + 1).padStart(2, '0')}`, title }));

// Sample data for the local design preview only. No production identifiers.
// TODO(backend): GET /api/workflow-jobs/{jobId} (+ SSE/polling for state); POST /api/workflow-jobs/{jobId}/stop;
// POST /api/workflow-jobs/{jobId}/attempts { fromCheckpoint } (docs/WORKFLOW_CONTROL.md).
const fixture: ProcessingFixture = {
  appName: 'Sample application',
  sourceVersion: 'context-demo-v1',
  checkpointPrefix: 'CP-DEMO',
  ackDelayMs: 400,
  settleDelayMs: 500,
  stopDelayMs: 1600,
  initialCompleted: 3,
  workflows: {
    acceptance: {
      label: 'Acceptance',
      scope: 'Sample release · 8 acceptance criteria',
      activity: 'Writing acceptance tests',
      output: 'test drafts',
      attemptPrefix: 'ACC-DEMO',
      checkpointSupported: true,
      steps: ['Pull stories', 'Understand', 'Write tests', 'Sign off and export'],
      currentStep: 2,
      units: units('AC-DEMO', [
        'Valid request is accepted',
        'Missing required details are explained',
        'Duplicate submission is handled',
        'User receives a confirmation',
        'Cancelled requests remain traceable',
        'Restricted actions need the correct role',
        'Changes appear in the activity record',
        'A temporary error can be recovered',
      ]),
      externalNote:
        'Existing reviews and UAT sign-offs remain unchanged. Only accepted, signed-off test versions qualify for the separate Octane import sheet.',
    },
    regression: {
      label: 'Regression',
      scope: 'Whole sample application · 8 selected gaps',
      activity: 'Writing automation drafts',
      output: 'automation drafts',
      attemptPrefix: 'REG-DEMO',
      checkpointSupported: true,
      steps: ['Understand', 'Identify gaps', 'Write automation', 'Harness execution'],
      currentStep: 2,
      units: units('FR-DEMO', [
        'Valid request follows the expected route',
        'Invalid details produce a useful error',
        'Repeated requests do not duplicate work',
        'A completed request has an audit record',
        'A timed-out request can be retried',
        'Restricted actions enforce the user role',
        'A cancelled request retains its history',
        'The result matches the source requirement',
      ]),
      externalNote:
        'Existing branches and PRs remain unchanged. Harness executions already triggered from Git continue independently. Matrix cannot stop or rerun them.',
    },
  },
};

export const fetchProcessingFixture = () => mock(fixture);
