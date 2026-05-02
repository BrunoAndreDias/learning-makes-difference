import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/session/session";
import { createAppFocusContext } from "./modules/focus";
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
  const focus = createAppFocusContext({
    getLabelsForUser: (userId) => labels.getLabelsForUser(userId),
  });
  const persistentRecall = createPersistentRecallContext({
    notes,
    service: createServerRecallService(),
  });
  const recall = persistentRecall.readonlyContext;

  return createRouter({
    context: {
      focus,
      labels,
      notes,
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
