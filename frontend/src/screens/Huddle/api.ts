import { mock } from '../../api/useApi';
import { fetchSession } from '../../api/session';

export type DecisionType =
  | 'override'
  | 'disputed_gap'
  | 'context_correction'
  | 'signoff'
  | 'undocumented_journey'
  | 'source_conflict';

export type DecisionStatus = 'pending' | 'accepted' | 'rejected';

export type AvatarTone = 'dark' | 'accent' | 'muted' | 'slate';

export interface Person {
  userId: string;
  name: string;
  initials: string;
  role: string;
  tone: AvatarTone;
}

export interface Comment {
  userId: string;
  text: string;
  /** Display form, e.g. "2h ago". */
  at: string;
}

/** Mirror of the `decisions` collection. */
export interface Decision {
  _id: string;
  release?: string;
  type: DecisionType;
  /** Requirement the decision is about, shown in mono before the subject. */
  frId?: string;
  /** Jira story the decision is about (e.g. a UAT sign-off), shown in mono before the subject. */
  storyId?: string;
  /** Story revision a sign-off applies to; a newer story revision needs a renewed sign-off. */
  storyRevision?: number;
  subject: string;
  /** Short title used in the list. */
  listTitle: string;
  /** Where the decision came from, e.g. "From Journeys · intended, or a defect?". */
  origin?: string;
  proposedBy: string;
  reason: string;
  impact: string;
  status: DecisionStatus;
  /** Display age, e.g. "5h" or "28 Oct". */
  age: string;
  comments: Comment[];
}

export interface ActivityItem {
  id: string;
  userId: string;
  text: string;
  at: string;
}

export interface HuddleData {
  application: string;
  release: string;
  /** Total decisions on the server for this release. */
  decisions: Decision[];
  activity: ActivityItem[];
  people: Person[];
  currentUserId: string;
  dataAsOf: string;
}

export const DECISION_TYPE_LABEL: Record<DecisionType, string> = {
  override: 'Override',
  disputed_gap: 'Disputed gap',
  context_correction: 'Context correction',
  signoff: 'Sign-off',
  undocumented_journey: 'Undocumented journey',
  source_conflict: 'Source conflict',
};

