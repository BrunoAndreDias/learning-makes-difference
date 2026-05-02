import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatCount } from "../../../lib/format-count";
import { isModifiedKeyShortcut } from "../../../lib/keyboard";
import type { AppSessionSnapshot } from "../../access/session/session";
import { type AppLabel, AppLabelError, type AppLabelsContext } from "./labels";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPage,
});

type LabelsListProps = Readonly<{
  addParent: (labelId: string, parentId: string) => void;
  allLabels: AppLabel[];
  deleteLabel: (labelId: string) => void;
  labels: AppLabelsContext;
  removeParent: (labelId: string, parentId: string) => void;
  renameLabel: (labelId: string, name: string) => void;
  searchQuery: string;
  userId: string | null;
  visibleLabels: AppLabel[];
}>;

function getVisibleLabels(labels: AppLabel[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  if (normalizedSearchQuery.length === 0) {
    return labels;
  }

  return labels.filter((label) =>
    label.name.toLowerCase().includes(normalizedSearchQuery),
  );
}

function LabelsList({
  addParent,
  allLabels,
  deleteLabel,
  labels,
  removeParent,
  renameLabel,
  searchQuery,
  userId,
  visibleLabels,
}: LabelsListProps) {
  if (allLabels.length === 0) {
    return (
      <article className="labels-empty-card">
        <p className="section-label">No labels yet</p>
        <h4>Build your first topic</h4>
        <p className="muted">
          Start with a broad topic, then add narrower labels and connect them as
          the graph takes shape.
        </p>
      </article>
    );
  }

  if (visibleLabels.length === 0) {
    return (
      <article className="labels-empty-card">
        <p className="section-label">No matches</p>
        <h4>No labels match "{searchQuery}"</h4>
        <p className="muted">
          Clear the search or create a new label with this wording.
        </p>
      </article>
    );
  }

  return visibleLabels.map((label) => (
    <LabelCard
      addParent={addParent}
      allLabels={allLabels}
      deleteLabel={deleteLabel}
      key={label.id}
      label={label}
      labels={labels}
      removeParent={removeParent}
      renameLabel={renameLabel}
      userId={userId}
    />
  ));
}
export function LabelsPage() {
  const labels = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.labels,
  });
  const session = useRouteContext({
    from: "/_protected/labels",
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const currentUserId = sessionSnapshot.user?.id ?? null;
  const [labelRecords, setLabelRecords] = useState<AppLabel[]>([]);
  const [createName, setCreateName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const createInputId = useId();
  const createHintId = useId();
  const feedbackMessageId = useId();
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createFieldDescription =
    feedbackMessage === null
      ? createHintId
      : `${createHintId} ${feedbackMessageId}`;

  useEffect(() => {
    function syncLabelRecords() {
      if (currentUserId === null) {
        setLabelRecords([]);
        return;
      }

      setLabelRecords(labels.getLabelsForUser(currentUserId));
    }

    syncLabelRecords();

    return labels.subscribe(syncLabelRecords);
  }, [currentUserId, labels]);

  useEffect(() => {
    function handleGlobalSearchShortcut(event: KeyboardEvent) {
      if (!isModifiedKeyShortcut(event, "k")) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleGlobalSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleGlobalSearchShortcut);
    };
  }, []);

  function handleError(error: unknown) {
    if (error instanceof AppLabelError) {
      setFeedbackMessage(error.message);
      return;
    }

    setFeedbackMessage("Label update failed. Try again.");
  }

  function runLabelAction(action: () => void) {
    try {
      action();
      setFeedbackMessage(null);
    } catch (error) {
      handleError(error);
    }
  }

  function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentUserId === null) {
      return;
    }

    runLabelAction(() => {
      labels.createLabel({
        name: createName,
        userId: currentUserId,
      });
      setCreateName("");
    });
  }

  function renameLabel(labelId: string, name: string) {
    if (currentUserId === null) {
      return;
    }

    runLabelAction(() => {
      labels.renameLabel({
        labelId,
        name,
        userId: currentUserId,
      });
    });
  }

  function deleteLabel(labelId: string) {
    if (currentUserId === null) {
      return;
    }

    runLabelAction(() => {
      labels.deleteLabel({
        labelId,
        userId: currentUserId,
      });
    });
  }

  function addParent(labelId: string, parentId: string) {
    if (currentUserId === null || parentId === "") {
      return;
    }

    runLabelAction(() => {
      labels.addParent({
        labelId,
        parentId,
        userId: currentUserId,
      });
    });
  }

  function removeParent(labelId: string, parentId: string) {
    if (currentUserId === null) {
      return;
    }

    runLabelAction(() => {
      labels.removeParent({
        labelId,
        parentId,
        userId: currentUserId,
      });
    });
  }

  const hasSearchQuery = searchQuery.trim().length > 0;
  const visibleLabels = getVisibleLabels(labelRecords, searchQuery);
  const rootLabelCount = labelRecords.filter(
    (label) => label.parentIds.length === 0,
  ).length;
  const relationshipCount = labelRecords.reduce(
    (total, label) => total + label.parentIds.length,
    0,
  );
  const labelCountText = formatCount(labelRecords.length, "label");
  const rootCountText = formatCount(rootLabelCount, "root");
  const relationshipCountText = formatCount(relationshipCount, "link");
  const visibleCountText = hasSearchQuery
    ? formatCount(visibleLabels.length, "match", "matches")
    : labelCountText;

  return (
    <section className="labels-page" aria-labelledby="labels-route-heading">
      <section className="labels-hero">
        <article className="labels-hero__copy">
          <p className="section-label">Topic management</p>
          <h3 id="labels-route-heading">Manage your label graph</h3>
          <p>
            Create reusable topics, keep parent-child relationships clear, and
            protect the graph from cycles as your notes grow.
          </p>
          <section
            className="tag-row labels-hero__tags"
            aria-label="Graph summary"
          >
            <span className="tag">{labelCountText}</span>
            <span className="tag">{rootCountText}</span>
            <span className="tag">{relationshipCountText}</span>
            <span className="tag">Account scoped</span>
          </section>
        </article>

        <aside aria-label="Label graph health" className="labels-hero__stats">
          <span>
            <strong>{labelRecords.length}</strong>
            Labels
          </span>
          <span>
            <strong>{rootLabelCount}</strong>
            Roots
          </span>
          <span>
            <strong>{relationshipCount}</strong>
            Links
          </span>
        </aside>
      </section>

      <section className="labels-control-panel" aria-label="Label controls">
        <article className="labels-create-card">
          <div>
            <p className="section-label">Create</p>
            <h4>New label</h4>
            <p className="muted" id={createHintId}>
              Start broad, then connect narrower labels after creation.
            </p>
          </div>
          <form
            aria-label="Create label form"
            className="labels-inline-form"
            onSubmit={handleCreateLabel}
          >
            <label className="labels-field" htmlFor={createInputId}>
              <span>New label name</span>
              <input
                aria-describedby={createFieldDescription}
                id={createInputId}
                name="newLabelName"
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="e.g. Biology"
                required
                type="text"
                value={createName}
              />
            </label>
            <button
              className="labels-button labels-button--primary"
              disabled={createName.trim().length === 0}
              type="submit"
            >
              Create label
            </button>
          </form>

          {feedbackMessage !== null ? (
            <p
              aria-label="Label management feedback"
              className="labels-feedback"
              id={feedbackMessageId}
              role="alert"
            >
              {feedbackMessage}
            </p>
          ) : null}
        </article>

        <article className="labels-search-card">
          <div>
            <p className="section-label">Find</p>
            <h4>Search labels</h4>
            <p className="muted">
              Use the same quick-search muscle memory as Notes and Recall.
            </p>
          </div>
          <form
            className="labels-search"
            onSubmit={(event) => event.preventDefault()}
          >
            <span className="labels-search__icon" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6" />
                <path d="m15 15 4.5 4.5" />
              </svg>
            </span>
            <label className="sr-only" htmlFor={searchInputId}>
              Search labels
            </label>
            <input
              autoComplete="off"
              id={searchInputId}
              name="search"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchQuery("");
                }
              }}
              placeholder="Search labels"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
            />
            <kbd>Cmd K</kbd>
          </form>
          <p className="labels-search__summary" aria-live="polite">
            {visibleCountText}
          </p>
        </article>

        <article className="labels-rules-card">
          <p className="section-label">Graph rules</p>
          <ul className="labels-rule-list">
            <li>
              <strong>Scoped data</strong>
              <span>Only this account can read or change these labels.</span>
            </li>
            <li>
              <strong>Multiple parents</strong>
              <span>A label can sit under more than one broader topic.</span>
            </li>
            <li>
              <strong>Cycle rejection</strong>
              <span>Invalid links are blocked before the graph can loop.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="labels-list" aria-label="Labels list">
        <LabelsList
          addParent={addParent}
          allLabels={labelRecords}
          deleteLabel={deleteLabel}
          labels={labels}
          removeParent={removeParent}
          renameLabel={renameLabel}
          searchQuery={searchQuery}
          userId={currentUserId}
          visibleLabels={visibleLabels}
        />
      </section>
    </section>
  );
}

