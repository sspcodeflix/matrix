import { mock } from '../../api/useApi';
import { record as recordFeedback, type Generation } from '../../features/feedback/api';
import {
  acceptSet, buildCase, getSet, replaceCases, setRelease, type CaseSpec, type TestCase,
} from '../../features/testcases';
import type { AiStage, Story } from '../Acceptance/api';

export type { TestCase, TestStep } from '../../features/testcases';

/*
 * Story workspace for the Acceptance workflow: four AI stages per story, each a rated
 * Generation (docs/FEEDBACK.md). A stage moves on only after its output is rated.
 * Everything here is sample data; names and numbers are placeholders from the design kit.
 */

export type StageKey = AiStage;
export const STAGE_ORDER: StageKey[] = ['story_analysis', 'test_cases', 'automation', 'test_tagging'];

export type StageStatus = 'not_started' | 'generating' | 'needs_review' | 'accepted';

export interface StageState {
  status: StageStatus;
  generation?: Generation;
  /** Instruction the user gave for the latest regeneration, if any. */
  instruction?: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface Citation {
  /** Context chunk or Jira field ID. */
  id: string;
  source: 'Jira' | 'Confluence' | 'App context';
  label: string;
  excerpt: string;
  url: string;
}

export interface Criterion {
  id: string;
  /** Text as written in Jira. */
  original: string;
  /** Refined, testable wording. */
  testable: string;
  citations: string[];
  // Hints the test case generator uses (sample generator below).
  role: string;
  data: string;
  screen: string;
  action: string;
  expected: string;
  negative?: { title: string; condition: string; expected: string };
}

export interface StoryAnalysis {
  refinedSummary: string;
  criteria: Criterion[];
  questions: { id: string; text: string; citations: string[] }[];
  outOfScope: string[];
  citations: Citation[];
}

export interface AutomationTest { name: string; testCaseId: string; tags: string[] }
export interface AutomationFile { path: string; change: 'added' | 'modified'; additions: number; deletions: number; tests: AutomationTest[] }
export interface AutomationOutput {
  repo: string;
  branch: string;
  baseBranch: string;
  /** Null until the PR is opened on the matrix/* branch. */
  prNumber: number | null;
  prUrl: string;
  files: AutomationFile[];
  preview: string;
}

export interface TagSuggestion { testCaseId: string; suites: string[]; priority: string; reason: string }

/** Configurable tag vocabulary (per application). */
export interface TagVocabulary {
  suites: { key: string; label: string; description: string }[];
  priorities: { key: string; label: string }[];
}

export interface StoryWorkspace {
  story: Story;
  application: string;
  jiraProject: string;
  stages: Record<StageKey, StageState>;
  analysis?: StoryAnalysis;
  /* Test cases live in the story's shared, versioned set (features/testcases), with Review. */
  automation?: AutomationOutput;
  tags?: TagSuggestion[];
  /** Huddle sign-off is UAT's; Matrix only shows the state. */
  uat: 'not_ready' | 'ready' | 'signed_off' | 'renewal';
}

const jira = (key: string) => `#jira-${key}`; // TODO(backend): real Jira browse URL from apps.jiraProject
const SKILLS: Record<StageKey, string[]> = {
  story_analysis: ['story-analyser@1.4.0', 'payments-glossary@2.1.0'],
  test_cases: [], // from the shared test-case set
  automation: ['junit5-playwright@2.0.3', 'pay-hub-page-objects@1.7.0'],
  test_tagging: ['suite-tagger@0.9.2'],
};
const MODEL = 'gemini-2.5-pro (Tachyon)';

function gen(storyId: string, stage: StageKey, revision: number, generatedAt: string): Generation {
  const short = storyId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    generationId: `gen-${short}-${stage}-r${revision}`,
    stage,
    subjectId: storyId,
    outputRevision: revision,
    outputHash: `sha256:${(short + stage + revision).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0')}`,
    mlflowTraceId: `tr-${short}-${stage.slice(0, 4)}-${revision}${revision}0`,
    skills: SKILLS[stage],
    model: MODEL,
    generatedAt,
  };
}

