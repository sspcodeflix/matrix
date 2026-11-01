import { mock } from '../../api/useApi';

export interface WeekTests {
  weekStart: string;
  acceptance: number;
  regression: number;
}

export interface DayTokens {
  /** ISO date. */
  day: string;
  /** Tachyon tokens, millions. */
  tokensM: number;
  weekend: boolean;
}

/** Aggregated from the usage collection: { userId, appId, day, tachyonTokens, byWorkflow, testsRequested, reviewed, acceptedAsWritten }. */
export interface PersonUsage {
  userId: string;
  name: string;
  initials: string;
  acceptance: number;
  regression: number;
  reviewed: number;
  /** Percent of reviewed items accepted with no edits. */
  acceptedAsWritten: number;
  /** Tachyon tokens, millions. */
  tachyonTokensM: number;
}

export interface StatsData {
  appName: string;
  period: string;
  snapshot: string;
  /** When the usage figures in `snapshot` were captured (ISO 8601, UTC). */
  snapshotCapturedAt: string;
  /** Stable snapshot ID for export file names and de-duplication. */
  snapshotId: string;
  activeUsers: number;
  acceptedAsWritten: number;
  acceptanceAcceptedAsWritten: number;
  regressionAcceptedAsWritten: number;
  tokensPerAcceptedTestK: number;
  tokensPerAcceptedTestPrevK: number;
  license: { usedM: number; totalM: number; projectedPct: number };
  weekly: WeekTests[];
  daily: DayTokens[];
  byWorkflow: { workflow: string; tokensM: number }[];
  people: PersonUsage[];
}

const dailyTokens = [1.1, 1.3, 0.9, 0.4, 0.3, 1.4, 1.6, 1.5, 1.2, 1.8, 0.5, 0.4, 1.7, 1.9, 2.1, 1.6, 1.4, 0.6, 0.3, 1.5, 1.8, 2.4, 2.0, 1.7, 0.5, 0.4, 1.6, 1.9, 2.2, 1.8, 1.5];

const person = (name: string, acceptance: number, regression: number, reviewed: number, acceptedAsWritten: number, tachyonTokensM: number): PersonUsage => ({
  userId: name.toLowerCase().replace(/[^a-z]/g, ''),
  name,
  initials: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  acceptance, regression, reviewed, acceptedAsWritten, tachyonTokensM,
});

// TODO(backend): GET /api/stats?app=…&period=30d (aggregated from `usage`; per-person rows only for permitted roles).
// Sample names and numbers are placeholders from the design kit.
const sample: StatsData = {
  appName: 'Payments Hub',
  period: 'Last 30 days',
  snapshot: 'Usage as of today 09:42 · 1–31 Oct · Asia/Dubai',
  // 09:42 Asia/Dubai (UTC+4).
  snapshotCapturedAt: '2026-11-01T05:42:00Z',
  snapshotId: 'USAGE-2026-10',
  activeUsers: 18,
  acceptedAsWritten: 71,
  acceptanceAcceptedAsWritten: 78,
  regressionAcceptedAsWritten: 66,
  tokensPerAcceptedTestK: 140,
  tokensPerAcceptedTestPrevK: 182,
  license: { usedM: 41.2, totalM: 66.5, projectedPct: 85 },
  weekly: [
    { weekStart: '5 Oct', acceptance: 31, regression: 48 },
    { weekStart: '12 Oct', acceptance: 40, regression: 55 },
    { weekStart: '19 Oct', acceptance: 46, regression: 62 },
    { weekStart: '26 Oct', acceptance: 57, regression: 73 },
  ],
  daily: dailyTokens.map((t, i) => {
    const d = new Date(Date.UTC(2026, 9, i + 1));
    const dow = d.getUTCDay();
    return { day: d.toISOString().slice(0, 10), tokensM: t, weekend: dow === 0 || dow === 6 };
  }),
  byWorkflow: [
    { workflow: 'Regression writing', tokensM: 19.8 },
    { workflow: 'Acceptance writing', tokensM: 12.8 },
    { workflow: 'Embeddings', tokensM: 5.8 },
    { workflow: 'Journey labelling', tokensM: 2.8 },
  ],
  people: [
    person('Priya N.', 38, 58, 64, 75, 9.8),
    person('Meera K.', 42, 0, 31, 87, 4.1),
    person('Arjun S.', 4, 34, 22, 55, 6.2),
    person('Deepa V.', 12, 15, 18, 44, 5.7),
    person('Rohan I.', 12, 0, 9, 78, 1.3),
    person('Sahil K.', 8, 11, 14, 71, 2.4),
    person('Neha R.', 14, 22, 20, 68, 2.1),
    person('Vikram P.', 6, 18, 12, 61, 1.9),
    person('Fatima A.', 11, 9, 15, 80, 1.4),
    person('Karan M.', 5, 16, 10, 52, 1.6),
    person('Lina H.', 9, 7, 11, 73, 0.9),
    person('Omar B.', 3, 14, 8, 48, 1.2),
    person('Ananya G.', 7, 6, 9, 84, 0.7),
    person('Rahul T.', 2, 12, 6, 58, 0.8),
    person('Sara D.', 6, 4, 7, 76, 0.5),
    person('Imran Q.', 1, 8, 4, 63, 0.4),
    person('Divya L.', 4, 2, 5, 90, 0.2),
    person('Jacob W.', 1, 0, 2, 50, 0.1),
  ],
};

export const fetchStats = () => mock(sample);
