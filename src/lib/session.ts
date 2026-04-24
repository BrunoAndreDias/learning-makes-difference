export type AppSessionUser = {
  id: string;
  displayName: string;
};

export type AppSessionSnapshot = {
  user: AppSessionUser | null;
};

export type AppSessionContext = {
  getSnapshot: () => AppSessionSnapshot;
};

export function hasActiveSession(session: AppSessionSnapshot) {
  return session.user !== null;
}

export function createGuestSessionContext(): AppSessionContext {
  return {
    getSnapshot: () => ({
      user: null,
    }),
  };
}
