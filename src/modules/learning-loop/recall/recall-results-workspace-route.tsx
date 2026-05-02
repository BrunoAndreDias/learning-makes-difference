import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { z } from "zod";
import { formatCount } from "../../../lib/format-count";
import type { AppSessionSnapshot } from "../../access/session/session";
import { listNotesForUser } from "../notes-workspace/notes";
import { useNotesWorkspace } from "../notes-workspace/notes-workspace";
import { formatRecallModeLabel } from "../shared/learner-copy";
import type {
  FlashCardRecallNote,
  FlashCardSessionResult,
  RecallQuestion,
} from "./recall";
import {
  deriveRecallSetupState,
  type RecallSetupCandidate,
  type RecallSetupState,
} from "./recall-setup";
import {
  getRecallWorkspaceSearch,
  getRecallWorkspaceSection,
  type RecallWorkspaceSection,
  recallWorkspaceSearchSections,
} from "./recall-workspace";
import {
  formatResultSummaryScoreLabel,
  getResultSummaryNoteCountLabel,
  type RecallResultSummary,
  summarizeSessionResult,
} from "./result-summary";

const recallWorkspaceSearchSchema = z.object({
  section: z.enum(recallWorkspaceSearchSections).optional(),
});

type FilteredRecallWorkspaceSectionName = Extract<
  RecallWorkspaceSection,
  "due" | "weak"
>;
type SessionResultsSnapshot = {
  newestSessionId: string | null;
  resultCount: number;
};

type RecallResultsNextStep = {
  description: string;
  label: string;
  search?: {
    filter: "weak";
    noteIds: string;
  };
};

const recallWorkspaceSections = [
  "practice",
  "due",
  "weak",
  "results",
] as const satisfies readonly RecallWorkspaceSection[];

const recallWorkspaceSectionContent = {
  practice: {
    description:
      "Start the next RecallSession first. Due work, weak notes, and reviews stay organized around that next action.",
    heading: "Practice",
  },
  due: {
    description:
      "Use the same due-now learning rules as Recall setup, then jump straight into session planning.",
    heading: "Due",
  },
  weak: {
    description:
      "Use the same weak-note learning rules as Recall setup to revisit misses and partial recalls.",
    heading: "Weak notes",
  },
  results: {
    description:
      "Review completed recall work with the latest session open by default.",
    heading: "Results",
  },
} satisfies Record<
  RecallWorkspaceSection,
  { description: string; heading: string }
>;

const filteredRecallWorkspaceSectionContent = {
  due: {
    emptyMessage: "No notes are due right now.",
    setupLabel: "Open due setup",
    setupSearch: { filter: "due" },
  },
  weak: {
    emptyMessage: "No weak notes yet.",
    setupLabel: "Open weak-note setup",
    setupSearch: { filter: "weak" },
  },
} satisfies Record<
  FilteredRecallWorkspaceSectionName,
  {
    emptyMessage: string;
    setupLabel: string;
    setupSearch: { filter: FilteredRecallWorkspaceSectionName };
  }
>;

export const Route = createFileRoute("/_protected/recall/")({
  validateSearch: recallWorkspaceSearchSchema,
  component: RecallResultsWorkspacePage,
});

function formatAttemptCount(count: number) {
  return formatCount(count, "attempted question", "attempted questions");
}

function formatQuestionCount(count: number) {
  return `${formatCount(count, "question")} in session`;
}

