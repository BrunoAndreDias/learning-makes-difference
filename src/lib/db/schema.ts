import { authSchema } from "../../modules/access/session/auth-schema";
import { notesSchema } from "../../modules/notes/notes-schema";

export const appSchema = {
  ...authSchema,
  ...notesSchema,
};
