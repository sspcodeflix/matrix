import { mock } from '../../api/useApi';
import { gateReason } from '../feedback/hooks';
import { isCurrentComplete, outputRevisionFor, record as recordFeedback, type Generation } from '../feedback/api';

/*
 * One versioned test-case set per story (docs/DATA_MODEL.md `test_cases`), shared by the story
 * workspace and the Review queue so both show the same IDs, content and decisions (UI_UX_REVIEW R2).
 *
 * Per-test Accept and Reject are provisional. A set is released to UAT sign-off and automation only
 * by an explicit set acceptance at the current output revision, after that revision is rated
 * (UI_UX_REVIEW R1). Rejected cases are excluded from the release, and the count is stated.
 *
 * Mock-backed: everything here is sample data held in memory. Names and numbers are placeholders.
 */

/** `test_cases.state`, plus `stale` when the case changed after it was accepted. */
export type TestState = 'draft' | 'accepted' | 'rejected' | 'edited' | 'stale';
export type RejectionReason = 'convention' | 'wrong_assertion' | 'misread_requirement' | 'duplicate';

export const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: 'wrong_assertion', label: 'Wrong assertion' },
  { value: 'misread_requirement', label: 'Misread the requirement' },
  { value: 'convention', label: "Doesn't follow our conventions" },
  { value: 'duplicate', label: 'Duplicate of an existing test' },
];

export interface TestStep { seq: number; action: string; expected: string }

export interface TestCase {
  _id: string;
  title: string;
  criterionId: string;
  preconditions: string[];
  steps: TestStep[];
  /** @role and @data references, e.g. "@role:merchant_admin". */
  roles: string[];
  dataNeeds: string[];
  state: TestState;
  /** Content revision of this case; an edit or a regeneration adds one. */
  revision: number;
  /** Revision that was accepted, when acceptance is now stale. */
  acceptedRevision?: number;
  rejection?: { reason: RejectionReason; note: string };
  /** Context chunk or Jira field IDs the case cites. */
  citations: string[];
}

/** The explicit "accept this set" record, bound to the exact revision and decisions accepted. */
export interface SetAcceptance {
  fingerprint: string;
  outputRevision: number;
  by: string;
  at: string;
  accepted: string[];
  excluded: string[];
}

export interface TestCaseSet {
  storyId: string;
  /** Stable per story; each content change is a new output revision of it. */
  generationId: string;
  mlflowTraceId: string;
  skills: string[];
  model: string;
  generatedAt: string;
  /** Regeneration count: a regenerated set is new output even when IDs repeat. */
  draft: number;
  cases: TestCase[];
  acceptance?: SetAcceptance;
}

/** Inputs for one generated case: what the test-case skill derives from a criterion. */
export interface CaseSpec {
  criterionId: string;
  title: string;
  role: string;
  data: string;
  screen: string;
  action: string;
  precondition: string;
  expected: string;
  citations: string[];
}

/** Builds a case in the standard three-step shape. Stand-in for the Tachyon test-case skill. */
export function buildCase(storyId: string, n: number, s: CaseSpec, state: TestState = 'draft'): TestCase {
  return {
    _id: `TC-${storyId.replace(/\D/g, '')}-${String(n).padStart(2, '0')}`,
    title: s.title,
    criterionId: s.criterionId,
    preconditions: [`Signed in as @role:${s.role}`, s.precondition],
    steps: [
      { seq: 1, action: `Open ${s.screen}`, expected: `${s.screen} loads for @role:${s.role}` },
      { seq: 2, action: `Find the record from @data:${s.data}`, expected: 'The record is listed with its reference' },
      { seq: 3, action: s.action, expected: s.expected },
    ],
    roles: [`@role:${s.role}`],
    dataNeeds: [`@data:${s.data}`],
    state,
    revision: 1,
    citations: s.citations,
  };
}

const TEST_CASE_SKILLS = ['manual-test-writer@3.2.1', 'payments-glossary@2.1.0'];
const MODEL = 'gemini-2.5-pro (Tachyon)';
const short = (storyId: string) => storyId.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---- Sample data (TODO(backend): GET /api/apps/{appId}/acceptance/stories/{storyId}/test-cases) ----