function formatSummaryCount(count: number, noun: string) {
  return formatCount(count, noun);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatStoredNoteSnapshotSummary(note: FlashCardRecallNote) {
  return [
    formatSummaryCount(note.acronyms.length, "acronym"),
    formatSummaryCount(note.metaphors.length, "metaphor"),
    formatSummaryCount(note.labelIds.length, "label"),
  ].join(" · ");
}

function formatRatingLabel(rating: "missed" | "nailed" | "partial") {
  switch (rating) {
    case "missed":
      return "Missed it";
    case "partial":
      return "Partly recalled";
    case "nailed":
      return "Nailed it";
  }
}

function getRatingTone(rating: "missed" | "nailed" | "partial" | null) {
  switch (rating) {
    case "missed":
      return "missed";
    case "partial":
      return "partial";
    case "nailed":
      return "nailed";
    case null:
      return "unattempted";
  }
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function getRecallResultsNextStep(
  summary: RecallResultSummary,
): RecallResultsNextStep {
  switch (summary.nextAction) {
    case "practice-weak-notes":
      return {
        description:
          "Run recall setup again with missed and partly recalled notes already selected.",
        label: "Practice weak notes",
        search: {
          filter: "weak",
          noteIds: summary.weakNotes.map((note) => note.noteId).join(","),
        },
      };
    case "start-next-recall":
      return {
        description:
          "This session left no weak notes. Pick the next notes to keep the loop going.",
        label: "Start another recall",
      };
    case "finish-session":
      return {
        description: "Choose notes to continue recall practice.",
        label: "Start recall",
      };
  }
}

function getSelectedSessionResult(
  sessionResults: readonly FlashCardSessionResult[],
  selectedSessionId: string | null,
) {
  if (selectedSessionId === null) {
    return null;
  }

  return (
    sessionResults.find((result) => result.id === selectedSessionId) ?? null
  );
}

function getSessionResultsSnapshot(
  sessionResults: readonly FlashCardSessionResult[],
): SessionResultsSnapshot {
  return {
    newestSessionId: sessionResults[0]?.id ?? null,
    resultCount: sessionResults.length,
  };
}

function hasAddedNewNewestSessionResult(
  previousSessionResults: SessionResultsSnapshot,
  currentSessionResults: SessionResultsSnapshot,
) {
  return (
    previousSessionResults.newestSessionId !== null &&
    currentSessionResults.newestSessionId !== null &&
    currentSessionResults.newestSessionId !==
      previousSessionResults.newestSessionId &&
    currentSessionResults.resultCount > previousSessionResults.resultCount
  );
}

function shouldSelectNewestSessionResult({
  currentSessionResults,
  previousSessionResults,
  selectedSessionId,
  sessionResults,
}: {
  currentSessionResults: SessionResultsSnapshot;
  previousSessionResults: SessionResultsSnapshot;
  selectedSessionId: string | null;
  sessionResults: readonly FlashCardSessionResult[];
}) {
  const selectedSessionStillExists = sessionResults.some((result) => {
    return result.id === selectedSessionId;
  });

  if (!selectedSessionStillExists) {
    return true;
  }

  if (
    previousSessionResults.resultCount === 0 &&
    currentSessionResults.newestSessionId !== selectedSessionId
  ) {
    return true;
  }

  return hasAddedNewNewestSessionResult(
    previousSessionResults,
    currentSessionResults,
  );
}

function getSectionHeading(section: RecallWorkspaceSection) {
  return recallWorkspaceSectionContent[section].heading;
}

function getSectionDescription(section: RecallWorkspaceSection) {
  return recallWorkspaceSectionContent[section].description;
}

function RecallWorkspaceSectionNav({
  activeSection,
}: {
  activeSection: RecallWorkspaceSection;
}) {
  return (
    <nav aria-label="Recall sections" className="tag-row">
      {recallWorkspaceSections.map((section) => (
        <Link
          aria-current={activeSection === section ? "page" : undefined}
          className="tag"
          key={section}
          search={getRecallWorkspaceSearch(section)}
          to="/recall"
        >
          {getSectionHeading(section)}
        </Link>
      ))}
    </nav>
  );
}

function RecallWorkspaceEmptyState({
  actionLabel,
  actionTo,
  body,
  title,
}: {
  actionLabel: string;
  actionTo: "/notes" | "/recall/select";
  body: string;
  title: string;
}) {
  return (
    <section className="recall-panel">
      <h4>{title}</h4>
      <p className="muted">{body}</p>
      <Link className="notes-action notes-action-primary" to={actionTo}>
        {actionLabel}
      </Link>
    </section>
  );
}

function RecallWorkspaceCandidateList({
  candidates,
}: {
  candidates: readonly RecallSetupCandidate[];
}) {
  return (
    <ul aria-label="Recall workspace notes" className="notes-list__items">
      {candidates.map((candidate) => (
        <li key={candidate.note.id}>
          <article className="notes-list__item">
            <div className="stack">
              <strong>{candidate.note.title}</strong>
              <span>{candidate.note.body}</span>
              {candidate.latestRating !== null ? (
                <span className="muted">
                  {`Latest rating: ${formatRatingLabel(candidate.latestRating)}`}
                </span>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function PracticeWorkspaceSection({
  dueCount,
  hasResults,
  noteCount,
  weakCount,
}: {
  dueCount: number;
  hasResults: boolean;
  noteCount: number;
  weakCount: number;
}) {
  if (noteCount === 0) {
    return (
      <RecallWorkspaceEmptyState
        actionLabel="Go to Notes"
        actionTo="/notes"
        body="Create notes first, then come back to start recall."
        title="No recallable notes yet"
      />
    );
  }

  return (
    <div className="recall-selection-layout">
      <section className="recall-panel">
        <p className="section-label">Practice</p>
        <h4>Start a new RecallSession</h4>
        <p className="muted">
          Build the next practice session first, then use Due, Weak notes, and
          Results as support views.
        </p>
        <div className="tag-row notes-editor__labels">
          <span className="tag">{formatCount(noteCount, "note")}</span>
          <span className="tag">{formatCount(dueCount, "due note")}</span>
          <span className="tag">{formatCount(weakCount, "weak note")}</span>
        </div>
        <Link className="notes-action notes-action-primary" to="/recall/select">
          Start recall
        </Link>
      </section>

      <section className="recall-panel">
        <p className="section-label">Due</p>
        <h4>Practice what is ready now</h4>
        <p className="muted">
          Open the due-now view to keep timing aligned with the learning state.
        </p>
        <div className="tag-row notes-editor__labels">
          <span className="tag">{formatCount(dueCount, "note")}</span>
        </div>
        <Link
          className="notes-action"
          search={getRecallWorkspaceSearch("due")}
          to="/recall"
        >
          View due notes
        </Link>
      </section>

      <section className="recall-panel">
        <p className="section-label">Weak notes</p>
        <h4>Reinforce misses and partial recalls</h4>
        <p className="muted">
          Jump into the weak-note view when you want targeted follow-up
          practice.
        </p>
        <div className="tag-row notes-editor__labels">
          <span className="tag">{formatCount(weakCount, "note")}</span>
        </div>
        <Link
          className="notes-action"
          search={getRecallWorkspaceSearch("weak")}
          to="/recall"
        >
          View weak notes
        </Link>
      </section>

      <section className="recall-panel">
        <p className="section-label">Results</p>
        <h4>Review saved sessions without losing the next step</h4>
        <p className="muted">
          Open session history when you need review. The next practice action
          stays here.
        </p>
        <div className="tag-row notes-editor__labels">
          <span className="tag">
            {hasResults ? "Review history available" : "No results yet"}
          </span>
        </div>
        <Link
          className="notes-action"
          search={getRecallWorkspaceSearch("results")}
          to="/recall"
        >
          Review results
        </Link>
      </section>
    </div>
  );
}

function FilteredRecallWorkspaceSection({
  candidates,
  noteCount,
  section,
}: {
  candidates: readonly RecallSetupCandidate[];
  noteCount: number;
  section: FilteredRecallWorkspaceSectionName;
}) {
  const sectionContent = filteredRecallWorkspaceSectionContent[section];
  const sectionHeading = getSectionHeading(section);

  if (noteCount === 0) {
    return (
      <RecallWorkspaceEmptyState
        actionLabel="Go to Notes"
        actionTo="/notes"
        body="Create notes first, then come back to start recall."
        title="No recallable notes yet"
      />
    );
  }

  return (
    <div className="recall-results-detail">
      <section className="recall-panel">
        <p className="section-label">{sectionHeading}</p>
        <h4>{sectionHeading}</h4>
        <p className="muted">{getSectionDescription(section)}</p>
        <div className="tag-row notes-editor__labels">
          <span className="tag">{formatCount(candidates.length, "note")}</span>
        </div>
        <Link
          className="notes-action notes-action-primary"
          search={sectionContent.setupSearch}
          to="/recall/select"
        >
          {sectionContent.setupLabel}
        </Link>
      </section>

      <section className="recall-panel notes-list">
        <div className="notes-list__header">
          <div className="stack">
            <p className="section-label">{sectionHeading}</p>
            <h4>Available notes</h4>
            <p className="muted">
              These notes come from the same setup logic used in Recall
              selection mode.
            </p>
          </div>
        </div>
        {candidates.length === 0 ? (
          <p className="notes-search__empty" role="status">
            {sectionContent.emptyMessage}
          </p>
        ) : (
          <RecallWorkspaceCandidateList candidates={candidates} />
        )}
      </section>
    </div>
  );
}

function RecallWorkspaceContent({
  activeSection,
  dueSetupState,
  hasResults,
  noteCount,
  selectedSession,
  weakSetupState,
}: {
  activeSection: RecallWorkspaceSection;
  dueSetupState: RecallSetupState;
  hasResults: boolean;
  noteCount: number;
  selectedSession: FlashCardSessionResult | null;
  weakSetupState: RecallSetupState;
}) {
  switch (activeSection) {
    case "practice":
      return (
        <PracticeWorkspaceSection
          dueCount={dueSetupState.visibleCandidates.length}
          hasResults={hasResults}
          noteCount={noteCount}
          weakCount={weakSetupState.visibleCandidates.length}
        />
      );
    case "due":
      return (
        <FilteredRecallWorkspaceSection
          candidates={dueSetupState.visibleCandidates}
          noteCount={noteCount}
          section="due"
        />
      );
    case "weak":
      return (
        <FilteredRecallWorkspaceSection
          candidates={weakSetupState.visibleCandidates}
          noteCount={noteCount}
          section="weak"
        />
      );
    case "results":
      return (
        <div className="recall-results-layout recall-results-layout--details-only">
          <section aria-label="Selected review" className="recall-panel">
            <p className="section-label">Selected review</p>
            <SelectedSessionResult sessionResult={selectedSession} />
          </section>
        </div>
      );
  }
}

export function RecallResultsWorkspacePage() {
  const search = Route.useSearch();
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
  const {
    selectedRecallLabelId,
    selectedRecallSessionId,
    selectRecallSession,
  } = useNotesWorkspace();
  const activeSection = getRecallWorkspaceSection(search);
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
  const selectedLabelFilter =
    selectedRecallLabelId.length === 0 ? undefined : selectedRecallLabelId;
  const notes = listNotesForUser(notesSnapshot, userId);
  const labels = userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const allSessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelFilter,
          userId,
        });
  const previousSessionResultsRef = useRef<SessionResultsSnapshot>({
    newestSessionId: null,
    resultCount: 0,
  });
  const now = new Date().toISOString();
  const dueSetupState = deriveRecallSetupState({
    labels,
    notes,
    now,
    searchQuery: "",
    selectedFilter: { kind: "due" },
    selectedNoteIds: [],
    sessionResults: allSessionResults,
  });
  const weakSetupState = deriveRecallSetupState({
    labels,
    notes,
    now,
    searchQuery: "",
    selectedFilter: { kind: "weak" },
    selectedNoteIds: [],
    sessionResults: allSessionResults,
  });

  useEffect(() => {
    const currentSessionResults = getSessionResultsSnapshot(sessionResults);

    if (sessionResults.length === 0) {
      selectRecallSession(null);
      previousSessionResultsRef.current = currentSessionResults;
      return;
    }

    if (
      shouldSelectNewestSessionResult({
        currentSessionResults,
        previousSessionResults: previousSessionResultsRef.current,
        selectedSessionId: selectedRecallSessionId,
        sessionResults,
      })
    ) {
      selectRecallSession(currentSessionResults.newestSessionId);
    }

    previousSessionResultsRef.current = currentSessionResults;
  }, [selectRecallSession, selectedRecallSessionId, sessionResults]);

  const selectedSession = getSelectedSessionResult(
    sessionResults,
    selectedRecallSessionId,
  );

  return (
    <section aria-label="Recall workspace" className="recall-workspace">
      <article className="recall-surface">
        <header className="recall-surface__header">
          <div className="notes-editor__title-stack">
            <h3>{getSectionHeading(activeSection)}</h3>
            <p className="muted notes-editor__meta">
              {getSectionDescription(activeSection)}
            </p>
            <RecallWorkspaceSectionNav activeSection={activeSection} />
          </div>
        </header>

        <RecallWorkspaceContent
          activeSection={activeSection}
          dueSetupState={dueSetupState}
          hasResults={sessionResults.length > 0}
          noteCount={notes.length}
          selectedSession={selectedSession}
          weakSetupState={weakSetupState}
        />
      </article>
    </section>
  );
}

function SelectedSessionResult({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult | null;
}) {
  if (sessionResult === null) {
    return (
      <div className="recall-results-empty">
        <p className="section-label">Nothing selected</p>
        <h4>No review selected</h4>
        <p className="muted">
          Complete a recall session to review stored note snapshots and prompt
          ratings.
        </p>
      </div>
    );
  }

  const summary = summarizeSessionResult(sessionResult);
  const nextStep = getRecallResultsNextStep(summary);

  return (
    <div className="recall-results-detail">
      <div className="recall-results-primary-grid">
        <div className="recall-results-summary">
          <header className="recall-results-hero">
            <div className="notes-editor__title-stack">
              <p className="section-label">Session review</p>
              <h4>Session overview</h4>
              <p className="muted">
                Completed {formatDateTime(sessionResult.completedAt)}
              </p>
            </div>
            <div className="recall-results-score">
              <strong>{formatPercent(summary.completionRate)}</strong>
              <span>answered</span>
            </div>
          </header>

          <section
            aria-labelledby="selected-session-details-heading"
            className="recall-results-section"
          >
            <h4 id="selected-session-details-heading">Session details</h4>
            <div className="recall-results-metrics">
              <div className="recall-results-metric">
                <span className="section-label">Mode</span>
                <strong>{formatRecallModeLabel(sessionResult.mode)}</strong>
                <p className="sr-only">
                  Mode: {formatRecallModeLabel(sessionResult.mode)}
                </p>
              </div>
              <div className="recall-results-metric">
                <span className="section-label">Started</span>
                <strong>{formatDateTime(sessionResult.createdAt)}</strong>
                <p className="sr-only">
                  Started: {formatDateTime(sessionResult.createdAt)}
                </p>
              </div>
              <div className="recall-results-metric">
                <span className="section-label">Completed</span>
                <strong>{formatDateTime(sessionResult.completedAt)}</strong>
                <p className="sr-only">
                  Completed: {formatDateTime(sessionResult.completedAt)}
                </p>
              </div>
            </div>
            <div className="recall-results-chips">
              <span className="tag">
                {getResultSummaryNoteCountLabel(sessionResult.notes)}
              </span>
              <span className="tag">
                {formatAttemptCount(summary.completionCount)}
              </span>
              <span className="tag">
                {formatQuestionCount(summary.questionCount)}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="selected-score-summary-heading"
            className="recall-results-section"
          >
            <h4 id="selected-score-summary-heading">Memory summary</h4>
            <div className="recall-rating-summary">
              <RatingSummaryItem
                count={summary.ratingTotals.nailed}
                label="Nailed"
                tone="nailed"
              />
              <RatingSummaryItem
                count={summary.ratingTotals.partial}
                label="Partial"
                tone="partial"
              />
              <RatingSummaryItem
                count={summary.ratingTotals.missed}
                label="Missed"
                tone="missed"
              />
            </div>
            <p className="recall-results-score-copy">
              {formatResultSummaryScoreLabel(summary.ratingTotals)}
            </p>
          </section>

          {summary.weakNotes.length > 0 ? (
            <section
              aria-labelledby="selected-weak-notes-heading"
              className="recall-results-section"
            >
              <h4 id="selected-weak-notes-heading">Weak notes</h4>
              <div className="recall-results-chips">
                {summary.weakNotes.map((note) => (
                  <span className="tag" key={note.noteId}>
                    {note.title} · {formatRatingLabel(note.rating)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="selected-next-step-heading"
            className="recall-results-section"
          >
            <h4 id="selected-next-step-heading">Next step</h4>
            <p className="muted">{nextStep.description}</p>
            <Link
              className="notes-action notes-action-primary"
              search={nextStep.search}
              to="/recall/select"
            >
              {nextStep.label}
            </Link>
          </section>
        </div>

        <section
          aria-labelledby="selected-question-review-heading"
          className="recall-results-section recall-results-section--review"
        >
          <h4 id="selected-question-review-heading">Prompt review</h4>
          <ResultsSessionReview sessionResult={sessionResult} />
        </section>
      </div>

      <section
        aria-labelledby="selected-stored-note-snapshots-heading"
        className="recall-results-section recall-results-section--snapshots"
      >
        <div className="notes-editor__title-stack">
          <p className="section-label">Selected notes</p>
          <h4 id="selected-stored-note-snapshots-heading">
            Stored note snapshots
          </h4>
          <p className="muted">
            Snapshot content stays pinned to what was reviewed in this session.
          </p>
        </div>
        <StoredNoteSnapshotSummary notes={sessionResult.notes} />
      </section>
    </div>
  );
}

function RatingSummaryItem({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "missed" | "nailed" | "partial";
}) {
  return (
    <div className="recall-rating-summary__item" data-tone={tone}>
      <strong>{count}</strong>
      <span>{label}</span>
    </div>
  );
}

function ResultsSessionReview({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult;
}) {
  return (
    <div className="recall-question-review-list">
      {sessionResult.questions.map((question, index) => {
        const ratingTone = getRatingTone(question.selfRating);

        return (
          <article
            className="recall-session-card recall-question-card"
            data-tone={ratingTone}
            key={question.noteId}
          >
            <div className="recall-question-card__header">
              <p className="section-label">{`Prompt ${index + 1}`}</p>
              <span className="recall-rating-pill" data-tone={ratingTone}>
                {formatQuestionRating(question)}
              </span>
            </div>
            <h5>{question.noteSnapshot.title}</h5>
            {(question.typedAnswer ?? "").length > 0 ? (
              <p className="recall-question-card__attempt">
                Your attempt: {question.typedAnswer}
              </p>
            ) : null}
            <p>{question.noteSnapshot.body}</p>
            <p className="recall-question-card__rating">
              Rating: {formatQuestionRating(question)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function formatQuestionRating(question: RecallQuestion) {
  return question.selfRating === null
    ? "Not attempted"
    : formatRatingLabel(question.selfRating);
}

function StoredNoteSnapshotSummary({
  notes,
}: {
  notes: readonly FlashCardRecallNote[];
}) {
  return (
    <div className="recall-snapshot-grid">
      {notes.map((note) => {
        return (
          <article
            className="recall-session-card recall-snapshot-card"
            key={note.id}
          >
            <h5>{note.title}</h5>
            <p>{note.body}</p>
            <p className="muted">{formatStoredNoteSnapshotSummary(note)}</p>
          </article>
        );
      })}
    </div>
  );
}