// ---- Sample generators (stand-ins for the Tachyon skills) ----

function draftTestCases(storyId: string, analysis: StoryAnalysis): TestCase[] {
  const specs: CaseSpec[] = [];
  for (const c of analysis.criteria) {
    const base = { criterionId: c.id, role: c.role, data: c.data, screen: c.screen, action: c.action, citations: c.citations };
    specs.push({ ...base, title: c.testable, precondition: `Test data @data:${c.data} exists`, expected: c.expected });
    if (c.negative) specs.push({ ...base, title: c.negative.title, precondition: c.negative.condition, expected: c.negative.expected });
  }
  return specs.map((spec, i) => buildCase(storyId, i + 1, spec));
}

function className(storyId: string) {
  return `${storyId.replace('-', '')}AcceptanceTest`;
}

function draftAutomation(storyId: string, tests: TestCase[]): AutomationOutput {
  const accepted = tests.filter((t) => t.state !== 'rejected');
  const cls = className(storyId);
  const toMethod = (t: TestCase) =>
    t.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 6)
      .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
  const tagged: AutomationTest[] = accepted.map((t) => ({ name: toMethod(t), testCaseId: t._id, tags: [storyId, 'matrix', t._id] }));
  const first = accepted[0];
  return {
    repo: 'pay-hub-automation',
    branch: `matrix/${storyId.toLowerCase()}-acceptance`,
    baseBranch: 'main',
    prNumber: null,
    prUrl: '#', // TODO(integration): GitHub PR URL once opened as the user via the credential broker.
    files: [
      { path: `src/test/java/com/bank/payhub/acceptance/${cls}.java`, change: 'added', additions: 24 * accepted.length, deletions: 0, tests: tagged },
      { path: 'src/test/java/com/bank/payhub/pages/RefundsPage.java', change: 'modified', additions: 18, deletions: 3, tests: [] },
      { path: 'src/test/resources/testdata/acceptance.yaml', change: 'modified', additions: 6 * accepted.length, deletions: 0, tests: [] },
    ],
    preview: first
      ? [
        `@Tag("${storyId}")`,
        '@Tag("matrix")',
        `@Tag("${first._id}")`,
        '@Test',
        `void ${tagged[0].name}() {`,
        `    // ${first.title}`,
        ...first.steps.map((s) => `    // ${s.seq}. ${s.action} -> ${s.expected}`),
        '    refunds.open(testData.get("' + first.dataNeeds[0].replace('@data:', '') + '"));',
        '    assertThat(refunds.status()).isEqualTo(expected.status());',
        '}',
      ].join('\n')
      : '',
  };
}

function draftTags(tests: TestCase[]): TagSuggestion[] {
  return tests.filter((t) => t.state !== 'rejected').map((t, i) => {
    const negative = i > 0 && tests[i - 1].criterionId === t.criterionId;
    if (i === 0) return { testCaseId: t._id, suites: ['smoke', 'regression'], priority: 'P1', reason: 'Main happy path of the first criterion; a failure blocks the story.' };
    if (negative) return { testCaseId: t._id, suites: ['regression'], priority: 'P2', reason: 'Negative path of the same criterion; worth keeping but not a release gate.' };
    if (t.steps.length > 3) return { testCaseId: t._id, suites: ['regression', 'e2e'], priority: 'P2', reason: 'Spans several screens end to end.' };
    return { testCaseId: t._id, suites: ['regression', 'sanity'], priority: 'P2', reason: 'Core criterion check that is quick to run after a deploy.' };
  });
}

// ---- Sample data ----

