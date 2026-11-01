import { mock } from '../../api/useApi';

/*
 * Organisation overview: coverage per application, rolled up by CIO (docs/METRICS.md,
 * "Coverage levels and CIO roll-up"). Requirements are counted per application and once each;
 * applications without a completed scan are Not measured, never 0%.
 */

export interface Cio {
  id: string;
  name: string;
}

/** Requirement counts from an application's latest completed scan. Tiers are mutually exclusive. */
export interface CoverageCounts {
  /** A mapped automated test passed in the scan's Harness run. The only tier that counts as covered. */
  passing: number;
  /** Octane test cases exist, no automation. */
  casesOnly: number;
  /** Automated but no qualifying run yet, or the coverage is stale. */
  awaiting: number;
  noTest: number;
}

export interface AppCoverage {
  id: string;
  name: string;
  cioId: string;
  workspaces: number;
  /** Absent when the application has no completed scan: Not measured. */
  scan?: {
    id: string;
    /** ISO time the scan's data was captured. */
    capturedAt: string;
    ageDays: number;
    counts: CoverageCounts;
    /** Accepted out-of-scope overrides: outside the denominator. */
    excluded: number;
    /** Covered requirements whose passing test is Matrix-written. */
    matrixWritten: number;
  };
  pendingReviews: number;
  acceptance: { stories: number; signedOff: number };
}

export interface TrendPoint {
  month: string;
  /** Rolled-up counts at month end across the apps measured then. */
  covered: number;
  inScope: number;
  matrixWritten: number;
}

export interface OverviewData {
  asOf: string;
  /** Scans older than this many days are flagged stale (docs/METRICS.md: 15). */
  staleAfterDays: number;
  cios: Cio[];
  apps: AppCoverage[];
  /** Monthly trend per CIO id, plus 'all'. */
  trend: Record<string, TrendPoint[]>;
}

const scan = (id: string, capturedAt: string, ageDays: number, passing: number, casesOnly: number, awaiting: number, noTest: number, excluded: number, matrixWritten: number) => ({
  id, capturedAt, ageDays, counts: { passing, casesOnly, awaiting, noTest }, excluded, matrixWritten,
});

