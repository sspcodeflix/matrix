import type { StageKey } from './api';

export const STAGE_META: Record<StageKey, { title: string; output: string; accept: string; acceptedNote: string; feedbackTitle: string }> = {
  story_analysis: {
    title: 'Story analysis', output: 'Refined story, testable criteria, questions and sources',
    accept: 'Accept analysis and write test cases', acceptedNote: 'Test cases are written from this analysis.', feedbackTitle: 'Rate this story analysis',
  },
  test_cases: {
    title: 'Test cases', output: 'Manual test cases with ordered steps and expected results',
    accept: 'Accept test cases and write automation', acceptedNote: 'Accepted test cases go to UAT sign-off and automation.', feedbackTitle: 'Rate this test case set',
  },
  automation: {
    title: 'Automation', output: 'Automation for the accepted test cases, as a pull request',
    accept: 'Accept automation and suggest tags', acceptedNote: 'Merging the PR happens in GitHub; Harness runs the tests from Git.', feedbackTitle: 'Rate this automation',
  },
  test_tagging: {
    title: 'Tagging', output: 'Suite and priority tags per test, with a reason',
    accept: 'Approve tags', acceptedNote: 'Approved tags are committed to the PR branch.', feedbackTitle: 'Rate these tag suggestions',
  },
};

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

