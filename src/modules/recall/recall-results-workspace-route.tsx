import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { formatCount } from "../../lib/format-count";
import type { AppSessionSnapshot } from "../access/session/session";
import type { AppLabel } from "../labels/label-management/labels";
import { listNotesForUser } from "../notes";
import { formatRecallModeLabel } from "./learner-copy";
import type {
  FlashCardSessionResult,
  RecallMode,
  RecallQuestion,
  RecallSelfRating,
} from "./recall";
import { listRecallResultLabels } from "./recall-result-labels";
import { projectSessionReview } from "./recall-session-review";
import { searchRecallSessionResults } from "./recall-session-search";

const recallResultsSearchSchema = z.object({});
const recallSessionSavedMessageKey = "learning-makes-difference:recall-saved";
const recallModes = ["FlashCard", "AiAssisted", "AiGraded"] as const;
const resultDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const resultTimeFormatter = new Intl.DateTimeFormat("en", {
  timeStyle: "short",
  timeZone: "UTC",
});

type RecallTypeFilter = "all" | RecallMode;
type ExpandedQuestionKey = string | null;
type ExpandedQuestionKeyChange = (questionKey: ExpandedQuestionKey) => void;

export const Route = createFileRoute("/_protected/recall/")({
  validateSearch: recallResultsSearchSchema,
  component: RecallResultsWorkspacePage,
});

function formatResultDate(timestamp: string) {
  const resultDate = new Date(timestamp);

  if (Number.isNaN(resultDate.getTime())) {
    return "Unknown date";
  }

  return resultDateFormatter.format(resultDate);
}

function formatResultTime(timestamp: string) {
  const resultDate = new Date(timestamp);

  if (Number.isNaN(resultDate.getTime())) {
    return "Unknown time";
  }

  return resultTimeFormatter.format(resultDate);
}

function formatRatingLabel(rating: RecallSelfRating) {
  switch (rating) {
    case "forgot":
      return "Forgot";
    case "hard":
      return "Hard";
    case "good":
      return "Good";
    case "easy":
      return "Easy";
  }
}

function formatResultScore(score: number | null) {
  return score === null ? "No score" : `${Math.round(score)}%`;
}

function formatResultMetricLabel(mode: RecallMode) {
  switch (mode) {
    case "FlashCard":
      return "Session self rating";
    case "AiAssisted":
    case "AiGraded":
      return "Score";
  }
}

function getRatingTone(rating: RecallSelfRating | null) {
  switch (rating) {
    case "forgot":
      return "forgot";
    case "hard":
      return "hard";
    case "good":
      return "good";
    case "easy":
      return "easy";
    case null:
      return "unattempted";
  }
}

function getModeTone(mode: RecallMode) {
  switch (mode) {
    case "FlashCard":
      return "flash-card";
    case "AiAssisted":
      return "ai-assisted";
    case "AiGraded":
      return "ai-graded";
  }
}

function getScoreTone(score: number | null) {
  if (score === null) {
    return "muted";
  }

  if (score >= 90) {
    return "easy";
  }

  if (score >= 75) {
    return "good";
  }

  if (score >= 50) {
    return "hard";
  }

  return "forgot";
}

function getQuestionPrompt(question: RecallQuestion) {
  const prompt = question.noteSnapshot.title.trim();

  if (prompt.length > 0) {
    return prompt;
  }

  return question.noteSnapshot.body;
}

function getQuestionAnswerText(question: RecallQuestion) {
  const typedAnswer = (question.typedAnswer ?? "").trim();

  if (typedAnswer.length > 0) {
    return typedAnswer;
  }

  return "No typed answer recorded";
}

function getQuestionSelfRatingLabel(rating: RecallSelfRating | null) {
  if (rating === null) {
    return "Not answered";
  }

  return formatRatingLabel(rating);
}

function getResultsCountLabel(results: readonly FlashCardSessionResult[]) {
  if (results.length === 0) {
    return "";
  }

  return `Showing 1-${results.length} of ${formatCount(
    results.length,
    "result",
  )}`;
}

