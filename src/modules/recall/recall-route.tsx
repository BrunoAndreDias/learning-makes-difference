import {
  createFileRoute,
  Navigate,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import { type AppTranslationKey, useAppTranslation } from "../language";
import {
  type AppStudyNote,
  getStudyNoteReadiness,
  listStudyNotesForUser,
} from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import {
  formatRecallModeLabel,
  getRecallModeTranslationKey,
  getRecallSelectionHelperTranslationKey,
} from "./learner-copy";
import { AppRecallError, type RecallMode } from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import { addRecallableStudyNotesFromLabels } from "./recall-selection-label-add";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRouteShell,
  notFoundComponent: RecallRouteNotFoundRedirect,
});

function RecallRouteNotFoundRedirect() {
  return <Navigate to={appRoutePaths.recall} />;
}

function RecallRouteShell() {
  const persistentRecallContext = useRouteContext({
    from: "/_protected/recall",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected/recall");
  const userId = sessionSnapshot.user?.id ?? null;
  const [isReady, setIsReady] = useState(persistentRecallContext === undefined);

  useEffect(() => {
    let cancelled = false;

    if (persistentRecallContext === undefined) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    const activeSession = persistentRecallContext.readonlyContext.getSnapshot();

    if (activeSession?.userId === userId) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsReady(false);
    void persistentRecallContext
      .refresh(userId)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistentRecallContext, userId]);

  if (!isReady) {
    return null;
  }

  return <Outlet />;
}

type RecallTypeOption = {
  disabled: boolean;
  mode: RecallMode;
};

const recallTypeOptions = [
  {
    disabled: false,
    mode: "FlashCard",
  },
  {
    disabled: true,
    mode: "AiAssisted",
  },
  {
    disabled: true,
    mode: "AiGraded",
  },
] as const satisfies readonly RecallTypeOption[];

const recallQuestionStylePlaceholderFields = [
  {
    id: "recall-question-format",
    key: "recall.selection.questionStyle.format",
  },
  {
    id: "recall-difficulty",
    key: "recall.selection.questionStyle.difficulty",
  },
  {
    id: "recall-number-of-questions",
    key: "recall.selection.questionStyle.count",
  },
] as const satisfies readonly { id: string; key: AppTranslationKey }[];

type AppTranslate = ReturnType<typeof useAppTranslation>["t"];
type LabelAddResult = ReturnType<typeof addRecallableStudyNotesFromLabels>;
type CountTranslationKeys = Readonly<{
  plural: AppTranslationKey;
  singular: AppTranslationKey;
}>;

const labelAddFeedbackTranslationKeys = {
  added: {
    plural: "recall.selection.addFromLabels.feedback.added_plural",
    singular: "recall.selection.addFromLabels.feedback.added",
  },
  alreadySelected: {
    plural: "recall.selection.addFromLabels.feedback.alreadySelected_plural",
    singular: "recall.selection.addFromLabels.feedback.alreadySelected",
  },
  skippedIncomplete: {
    plural: "recall.selection.addFromLabels.feedback.skippedIncomplete_plural",
    singular: "recall.selection.addFromLabels.feedback.skippedIncomplete",
  },
} as const satisfies Record<string, CountTranslationKeys>;

function getStudyNotePreview(
  studyNote: AppStudyNote,
  emptyExpectedAnswerLabel: string,
) {
  const expectedAnswer = studyNote.expectedAnswer.trim();

  if (expectedAnswer.length === 0) {
    return emptyExpectedAnswerLabel;
  }

  return expectedAnswer.length > 150
    ? `${expectedAnswer.slice(0, 147)}...`
    : expectedAnswer;
}

function getLabelNames(
  studyNote: AppStudyNote,
  labelsById: ReadonlyMap<string, AppLabel>,
) {
  return studyNote.labelIds
    .map((labelId) => labelsById.get(labelId)?.name)
    .filter((labelName): labelName is string => labelName !== undefined);
}

function studyNoteMatchesQuery(
  studyNote: AppStudyNote,
  normalizedQuery: string,
) {
  return [
    studyNote.prompt,
    studyNote.expectedAnswer,
    studyNote.source.displayName ?? "",
    studyNote.source.title,
    studyNote.source.body,
    ...studyNote.metaphors.map((metaphor) => metaphor.description),
    ...studyNote.acronyms.map((acronym) => acronym.description),
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function filterStudyNotes(studyNotes: readonly AppStudyNote[], query: string) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return [...studyNotes];
  }

  const lowerQuery = normalizedQuery.toLocaleLowerCase();

  return studyNotes.filter((studyNote) =>
    studyNoteMatchesQuery(studyNote, lowerQuery),
  );
}

function isStudyNoteRecallable(
  studyNote: Pick<AppStudyNote, "expectedAnswer" | "prompt">,
) {
  return getStudyNoteReadiness(studyNote).recallable;
}

function getRecallableSelectedStudyNotes(input: {
  selectedStudyNoteIds: readonly string[];
  studyNotesById: ReadonlyMap<string, AppStudyNote>;
}) {
  return input.selectedStudyNoteIds
    .map((studyNoteId) => input.studyNotesById.get(studyNoteId))
    .filter(
      (studyNote): studyNote is AppStudyNote =>
        studyNote !== undefined && isStudyNoteRecallable(studyNote),
    );
}

function resolveSelectedLabelIds(
  labels: readonly AppLabel[],
  selectedLabelIds: readonly string[],
) {
  const availableLabelIds = new Set(labels.map((label) => label.id));
  const nextSelectedLabelIds = selectedLabelIds.filter((selectedLabelId) =>
    availableLabelIds.has(selectedLabelId),
  );

  if (nextSelectedLabelIds.length > 0 || selectedLabelIds.length === 0) {
    return nextSelectedLabelIds;
  }

  return labels[0] === undefined ? [] : [labels[0].id];
}

function areStringArraysEqual(
  leftValues: readonly string[],
  rightValues: readonly string[],
) {
  return (
    leftValues.length === rightValues.length &&
    leftValues.every((leftValue, index) => leftValue === rightValues[index])
  );
}

function getDisabledStartReason(input: {
  selectedCount: number;
  selectedRecallType: RecallMode;
  t: AppTranslate;
}) {
  if (input.selectedCount === 0) {
    return input.t("recall.selection.disabled.noNotes");
  }

  if (input.selectedRecallType !== "FlashCard") {
    return input.t("recall.selection.disabled.ai");
  }

  return null;
}

function getPluralizedTranslation(input: {
  count: number;
  keys: CountTranslationKeys;
  t: AppTranslate;
}) {
  return input.t(input.count === 1 ? input.keys.singular : input.keys.plural, {
    count: input.count,
  });
}

function getLabelAddFeedbackMessage(input: {
  result: LabelAddResult;
  t: AppTranslate;
}) {
  const { result, t } = input;
  const addedCount = result.addedStudyNoteIds.length;
  const alreadySelectedCount = result.alreadySelectedStudyNoteIds.length;
  const skippedIncompleteCount = result.skippedIncompleteStudyNoteIds.length;
  const messages: string[] = [];

  if (addedCount === 0) {
    messages.push(t("recall.selection.addFromLabels.feedback.noneAdded"));
  } else {
    messages.push(
      getPluralizedTranslation({
        count: addedCount,
        keys: labelAddFeedbackTranslationKeys.added,
        t,
      }),
    );
  }

  if (
    addedCount === 0 &&
    alreadySelectedCount === 0 &&
    skippedIncompleteCount === 0
  ) {
    messages.push(
      t("recall.selection.addFromLabels.feedback.noRecallableMatches"),
    );
    return messages.join(" ");
  }

  if (alreadySelectedCount > 0) {
    messages.push(
      getPluralizedTranslation({
        count: alreadySelectedCount,
        keys: labelAddFeedbackTranslationKeys.alreadySelected,
        t,
      }),
    );
  }

  if (skippedIncompleteCount > 0) {
    messages.push(
      getPluralizedTranslation({
        count: skippedIncompleteCount,
        keys: labelAddFeedbackTranslationKeys.skippedIncomplete,
        t,
      }),
    );
  }

  return messages.join(" ");
}

function getAddFromLabelsDisabledReason(input: {
  hasAvailableLabels: boolean;
  selectedLabelCount: number;
  t: AppTranslate;
}) {
  if (!input.hasAvailableLabels) {
    return input.t("recall.selection.addFromLabels.feedback.noLabels");
  }

  if (input.selectedLabelCount === 0) {
    return input.t("recall.selection.addFromLabels.feedback.selectOne");
  }

  return null;
}

export function RecallSelectionPage({
  initialSelectedStudyNoteIds = [],
}: {
  initialSelectedStudyNoteIds?: readonly string[];
}) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const studyNotes = listStudyNotesForUser(studyNotesSnapshot, userId);
  const labels = userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const studyNotesById = new Map(
    studyNotes.map((studyNote) => [studyNote.id, studyNote] as const),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudyNoteIds, setSelectedStudyNoteIds] = useState<string[]>(
    () => [...new Set(initialSelectedStudyNoteIds)],
  );
  const [selectedRecallType, setSelectedRecallType] =
    useState<RecallMode>("FlashCard");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(() =>
    labels[0] === undefined ? [] : [labels[0].id],
  );
  const [labelAddFeedback, setLabelAddFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleStudyNotes = useMemo(
    () => filterStudyNotes(studyNotes, searchQuery),
    [studyNotes, searchQuery],
  );
  const recallableSelectedStudyNotes = getRecallableSelectedStudyNotes({
    selectedStudyNoteIds,
    studyNotesById,
  });
  const recallableSelectedStudyNoteIds = recallableSelectedStudyNotes.map(
    (studyNote) => studyNote.id,
  );
  const recallableSelectedStudyNoteIdSet = new Set(
    recallableSelectedStudyNoteIds,
  );
  const disabledStartReason = getDisabledStartReason({
    selectedCount: recallableSelectedStudyNotes.length,
    selectedRecallType,
    t,
  });
  const canStart = disabledStartReason === null;

  useEffect(() => {
    const nextSelectedLabelIds = resolveSelectedLabelIds(
      labels,
      selectedLabelIds,
    );

    if (areStringArraysEqual(nextSelectedLabelIds, selectedLabelIds)) {
      return;
    }

    setSelectedLabelIds(nextSelectedLabelIds);
  }, [labels, selectedLabelIds]);

  function toggleStudyNote(studyNoteId: string) {
    const studyNote = studyNotesById.get(studyNoteId);

    if (studyNote === undefined || !isStudyNoteRecallable(studyNote)) {
      return;
    }

    setSelectedStudyNoteIds((currentStudyNoteIds) =>
      currentStudyNoteIds.includes(studyNoteId)
        ? currentStudyNoteIds.filter(
            (currentStudyNoteId) => currentStudyNoteId !== studyNoteId,
          )
        : [...currentStudyNoteIds, studyNoteId],
    );
    setLabelAddFeedback(null);
    setErrorMessage(null);
  }

  function toggleSelectedLabel(labelId: string, isSelected: boolean) {
    setSelectedLabelIds((currentSelectedLabelIds) => {
      if (isSelected) {
        return currentSelectedLabelIds.includes(labelId)
          ? currentSelectedLabelIds
          : [...currentSelectedLabelIds, labelId];
      }

      if (!currentSelectedLabelIds.includes(labelId)) {
        return currentSelectedLabelIds;
      }

      return currentSelectedLabelIds.filter(
        (currentSelectedLabelId) => currentSelectedLabelId !== labelId,
      );
    });
    setLabelAddFeedback(null);
  }

  function addStudyNotesFromLabels() {
    if (selectedLabelIds.length === 0) {
      setLabelAddFeedback(null);
      return;
    }

    const result = addRecallableStudyNotesFromLabels({
      selectedLabelIds,
      selectedStudyNoteIds,
      studyNotes,
    });

    setSelectedStudyNoteIds(result.selectedStudyNoteIds);
    setLabelAddFeedback(
      getLabelAddFeedbackMessage({
        result,
        t,
      }),
    );
    setErrorMessage(null);
  }

  async function startRecall() {
    if (userId === null || !canStart) {
      return;
    }

    try {
      if (persistentRecallContext === undefined) {
        recallContext.startFlashCardSession({
          mode: selectedRecallType,
          studyNoteIds: recallableSelectedStudyNoteIds,
          userId,
        });
      } else {
        await persistentRecallContext.startFlashCardSession(userId, {
          mode: selectedRecallType,
          studyNoteIds: recallableSelectedStudyNoteIds,
        });
      }
      setLabelAddFeedback(null);
      setErrorMessage(null);
      await navigate({ to: appRoutePaths.recallSession });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function cancelSelection() {
    setSelectedStudyNoteIds([]);
    setLabelAddFeedback(null);
    setErrorMessage(null);
    await navigate({ to: appRoutePaths.recall });
  }

  return (
    <PageLayout
      aria-label={t("shell.workspace.recallSetup")}
      as="section"
      beforeTitle={
        <RecallBreadcrumb currentLabel={t("recall.selection.title")} />
      }
      className="recall-workspace recall-surface"
      description={t("recall.selection.description")}
      headerClassName="recall-surface__header recall-select__header"
      title={t("recall.selection.title")}
    >
      {studyNotes.length === 0 ? (
        <section className="recall-panel recall-empty-state">
          <h4>{t("recall.empty.title")}</h4>
          <p className="muted">{t("recall.empty.selectionBody")}</p>
          <ButtonLink to="/study-notes" variant="primary">
            {t("recall.action.openNotes")}
          </ButtonLink>
        </section>
      ) : (
        <div className="recall-selection-layout recall-selection-layout--picker">
          <section
            aria-label={t("recall.selection.availableNotes")}
            className="recall-panel recall-note-picker recall-select-note-picker"
          >
            <label
              className="recall-field recall-search-field"
              htmlFor="recall-note-search"
            >
              <span className="sr-only">{t("recall.selection.search")}</span>
              <SearchIcon />
              <input
                id="recall-note-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("recall.selection.searchPlaceholder")}
                type="search"
                value={searchQuery}
              />
            </label>

            <ol className="recall-note-picker__list">
              {visibleStudyNotes.map((studyNote) => {
                const labelNames = getLabelNames(studyNote, labelsById);
                const isRecallable = isStudyNoteRecallable(studyNote);

                return (
                  <li key={studyNote.id}>
                    <label
                      className="recall-note-row recall-select-note-row"
                      data-disabled={!isRecallable}
                      data-selected={recallableSelectedStudyNoteIdSet.has(
                        studyNote.id,
                      )}
                    >
                      <span className="recall-note-row__check">
                        <input
                          checked={recallableSelectedStudyNoteIdSet.has(
                            studyNote.id,
                          )}
                          disabled={!isRecallable}
                          onChange={() => toggleStudyNote(studyNote.id)}
                          type="checkbox"
                        />
                      </span>
                      <span className="recall-select-note-row__main">
                        <span className="recall-select-note-row__content">
                          <strong>{studyNote.prompt}</strong>
                          <span>
                            {getStudyNotePreview(
                              studyNote,
                              t("recall.selection.addExpectedAnswer"),
                            )}
                          </span>
                          <span className="recall-select-note-row__labels">
                            {labelNames.length > 0 ? (
                              labelNames.slice(0, 2).map((labelName) => (
                                <span
                                  className="recall-select-note-row__label"
                                  key={`${studyNote.id}-${labelName}`}
                                >
                                  {labelName}
                                </span>
                              ))
                            ) : (
                              <span
                                className="recall-select-note-row__label"
                                data-tone="muted"
                              >
                                {t("recall.selection.noLabel")}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="recall-select-note-row__counts">
                          <span className="recall-select-note-row__count">
                            <span>
                              {t("recall.selection.counts.metaphors")}
                            </span>
                            <strong>{studyNote.metaphors.length}</strong>
                          </span>
                          <span className="recall-select-note-row__count">
                            <span>{t("recall.selection.counts.acronyms")}</span>
                            <strong>{studyNote.acronyms.length}</strong>
                          </span>
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>

            {visibleStudyNotes.length === 0 ? (
              <p className="notes-search__empty" role="status">
                {t("recall.selection.noSearchMatches")}
              </p>
            ) : null}

            <footer className="recall-note-picker__footer">
              {t("recall.selection.showingNotes", {
                totalCount: studyNotes.length,
                visibleCount: visibleStudyNotes.length,
              })}
            </footer>
          </section>

          <SessionSetupPanel
            availableLabels={labels}
            disabledStartReason={disabledStartReason}
            onAddStudyNotesFromLabels={addStudyNotesFromLabels}
            onCancel={cancelSelection}
            labelAddFeedback={labelAddFeedback}
            onLabelSelectionChange={toggleSelectedLabel}
            onRecallTypeChange={setSelectedRecallType}
            onStartRecall={startRecall}
            selectedLabelIds={selectedLabelIds}
            selectedRecallType={selectedRecallType}
            selectedStudyNotes={recallableSelectedStudyNotes}
          />
        </div>
      )}

      {errorMessage !== null ? (
        <p className="auth-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </PageLayout>
  );
}

type SessionSetupPanelProps = {
  availableLabels: readonly AppLabel[];
  disabledStartReason: string | null;
  labelAddFeedback: string | null;
  onAddStudyNotesFromLabels: () => void;
  onCancel: () => void;
  onLabelSelectionChange: (labelId: string, isSelected: boolean) => void;
  onRecallTypeChange: (mode: RecallMode) => void;
  onStartRecall: () => void;
  selectedLabelIds: readonly string[];
  selectedRecallType: RecallMode;
  selectedStudyNotes: readonly AppStudyNote[];
};

function SessionSetupPanel({
  availableLabels,
  onAddStudyNotesFromLabels,
  disabledStartReason,
  labelAddFeedback,
  onCancel,
  onLabelSelectionChange,
  onRecallTypeChange,
  onStartRecall,
  selectedLabelIds,
  selectedStudyNotes,
  selectedRecallType,
}: SessionSetupPanelProps) {
  const { t } = useAppTranslation();
  const hasAvailableLabels = availableLabels.length > 0;
  const selectedLabelIdSet = new Set(selectedLabelIds);
  const selectedRecallOption = recallTypeOptions.find(
    (option) => option.mode === selectedRecallType,
  );
  const recallTypeWarning =
    selectedRecallOption?.disabled === true
      ? `Connect API key to start ${formatRecallModeLabel(selectedRecallType)}.`
      : null;
  const addFromLabelsDisabledReason = getAddFromLabelsDisabledReason({
    hasAvailableLabels,
    selectedLabelCount: selectedLabelIds.length,
    t,
  });

  return (
    <aside
      aria-label={t("recall.selection.sessionSetup")}
      className="recall-panel recall-session-setup recall-select-session-setup"
    >
      <header className="recall-select-session-setup__header">
        <p className="section-label">{t("recall.selection.sessionSetup")}</p>
        <PinIcon />
      </header>

      <div className="recall-select-session-setup__selected-notes">
        <p className="muted">{t("recall.selection.selectedNotes")}</p>
        <p className="recall-select-session-setup__selected-count">
          {selectedStudyNotes.length}
        </p>
      </div>

      <div className="recall-select-session-setup__divider" />

      <section className="recall-select-session-setup__label-add">
        <h5 className="recall-select-session-setup__section-title">
          {t("recall.selection.addFromLabels")}
        </h5>
        <p className="muted recall-select-session-setup__label-add-rule">
          {hasAvailableLabels
            ? t("recall.selection.addFromLabels.matchRule")
            : t("recall.selection.addFromLabels.feedback.noLabels")}
        </p>
        <div className="recall-select-session-setup__label-add-controls">
          {hasAvailableLabels ? (
            <fieldset className="recall-select-session-setup__label-options">
              <legend className="sr-only">
                {t("recall.selection.addFromLabels.selectLabel")}
              </legend>
              {availableLabels.map((label) => (
                <label
                  className="recall-select-session-setup__label-option"
                  key={label.id}
                >
                  <input
                    checked={selectedLabelIdSet.has(label.id)}
                    onChange={(event) =>
                      onLabelSelectionChange(label.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{label.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <Button
            disabled={addFromLabelsDisabledReason !== null}
            onClick={onAddStudyNotesFromLabels}
            size="compact"
            type="button"
          >
            {t("recall.selection.addFromLabels.action")}
          </Button>
        </div>
        {hasAvailableLabels && addFromLabelsDisabledReason !== null ? (
          <p className="muted recall-select-session-setup__label-add-rule">
            {addFromLabelsDisabledReason}
          </p>
        ) : null}
        {labelAddFeedback !== null ? (
          <p
            className="recall-feedback recall-select-session-setup__label-add-feedback"
            role="status"
          >
            {labelAddFeedback}
          </p>
        ) : null}
      </section>

      <fieldset className="recall-type-selector recall-select-type-selector">
        <legend>Recall type</legend>
        <div className="recall-select-type-selector__options">
          {recallTypeOptions.map((option) => (
            <label
              className="recall-type-option recall-select-type-option"
              data-disabled={option.disabled}
              data-mode={option.mode}
              data-selected={option.mode === selectedRecallType}
              key={option.mode}
            >
              <input
                checked={option.mode === selectedRecallType}
                onChange={() => onRecallTypeChange(option.mode)}
                type="radio"
                value={option.mode}
              />
              <span
                className="recall-select-type-option__icon"
                aria-hidden="true"
              >
                <RecallTypeIcon mode={option.mode} />
              </span>
              <span>
                <strong>{t(getRecallModeTranslationKey(option.mode))}</strong>
                <span>
                  {t(getRecallSelectionHelperTranslationKey(option.mode))}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="recall-select-session-setup__question-style">
        <h5 className="recall-select-session-setup__section-title">
          {t("recall.selection.questionStyle")}
          <InfoIcon />
        </h5>
        {recallQuestionStylePlaceholderFields.map((field) => {
          const fieldLabel = t(field.key);
          const fieldId = field.id;

          return (
            <label className="recall-field" htmlFor={fieldId} key={field.id}>
              <span className="sr-only">{fieldLabel}</span>
              <select id={fieldId} disabled value={field.id}>
                <option value={field.id}>{fieldLabel}</option>
              </select>
            </label>
          );
        })}
      </section>

      <p className="recall-select-session-setup__hint">
        <InfoIcon />
        <span>{t("recall.selection.temporary")}</span>
      </p>

      <div className="recall-session-setup__actions">
        <Button
          className="recall-select-session-setup__cancel"
          onClick={onCancel}
          type="button"
        >
          {t("recall.selection.cancel")}
        </Button>
        <Button
          aria-describedby={
            recallTypeWarning === null ? undefined : "recall-start-reason"
          }
          className="recall-select-session-setup__start"
          disabled={disabledStartReason !== null}
          onClick={onStartRecall}
          type="button"
          variant="primary"
        >
          {t("recall.selection.start")}
        </Button>
      </div>

      {recallTypeWarning !== null ? (
        <p className="muted" id="recall-start-reason">
          {recallTypeWarning}
        </p>
      ) : null}
    </aside>
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

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.5" fill="currentColor" r="1.1" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M8 4h8m-1 0v5l3 3H6l3-3V4m3 8v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function RecallTypeIcon({ mode }: { mode: RecallMode }) {
  if (mode === "FlashCard") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        viewBox="0 0 24 24"
        width="14"
      >
        <rect
          height="13"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.8"
          width="16"
          x="4"
          y="5"
        />
        <path
          d="M8 10h8M8 13h5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (mode === "AiAssisted") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        viewBox="0 0 24 24"
        width="14"
      >
        <path
          d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <rect
        height="14"
        rx="2.3"
        stroke="currentColor"
        strokeWidth="1.8"
        width="14"
        x="5"
        y="5"
      />
      <path
        d="m9 12 2.2 2.2L15.5 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
