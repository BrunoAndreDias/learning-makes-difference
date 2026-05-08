// Three variants of the Study Notes workspace, switchable via `?variant=`, on a throwaway protected prototype route.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "../../../design-system/button";
import {
  PrototypeSwitcher,
  type PrototypeVariantOption,
} from "../../../design-system/prototype-switcher";

type VariantKey = "A" | "B" | "C";

type StudyNoteStatus = "due" | "needs-practice" | "not-recalled" | "steady";

type StudyLabel = {
  id: string;
  name: string;
  tone: "amber" | "blue" | "green" | "violet";
};

type SourceNote = {
  body: string;
  id: string;
  title: string;
  updatedAt: string;
};

type StudyNote = {
  acronym: string;
  dueText: string;
  expectedAnswer: string;
  id: string;
  labelIds: string[];
  lastScore: string;
  metaphor: string;
  prompt: string;
  sourceNoteId: string;
  status: StudyNoteStatus;
};

type StudyNotesPrototypeState = {
  selectedStudyNoteId: string | null;
  sourceNotes: SourceNote[];
  studyNotes: StudyNote[];
};

type StudyNoteUpdate = Partial<
  Pick<
    StudyNote,
    | "acronym"
    | "dueText"
    | "expectedAnswer"
    | "labelIds"
    | "lastScore"
    | "metaphor"
    | "prompt"
    | "status"
  >
>;

type SourceNoteUpdate = Partial<Pick<SourceNote, "body" | "title">>;

type PrototypeActions = {
  addStudyNoteFromSelectedSource: () => void;
  cancelDeleteBoth: () => void;
  confirmDeleteBoth: () => void;
  createNewStudyNote: () => void;
  requestDeleteSelectedStudyNote: () => void;
  selectStudyNote: (studyNoteId: string) => void;
  toggleSelectedStudyNoteLabel: (labelId: string) => void;
  updateSelectedSourceNote: (update: SourceNoteUpdate) => void;
  updateSelectedStudyNote: (update: StudyNoteUpdate) => void;
};

type VariantProps = {
  actions: PrototypeActions;
  deleteCandidate: {
    sourceNote: SourceNote;
    studyNote: StudyNote;
  } | null;
  isAnswerRevealed: boolean;
  labels: readonly StudyLabel[];
  selectedSourceNote: SourceNote | null;
  selectedStudyNote: StudyNote | null;
  setAnswerRevealed: (isRevealed: boolean) => void;
  siblingStudyNotes: StudyNote[];
  sourceNotes: readonly SourceNote[];
  studyNotes: readonly StudyNote[];
  variant: VariantKey;
};

const prototypeSearchSchema = z.object({
  variant: z.enum(["A", "B", "C"]).optional(),
});

const variantOptions = [
  { key: "A", label: "Practice-first editor" },
  { key: "B", label: "Source split board" },
  { key: "C", label: "Recall-first workspace" },
] satisfies readonly PrototypeVariantOption<VariantKey>[];

const prototypeLabels: readonly StudyLabel[] = [
  { id: "label-biology", name: "Biology", tone: "green" },
  { id: "label-exam", name: "Exam", tone: "amber" },
  { id: "label-process", name: "Processes", tone: "blue" },
  { id: "label-chemistry", name: "Chemistry", tone: "violet" },
];

const initialSourceNotes: SourceNote[] = [
  {
    body: "Photosynthesis converts light energy into chemical energy. In the light reactions, chlorophyll absorbs photons, water is split, oxygen is released, and ATP plus NADPH are produced. The Calvin cycle then uses ATP and NADPH to fix carbon dioxide into sugars.",
    id: "source-photosynthesis",
    title: "Photosynthesis overview",
    updatedAt: "Updated today",
  },
  {
    body: "Enzymes lower activation energy by stabilizing the transition state. Their activity changes with temperature, pH, substrate concentration, and inhibitors. Denaturation can change the active site enough that the substrate no longer fits.",
    id: "source-enzymes",
    title: "Enzyme activity",
    updatedAt: "Updated yesterday",
  },
];

const initialStudyNotes: StudyNote[] = [
  {
    acronym: "LAW: Light Absorbed, Water split.",
    dueText: "Due today",
    expectedAnswer:
      "Chlorophyll absorbs light, water is split, oxygen is released, and ATP plus NADPH are produced for the Calvin cycle.",
    id: "study-light-reactions",
    labelIds: ["label-biology", "label-process"],
    lastScore: "Last score 3/5",
    metaphor:
      "A solar charging station that fills ATP and NADPH batteries before the factory shift.",
    prompt: "What happens during the light reactions?",
    sourceNoteId: "source-photosynthesis",
    status: "needs-practice",
  },
  {
    acronym: "CFSS: Carbon Fixed, Sugar Synthesized.",
    dueText: "Due tomorrow",
    expectedAnswer:
      "The Calvin cycle uses ATP and NADPH to fix carbon dioxide and build sugars.",
    id: "study-calvin-cycle",
    labelIds: ["label-biology", "label-exam"],
    lastScore: "Last score 4/5",
    metaphor:
      "A factory line that spends charged batteries to bolt carbon into a sugar frame.",
    prompt: "How does the Calvin cycle use ATP and NADPH?",
    sourceNoteId: "source-photosynthesis",
    status: "due",
  },
  {
    acronym: "TEA: Transition Energy Avoided.",
    dueText: "Not scheduled",
    expectedAnswer:
      "Enzymes lower activation energy by stabilizing the transition state, making reactions easier to start.",
    id: "study-enzyme-activation",
    labelIds: ["label-chemistry", "label-exam"],
    lastScore: "Not recalled yet",
    metaphor:
      "A bridge over a hill: the reaction gets a shorter path instead of climbing the full slope.",
    prompt: "Why do enzymes lower activation energy?",
    sourceNoteId: "source-enzymes",
    status: "not-recalled",
  },
];

export const Route = createFileRoute("/_protected/study-notes-prototype")({
  validateSearch: prototypeSearchSchema,
  component: StudyNotesPrototypeRoute,
});

function StudyNotesPrototypeRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [sourceNotes, setSourceNotes] = useState(initialSourceNotes);
  const [studyNotes, setStudyNotes] = useState(initialStudyNotes);
  const [selectedStudyNoteId, setSelectedStudyNoteId] = useState<string | null>(
    initialStudyNotes[0]?.id ?? null,
  );
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(
    null,
  );
  const [isAnswerRevealed, setAnswerRevealed] = useState(false);
  const nextIdRef = useRef(1);
  const variant = search.variant ?? "A";
  const selectedStudyNote =
    studyNotes.find((studyNote) => studyNote.id === selectedStudyNoteId) ??
    null;
  const selectedSourceNote =
    selectedStudyNote === null
      ? null
      : (sourceNotes.find(
          (sourceNote) => sourceNote.id === selectedStudyNote.sourceNoteId,
        ) ?? null);
  const siblingStudyNotes =
    selectedSourceNote === null
      ? []
      : studyNotes.filter(
          (studyNote) => studyNote.sourceNoteId === selectedSourceNote.id,
        );
  const deleteCandidateStudyNote =
    deleteCandidateId === null
      ? null
      : (studyNotes.find((studyNote) => studyNote.id === deleteCandidateId) ??
        null);
  const deleteCandidateSourceNote =
    deleteCandidateStudyNote === null
      ? null
      : (sourceNotes.find(
          (sourceNote) =>
            sourceNote.id === deleteCandidateStudyNote.sourceNoteId,
        ) ?? null);
  const deleteCandidate =
    deleteCandidateStudyNote === null || deleteCandidateSourceNote === null
      ? null
      : {
          sourceNote: deleteCandidateSourceNote,
          studyNote: deleteCandidateStudyNote,
        };

  function getNextId(prefix: string) {
    const id = `${prefix}-${nextIdRef.current}`;
    nextIdRef.current += 1;

    return id;
  }

  function handleVariantChange(nextVariant: VariantKey) {
    void navigate({
      replace: true,
      search: { variant: nextVariant },
      to: "/study-notes-prototype",
    });
  }

  function selectStudyNote(studyNoteId: string) {
    setSelectedStudyNoteId(studyNoteId);
    setAnswerRevealed(false);
  }

  function updateSelectedStudyNote(update: StudyNoteUpdate) {
    if (selectedStudyNoteId === null) {
      return;
    }

    setStudyNotes((currentStudyNotes) =>
      currentStudyNotes.map((studyNote) =>
        studyNote.id === selectedStudyNoteId
          ? { ...studyNote, ...update }
          : studyNote,
      ),
    );
  }

  function updateSelectedSourceNote(update: SourceNoteUpdate) {
    if (selectedSourceNote === null) {
      return;
    }

    setSourceNotes((currentSourceNotes) =>
      currentSourceNotes.map((sourceNote) =>
        sourceNote.id === selectedSourceNote.id
          ? { ...sourceNote, ...update, updatedAt: "Edited now" }
          : sourceNote,
      ),
    );
  }

  function createStudyNoteFromSource(sourceNote: SourceNote) {
    const studyNote: StudyNote = {
      acronym: "",
      dueText: "Not scheduled",
      expectedAnswer: sourceNote.body,
      id: getNextId("study-note"),
      labelIds: [],
      lastScore: "Not recalled yet",
      metaphor: "",
      prompt: sourceNote.title,
      sourceNoteId: sourceNote.id,
      status: "not-recalled",
    };

    setStudyNotes((currentStudyNotes) => [...currentStudyNotes, studyNote]);
    setSelectedStudyNoteId(studyNote.id);
    setAnswerRevealed(false);
  }

  function createNewStudyNote() {
    const sourceNote: SourceNote = {
      body: "Paste or write the source explanation here. The first Study Note copies this body as its expected answer, then stays independent.",
      id: getNextId("source-note"),
      title: "Untitled source Note",
      updatedAt: "Created now",
    };

    const studyNote: StudyNote = {
      acronym: "",
      dueText: "Not scheduled",
      expectedAnswer: sourceNote.body,
      id: getNextId("study-note"),
      labelIds: [],
      lastScore: "Not recalled yet",
      metaphor: "",
      prompt: sourceNote.title,
      sourceNoteId: sourceNote.id,
      status: "not-recalled",
    };

    setSourceNotes((currentSourceNotes) => [...currentSourceNotes, sourceNote]);
    setStudyNotes((currentStudyNotes) => [...currentStudyNotes, studyNote]);
    setSelectedStudyNoteId(studyNote.id);
    setAnswerRevealed(false);
  }

  function addStudyNoteFromSelectedSource() {
    if (selectedSourceNote === null) {
      return;
    }

    createStudyNoteFromSource(selectedSourceNote);
  }

  function deleteStudyNote(studyNoteId: string) {
    setStudyNotes((currentStudyNotes) => {
      const remainingStudyNotes = currentStudyNotes.filter(
        (studyNote) => studyNote.id !== studyNoteId,
      );

      setSelectedStudyNoteId(
        remainingStudyNotes[0] === undefined ? null : remainingStudyNotes[0].id,
      );

      return remainingStudyNotes;
    });
    setAnswerRevealed(false);
  }

  function requestDeleteSelectedStudyNote() {
    if (selectedStudyNote === null) {
      return;
    }

    const linkedStudyNoteCount = studyNotes.filter(
      (studyNote) => studyNote.sourceNoteId === selectedStudyNote.sourceNoteId,
    ).length;

    if (linkedStudyNoteCount > 1) {
      deleteStudyNote(selectedStudyNote.id);
      return;
    }

    setDeleteCandidateId(selectedStudyNote.id);
  }

  function confirmDeleteBoth() {
    if (deleteCandidate === null) {
      return;
    }

    setSourceNotes((currentSourceNotes) =>
      currentSourceNotes.filter(
        (sourceNote) => sourceNote.id !== deleteCandidate.sourceNote.id,
      ),
    );
    deleteStudyNote(deleteCandidate.studyNote.id);
    setDeleteCandidateId(null);
  }

  function cancelDeleteBoth() {
    setDeleteCandidateId(null);
  }

  function toggleSelectedStudyNoteLabel(labelId: string) {
    if (selectedStudyNote === null) {
      return;
    }

    const nextLabelIds = selectedStudyNote.labelIds.includes(labelId)
      ? selectedStudyNote.labelIds.filter(
          (selectedLabelId) => selectedLabelId !== labelId,
        )
      : [...selectedStudyNote.labelIds, labelId];

    updateSelectedStudyNote({ labelIds: nextLabelIds });
  }

  const actions: PrototypeActions = {
    addStudyNoteFromSelectedSource,
    cancelDeleteBoth,
    confirmDeleteBoth,
    createNewStudyNote,
    requestDeleteSelectedStudyNote,
    selectStudyNote,
    toggleSelectedStudyNoteLabel,
    updateSelectedSourceNote,
    updateSelectedStudyNote,
  };

  const variantProps: VariantProps = {
    actions,
    deleteCandidate,
    isAnswerRevealed,
    labels: prototypeLabels,
    selectedSourceNote,
    selectedStudyNote,
    setAnswerRevealed,
    siblingStudyNotes,
    sourceNotes,
    studyNotes,
    variant,
  };

  return (
    <>
      {variant === "A" ? <VariantPracticeFirst {...variantProps} /> : null}
      {variant === "B" ? <VariantSourceSplitBoard {...variantProps} /> : null}
      {variant === "C" ? <VariantRecallFirst {...variantProps} /> : null}
      <PrototypeSwitcher
        current={variant}
        onChange={handleVariantChange}
        variants={variantOptions}
      />
    </>
  );
}