function getSelectedResultIdForResults(
  results: readonly FlashCardSessionResult[],
  selectedResultId: string | null,
) {
  if (results.length === 0) {
    return null;
  }

  if (
    selectedResultId !== null &&
    results.some((result) => result.id === selectedResultId)
  ) {
    return selectedResultId;
  }

  return results[0]?.id ?? null;
}

function matchesLabel(result: FlashCardSessionResult, labelId: string) {
  return result.notes.some((note) => note.labelIds.includes(labelId));
}

function filterSessionResults(input: {
  labelId: string;
  labels: readonly AppLabel[];
  query: string;
  recallType: RecallTypeFilter;
  sessionResults: readonly FlashCardSessionResult[];
}) {
  const labelFilteredResults =
    input.labelId.length === 0
      ? input.sessionResults
      : input.sessionResults.filter((result) =>
          matchesLabel(result, input.labelId),
        );
  const typeFilteredResults =
    input.recallType === "all"
      ? labelFilteredResults
      : labelFilteredResults.filter(
          (result) => result.mode === input.recallType,
        );

  if (input.query.trim().length === 0) {
    return [...typeFilteredResults];
  }

  return searchRecallSessionResults({
    labels: input.labels,
    query: input.query,
    sessionResults: typeFilteredResults,
  }).map((result) => result.sessionResult);
}

function getInitialSavedMessage() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.sessionStorage.getItem(recallSessionSavedMessageKey) !== "true") {
    return null;
  }

  window.sessionStorage.removeItem(recallSessionSavedMessageKey);
  return "Recall session saved to results";
}

function getQuestionKey(question: RecallQuestion, index: number) {
  return `${question.noteId}-${index}`;
}

function getQuestionDetailId(index: number) {
  return `recall-result-question-detail-${index}`;
}

function RecallResultsWorkspacePage() {
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const currentLabels =
    userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const availableLabels = listRecallResultLabels({
    currentLabels,
    sessionResults,
  });
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [selectedRecallType, setSelectedRecallType] =
    useState<RecallTypeFilter>("all");
  const [expandedQuestionKey, setExpandedQuestionKey] =
    useState<ExpandedQuestionKey>(null);
  const [savedMessage, setSavedMessage] = useState(getInitialSavedMessage);
  const filteredResults = useMemo(
    () =>
      filterSessionResults({
        labelId: selectedLabelId,
        labels: availableLabels,
        query,
        recallType: selectedRecallType,
        sessionResults,
      }),
    [
      availableLabels,
      query,
      selectedLabelId,
      selectedRecallType,
      sessionResults,
    ],
  );

  useEffect(() => {
    const nextSelectedResultId = getSelectedResultIdForResults(
      filteredResults,
      selectedResultId,
    );
    const shouldClearExpandedQuestion =
      filteredResults.length === 0 || nextSelectedResultId !== selectedResultId;

    if (shouldClearExpandedQuestion) {
      setExpandedQuestionKey(null);
    }

    if (nextSelectedResultId !== selectedResultId) {
      setSelectedResultId(nextSelectedResultId);
    }
  }, [filteredResults, selectedResultId]);

  useEffect(() => {
    if (
      selectedLabelId.length > 0 &&
      !availableLabels.some((label) => label.id === selectedLabelId)
    ) {
      setSelectedLabelId("");
    }
  }, [availableLabels, selectedLabelId]);

  if (notes.length === 0 && sessionResults.length === 0) {
    return <NoNotesRecallState />;
  }

  const selectedResult =
    filteredResults.find((result) => result.id === selectedResultId) ?? null;

  return (
    <section aria-label="Recall workspace" className="recall-workspace">
      <article className="recall-surface recall-results-surface">
        <div className="recall-results-top">
          <header className="recall-surface__header">
            <div className="notes-editor__title-stack">
              <h3>Recall</h3>
              <p className="muted notes-editor__meta">
                Review past results or start a new recall session.
              </p>
            </div>
          </header>

          {savedMessage !== null ? (
            <p className="recall-feedback" role="status">
              {savedMessage}
              <button
                aria-label="Dismiss recall saved message"
                className="recall-feedback__dismiss"
                onClick={() => setSavedMessage(null)}
                type="button"
              >
                Dismiss
              </button>
            </p>
          ) : null}
        </div>

        <div className="recall-results-workspace">
          <ResultsMasterPanel
            labels={availableLabels}
            onLabelChange={setSelectedLabelId}
            onQueryChange={setQuery}
            onRecallTypeChange={setSelectedRecallType}
            onSelectResult={(resultId) => {
              setExpandedQuestionKey(null);
              setSelectedResultId(resultId);
            }}
            query={query}
            results={filteredResults}
            selectedLabelId={selectedLabelId}
            selectedRecallType={selectedRecallType}
            selectedResultId={selectedResultId}
            totalResults={sessionResults.length}
          />
          <ResultsDetailPanel
            expandedQuestionKey={expandedQuestionKey}
            hasAnyResults={sessionResults.length > 0}
            onExpandedQuestionKeyChange={setExpandedQuestionKey}
            result={selectedResult}
          />
        </div>
      </article>
    </section>
  );
}

