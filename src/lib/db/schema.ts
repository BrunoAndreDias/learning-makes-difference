import { authSchema } from "../../modules/access/session/auth-schema";
import { focusSchema } from "../../modules/focus/focus-schema";
import { labelsSchema } from "../../modules/labels/labels-schema";
import { notesSchema } from "../../modules/notes/notes-schema";
import { recallSchema } from "../../modules/recall/recall-schema";
import { studyNotesSchema } from "../../modules/study-notes/study-notes-schema";

export const appSchema = {
  ...authSchema,
  ...focusSchema,
  ...labelsSchema,
  ...notesSchema,
  ...recallSchema,
  ...studyNotesSchema,
};
