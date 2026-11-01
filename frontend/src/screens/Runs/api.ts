import { mock } from '../../api/useApi';

/** Mirror of the `runs` collection (read-only; Harness owns execution). */
export interface Run {
  _id: string;
  harnessExecutionId: string;
  trigger: 'schedule' | 'pr_opened' | 'merge';
  /** Human trigger label, e.g. "Nightly schedule" or "PR #212 opened". */
  triggerLabel: string;
  branch: string;
  commit?: string;
  passed: number;
  failed: number;
  blocked: number;
  durationSec?: number;
  startedAt: string;
  /** Display form of startedAt, e.g. "Today 03:10". */
  startedLabel: string;
  status: 'completed' | 'in_progress';
  /** ISO 8601 (UTC): when Matrix last synced this run's results from Harness/HyperExecute. */
  capturedAt: string;
  octaneUpload: 'uploaded' | 'not_uploaded' | 'failed';
  harnessUrl: string;
}

export type FailureGroup = 'product_defect' | 'test_defect' | 'environment' | 'blocked';

export interface TriageAction {
  kind: 'raise_jira' | 'review_pr' | 'view_harness' | 'request_data';
  label: string;
  href?: string;
  note?: string;
}

/** One triage group for a run, built from the `failures` collection. */
export interface TriageGroup {
  group: FailureGroup;
  title: string;
  summary: string;
  tests: { test: string; frId: string }[];
  action: TriageAction;
}

export interface RunsData {
  pipeline: { name: string; harnessUrl: string };
  application: string;
  release: string;
  /** Total runs on the server; sample rows below are a page of these. */
  runs: Run[];
  triage: Record<string, TriageGroup[]>;
  dataAsOf: string;
  /** ISO 8601 (UTC) form of `dataAsOf`: when the run data was captured from Harness/HyperExecute. */
  capturedAt: string;
}

// TODO(backend): GET /api/apps/{appId}/runs and GET /api/runs/{runId}/failures.
// Sample names and numbers are placeholders from the design kit.
const sample: RunsData = {
  pipeline: { name: 'matrix-regression', harnessUrl: '#' },
  application: 'Payments Hub',
  release: 'Release 26.11',
  dataAsOf: 'today 11:20',
  capturedAt: '2026-11-01T11:20:00Z',
  runs: [
    { _id: '4832', harnessExecutionId: '7794', trigger: 'pr_opened', triggerLabel: 'PR #213 opened', branch: 'PR #213', passed: 41, failed: 1, blocked: 0, startedAt: '2026-11-01T11:12:00Z', startedLabel: 'Today 11:12', capturedAt: '2026-11-01T11:20:00Z', status: 'in_progress', octaneUpload: 'not_uploaded', harnessUrl: '#' },
    { _id: '4821', harnessExecutionId: '7781', trigger: 'schedule', triggerLabel: 'Nightly schedule', branch: 'matrix/regression-automation', passed: 158, failed: 6, blocked: 2, durationSec: 840, startedAt: '2026-11-01T03:10:00Z', startedLabel: 'Today 03:10', capturedAt: '2026-11-01T03:25:00Z', status: 'completed', octaneUpload: 'uploaded', harnessUrl: '#' },
    { _id: '4830', harnessExecutionId: '7790', trigger: 'pr_opened', triggerLabel: 'PR #212 opened', branch: 'PR #212', passed: 3, failed: 0, blocked: 0, durationSec: 120, startedAt: '2026-11-01T11:05:00Z', startedLabel: 'Today 11:05', capturedAt: '2026-11-01T11:08:00Z', status: 'completed', octaneUpload: 'not_uploaded', harnessUrl: '#' },
    { _id: '4815', harnessExecutionId: '7752', trigger: 'schedule', triggerLabel: 'Nightly schedule', branch: 'main', passed: 161, failed: 3, blocked: 0, durationSec: 780, startedAt: '2026-10-31T03:10:00Z', startedLabel: 'Yesterday 03:10', capturedAt: '2026-10-31T03:24:00Z', status: 'completed', octaneUpload: 'uploaded', harnessUrl: '#' },
    { _id: '4809', harnessExecutionId: '7731', trigger: 'merge', triggerLabel: 'Merge to main · a1b2c3d', branch: 'main', commit: 'a1b2c3d', passed: 164, failed: 0, blocked: 0, durationSec: 900, startedAt: '2026-10-29T16:40:00Z', startedLabel: '29 Oct 16:40', capturedAt: '2026-10-29T16:56:00Z', status: 'completed', octaneUpload: 'uploaded', harnessUrl: '#' },
    { _id: '4801', harnessExecutionId: '7710', trigger: 'schedule', triggerLabel: 'Nightly schedule', branch: 'main', passed: 160, failed: 2, blocked: 1, durationSec: 810, startedAt: '2026-10-29T03:10:00Z', startedLabel: '29 Oct 03:10', capturedAt: '2026-10-29T03:24:00Z', status: 'completed', octaneUpload: 'failed', harnessUrl: '#' },
    { _id: '4795', harnessExecutionId: '7702', trigger: 'pr_opened', triggerLabel: 'PR #209 opened', branch: 'PR #209', passed: 12, failed: 0, blocked: 0, durationSec: 240, startedAt: '2026-10-28T14:22:00Z', startedLabel: '28 Oct 14:22', capturedAt: '2026-10-28T14:27:00Z', status: 'completed', octaneUpload: 'not_uploaded', harnessUrl: '#' },
  ],
  triage: {
    '4821': [
      {
        group: 'product_defect',
        title: 'Settlement file misses cut-off',
        summary: 'Expected the GL file at 23:00; it was generated at 23:30. Passed on #4809, before deploy 26.11-rc2.',
        tests: [{ test: 'GLSettlementFileTest.cutOff', frId: 'FR-0221' }],
        action: { kind: 'raise_jira', label: 'Raise Jira defect' },
      },
      {
        group: 'test_defect',
        title: 'SettlementPage locator changed',
        summary: 'The button id moved from #settle-now to #settlement-run in the 26.11 UI. The app works; the tests are out of date.',
        tests: [
          { test: 'SettlementPageTest.manualRun', frId: 'FR-0219' },
          { test: 'SettlementPageTest.retry', frId: 'FR-0219' },
          { test: 'SettlementPageTest.audit', frId: 'FR-0222' },
        ],
        action: { kind: 'review_pr', label: 'Review fix PR #209', href: '/review' },
      },
      {
        group: 'environment',
        title: 'Acquirer sandbox timed out',
        summary: 'Sandbox returned 503 for 4 minutes at 03:18. Same tests passed on the previous 5 runs.',
        tests: [
          { test: 'RefundFlowTest.partial', frId: 'FR-0214' },
          { test: 'RefundFlowTest.full', frId: 'FR-0213' },
        ],
        action: { kind: 'view_harness', label: 'View in Harness', href: '#', note: 'Picked up by the next run' },
      },
      {
        group: 'blocked',
        title: 'No test data: chargeback in GBP',
        summary: 'These tests did not run. Data need chargeback.gbp has no records in SIT-2, so they are blocked rather than failed.',
        tests: [
          { test: 'ChargebackTest.gbpReversal', frId: 'FR-0226' },
          { test: 'ChargebackTest.ledgerUpdate', frId: 'FR-0226' },
        ],
        action: { kind: 'request_data', label: 'Request data', href: '/settings/test-data' },
      },
    ],
  },
};

export const fetchRuns = () => mock(sample);
