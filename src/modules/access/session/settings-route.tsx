import { createFileRoute } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultUserTimeZone,
  fallbackUserLanguage,
  getAppAuthError,
  type StudyIntensityPreference,
  type StudyIntensityPreferenceOption,
  type StudyObjectivePreference,
  type StudyObjectivePreferenceOption,
  studyIntensityPreferences,
  studyObjectivePreferences,
  type UserLanguage,
  type UserTimeZonePreference,
  userLanguagePreferences,
} from "./session";
import { useResolvedProtectedSession } from "./use-resolved-protected-session";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsPage,
});

const languageLabels: Record<UserLanguage, string> = {
  en: "English",
  es: "Spanish",
  "pt-PT": "Portuguese (Portugal)",
};

const studyObjectiveLabels: Record<StudyObjectivePreferenceOption, string> = {
  university_study: "University study",
  self_study: "Self study",
  specific_exam: "Specific exam",
  professional_learning: "Professional learning",
  other: "Other",
};

const studyIntensityLabels: Record<StudyIntensityPreferenceOption, string> = {
  light: "Light",
  regular: "Regular",
  intensive: "Intensive",
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

function readOptionalPreference<TOption extends string>(
  value: string,
): TOption | null {
  return value === "" ? null : (value as TOption);
}

function getOptionalPreferenceLabel<TOption extends string>(
  value: TOption | null,
  labels: Record<TOption, string>,
): string {
  return value === null ? "Not set" : labels[value];
}

function SettingsPage() {
  const { session, sessionSnapshot } = useResolvedProtectedSession(
    "/_protected/settings",
  );
  const user = sessionSnapshot.user;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [userLanguage, setUserLanguage] = useState<UserLanguage>(
    user?.userLanguage ?? fallbackUserLanguage,
  );
  const [studyObjective, setStudyObjective] =
    useState<StudyObjectivePreference>(user?.studyObjective ?? null);
  const [studyIntensity, setStudyIntensity] =
    useState<StudyIntensityPreference>(user?.studyIntensity ?? null);
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

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setUserLanguage(user?.userLanguage ?? fallbackUserLanguage);
    setStudyObjective(user?.studyObjective ?? null);
    setStudyIntensity(user?.studyIntensity ?? null);
    setUserTimeZone(user?.userTimeZone ?? defaultUserTimeZone);
  }, [user]);

  if (user === null) {
    return null;
  }

  const savedUserTimeZone = user.userTimeZone ?? defaultUserTimeZone;
  const savedStudyObjective = user.studyObjective ?? null;
  const savedStudyIntensity = user.studyIntensity ?? null;
  const hasPreferenceChanges =
    displayName !== user.displayName ||
    userLanguage !== user.userLanguage ||
    studyObjective !== savedStudyObjective ||
    studyIntensity !== savedStudyIntensity ||
    userTimeZone !== savedUserTimeZone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setSubmitting(true);

    try {
      await session.updatePreferences({
        displayName,
        userLanguage,
        studyObjective,
        studyIntensity,
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
              <span>User Language</span>
              <select
                className="settings-form__control"
                name="userLanguage"
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setUserLanguage(event.target.value as UserLanguage);
                  setStatusMessage(null);
                }}
                value={userLanguage}
              >
                {userLanguagePreferences.map((language) => (
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
                    readOptionalPreference<StudyObjectivePreferenceOption>(
                      event.target.value,
                    ),
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
              <span>Study Intensity</span>
              <select
                className="settings-form__control"
                name="studyIntensity"
                onChange={(event) => {
                  setStudyIntensity(
                    readOptionalPreference<StudyIntensityPreferenceOption>(
                      event.target.value,
                    ),
                  );
                  setStatusMessage(null);
                }}
                value={studyIntensity ?? ""}
              >
                <option value="">No intensity selected</option>
                {studyIntensityPreferences.map((intensity) => (
                  <option key={intensity} value={intensity}>
                    {studyIntensityLabels[intensity]}
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
              <dt>User Language</dt>
              <dd>{languageLabels[userLanguage]}</dd>
            </div>
            <div>
              <dt>Study Objective</dt>
              <dd>
                {getOptionalPreferenceLabel(
                  studyObjective,
                  studyObjectiveLabels,
                )}
              </dd>
            </div>
            <div>
              <dt>Study Intensity</dt>
              <dd>
                {getOptionalPreferenceLabel(
                  studyIntensity,
                  studyIntensityLabels,
                )}
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
