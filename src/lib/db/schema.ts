import { authSchema } from "../../modules/access/session/auth-schema";
import { labelsSchema } from "../../modules/labels/labels-schema";
import { notesSchema } from "../../modules/notes/notes-schema";

export const appSchema = {
  ...authSchema,
  ...labelsSchema,
  ...notesSchema,
};
