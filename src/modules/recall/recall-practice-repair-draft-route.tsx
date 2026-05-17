import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { FloatingTextarea } from "../../design-system/floating-textarea";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import {
  AppRecallError,
  type FlashCardSessionResult,
  type RecallQuestion,
} from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getQuestionPracticeRepairDraft,
  type PracticeRepairIntent,
} from "./recall-practice-repair";
import {
  getRecallQuestionExpectedAnswer,
  getRecallQuestionPrompt,
  getRecallQuestionRecordedAnswer,
} from "./recall-question-evidence";

export const Route = createFileRoute(
  "/_protected/recall/results/$sessionResultId/questions/$questionResultId/repair",
)({
  component: RecallPracticeRepairDraftRoute,
});

type PracticeRepairDraftWorkspace = {
  question: RecallQuestion;
  questionIndex: number;
  questionResultId: string;
  sessionResultId: string;
};

type DraftPracticeRepairIntentCard = {
  correctionPlaceholder: string;
  description: string;
  intent: PracticeRepairIntent;
  selectionDescription: string;
  title: string;
};

const draftIntentCards = [
  {
    correctionPlaceholder:
      "State what the expected answer should clarify or add.",
    description:
      "Refine or expand the answer so the next recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    selectionDescription:
      "Use this when Needs practice means the expected answer is too loose, incomplete, or hard to judge.",
    title: "Edit expected answer",
  },
  {
    correctionPlaceholder:
      "State what should split out and how the original Study Note should narrow.",
    description:
      "Break a broad concept into smaller, focused Study Notes you can train one at a time.",
    intent: "split-study-note",
    selectionDescription:
      "Use this when Needs practice points to more than one idea inside the same Study Note.",
    title: "Split this Study Note",
  },
  {
    correctionPlaceholder:
      "State which related concept or contrast should become the sibling Study Note.",
    description:
      "Add a related concept or contrast from the same source explanation.",
    intent: "create-sibling-study-note",
    selectionDescription:
      "Use this when the missed detail belongs in another Study Note from the same source explanation.",
    title: "Create a sibling Study Note",
  },
  {
    correctionPlaceholder:
      "State the memory hook you want to add later as a Metaphor or Acronym.",
    description:
      "Use a Metaphor or Acronym only if it solves this recall problem.",
    intent: "add-memory-aid",
    selectionDescription:
      "Use this when a Metaphor or Acronym would make the answer easier to retrieve next time.",
    title: "Add a memory aid",
  },
] as const satisfies readonly DraftPracticeRepairIntentCard[];

const recallAgainSoonCard = {
  description:
    "Use this after the Practice Repair is complete to test the note again soon.",
  title: "Recall again soon",
} as const;

function findDraftIntentCard(
  intent: PracticeRepairIntent,
): DraftPracticeRepairIntentCard {
  const card = draftIntentCards.find(
    (candidate) => candidate.intent === intent,
  );

  if (card === undefined) {
    throw new Error(`Unknown Practice Repair intent: ${intent}`);
  }

  return card;
}

function getStudyNoteMeta(question: Pick<RecallQuestion, "noteSnapshot">) {
  const labels = question.noteSnapshot.labels
    ?.map((label) => label.name.trim())
    .filter((label) => label.length > 0);

  if (labels !== undefined && labels.length > 0) {
    return labels.join(" · ");
  }

  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return "Results evidence";
}

