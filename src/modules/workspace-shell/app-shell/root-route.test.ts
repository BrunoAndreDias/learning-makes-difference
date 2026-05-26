import { describe, expect, it, vi } from "vitest";

import type {
  AppSessionContext,
  AppSessionSnapshot,
} from "../../access/session/session";
import { resolveRootRouteSessionSnapshot } from "./root-route";

function createTestSession(
  overrides: Partial<AppSessionContext>,
): AppSessionContext {
  return {
    getSnapshot: () => ({ user: null }),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue({ user: null }),
    register: vi.fn(),
    subscribe: () => () => undefined,
    updatePreferences: vi.fn(),
    ...overrides,
  };
}

describe("root route session resolution", () => {
  it("uses the routed active session before asking the client session store", () => {
    const routedSnapshot: AppSessionSnapshot = {
      user: {
        displayName: "Routed Learner",
        email: "routed@example.com",
        id: "user-routed",
        userLanguage: "en",
      },
    };
    const refresh = vi.fn().mockResolvedValue({ user: null });
    const session = createTestSession({
      getSnapshot: () => ({ user: null }),
      refresh,
    });

    expect(
      resolveRootRouteSessionSnapshot({
        routedSessionSnapshot: routedSnapshot,
        session,
      }),
    ).toBe(routedSnapshot);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when no routed session is available, even if a cached session exists", async () => {
    const activeSnapshot: AppSessionSnapshot = {
      user: {
        displayName: "Casey Learner",
        email: "casey@example.com",
        id: "user-casey",
        userLanguage: "en",
      },
    };
    const refreshedSnapshot: AppSessionSnapshot = {
      user: {
        displayName: "Fresh Casey",
        email: "fresh.casey@example.com",
        id: "user-casey",
        userLanguage: "en",
      },
    };
    const refresh = vi.fn().mockResolvedValue(refreshedSnapshot);
    const session = createTestSession({
      getSnapshot: () => activeSnapshot,
      refresh,
    });

    await expect(resolveRootRouteSessionSnapshot({ session })).resolves.toBe(
      refreshedSnapshot,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when no active session is cached", async () => {
    const refreshedSnapshot: AppSessionSnapshot = {
      user: {
        displayName: "Casey Learner",
        email: "casey@example.com",
        id: "user-casey",
        userLanguage: "en",
      },
    };
    const refresh = vi.fn().mockResolvedValue(refreshedSnapshot);
    const session = createTestSession({
      getSnapshot: () => ({ user: null }),
      refresh,
    });

    await expect(resolveRootRouteSessionSnapshot({ session })).resolves.toBe(
      refreshedSnapshot,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
