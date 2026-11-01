import { generationOfSet, type TestCase, type TestCaseSet, type TestState, type RejectionReason } from '../../features/testcases';
import { outputRevisionFor, type Generation } from '../../features/feedback';
import { mock } from '../../api/useApi';

export { REJECTION_REASONS, type RejectionReason, type TestState } from '../../features/testcases';

export interface ReviewTest {
  _id: string;
  title: string;
  covers: string;
  steps: string[];
  revision: number;
  state: TestState;
  /** Revision that was accepted, when acceptance is now stale. */
  acceptedRevision?: number;
  rejection?: { reason: RejectionReason; note: string };
}

export interface DiffFile {
  path: string;
  added: number;
  removed: number;
  lines: { kind: 'add' | 'del' | 'ctx'; text: string }[];
}

export interface DryRunResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'blocked';
  durationSec: number;
}

export type QueueKey = 'mine' | 'team' | 'waiting';

/** docs/DATA_MODEL.md `review_items` joined with its requirement, tests, PR and dry run. */
export interface ReviewItem {
  _id: string;
  queue: QueueKey;
  kind: 'regression_pr' | 'acceptance' | 'test_fix_pr';
  appName: string;
  title: string;
  /** e.g. "FR-0218 · 3 tests" */
  summary: string;
  age: string;
  assignee: string;
  writtenAgo: string;
  ref: { pr?: number; storyId?: string; frId?: string; runId?: string };
  requirement: { id: string; title: string; text: string; sourceLabel: string; sourceUrl: string };
  /** Pull request on a matrix/* branch; acceptance items have none. */
  pr?: { number: number; repo: string; branch: string; headCommit: string; url: string; approval: 'none' | 'approved' | 'stale' };
  tests: ReviewTest[];
  changes: DiffFile[];
  dryRun?: { harnessExecId: string; runId: string; trigger: string; results: DryRunResult[]; /** ISO time Harness reported the results. */ reportedAt: string };
  /** ISO time this item's data (tests, PR head, decisions) was captured; pinned as "data as of" on exports. */
  capturedAt: string;
  writtenWith: string[];
  mlflowUrl: string;
}

export interface ReviewQueue {
  items: ReviewItem[];
  /** Open question 13: whether Matrix may post the PR approval as the user. */
  canPostApproval: boolean;
  snapshot: string;
}

const steps = (...s: string[]) => s;

/** Sample capture times relative to today (UTC hours), so "today 11:40 (GST)" stays true in the mock. */
const at = (daysAgo: number, hourUtc: number, minute = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d.toISOString();
};
const QUEUE_CAPTURED = at(0, 7, 40);