function VariantPracticeFirst(props: Readonly<VariantProps>) {
  const {
    actions,
    deleteCandidate,
    labels,
    selectedSourceNote,
    selectedStudyNote,
    siblingStudyNotes,
    sourceNotes,
    studyNotes,
    variant,
  } = props;

  return (
    <section
      aria-label="Study Notes prototype surface"
      className="notes-workspace snp-notes-like snp-variant-a"
    >
      <header className="notes-workspace__page-header">
        <div className="notes-workspace__header-copy">
          <div className="notes-workspace__identity">
            <h1>Study Notes</h1>
            <p className="muted">
              Shape source material into recall targets and reinforce them.
            </p>
          </div>
        </div>
        <div className="notes-workspace__quick-actions">
          <button
            className="notes-action notes-recall-entry-action"
            type="button"
          >
            Start Recall
          </button>
        </div>
      </header>

      <section className="notes-mobile-summary" aria-label="Workspace summary">
        <div className="tag-row notes-workspace__tags">
          <span className="tag">{studyNotes.length} Study Notes</span>
          <span className="tag">{sourceNotes.length} source Notes</span>
          <span className="tag">Prototype</span>
        </div>
      </section>

      <div className="notes-layout">
        <NotesLikeStudyNotesList
          labels={labels}
          onCreate={actions.createNewStudyNote}
          onSelect={actions.selectStudyNote}
          selectedStudyNoteId={selectedStudyNote?.id ?? null}
          studyNotes={studyNotes}
        />
        <article
          aria-label="Study Note editor surface"
          className="notes-editor"
        >
          <fieldset className="notes-editor__study-surface">
            <legend className="sr-only">Study Note surface</legend>
            <div className="notes-editor__layout">
              <NotesLikeStudyNoteEditor
                deleteCandidate={deleteCandidate}
                labels={labels}
                onCancelDeleteBoth={actions.cancelDeleteBoth}
                onConfirmDeleteBoth={actions.confirmDeleteBoth}
                onDelete={actions.requestDeleteSelectedStudyNote}
                onToggleLabel={actions.toggleSelectedStudyNoteLabel}
                onUpdate={actions.updateSelectedStudyNote}
                selectedStudyNote={selectedStudyNote}
              />
              <NotesLikeSourceContext
                onAddStudyNote={actions.addStudyNoteFromSelectedSource}
                onUpdate={actions.updateSelectedSourceNote}
                selectedSourceNote={selectedSourceNote}
                sharedStudyNoteCount={siblingStudyNotes.length}
              />
            </div>
          </fieldset>
        </article>
        <aside
          aria-label="Study Note inspector"
          className="notes-editor__inspector"
        >
          <NotesLikeMemoryHooks
            onUpdate={actions.updateSelectedStudyNote}
            selectedStudyNote={selectedStudyNote}
          />
          <LinkedStudyNotes
            onAdd={actions.addStudyNoteFromSelectedSource}
            onSelect={actions.selectStudyNote}
            selectedStudyNoteId={selectedStudyNote?.id ?? null}
            siblingStudyNotes={siblingStudyNotes}
          />
        </aside>
      </div>
      <PrototypeStateDump
        labels={labels}
        selectedStudyNoteId={selectedStudyNote?.id ?? null}
        sourceNotes={sourceNotes}
        studyNotes={studyNotes}
        variant={variant}
      />
    </section>
  );
}

