import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/session/session";
import { createPersistentFocusContext } from "./modules/focus";
import { createServerFocusService } from "./modules/focus/focus-server-fns";
import { createServerLabelsService } from "./modules/labels/labels-server-fns";
import {
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "./modules/labels/persistent-labels";
import {
  createPersistentNotesContext,
  createReadonlyNotesContext,
} from "./modules/notes";
import { createServerNotesService } from "./modules/notes/notes-server-fns";
import { createPersistentRecallContext } from "./modules/recall";
import { createServerRecallService } from "./modules/recall/recall-server-fns";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const persistentLabels = createPersistentLabelsContext({
    service: createServerLabelsService(),
  });
  const labels = createReadonlyLabelsContext(persistentLabels);
  const persistentNotes = createPersistentNotesContext({
    service: createServerNotesService(),
  });
  const notes = createReadonlyNotesContext(persistentNotes);
  const persistentFocus = createPersistentFocusContext({
    service: createServerFocusService(),
  });
  const focus = persistentFocus.readonlyContext;
  const persistentRecall = createPersistentRecallContext({
    notes,
    onStudyActivity: (userId, input) =>
      persistentFocus.captureRecallSessionStudyActivity(userId, input),
    service: createServerRecallService(),
  });
  const recall = persistentRecall.readonlyContext;

  return createRouter({
    context: {
      focus,
      labels,
      notes,
      persistentFocus,
      persistentLabels,
      persistentNotes,
      persistentRecall,
      recall,
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
