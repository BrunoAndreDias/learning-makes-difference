import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import type { AppLabel } from "../features/labels/labels";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallRating,
  resolveRecallableNotesFromLabel,
} from "../features/recall/recall";
import type { AppSessionSnapshot } from "../features/session/session";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallPage,
});

function RecallPage() {
  const labelsContext = Route.useRouteContext({
    select: (context) => context.labels,
  });
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const recallContext = Route.useRouteContext({
    select: (context) => context.recall,
  });
  const sessionContext = Route.useRouteContext({
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const recallSnapshot = useSyncExternalStore<AppRecallSnapshot>(
    recallContext.subscribe,
    recallContext.getSnapshot,
    recallContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeSession =
    userId !== null && recallSnapshot?.userId === userId
      ? recallSnapshot
      : null;
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  useEffect(() => {
    if (availableLabels.length === 0) {
      setSelectedLabelId("");
      return;
    }

    const hasSelectedLabel = availableLabels.some((label) => {
      return label.id === selectedLabelId;
    });

    if (!hasSelectedLabel) {
      setSelectedLabelId(availableLabels[0].id);
    }
  }, [availableLabels, selectedLabelId]);

  useEffect(() => {
    if (userId === null || selectedLabelId === "") {
      setPreviewCount(0);
      return;
    }

    try {
      const recallableNotes = resolveRecallableNotesFromLabel({
        labelId: selectedLabelId,
        labels: labelsContext,
        notes: notesContext,
        userId,
      });

      setPreviewCount(recallableNotes.length);
    } catch {
      setPreviewCount(0);
    }
  }, [labelsContext, notesContext, selectedLabelId, userId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (userId === null || selectedLabelId === "") {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        labelId: selectedLabelId,
        userId,
      });
      setFeedbackMessage(null);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setFeedbackMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleRevealAnswer() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      recallContext.revealFlashCardAnswer({
        sessionId: activeSession.id,
        userId,
      });
      setFeedbackMessage(null);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setFeedbackMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleRateAnswer(rating: FlashCardRecallRating) {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      const completedSession = activeSession;
      const nextSession = recallContext.rateFlashCardAnswer({
        rating,
        sessionId: activeSession.id,
        userId,
      });

      if (nextSession === null) {
        setFeedbackMessage(
          `Completed all ${completedSession.notes.length} questions.`,
        );
        return;
      }

      setFeedbackMessage(null);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setFeedbackMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleEndSessionEarly() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      const endedSession = recallContext.endFlashCardSession({
        sessionId: activeSession.id,
        userId,
      });

      setFeedbackMessage(
        `Ended session early after ${endedSession.attempts.length} of ${endedSession.notes.length} questions.`,
      );
    } catch (error) {
      if (error instanceof AppRecallError) {
        setFeedbackMessage(error.message);
        return;
      }

      throw error;
    }
  }

  const currentNote =
    activeSession !== null
      ? (activeSession.notes[activeSession.currentIndex] ?? null)
      : null;

  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">Recall setup</p>
        <h3>Start a recall session</h3>
        <p>
          Pick one of your labels, gather every reachable note from that label
          and its descendants, and begin a FlashCard round in randomized order.
        </p>
        <div className="tag-row">
          <span className="tag">FlashCard only</span>
          <span className="tag">DAG-aware note selection</span>
          <span className="tag">Account scoped</span>
        </div>
      </article>

      <div className="placeholder-grid recall-layout">
        <article className="card stack">
          <p className="section-label">Session setup</p>
          {availableLabels.length === 0 ? (
            <p className="muted">
              Create a label and assign at least one note before starting
              recall.
            </p>
          ) : (
            <form
              aria-label="Recall session setup form"
              className="auth-form"
              onSubmit={handleSubmit}
            >
              <label className="auth-form__field">
                <span>Choose a label</span>
                <select
                  className="auth-form__control"
                  name="labelId"
                  onChange={(event) => setSelectedLabelId(event.target.value)}
                  value={selectedLabelId}
                >
                  {availableLabels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              </label>

              <p className="muted">{previewCount} reachable notes</p>

              <button className="auth-form__submit" type="submit">
                Start FlashCard session
              </button>
            </form>
          )}

          {feedbackMessage !== null ? (
            <p className="auth-form__error" role="alert">
              {feedbackMessage}
            </p>
          ) : null}
        </article>

        <article className="card stack">
          <p className="section-label">Selection rules</p>
          <ul className="placeholder-list">
            <li>
              <strong>Descendants included</strong>
              <p>Starting from a broad label pulls in child-topic notes too.</p>
            </li>
            <li>
              <strong>No overlap duplicates</strong>
              <p>
                Notes reachable through multiple label paths only appear once.
              </p>
            </li>
            <li>
              <strong>Unlabeled notes excluded</strong>
              <p>
                Loose capture stays out of recall until it belongs to a label.
              </p>
            </li>
          </ul>
        </article>
      </div>

      {activeSession !== null ? (
        <article className="card stack">
          <p className="section-label">In progress</p>
          <h3>FlashCard session</h3>
          <p>{`Target label: ${activeSession.labelName}`}</p>
          <div className="tag-row">
            <span className="tag">{`${activeSession.notes.length} notes in play`}</span>
            <span className="tag">{`Completed ${activeSession.attempts.length} of ${activeSession.notes.length} questions`}</span>
            <span className="tag">{`Question ${activeSession.currentIndex + 1} of ${activeSession.notes.length}`}</span>
          </div>
          {currentNote !== null ? (
            <article className="recall-session-card stack">
              <p className="section-label">Current question</p>
              <h4>{currentNote.title}</h4>
              <p className="muted">
                Attempt recall before revealing the note body.
              </p>

              {activeSession.isAnswerRevealed ? (
                <div className="recall-session-card__answer stack">
                  <p className="section-label">Answer</p>
                  <p>{currentNote.body}</p>
                </div>
              ) : null}

              <div className="recall-session-card__actions">
                {!activeSession.isAnswerRevealed ? (
                  <button
                    className="notes-action"
                    onClick={handleRevealAnswer}
                    type="button"
                  >
                    Reveal answer
                  </button>
                ) : (
                  <>
                    <button
                      className="notes-action"
                      onClick={() => handleRateAnswer("missed")}
                      type="button"
                    >
                      Missed it
                    </button>
                    <button
                      className="notes-action"
                      onClick={() => handleRateAnswer("partial")}
                      type="button"
                    >
                      Partly recalled
                    </button>
                    <button
                      className="notes-action"
                      onClick={() => handleRateAnswer("nailed")}
                      type="button"
                    >
                      Nailed it
                    </button>
                  </>
                )}
                <button
                  className="notes-action"
                  onClick={handleEndSessionEarly}
                  type="button"
                >
                  End session early
                </button>
              </div>
            </article>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