const refundCitations: Citation[] = [
  { id: 'jira:PAY-1490#description', source: 'Jira', label: 'PAY-1490 · Description', excerpt: 'Merchants need to see where a refund is: requested, processing, refunded or failed.', url: jira('PAY-1490') },
  { id: 'jira:PAY-1490#ac', source: 'Jira', label: 'PAY-1490 · Acceptance criteria', excerpt: 'AC1 status visible. AC2 failed refunds show a reason. AC3 status updates without reload.', url: jira('PAY-1490') },
  { id: 'cf:refunds-lifecycle#c12', source: 'Confluence', label: 'Refunds lifecycle · chunk 12', excerpt: 'Refund states: REQUESTED, PROCESSING, REFUNDED, FAILED. FAILED carries an acquirer reason code.', url: '#confluence-refunds-lifecycle' },
  { id: 'cf:portal-polling#c03', source: 'Confluence', label: 'Merchant portal polling · chunk 3', excerpt: 'Portal status widgets poll every 30 seconds.', url: '#confluence-portal-polling' },
];

const analysis1490: StoryAnalysis = {
  refinedSummary: 'A merchant user can see the current status of each refund on the Refunds page of the merchant portal, including a reason when a refund fails, and the status refreshes on its own while the page is open.',
  criteria: [
    {
      id: 'AC1', original: 'Merchant can see refund status', testable: 'Refunds page shows one of Requested, Processing, Refunded or Failed for each refund',
      citations: ['jira:PAY-1490#ac', 'cf:refunds-lifecycle#c12'], role: 'merchant_admin', data: 'refund_settled', screen: 'Refunds page',
      action: 'Open the refund detail', expected: 'Status shows "Refunded" with the refund date',
      negative: { title: 'Refund in progress shows Processing, without a refund date', condition: 'A refund in PROCESSING state exists', expected: 'Status shows "Processing" and no refund date' },
    },
    {
      id: 'AC2', original: 'Show why a refund failed', testable: 'A failed refund shows the acquirer reason in plain words',
      citations: ['jira:PAY-1490#ac', 'cf:refunds-lifecycle#c12'], role: 'merchant_admin', data: 'refund_failed', screen: 'Refunds page',
      action: 'Open the failed refund', expected: 'Status shows "Failed" with the mapped reason text',
      negative: { title: 'Unknown reason code shows a generic reason', condition: 'A failed refund with an unmapped reason code exists', expected: 'Reason reads "Declined by the card issuer"' },
    },
    {
      id: 'AC3', original: 'Status updates automatically', testable: 'An open Refunds page shows a status change within 30 seconds without reloading',
      citations: ['jira:PAY-1490#ac', 'cf:portal-polling#c03'], role: 'merchant_viewer', data: 'refund_processing', screen: 'Refunds page',
      action: 'Wait while the refund moves to REFUNDED', expected: 'Status changes to "Refunded" within 30 seconds',
      negative: { title: 'Viewer role sees status but cannot retry', condition: 'Signed in with view-only rights', expected: 'Status is shown and no Retry action is offered' },
    },
  ],
  questions: [
    { id: 'Q1', text: 'Should a partially refunded payment show one status per refund or one combined status?', citations: ['jira:PAY-1490#description'] },
    { id: 'Q2', text: 'Is the 30-second refresh a requirement or the current portal default?', citations: ['cf:portal-polling#c03'] },
  ],
  outOfScope: ['Email or SMS notifications on status change', 'Refund initiation (covered by PAY-1482)'],
  citations: refundCitations,
};