// TODO(backend): GET /api/apps/{appId}/review-items?queue=mine|team|waiting. Sample names are placeholders.
const sample: ReviewQueue = {
  canPostApproval: true,
  snapshot: 'Review queue as of today 11:40 (GST)',
  items: [
    {
      _id: 'rv-212', queue: 'mine', kind: 'regression_pr', appName: 'Payments Hub', title: 'Acquirer retry automation',
      summary: 'FR-0218 · 3 tests', age: '2h', assignee: 'Priya N.', writtenAgo: '2h ago',
      ref: { pr: 212, frId: 'FR-0218' },
      requirement: {
        id: 'FR-0218', title: 'Retry on acquirer timeout', sourceLabel: 'Confluence', sourceUrl: '#confluence-fr-0218',
        text: 'If the acquirer does not respond within 8 seconds, retry the authorisation up to 3 times. After the third timeout, decline with reason TIMEOUT and notify the merchant.',
      },
      pr: { number: 212, repo: 'pay-hub-automation', branch: 'matrix/fr-0218-acquirer-retry', headCommit: 'e41c9a7', url: '#github-pr-212', approval: 'none' },
      tests: [
        { _id: 'TC-0218-01', title: 'Retries 3 times, then declines', covers: 'maximum of 3 retries', revision: 1, state: 'accepted', steps: steps('Stub the acquirer to time out on every attempt', 'Authorise AED 250 on a test card', 'Expect DECLINED with reason TIMEOUT after 3 retries') },
        { _id: 'TC-0218-02', title: 'Succeeds on the second attempt', covers: 'retry after a timeout', revision: 1, state: 'draft', steps: steps('Stub the acquirer to time out once', 'Authorise AED 250 on a test card', 'Expect APPROVED after 2 attempts') },
        { _id: 'TC-0218-03', title: 'Merchant is notified on the final decline', covers: 'merchant notification', revision: 1, state: 'draft', steps: steps('Stub the acquirer to time out on every attempt', 'Authorise AED 90 on a test card', 'Expect one merchant notification with reason TIMEOUT') },
      ],
      changes: [
        {
          path: 'src/test/java/payments/AcquirerRetryTest.java', added: 118, removed: 0,
          lines: [
            { kind: 'add', text: '@Tag("FR-0218") @Tag("matrix")' },
            { kind: 'add', text: 'class AcquirerRetryTest extends PaymentsBaseTest {' },
            { kind: 'add', text: '  @Test void retriesThreeTimesThenDeclines() {' },
            { kind: 'add', text: '    acquirer.timeoutAlways();' },
            { kind: 'add', text: '    var result = authorise(card("TEST-VISA-01"), aed(250));' },
            { kind: 'add', text: '    assertThat(result.status()).isEqualTo(DECLINED);' },
            { kind: 'add', text: '    assertThat(acquirer.attempts()).isEqualTo(4);' },
            { kind: 'add', text: '  }' },
          ],
        },
        {
          path: 'src/test/java/payments/pages/AcquirerStub.java', added: 24, removed: 6,
          lines: [
            { kind: 'ctx', text: 'public class AcquirerStub {' },
            { kind: 'del', text: '  public void timeout() { delayMs = 9000; }' },
            { kind: 'add', text: '  public void timeoutOnce() { failuresLeft = 1; delayMs = 9000; }' },
            { kind: 'add', text: '  public void timeoutAlways() { failuresLeft = Integer.MAX_VALUE; delayMs = 9000; }' },
            { kind: 'ctx', text: '}' },
          ],
        },
      ],
      dryRun: {
        harnessExecId: '4830', runId: 'mx-run-0218-01', trigger: 'PR opened', reportedAt: at(0, 6, 5),
        results: [
          { testId: 'TC-0218-01', name: 'retriesThreeTimesThenDeclines', status: 'passed', durationSec: 38 },
          { testId: 'TC-0218-02', name: 'succeedsOnSecondAttempt', status: 'passed', durationSec: 21 },
          { testId: 'TC-0218-03', name: 'notifiesMerchantOnFinalDecline', status: 'passed', durationSec: 40 },
        ],
      },
      writtenWith: ['selenium-java-pageobject v3', 'payments-hub-conventions v1'],
      mlflowUrl: '#mlflow-trace-212', capturedAt: QUEUE_CAPTURED,
    },
    {
      _id: 'rv-1490', queue: 'mine', kind: 'acceptance', appName: 'Payments Hub', title: 'Refund status in merchant portal',
      summary: 'Test cases', age: '4h', assignee: 'Priya N.', writtenAgo: '4h ago',
      ref: { storyId: 'PAY-1490' },
      requirement: {
        id: 'PAY-1490', title: 'Merchant sees refund status in the portal', sourceLabel: 'Jira', sourceUrl: '#jira-pay-1490',
        text: 'Merchants need to see where a refund is: requested, processing, refunded or failed. Failed refunds show a reason, and the status updates without a reload.',
      },
      // Test cases come from the story's shared set (features/testcases), not from this item.
      tests: [],
      changes: [],
      writtenWith: [], // from the shared set
      mlflowUrl: '#mlflow-trace-1490', capturedAt: QUEUE_CAPTURED,
    },
    {
      _id: 'rv-209', queue: 'mine', kind: 'test_fix_pr', appName: 'Payments Hub', title: 'SettlementPage locator fix',
      summary: 'From run #4821', age: '1d', assignee: 'Priya N.', writtenAgo: '1d ago',
      ref: { pr: 209, runId: '4821', frId: 'FR-0144' },
      requirement: {
        id: 'FR-0144', title: 'Settlement summary page', sourceLabel: 'Confluence', sourceUrl: '#confluence-fr-0144',
        text: 'The settlement page lists each batch with its cut-off time, total and status. Run #4821 failed because the batch table locator changed.',
      },
      pr: { number: 209, repo: 'pay-hub-automation', branch: 'matrix/fix-settlementpage-locator', headCommit: '7d03b19', url: '#github-pr-209', approval: 'none' },
      tests: [
        { _id: 'TC-0144-02', title: 'Settlement batches load with totals', covers: 'batch list', revision: 3, state: 'draft', steps: steps('Open the settlement page for yesterday', 'Expect every batch row to show cut-off, total and status') },
      ],
      changes: [
        {
          path: 'src/test/java/payments/pages/SettlementPage.java', added: 2, removed: 2,
          lines: [
            { kind: 'del', text: '  private By batchRows = By.cssSelector("table.batches tr");' },
            { kind: 'add', text: '  private By batchRows = By.cssSelector("[data-testid=settlement-batch-row]");' },
          ],
        },
      ],
      dryRun: {
        harnessExecId: '4833', runId: 'mx-run-0144-07', trigger: 'PR opened', reportedAt: at(1, 9, 30),
        results: [{ testId: 'TC-0144-02', name: 'settlementBatchesLoadWithTotals', status: 'passed', durationSec: 17 }],
      },
      writtenWith: ['selenium-java-pageobject v3'],
      mlflowUrl: '#mlflow-trace-209', capturedAt: QUEUE_CAPTURED,
    },
    ...['Chargeback ledger automation', 'FX fee rounding automation', 'Payout hold regression', 'Refund API contract tests', 'BIN fallback automation'].map((title, i): ReviewItem => ({
      _id: `rv-team-${i}`, queue: 'team', kind: 'regression_pr', appName: 'Payments Hub', title,
      summary: `FR-03${10 + i} · ${i + 2} tests`, age: `${i + 1}d`, assignee: ['Arjun S.', 'Leena M.', 'Arjun S.', 'Omar F.', 'Leena M.'][i], writtenAgo: `${i + 1}d ago`,
      ref: { pr: 214 + i, frId: `FR-03${10 + i}` },
      requirement: { id: `FR-03${10 + i}`, title, sourceLabel: 'Confluence', sourceUrl: `#confluence-fr-03${10 + i}`, text: 'Requirement text is loaded from Confluence through Knowledge OS.' },
      pr: { number: 214 + i, repo: 'pay-hub-automation', branch: `matrix/fr-03${10 + i}`, headCommit: `a${i}c4f2e`, url: `#github-pr-${214 + i}`, approval: 'none' },
      tests: Array.from({ length: i + 2 }, (_, t) => ({
        _id: `TC-03${10 + i}-0${t + 1}`, title: `Scenario ${t + 1} for ${title.toLowerCase()}`, covers: `criterion ${t + 1}`, revision: 1,
        state: 'draft' as const, steps: steps('Prepare test data', 'Perform the action', 'Check the expected result'),
      })),
      changes: [],
      writtenWith: ['selenium-java-pageobject v3', 'payments-hub-conventions v1'],
      mlflowUrl: '#mlflow', capturedAt: QUEUE_CAPTURED,
    })),
    {
      _id: 'rv-205', queue: 'waiting', kind: 'regression_pr', appName: 'Payments Hub', title: 'Merchant notification automation',
      summary: 'FR-0221 · 2 tests', age: '2d', assignee: 'Leena M.', writtenAgo: '2d ago',
      ref: { pr: 205, frId: 'FR-0221' },
      requirement: { id: 'FR-0221', title: 'Merchant notification on decline', sourceLabel: 'Confluence', sourceUrl: '#confluence-fr-0221', text: 'Notify the merchant by webhook within 30 seconds of a final decline.' },
      pr: { number: 205, repo: 'pay-hub-automation', branch: 'matrix/fr-0221-notify', headCommit: '0b9e113', url: '#github-pr-205', approval: 'stale' },
      tests: [
        { _id: 'TC-0221-01', title: 'Webhook sent within 30 seconds', covers: 'notification timing', revision: 2, acceptedRevision: 1, state: 'stale', steps: steps('Decline a payment', 'Expect one webhook within 30 seconds') },
        { _id: 'TC-0221-02', title: 'Webhook carries the decline reason', covers: 'notification payload', revision: 1, state: 'accepted', steps: steps('Decline a payment with reason TIMEOUT', 'Expect reason TIMEOUT in the webhook') },
      ],
      changes: [],
      writtenWith: ['selenium-java-pageobject v3'],
      mlflowUrl: '#mlflow-trace-205', capturedAt: QUEUE_CAPTURED,
    },
    {
      _id: 'rv-1488', queue: 'waiting', kind: 'acceptance', appName: 'Payments Hub', title: 'Duplicate payment detection',
      summary: 'Test cases · UAT', age: '3d', assignee: 'Meera K.', writtenAgo: '3d ago',
      ref: { storyId: 'PAY-1488' },
      requirement: { id: 'PAY-1488', title: 'Duplicate payment detection within 60 seconds', sourceLabel: 'Jira', sourceUrl: '#jira-pay-1488', text: 'Flag a second identical payment from the same card within 60 seconds as a possible duplicate.' },
      tests: [],
      changes: [],
      writtenWith: [], // from the shared set
      mlflowUrl: '#mlflow-trace-1488', capturedAt: QUEUE_CAPTURED,
    },
  ],
};

