import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { formatCount } from "../../lib/format-count";
import type { AppSessionSnapshot } from "../access/session/session";
import type { AppLabel } from "../labels/label-management/labels";
import { listNotesForUser } from "../notes";
import { formatRecallModeLabel } from "./learner-copy";
import type {
  FlashCardRecallNote,
  FlashCardSessionResult,
  RecallMode,
  RecallQuestion,
  RecallSelfRating,
} from "./recall";
import { listRecallResultLabels } from "./recall-result-labels";
import { searchRecallSessionResults } from "./recall-session-search";
import {
  formatResultSummaryScoreLabel,
  summarizeSessionResult,
} from "./result-summary";

const recallResultsSearchSchema = z.object({});
const recallSessionSavedMessageKey = "learning-makes-difference:recall-saved";
const recallModes = ["FlashCard", "AiAssisted", "AiGraded"] as const;

type RecallTypeFilter = "all" | RecallMode;

export const Route = createFileRoute("/_protected/recall/")({
  validateSearch: recallResultsSearchSchema,
  component: RecallResultsWorkspacePage,
});

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
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
    if (filteredResults.length === 0) {
      setSelectedResultId(null);
      return;
    }

    setSelectedResultId((currentResultId) => {
      if (filteredResults.some((result) => result.id === currentResultId)) {
        return currentResultId;
      }

      return filteredResults[0]?.id ?? null;
    });
  }, [filteredResults]);

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
      <article className="recall-surface">
        <header className="recall-surface__header">
          <div className="notes-editor__title-stack">
            <p className="section-label">Recall / Results</p>
            <h3>Recall</h3>
            <p className="muted notes-editor__meta">
              Review past results or start a new recall session.
            </p>
          </div>
          <Link
            className="notes-action notes-action-primary"
            to="/recall/select"
          >
            Start Recall
          </Link>
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

        <div className="recall-results-workspace">
          <ResultsMasterPanel
            labels={availableLabels}
            onLabelChange={setSelectedLabelId}
            onQueryChange={setQuery}
            onRecallTypeChange={setSelectedRecallType}
            onSelectResult={setSelectedResultId}
            query={query}
            results={filteredResults}
            selectedLabelId={selectedLabelId}
            selectedRecallType={selectedRecallType}
            selectedResultId={selectedResultId}
            totalResults={sessionResults.length}
          />
          <ResultsDetailPanel
            hasAnyResults={sessionResults.length > 0}
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
        <p className="section-label">Recall / Results</p>
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
        <Link className="notes-action notes-action-primary" to="/recall/select">
          Start Recall
        </Link>
        <span className="tag">{formatCount(totalResults, "result")}</span>
      </div>

      <label className="recall-field" htmlFor="recall-results-search">
        <span className="sr-only">Search results</span>
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
            <option value="all">All recall types</option>
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
                <span className="recall-result-row__main">
                  <strong>{formatDateTime(result.completedAt)}</strong>
                  <span>{formatResultScore(result.score ?? null)}</span>
                </span>
                <span className="recall-result-row__meta">
                  {formatRecallModeLabel(result.mode)} ·{" "}
                  {formatCount(result.notes.length, "note")}
                </span>
                <span className="recall-result-row__meta">
                  {formatResultSummaryScoreLabel(
                    summarizeSessionResult(result).ratingTotals,
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ResultsDetailPanel({
  hasAnyResults,
  result,
}: {
  hasAnyResults: boolean;
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
        <SelectedResultDetail result={result} />
      )}
    </section>
  );
}

function SelectedResultDetail({ result }: { result: FlashCardSessionResult }) {
  const summary = summarizeSessionResult(result);

  return (
    <div className="recall-results-detail">
      <header className="recall-results-detail__header">
        <div className="notes-editor__title-stack">
          <p className="section-label">Selected result</p>
          <h4>{formatDateTime(result.completedAt)}</h4>
          <p className="muted">
            {formatRecallModeLabel(result.mode)} ·{" "}
            {formatCount(result.notes.length, "note")} used
          </p>
        </div>
        <div className="recall-results-score">
          <strong>{formatResultScore(result.score ?? null)}</strong>
          <span>Score</span>
        </div>
      </header>

      <div className="recall-results-chips">
        <span className="tag">
          {formatCount(result.questions.length, "answered question")}
        </span>
        <span className="tag">
          {formatResultSummaryScoreLabel(summary.ratingTotals)}
        </span>
      </div>

      <section
        aria-labelledby="recall-result-notes-used"
        className="recall-results-section"
      >
        <h4 id="recall-result-notes-used">Notes used</h4>
        <div className="recall-snapshot-grid">
          {result.notes.map((note) => (
            <NoteSnapshotCard key={note.id} note={note} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="recall-result-questions-answers"
        className="recall-results-section"
      >
        <h4 id="recall-result-questions-answers">Questions and answers</h4>
        {result.questions.length === 0 ? (
          <p className="muted">No attempted questions were saved.</p>
        ) : (
          <div className="recall-question-review-list">
            {result.questions.map((question, index) => (
              <QuestionAnswerCard
                index={index}
                key={question.noteId}
                question={question}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NoteSnapshotCard({ note }: { note: FlashCardRecallNote }) {
  const labelText =
    (note.labels ?? []).length > 0
      ? (note.labels ?? []).map((label) => label.name).join(", ")
      : "No labels";

  return (
    <article className="recall-session-card recall-snapshot-card">
      <h5>{note.title}</h5>
      <p>{note.body}</p>
      <p className="muted">
        {labelText} · {formatCount(note.metaphors.length, "Metaphor")} ·{" "}
        {formatCount(note.acronyms.length, "Acronym")}
      </p>
    </article>
  );
}

function QuestionAnswerCard({
  index,
  question,
}: {
  index: number;
  question: RecallQuestion;
}) {
  const ratingTone = getRatingTone(question.selfRating);

  return (
    <article
      className="recall-session-card recall-question-card"
      data-tone={ratingTone}
    >
      <div className="recall-question-card__header">
        <p className="section-label">{`Question ${index + 1}`}</p>
        <span className="recall-rating-pill" data-tone={ratingTone}>
          {question.selfRating === null
            ? "Not answered"
            : formatRatingLabel(question.selfRating)}
        </span>
      </div>
      <h5>{question.noteSnapshot.title}</h5>
      <p>{question.noteSnapshot.body}</p>
      {(question.typedAnswer ?? "").length > 0 ? (
        <p className="recall-question-card__attempt">
          Answer: {question.typedAnswer}
        </p>
      ) : null}
      <p className="recall-question-card__rating">
        Score: {formatResultScore(question.score ?? null)}
      </p>
    </article>
  );
}