const analysis1482: StoryAnalysis = {
  refinedSummary: 'An operations user can refund part of a settled card payment, up to the remaining refundable amount, and the payment then shows the refunded and remaining amounts.',
  criteria: [
    { id: 'AC1', original: 'Partial refund allowed on settled payments', testable: 'A settled card payment accepts a refund for less than its amount', citations: ['jira:PAY-1482#ac'], role: 'ops_agent', data: 'payment_settled', screen: 'Payment detail', action: 'Refund 40.00 of a 100.00 payment', expected: 'Refund is accepted and remaining amount shows 60.00' },
    { id: 'AC2', original: 'Cannot refund more than paid', testable: 'A refund above the remaining refundable amount is rejected with a message', citations: ['jira:PAY-1482#ac', 'cf:refunds-lifecycle#c08'], role: 'ops_agent', data: 'payment_partly_refunded', screen: 'Payment detail', action: 'Refund 70.00 when 60.00 remains', expected: 'Refund is rejected: "Amount exceeds the refundable balance"' },
    { id: 'AC3', original: 'Multiple partial refunds', testable: 'Several partial refunds can be made until the refundable balance is zero', citations: ['jira:PAY-1482#ac'], role: 'ops_agent', data: 'payment_partly_refunded', screen: 'Payment detail', action: 'Refund the remaining 60.00', expected: 'Remaining amount shows 0.00 and Refund is no longer offered' },
    { id: 'AC4', original: 'Only settled', testable: 'An unsettled payment does not offer a partial refund', citations: ['jira:PAY-1482#ac', 'cf:refunds-lifecycle#c02'], role: 'ops_agent', data: 'payment_authorised', screen: 'Payment detail', action: 'Look for the Refund action', expected: 'Only Void is offered; Refund is not shown' },
  ],
  questions: [
    { id: 'Q1', text: 'AC4 says "only settled": does that include payments in the settlement batch that has not closed yet?', citations: ['jira:PAY-1482#ac', 'cf:refunds-lifecycle#c02'] },
    { id: 'Q2', text: 'Is there a minimum refund amount?', citations: ['jira:PAY-1482#description'] },
  ],
  outOfScope: ['Refunds on non-card methods', 'Merchant-initiated refunds in the portal (PAY-1490 shows status only)'],
  citations: [
    { id: 'jira:PAY-1482#description', source: 'Jira', label: 'PAY-1482 · Description', excerpt: 'Operations need to refund part of a settled card payment when a customer returns some items.', url: jira('PAY-1482') },
    { id: 'jira:PAY-1482#ac', source: 'Jira', label: 'PAY-1482 · Acceptance criteria', excerpt: 'Partial refund allowed on settled payments. Cannot refund more than paid. Multiple partial refunds. Only settled.', url: jira('PAY-1482') },
    { id: 'cf:refunds-lifecycle#c02', source: 'Confluence', label: 'Refunds lifecycle · chunk 2', excerpt: 'Authorised but unsettled payments are voided, not refunded.', url: '#confluence-refunds-lifecycle' },
    { id: 'cf:refunds-lifecycle#c08', source: 'Confluence', label: 'Refunds lifecycle · chunk 8', excerpt: 'Refundable balance = captured amount minus completed and pending refunds.', url: '#confluence-refunds-lifecycle' },
  ],
};

