export const appRoutePaths = {
  focus: "/focus",
  forgotPassword: "/forgot-password",
  login: "/login",
  practiceRepair: "/practice-repair",
  recall: "/recall",
  recallDueToday: "/recall/due-today",
  recallResults: "/recall/results",
  recallSelect: "/recall/select",
  recallSession: "/recall/session",
  register: "/register",
  settings: "/settings",
  studyNotes: "/study-notes",
  today: "/today",
} as const;

export const authenticatedLandingPath = appRoutePaths.today;