function NotesLikeStudyNotesList({
  labels,
  onCreate,
  onSelect,
  selectedStudyNoteId,
  studyNotes,
}: Readonly<{
  labels: readonly StudyLabel[];
  onCreate: () => void;
  onSelect: (studyNoteId: string) => void;
  selectedStudyNoteId: string | null;
  studyNotes: readonly StudyNote[];
}>) {
  return (
    <aside aria-label="Study Notes catalog" className="notes-list-panel">
      <div className="notes-list__toolbar">
        <button
          aria-describedby="study-notes-list-count"
          className="notes-action notes-action-primary notes-list__new"
          onClick={onCreate}
          type="button"
        >
          <PlusCirclePrototypeIcon />
          New Study Note
        </button>
        <span className="sr-only" id="study-notes-list-count">
          {studyNotes.length} Study Notes
        </span>
      </div>

      <form
        className="notes-search notes-list__search"
        onSubmit={preventSubmit}
      >
        <span className="notes-search__icon" aria-hidden="true">
          <SearchPrototypeIcon />
        </span>
        <label className="sr-only" htmlFor="study-notes-prototype-search">
          Search Study Notes
        </label>
        <input
          id="study-notes-prototype-search"
          placeholder="Search Study Notes"
          readOnly
          type="search"
        />
        <kbd>Cmd K</kbd>
      </form>

      <fieldset className="notes-list__filters">
        <legend className="sr-only">Study Notes filters</legend>
        <label>
          <span className="sr-only">Filter by label</span>
          <select aria-label="Filter by label" value="" onChange={() => {}}>
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort Study Notes</span>
          <select
            aria-label="Sort Study Notes"
            value="recent"
            onChange={() => {}}
          >
            <option value="recent">Recent</option>
          </select>
        </label>
      </fieldset>

      <nav aria-label="Study Notes list" className="notes-list__nav">
        <ul className="notes-list__items">
          {studyNotes.map((studyNote) => {
            const primaryLabel =
              labels.find((label) => studyNote.labelIds.includes(label.id))
                ?.name ?? null;
            const hookCount = [studyNote.metaphor, studyNote.acronym].filter(
              (value) => value.trim().length > 0,
            ).length;

            return (
              <li className="notes-list__row" key={studyNote.id}>
                <button
                  aria-current={
                    selectedStudyNoteId === studyNote.id ? "page" : undefined
                  }
                  aria-label={studyNote.prompt}
                  className="notes-list__item"
                  data-active={
                    selectedStudyNoteId === studyNote.id ? "true" : undefined
                  }
                  onClick={() => onSelect(studyNote.id)}
                  type="button"
                >
                  <span className="notes-list__item-main">
                    <span className="notes-list__item-title">
                      <strong>{studyNote.prompt}</strong>
                    </span>
                    <span className="notes-list__item-preview">
                      {studyNote.expectedAnswer}
                    </span>
                    <span className="notes-list__item-status">
                      {primaryLabel === null ? null : (
                        <>
                          <span>{primaryLabel}</span>
                          <span aria-hidden="true"> · </span>
                        </>
                      )}
                      <span className="notes-list__learning-state">
                        <span>{formatStudyNoteStatus(studyNote.status)}</span>
                        <span>{studyNote.lastScore}</span>
                      </span>
                    </span>
                  </span>
                  <span className="notes-list__item-meta">
                    <span className="notes-list__item-date">
                      {studyNote.dueText}
                    </span>
                    <span
                      className="notes-list__item-hook-count"
                      data-has-hooks={hookCount > 0 ? "true" : "false"}
                    >
                      {hookCount} {hookCount === 1 ? "hook" : "hooks"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="notes-list__summary">
        {studyNotes.length} Study Notes shown
      </p>
    </aside>
  );
}

function NotesLikeStudyNoteEditor({
  deleteCandidate,
  labels,
  onCancelDeleteBoth,
  onConfirmDeleteBoth,
  onDelete,
  onToggleLabel,
  onUpdate,
  selectedStudyNote,
}: Readonly<{
  deleteCandidate: VariantProps["deleteCandidate"];
  labels: readonly StudyLabel[];
  onCancelDeleteBoth: () => void;
  onConfirmDeleteBoth: () => void;
  onDelete: () => void;
  onToggleLabel: (labelId: string) => void;
  onUpdate: (update: StudyNoteUpdate) => void;
  selectedStudyNote: StudyNote | null;
}>) {
  if (selectedStudyNote === null) {
    return (
      <section className="snp-empty">
        <h2>No Study Note selected</h2>
        <p>Create a Study Note to start shaping a recall target.</p>
      </section>
    );
  }

  const selectedLabels = labels.filter((label) =>
    selectedStudyNote.labelIds.includes(label.id),
  );

  return (
    <>
      <header className="notes-editor__header">
        <div className="notes-editor__title-stack">
          <div className="notes-editor__title-row">
            <label className="notes-title-editor">
              <span className="sr-only">Study Note prompt</span>
              <input
                onChange={(event) => onUpdate({ prompt: event.target.value })}
                placeholder="Name this Study Note"
                type="text"
                value={selectedStudyNote.prompt}
              />
            </label>
          </div>
          <p className="muted notes-editor__meta">
            <span>{selectedStudyNote.dueText}</span>
            <button
              aria-pressed="false"
              className="notes-inline-action notes-editor__catalog-toggle"
              type="button"
            >
              Focus writing
            </button>
            <span className="notes-editor__inline-actions">
              <button
                className="notes-action notes-action-primary notes-editor__save-inline"
                type="button"
              >
                Save
              </button>
              <button
                className="notes-action notes-action-danger"
                onClick={onDelete}
                type="button"
              >
                Delete Study Note
              </button>
            </span>
          </p>
          <section aria-label="Current labels" className="notes-editor__labels">
            <div className="notes-editor__label-row">
              {selectedLabels.length === 0 ? (
                <p className="muted">No labels yet</p>
              ) : (
                <section aria-label="Assigned labels" className="tag-row">
                  {selectedLabels.map((label) => (
                    <span
                      className="tag notes-editor__label-chip"
                      key={label.id}
                    >
                      <span>{label.name}</span>
                      <button
                        aria-label={`Remove ${label.name} label`}
                        className="notes-editor__label-chip-remove"
                        onClick={() => onToggleLabel(label.id)}
                        type="button"
                      >
                        <span aria-hidden="true">x</span>
                      </button>
                    </span>
                  ))}
                </section>
              )}
              <span className="notes-editor__label-picker-anchor">
                <button
                  aria-label="Assign labels"
                  className="notes-inline-action"
                  onClick={() => {
                    const firstUnselectedLabel = labels.find(
                      (label) => !selectedStudyNote.labelIds.includes(label.id),
                    );

                    if (firstUnselectedLabel !== undefined) {
                      onToggleLabel(firstUnselectedLabel.id);
                    }
                  }}
                  type="button"
                >
                  Assign labels
                </button>
              </span>
            </div>
          </section>
        </div>
      </header>

      <form
        aria-label="Study Note editor"
        className="notes-form snp-notes-like-study-form"
        onSubmit={preventSubmit}
      >
        <div className="notes-form__primary">
          <label className="notes-form__field notes-form__body-field">
            <span className="sr-only">Expected answer</span>
            <textarea
              onChange={(event) =>
                onUpdate({ expectedAnswer: event.target.value })
              }
              placeholder="Write the expected answer for recall"
              rows={10}
              value={selectedStudyNote.expectedAnswer}
            />
          </label>
          {deleteCandidate === null ? null : (
            <div
              aria-label="Confirm deleting the last Study Note and source Note"
              className="snp-confirm-delete snp-notes-like-delete-confirm"
              role="dialog"
            >
              <strong>Delete both?</strong>
              <p>
                "{deleteCandidate.studyNote.prompt}" is the last Study Note for
                "{deleteCandidate.sourceNote.title}".
              </p>
              <div className="snp-inline-actions">
                <Button
                  onClick={onConfirmDeleteBoth}
                  type="button"
                  variant="danger"
                >
                  Delete both
                </Button>
                <Button
                  onClick={onCancelDeleteBoth}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </>
  );
}

function NotesLikeSourceContext({
  onAddStudyNote,
  onUpdate,
  selectedSourceNote,
  sharedStudyNoteCount,
}: Readonly<{
  onAddStudyNote: () => void;
  onUpdate: (update: SourceNoteUpdate) => void;
  selectedSourceNote: SourceNote | null;
  sharedStudyNoteCount: number;
}>) {
  if (selectedSourceNote === null) {
    return null;
  }

  return (
    <section className="snp-notes-like-source" aria-label="Source Note">
      <div className="notes-inspector-card__header">
        <h4>Source Note</h4>
        <p>
          {sharedStudyNoteCount > 1
            ? `Shared by ${sharedStudyNoteCount} Study Notes. Source edits do not rewrite expected answers.`
            : "Visible reference context for this Study Note."}
        </p>
      </div>
      <form
        className="notes-form snp-notes-like-source-form"
        onSubmit={preventSubmit}
      >
        <label className="notes-form__field">
          <span>Source title</span>
          <input
            onChange={(event) => onUpdate({ title: event.target.value })}
            value={selectedSourceNote.title}
          />
        </label>
        <label className="notes-form__field notes-form__body-field">
          <span>Source body</span>
          <textarea
            onChange={(event) => onUpdate({ body: event.target.value })}
            rows={5}
            value={selectedSourceNote.body}
          />
        </label>
      </form>
      <Button onClick={onAddStudyNote} type="button" variant="secondary">
        Add Study Note from this source
      </Button>
    </section>
  );
}

function NotesLikeMemoryHooks({
  onUpdate,
  selectedStudyNote,
}: Readonly<{
  onUpdate: (update: StudyNoteUpdate) => void;
  selectedStudyNote: StudyNote | null;
}>) {
  if (selectedStudyNote === null) {
    return null;
  }

  return (
    <section
      aria-label="Memory hooks"
      className="notes-memory-hooks notes-inspector-card snp-notes-like-memory"
    >
      <div className="notes-inspector-card__header">
        <h4>Memory hooks</h4>
        <p>Attach aids to the Study Note being recalled.</p>
      </div>
      <div
        aria-label="Memory hook type"
        className="notes-memory-hooks__tabs"
        role="tablist"
      >
        <button
          aria-controls="snp-memory-hook-metaphor"
          aria-selected="true"
          className="notes-memory-hooks__tab"
          role="tab"
          type="button"
        >
          Metaphor
        </button>
        <button
          aria-controls="snp-memory-hook-acronym"
          aria-selected="false"
          className="notes-memory-hooks__tab"
          role="tab"
          type="button"
        >
          Acronym
        </button>
      </div>
      <div className="notes-memory-hooks__panel snp-memory-hook-panel">
        <label className="notes-form__field" id="snp-memory-hook-metaphor">
          <span>Metaphor</span>
          <textarea
            onChange={(event) => onUpdate({ metaphor: event.target.value })}
            rows={4}
            value={selectedStudyNote.metaphor}
          />
        </label>
        <label className="notes-form__field" id="snp-memory-hook-acronym">
          <span>Acronym</span>
          <textarea
            onChange={(event) => onUpdate({ acronym: event.target.value })}
            rows={3}
            value={selectedStudyNote.acronym}
          />
        </label>
      </div>
    </section>
  );
}

function formatStudyNoteStatus(status: StudyNoteStatus) {
  switch (status) {
    case "due":
      return "Due";
    case "needs-practice":
      return "Needs practice";
    case "not-recalled":
      return "Not recalled yet";
    case "steady":
      return "Steady";
  }
}

function PlusCirclePrototypeIcon() {
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

function SearchPrototypeIcon() {
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

function VariantSourceSplitBoard(props: Readonly<VariantProps>) {
  const {
    actions,
    deleteCandidate,
    isAnswerRevealed,
    labels,
    selectedSourceNote,
    selectedStudyNote,
    setAnswerRevealed,
    siblingStudyNotes,
    sourceNotes,
    studyNotes,
    variant,
  } = props;

  return (
    <section className="study-notes-prototype snp-variant-b">
      <PrototypePageHeader
        actions={actions}
        studyNoteCount={studyNotes.length}
        title="Study Notes"
      />
      <div className="snp-b-layout">
        <aside className="snp-panel snp-source-map">
          <div className="snp-panel-header">
            <p className="snp-eyebrow">Sources</p>
            <h2>Shared source map</h2>
          </div>
          <SourceNoteMap
            onSelect={actions.selectStudyNote}
            selectedStudyNoteId={selectedStudyNote?.id ?? null}
            sourceNotes={sourceNotes}
            studyNotes={studyNotes}
          />
        </aside>
        <main className="snp-stack">
          <section className="snp-panel">
            <div className="snp-panel-header snp-panel-header--row">
              <div>
                <p className="snp-eyebrow">Selected Study Note</p>
                <h2>{selectedStudyNote?.prompt ?? "No Study Note selected"}</h2>
              </div>
              <StatusBadge status={selectedStudyNote?.status ?? null} />
            </div>
            <StudyNoteEditor
              labels={labels}
              onToggleLabel={actions.toggleSelectedStudyNoteLabel}
              onUpdate={actions.updateSelectedStudyNote}
              selectedStudyNote={selectedStudyNote}
            />
          </section>
          <SourceNoteEditor
            onUpdate={actions.updateSelectedSourceNote}
            selectedSourceNote={selectedSourceNote}
            sharedStudyNoteCount={siblingStudyNotes.length}
          />
        </main>
        <aside className="snp-stack">
          <LinkedStudyNotes
            onAdd={actions.addStudyNoteFromSelectedSource}
            onSelect={actions.selectStudyNote}
            selectedStudyNoteId={selectedStudyNote?.id ?? null}
            siblingStudyNotes={siblingStudyNotes}
          />
          <RecallPreview
            isAnswerRevealed={isAnswerRevealed}
            selectedSourceNote={selectedSourceNote}
            selectedStudyNote={selectedStudyNote}
            setAnswerRevealed={setAnswerRevealed}
          />
          <DeleteStudyNotePanel
            deleteCandidate={deleteCandidate}
            onCancelDeleteBoth={actions.cancelDeleteBoth}
            onConfirmDeleteBoth={actions.confirmDeleteBoth}
            onDelete={actions.requestDeleteSelectedStudyNote}
            selectedSourceNote={selectedSourceNote}
            selectedStudyNote={selectedStudyNote}
            siblingStudyNotes={siblingStudyNotes}
          />
        </aside>
      </div>
      <PrototypeStateDump
        labels={labels}
        selectedStudyNoteId={selectedStudyNote?.id ?? null}
        sourceNotes={sourceNotes}
        studyNotes={studyNotes}
        variant={variant}
      />
    </section>
  );
}

function VariantRecallFirst(props: Readonly<VariantProps>) {
  const {
    actions,
    deleteCandidate,
    isAnswerRevealed,
    labels,
    selectedSourceNote,
    selectedStudyNote,
    setAnswerRevealed,
    siblingStudyNotes,
    sourceNotes,
    studyNotes,
    variant,
  } = props;
  const dueStudyNotes = studyNotes.filter(
    (studyNote) =>
      studyNote.status === "due" || studyNote.status === "needs-practice",
  );

  return (
    <section className="study-notes-prototype snp-variant-c">
      <PrototypePageHeader
        actions={actions}
        studyNoteCount={studyNotes.length}
        title="Study Notes"
      />
      <section aria-label="Due Study Notes" className="snp-due-strip">
        {dueStudyNotes.map((studyNote) => (
          <button
            className="snp-due-pill"
            data-active={studyNote.id === selectedStudyNote?.id}
            key={studyNote.id}
            onClick={() => actions.selectStudyNote(studyNote.id)}
            type="button"
          >
            <StatusBadge status={studyNote.status} />
            <span>{studyNote.prompt}</span>
          </button>
        ))}
      </section>
      <div className="snp-c-layout">
        <main className="snp-stack">
          <RecallPreview
            isAnswerRevealed={isAnswerRevealed}
            selectedSourceNote={selectedSourceNote}
            selectedStudyNote={selectedStudyNote}
            setAnswerRevealed={setAnswerRevealed}
          />
          <section className="snp-panel">
            <StudyNoteEditor
              labels={labels}
              onToggleLabel={actions.toggleSelectedStudyNoteLabel}
              onUpdate={actions.updateSelectedStudyNote}
              selectedStudyNote={selectedStudyNote}
            />
          </section>
        </main>
        <aside className="snp-stack">
          <StudyNotesList
            labels={labels}
            onSelect={actions.selectStudyNote}
            selectedStudyNoteId={selectedStudyNote?.id ?? null}
            studyNotes={studyNotes}
          />
          <LinkedStudyNotes
            onAdd={actions.addStudyNoteFromSelectedSource}
            onSelect={actions.selectStudyNote}
            selectedStudyNoteId={selectedStudyNote?.id ?? null}
            siblingStudyNotes={siblingStudyNotes}
          />
        </aside>
      </div>
      <div className="snp-c-source-row">
        <SourceNoteEditor
          onUpdate={actions.updateSelectedSourceNote}
          selectedSourceNote={selectedSourceNote}
          sharedStudyNoteCount={siblingStudyNotes.length}
        />
        <DeleteStudyNotePanel
          deleteCandidate={deleteCandidate}
          onCancelDeleteBoth={actions.cancelDeleteBoth}
          onConfirmDeleteBoth={actions.confirmDeleteBoth}
          onDelete={actions.requestDeleteSelectedStudyNote}
          selectedSourceNote={selectedSourceNote}
          selectedStudyNote={selectedStudyNote}
          siblingStudyNotes={siblingStudyNotes}
        />
      </div>
      <PrototypeStateDump
        labels={labels}
        selectedStudyNoteId={selectedStudyNote?.id ?? null}
        sourceNotes={sourceNotes}
        studyNotes={studyNotes}
        variant={variant}
      />
    </section>
  );
}

function PrototypePageHeader({
  actions,
  studyNoteCount,
  title,
}: Readonly<{
  actions: Pick<
    PrototypeActions,
    "addStudyNoteFromSelectedSource" | "createNewStudyNote"
  >;
  studyNoteCount: number;
  title: string;
}>) {
  return (
    <header className="snp-page-header">
      <div>
        <p className="snp-eyebrow">Prototype for issue #170</p>
        <h1>{title}</h1>
        <p>{studyNoteCount} Study Notes in memory</p>
      </div>
      <div className="snp-page-actions">
        <Button
          onClick={actions.addStudyNoteFromSelectedSource}
          type="button"
          variant="secondary"
        >
          Add Study Note from this source
        </Button>
        <Button
          onClick={actions.createNewStudyNote}
          type="button"
          variant="primary"
        >
          New Study Note
        </Button>
      </div>
    </header>
  );
}

function StudyNotesList({
  labels,
  onSelect,
  selectedStudyNoteId,
  studyNotes,
}: Readonly<{
  labels: readonly StudyLabel[];
  onSelect: (studyNoteId: string) => void;
  selectedStudyNoteId: string | null;
  studyNotes: readonly StudyNote[];
}>) {
  return (
    <aside className="snp-panel snp-study-list">
      <div className="snp-panel-header">
        <p className="snp-eyebrow">Practice targets</p>
        <h2>Study Notes</h2>
      </div>
      <ul className="snp-study-list__items">
        {studyNotes.map((studyNote) => (
          <li key={studyNote.id}>
            <button
              className="snp-study-card"
              data-active={studyNote.id === selectedStudyNoteId}
              onClick={() => onSelect(studyNote.id)}
              type="button"
            >
              <span className="snp-study-card__title">{studyNote.prompt}</span>
              <span className="snp-study-card__meta">
                {studyNote.dueText} - {studyNote.lastScore}
              </span>
              <span className="snp-chip-row">
                <StatusBadge status={studyNote.status} />
                {studyNote.labelIds.map((labelId) => (
                  <LabelChip
                    key={labelId}
                    label={labels.find((label) => label.id === labelId)}
                  />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function StudyNoteEditor({
  labels,
  onToggleLabel,
  onUpdate,
  selectedStudyNote,
}: Readonly<{
  labels: readonly StudyLabel[];
  onToggleLabel: (labelId: string) => void;
  onUpdate: (update: StudyNoteUpdate) => void;
  selectedStudyNote: StudyNote | null;
}>) {
  if (selectedStudyNote === null) {
    return (
      <section className="snp-empty">
        <h2>No Study Note selected</h2>
        <p>Create a Study Note to start shaping a recall target.</p>
      </section>
    );
  }

  return (
    <form className="snp-form" onSubmit={preventSubmit}>
      <div className="snp-panel-header">
        <p className="snp-eyebrow">Study Note</p>
        <h2>Recall target</h2>
      </div>
      <label className="snp-field">
        <span>Prompt</span>
        <input
          onChange={(event) => onUpdate({ prompt: event.target.value })}
          value={selectedStudyNote.prompt}
        />
      </label>
      <label className="snp-field">
        <span>Expected answer</span>
        <textarea
          onChange={(event) => onUpdate({ expectedAnswer: event.target.value })}
          rows={6}
          value={selectedStudyNote.expectedAnswer}
        />
      </label>
      <div className="snp-field">
        <span>Labels</span>
        <div className="snp-label-picker">
          {labels.map((label) => (
            <button
              aria-pressed={selectedStudyNote.labelIds.includes(label.id)}
              className="snp-label-toggle"
              data-tone={label.tone}
              key={label.id}
              onClick={() => onToggleLabel(label.id)}
              type="button"
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>
      <div className="snp-two-fields">
        <label className="snp-field">
          <span>Metaphor</span>
          <textarea
            onChange={(event) => onUpdate({ metaphor: event.target.value })}
            rows={3}
            value={selectedStudyNote.metaphor}
          />
        </label>
        <label className="snp-field">
          <span>Acronym</span>
          <textarea
            onChange={(event) => onUpdate({ acronym: event.target.value })}
            rows={3}
            value={selectedStudyNote.acronym}
          />
        </label>
      </div>
    </form>
  );
}

function SourceNoteEditor({
  onUpdate,
  selectedSourceNote,
  sharedStudyNoteCount,
}: Readonly<{
  onUpdate: (update: SourceNoteUpdate) => void;
  selectedSourceNote: SourceNote | null;
  sharedStudyNoteCount: number;
}>) {
  if (selectedSourceNote === null) {
    return null;
  }

  return (
    <section className="snp-panel snp-source-editor">
      <div className="snp-panel-header">
        <p className="snp-eyebrow">Source Note</p>
        <h2>Reference context</h2>
        <p>
          {sharedStudyNoteCount > 1
            ? `Shared by ${sharedStudyNoteCount} Study Notes. Edits update the shared source context, not existing expected answers.`
            : "Owned by the selected Study Note. Deleting the last Study Note requires deleting this source too."}
        </p>
      </div>
      <form className="snp-form" onSubmit={preventSubmit}>
        <label className="snp-field">
          <span>Source title</span>
          <input
            onChange={(event) => onUpdate({ title: event.target.value })}
            value={selectedSourceNote.title}
          />
        </label>
        <label className="snp-field">
          <span>Source body</span>
          <textarea
            onChange={(event) => onUpdate({ body: event.target.value })}
            rows={7}
            value={selectedSourceNote.body}
          />
        </label>
      </form>
    </section>
  );
}

function LinkedStudyNotes({
  onAdd,
  onSelect,
  selectedStudyNoteId,
  siblingStudyNotes,
}: Readonly<{
  onAdd: () => void;
  onSelect: (studyNoteId: string) => void;
  selectedStudyNoteId: string | null;
  siblingStudyNotes: readonly StudyNote[];
}>) {
  return (
    <section className="snp-panel">
      <div className="snp-panel-header snp-panel-header--row">
        <div>
          <p className="snp-eyebrow">Same source</p>
          <h2>Linked Study Notes</h2>
        </div>
        <Button onClick={onAdd} type="button" variant="secondary">
          Add
        </Button>
      </div>
      <ul className="snp-linked-list">
        {siblingStudyNotes.map((studyNote) => (
          <li key={studyNote.id}>
            <button
              className="snp-linked-item"
              data-active={studyNote.id === selectedStudyNoteId}
              onClick={() => onSelect(studyNote.id)}
              type="button"
            >
              <span>{studyNote.prompt}</span>
              <StatusBadge status={studyNote.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecallPreview({
  isAnswerRevealed,
  selectedSourceNote,
  selectedStudyNote,
  setAnswerRevealed,
}: Readonly<{
  isAnswerRevealed: boolean;
  selectedSourceNote: SourceNote | null;
  selectedStudyNote: StudyNote | null;
  setAnswerRevealed: (isRevealed: boolean) => void;
}>) {
  if (selectedStudyNote === null) {
    return null;
  }

  return (
    <section className="snp-panel snp-recall-preview">
      <div className="snp-panel-header snp-panel-header--row">
        <div>
          <p className="snp-eyebrow">Recall preview</p>
          <h2>Flashcard reveal</h2>
        </div>
        <Button
          onClick={() => setAnswerRevealed(!isAnswerRevealed)}
          type="button"
          variant="secondary"
        >
          {isAnswerRevealed ? "Hide answer" : "Reveal answer"}
        </Button>
      </div>
      <div className="snp-flashcard">
        <p className="snp-question">{selectedStudyNote.prompt}</p>
        {isAnswerRevealed ? (
          <div className="snp-answer-stack">
            <section>
              <h3>Expected answer</h3>
              <p>{selectedStudyNote.expectedAnswer}</p>
            </section>
            <section>
              <h3>Source Note</h3>
              <p>{selectedSourceNote?.body ?? "No source context."}</p>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DeleteStudyNotePanel({
  deleteCandidate,
  onCancelDeleteBoth,
  onConfirmDeleteBoth,
  onDelete,
  selectedSourceNote,
  selectedStudyNote,
  siblingStudyNotes,
}: Readonly<{
  deleteCandidate: VariantProps["deleteCandidate"];
  onCancelDeleteBoth: () => void;
  onConfirmDeleteBoth: () => void;
  onDelete: () => void;
  selectedSourceNote: SourceNote | null;
  selectedStudyNote: StudyNote | null;
  siblingStudyNotes: readonly StudyNote[];
}>) {
  if (selectedStudyNote === null || selectedSourceNote === null) {
    return null;
  }

  return (
    <section className="snp-panel snp-delete-panel">
      <div className="snp-panel-header">
        <p className="snp-eyebrow">Delete behavior</p>
        <h2>
          {siblingStudyNotes.length > 1 ? "Study Note only" : "Last link"}
        </h2>
        <p>
          {siblingStudyNotes.length > 1
            ? "This source stays because other Study Notes still use it."
            : "This would orphan the source Note, so deletion needs confirmation for both."}
        </p>
      </div>
      <Button onClick={onDelete} type="button" variant="danger">
        Delete Study Note
      </Button>
      {deleteCandidate === null ? null : (
        <div
          aria-label="Confirm deleting the last Study Note and source Note"
          className="snp-confirm-delete"
          role="dialog"
        >
          <strong>Delete both?</strong>
          <p>
            "{deleteCandidate.studyNote.prompt}" is the last Study Note for "
            {deleteCandidate.sourceNote.title}".
          </p>
          <div className="snp-inline-actions">
            <Button
              onClick={onConfirmDeleteBoth}
              type="button"
              variant="danger"
            >
              Delete both
            </Button>
            <Button
              onClick={onCancelDeleteBoth}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SourceNoteMap({
  onSelect,
  selectedStudyNoteId,
  sourceNotes,
  studyNotes,
}: Readonly<{
  onSelect: (studyNoteId: string) => void;
  selectedStudyNoteId: string | null;
  sourceNotes: readonly SourceNote[];
  studyNotes: readonly StudyNote[];
}>) {
  return (
    <div className="snp-source-map__groups">
      {sourceNotes.map((sourceNote) => {
        const linkedStudyNotes = studyNotes.filter(
          (studyNote) => studyNote.sourceNoteId === sourceNote.id,
        );

        return (
          <section className="snp-source-group" key={sourceNote.id}>
            <div>
              <h3>{sourceNote.title}</h3>
              <p>
                {linkedStudyNotes.length} Study{" "}
                {linkedStudyNotes.length === 1 ? "Note" : "Notes"}
              </p>
            </div>
            <ul>
              {linkedStudyNotes.map((studyNote) => (
                <li key={studyNote.id}>
                  <button
                    data-active={studyNote.id === selectedStudyNoteId}
                    onClick={() => onSelect(studyNote.id)}
                    type="button"
                  >
                    {studyNote.prompt}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function StatusBadge({
  status,
}: Readonly<{
  status: StudyNoteStatus | null;
}>) {
  if (status === null) {
    return null;
  }

  const statusLabels: Record<StudyNoteStatus, string> = {
    due: "Due",
    "needs-practice": "Needs practice",
    "not-recalled": "Not recalled",
    steady: "Steady",
  };

  return (
    <span className="snp-status-badge" data-status={status}>
      {statusLabels[status]}
    </span>
  );
}

function LabelChip({
  label,
}: Readonly<{
  label: StudyLabel | undefined;
}>) {
  if (label === undefined) {
    return null;
  }

  return (
    <span className="snp-label-chip" data-tone={label.tone}>
      {label.name}
    </span>
  );
}

function PrototypeStateDump({
  labels,
  selectedStudyNoteId,
  sourceNotes,
  studyNotes,
  variant,
}: Readonly<{
  labels: readonly StudyLabel[];
  selectedStudyNoteId: string | null;
  sourceNotes: readonly SourceNote[];
  studyNotes: readonly StudyNote[];
  variant: VariantKey;
}>) {
  const labelNamesById = useMemo(
    () => new Map(labels.map((label) => [label.id, label.name])),
    [labels],
  );
  const stateSnapshot = useMemo<StudyNotesPrototypeState & { variant: string }>(
    () => ({
      selectedStudyNoteId,
      sourceNotes: sourceNotes.map((sourceNote) => ({
        ...sourceNote,
        linkedStudyNoteIds: studyNotes
          .filter((studyNote) => studyNote.sourceNoteId === sourceNote.id)
          .map((studyNote) => studyNote.id),
      })),
      studyNotes: studyNotes.map((studyNote) => ({
        ...studyNote,
        labels: studyNote.labelIds.map(
          (labelId) => labelNamesById.get(labelId) ?? labelId,
        ),
      })),
      variant,
    }),
    [labelNamesById, selectedStudyNoteId, sourceNotes, studyNotes, variant],
  );

  return (
    <details className="snp-state-dump" open>
      <summary>Prototype state</summary>
      <pre>{JSON.stringify(stateSnapshot, null, 2)}</pre>
    </details>
  );
}

function preventSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}
