import type { ReviewItem } from './api';

export const KIND_LABEL: Record<ReviewItem['kind'], string> = { regression_pr: 'Regression', acceptance: 'Acceptance', test_fix_pr: 'Test fix' };

/** "Regression · PR #212" or "Acceptance · PAY-1490". */
export const kindLine = (item: ReviewItem) =>
  `${KIND_LABEL[item.kind]} · ${item.pr ? `PR #${item.pr.number}` : item.ref.storyId ?? item.requirement.id}`;
