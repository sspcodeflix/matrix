import { mock } from '../../api/useApi';
import type { ReportFormat, ScopeKey } from './types';

export type ExportJobState = 'Queued' | 'Generating' | 'Ready' | 'Failed' | 'Cancelled' | 'Expired';

/** One export job (docs/DATA_MODEL.md export jobs; files live on the NAS, never in MongoDB). */
export interface ExportJob {
  id: string;
  /** Application, report, format, scope identity, snapshot and requester: equal keys are the same export. Null: never deduplicated. */
  dedupeKey: string | null;
  reportKey: string;
  title: string;
  format: ReportFormat;
  /** Formats the report supports, for "Another format, same snapshot". */
  formats: ReportFormat[];
  /** Invoking context, e.g. workflow · application · release. */
  context: string;
  scopeKey: ScopeKey | 'original';
  /** Scope in words with its unit, e.g. "All matching filters (11 gaps)". */
  scopeLabel: string;
  /** Stable source snapshot ID, e.g. "S-022". */
  snapshotId: string;
  /**
   * When the source evidence was captured (absolute, UTC), from the request's
   * `snapshotCapturedAt`. Null when the invoking screen did not supply it:
   * shown as "capture time unknown", never replaced with the current time.
   */
  capturedAt: string | null;
  /** When the export job was created (not the evidence time). */
  createdAt: string;
  /** Record identity of the scope: sorted selected IDs (`selected`) or normalized filter spec (`filtered`). */
  scopeIds?: string[];
  scopeSpec?: string;
  /** Display-only record count of the scope. */
  count: number;
  /** Application name used in the deterministic filename. */
  application: string;
  state: ExportJobState;
  sizeKb?: number;
  expiresAt?: string;
  /** Actionable error for Failed jobs. */
  error?: string;
  filename: string;
  /** Whether the captured snapshot is still retained (needed for retry and original regeneration). */
  snapshotRetained: boolean;
  requester: string;
}

// TODO(backend): GET /api/exports?requester=me — the current user's export history.
// Sample names, IDs and times are placeholders from the design kit. `dedupeKey` is null here
// because the store derives it from the job's identity fields (see jobs.ts `dedupeKeyFor`).
const sample: ExportJob[] = [
  {
    id: 'RPT-039', count: 11, application: 'Payments Hub', dedupeKey: null,
    reportKey: 'coverage', title: 'Coverage and gaps', format: 'html', formats: ['pdf', 'html', 'xlsx'],
    context: 'Regression · Payments Hub · Release 26.11', scopeKey: 'filtered', scopeSpec: 'view=gaps', scopeLabel: 'All matching filters (12 gaps)',
    snapshotId: 'S-022', capturedAt: '2026-11-01T09:42:00Z', createdAt: '2026-11-01T09:43:00Z', state: 'Generating',
    filename: 'matrix_payments-hub_coverage_S-022_20261101T094200Z_RPT-039.html', snapshotRetained: true, requester: 'Priya N.',
  },
  {
    id: 'RPT-041', count: 3, application: 'Payments Hub', dedupeKey: null,
    reportKey: 'test-cases', title: 'Test cases', format: 'xlsx', formats: ['xlsx'],
    context: 'Acceptance · Payments Hub · Release 26.11', scopeKey: 'selected', scopeIds: ['TC-1041', 'TC-1042', 'TC-1043'], scopeLabel: 'Selected rows (3 test cases)',
    snapshotId: 'S-021', capturedAt: '2026-10-31T16:10:00Z', createdAt: '2026-10-31T16:11:00Z', state: 'Ready', sizeKb: 84,
    expiresAt: '2026-11-07T16:11:00Z',
    filename: 'matrix_payments-hub_test-cases_S-021_20261031T161000Z_RPT-041.xlsx', snapshotRetained: true, requester: 'Priya N.',
  },
  {
    id: 'RPT-040', count: 38, application: 'Payments Hub', dedupeKey: null,
    reportKey: 'coverage', title: 'Coverage and gaps', format: 'pdf', formats: ['pdf', 'html', 'xlsx'],
    context: 'Regression · Payments Hub · Release 26.11', scopeKey: 'full', scopeLabel: 'Entire permitted scope (38 requirements)',
    snapshotId: 'S-021', capturedAt: '2026-10-31T16:10:00Z', createdAt: '2026-10-31T16:12:00Z', state: 'Ready', sizeKb: 412,
    expiresAt: '2026-11-07T16:12:00Z',
    filename: 'matrix_payments-hub_coverage_S-021_20261031T161000Z_RPT-040.pdf', snapshotRetained: true, requester: 'Priya N.',
  },
  {
    id: 'RPT-037', count: 38, application: 'Payments Hub', dedupeKey: null,
    reportKey: 'comparison', title: 'Scan comparison', format: 'pdf', formats: ['pdf', 'html', 'xlsx'],
    context: 'Compare · Payments Hub · Release 26.11', scopeKey: 'full', scopeLabel: 'S-014 vs S-022 (38 requirements)',
    snapshotId: 'S-014-S-022', capturedAt: '2026-11-01T09:42:00Z', createdAt: '2026-11-01T09:44:00Z', state: 'Failed',
    error: 'Storage unavailable. Your choices are kept; retry uses the same snapshot.',
    filename: 'matrix_payments-hub_comparison_S-014-S-022_20261101T094200Z_RPT-037.pdf', snapshotRetained: true, requester: 'Priya N.',
  },
  {
    id: 'RPT-031', count: 164, application: 'Payments Hub', dedupeKey: null,
    reportKey: 'run-results', title: 'Run #4790 results', format: 'pdf', formats: ['pdf', 'html', 'xlsx'],
    context: 'Runs · Payments Hub · Release 26.11', scopeKey: 'full', scopeLabel: 'Run #4790 (164 test results)',
    snapshotId: 'RUN-4790', capturedAt: '2026-10-23T09:00:00Z', createdAt: '2026-10-23T09:05:00Z', state: 'Expired', sizeKb: 233,
    expiresAt: '2026-10-30T09:05:00Z',
    filename: 'matrix_payments-hub_run-results_RUN-4790_20261023T090000Z_RPT-031.pdf', snapshotRetained: true, requester: 'Priya N.',
  },
];

export const fetchRecentExports = () => mock(sample);