const analysis1495: StoryAnalysis = {
  refinedSummary: 'When the acquirer times out, Matrix-tested payments retry up to 3 times with backoff, then fail with a clear status; no payment is charged twice.',
  criteria: [
    { id: 'AC1', original: 'Retry on timeout', testable: 'A payment retries after an acquirer timeout', citations: ['jira:PAY-1495#ac'], role: 'ops_agent', data: 'acquirer_timeout_once', screen: 'Payment timeline', action: 'Submit a payment that times out once', expected: 'Timeline shows 1 retry and status "Captured"', negative: { title: 'No retry on a hard decline', condition: 'Acquirer returns a hard decline', expected: 'No retry; status "Declined"' } },
    { id: 'AC2', original: 'Max 3 attempts', testable: 'A payment stops after 3 retries and shows "Failed: acquirer timeout"', citations: ['jira:PAY-1495#ac'], role: 'ops_agent', data: 'acquirer_timeout_always', screen: 'Payment timeline', action: 'Submit a payment that always times out', expected: 'Timeline shows 3 retries and status "Failed: acquirer timeout"', negative: { title: 'Retry count resets for a new payment', condition: 'A previous payment used 3 retries', expected: 'The new payment starts at attempt 1' } },
    { id: 'AC3', original: 'Backoff', testable: 'Retries wait 2, 4 and 8 seconds', citations: ['jira:PAY-1495#ac', 'cf:acquirer-retry#c04'], role: 'ops_agent', data: 'acquirer_timeout_always', screen: 'Payment timeline', action: 'Read the retry timestamps', expected: 'Gaps between attempts are 2, 4 and 8 seconds (±1s)', negative: { title: 'Backoff does not exceed the gateway timeout', condition: 'Gateway timeout set to 20 seconds', expected: 'Total retry time stays under 20 seconds' } },
    { id: 'AC4', original: 'No double charge', testable: 'A retried payment is captured once', citations: ['jira:PAY-1495#ac', 'cf:acquirer-retry#c07'], role: 'ops_agent', data: 'acquirer_timeout_late_success', screen: 'Payment timeline', action: 'Check captures after a late acquirer success', expected: 'Exactly one capture is recorded', negative: { title: 'Idempotency key is reused across retries', condition: 'Request log is available', expected: 'All attempts carry the same idempotency key' } },
    { id: 'AC5', original: 'Ops alert', testable: 'Ops receive an alert after the final failed attempt', citations: ['jira:PAY-1495#ac'], role: 'ops_agent', data: 'acquirer_timeout_always', screen: 'Alerts page', action: 'Open alerts after the payment fails', expected: 'One "Acquirer timeout" alert for the payment' },
  ],
  questions: [],
  outOfScope: ['Retry on network errors other than timeouts'],
  citations: [
    { id: 'jira:PAY-1495#ac', source: 'Jira', label: 'PAY-1495 · Acceptance criteria', excerpt: 'Retry on timeout. Max 3 attempts. Backoff. No double charge. Ops alert.', url: jira('PAY-1495') },
    { id: 'cf:acquirer-retry#c04', source: 'Confluence', label: 'Acquirer retry policy · chunk 4', excerpt: 'Exponential backoff starting at 2 seconds.', url: '#confluence-acquirer-retry' },
    { id: 'cf:acquirer-retry#c07', source: 'Confluence', label: 'Acquirer retry policy · chunk 7', excerpt: 'Retries reuse the original idempotency key.', url: '#confluence-acquirer-retry' },
  ],
};

const tc1495 = getSet('PAY-1495')?.cases ?? [];

const accepted = (stage: StageKey, id: string, rev: number, at: string, by: string): StageState => ({
  status: 'accepted', generation: gen(id, stage, rev, at), acceptedBy: by, acceptedAt: at,
});

const workspaces: Record<string, StoryWorkspace> = {
  'PAY-1490': {
    story: { _id: 'PAY-1490', workspaceId: 'App-payh-web-ui', title: 'Merchant sees refund status in the portal', revision: 2, criteriaTotal: 3, criteriaTested: 3, testCount: 6, status: 'awaiting_review', jiraUrl: jira('PAY-1490'), reviewId: 'rv-1490', aiStage: 'test_cases' },
    application: 'Payments Hub',
    jiraProject: 'PAY',
    stages: {
      story_analysis: accepted('story_analysis', 'PAY-1490', 2, '2026-11-01T09:41:00+04:00', 'Priya N.'),
      test_cases: { status: 'needs_review' },
      automation: { status: 'not_started' },
      test_tagging: { status: 'not_started' },
    },
    analysis: analysis1490,
    uat: 'not_ready',
  },
  'PAY-1482': {
    story: { _id: 'PAY-1482', workspaceId: 'App-payh-web-ui', title: 'Partial refund on a settled card payment', revision: 1, criteriaTotal: 4, criteriaTested: 0, testCount: 0, status: 'not_started', jiraUrl: jira('PAY-1482'), aiStage: 'story_analysis' },
    application: 'Payments Hub',
    jiraProject: 'PAY',
    stages: {
      story_analysis: { status: 'needs_review', generation: gen('PAY-1482', 'story_analysis', 1, '2026-11-01T09:47:00+04:00') },
      test_cases: { status: 'not_started' },
      automation: { status: 'not_started' },
      test_tagging: { status: 'not_started' },
    },
    analysis: analysis1482,
    uat: 'not_ready',
  },
  'PAY-1495': {
    story: { _id: 'PAY-1495', workspaceId: 'App-payh-api', title: 'Retry on acquirer timeout, maximum 3 attempts', revision: 3, criteriaTotal: 5, criteriaTested: 5, testCount: 9, status: 'signed_off', signoff: { userName: 'Meera K.', at: '10:12', storyRevision: 3, changedAfterSignoff: false }, jiraUrl: jira('PAY-1495') },
    application: 'Payments Hub',
    jiraProject: 'PAY',
    stages: {
      story_analysis: accepted('story_analysis', 'PAY-1495', 3, '2026-10-30T11:05:00+04:00', 'Arjun S.'),
      test_cases: { status: 'accepted', acceptedBy: 'Arjun S.', acceptedAt: '2026-10-30T14:20:00+04:00' },
      automation: accepted('automation', 'PAY-1495', 1, '2026-10-31T10:02:00+04:00', 'Arjun S.'),
      test_tagging: accepted('test_tagging', 'PAY-1495', 1, '2026-10-31T10:30:00+04:00', 'Arjun S.'),
    },
    analysis: analysis1495,
    automation: { ...draftAutomation('PAY-1495', tc1495), prNumber: 214 },
    tags: draftTags(tc1495),
    uat: 'signed_off',
  },
};

