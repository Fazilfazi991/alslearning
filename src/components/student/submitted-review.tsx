import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CircleMinus,
  XCircle,
} from "lucide-react";
import { RichContent } from "@/components/learning/rich-text";
import { QuestionGallery } from "@/components/learning/question-gallery";
import { mediaPositions, plainText } from "@/lib/rich-text";
import type { Review } from "./review-types";
import styles from "./submitted-review.module.css";

type Answer = Review["answers"][number];
export function answerOutcome(answer: Answer) {
  if (!answer.selected_option_ids.length) return "unanswered";
  if (!answer.correct_option_ids?.length) return "recorded";
  const selected = new Set(answer.selected_option_ids);
  return selected.size === answer.correct_option_ids.length &&
    answer.correct_option_ids.every((id) => selected.has(id))
    ? "correct"
    : "incorrect";
}
const states = {
  correct: { label: "Correct", Icon: CheckCircle2 },
  incorrect: { label: "Incorrect", Icon: XCircle },
  unanswered: { label: "Not answered", Icon: CircleMinus },
  recorded: { label: "Answer recorded", Icon: CircleMinus },
};

function Response({
  answer,
  correct = false,
}: {
  answer: Answer;
  correct?: boolean;
}) {
  const ids = correct ? answer.correct_option_ids : answer.selected_option_ids;
  return (
    <div
      className={`${styles.response} ${correct ? styles.correctResponse : ""}`}
    >
      <h4>{correct ? "Correct answer" : "Your answer"}</h4>
      {answer.options
        .filter((o) => ids.includes(o.id))
        .map((o) => (
          <div key={o.id} className={styles.option}>
            <RichContent value={o.content_rich} fallback={o.content} />
          </div>
        ))}
      {!ids.length && <p>Not answered</p>}
    </div>
  );
}

export function SubmittedReview({ review }: { review: Review }) {
  const answers = review.answers ?? [];
  const outcomes = answers.map(answerOutcome);
  const canCount =
    answers.length > 0 && answers.every((a) => a.correct_option_ids?.length);
  const showScore = review.results_visible && review.score !== null;
  return (
    <div className={styles.review} data-submitted-review>
      <nav className={styles.links} aria-label="Result navigation">
        <Link href="/student/exams">
          <ArrowLeft size={18} aria-hidden />
          Back to tests
        </Link>
        {answers.length > 0 && <a href="#answer-review">Review answers</a>}
      </nav>
      <section
        className={styles.summary}
        id="result-summary"
        aria-labelledby="result-heading"
      >
        <div>
          <h2 id="result-heading">Test completed</h2>
          {showScore ? (
            <>
              <p className={styles.score}>
                {review.score}
                <span> / {review.total_marks}</span>
              </p>
              <p className={styles.scoreLabel}>
                Marks earned
                {review.total_marks > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    {Number(
                      ((review.score! / review.total_marks) * 100).toFixed(1),
                    )}
                    %
                  </>
                )}
                {review.passed !== null && review.passed !== undefined && <> · {review.passed ? "Passed" : "Not passed"}</>}
              </p>
            </>
          ) : (
            <p className={styles.hidden}>
              Your submission is saved. Results are hidden by the test settings.
            </p>
          )}
        </div>
        {(canCount || review.correct !== undefined) && (
          <dl className={styles.stats}>
            <div>
              <dt>Correct</dt>
              <dd>{review.correct ?? outcomes.filter((s) => s === "correct").length}</dd>
            </div>
            <div>
              <dt>Incorrect</dt>
              <dd>{review.incorrect ?? outcomes.filter((s) => s === "incorrect").length}</dd>
            </div>
            <div>
              <dt>Attempted</dt>
              <dd>
                {review.unanswered !== undefined && review.unanswered !== null ? (review.correct??0)+(review.incorrect??0) : answers.filter((a) => a.selected_option_ids.length).length}
                <span> / {review.unanswered !== undefined && review.unanswered !== null ? (review.correct??0)+(review.incorrect??0)+review.unanswered : answers.length}</span>
              </dd>
            </div>
          </dl>
        )}
      </section>
      {answers.length > 0 ? (
        <section id="answer-review" aria-labelledby="review-heading">
          <div className={styles.reviewHeading}>
            <h2 id="review-heading">Answer review</h2>
            <span>{answers.length} questions</span>
          </div>
          <nav className={styles.index} aria-label="Jump to question">
            {answers.map((a, i) => (
              <a
                key={a.question_id}
                className={styles[outcomes[i]]}
                href={`#review-question-${i + 1}`}
                aria-label={`Question ${i + 1}: ${states[outcomes[i]].label}`}
              >
                {i + 1}
              </a>
            ))}
          </nav>
          {answers.map((a, i) => {
            const outcome = outcomes[i],
              { Icon, label } = states[outcome];
            const explanation =
              a.explanation?.trim() ||
              (a.explanation_rich && plainText(a.explanation_rich).trim()) ||
              mediaPositions(a.explanation_rich).length ||
              a.solution_media?.length ||
              a.explanation_image_path;
            return (
              <article
                id={`review-question-${i + 1}`}
                key={a.question_id}
                className={styles.question}
              >
                <header className={styles.questionHeader}>
                  <h3>
                    Question {i + 1} <span>of {answers.length}</span>
                  </h3>
                  <div className={styles.result}>
                    <span className={`${styles.status} ${styles[outcome]}`}>
                      <Icon size={18} aria-hidden />
                      {label}
                    </span>
                    {showScore && (
                      <span className={styles.marks}>
                        {a.marks_awarded}{" "}
                        {Math.abs(a.marks_awarded) === 1 ? "mark" : "marks"}{" "}
                        earned
                      </span>
                    )}
                  </div>
                </header>
                <div className={styles.stem}>
                  {a.prompt.trim() || mediaPositions(a.prompt_rich).length ? (
                    <RichContent
                      value={a.prompt_rich}
                      fallback={a.prompt}
                      media={a.stem_media}
                      kind="stem"
                    />
                  ) : null}
                  <QuestionGallery
                    kind="stem"
                    media={
                      mediaPositions(a.prompt_rich).length ? [] : a.stem_media
                    }
                    legacy={a.stem_image_path}
                    showLabels={false}
                  />
                </div>
                <div className={styles.responses}>
                  <Response answer={a} />
                  {a.correct_option_ids?.length > 0 && (
                    <Response answer={a} correct />
                  )}
                </div>
                {explanation ? (
                  <section
                    className={styles.explanation}
                    aria-label={`Explanation for question ${i + 1}`}
                  >
                    <h4>Explanation</h4>
                    <RichContent
                      value={a.explanation_rich}
                      fallback={a.explanation}
                      media={a.solution_media}
                      kind="solution"
                    />
                    <QuestionGallery
                      kind="solution"
                      media={
                        mediaPositions(a.explanation_rich).length
                          ? []
                          : a.solution_media
                      }
                      legacy={a.explanation_image_path}
                      showLabels={false}
                    />
                  </section>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <p className={styles.hidden}>
          Answer review is not available for this submission.
        </p>
      )}
      <nav className={styles.links} aria-label="End of review">
        <Link href="/student/exams">
          <ArrowLeft size={18} aria-hidden />
          Back to tests
        </Link>
        <a href="#result-summary">
          <ArrowUp size={18} aria-hidden />
          Result summary
        </a>
      </nav>
    </div>
  );
}