function findPracticeRepairDraftWorkspace(input: {
  questionResultId: string;
  sessionResultId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairDraftWorkspace | null {
  const { questionResultId, sessionResultId, sessionResults } = input;
  const result = sessionResults.find(
    (candidate) => candidate.id === sessionResultId,
  );

  if (result === undefined) {
    return null;
  }

  const questionIndex = result.questions.findIndex(
    (candidate) => candidate.questionResultId === questionResultId,
  );
  const question =
    questionIndex < 0 ? undefined : result.questions[questionIndex];

  if (question === undefined) {
    return null;
  }

  return {
    question,
    questionIndex,
    questionResultId,
    sessionResultId,
  };
}

function RecallPracticeRepairDraftRoute() {
  const { questionResultId, sessionResultId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const workspace = findPracticeRepairDraftWorkspace({
    questionResultId,
    sessionResultId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/recall" />;
  }

  const canOpenDraft =
    workspace.question.practiceRepairEntry !== undefined ||
    getQuestionPracticeRepairDraft(workspace.question) !== null;

  if (!canOpenDraft) {
    return <Navigate to="/recall" />;
  }

  return <RecallPracticeRepairDraftPage workspace={workspace} />;
}

function RecallPracticeRepairDraftPage({
  workspace,
}: Readonly<{
  workspace: PracticeRepairDraftWorkspace;
}>) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const { question } = workspace;
  const prompt = getRecallQuestionPrompt(question);
  const expectedAnswer = getRecallQuestionExpectedAnswer(question);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);
  const [selectedIntent, setSelectedIntent] =
    useState<PracticeRepairIntent | null>(null);
  const [correction, setCorrection] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const correctionRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedCard =
    selectedIntent === null ? null : findDraftIntentCard(selectedIntent);

  useEffect(() => {
    if (selectedIntent !== null) {
      correctionRef.current?.focus();
    }
  }, [selectedIntent]);

  function clearSelection() {
    setSelectedIntent(null);
    setCorrection("");
    setErrorMessage(null);
  }

  function selectIntent(intent: PracticeRepairIntent) {
    setSelectedIntent(intent);
    setCorrection("");
    setErrorMessage(null);
  }

  function handleIntentCardKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    intent: PracticeRepairIntent,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectIntent(intent);
  }

  async function handleConfirmPracticeRepair(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (selectedCard === null || userId === null) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const reference = {
        questionIndex: workspace.questionIndex,
        questionResultId: workspace.questionResultId,
        sessionResultId: workspace.sessionResultId,
        studyNoteId: question.noteId,
      };
      const updatedResult =
        persistentRecallContext === undefined
          ? recallContext.confirmPracticeRepairEntry({
              correction,
              intent: selectedCard.intent,
              reference,
              userId,
            })
          : await persistentRecallContext.confirmPracticeRepairEntry(userId, {
              correction,
              intent: selectedCard.intent,
              reference,
            });
      const confirmedEntry =
        updatedResult.questions[workspace.questionIndex]?.practiceRepairEntry;

      if (confirmedEntry === undefined) {
        throw new Error("Expected a confirmed Practice Repair entry.");
      }

      await navigate({
        params: {
          practiceRepairEntryId: getPracticeRepairEntryId(confirmedEntry),
        },
        to: "/recall/repair/$practiceRepairEntryId",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : "Practice Repair could not be confirmed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-label="Practice Repair draft" className="recall-workspace">
      <article className="recall-surface recall-practice-repair-draft">
        <PageHeader
          actions={
            <ButtonLink to="/recall/results" variant="secondary">
              Open Results
            </ButtonLink>
          }
          beforeTitle={<RecallBreadcrumb currentLabel="Practice Repair" />}
          className="recall-surface__header"
          description="This recall needs practice. Review the original evidence before choosing a repair."
          headingLevel={1}
          title="Practice Repair"
        />

        <div className="recall-practice-repair-draft__layout">
          <section
            aria-label="Practice Repair evidence"
            className="recall-panel recall-practice-repair-draft__evidence"
          >
            <header className="recall-practice-repair-draft__card-header">
              <div className="recall-practice-repair-draft__card-copy">
                <p className="recall-practice-repair-draft__eyebrow">
                  Study Note
                </p>
                <h2 className="recall-practice-repair-draft__study-note-title">
                  {prompt}
                </h2>
                <p className="recall-practice-repair-draft__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              <ButtonLink to="/study-notes" variant="secondary">
                View note
              </ButtonLink>
            </header>

            <section className="recall-practice-repair-draft__detail">
              <p className="recall-practice-repair-draft__detail-label">
                Prompt (what you were asked)
              </p>
              <p className="recall-practice-repair-draft__detail-copy">
                {prompt}
              </p>
            </section>

            <section className="recall-practice-repair-draft__detail">
              <div className="recall-practice-repair-draft__detail-header">
                <p className="recall-practice-repair-draft__detail-label">
                  Your answer
                </p>
                <span
                  className="recall-selected-result__row-pill recall-practice-repair-draft__rating"
                  data-rating-tone={ratingTone}
                >
                  {ratingLabel}
                </span>
              </div>
              <p className="recall-practice-repair-draft__detail-copy">
                {getRecallQuestionRecordedAnswer(question)}
              </p>
            </section>

            <section className="recall-practice-repair-draft__detail">
              <p className="recall-practice-repair-draft__detail-label">
                Expected answer
              </p>
              <p className="recall-practice-repair-draft__detail-copy">
                {expectedAnswer}
              </p>
            </section>

            <section className="recall-practice-repair-draft__callout">
              <strong>{`Last score: ${ratingLabel}`}</strong>
              <p>
                Needs practice is a signal to adjust and reinforce before the
                next recall.
              </p>
            </section>
          </section>

          <aside
            aria-label="Suggested repairs"
            className="recall-panel recall-practice-repair-draft__suggestions"
          >
            <div className="recall-practice-repair-draft__suggestions-copy">
              <h2>Suggested repairs</h2>
              <p>Pick one small action to strengthen this Study Note.</p>
            </div>

            <div className="recall-practice-repair-draft__suggestion-list">
              {draftIntentCards.map((card) => {
                const isSelected = selectedIntent === card.intent;
                const titleId = `practice-repair-draft-card-title-${card.intent}`;
                const descriptionId = `practice-repair-draft-card-description-${card.intent}`;

                return (
                  <article
                    className="recall-practice-repair-draft__suggestion"
                    data-selected={isSelected ? "true" : "false"}
                    key={card.intent}
                  >
                    <button
                      aria-describedby={descriptionId}
                      aria-labelledby={titleId}
                      aria-pressed={isSelected}
                      className="recall-practice-repair-draft__suggestion-button"
                      onClick={() => selectIntent(card.intent)}
                      onKeyDown={(event) =>
                        handleIntentCardKeyDown(event, card.intent)
                      }
                      type="button"
                    >
                      <span className="recall-practice-repair-draft__suggestion-copy">
                        <span
                          className="recall-practice-repair-draft__suggestion-title"
                          id={titleId}
                        >
                          {card.title}
                        </span>
                        <span
                          className="recall-practice-repair-draft__suggestion-description"
                          id={descriptionId}
                        >
                          {card.description}
                        </span>
                      </span>

                      <span
                        aria-hidden="true"
                        className="recall-practice-repair-draft__suggestion-chevron"
                      >
                        <SuggestionChevronIcon />
                      </span>
                    </button>
                  </article>
                );
              })}

              <article className="recall-practice-repair-draft__suggestion">
                <div className="recall-practice-repair-draft__suggestion-static">
                  <span className="recall-practice-repair-draft__suggestion-copy">
                    <span className="recall-practice-repair-draft__suggestion-title">
                      {recallAgainSoonCard.title}
                    </span>
                    <span className="recall-practice-repair-draft__suggestion-description">
                      {recallAgainSoonCard.description}
                    </span>
                  </span>
                </div>
              </article>
            </div>

            {selectedCard === null ? null : (
              <form
                aria-label="Practice Repair confirmation"
                className="recall-practice-repair-draft__selection"
                onSubmit={(event) => {
                  void handleConfirmPracticeRepair(event);
                }}
              >
                <div className="recall-practice-repair-draft__selection-copy">
                  <p className="recall-practice-repair-draft__eyebrow">
                    Selected repair
                  </p>
                  <h3>{selectedCard.title}</h3>
                  <p>{selectedCard.selectionDescription}</p>
                </div>

                <div className="recall-practice-repair-draft__selection-detail">
                  <p className="recall-practice-repair-draft__selection-label">
                    Practice Repair intent
                  </p>
                  <p className="recall-practice-repair-draft__selection-value">
                    {formatPracticeRepairIntentLabel(selectedCard.intent)}
                  </p>
                </div>

                <p className="recall-practice-repair-draft__selection-note">
                  This repair candidate stays in draft until you confirm this
                  Practice Repair.
                </p>

                <FloatingTextarea
                  label="Correction"
                  minLength={1}
                  onChange={(event) => {
                    setCorrection(event.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder={selectedCard.correctionPlaceholder}
                  ref={correctionRef}
                  rows={4}
                  value={correction}
                />

                {errorMessage === null ? null : (
                  <p
                    className="recall-practice-repair-draft__selection-error"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}

                <div className="recall-practice-repair-draft__selection-actions">
                  <Button
                    disabled={isSubmitting || correction.trim().length === 0}
                    type="submit"
                    variant="primary"
                  >
                    Confirm Practice Repair
                  </Button>
                  <Button
                    onClick={clearSelection}
                    type="button"
                    variant="secondary"
                  >
                    Clear selection
                  </Button>
                </div>
              </form>
            )}
          </aside>
        </div>

        <p className="recall-practice-repair-draft__support">
          Metaphors and acronyms are optional support material, not required.
        </p>
      </article>
    </section>
  );
}

function SuggestionChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.5 11.5 9 7 13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
