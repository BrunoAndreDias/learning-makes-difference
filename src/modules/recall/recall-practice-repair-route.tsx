import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import type { KeyboardEvent, ReactNode } from "react";

import { ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { FlashCardSessionResult, RecallQuestion } from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getPracticeRepairEntryLifecycleKind,
  getPracticeRepairEntryLifecycleLabel,
  getPracticeRepairEntryLifecycleSummary,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceText,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
  type PracticeRepairEntry,
  type PracticeRepairEntryLifecycleKind,
  type PracticeRepairIntent,
} from "./recall-practice-repair";

export const Route = createFileRoute(
  "/_protected/recall/repair/$practiceRepairEntryId",
)({
  component: RecallPracticeRepairRoute,
});

type PracticeRepairWorkspace = {
  entry: PracticeRepairEntry;
  question: RecallQuestion;
  result: FlashCardSessionResult;
};

type PracticeRepairWorkspaceActionCard = {
  description: string;
  intent: PracticeRepairIntent;
  title: string;
};

const workspaceActionCards = [
  {
    description:
      "Refine or expand the answer so the recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller Study Notes you can train one at a time.",
    intent: "split-study-note",
    title: "Split this Study Note",
  },
  {
    description:
      "Add a related concept or contrast from the same source explanation.",
    intent: "create-sibling-study-note",
    title: "Create a sibling Study Note",
  },
  {
    description:
      "Add a Metaphor or Acronym only when it would make the answer easier to retrieve.",
    intent: "add-memory-aid",
    title: "Add a memory aid",
  },
] as const satisfies readonly PracticeRepairWorkspaceActionCard[];

function findPracticeRepairWorkspace(input: {
  practiceRepairEntryId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairWorkspace | null {
  const { practiceRepairEntryId, sessionResults } = input;

  for (const result of sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === practiceRepairEntryId
      ) {
        return {
          entry,
          question,
          result,
        };
      }
    }
  }

  return null;
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

function getPracticeRepairLifecycleTone(
  lifecycleKind: PracticeRepairEntryLifecycleKind,
) {
  switch (lifecycleKind) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "dismissed":
    case "follow-up-satisfied":
    case "study-note-deleted":
    case "superseded":
      return "historical";
  }
}

function getPracticeRepairNextStepCopy(
  lifecycleKind: PracticeRepairEntryLifecycleKind,
) {
  switch (lifecycleKind) {
    case "completed":
      return "Use Recall again soon after the repair work is complete to test this Study Note again.";
    case "active":
      return "Make the repair in Study Notes, then come back here to continue the repair loop from the original evidence.";
    case "dismissed":
    case "follow-up-satisfied":
    case "study-note-deleted":
    case "superseded":
      return "Use Results for the full historical context, and use Recall when you want to revisit this Study Note again.";
  }
}

function createStudyNotesPracticeRepairSearch(input: {
  practiceRepairAction?: PracticeRepairIntent;
  practiceRepairEntryId: string;
}) {
  const search: {
    practiceRepairAction?: PracticeRepairIntent;
    practiceRepairEntryId: string;
  } = {
    practiceRepairEntryId: input.practiceRepairEntryId,
  };

  if (input.practiceRepairAction !== undefined) {
    search.practiceRepairAction = input.practiceRepairAction;
  }

  return search;
}

function isActionSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

function PracticeRepairWorkspaceDetail({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <section className="recall-practice-repair-workspace__detail">
      <p className="recall-practice-repair-workspace__detail-label">{label}</p>
      <div className="recall-practice-repair-workspace__detail-copy">
        {children}
      </div>
    </section>
  );
}

