import type { CoverageCounts } from '../Overview/api';
import type { RequirementRow } from './api';

/*
 * One classification for Regression (UI_UX_REVIEW C7, R7). Table status, views, KPIs, bulk
 * eligibility and download summaries all derive from `stateOf` and `measures`, and `tierCounts`
 * gives the same four tiers as the Overview (docs/METRICS.md, "Coverage levels and CIO roll-up"):
 * - Automated and passing: case and script exist, not stale, and a mapped test passed in the
 *   scan's Harness run. The only state that counts as covered.
 * - Awaiting execution evidence: automated, but no qualifying passing run (none yet, failed, or
 *   from another run). Shares the Overview tier with stale coverage.
 * - Stale coverage: a case or script exists but is older than the requirement.
 * - Cases only: in scope, has an Octane case, no script (includes a pending override).
 * - No test: in scope, not stale, no Octane case.
 * - Excluded: an accepted out-of-scope override. Leaves every tier and the denominator.
 */

export type Decision = 'accepted' | 'rejected';

export type CoverageState = 'covered' | 'awaiting' | 'stale' | 'cases_only' | 'no_test' | 'override_pending' | 'excluded';

type EvidenceState = Exclude<CoverageState, 'override_pending' | 'excluded'>;

/** True when the row has a mapped test that passed in the scan's own Harness run. */
export const hasQualifyingPass = (r: RequirementRow, scanRunId: string) =>
  r.lastRun?.passed === true && r.lastRun.runId === scanRunId;

function evidenceOf(r: RequirementRow, scanRunId: string): EvidenceState {
  if (r.octaneStale || r.scriptsStale) return 'stale';
  if (r.octaneCases === 0) return 'no_test';
  if (r.scripts === 0) return 'cases_only';
  return hasQualifyingPass(r, scanRunId) ? 'covered' : 'awaiting';
}

export function stateOf(r: RequirementRow, decision: Decision | null, scanRunId: string): CoverageState {
  if (r.status === 'override' && decision === 'accepted') return 'excluded';
  if (r.status === 'override' && decision === null) return 'override_pending';
  return evidenceOf(r, scanRunId);
}

export function measures(r: RequirementRow, decision: Decision | null, scanRunId: string) {
  const state = stateOf(r, decision, scanRunId);
  const inScope = state !== 'excluded';
  const evidence = evidenceOf(r, scanRunId);
  return {
    state,
    inScope,
    excluded: !inScope,
    overridePending: state === 'override_pending',
    stale: inScope && evidence === 'stale',
    awaiting: inScope && evidence === 'awaiting',
    /** Overview tier "Awaiting evidence or stale". */
    awaitingOrStale: inScope && (evidence === 'awaiting' || evidence === 'stale'),
    noTest: inScope && evidence === 'no_test',
    casesOnly: inScope && evidence === 'cases_only',
    covered: state === 'covered',
    gap: inScope && state !== 'covered',
  };
}

export type Measure = keyof Omit<ReturnType<typeof measures>, 'state'>;

export function summarize(rows: RequirementRow[], decision: Decision | null, scanRunId: string) {
  const n = (m: Measure) => rows.filter((r) => measures(r, decision, scanRunId)[m]).length;
  return {
    total: rows.length, inScope: n('inScope'), covered: n('covered'), gaps: n('gap'), noTest: n('noTest'),
    stale: n('stale'), awaiting: n('awaiting'), casesOnly: n('casesOnly'), excluded: n('excluded'),
    overridePending: n('overridePending'),
  };
}

export type Summary = ReturnType<typeof summarize>;

/** The Overview's four tiers for these rows; they add up to the in-scope count. */
export const tierCounts = (s: Summary): CoverageCounts => ({
  passing: s.covered,
  casesOnly: s.casesOnly,
  awaiting: s.awaiting + s.stale,
  noTest: s.noTest,
});
