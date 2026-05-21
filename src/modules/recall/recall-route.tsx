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
  return getStudyNoteLabels(studyNote, labelsById).map((label) => label.name);
}

function getStudyNoteLabels(
  studyNote: AppStudyNote,
  labelsById: ReadonlyMap<string, AppLabel>,
) {
  return studyNote.labelIds
    .map((labelId) => labelsById.get(labelId))
    .filter((label): label is AppLabel => label !== undefined);
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

function filterStudyNotesByLabel(input: {
  labelId: string;
  studyNotes: readonly AppStudyNote[];
}) {
  if (input.labelId.length === 0) {
    return [...input.studyNotes];
  }

  return input.studyNotes.filter((studyNote) =>
    studyNote.labelIds.includes(input.labelId),
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
  selectedLabelId: string,
) {
  const availableLabelIds = new Set(labels.map((label) => label.id));

  if (selectedLabelId.length === 0 || availableLabelIds.has(selectedLabelId)) {
    return selectedLabelId;
  }

  return "";
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
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const labelFilteredStudyNotes = useMemo(
    () => filterStudyNotesByLabel({ labelId: selectedLabelId, studyNotes }),
    [selectedLabelId, studyNotes],
  );
  const visibleStudyNotes = useMemo(
    () => filterStudyNotes(labelFilteredStudyNotes, searchQuery),
    [labelFilteredStudyNotes, searchQuery],
  );
  const selectedFilterLabel =
    selectedLabelId.length === 0
      ? null
      : (labelsById.get(selectedLabelId) ?? null);
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
  const visibleStudyNoteIds = visibleStudyNotes.map(
    (studyNote) => studyNote.id,
  );
  const hasSelectedVisibleStudyNotes = visibleStudyNoteIds.some((studyNoteId) =>
    recallableSelectedStudyNoteIdSet.has(studyNoteId),
  );
  const disabledStartReason = getDisabledStartReason({
    selectedCount: recallableSelectedStudyNotes.length,
    selectedRecallType,
    t,
  });
  const canStart = disabledStartReason === null;

  useEffect(() => {
    const nextSelectedLabelId = resolveSelectedLabelIds(
      labels,
      selectedLabelId,
    );

    if (nextSelectedLabelId === selectedLabelId) {
      return;
    }

    setSelectedLabelId(nextSelectedLabelId);
  }, [labels, selectedLabelId]);

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
    setErrorMessage(null);
  }

  function selectAllVisibleStudyNotes() {
    const visibleRecallableStudyNoteIds = visibleStudyNotes
      .filter(isStudyNoteRecallable)
      .map((studyNote) => studyNote.id);

    setSelectedStudyNoteIds((currentStudyNoteIds) => [
      ...new Set([...currentStudyNoteIds, ...visibleRecallableStudyNoteIds]),
    ]);
    setErrorMessage(null);
  }

  function resetVisibleStudyNotesSelection() {
    const visibleStudyNoteIdSet = new Set(visibleStudyNoteIds);

    setSelectedStudyNoteIds((currentStudyNoteIds) =>
      currentStudyNoteIds.filter(
        (studyNoteId) => !visibleStudyNoteIdSet.has(studyNoteId),
      ),
    );
    setErrorMessage(null);
  }

  function resetAllSelectedStudyNotes() {
    setSelectedStudyNoteIds([]);
    setErrorMessage(null);
  }

  function removeSelectedStudyNote(studyNoteId: string) {
    setSelectedStudyNoteIds((currentStudyNoteIds) =>
      currentStudyNoteIds.filter(
        (currentStudyNoteId) => currentStudyNoteId !== studyNoteId,
      ),
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
            <div className="recall-select-note-picker__toolbar">
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

              <label
                className="recall-field recall-label-filter"
                htmlFor="recall-label-filter"
              >
                <span className="sr-only">
                  {t("recall.selection.filterByLabel")}
                </span>
                <select
                  id="recall-label-filter"
                  onChange={(event) => setSelectedLabelId(event.target.value)}
                  value={selectedLabelId}
                >
                  <option value="">{t("recall.selection.allLabels")}</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="recall-select-filter-summary">
              <div className="recall-select-filter-summary__copy">
                <span>{t("recall.selection.currentlyViewing")}</span>
                <span className="recall-select-note-row__label">
                  {selectedFilterLabel?.name ?? t("recall.selection.allLabels")}
                </span>
                <span aria-hidden="true">|</span>
                <strong>
                  {t("recall.selection.showingFilteredNotes", {
                    count: visibleStudyNotes.length,
                  })}
                </strong>
              </div>
              <div className="recall-select-filter-summary__actions">
                <Button
                  disabled={!visibleStudyNotes.some(isStudyNoteRecallable)}
                  onClick={selectAllVisibleStudyNotes}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  <CheckCircleIcon />
                  {t("recall.selection.selectAllFrom", {
                    label:
                      selectedFilterLabel?.name ??
                      t("recall.selection.currentView"),
                  })}
                </Button>
                <Button
                  disabled={!hasSelectedVisibleStudyNotes}
                  onClick={resetVisibleStudyNotesSelection}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  <CloseIcon />
                  {t("recall.selection.resetAllFrom", {
                    label:
                      selectedFilterLabel?.name ??
                      t("recall.selection.currentView"),
                  })}
                </Button>
                {selectedLabelId.length > 0 ? (
                  <Button
                    onClick={() => setSelectedLabelId("")}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    <FilterOffIcon />
                    {t("recall.selection.clearFilter")}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="recall-select-note-picker__section-heading">
              <h4>
                {selectedFilterLabel === null
                  ? t("recall.selection.notesInAllLabels")
                  : t("recall.selection.notesInLabel", {
                      label: selectedFilterLabel.name,
                    })}
              </h4>
              <p className="muted">
                {selectedFilterLabel === null
                  ? t("recall.selection.notesInAllLabelsDescription")
                  : t("recall.selection.notesInLabelDescription", {
                      label: selectedFilterLabel.name,
                    })}
              </p>
            </div>

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
          </section>

          <SessionSetupPanel
            availableLabels={labels}
            disabledStartReason={disabledStartReason}
            onCancel={cancelSelection}
            onRecallTypeChange={setSelectedRecallType}
            onRemoveStudyNote={removeSelectedStudyNote}
            onResetSelectedStudyNotes={resetAllSelectedStudyNotes}
            onStartRecall={startRecall}
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
  onCancel: () => void;
  onRecallTypeChange: (mode: RecallMode) => void;
  onRemoveStudyNote: (studyNoteId: string) => void;
  onResetSelectedStudyNotes: () => void;
  onStartRecall: () => void;
  selectedRecallType: RecallMode;
  selectedStudyNotes: readonly AppStudyNote[];
};

function SessionSetupPanel({
  availableLabels,
  disabledStartReason,
  onCancel,
  onRecallTypeChange,
  onRemoveStudyNote,
  onResetSelectedStudyNotes,
  onStartRecall,
  selectedStudyNotes,
  selectedRecallType,
}: SessionSetupPanelProps) {
  const { t } = useAppTranslation();
  const labelsById = new Map(
    availableLabels.map((label) => [label.id, label] as const),
  );
  const selectedRecallOption = recallTypeOptions.find(
    (option) => option.mode === selectedRecallType,
  );
  const recallTypeWarning =
    selectedRecallOption?.disabled === true
      ? `Connect API key to start ${formatRecallModeLabel(selectedRecallType)}.`
      : null;

  return (
    <aside
      aria-label={t("recall.selection.sessionSetup")}
      className="recall-panel recall-session-setup recall-select-session-setup"
    >
      <header className="recall-select-session-setup__header">
        <p className="section-label">{t("recall.selection.sessionSetup")}</p>
      </header>

      <div className="recall-select-session-setup__selected-notes">
        <div className="recall-select-session-setup__selected-summary">
          <div>
            <p className="muted">{t("recall.selection.selectedNotes")}</p>
            <p className="recall-select-session-setup__selected-count">
              {selectedStudyNotes.length}
            </p>
          </div>
          <div className="recall-select-session-setup__top-actions">
            <Button
              disabled={selectedStudyNotes.length === 0}
              onClick={onResetSelectedStudyNotes}
              size="compact"
              type="button"
              variant="secondary"
            >
              <FilterOffIcon />
              {t("recall.selection.resetSelected")}
            </Button>
            <Button
              className="recall-select-session-setup__cancel"
              onClick={onCancel}
              size="compact"
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
              size="compact"
              type="button"
              variant="primary"
              aria-label={t("recall.selection.start")}
            >
              {t("recall.selection.startWithCount", {
                count: selectedStudyNotes.length,
              })}
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        {selectedStudyNotes.length > 0 ? (
          <ol
            aria-label={t("recall.selection.selectedNotes")}
            className="recall-select-session-setup__selected-list"
          >
            {selectedStudyNotes.map((studyNote) => {
              const attachedLabels = getStudyNoteLabels(studyNote, labelsById);

              return (
                <li key={studyNote.id}>
                  <div className="recall-select-session-setup__selected-row">
                    <GripIcon />
                    <strong>{studyNote.prompt}</strong>
                    <span className="recall-select-session-setup__selected-labels">
                      <SelectedStudyNoteLabels labels={attachedLabels} />
                    </span>
                    <button
                      aria-label={t("recall.selection.removeSelectedNote", {
                        prompt: studyNote.prompt,
                      })}
                      className="recall-select-session-setup__remove-note"
                      onClick={() => onRemoveStudyNote(studyNote.id)}
                      type="button"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      <div className="recall-select-session-setup__divider" />

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

      {recallTypeWarning !== null ? (
        <p className="muted" id="recall-start-reason">
          {recallTypeWarning}
        </p>
      ) : null}
    </aside>
  );
}

function SelectedStudyNoteLabels({ labels }: { labels: readonly AppLabel[] }) {
  const { t } = useAppTranslation();

  if (labels.length === 0) {
    return (
      <span
        className="recall-select-session-setup__selected-label"
        data-tone="muted"
      >
        {t("recall.selection.noLabel")}
      </span>
    );
  }

  return labels.map((label) => (
    <span
      className="recall-select-session-setup__selected-label"
      key={label.id}
    >
      {label.name}
    </span>
  ));
}

function CheckCircleIcon() {
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
        d="m8.5 12.2 2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FilterOffIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M5 6h14m-3 6H8m2 6h4M4 4l16 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle cx="9" cy="7" r="1.2" />
      <circle cx="15" cy="7" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="17" r="1.2" />
      <circle cx="15" cy="17" r="1.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="m10 7 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
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