// TODO(backend): GET /api/overview?cio=… built from the latest completed scan snapshot per application.
// Names and figures are placeholders.
const sample: OverviewData = {
  asOf: '2026-11-01T09:42:00+04:00',
  staleAfterDays: 15,
  cios: [
    { id: 'cio-payments', name: 'Payments CIO' },
    { id: 'cio-retail', name: 'Retail Banking CIO' },
    { id: 'cio-corporate', name: 'Corporate Banking CIO' },
  ],
  apps: [
    { id: 'PAYH', name: 'Payments Hub', cioId: 'cio-payments', workspaces: 3, scan: scan('S-022', '2026-11-01T09:42:00+04:00', 0, 26, 4, 2, 6, 0, 9), pendingReviews: 3, acceptance: { stories: 12, signedOff: 3 } },
    { id: 'CRDP', name: 'Cards Portal', cioId: 'cio-payments', workspaces: 2, scan: scan('S-019', '2026-10-28T18:10:00+04:00', 4, 61, 12, 3, 9, 0, 14), pendingReviews: 1, acceptance: { stories: 8, signedOff: 5 } },
    { id: 'MRCH', name: 'Merchant Onboarding', cioId: 'cio-payments', workspaces: 2, scan: scan('S-011', '2026-09-12T11:00:00+04:00', 50, 18, 9, 0, 14, 0, 2), pendingReviews: 0, acceptance: { stories: 6, signedOff: 0 } },
    { id: 'FXRT', name: 'FX Rates', cioId: 'cio-payments', workspaces: 1, pendingReviews: 0, acceptance: { stories: 0, signedOff: 0 } },
    { id: 'RTLB', name: 'Retail Mobile Banking', cioId: 'cio-retail', workspaces: 4, scan: scan('S-031', '2026-10-31T21:05:00+04:00', 1, 142, 31, 8, 22, 2, 37), pendingReviews: 5, acceptance: { stories: 21, signedOff: 11 } },
    { id: 'LOAN', name: 'Personal Loans', cioId: 'cio-retail', workspaces: 2, scan: scan('S-027', '2026-10-25T08:30:00+04:00', 7, 55, 14, 2, 19, 0, 11), pendingReviews: 2, acceptance: { stories: 9, signedOff: 4 } },
    { id: 'CARD', name: 'Card Servicing', cioId: 'cio-retail', workspaces: 2, scan: scan('S-024', '2026-10-20T16:45:00+04:00', 12, 73, 8, 5, 11, 1, 6), pendingReviews: 0, acceptance: { stories: 4, signedOff: 4 } },
    { id: 'BCQ', name: 'Branch Queueing', cioId: 'cio-retail', workspaces: 1, pendingReviews: 0, acceptance: { stories: 0, signedOff: 0 } },
    { id: 'TRSY', name: 'Treasury Dealing', cioId: 'cio-corporate', workspaces: 3, scan: scan('S-015', '2026-10-30T10:20:00+04:00', 2, 88, 26, 6, 41, 3, 19), pendingReviews: 4, acceptance: { stories: 14, signedOff: 6 } },
    { id: 'TRDF', name: 'Trade Finance', cioId: 'cio-corporate', workspaces: 2, scan: scan('S-009', '2026-10-15T13:00:00+04:00', 17, 34, 22, 1, 30, 0, 4), pendingReviews: 1, acceptance: { stories: 7, signedOff: 2 } },
    { id: 'SFRTY', name: 'Sanctions Screening', cioId: 'cio-corporate', workspaces: 2, pendingReviews: 0, acceptance: { stories: 3, signedOff: 0 } },
  ],
  trend: {
    all: [
      { month: 'Jun', covered: 309, inScope: 762, matrixWritten: 0 },
      { month: 'Jul', covered: 339, inScope: 770, matrixWritten: 18 },
      { month: 'Aug', covered: 378, inScope: 778, matrixWritten: 43 },
      { month: 'Sep', covered: 418, inScope: 786, matrixWritten: 67 },
      { month: 'Oct', covered: 463, inScope: 794, matrixWritten: 88 },
      { month: 'Nov', covered: 497, inScope: 802, matrixWritten: 102 },
    ],
    'cio-payments': [
      { month: 'Jun', covered: 66, inScope: 154, matrixWritten: 0 },
      { month: 'Jul', covered: 72, inScope: 156, matrixWritten: 4 },
      { month: 'Aug', covered: 81, inScope: 158, matrixWritten: 10 },
      { month: 'Sep', covered: 89, inScope: 160, matrixWritten: 16 },
      { month: 'Oct', covered: 99, inScope: 162, matrixWritten: 22 },
      { month: 'Nov', covered: 105, inScope: 164, matrixWritten: 25 },
    ],
    'cio-retail': [
      { month: 'Jun', covered: 167, inScope: 370, matrixWritten: 0 },
      { month: 'Jul', covered: 184, inScope: 374, matrixWritten: 10 },
      { month: 'Aug', covered: 205, inScope: 378, matrixWritten: 23 },
      { month: 'Sep', covered: 227, inScope: 382, matrixWritten: 36 },
      { month: 'Oct', covered: 251, inScope: 386, matrixWritten: 46 },
      { month: 'Nov', covered: 270, inScope: 390, matrixWritten: 54 },
    ],
    'cio-corporate': [
      { month: 'Jun', covered: 76, inScope: 233, matrixWritten: 0 },
      { month: 'Jul', covered: 83, inScope: 236, matrixWritten: 4 },
      { month: 'Aug', covered: 93, inScope: 239, matrixWritten: 10 },
      { month: 'Sep', covered: 102, inScope: 242, matrixWritten: 15 },
      { month: 'Oct', covered: 113, inScope: 245, matrixWritten: 20 },
      { month: 'Nov', covered: 122, inScope: 248, matrixWritten: 23 },
    ],
  },
};

export const fetchOverview = () => mock(sample);

// ---- Roll-up rules (docs/METRICS.md). Pure functions so the backend can mirror them in tests.

export const inScopeOf = (c: CoverageCounts) => c.passing + c.casesOnly + c.awaiting + c.noTest;

export interface Rollup extends CoverageCounts {
  inScope: number;
  excluded: number;
  matrixWritten: number;
  measured: number;
  total: number;
  stale: number;
}

/** Adds counts across measured applications; never averages percentages. */
export function rollup(apps: AppCoverage[], staleAfterDays: number): Rollup {
  const r: Rollup = { passing: 0, casesOnly: 0, awaiting: 0, noTest: 0, inScope: 0, excluded: 0, matrixWritten: 0, measured: 0, total: apps.length, stale: 0 };
  for (const a of apps) {
    if (!a.scan) continue;
    const c = a.scan.counts;
    r.passing += c.passing;
    r.casesOnly += c.casesOnly;
    r.awaiting += c.awaiting;
    r.noTest += c.noTest;
    r.inScope += inScopeOf(c);
    r.excluded += a.scan.excluded;
    r.matrixWritten += a.scan.matrixWritten;
    r.measured += 1;
    if (a.scan.ageDays > staleAfterDays) r.stale += 1;
  }
  return r;
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
