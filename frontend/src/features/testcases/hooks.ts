import { useSyncExternalStore } from 'react';
import { feedbackVersion, subscribe as subscribeFeedback } from '../feedback/api';
import { caseStoreVersion, getSet, setRelease, subscribe } from './api';

/** Re-renders on any test-case or feedback change; returns the store version. */
export function useTestCaseStore() {
  useSyncExternalStore(subscribeFeedback, feedbackVersion);
  return useSyncExternalStore(subscribe, caseStoreVersion);
}

/** A story's shared test-case set and its release state, kept in step with both stores. */
export function useTestCaseSet(storyId: string | undefined) {
  useTestCaseStore();
  const set = storyId ? getSet(storyId) : undefined;
  return { set, release: set ? setRelease(set) : undefined };
}
