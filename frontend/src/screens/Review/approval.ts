import type { ApprovalBinding, ReviewItem } from './api';

/**
 * State of an "Accept tests and approve PR" request, held by the Review screen so it survives
 * switching items and closing the dialog.
 */
export type ApprovalStatus =
  | { kind: 'pending'; binding: ApprovalBinding }
  | { kind: 'approved'; message: string }
  | { kind: 'stale'; message: string }
  | { kind: 'failed'; message: string };

/** Captures the exact item, commit and test revisions the reviewer is approving. */
export function bindApproval(item: ReviewItem): ApprovalBinding {
  return {
    itemId: item._id,
    headCommit: item.pr?.headCommit ?? '',
    tests: item.tests.map((t) => ({ _id: t._id, revision: t.revision, state: t.state })),
  };
}

/** True when the item still has the commit, tests, revisions and decisions that were bound. */
export function isBindingCurrent(item: ReviewItem, b: ApprovalBinding): boolean {
  if ((item.pr?.headCommit ?? '') !== b.headCommit) return false;
  if (item.tests.length !== b.tests.length) return false;
  return b.tests.every((bt) => {
    const t = item.tests.find((x) => x._id === bt._id);
    return !!t && t.revision === bt.revision && t.state === bt.state;
  });
}

/** Applies a confirmed approval: the bound tests become accepted and the PR approved at the bound commit. */
export function applyApproval(item: ReviewItem, b: ApprovalBinding): ReviewItem {
  return {
    ...item,
    tests: item.tests.map((t) => (t.state === 'rejected' || !b.tests.some((bt) => bt._id === t._id) ? t : { ...t, state: 'accepted' as const, acceptedRevision: undefined })),
    pr: item.pr ? { ...item.pr, approval: 'approved' } : item.pr,
  };
}

export const toAccept = (b: ApprovalBinding) => b.tests.filter((t) => t.state !== 'accepted' && t.state !== 'rejected').length;
