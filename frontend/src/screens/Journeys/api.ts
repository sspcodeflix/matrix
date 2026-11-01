import { mock } from '../../api/useApi';
import { fetchSession } from '../../api/session';

/** Mirror of the `crawls` collection (latest crawl). */
export interface Crawl {
  _id: string;
  env: string;
  /** Display form of startedAt, e.g. "today 06:00". */
  startedLabel: string;
  durationLabel: string;
  /** When the crawl finished (ISO 8601, UTC): the capture time of its observed data. */
  finishedAt: string;
  roles: string[];
  components: string[];
  screens: number;
}

/** Mirror of the `journeys` collection. Observed behaviour, never expected results. */
export interface Journey {
  _id: string;
  name: string;
  stepCount: number;
  reachableBy: string[];
  matchedFR?: string;
  manualTests: number;
  state: 'observed' | 'confirmed' | 'in_huddle' | 'possible_defect';
}

export interface UnconfirmedRequirement {
  frId: string;
  reason: string;
}

export interface AccessFinding {
  summary: string;
  journey: string;
  role: string;
  /** The authoritative rule, cited before any expected outcome is proposed. */
  rule: { text: string; source: string; frId: string };
}

export interface JourneysData {
  application: string;
  crawl: Crawl;
  journeys: Journey[];
  undocumented: { inHuddle: number };
  unconfirmed: UnconfirmedRequirement[];
  access: AccessFinding[];
}

// TODO(backend): GET /api/apps/{appId}/crawls/latest and GET /api/apps/{appId}/journeys.
// Sample names and numbers are placeholders from the design kit.
const sample: Omit<JourneysData, 'application'> = {
  crawl: {
    _id: 'C-031', env: 'SIT-2', startedLabel: 'today 06:00', durationLabel: '42 min', finishedAt: '2026-11-01T06:42:00Z',
    roles: ['Ops maker', 'Ops checker', 'Auditor', 'Support L1'],
    components: ['merchant-portal', 'ops-console'], screens: 64,
  },
  journeys: [
    { _id: 'J-01', name: 'Initiate a partial refund', stepCount: 6, reachableBy: ['Maker', 'Checker', 'Auditor'], matchedFR: 'FR-0214', manualTests: 0, state: 'observed' },
    { _id: 'J-02', name: 'Approve a pending refund', stepCount: 4, reachableBy: ['Checker', 'Maker'], matchedFR: 'FR-0215', manualTests: 3, state: 'possible_defect' },
    { _id: 'J-03', name: 'Export refunds to CSV', stepCount: 3, reachableBy: ['Maker', 'Checker', 'Auditor'], manualTests: 0, state: 'in_huddle' },
    { _id: 'J-04', name: 'Bulk re-send merchant webhook', stepCount: 5, reachableBy: ['Support L1'], manualTests: 0, state: 'in_huddle' },
    { _id: 'J-05', name: 'Run manual settlement', stepCount: 4, reachableBy: ['Maker'], matchedFR: 'FR-0219', manualTests: 2, state: 'confirmed' },
    { _id: 'J-06', name: 'Change merchant fee profile', stepCount: 5, reachableBy: ['Checker'], manualTests: 0, state: 'in_huddle' },
    { _id: 'J-07', name: 'Search transactions by merchant', stepCount: 3, reachableBy: ['Maker', 'Checker', 'Auditor', 'Support L1'], matchedFR: 'FR-0201', manualTests: 4, state: 'confirmed' },
    { _id: 'J-08', name: 'Download settlement report', stepCount: 4, reachableBy: ['Auditor', 'Checker'], matchedFR: 'FR-0222', manualTests: 1, state: 'confirmed' },
    { _id: 'J-09', name: 'Reverse a full refund', stepCount: 5, reachableBy: ['Maker', 'Checker'], matchedFR: 'FR-0213', manualTests: 2, state: 'confirmed' },
    { _id: 'J-10', name: 'View merchant audit trail', stepCount: 3, reachableBy: ['Auditor'], matchedFR: 'FR-0230', manualTests: 0, state: 'observed' },
  ],
  undocumented: { inHuddle: 3 },
  unconfirmed: [
    { frId: 'FR-0233', reason: 'Only appears on public holidays; the crawl ran on a working day.' },
    { frId: 'FR-0240', reason: 'Needs the Ops supervisor role, which has no test identity in SIT-2.' },
  ],
  access: [
    {
      summary: 'Ops maker could approve its own refund. The rules say it should not.',
      journey: 'Approve a pending refund',
      role: 'Ops maker',
      rule: {
        text: 'A refund must be approved by a different user from the one who initiated it (maker-checker).',
        source: 'Knowledge OS · Refund approval policy',
        frId: 'FR-0215',
      },
    },
  ],
};

export const fetchJourneys = async (): Promise<JourneysData> => {
  const [session, data] = await Promise.all([fetchSession(), mock(sample)]);
  return { ...data, application: session.application.name };
};