export const fetchReviewQueue = () => mock(sample);

// TODO(backend): PATCH /api/review-items/{id}/tests/{testId} { state, rejection?, steps? }; rejections feed skill proposals.
export const saveTestDecision = (itemId: string, test: ReviewTest) => mock({ itemId, test });

/** The exact revisions a reviewer saw when they asked for approval. */
export interface ApprovalBinding {
  itemId: string;
  /** PR head commit the GitHub review is posted against (`commit_id`). */
  headCommit: string;
  tests: { _id: string; revision: number; state: TestState }[];
}

export interface ApprovalResponse {
  itemId: string;
  approvedCommit: string;
  /** PR head at the time the server finished. Differs from `approvedCommit` when a commit landed meanwhile. */
  headCommit: string;
  approvedAt: string;
}

/**
 * Mock switches for the approval request, for demos and browser checks. In dev they are also on
 * `window.__matrixReviewMock`, e.g. `__matrixReviewMock.failApproval = true`.
 */
export const reviewMock = {
  /** The request fails (e.g. GitHub or the credential broker is unavailable). */
  failApproval: false,
  /** A new commit lands on the PR branch while the approval is in flight. */
  newCommitDuringApproval: false,
  /** Request latency in ms. */
  approvalLatencyMs: 600,
};
if (import.meta.env.DEV) (window as unknown as { __matrixReviewMock: typeof reviewMock }).__matrixReviewMock = reviewMock;

