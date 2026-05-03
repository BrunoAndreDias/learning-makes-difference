import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("pilot deployment docs", () => {
  it("documents the hosted pilot deployment contract for maintainers and participants", () => {
    const guide = readRepoFile("docs/pilot-deployment.md").toLowerCase();

    expect(guide).toContain("database_url");
    expect(guide).toContain("session_secret");
    expect(guide).toContain("pilot_registration_code");
    expect(guide).toContain("hosted url");
    expect(guide).toContain("pilot participants only receive the hosted url");
    expect(guide).toContain("controlled deploy step");
    expect(guide).toContain("run migrations");
  });

  it("documents local maintainer setup and the same-Wi-Fi fallback without making them the primary pilot path", () => {
    const guide = readRepoFile("docs/pilot-deployment.md").toLowerCase();

    expect(guide).toContain("fallback");
    expect(guide).toContain("same-wi-fi");
    expect(guide).toContain("docker compose up -d postgres");
    expect(guide).toContain("pnpm db:setup");
    expect(guide).toContain("pnpm db:migrate");
    expect(guide).toContain("pnpm db:reset");
    expect(guide).toContain("npm run db:setup");
    expect(guide).toContain("npm run db:migrate");
    expect(guide).toContain("npm run db:reset");
    expect(guide).toContain("test participant study data is empty by default");
  });

  it("includes the issue 103 persistence verification checklist and write-failure expectations", () => {
    const guide = readRepoFile("docs/pilot-deployment.md").toLowerCase();

    expect(guide).toContain("#103 verification checklist");
    expect(guide).toContain("register");
    expect(guide).toContain("sign in");
    expect(guide).toContain("create a note");
    expect(guide).toContain("create a label");
    expect(guide).toContain("attach the label");
    expect(guide).toContain("start a recallsession");
    expect(guide).toContain("create a sessionresult");
    expect(guide).toContain("sign out");
    expect(guide).toContain("sign back in");
    expect(guide).toContain("persisted");
    expect(guide).toContain("server or database is unavailable");
    expect(guide).toContain("authenticated study write");
    expect(guide).toContain("fail clearly");
  });
});
