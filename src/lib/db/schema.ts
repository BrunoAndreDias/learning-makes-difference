import { authSchema } from "../../modules/access/session/auth-schema";
import { labelsSchema } from "../../modules/labels/labels-schema";
import { notesSchema } from "../../modules/notes/notes-schema";
import { recallSchema } from "../../modules/recall/recall-schema";

export const appSchema = {
  ...authSchema,
  ...labelsSchema,
  ...notesSchema,
  ...recallSchema,
};
