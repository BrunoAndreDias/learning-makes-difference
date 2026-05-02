import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/session/session";
import { createAppFocusContext } from "./modules/focus";
import { createAppLabelsContext } from "./modules/labels/label-management/labels";
import {
  createPersistentNotesContext,
  createReadonlyNotesContext,
} from "./modules/notes";
import { createServerNotesService } from "./modules/notes/notes-server-fns";
import { createAppRecallContext } from "./modules/recall";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const labels = createAppLabelsContext();
  const persistentNotes = createPersistentNotesContext({
    service: createServerNotesService(),
  });
  const notes = createReadonlyNotesContext(persistentNotes);
  const focus = createAppFocusContext({
    getLabelsForUser: (userId) => labels.getLabelsForUser(userId),
  });
  const recall = createAppRecallContext({
    getLabelsForUser: (userId) => labels.getLabelsForUser(userId),
    notes,
    onStudyActivity: focus.captureRecallSessionStudyActivity,
  });

  return createRouter({
    context: {
      focus,
      labels,
      notes,
      persistentNotes,
      recall,
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