const refunds = (criterionId: string, title: string, data: string, precondition: string, action: string, expected: string, cite: string, role = 'merchant_admin'): CaseSpec => ({
  criterionId, title, role, data, screen: 'Refunds page', action, precondition, expected, citations: ['jira:PAY-1490#ac', cite],
});
const retry = (criterionId: string, title: string, data: string, precondition: string, action: string, expected: string, cites: string[] = [], screen = 'Payment timeline'): CaseSpec => ({
  criterionId, title, role: 'ops_agent', data, screen, action, precondition, expected, citations: ['jira:PAY-1495#ac', ...cites],
});

const samples: { storyId: string; generatedAt: string; specs: CaseSpec[]; acceptedBy?: string; acceptedAt?: string }[] = [
  {
    storyId: 'PAY-1490', generatedAt: '2026-11-01T09:52:00+04:00',
    specs: [
      refunds('AC1', 'Refunds page shows one of Requested, Processing, Refunded or Failed for each refund', 'refund_settled', 'Test data @data:refund_settled exists', 'Open the refund detail', 'Status shows "Refunded" with the refund date', 'cf:refunds-lifecycle#c12'),
      refunds('AC1', 'Refund in progress shows Processing, without a refund date', 'refund_settled', 'A refund in PROCESSING state exists', 'Open the refund detail', 'Status shows "Processing" and no refund date', 'cf:refunds-lifecycle#c12'),
      refunds('AC2', 'A failed refund shows the acquirer reason in plain words', 'refund_failed', 'Test data @data:refund_failed exists', 'Open the failed refund', 'Status shows "Failed" with the mapped reason text', 'cf:refunds-lifecycle#c12'),
      refunds('AC2', 'Unknown reason code shows a generic reason', 'refund_failed', 'A failed refund with an unmapped reason code exists', 'Open the failed refund', 'Reason reads "Declined by the card issuer"', 'cf:refunds-lifecycle#c12'),
      refunds('AC3', 'An open Refunds page shows a status change within 30 seconds without reloading', 'refund_processing', 'Test data @data:refund_processing exists', 'Wait while the refund moves to REFUNDED', 'Status changes to "Refunded" within 30 seconds', 'cf:portal-polling#c03', 'merchant_viewer'),
      refunds('AC3', 'Viewer role sees status but cannot retry', 'refund_processing', 'Signed in with view-only rights', 'Wait while the refund moves to REFUNDED', 'Status is shown and no Retry action is offered', 'cf:portal-polling#c03', 'merchant_viewer'),
    ],
  },
  {
    storyId: 'PAY-1495', generatedAt: '2026-10-30T14:20:00+04:00', acceptedBy: 'Arjun S.', acceptedAt: '2026-10-30T14:20:00+04:00',
    specs: [
      retry('AC1', 'A payment retries after an acquirer timeout', 'acquirer_timeout_once', 'Test data @data:acquirer_timeout_once exists', 'Submit a payment that times out once', 'Timeline shows 1 retry and status "Captured"'),
      retry('AC1', 'No retry on a hard decline', 'acquirer_timeout_once', 'Acquirer returns a hard decline', 'Submit a payment that times out once', 'No retry; status "Declined"'),
      retry('AC2', 'A payment stops after 3 retries and shows "Failed: acquirer timeout"', 'acquirer_timeout_always', 'Test data @data:acquirer_timeout_always exists', 'Submit a payment that always times out', 'Timeline shows 3 retries and status "Failed: acquirer timeout"'),
      retry('AC2', 'Retry count resets for a new payment', 'acquirer_timeout_always', 'A previous payment used 3 retries', 'Submit a payment that always times out', 'The new payment starts at attempt 1'),
      retry('AC3', 'Retries wait 2, 4 and 8 seconds', 'acquirer_timeout_always', 'Test data @data:acquirer_timeout_always exists', 'Read the retry timestamps', 'Gaps between attempts are 2, 4 and 8 seconds (±1s)', ['cf:acquirer-retry#c04']),
      retry('AC3', 'Backoff does not exceed the gateway timeout', 'acquirer_timeout_always', 'Gateway timeout set to 20 seconds', 'Read the retry timestamps', 'Total retry time stays under 20 seconds', ['cf:acquirer-retry#c04']),
      retry('AC4', 'A retried payment is captured once', 'acquirer_timeout_late_success', 'Test data @data:acquirer_timeout_late_success exists', 'Check captures after a late acquirer success', 'Exactly one capture is recorded', ['cf:acquirer-retry#c07']),
      retry('AC4', 'Idempotency key is reused across retries', 'acquirer_timeout_late_success', 'Request log is available', 'Check captures after a late acquirer success', 'All attempts carry the same idempotency key', ['cf:acquirer-retry#c07']),
      retry('AC5', 'Ops receive an alert after the final failed attempt', 'acquirer_timeout_always', 'Test data @data:acquirer_timeout_always exists', 'Open alerts after the payment fails', 'One "Acquirer timeout" alert for the payment', [], 'Alerts page'),
    ],
  },
  {
    storyId: 'PAY-1488', generatedAt: '2026-10-29T10:15:00+04:00', acceptedBy: 'Arjun S.', acceptedAt: '2026-10-29T16:40:00+04:00',
    specs: [1, 2, 3].map((n) => ({
      criterionId: `AC${n}`, title: `Duplicate check ${n}`, role: 'ops_agent', data: 'payment_repeat_60s', screen: 'Payment detail',
      action: 'Send the same payment again', precondition: 'A payment from the test card was sent less than 60 seconds ago',
      expected: 'The second payment is flagged as a possible duplicate', citations: ['jira:PAY-1488#ac'],
    })),
  },
];

