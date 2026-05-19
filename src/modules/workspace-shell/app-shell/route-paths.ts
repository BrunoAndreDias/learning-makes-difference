export const appRoutePaths = {
  focus: "/focus",
  forgotPassword: "/forgot-password",
  login: "/login",
  practiceRepair: "/practice-repair",
  recall: "/recall",
  register: "/register",
  settings: "/settings",
  studyNotes: "/study-notes",
  today: "/today",
} as const;

export const authenticatedLandingPath = appRoutePaths.today;
