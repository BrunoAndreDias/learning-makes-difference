import { z } from "zod";

const appEnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().startsWith("postgres"),
  PILOT_REGISTRATION_CODE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return appEnvSchema.parse(source);
}