function NoNotesRecallState() {
  return (
    <section aria-label="Recall workspace" className="recall-workspace">
      <article className="recall-surface recall-empty-surface">
        <h3>Recall starts with notes</h3>
        <p className="muted">
          Create Notes first, then use Metaphors and Acronyms to make each
          concept easier to recall.
        </p>
        <Link className="notes-action notes-action-primary" to="/notes">
          Open Notes Workspace
        </Link>
      </article>
    </section>
  );
}

function ResultsMasterPanel({
  labels,
  onLabelChange,
  onQueryChange,
  onRecallTypeChange,
  onSelectResult,
  query,
  results,
  selectedLabelId,
  selectedRecallType,
  selectedResultId,
  totalResults,
}: {
  labels: readonly AppLabel[];
  onLabelChange: (labelId: string) => void;
  onQueryChange: (query: string) => void;
  onRecallTypeChange: (recallType: RecallTypeFilter) => void;
  onSelectResult: (resultId: string) => void;
  query: string;
  results: readonly FlashCardSessionResult[];
  selectedLabelId: string;
  selectedRecallType: RecallTypeFilter;
  selectedResultId: string | null;
  totalResults: number;
}) {
  return (
    <section
      aria-label="Recall results"
      className="recall-panel recall-results-master"
    >
      <div className="recall-results-master__actions">
        <Link className="recall-start-button" to="/recall/select">
          <PlusCircleIcon />
          Start Recall
        </Link>
      </div>

      <label
        className="recall-field recall-search-field"
        htmlFor="recall-results-search"
      >
        <span className="sr-only">Search results</span>
        <SearchIcon />
        <input
          id="recall-results-search"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search results..."
          type="search"
          value={query}
        />
      </label>

      <div className="recall-results-filters">
        <label className="recall-field" htmlFor="recall-results-label">
          <span className="sr-only">Filter results by label</span>
          <select
            id="recall-results-label"
            onChange={(event) => onLabelChange(event.target.value)}
            value={selectedLabelId}
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <label className="recall-field" htmlFor="recall-results-type">
          <span className="sr-only">Filter results by recall type</span>
          <select
            id="recall-results-type"
            onChange={(event) =>
              onRecallTypeChange(event.target.value as RecallTypeFilter)
            }
            value={selectedRecallType}
          >
            <option value="all">All modes</option>
            {recallModes.map((mode) => (
              <option key={mode} value={mode}>
                {formatRecallModeLabel(mode)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalResults === 0 ? (
        <div className="recall-results-empty" role="status">
          <h4>No results yet</h4>
          <p className="muted">Results will appear here.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="recall-results-empty" role="status">
          <h4>No matching results</h4>
          <p className="muted">Adjust search, label, or recall type filters.</p>
        </div>
      ) : (
        <div className="recall-results-list-frame">
          <ol className="recall-results-list">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  aria-pressed={result.id === selectedResultId}
                  className="recall-result-row"
                  data-selected={result.id === selectedResultId}
                  onClick={() => onSelectResult(result.id)}
                  type="button"
                >
                  <span className="recall-result-row__icon" aria-hidden="true">
                    <CalendarIcon />
                  </span>
                  <span className="recall-result-row__main">
                    <strong>{formatResultDate(result.completedAt)}</strong>
                    <span>{formatResultTime(result.completedAt)}</span>
                    <span>
                      {formatCount(result.questions.length, "question")}{" "}
                      <span aria-hidden="true">·</span>{" "}
                      <span
                        className="recall-result-row__score"
                        data-score-tone={getScoreTone(result.score ?? null)}
                      >
                        {formatResultScore(result.score ?? null)}
                      </span>
                    </span>
                  </span>
                  <span
                    className="recall-mode-pill"
                    data-mode-tone={getModeTone(result.mode)}
                  >
                    {formatRecallModeLabel(result.mode)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="recall-results-count">
            {getResultsCountLabel(results)}
          </p>
        </div>
      )}
    </section>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ResultsDetailPanel({
  expandedQuestionKey,
  hasAnyResults,
  onExpandedQuestionKeyChange,
  result,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  hasAnyResults: boolean;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  result: FlashCardSessionResult | null;
}) {
  return (
    <section
      aria-label="Selected result"
      className="recall-panel recall-results-detail-panel"
    >
      {result === null ? (
        <div className="recall-results-empty" role="status">
          <h4>{hasAnyResults ? "No result selected" : "No results yet"}</h4>
          <p className="muted">Results will appear here.</p>
        </div>
      ) : (
        <SelectedResultDetail
          expandedQuestionKey={expandedQuestionKey}
          onExpandedQuestionKeyChange={onExpandedQuestionKeyChange}
          result={result}
        />
      )}
    </section>
  );
}

function SelectedResultDetail({
  expandedQuestionKey,
  onExpandedQuestionKeyChange,
  result,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  result: FlashCardSessionResult;
}) {
  const review = projectSessionReview(result);
  const questionsAttempted = review.attemptedQuestions.length;
  const resultScore = result.score ?? null;

  return (
    <div className="recall-results-detail recall-selected-result">
      <header className="recall-selected-result__heading">
        <h4>Session review</h4>
      </header>

      <div className="recall-selected-result__stats">
        <div className="recall-selected-result__stat">
          <span
            aria-hidden="true"
            className="recall-selected-result__stat-icon"
          >
            <CalendarIcon />
          </span>
          <div className="recall-selected-result__stat-copy">
            <strong>{formatResultDate(result.completedAt)}</strong>
            <span>{formatResultTime(result.completedAt)}</span>
          </div>
        </div>
        <div className="recall-selected-result__stat recall-selected-result__stat--mode">
          <span
            className="recall-mode-pill recall-selected-result__mode-pill"
            data-mode-tone={getModeTone(result.mode)}
          >
            <SparklesIcon />
            {formatRecallModeLabel(result.mode)}
          </span>
        </div>
        <div className="recall-selected-result__stat">
          <ScoreRing score={resultScore} />
          <div className="recall-selected-result__stat-copy recall-selected-result__stat-copy--stacked">
            <strong>{formatResultScore(resultScore)}</strong>
            <span>{formatResultMetricLabel(result.mode)}</span>
          </div>
        </div>
        <div className="recall-selected-result__stat">
          <span
            aria-hidden="true"
            className="recall-selected-result__stat-icon"
          >
            <QuestionsIcon />
          </span>
          <div className="recall-selected-result__stat-copy recall-selected-result__stat-copy--stacked">
            <strong>{questionsAttempted}</strong>
            <span>Questions</span>
          </div>
        </div>
      </div>

      <p className="recall-selected-result__summary">
        <span>{review.summary.noteCountLabel}</span>
        <span aria-hidden="true">•</span>
        <span>{review.summary.questionCoverageLabel}</span>
        <span aria-hidden="true">•</span>
        <span>{review.summary.durationLabel}</span>
      </p>

      {review.notReachedNotes.length > 0 ? (
        <section
          aria-labelledby="recall-result-not-reached-notes"
          className="recall-selected-result__section"
        >
          <h4 id="recall-result-not-reached-notes">Not reached notes</h4>
          <ol className="recall-selected-result__list">
            {review.notReachedNotes.map((note) => (
              <li key={note.id}>
                <p className="recall-selected-result__row-title">
                  {note.title}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section
        aria-labelledby="recall-result-questions-answers"
        className="recall-selected-result__section"
      >
        <h4 id="recall-result-questions-answers">Questions</h4>
        {review.attemptedQuestions.length === 0 ? (
          <p className="muted">No attempted questions were saved.</p>
        ) : (
          <ol className="recall-selected-result__list">
            {review.attemptedQuestions.map((question, index) => {
              const questionKey = getQuestionKey(question, index);

              return (
                <QuestionReviewRow
                  expandedQuestionKey={expandedQuestionKey}
                  index={index}
                  key={questionKey}
                  onExpandedQuestionKeyChange={onExpandedQuestionKeyChange}
                  question={question}
                  questionKey={questionKey}
                />
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function QuestionReviewRow({
  expandedQuestionKey,
  index,
  onExpandedQuestionKeyChange,
  question,
  questionKey,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  index: number;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  question: RecallQuestion;
  questionKey: string;
}) {
  const detailId = getQuestionDetailId(index);
  const isExpanded = expandedQuestionKey === questionKey;
  const ratingLabel = getQuestionSelfRatingLabel(question.selfRating);
  const ratingTone = getRatingTone(question.selfRating);

  return (
    <li>
      <article className="recall-selected-result__question-card">
        <button
          aria-controls={detailId}
          aria-expanded={isExpanded}
          className="recall-selected-result__row recall-selected-result__row--question recall-selected-result__question-toggle"
          onClick={() =>
            onExpandedQuestionKeyChange(isExpanded ? null : questionKey)
          }
          type="button"
        >
          <span className="recall-selected-result__question-index">
            {index + 1}
          </span>
          <span className="recall-selected-result__row-main">
            <span className="recall-selected-result__row-title">
              {getQuestionPrompt(question)}
            </span>
          </span>
          <span
            className="recall-selected-result__row-pill"
            data-rating-tone={ratingTone}
          >
            {ratingLabel}
          </span>
          <span
            aria-hidden="true"
            className="recall-selected-result__row-expander"
            data-expanded={isExpanded}
          >
            <ChevronDownIcon />
          </span>
        </button>

        {isExpanded ? (
          <QuestionReviewDetail
            detailId={detailId}
            question={question}
            ratingLabel={ratingLabel}
            ratingTone={ratingTone}
          />
        ) : null}
      </article>
    </li>
  );
}

function QuestionReviewDetail({
  detailId,
  question,
  ratingLabel,
  ratingTone,
}: {
  detailId: string;
  question: RecallQuestion;
  ratingLabel: string;
  ratingTone: ReturnType<typeof getRatingTone>;
}) {
  return (
    <div className="recall-selected-result__question-detail" id={detailId}>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          Your answer
        </p>
        <p className="recall-selected-result__question-detail-copy">
          {getQuestionAnswerText(question)}
        </p>
      </div>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          Self rating
        </p>
        <span
          className="recall-selected-result__row-pill"
          data-rating-tone={ratingTone}
        >
          {ratingLabel}
        </span>
      </div>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          Reference note
        </p>
        <p className="recall-selected-result__question-detail-title">
          {question.noteSnapshot.title}
        </p>
        <p className="recall-selected-result__question-detail-copy">
          {question.noteSnapshot.body}
        </p>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clampedScore / 100) * circumference;

  return (
    <span aria-hidden="true" className="recall-selected-result__score-ring">
      <svg
        aria-label={`Score ring: ${clampedScore}%`}
        fill="none"
        height="34"
        role="img"
        viewBox="0 0 34 34"
        width="34"
      >
        <title>{`Score ring: ${clampedScore}%`}</title>
        <circle
          className="recall-selected-result__score-ring-track"
          cx="17"
          cy="17"
          r={radius}
        />
        <circle
          className="recall-selected-result__score-ring-progress"
          cx="17"
          cy="17"
          r={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset: dashOffset,
          }}
        />
      </svg>
    </span>
  );
}

function SparklesIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m7 4 1.2 2.6L11 7.8 8.4 9 7 11.8 5.7 9 3 7.8l2.7-1.2L7 4ZM17 3l.8 1.7L19.5 5.5l-1.7.8L17 8l-.8-1.7-1.7-.8 1.7-.8L17 3ZM17 12l1.6 3.4L22 17l-3.4 1.6L17 22l-1.6-3.4L12 17l3.4-1.6L17 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function QuestionsIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M7 5h10M7 10h10M7 15h6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
