import {
  type AppNote,
  type AppNotesContext,
  AppNotesError,
  type AppStoredNote,
} from "./notes-workspace/notes";

type PersistentNotesListener = () => void;

type CreateNoteInput = {
  acronyms: {
    description: string;
  }[];
  body: string;
  labelIds: string[];
  metaphors: {
    description: string;
  }[];
  title: string;
};

type UpdateNoteInput = CreateNoteInput & {
  noteId: string;
};

export type AppPersistentNotesService = {
  createNote: (input: CreateNoteInput) => Promise<AppNote>;
  deleteNote: (input: { noteId: string }) => Promise<void>;
  listNotes: () => Promise<AppNote[]>;
  updateNote: (input: UpdateNoteInput) => Promise<AppNote>;
};

export type AppPersistentNotesContext = {
  createNote: (
    userId: string | null,
    input: CreateNoteInput,
  ) => Promise<AppNote>;
  deleteNote: (userId: string | null, noteId: string) => Promise<void>;
  getSnapshot: () => readonly AppStoredNote[];
  refresh: (userId: string | null) => Promise<readonly AppStoredNote[]>;
  subscribe: (listener: PersistentNotesListener) => () => void;
  updateNote: (
    userId: string | null,
    noteId: string,
    input: CreateNoteInput,
  ) => Promise<AppNote>;
};

type CreatePersistentNotesContextOptions = {
  service?: AppPersistentNotesService;
};

function toStoredNote(note: AppNote, userId: string): AppStoredNote {
  return {
    ...note,
    userId,
  };
}

function createNotAuthenticatedError(): AppNotesError {
  return new AppNotesError("unauthorized", "A signed-in user is required.");
}

function sortStoredNotes(notes: readonly AppStoredNote[]) {
  return [...notes].sort((left, right) => {
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function createMissingServiceError(): Error {
  return new Error("Persistent notes service is not configured.");
}

export function createReadonlyNotesContext(
  persistentNotes: Pick<AppPersistentNotesContext, "getSnapshot" | "subscribe">,
): AppNotesContext {
  return {
    createNote: () => {
      throw new Error(
        "Readonly notes context cannot create notes. Use persistentNotes instead.",
      );
    },
    deleteNote: () => {
      throw new Error(
        "Readonly notes context cannot delete notes. Use persistentNotes instead.",
      );
    },
    getSnapshot: persistentNotes.getSnapshot,
    subscribe: persistentNotes.subscribe,
    updateNote: () => {
      throw new Error(
        "Readonly notes context cannot update notes. Use persistentNotes instead.",
      );
    },
  };
}

export function createPersistentNotesContext(
  options: CreatePersistentNotesContextOptions = {},
): AppPersistentNotesContext {
  const service = options.service;
  const listeners = new Set<PersistentNotesListener>();
  let snapshot: readonly AppStoredNote[] = [];

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly AppStoredNote[]) {
    snapshot = sortStoredNotes(nextSnapshot);
    notifyListeners();
    return snapshot;
  }

  function requireService(): AppPersistentNotesService {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
  }

  return {
    async createNote(userId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const createdNote = await requireService().createNote(input);
      writeSnapshot([toStoredNote(createdNote, userId), ...snapshot]);

      return createdNote;
    },
    async deleteNote(userId, noteId) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      await requireService().deleteNote({
        noteId,
      });
      writeSnapshot(snapshot.filter((note) => note.id !== noteId));
    },
    getSnapshot() {
      return snapshot;
    },
    async refresh(userId) {
      if (userId === null) {
        return writeSnapshot([]);
      }

      const notes = await requireService().listNotes();

      return writeSnapshot(notes.map((note) => toStoredNote(note, userId)));
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async updateNote(userId, noteId, input) {
      if (userId === null) {
        throw createNotAuthenticatedError();
      }

      const updatedNote = await requireService().updateNote({
        ...input,
        noteId,
      });

      writeSnapshot([
        toStoredNote(updatedNote, userId),
        ...snapshot.filter((note) => note.id !== noteId),
      ]);

      return updatedNote;
    },
  };
}
