# Feedback on AI-generated content

Every output Matrix generates with the model is rated by the person who reviews it. Ratings and comments are stored with the output and attached to its MLflow trace, so they can be used to evaluate and improve prompts, skills and datasets.

## What is rated

A **generation** is one model output at one revision:

| Workflow | Stage | Output rated |
|---|---|---|
| Acceptance | Story analysis | Refined story: testable acceptance criteria, ambiguities and questions, out-of-scope notes, citations |
| Acceptance | Test cases | The manual test-case set for a story |
| Acceptance | Automation | The automation PR for a story's accepted cases |
| Acceptance | Test tagging | Suggested suite tags (smoke, regression, sanity, …) and priorities |
| Regression | Automation | The automation PR reviewed in the Review queue |

Deterministic outputs (parsing, coverage mapping, counts) are not rated. A regenerated or edited output is a new revision and needs its own rating; the earlier rating is kept for history.

## The rating

- **Stars, 1 to 5.** 1 Unusable, 2 Poor, 3 Needs work, 4 Good, 5 Excellent.
- **One-line comment**, up to 200 characters. Optional at 4 or 5 stars; **required below 4 stars**.
- **Refine with AI** rewrites the user's comment to be specific and actionable. It may use only the comment, the rating and the stage; it must not add facts about the output. The suggestion is shown beside the original, and the user chooses **Use suggestion** or **Keep mine**. Both the original and the refined text are stored, with a flag saying which was submitted.
- **Required before the next stage.** The action that moves an output on (accept the analysis, accept test cases, approve tags, approve the PR) is disabled until that output is rated, with a comment when below 4 stars. The reason and a link to the rating are shown beside the disabled action. Sending work back does not require a rating.
- A rating can be edited until the output moves on. After that, edits create a new feedback version.

## Storage and MLflow

- MongoDB `generation_feedback` holds one current record per user and generation revision (see [DATA_MODEL.md](DATA_MODEL.md)).
- The backend logs each submission to the generation's MLflow trace as human feedback: the rating as the value, the comment as the rationale, the user as the source. Target MLflow 3 trace assessments (`mlflow.log_feedback`); confirm the deployed MLflow version.
- Refine-with-AI calls go through Tachyon like any generation and have their own trace, linked from the feedback record. They are not themselves rated.

## Using the feedback

- **Prompt studio and Skills:** low-rated generations with comments are candidate cases for golden datasets and for proposed skill versions. A person curates them; feedback never changes a skill or prompt automatically.
- **Metrics:** average rating and share below 4 stars per stage, skill version and application; comment coverage; how often refined comments are accepted. Show these with their counts.
- **Visibility:** a person's own ratings are visible to them. Aggregates follow the role rules for per-person data in [SECURITY.md](SECURITY.md); feedback is for improving Matrix, not for assessing reviewers.

## Safety

Comments are user text sent to Tachyon only when the user chooses **Refine with AI**. Mask secrets and personal data in comments before storage and logging, as for other free text. Credentials never appear in feedback, traces or exports.

## Acceptance checks

- Each listed stage shows a rating card on its output, and its move-on action stays disabled until the output is rated.
- A rating of 1 to 3 stars cannot be submitted without a comment; 4 or 5 can.
- **Refine with AI** never replaces the comment without the user choosing the suggestion; the stored record shows the original and the refined text.
- Regenerating an output requires a new rating; the old rating stays in history.
- The submitted rating appears on the generation's MLflow trace with the user, rating and comment.

The current frontend implements the card, the gate and a mock store (`frontend/src/features/feedback/`). The API, MongoDB persistence and MLflow logging are backend work.