// Accepted stages in the sample already carry the acceptor's rating (stands in for stored feedback).
for (const ws of Object.values(workspaces)) {
  for (const key of STAGE_ORDER) {
    const s = ws.stages[key];
    if (s.status === 'accepted' && s.generation) {
      recordFeedback({
        generationId: s.generation.generationId, outputRevision: s.generation.outputRevision,
        rating: 4, comment: 'Usable as generated.', commentRefinedByAi: false, userId: s.acceptedBy ?? 'unknown', updatedAt: s.acceptedAt ?? '',
      });
    }
  }
}

/** Default suite and priority vocabulary. TODO(backend): GET /api/apps/{appId}/tag-vocabulary (admin-configurable). */
const tagVocabulary: TagVocabulary = {
  suites: [
    { key: 'smoke', label: 'smoke', description: 'Fast checks run on every deploy' },
    { key: 'sanity', label: 'sanity', description: 'Narrow checks after a fix or config change' },
    { key: 'regression', label: 'regression', description: 'Full regression suite' },
    { key: 'e2e', label: 'e2e', description: 'End-to-end journeys across screens or systems' },
  ],
  priorities: [
    { key: 'P1', label: 'P1 · critical' },
    { key: 'P2', label: 'P2 · high' },
    { key: 'P3', label: 'P3 · normal' },
  ],
};

/**
 * Applies the shared test-case set's release state to the story (TODO(backend): the server does this
 * when a set is accepted or changed). Released: the Test cases stage is accepted, UAT sign-off opens
 * and automation is drafted from the included cases, in parallel. A change after acceptance
 * withdraws the release: the stage needs review again and any sign-off needs renewal.
 */
export function reconcileWorkspace(storyId: string): StoryWorkspace | null {
  const ws = workspaces[storyId];
  const set = getSet(storyId);
  if (!ws || !set) return ws ?? null;
  const r = setRelease(set);
  const stage = ws.stages.test_cases;
  if (r.released && r.acceptance && stage.status !== 'accepted') {
    ws.stages.test_cases = { status: 'accepted', acceptedBy: r.acceptance.by, acceptedAt: r.acceptance.at };
    if (ws.uat === 'not_ready') ws.uat = 'ready';
    ws.story = { ...ws.story, testCount: r.included.length, status: ws.uat === 'signed_off' ? ws.story.status : 'ready_for_uat', aiStage: 'automation' };
    if (ws.stages.automation.status === 'not_started') {
      ws.stages.automation = { status: 'needs_review', generation: gen(storyId, 'automation', 1, new Date().toISOString()) };
      ws.automation = draftAutomation(storyId, r.included);
    }
  } else if (!r.released && stage.status === 'accepted') {
    ws.stages.test_cases = { status: 'needs_review' };
    if (ws.uat === 'ready') ws.uat = 'not_ready';
    if (ws.uat === 'signed_off') {
      ws.uat = 'renewal';
      if (ws.story.signoff) ws.story = { ...ws.story, signoff: { ...ws.story.signoff, changedAfterSignoff: true } };
    }
    ws.story = { ...ws.story, status: 'awaiting_review', aiStage: 'test_cases' };
  }
  return structuredClone(ws);
}

