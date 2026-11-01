import { useSyncExternalStore } from 'react';
import { feedbackVersion, getCurrentFeedback, getFeedbackHistory, isCurrentComplete, subscribe, type Generation } from './api';

/** All saved ratings for a generation (one per revision, oldest first), kept in step with the store. */
export function useFeedbackHistory(generationId: string) {
  return useSyncExternalStore(subscribe, () => getFeedbackHistory(generationId));
}

/**
 * Gate for moving outputs to the next stage: every listed generation must be rated at its
 * current output revision, with a comment when below 4 stars. A rating for an earlier revision
 * is history, not approval. `reason` is ready to show beside a disabled action.
 */
export function useFeedbackGate(generations: Generation[]) {
  useSyncExternalStore(subscribe, feedbackVersion);
  const missing = generations.filter((g) => !isCurrentComplete(g));
  return { ready: missing.length === 0, missing, reason: gateReason(missing) };
}

/** Why the listed generations cannot move on yet; empty when they can. */
export function gateReason(missing: Generation[]): string {
  if (missing.length === 0) return '';
  if (missing.length > 1) return `Rate ${missing.length} outputs first`;
  const g = missing[0];
  const rated = getFeedbackHistory(g.generationId).filter((f) => f.outputRevision !== g.outputRevision);
  if (!getCurrentFeedback(g) && rated.length) {
    return `Rate revision ${g.outputRevision} first: your rating was for revision ${rated[rated.length - 1].outputRevision}, which has changed`;
  }
  return 'Rate this output first';
}
