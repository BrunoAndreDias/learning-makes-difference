import {
  type AppStoredStudyNote,
  type AppStudyNote,
  type AppStudyNotesContext,
  AppStudyNotesError,
  type CreateStudyNoteFromSourceInput,
  type CreateStudyNoteInput,
  type DeleteStudyNoteInput,
  removeLabelAssignmentsFromStoredStudyNotes,
  type UpdateStudyNoteInput,
} from "./study-notes";

type PersistentStudyNotesListener = () => void;

export type AppPersistentStudyNotesService = {
  createStudyNote: (input: CreateStudyNoteInput) => Promise<AppStudyNote>;
  createStudyNoteFromSource: (
    input: CreateStudyNoteFromSourceInput,
  ) => Promise<AppStudyNote>;
  deleteStudyNote: (
    input: DeleteStudyNoteInput & { studyNoteId: string },
  ) => Promise<void>;
  listStudyNotes: (input?: { labelId?: string }) => Promise<AppStudyNote[]>;
  updateStudyNote: (
    input: UpdateStudyNoteInput & { studyNoteId: string },
  ) => Promise<AppStudyNote>;
};

export type AppPersistentStudyNotesContext = {
  createStudyNote: (
    userId: string | null,
    input: CreateStudyNoteInput,
  ) => Promise<AppStudyNote>;
  createStudyNoteFromSource: (
    userId: string | null,
    input: CreateStudyNoteFromSourceInput,
  ) => Promise<AppStudyNote>;
  deleteStudyNote: (
    userId: string | null,
    studyNoteId: string,
    input: DeleteStudyNoteInput,
  ) => Promise<void>;
  getSnapshot: () => readonly AppStoredStudyNote[];
  removeLabelAssignments: (userId: string | null, labelId: string) => void;
  refresh: (userId: string | null) => Promise<readonly AppStoredStudyNote[]>;
  subscribe: (listener: PersistentStudyNotesListener) => () => void;
  updateStudyNote: (
    userId: string | null,
    studyNoteId: string,
    input: UpdateStudyNoteInput,
  ) => Promise<AppStudyNote>;
};

type CreatePersistentStudyNotesContextOptions = {
  service?: AppPersistentStudyNotesService;
};

function toStoredStudyNote(
  studyNote: AppStudyNote,
  userId: string,
): AppStoredStudyNote {
  return {
    ...studyNote,
    userId,
  };
}

function createNotAuthenticatedError(): AppStudyNotesError {
  return new AppStudyNotesError(
    "unauthorized",
    "A signed-in user is required.",
  );
}

function sortStoredStudyNotes(studyNotes: readonly AppStoredStudyNote[]) {
  return [...studyNotes].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function createMissingServiceError(): Error {
  return new Error("Persistent Study Notes service is not configured.");
}

export function createReadonlyStudyNotesContext(
  persistentStudyNotes: Pick<
    AppPersistentStudyNotesContext,
    "getSnapshot" | "removeLabelAssignments" | "subscribe"
  >,
): AppStudyNotesContext {
  return {
    createStudyNote: () => {
      throw new Error(
        "Readonly Study Notes context cannot create Study Notes. Use persistentStudyNotes instead.",
      );
    },
    createStudyNoteFromSource: () => {
      throw new Error(
        "Readonly Study Notes context cannot create Study Notes. Use persistentStudyNotes instead.",
      );
    },
    deleteStudyNote: () => {
      throw new Error(
        "Readonly Study Notes context cannot delete Study Notes. Use persistentStudyNotes instead.",
      );
    },
    getSnapshot: persistentStudyNotes.getSnapshot,
    removeLabelAssignments: persistentStudyNotes.removeLabelAssignments,
    subscribe: persistentStudyNotes.subscribe,
    updateStudyNote: () => {
      throw new Error(
        "Readonly Study Notes context cannot update Study Notes. Use persistentStudyNotes instead.",
      );
    },
  };
}

export function createPersistentStudyNotesContext(
  options: CreatePersistentStudyNotesContextOptions = {},
): AppPersistentStudyNotesContext {
  const service = options.service;
  const listeners = new Set<PersistentStudyNotesListener>();
  let snapshot: readonly AppStoredStudyNote[] = [];

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly AppStoredStudyNote[]) {
    snapshot = sortStoredStudyNotes(nextSnapshot);
    notifyListeners();
    return snapshot;
  }

  function requireService(): AppPersistentStudyNotesService {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
  }

  return {
    async createStudyNote(userId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const createdStudyNote = await requireService().createStudyNote(input);
      writeSnapshot([toStoredStudyNote(createdStudyNote, userId), ...snapshot]);

      return createdStudyNote;
    },
    async createStudyNoteFromSource(userId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const createdStudyNote =
        await requireService().createStudyNoteFromSource(input);
      writeSnapshot([toStoredStudyNote(createdStudyNote, userId), ...snapshot]);

      return createdStudyNote;
    },
    async deleteStudyNote(userId, studyNoteId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      await requireService().deleteStudyNote({
        ...input,
        studyNoteId,
      });
      writeSnapshot(
        snapshot.filter((studyNote) => studyNote.id !== studyNoteId),
      );
    },
    getSnapshot() {
      return snapshot;
    },
    removeLabelAssignments(userId, labelId) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const nextSnapshot = removeLabelAssignmentsFromStoredStudyNotes(
        snapshot,
        {
          labelId,
          userId,
        },
      );

      if (!nextSnapshot.didChange) {
        return;
      }

      writeSnapshot(nextSnapshot.snapshot);
    },
    async refresh(userId) {
      if (userId === null) {
        return writeSnapshot([]);
      }

      const studyNotes = await requireService().listStudyNotes();

      return writeSnapshot(
        studyNotes.map((studyNote) => toStoredStudyNote(studyNote, userId)),
      );
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async updateStudyNote(userId, studyNoteId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const updatedStudyNote = await requireService().updateStudyNote({
        ...input,
        studyNoteId,
      });
      writeSnapshot([
        toStoredStudyNote(updatedStudyNote, userId),
        ...snapshot
          .filter((studyNote) => studyNote.id !== studyNoteId)
          .map((studyNote) =>
            studyNote.sourceNoteId === updatedStudyNote.sourceNoteId
              ? {
                  ...studyNote,
                  source: updatedStudyNote.source,
                }
              : studyNote,
          ),
      ]);

      return updatedStudyNote;
    },
  };
}
