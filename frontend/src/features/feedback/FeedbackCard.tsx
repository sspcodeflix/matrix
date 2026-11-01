import { useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  COMMENT_MAX, COMMENT_REQUIRED_BELOW, refineComment, submitFeedback, type Generation,
} from './api';
import { useFeedbackHistory } from './hooks';
import styles from './Feedback.module.css';

const ratingWords = ['', 'Unusable', 'Poor', 'Needs work', 'Good', 'Excellent'];

/**
 * Star rating plus one-line comment for one AI output. Below 4 stars the comment is
 * required; "Refine with AI" suggests a clearer wording that the user may accept or ignore.
 */
export function FeedbackCard({ generation, userId, title = 'Rate this output' }: {
  generation: Generation;
  userId: string;
  title?: string;
}) {
  const history = useFeedbackHistory(generation.generationId);
  // Only a rating for this exact revision counts; earlier ones are shown as history.
  const saved = history.find((f) => f.outputRevision === generation.outputRevision);
  const earlier = history.filter((f) => f.outputRevision !== generation.outputRevision);
  const previous = earlier[earlier.length - 1];
  const stale = !saved && !!previous;
  const [editing, setEditing] = useState(!saved);
  const [rating, setRating] = useState(saved?.rating ?? 0);
  const [comment, setComment] = useState(saved?.comment ?? '');
  const [original, setOriginal] = useState<string | undefined>(saved?.commentOriginal);
  const [refined, setRefined] = useState(saved?.commentRefinedByAi ?? false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState<'refine' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const id = useId();

  const needsComment = rating > 0 && rating < COMMENT_REQUIRED_BELOW;
  const commentMissing = needsComment && !comment.trim();

  const refine = async () => {
    setBusy('refine');
    setError('');
    try {
      setSuggestion(await refineComment({ comment, rating, stage: generation.stage }));
    } catch {
      setError('Could not refine the comment. Your text is unchanged.');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setShowErrors(true);
    if (!rating || commentMissing) return;
    setBusy('save');
    setError('');
    try {
      await submitFeedback({
        generationId: generation.generationId,
        outputRevision: generation.outputRevision,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        comment: comment.trim(),
        commentOriginal: refined ? original : undefined,
        commentRefinedByAi: refined,
        userId,
      });
      setEditing(false);
      setShowErrors(false);
    } catch {
      setError('Feedback was not saved. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const historyNote = earlier.length > 0 && (
    <span className="small muted">
      Earlier {earlier.length === 1 ? 'rating' : 'ratings'}, kept as history: {earlier.map((f) => `revision ${f.outputRevision}, ${f.rating} of 5`).join('; ')}.
    </span>
  );

  if (saved && !editing) {
    return (
      <section className={`${styles.card} ${styles.done}`} aria-label={title}>
        <div className={styles.summary}>
          <Stars value={saved.rating} />
          <span className="grow">
            <strong>{saved.rating} of 5</strong>
            {saved.comment && <> · “{saved.comment}”</>}
            {saved.commentRefinedByAi && <span className="chip" style={{ marginLeft: 6 }}>refined with AI</span>}
          </span>
          <button type="button" className="btn" onClick={() => setEditing(true)}>Edit feedback</button>
        </div>
        <span className="small muted">Rating for revision {generation.outputRevision}, saved with the output and logged to MLflow trace <span className="mono">{generation.mlflowTraceId}</span>.</span>
        {historyNote}
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div className="spread">
        <h3 id={`${id}-title`} style={{ fontSize: 14 }}>{title}</h3>
        <span className="small muted">Required before this output moves on</span>
      </div>
      {stale && previous && (
        <p className="small" role="status">
          The output changed since your last rating (revision {previous.outputRevision} → {generation.outputRevision}). Rate the new version: your {previous.rating} of 5 for revision {previous.outputRevision} is kept as history and does not count for this one.
        </p>
      )}
      {!stale && historyNote}

      <fieldset className={styles.stars}>
        <legend className="sr-only">Rating out of 5</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={styles.star} data-on={n <= rating || undefined}>
            <input
              type="radio"
              name={`${id}-rating`}
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
              className="sr-only"
            />
            <Icon name="star" size={24} strokeWidth={1.6} />
            <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}, {ratingWords[n]}</span>
          </label>
        ))}
        <span className="small secondary" aria-hidden="true">{rating ? `${rating} of 5 · ${ratingWords[rating]}` : 'Choose 1 to 5 stars'}</span>
      </fieldset>
      {showErrors && !rating && <p className={styles.error} role="alert">Choose a rating.</p>}

      <div className="field">
        <label htmlFor={`${id}-comment`}>
          One-line comment {needsComment ? <span className={styles.req}>(required below {COMMENT_REQUIRED_BELOW} stars)</span> : <span className="muted">(optional)</span>}
        </label>
        <div className={styles.commentRow}>
          <input
            id={`${id}-comment`}
            className="input grow"
            maxLength={COMMENT_MAX}
            value={comment}
            placeholder={needsComment ? 'What is wrong or missing?' : 'What worked, or what would make it better?'}
            aria-invalid={showErrors && commentMissing ? true : undefined}
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setComment(e.target.value);
              setRefined(false);
              setOriginal(undefined);
            }}
          />
          <button type="button" className="btn" onClick={refine} disabled={!comment.trim() || busy !== null}>
            <Icon name="sparkle" size={16} />
            {busy === 'refine' ? 'Refining…' : 'Refine with AI'}
          </button>
        </div>
        <span id={`${id}-hint`} className="small muted">
          {comment.length}/{COMMENT_MAX} · Be specific: name the step, criterion or line. Refine with AI only rewords your comment; it adds no facts.
        </span>
        {showErrors && commentMissing && <p className={styles.error} role="alert">Add a comment: ratings below {COMMENT_REQUIRED_BELOW} stars need a reason.</p>}
      </div>

      {suggestion && (
        <div className={styles.suggestion} role="status">
          <span className="small secondary">Suggested wording</span>
          <p>{suggestion}</p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOriginal(comment);
                setComment(suggestion);
                setRefined(true);
                setSuggestion(null);
              }}
            >
              Use suggestion
            </button>
            <button type="button" className="btn ghost" onClick={() => setSuggestion(null)}>Keep mine</button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="btn dark" onClick={submit} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Submit feedback'}
        </button>
        {saved && (
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        )}
      </div>
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={styles.starStatic} data-on={n <= value || undefined}>
          <Icon name="star" size={18} strokeWidth={1.6} />
        </span>
      ))}
    </span>
  );
}
