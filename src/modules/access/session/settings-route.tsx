import { createFileRoute } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type AppLanguagePreference,
  type AppSessionSnapshot,
  appLanguagePreferences,
  getAppAuthError,
  resolveProtectedSessionSnapshot,
} from "./session";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsPage,
});

const languageLabels: Record<AppLanguagePreference, string> = {
  en: "English",
  es: "Spanish",
  "pt-BR": "Portuguese (Brazil)",
};

function SettingsPage() {
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const routedSessionSnapshot = Route.useRouteContext({
    select: (context) => context.sessionSnapshot,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const effectiveSessionSnapshot = resolveProtectedSessionSnapshot({
    routedSessionSnapshot,
    sessionSnapshot,
  });
  const user = effectiveSessionSnapshot.user;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [interfaceLanguage, setInterfaceLanguage] =
    useState<AppLanguagePreference>(user?.interfaceLanguage ?? "en");
  const [studyLanguage, setStudyLanguage] = useState<AppLanguagePreference>(
    user?.studyLanguage ?? "en",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

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
  }, [user]);

  if (user === null) {
    return null;
  }

  const hasPreferenceChanges =
    displayName !== user.displayName ||
    interfaceLanguage !== user.interfaceLanguage ||
    studyLanguage !== user.studyLanguage;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setSubmitting(true);

    try {
      await session.updatePreferences({
        displayName,
        interfaceLanguage,
        studyLanguage,
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
          </dl>
        </article>
      </div>
    </section>
  );
}