// TODO(backend): GET /api/apps/{appId}/decisions, GET /api/apps/{appId}/activity (audit log)
// and GET /api/apps/{appId}/huddle/people. Sample names are placeholders from the design kit.
const sample: Omit<HuddleData, 'currentUserId' | 'application' | 'release'> = {
  dataAsOf: 'today 10:45',
  people: [
    { userId: 'u-pn', name: 'Priya N.', initials: 'PN', role: 'QA', tone: 'dark' },
    { userId: 'u-mk', name: 'Meera K.', initials: 'MK', role: 'UAT', tone: 'muted' },
    { userId: 'u-ri', name: 'Rohan I.', initials: 'RI', role: 'Product owner', tone: 'accent' },
    { userId: 'u-as', name: 'Arjun S.', initials: 'AS', role: 'Developer', tone: 'slate' },
  ],
  decisions: [
    {
      _id: 'D-114', type: 'undocumented_journey', listTitle: 'Undocumented journey: Export refunds to CSV',
      subject: 'Export refunds to CSV is not described by any requirement',
      origin: 'From Journeys · intended, or a defect?', proposedBy: 'u-pn',
      reason: 'The crawl found Maker, Checker and Auditor can export refunds to CSV. No requirement covers it.',
      impact: 'A requirement is drafted and the journey becomes a coverage target', status: 'pending', age: '5h', comments: [],
    },
    {
      _id: 'D-113', type: 'override', frId: 'FR-0231', listTitle: 'FR-0231 out of scope for 26.11',
      subject: 'Multi-currency fee rounding is out of scope for 26.11', proposedBy: 'u-ri',
      reason: 'Ships in 26.12, flag stays off in 26.11', impact: '1 gap leaves 26.11 and returns in 26.12',
      status: 'pending', age: '2h',
      comments: [
        { userId: 'u-ri', at: '2h ago', text: 'Feature flag fees.halfEven stays off for 26.11. Linked PAY-1503 moves to the 26.12 fix version.' },
        { userId: 'u-mk', at: '1h ago', text: 'Fine for UAT, as long as it shows up in the 26.12 acceptance scope.' },
      ],
    },
    {
      _id: 'D-118', type: 'signoff', storyId: 'PAY-1499', storyRevision: 1, listTitle: 'UAT sign-off: PAY-1499 settlement file interchange fees',
      subject: 'UAT sign-off for the settlement file interchange fees story', origin: 'From Review · 11 test cases accepted',
      proposedBy: 'u-pn', reason: 'All 6 acceptance criteria have accepted test cases (revision 1 of the story).',
      impact: 'The 11 accepted test cases become eligible for the Octane import sheet', status: 'pending', age: '3h', comments: [],
    },
    {
      _id: 'D-117', type: 'signoff', storyId: 'PAY-1493', storyRevision: 2, listTitle: 'UAT sign-off: PAY-1493 monthly fee summary',
      subject: 'UAT sign-off for the monthly fee summary download story', origin: 'From Review · 10 test cases accepted',
      proposedBy: 'u-pn', reason: 'All 6 acceptance criteria have accepted test cases (revision 2 of the story).',
      impact: 'The 10 accepted test cases become eligible for the Octane import sheet', status: 'pending', age: '6h', comments: [],
    },
    {
      _id: 'D-116', type: 'signoff', storyId: 'PAY-1479', storyRevision: 4, listTitle: 'Renew UAT sign-off: PAY-1479 payout hold',
      subject: 'Renew UAT sign-off: the story changed after it was signed off', origin: 'From Acceptance · story revision 4 replaces 3',
      proposedBy: 'u-pn', reason: 'Arjun S. signed off revision 3. Revision 4 changed an acceptance criterion, so that sign-off no longer applies.',
      impact: 'The 4 test cases are eligible for export again at revision 4', status: 'pending', age: '1d', comments: [],
    },
    {
      _id: 'D-112', type: 'signoff', storyId: 'PAY-1495', storyRevision: 3, listTitle: 'UAT sign-off: PAY-1495 acquirer retry',
      subject: 'UAT sign-off for retry on acquirer timeout', origin: 'From Review · 9 test cases accepted',
      proposedBy: 'u-pn', reason: 'All 5 acceptance criteria have accepted test cases (revision 3 of the story).',
      impact: 'The 9 accepted test cases are eligible for the Octane import sheet', status: 'accepted', age: 'Today 10:12', comments: [],
    },
    {
      _id: 'D-108', type: 'signoff', storyId: 'PAY-1479', storyRevision: 3, listTitle: 'UAT sign-off: PAY-1479 payout hold (revision 3)',
      subject: 'UAT sign-off for payout hold after a fraud flag, revision 3', origin: 'From Review · 4 test cases accepted',
      proposedBy: 'u-pn', reason: 'All 3 acceptance criteria had accepted test cases at revision 3.',
      impact: 'Superseded: the story is now at revision 4', status: 'accepted', age: '30 Oct', comments: [],
    },
    {
      _id: 'D-109', type: 'disputed_gap', frId: 'FR-0207', listTitle: 'FR-0207 covered by manual case TC-1180',
      subject: 'Covered by manual case TC-1180', proposedBy: 'u-pn',
      reason: 'TC-1180 runs every release in the manual regression pack', impact: 'The gap closes as manually covered',
      status: 'accepted', age: 'Yesterday', comments: [],
    },
    {
      _id: 'D-104', type: 'context_correction', listTitle: 'Refund limit is AED 10,000, not 5,000',
      subject: 'Refund limit is AED 10,000, not 5,000', proposedBy: 'u-mk',
      reason: 'The 2024 ops manual is out of date; the limit changed in 26.08', impact: 'App context is corrected; 2 drafted tests are regenerated',
      status: 'accepted', age: '28 Oct', comments: [],
    },
    {
      _id: 'D-101', type: 'override', listTitle: 'Skip chargeback tests this release',
      subject: 'Skip chargeback tests this release', proposedBy: 'u-as',
      reason: 'No GBP chargeback data in SIT-2', impact: 'Chargeback tests are excluded from the 26.11 run',
      status: 'rejected', age: '27 Oct', comments: [],
    },
  ],
  activity: [
    { id: 'a1', userId: 'u-pn', text: 'Priya N. accepted TC-0218-01', at: '10:42' },
    { id: 'a2', userId: 'u-mk', text: 'Meera K. signed off PAY-1495', at: '10:12' },
    { id: 'a3', userId: 'u-ri', text: 'Rohan I. proposed an override on FR-0231', at: '09:55' },
    { id: 'a4', userId: 'u-as', text: 'Arjun S. corrected app context: retry timeout is 8s', at: '09:20' },
  ],
};

export const fetchHuddle = async (): Promise<HuddleData> => {
  const [session, data] = await Promise.all([fetchSession(), mock(sample)]);
  // TODO(backend): the signed-in user's id comes from the session.
  return {
    ...data,
    application: session.application.name,
    release: session.application.release,
    currentUserId: data.people.find((p) => p.name === session.user.name)?.userId ?? data.people[0].userId,
  };
};
