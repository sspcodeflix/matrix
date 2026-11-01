import { mock } from '../../api/useApi';

/** One saved scan snapshot (scans.snapshot, docs/DATA_MODEL.md), reduced to what Compare reads. */
export interface ScanPoint {
  scanId: string;
  date: string;
  /** When the scan snapshot was captured (ISO 8601, UTC); the "data as of" time for exports. */
  capturedAt?: string;
  /** Short label for the chart axis, e.g. "2 Sep". */
  label: string;
  totalFRs: number;
  /** Percent of all functional requirements automated by other (non-Matrix) tests. */
  otherPct: number;
  /** Percent automated by Matrix-written tests. */
  matrixPct: number;
  automatedFRs: number;
  matrixAutomatedFRs: number;
  openGaps: number;
  /** Cumulative Matrix tests merged and the PRs they came from. */
  matrixTestsMerged: number;
  matrixPrsMerged: number;
  latest?: boolean;
  /** Scans offered in the baseline / compare pickers. */
  pickable?: 'baseline' | 'compare';
}

export interface ModuleSnapshot {
  module: string;
  requirements: number;
  automatedPct: number;
  matrixAutomated: number;
  openGaps: number;
}

export interface LostRequirement {
  frId: string;
  title: string;
  module: string;
  reason: string;
  /** Scan in which the coverage was first lost. */
  lostInScanId: string;
}

export interface AppScans {
  appId: string;
  appName: string;
  scans: ScanPoint[];
  modules: Record<string, ModuleSnapshot[]>;
  lost: LostRequirement[];
  defaultBaseline?: string;
  defaultCompare?: string;
}

const scan = (
  scanId: string, date: string, label: string, totalFRs: number, otherPct: number, matrixPct: number,
  openGaps: number, matrixTestsMerged: number, matrixPrsMerged: number, extra: Partial<ScanPoint> = {},
): ScanPoint => ({
  scanId, date, label, totalFRs, otherPct, matrixPct, openGaps, matrixTestsMerged, matrixPrsMerged,
  automatedFRs: Math.round(((otherPct + matrixPct) / 100) * totalFRs),
  matrixAutomatedFRs: Math.round((matrixPct / 100) * totalFRs),
  ...extra,
});

const mod = (module: string, requirements: number, automatedPct: number, matrixAutomated: number, openGaps: number): ModuleSnapshot => ({
  module, requirements, automatedPct, matrixAutomated, openGaps,
});

// Sample names and numbers are placeholders from the design kit.
const paymentsHub: AppScans = {
  appId: 'PAYH',
  appName: 'Payments Hub',
  defaultBaseline: 'S-014',
  defaultCompare: 'S-022',
  scans: [
    scan('S-014', '2 Sep 2026', '2 Sep', 34, 44, 0, 23, 0, 0, { capturedAt: '2026-09-02T09:40:00Z', pickable: 'baseline' }),
    scan('S-015', '9 Sep 2026', '9 Sep', 34, 45, 3, 22, 4, 2),
    scan('S-016', '16 Sep 2026', '16 Sep', 35, 45, 6, 20, 8, 4),
    scan('S-017', '23 Sep 2026', '23 Sep', 35, 46, 9, 18, 12, 6),
    scan('S-018', '30 Sep 2026', '30 Sep', 36, 46, 12, 17, 16, 7, { capturedAt: '2026-09-30T09:40:00Z', pickable: 'baseline' }),
    scan('S-019', '7 Oct 2026', '7 Oct', 36, 47, 15, 15, 20, 9),
    scan('S-020', '14 Oct 2026', '14 Oct', 37, 47, 18, 14, 26, 11),
    scan('S-021', '21 Oct 2026', '21 Oct', 37, 47, 21, 12, 31, 12, { capturedAt: '2026-10-21T09:40:00Z', pickable: 'compare' }),
    // Same snapshot as Regression and the Overview: 26 of 38 automated and passing (FR-0219 failed in run #4821).
    scan('S-022', '1 Nov 2026', '1 Nov', 38, 44, 24, 12, 36, 14, { capturedAt: '2026-11-01T05:42:00Z', pickable: 'compare', latest: true }),
  ],
  modules: {
    'S-014': [
      mod('Authorisation', 7, 50, 0, 4), mod('Refunds', 6, 43, 0, 4), mod('Disputes', 5, 33, 0, 4),
      mod('Settlement', 9, 56, 0, 5), mod('Fees', 4, 25, 0, 3), mod('Reporting', 3, 50, 0, 3),
    ],
    'S-018': [
      mod('Authorisation', 8, 63, 1, 3), mod('Refunds', 7, 57, 1, 3), mod('Disputes', 5, 50, 1, 3),
      mod('Settlement', 9, 67, 1, 4), mod('Fees', 4, 25, 0, 2), mod('Reporting', 3, 50, 0, 2),
    ],
    'S-021': [
      mod('Authorisation', 8, 88, 3, 1), mod('Refunds', 7, 71, 2, 2), mod('Disputes', 6, 50, 1, 3),
      mod('Settlement', 9, 67, 1, 3), mod('Fees', 4, 50, 1, 2), mod('Reporting', 3, 67, 0, 1),
    ],
    'S-022': [
      mod('Authorisation', 8, 88, 3, 1), mod('Refunds', 7, 71, 2, 2), mod('Disputes', 6, 67, 2, 2),
      mod('Settlement', 9, 67, 1, 3), mod('Fees', 4, 50, 1, 2), mod('Reporting', 4, 75, 0, 1),
    ],
  },
  lost: [
    {
      frId: 'FR-0233', title: 'Holiday cut-off override', module: 'Settlement', lostInScanId: 'S-020',
      reason: 'Automation went stale after the 26.11 change. Listed as a regression gap.',
    },
    {
      frId: 'FR-0219', title: 'Manual settlement', module: 'Settlement', lostInScanId: 'S-022',
      reason: 'Failing since run #4821 (locator change). Fix PR #209 restores it.',
    },
  ],
};

const apps: AppScans[] = [paymentsHub];

// TODO(backend): GET /api/apps/{appId}/scans?include=snapshot,modules,lost (saved scan snapshots).
// An application without saved scans returns an empty list, shown as "No saved regression scans".
export const fetchAppScans = (appId: string, appName: string) =>
  mock<AppScans>(apps.find((a) => a.appId === appId) ?? { appId, appName, scans: [], modules: {}, lost: [] });