// ---- Store ----

const sets = new Map<string, TestCaseSet>();
const listeners = new Set<() => void>();
let version = 0;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const caseStoreVersion = () => version;

function put(set: TestCaseSet) {
  sets.set(set.storyId, set);
  version += 1;
  listeners.forEach((l) => l());
}

export const getSet = (storyId: string): TestCaseSet | undefined => sets.get(storyId);

/** The rated generation for a set: its identity is every case's ID and revision, plus the draft. */
export function generationOfSet(set: TestCaseSet): Generation {
  const outputHash = `draft ${set.draft}: ${set.cases.map((c) => `${c._id}@${c.revision}`).join(',')}`;
  return {
    generationId: set.generationId,
    stage: 'test_cases',
    subjectId: set.storyId,
    outputRevision: outputRevisionFor(set.generationId, outputHash),
    outputHash,
    mlflowTraceId: set.mlflowTraceId,
    skills: set.skills,
    model: set.model,
    generatedAt: set.generatedAt,
  };
}

/** Content identity plus every decision: a set acceptance holds only while this is unchanged. */
const fingerprint = (set: TestCaseSet) =>
  `${generationOfSet(set).outputHash} | ${set.cases.map((c) => `${c._id}:${c.state}`).join(',')}`;

export interface SetRelease {
  generation: Generation;
  /** Explicitly accepted at the current revision with the current decisions: released to UAT and automation. */
  released: boolean;
  /** An earlier set acceptance no longer holds because a case or decision changed. */
  withdrawn: boolean;
  /** The set-level accept action may run now. */
  canAccept: boolean;
  /** Why the set cannot be accepted now (or, when released, what was released). */
  reason: string;
  feedbackReady: boolean;
  /** Rejected cases: excluded from the release, not sent to UAT and not automated. */
  excluded: TestCase[];
  /** Cases the release includes. */
  included: TestCase[];
  /** Included cases not yet accepted one by one; set acceptance accepts them. */
  toAccept: number;
  acceptance?: SetAcceptance;
}

/**
 * The completion predicate for a test-case set, used by every move-on path (story "Accept test
 * cases and write automation", Review "Accept set", UAT readiness, automation drafting).
 */
export function setRelease(set: TestCaseSet): SetRelease {
  const generation = generationOfSet(set);
  const feedbackReady = isCurrentComplete(generation);
  const excluded = set.cases.filter((c) => c.state === 'rejected');
  const included = set.cases.filter((c) => c.state !== 'rejected');
  const released = !!set.acceptance && set.acceptance.fingerprint === fingerprint(set) && feedbackReady;
  const canAccept = !released && feedbackReady && included.length > 0;
  const reason = released
    ? `Accepted by ${set.acceptance!.by} at revision ${set.acceptance!.outputRevision}`
    : included.length === 0 ? 'Every case is rejected: regenerate the set or undo a rejection'
    : !feedbackReady ? gateReason([generation])
    : '';
  return {
    generation, released, withdrawn: !!set.acceptance && !released, canAccept, reason, feedbackReady,
    excluded, included, toAccept: included.filter((c) => c.state !== 'accepted').length, acceptance: set.acceptance,
  };
}