function RecallPracticeRepairRoute() {
  const { practiceRepairEntryId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const workspace = findPracticeRepairWorkspace({
    practiceRepairEntryId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/recall" />;
  }

  return <RecallPracticeRepairWorkspacePage workspace={workspace} />;
}

function RecallPracticeRepairWorkspacePage({
  workspace,
}: Readonly<{
  workspace: PracticeRepairWorkspace;
}>) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { entry, question, result } = workspace;
  const practiceRepairEntryId = getPracticeRepairEntryId(entry);
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const referenceText = getPracticeRepairQuestionReferenceText(question);
  const lifecycleKind = getPracticeRepairEntryLifecycleKind(entry);
  const lifecycleLabel = getPracticeRepairEntryLifecycleLabel(entry);
  const lifecycleSummary = getPracticeRepairEntryLifecycleSummary(entry);
  const lifecycleTone = getPracticeRepairLifecycleTone(lifecycleKind);
  const nextStepCopy = getPracticeRepairNextStepCopy(lifecycleKind);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);

  function openStudyNotesPracticeRepair(
    practiceRepairAction?: PracticeRepairIntent,
  ) {
    void navigate({
      search: createStudyNotesPracticeRepairSearch({
        practiceRepairAction,
        practiceRepairEntryId,
      }),
      to: "/study-notes",
    });
  }

  return (
    <section
      aria-label="Practice Repair workspace"
      className="recall-workspace"
    >
      <article className="recall-surface recall-practice-repair-workspace">
        <PageHeader
          actions={
            <ButtonLink to="/recall/repair" variant="secondary">
              Practice Repair Queue
            </ButtonLink>
          }
          beforeTitle={<RecallBreadcrumb currentLabel="Practice Repair" />}
          className="recall-surface__header"
          description="Keep the original Needs practice evidence visible while you finish one concrete repair from Recall."
          headingLevel={1}
          title="Practice Repair"
        />

        <div className="recall-practice-repair-workspace__layout">
          <section
            aria-label="Practice Repair evidence"
            className="recall-panel recall-practice-repair-workspace__evidence"
          >
            <header className="recall-practice-repair-workspace__card-header">
              <div className="recall-practice-repair-workspace__card-copy">
                <p className="recall-practice-repair-workspace__eyebrow">
                  Study Note
                </p>
                <h2 className="recall-practice-repair-workspace__study-note-title">
                  {prompt}
                </h2>
                <p className="recall-practice-repair-workspace__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              <ButtonLink
                search={createStudyNotesPracticeRepairSearch({
                  practiceRepairEntryId,
                })}
                to="/study-notes"
                variant="secondary"
              >
                View note
              </ButtonLink>
            </header>

            <PracticeRepairWorkspaceDetail label="Prompt (what you were asked)">
              {prompt}
            </PracticeRepairWorkspaceDetail>

            <section className="recall-practice-repair-workspace__detail">
              <div className="recall-practice-repair-workspace__detail-header">
                <p className="recall-practice-repair-workspace__detail-label">
                  Your answer
                </p>
                <span
                  className="recall-selected-result__row-pill recall-practice-repair-workspace__rating"
                  data-rating-tone={ratingTone}
                >
                  {ratingLabel}
                </span>
              </div>
              <div className="recall-practice-repair-workspace__detail-copy">
                {getPracticeRepairRecordedAnswer(question)}
              </div>
            </section>

            <PracticeRepairWorkspaceDetail label="Expected answer">
              {expectedAnswer}
            </PracticeRepairWorkspaceDetail>

            <PracticeRepairWorkspaceDetail label="Reference explanation">
              <strong>{referenceTitle}</strong>
              <span>{referenceText}</span>
            </PracticeRepairWorkspaceDetail>

            <section className="recall-practice-repair-workspace__callout">
              <strong>{`Last score: ${ratingLabel}`}</strong>
              <p>
                Needs practice is a signal to adjust and reinforce before the
                next recall.
              </p>
            </section>
          </section>

          <aside
            aria-label="Practice Repair actions"
            className="recall-practice-repair-workspace__sidebar"
          >
            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>Selected repair</h2>
                <p>
                  The confirmed repair stays attached to this Practice Repair
                  entry while you compare the other Study Notes actions.
                </p>
                <p>{lifecycleSummary}</p>
              </div>

              <PracticeRepairWorkspaceDetail label="Intent">
                {formatPracticeRepairIntentLabel(entry.intent)}
              </PracticeRepairWorkspaceDetail>

              <PracticeRepairWorkspaceDetail label="Correction">
                {entry.correction}
              </PracticeRepairWorkspaceDetail>

              {entry.nextPracticeIdea === undefined ? null : (
                <PracticeRepairWorkspaceDetail label="Next-practice idea">
                  {entry.nextPracticeIdea}
                </PracticeRepairWorkspaceDetail>
              )}

              <div className="recall-practice-repair-workspace__state-card">
                <p className="recall-practice-repair-workspace__detail-label">
                  Entry state
                </p>
                <div className="recall-practice-repair-workspace__state-row">
                  <span
                    className="recall-practice-repair-workspace__state-badge"
                    data-lifecycle-tone={lifecycleTone}
                  >
                    {lifecycleLabel}
                  </span>
                </div>
                <p className="recall-practice-repair-workspace__state-meta">
                  Origin result: {result.id}
                </p>
              </div>

              <p className="recall-practice-repair-workspace__support">
                {nextStepCopy}
              </p>
            </section>

            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>Suggested repairs</h2>
                <p>
                  Open the Study Notes action you want to make next. The
                  highlighted card is the repair saved on this entry.
                </p>
              </div>

              <div className="recall-practice-repair-workspace__repair-list">
                {workspaceActionCards.map((card) => (
                  <PracticeRepairWorkspaceActionButton
                    card={card}
                    isSelected={entry.intent === card.intent}
                    key={card.intent}
                    onSelect={openStudyNotesPracticeRepair}
                  />
                ))}
              </div>

              <div className="recall-practice-repair-workspace__actions">
                <ButtonLink to="/recall" variant="primary">
                  Recall again soon
                </ButtonLink>
              </div>

              <p className="recall-practice-repair-workspace__support">
                Results keeps the historical evidence. Study Notes owns the
                actual note edit, split, sibling creation, and memory-aid
                change.
              </p>
            </section>
          </aside>
        </div>
      </article>
    </section>
  );
}

function PracticeRepairWorkspaceActionButton({
  card,
  isSelected,
  onSelect,
}: Readonly<{
  card: PracticeRepairWorkspaceActionCard;
  isSelected: boolean;
  onSelect: (intent: PracticeRepairIntent) => void;
}>) {
  const titleId = `practice-repair-workspace-card-title-${card.intent}`;
  const descriptionId = `practice-repair-workspace-card-description-${card.intent}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isActionSelectionKey(event.key)) {
      return;
    }

    event.preventDefault();
    onSelect(card.intent);
  }

  return (
    <article
      className="recall-practice-repair-workspace__repair-card"
      data-selected={isSelected ? "true" : "false"}
    >
      <button
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="recall-practice-repair-workspace__repair-button"
        onClick={() => onSelect(card.intent)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="recall-practice-repair-workspace__repair-copy">
          {isSelected ? (
            <span className="recall-practice-repair-workspace__repair-tag">
              Current repair
            </span>
          ) : null}
          <span
            className="recall-practice-repair-workspace__repair-title"
            id={titleId}
          >
            {card.title}
          </span>
          <span
            className="recall-practice-repair-workspace__repair-description"
            id={descriptionId}
          >
            {card.description}
          </span>
        </span>

        <span
          aria-hidden="true"
          className="recall-practice-repair-workspace__repair-chevron"
        >
          <SuggestionChevronIcon />
        </span>
      </button>
    </article>
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