function LabelCard({
  addParent,
  allLabels,
  deleteLabel,
  label,
  labels,
  removeParent,
  renameLabel,
  userId,
}: Readonly<{
  addParent: (labelId: string, parentId: string) => void;
  allLabels: AppLabel[];
  deleteLabel: (labelId: string) => void;
  label: AppLabel;
  labels: AppLabelsContext;
  removeParent: (labelId: string, parentId: string) => void;
  renameLabel: (labelId: string, name: string) => void;
  userId: string | null;
}>) {
  const [nextName, setNextName] = useState(label.name);
  const [selectedParentId, setSelectedParentId] = useState("");
  const renameInputId = useId();
  const renameHintId = useId();
  const parentSelectId = useId();
  const parentHintId = useId();
  const parentLabels = label.parentIds
    .map((parentId) => allLabels.find((candidate) => candidate.id === parentId))
    .filter((parent): parent is AppLabel => parent !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
  const availableParents = allLabels.filter((candidate) => {
    return candidate.id !== label.id && !label.parentIds.includes(candidate.id);
  });
  const descendantLabels = getSortedDescendantLabels({
    allLabels,
    labelId: label.id,
    labels,
    userId,
  });

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    renameLabel(label.id, nextName);
  }

  function handleAddParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addParent(label.id, selectedParentId);
    setSelectedParentId("");
  }

  useEffect(() => {
    setNextName(label.name);
  }, [label.name]);

  const hasRenameChanges = nextName.trim() !== label.name;
  const parentCountText = formatCount(parentLabels.length, "parent");
  const descendantCountText = formatCount(
    descendantLabels.length,
    "descendant",
    "descendants",
  );
  const canAddParent = selectedParentId !== "" && availableParents.length > 0;

  return (
    <article className="labels-card">
      <div className="labels-card__header">
        <div className="labels-card__title">
          <p className="section-label">Label</p>
          <h3>{label.name}</h3>
          <section className="tag-row" aria-label={`Summary for ${label.name}`}>
            <span className="tag">{parentCountText}</span>
            <span className="tag">{descendantCountText}</span>
          </section>
        </div>
        <button
          aria-label={`Delete ${label.name}`}
          className="labels-button labels-button--danger"
          onClick={() => deleteLabel(label.id)}
          type="button"
        >
          Delete
        </button>
      </div>

      <form
        aria-label={`Rename ${label.name}`}
        className="labels-inline-form labels-card__rename-form"
        onSubmit={handleRename}
      >
        <label className="labels-field" htmlFor={renameInputId}>
          <span>Label name</span>
          <input
            aria-describedby={renameHintId}
            id={renameInputId}
            onChange={(event) => setNextName(event.target.value)}
            required
            type="text"
            value={nextName}
          />
        </label>
        <button
          className="labels-button"
          disabled={!hasRenameChanges || nextName.trim().length === 0}
          type="submit"
        >
          Save name
        </button>
        <p className="sr-only" id={renameHintId}>
          Rename {label.name}. Save name is available after the name changes.
        </p>
      </form>

      <div className="labels-card__meta">
        <section className="labels-relationship-panel">
          <p className="section-label">Parents</p>
          {parentLabels.length === 0 ? (
            <p className="labels-empty-relation">No parents assigned yet.</p>
          ) : (
            <ul className="labels-card__relationship-list">
              {parentLabels.map((parent) => (
                <li key={parent.id}>
                  <span className="tag">{parent.name}</span>
                  <button
                    className="labels-button labels-button--inline"
                    onClick={() => removeParent(label.id, parent.id)}
                    type="button"
                  >
                    Remove parent {parent.name} from {label.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          aria-label={`Add parent for ${label.name}`}
          className="labels-inline-form labels-card__parent-form"
          onSubmit={handleAddParent}
        >
          <label className="labels-field" htmlFor={parentSelectId}>
            <span>Add parent label</span>
            <select
              aria-describedby={parentHintId}
              className="labels-card__select"
              id={parentSelectId}
              onChange={(event) => setSelectedParentId(event.target.value)}
              value={selectedParentId}
            >
              <option value="">Choose a parent</option>
              {availableParents.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="labels-button"
            disabled={!canAddParent}
            type="submit"
          >
            Add parent
          </button>
          <p className="sr-only" id={parentHintId}>
            Choose a parent label for {label.name}. Invalid cycle-causing
            relationships will be rejected.
          </p>
        </form>
      </div>

      <section className="labels-relationship-panel">
        <p className="section-label">Descendants</p>
        {descendantLabels.length === 0 ? (
          <p className="labels-empty-relation">No descendants yet.</p>
        ) : (
          <div className="tag-row">
            {descendantLabels.map((descendant) => (
              <span className="tag" key={descendant.id}>
                {descendant.name}
              </span>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function getSortedDescendantLabels({
  allLabels,
  labelId,
  labels,
  userId,
}: {
  allLabels: AppLabel[];
  labelId: string;
  labels: AppLabelsContext;
  userId: string | null;
}) {
  if (userId === null) {
    return [];
  }

  return labels
    .getDescendantIds({
      labelId,
      userId,
    })
    .map((descendantId) => {
      const descendant = allLabels.find(
        (candidate) => candidate.id === descendantId,
      );

      return {
        id: descendantId,
        name: descendant?.name ?? descendantId,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