// TODO(backend): GET /api/apps/{appId}/acceptance/stories/{storyId}/workspace
export const fetchStoryWorkspace = (storyId: string) => mock(reconcileWorkspace(storyId));
export const fetchTagVocabulary = () => mock(tagVocabulary);

/** Cases the shared set releases (rejected ones excluded); automation and tags are drafted from these. */
function includedCases(storyId: string): TestCase[] {
  const set = getSet(storyId);
  return set ? setRelease(set).included : [];
}

const NEXT: Partial<Record<StageKey, StageKey>> = { story_analysis: 'test_cases', automation: 'test_tagging' };

/**
 * TODO(backend): POST /api/apps/{appId}/acceptance/stories/{storyId}/stages/{stage}/accept.
 * Server re-checks the feedback gate, records the acceptor and queues the next stage's
 * generation as a workflow job. Here the next output is drafted locally. Test cases are accepted
 * as a set through the shared store, which applies the same completion predicate as Review.
 */
export async function acceptStage(storyId: string, stage: StageKey, userName: string, edits?: { tags?: TagSuggestion[] }): Promise<StoryWorkspace> {
  const ws = workspaces[storyId];
  if (stage === 'test_cases') {
    await acceptSet(storyId, userName);
    return mock(reconcileWorkspace(storyId)!, 300);
  }
  const now = new Date().toISOString();
  ws.stages[stage] = { ...ws.stages[stage], status: 'accepted', acceptedBy: userName, acceptedAt: now };
  if (stage === 'test_tagging' && edits?.tags) ws.tags = edits.tags;
  const next = NEXT[stage];
  const included = includedCases(storyId);
  if (next && ws.analysis) {
    if (next === 'test_cases') {
      ws.stages.test_cases = { status: 'needs_review' };
      const cases = replaceCases(storyId, draftTestCases(storyId, ws.analysis)).cases;
      ws.story = { ...ws.story, aiStage: 'test_cases', criteriaTested: ws.analysis.criteria.length, testCount: cases.length, status: 'awaiting_review' };
    } else {
      ws.stages[next] = { status: 'needs_review', generation: gen(storyId, next, 1, now) };
    }
    if (next === 'test_tagging') ws.tags = draftTags(included);
  }
  return mock(ws, 600);
}

/**
 * TODO(backend): POST .../stages/{stage}/regenerate { instruction }. A regenerated output is a
 * new generation with outputRevision + 1, so it needs its own rating.
 */
export async function regenerateStage(storyId: string, stage: StageKey, instruction: string): Promise<StoryWorkspace> {
  const ws = workspaces[storyId];
  const note = instruction.trim() || undefined;
  if (stage === 'test_cases' && ws.analysis) {
    replaceCases(storyId, draftTestCases(storyId, ws.analysis));
    ws.stages.test_cases = { status: 'needs_review', instruction: note };
    return mock(ws, 900);
  }
  const prev = ws.stages[stage].generation;
  const rev = (prev?.outputRevision ?? 0) + 1;
  ws.stages[stage] = { status: 'needs_review', generation: gen(storyId, stage, rev, new Date().toISOString()), instruction: note };
  const included = includedCases(storyId);
  if (stage === 'automation') ws.automation = draftAutomation(storyId, included);
  if (stage === 'test_tagging') ws.tags = draftTags(included);
  return mock(ws, 900);
}