/** "1 rejected case is excluded: TC-1490-01" */
export function exclusionNote(r: SetRelease): string {
  const n = r.excluded.length;
  if (!n) return '';
  return `${n} rejected ${n === 1 ? 'case is' : 'cases are'} excluded (${r.excluded.map((c) => c._id).join(', ')}): not accepted, not sent to UAT and not automated.`;
}

/** TODO(backend): PATCH /api/apps/{appId}/acceptance/stories/{storyId}/test-cases/{id} { state, rejection?, title?, steps? }. */
export async function updateCase(storyId: string, next: TestCase): Promise<TestCase> {
  const set = sets.get(storyId);
  if (!set) throw new Error(`No test-case set for ${storyId}`);
  put({ ...set, cases: set.cases.map((c) => (c._id === next._id ? next : c)) });
  return mock(next, 80);
}

/**
 * TODO(backend): POST .../test-cases/accept { outputRevision, outputHash }. The server re-checks the
 * feedback gate and rejects (409) when the revision or decisions are no longer current. Accepts every
 * case that is not rejected; rejected cases are excluded.
 */
export async function acceptSet(storyId: string, by: string): Promise<TestCaseSet> {
  const set = sets.get(storyId);
  if (!set) throw new Error(`No test-case set for ${storyId}`);
  const r = setRelease(set);
  if (!r.canAccept) throw new Error(r.reason || 'This set is already accepted.');
  const cases = set.cases.map((c) => (c.state === 'rejected' ? c : { ...c, state: 'accepted' as const, acceptedRevision: undefined }));
  const next: TestCaseSet = { ...set, cases };
  next.acceptance = {
    fingerprint: fingerprint(next), outputRevision: r.generation.outputRevision, by, at: new Date().toISOString(),
    accepted: cases.filter((c) => c.state === 'accepted').map((c) => c._id), excluded: r.excluded.map((c) => c._id),
  };
  put(next);
  return mock(next, 300);
}

/**
 * Stores a newly generated or regenerated set (TODO(backend): written by the test-case generation job).
 * A regeneration is new output: each case's revision goes up and any set acceptance is cleared.
 */
export function replaceCases(storyId: string, cases: TestCase[], generatedAt = new Date().toISOString()): TestCaseSet {
  const prev = sets.get(storyId);
  const s = short(storyId);
  const set: TestCaseSet = {
    storyId,
    generationId: prev?.generationId ?? `gen-${s}-test_cases`,
    mlflowTraceId: `tr-${s}-test-${(prev?.draft ?? 0) + 1}`,
    skills: prev?.skills ?? TEST_CASE_SKILLS,
    model: prev?.model ?? MODEL,
    generatedAt,
    draft: (prev?.draft ?? 0) + 1,
    cases: cases.map((c) => ({ ...c, revision: (prev?.cases.find((p) => p._id === c._id)?.revision ?? 0) + 1 })),
  };
  put(set);
  return set;
}

for (const s of samples) {
  const set = replaceCases(s.storyId, s.specs.map((spec, i) => buildCase(s.storyId, i + 1, spec)), s.generatedAt);
  if (s.acceptedBy && s.acceptedAt) {
    // Accepted samples carry the acceptor's rating and set acceptance at that revision.
    const g = generationOfSet(set);
    recordFeedback({
      generationId: g.generationId, outputRevision: g.outputRevision, rating: 4, comment: 'Usable as generated.',
      commentRefinedByAi: false, userId: s.acceptedBy, updatedAt: s.acceptedAt,
    });
    const done: TestCaseSet = { ...set, cases: set.cases.map((c) => ({ ...c, state: 'accepted' as const })) };
    done.acceptance = { fingerprint: fingerprint(done), outputRevision: g.outputRevision, by: s.acceptedBy, at: s.acceptedAt, accepted: done.cases.map((c) => c._id), excluded: [] };
    put(done);
  }
}
