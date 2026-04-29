import { describe, expect, it } from "vitest";

import { loadAppEnv } from "./env";

describe("loadAppEnv", () => {
  it("parses the expected runtime variables", () => {
    expect(
      loadAppEnv({
        APP_ENV: "test",
        APP_URL: "https://example.com",
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/lmd_test",
        SESSION_SECRET: "12345678901234567890123456789012",
        LOG_LEVEL: "warn",
      }),
    ).toEqual({
      APP_ENV: "test",
      APP_URL: "https://example.com",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/lmd_test",
      SESSION_SECRET: "12345678901234567890123456789012",
      LOG_LEVEL: "warn",
    });
  });

  it("rejects invalid configuration", () => {
    expect(() =>
      loadAppEnv({
        APP_ENV: "local",
        APP_URL: "not-a-url",
        DATABASE_URL: "sqlite://tmp.db",
        SESSION_SECRET: "short",
        LOG_LEVEL: "verbose",
      }),
    ).toThrow();
  });
});
