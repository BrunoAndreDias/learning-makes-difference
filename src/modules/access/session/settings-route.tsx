import { createFileRoute } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type AppLanguagePreference,
  appLanguagePreferences,
  defaultUserTimeZone,
  getAppAuthError,
  type StudyObjectivePreference,
  studyObjectivePreferences,
  type UserTimeZonePreference,
} from "./session";
import { useResolvedProtectedSession } from "./use-resolved-protected-session";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsPage,
});

const languageLabels: Record<AppLanguagePreference, string> = {
  en: "English",
  es: "Spanish",
  "pt-BR": "Portuguese (Brazil)",
};

const studyObjectiveLabels: Record<
  Exclude<StudyObjectivePreference, null>,
  string
> = {
  university_study: "University study",
  self_study: "Self study",
  specific_exam: "Specific exam",
  professional_learning: "Professional learning",
  other: "Other",
};

const fallbackUserTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
] as const;

function getUserTimeZoneOptions(
  currentTimeZone: UserTimeZonePreference,
): UserTimeZonePreference[] {
  const supportedTimeZones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : fallbackUserTimeZones;

  return Array.from(
    new Set([defaultUserTimeZone, currentTimeZone, ...supportedTimeZones]),
  ).sort();
}

function SettingsPage() {
  const { session, sessionSnapshot } = useResolvedProtectedSession(
    "/_protected/settings",
  );
  const user = sessionSnapshot.user;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [interfaceLanguage, setInterfaceLanguage] =
    useState<AppLanguagePreference>(user?.interfaceLanguage ?? "en");
  const [studyLanguage, setStudyLanguage] = useState<AppLanguagePreference>(
    user?.studyLanguage ?? "en",
  );
  const [studyObjective, setStudyObjective] =
    useState<StudyObjectivePreference>(user?.studyObjective ?? null);
  const [userTimeZone, setUserTimeZone] = useState<UserTimeZonePreference>(
    user?.userTimeZone ?? defaultUserTimeZone,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const userTimeZoneOptions = useMemo(
    () => getUserTimeZoneOptions(userTimeZone),
    [userTimeZone],
  );

  function updateLanguagePreference(
    setter: (value: AppLanguagePreference) => void,
  ) {
    return (event: ChangeEvent<HTMLSelectElement>) => {
      setter(event.target.value as AppLanguagePreference);
      setStatusMessage(null);
    };
  }

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setInterfaceLanguage(user?.interfaceLanguage ?? "en");
    setStudyLanguage(user?.studyLanguage ?? "en");
    setStudyObjective(user?.studyObjective ?? null);
    setUserTimeZone(user?.userTimeZone ?? defaultUserTimeZone);
  }, [user]);

  if (user === null) {
    return null;
  }

  const savedUserTimeZone = user.userTimeZone ?? defaultUserTimeZone;
  const savedStudyObjective = user.studyObjective ?? null;
  const hasPreferenceChanges =
    displayName !== user.displayName ||
    interfaceLanguage !== user.interfaceLanguage ||
    studyLanguage !== user.studyLanguage ||
    studyObjective !== savedStudyObjective ||
    userTimeZone !== savedUserTimeZone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setSubmitting(true);

    try {
      await session.updatePreferences({
        displayName,
        interfaceLanguage,
        studyObjective,
        studyLanguage,
        userTimeZone,
      });
      setStatusMessage("Preferences saved.");
    } catch (error) {
      const appAuthError = getAppAuthError(error);

      if (appAuthError !== null) {
        setErrorMessage(appAuthError.message);
      } else {
        setErrorMessage("Settings could not be saved. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="settings-layout" aria-labelledby="settings-heading">
      <header className="settings-page-header recall-surface__header">
        <div className="notes-editor__title-stack">
          <h3 aria-label="Account settings" id="settings-heading">
            Settings
          </h3>
          <p className="muted notes-editor__meta">
            Keep your workspace identity and language defaults aligned across
            Notes, Recall, and Labels.
          </p>
        </div>
      </header>

      <div className="settings-main-grid">
        <article className="settings-panel settings-panel--form">
          <div className="settings-panel__header">
            <p className="section-label">Profile</p>
            <h3>Workspace identity</h3>
          </div>
          <form
            aria-label="Account preferences form"
            className="settings-form"
            onSubmit={handleSubmit}
          >
            <label className="settings-form__field">
              <span>Display name</span>
              <input
                autoComplete="name"
                name="displayName"
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setStatusMessage(null);
                }}
                required
                type="text"
                value={displayName}
              />
            </label>

            <label className="settings-form__field">
              <span>Interface language</span>
              <select
                className="settings-form__control"
                name="interfaceLanguage"
                onChange={updateLanguagePreference(setInterfaceLanguage)}
                value={interfaceLanguage}
              >
                {appLanguagePreferences.map((language) => (
                  <option key={language} value={language}>
                    {languageLabels[language]}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form__field">
              <span>Study language</span>
              <select
                className="settings-form__control"
                name="studyLanguage"
                onChange={updateLanguagePreference(setStudyLanguage)}
                value={studyLanguage}
              >
                {appLanguagePreferences.map((language) => (
                  <option key={language} value={language}>
                    {languageLabels[language]}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form__field">
              <span>Study Objective</span>
              <select
                className="settings-form__control"
                name="studyObjective"
                onChange={(event) => {
                  setStudyObjective(
                    event.target.value === ""
                      ? null
                      : (event.target.value as Exclude<
                          StudyObjectivePreference,
                          null
                        >),
                  );
                  setStatusMessage(null);
                }}
                value={studyObjective ?? ""}
              >
                <option value="">No objective selected</option>
                {studyObjectivePreferences.map((objective) => (
                  <option key={objective} value={objective}>
                    {studyObjectiveLabels[objective]}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-form__field">
              <span>User Time Zone</span>
              <select
                className="settings-form__control"
                name="userTimeZone"
                onChange={(event) => {
                  setUserTimeZone(event.target.value);
                  setStatusMessage(null);
                }}
                required
                value={userTimeZone}
              >
                {userTimeZoneOptions.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
                  </option>
                ))}
              </select>
            </label>

            {errorMessage !== null ? (
              <p
                className="auth-form__error settings-form__message"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            {statusMessage !== null ? (
              <p
                className="settings-status settings-form__message"
                role="status"
              >
                {statusMessage}
              </p>
            ) : null}

            <button
              className="auth-submit settings-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save preferences"}
            </button>
          </form>
        </article>

        <article className="settings-panel settings-panel--summary">
          <div className="settings-panel__header">
            <p className="section-label">Account scope</p>
            <h3>Current defaults</h3>
          </div>
          <dl
            className="settings-summary"
            aria-label="Current account settings"
          >
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{hasPreferenceChanges ? "Unsaved changes" : "Saved"}</dd>
            </div>
            <div>
              <dt>Interface language</dt>
              <dd>{languageLabels[interfaceLanguage]}</dd>
            </div>
            <div>
              <dt>Study language</dt>
              <dd>{languageLabels[studyLanguage]}</dd>
            </div>
            <div>
              <dt>Study Objective</dt>
              <dd>
                {studyObjective === null
                  ? "Not set"
                  : studyObjectiveLabels[studyObjective]}
              </dd>
            </div>
            <div>
              <dt>User Time Zone</dt>
              <dd>{userTimeZone}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
