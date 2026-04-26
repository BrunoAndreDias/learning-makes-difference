import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type AppLabel,
  AppLabelError,
  type AppLabelsContext,
} from "../features/labels/labels";
import type { AppSessionSnapshot } from "../lib/session";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPage,
});

function LabelsPage() {
  const labels = Route.useRouteContext({
    select: (context) => context.labels,
  });
  const session = Route.useRouteContext({
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

  return (
    <section className="labels-page">
      <article className="card stack panel-protected">
        <p className="section-label">Topic management</p>
        <h3>Manage your label graph</h3>
        <p>
          Create labels, rename them in place, and connect parent-child
          relationships without allowing cycles into the graph.
        </p>
        <div className="tag-row">
          <span className="tag">{labelRecords.length} labels</span>
          <span className="tag">Account scoped</span>
          <span className="tag">DAG-safe validation</span>
        </div>
      </article>

      <div className="placeholder-grid labels-layout">
        <article className="card stack">
          <p className="section-label">Create label</p>
          <form
            aria-label="Create label form"
            className="auth-form"
            onSubmit={handleCreateLabel}
          >
            <label className="auth-form__field">
              <span>New label name</span>
              <input
                name="newLabelName"
                onChange={(event) => setCreateName(event.target.value)}
                type="text"
                value={createName}
              />
            </label>
            <button className="auth-form__submit" type="submit">
              Create label
            </button>
          </form>

          {feedbackMessage !== null ? (
            <p
              aria-label="Label management feedback"
              className="auth-form__error"
              role="alert"
            >
              {feedbackMessage}
            </p>
          ) : null}
        </article>

        <article className="card stack">
          <p className="section-label">Graph rules</p>
          <ul className="placeholder-list">
            <li>
              <strong>Scoped data</strong>
              <p>Each account can only read and mutate its own labels.</p>
            </li>
            <li>
              <strong>Multiple parents</strong>
              <p>
                A label can belong to more than one broader topic when the graph
                stays acyclic.
              </p>
            </li>
            <li>
              <strong>Cycle rejection</strong>
              <p>
                Parent assignment is blocked when it would make a label reach
                itself through descendants.
              </p>
            </li>
          </ul>
        </article>
      </div>

      <section className="labels-list" aria-label="Labels list">
        {labelRecords.length === 0 ? (
          <article className="card stack">
            <p className="section-label">No labels yet</p>
            <p>
              Start with a broad topic, then add narrower labels and connect
              them as the graph takes shape.
            </p>
          </article>
        ) : (
          labelRecords.map((label) => (
            <LabelCard
              addParent={addParent}
              allLabels={labelRecords}
              deleteLabel={deleteLabel}
              key={label.id}
              label={label}
              removeParent={removeParent}
              renameLabel={renameLabel}
              labels={labels}
              userId={currentUserId}
            />
          ))
        )}
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
  const parentLabels = label.parentIds
    .map((parentId) => allLabels.find((candidate) => candidate.id === parentId))
    .filter((parent): parent is AppLabel => parent !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
  const availableParents = allLabels.filter((candidate) => {
    return candidate.id !== label.id && !label.parentIds.includes(candidate.id);
  });
  const descendantLabels =
    userId === null
      ? []
      : labels
          .getDescendantIds({
            labelId: label.id,
            userId,
          })
          .map((descendantId: string) => {
            const descendant = allLabels.find(
              (candidate) => candidate.id === descendantId,
            );

            return {
              id: descendantId,
              name: descendant?.name ?? descendantId,
            };
          })
          .sort((left: { name: string }, right: { name: string }) =>
            left.name.localeCompare(right.name),
          );

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

  return (
    <article className="card stack labels-card">
      <div className="labels-card__header">
        <div className="stack">
          <p className="section-label">Label</p>
          <h3>{label.name}</h3>
        </div>
        <button
          className="labels-card__button labels-card__button-danger"
          onClick={() => deleteLabel(label.id)}
          type="button"
        >
          Delete {label.name}
        </button>
      </div>

      <form
        aria-label={`Rename ${label.name}`}
        className="auth-form labels-card__form"
        onSubmit={handleRename}
      >
        <label className="auth-form__field">
          <span>Label name</span>
          <input
            onChange={(event) => setNextName(event.target.value)}
            type="text"
            value={nextName}
          />
        </label>
        <button className="labels-card__button" type="submit">
          Save name
        </button>
      </form>

      <div className="labels-card__meta">
        <section className="stack">
          <p className="section-label">Parents</p>
          {parentLabels.length === 0 ? (
            <p className="muted">No parents assigned yet.</p>
          ) : (
            <ul className="labels-card__relationship-list">
              {parentLabels.map((parent) => (
                <li key={parent.id}>
                  <span className="tag">{parent.name}</span>
                  <button
                    className="labels-card__inline-action"
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
          className="auth-form labels-card__form"
          onSubmit={handleAddParent}
        >
          <label className="auth-form__field">
            <span>Add parent label</span>
            <select
              className="labels-card__select"
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
          <button className="labels-card__button" type="submit">
            Add parent
          </button>
        </form>
      </div>

      <section className="stack">
        <p className="section-label">Descendants</p>
        {descendantLabels.length === 0 ? (
          <p className="muted">No descendants yet.</p>
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
