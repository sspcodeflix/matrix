import { mock } from '../../api/useApi';

/*
 * Feedback on AI-generated content (docs/FEEDBACK.md).
 * Every generation is rated 1–5 with a one-line comment; below 4 stars the comment is
 * required. Feedback is stored with the generation and logged to its MLflow trace.
 */

export type GenerationStage = 'story_analysis' | 'test_cases' | 'automation' | 'test_tagging' | 'regression_automation';

/** One AI output that can be rated. A regenerated output is a new generation. */
export interface Generation {
  generationId: string;
  stage: GenerationStage;
  /** Story or requirement the output belongs to, e.g. PAY-1490. */
  subjectId: string;
  /** Revision and hash of the exact output rated. */
  outputRevision: number;
  outputHash: string;
  /** MLflow trace of the generation; feedback is attached to it. */
  mlflowTraceId: string;
  /** Skill versions and model used, shown so feedback is read in context. */
  skills: string[];
  model: string;
  generatedAt: string;
}

export interface Feedback {
  generationId: string;
  outputRevision: number;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  /** The user's own words before an AI refinement, kept for evaluation. */
  commentOriginal?: string;
  commentRefinedByAi: boolean;
  userId: string;
  updatedAt: string;
}

/** Below this rating a comment is required. */
export const COMMENT_REQUIRED_BELOW = 4;
/** One line: enough for a specific reason, short enough to read in a list. */
export const COMMENT_MAX = 200;

export function isComplete(f: Pick<Feedback, 'rating' | 'comment'> | undefined): boolean {
  if (!f || !f.rating) return false;
  return f.rating >= COMMENT_REQUIRED_BELOW || f.comment.trim().length > 0;
}

// Local store standing in for the backend, so ratings survive navigation in the mock app.
// One list per generation, oldest first: a rating for an earlier revision stays as history.
const store = new Map<string, Feedback[]>();
const listeners = new Set<() => void>();
let version = 0;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Changes whenever any feedback is saved; for stores that derive state from feedback. */
export const feedbackVersion = () => version;

const EMPTY: Feedback[] = [];
/** Every saved rating for a generation, one per revision, oldest first. */
export function getFeedbackHistory(generationId: string): Feedback[] {
  return store.get(generationId) ?? EMPTY;
}

/** The rating for this exact output revision, if any. Older revisions' ratings never count. */
export function getCurrentFeedback(g: Pick<Generation, 'generationId' | 'outputRevision'>): Feedback | undefined {
  return getFeedbackHistory(g.generationId).find((f) => f.outputRevision === g.outputRevision);
}

/**
 * The one completion predicate for feedback (docs/FEEDBACK.md "Required before the next stage"):
 * the current output revision is rated, with a comment below 4 stars. Every move-on action uses it.
 */
export function isCurrentComplete(g: Pick<Generation, 'generationId' | 'outputRevision'>): boolean {
  return isComplete(getCurrentFeedback(g));
}

// Output revisions numbered in the order their content identity is first seen, per generation.
const revisions = new Map<string, string[]>();
/**
 * Revision number (1, 2, 3...) for an output identity, e.g. a PR head commit plus test revisions.
 * TODO(backend): the server assigns `outputRevision` when it stores the generation.
 */
export function outputRevisionFor(generationId: string, outputHash: string): number {
  const seen = revisions.get(generationId) ?? [];
  if (!seen.includes(outputHash)) revisions.set(generationId, [...seen, outputHash]);
  return (revisions.get(generationId) ?? []).indexOf(outputHash) + 1;
}

// TODO(backend): GET /api/generations/{id}/feedback?mine=1
export const fetchFeedback = (generationId: string) => mock(getFeedbackHistory(generationId), 60);

/**
 * TODO(backend): PUT /api/generations/{id}/feedback. The server stores it in
 * `generation_feedback` and logs it to the generation's MLflow trace as human feedback
 * (rating as value, comment as rationale, user as source). Ratings are bound to
 * outputRevision: a regenerated output needs its own rating.
 */
export async function submitFeedback(f: Omit<Feedback, 'updatedAt'>): Promise<Feedback> {
  return record(await mock({ ...f, updatedAt: new Date().toISOString() }, 250));
}

/** Stores feedback that already exists, e.g. sample ratings that stand in for stored feedback. */
export function record(saved: Feedback): Feedback {
  const others = getFeedbackHistory(saved.generationId).filter((x) => x.outputRevision !== saved.outputRevision);
  store.set(saved.generationId, [...others, saved]);
  version += 1;
  listeners.forEach((l) => l());
  return saved;
}

/**
 * TODO(backend): POST /api/feedback/refine-comment. Tachyon rewrites the comment to be
 * specific and actionable without adding facts: it may only use the user's comment, the
 * rating and the stage. The suggestion is never applied without the user choosing it.
 */
export async function refineComment(input: { comment: string; rating: number; stage: GenerationStage }): Promise<string> {
  const text = input.comment.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '');
  const area: Record<GenerationStage, string> = {
    story_analysis: 'story analysis',
    test_cases: 'test cases',
    automation: 'automation code',
    test_tagging: 'test tags',
    regression_automation: 'automation code',
  };
  const lead = input.rating < COMMENT_REQUIRED_BELOW ? `Problem in the ${area[input.stage]}` : `Worked well in the ${area[input.stage]}`;
  const body = text.charAt(0).toLowerCase() + text.slice(1);
  return mock(`${lead}: ${body}.`.slice(0, COMMENT_MAX), 700);
}
