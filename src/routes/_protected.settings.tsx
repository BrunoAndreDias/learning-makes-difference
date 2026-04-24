import { createFileRoute } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  AppAuthError,
  type AppLanguagePreference,
  type AppSessionSnapshot,
  appLanguagePreferences,
} from "../lib/session";

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
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const user = sessionSnapshot.user;
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
      if (error instanceof AppAuthError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Settings could not be saved. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="settings-layout">
      <article className="card stack panel-protected">
        <p className="section-label">Account settings</p>
        <h3>Profile preferences</h3>
        <p>
          Update the account details that appear in the workspace shell and set
          the language preferences the product will expand on in later slices.
        </p>
        <div className="tag-row">
          <span className="tag">Protected account scope</span>
          <span className="tag">Future internationalization</span>
        </div>
      </article>

      <div className="placeholder-grid settings-grid">
        <article className="card stack">
          <p className="section-label">Profile</p>
          <form
            aria-label="Account preferences form"
            className="auth-form"
            onSubmit={handleSubmit}
          >
            <label className="auth-form__field">
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

            <label className="auth-form__field">
              <span>Interface language</span>
              <select
                className="auth-form__control"
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

            <label className="auth-form__field">
              <span>Study language</span>
              <select
                className="auth-form__control"
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
              <p className="auth-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {statusMessage !== null ? (
              <p className="settings-status" role="status">
                {statusMessage}
              </p>
            ) : null}

            <button
              className="auth-form__submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save preferences"}
            </button>
          </form>
        </article>

        <article className="card stack">
          <p className="section-label">Account scope</p>
          <dl
            className="settings-summary"
            aria-label="Current account settings"
          >
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
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
          <p className="muted">
            The interface still renders the base language in v1. These
            preferences are stored now so later internationalization work stays
            account-aware instead of retrofitted.
          </p>
        </article>
      </div>
    </section>
  );
}