// TODO(backend): POST /api/review-items/{id}/approve { headCommit, tests: [{_id, revision}] }. Accepts the
// bound test revisions and posts a GitHub review at `headCommit` as the user through the credential broker,
// only when policy allows (open question 13). The server rejects the request (409) when the bound
// revisions are no longer current. Never merges.
export const approvePullRequest = (binding: ApprovalBinding): Promise<ApprovalResponse> => {
  const { failApproval, newCommitDuringApproval, approvalLatencyMs } = reviewMock;
  if (failApproval) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GitHub did not accept the review (HTTP 502 from the credential broker).')), approvalLatencyMs),
    );
  }
  return mock(
    {
      itemId: binding.itemId,
      approvedCommit: binding.headCommit,
      headCommit: newCommitDuringApproval ? 'f3a7c20' : binding.headCommit,
      approvedAt: new Date().toISOString(),
    },
    approvalLatencyMs,
  );
};

/** An acceptance item whose test cases live in the story's shared set. */
export const storyOf = (item: ReviewItem) => (item.kind === 'acceptance' ? item.ref.storyId : undefined);

/** One shared test case in the Review row shape. Steps read "Action. Expected: result". */
export function toReviewTest(c: TestCase): ReviewTest {
  return {
    _id: c._id, title: c.title, covers: c.criterionId, revision: c.revision, state: c.state,
    acceptedRevision: c.acceptedRevision, rejection: c.rejection,
    steps: c.steps.map((s) => `${s.action.replace(/\.$/, '')}. Expected: ${s.expected}`),
  };
}

/** Writes a Review decision or edit back onto the shared case. */
export function fromReviewTest(c: TestCase, t: ReviewTest): TestCase {
  const same = t.steps.join('\n') === toReviewTest(c).steps.join('\n');
  return {
    ...c, title: t.title, state: t.state, revision: t.revision, acceptedRevision: t.acceptedRevision, rejection: t.rejection,
    steps: same ? c.steps : t.steps.map((line, i) => {
      const m = /^(.*?)\.?\s+Expected:\s*(.*)$/i.exec(line);
      return { seq: i + 1, action: m ? m[1] : line, expected: m ? m[2] : '' };
    }),
  };
}

/** The item as shown: acceptance items carry their story's shared cases and skills. */
export function withSet(item: ReviewItem, set: TestCaseSet | undefined): ReviewItem {
  if (!set) return item;
  const n = set.cases.length;
  return { ...item, tests: set.cases.map(toReviewTest), summary: `${n} test ${n === 1 ? 'case' : 'cases'}`, writtenWith: set.skills };
}

/**
 * The AI generation this item reviews, for required feedback (docs/FEEDBACK.md). For a story's test
 * cases it is the shared set's generation, so a rating counts in both views. Otherwise the output
 * identity is the PR head commit and every test revision: a new commit or an edited test is a new
 * revision that needs its own rating.
 */
export function generationOf(item: ReviewItem, set?: TestCaseSet): Generation {
  if (set) return generationOfSet(set);
  const generationId = `gen-${item._id}`;
  const outputHash = `commit ${item.pr?.headCommit ?? 'none'}: ${item.tests.map((t) => `${t._id}@${t.revision}`).join(',')}`;
  return {
    generationId,
    stage: item.kind === 'acceptance' ? 'test_cases' : 'regression_automation',
    subjectId: item.requirement.id,
    outputRevision: outputRevisionFor(generationId, outputHash),
    outputHash,
    // TODO(backend): the generation's MLflow trace ID comes with the review item.
    mlflowTraceId: `tr-${item._id}`,
    skills: item.writtenWith,
    model: 'Gemini via Tachyon',
    generatedAt: item.capturedAt,
  };
}
