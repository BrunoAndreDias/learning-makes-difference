import { createFileRoute } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageHeader } from "../../../design-system/page-header";
import { type AppTranslationKey, useAppTranslation } from "../../language";
import {
  defaultShowStudyNoteTemplatesPreference,
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

const settingsFallbackErrorKey =
  "settings.error.fallback" satisfies AppTranslationKey;

const studyObjectiveLabelKeys = {
  university_study: "settings.studyObjective.universityStudy",
  self_study: "settings.studyObjective.selfStudy",
  specific_exam: "settings.studyObjective.specificExam",
  professional_learning: "settings.studyObjective.professionalLearning",
  other: "settings.studyObjective.other",
} as const satisfies Record<StudyObjectivePreferenceOption, AppTranslationKey>;

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

function getSettingsAuthErrorKey(errorMessage: string): AppTranslationKey {
  switch (errorMessage) {
    case "Display name must be at least 2 characters long.":
      return "settings.error.displayNameTooShort";
    case "Sign in to update account preferences.":
      return "settings.error.notAuthenticated";
    default:
      return settingsFallbackErrorKey;
  }
}

function getStudyObjectiveLabelKey(
  studyObjective: StudyObjectivePreference,
): AppTranslationKey {
  return studyObjective === null
    ? "settings.studyObjective.notSet"
    : studyObjectiveLabelKeys[studyObjective];
}

function SettingsPage() {
  const { t } = useAppTranslation();
  const { session, sessionSnapshot } = useResolvedProtectedSession(
    "/_protected/settings",
  );
  const user = sessionSnapshot.user;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [showStudyNoteTemplates, setShowStudyNoteTemplates] = useState(
    user?.showStudyNoteTemplates ?? defaultShowStudyNoteTemplatesPreference,
  );
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
  const [errorMessageKey, setErrorMessageKey] =
    useState<AppTranslationKey | null>(null);
  const [statusMessageKey, setStatusMessageKey] =
    useState<AppTranslationKey | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const userTimeZoneOptions = useMemo(
    () => getUserTimeZoneOptions(userTimeZone),
    [userTimeZone],
  );

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setShowStudyNoteTemplates(
      user?.showStudyNoteTemplates ?? defaultShowStudyNoteTemplatesPreference,
    );
    setUserLanguage(user?.userLanguage ?? fallbackUserLanguage);
    setStudyObjective(user?.studyObjective ?? null);
    setStudyIntensity(user?.studyIntensity ?? null);
    setUserTimeZone(user?.userTimeZone ?? defaultUserTimeZone);
  }, [user]);

  if (user === null) {
    return null;
  }

  const savedUserTimeZone = user.userTimeZone ?? defaultUserTimeZone;
  const savedShowStudyNoteTemplates =
    user.showStudyNoteTemplates ?? defaultShowStudyNoteTemplatesPreference;
  const savedStudyObjective = user.studyObjective ?? null;
  const savedStudyIntensity = user.studyIntensity ?? null;
  const hasPreferenceChanges =
    displayName !== user.displayName ||
    showStudyNoteTemplates !== savedShowStudyNoteTemplates ||
    userLanguage !== user.userLanguage ||
    studyObjective !== savedStudyObjective ||
    studyIntensity !== savedStudyIntensity ||
    userTimeZone !== savedUserTimeZone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessageKey(null);
    setStatusMessageKey(null);
    setSubmitting(true);

    try {
      await session.updatePreferences({
        displayName,
        showStudyNoteTemplates,
        userLanguage,
        studyObjective,
        studyIntensity,
        userTimeZone,
      });
      setStatusMessageKey("settings.status.saved");
    } catch (error) {
      const appAuthError = getAppAuthError(error);

      if (appAuthError !== null) {
        setErrorMessageKey(getSettingsAuthErrorKey(appAuthError.message));
      } else {
        setErrorMessageKey(settingsFallbackErrorKey);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="settings-layout" aria-labelledby="settings-heading">
      <PageHeader
        className="settings-page-header recall-surface__header"
        description={t("settings.subtitle")}
        headingProps={{
          "aria-label": t("settings.heading.aria"),
          id: "settings-heading",
        }}
        title={t("settings.heading")}
      />

      <div className="settings-main-grid">
        <article className="settings-panel settings-panel--form">
          <div className="settings-panel__header">
            <p className="section-label">{t("settings.profile.section")}</p>
            <h3>{t("settings.profile.heading")}</h3>
          </div>
          <form
            aria-label={t("settings.form.label")}
            className="settings-form"
            onSubmit={handleSubmit}
          >
            <label className="settings-form__field">
              <span>{t("settings.displayName.label")}</span>
              <input
                autoComplete="name"
                name="displayName"
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setStatusMessageKey(null);
                }}
                required
                type="text"
                value={displayName}
              />
            </label>

            <label className="settings-form__field">
              <span>{t("settings.language.label")}</span>
              <select
                className="settings-form__control"
                name="userLanguage"
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setUserLanguage(event.target.value as UserLanguage);
                  setStatusMessageKey(null);
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
              <span>{t("settings.studyObjective.label")}</span>
              <select
                className="settings-form__control"
                name="studyObjective"
                onChange={(event) => {
                  setStudyObjective(
                    readOptionalPreference<StudyObjectivePreferenceOption>(
                      event.target.value,
                    ),
                  );
                  setStatusMessageKey(null);
                }}
                value={studyObjective ?? ""}
              >
                <option value="">{t("settings.studyObjective.empty")}</option>
                {studyObjectivePreferences.map((objective) => (
                  <option key={objective} value={objective}>
                    {t(studyObjectiveLabelKeys[objective])}
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
                  setStatusMessageKey(null);
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
              <span>{t("settings.userTimeZone.label")}</span>
              <select
                className="settings-form__control"
                name="userTimeZone"
                onChange={(event) => {
                  setUserTimeZone(event.target.value);
                  setStatusMessageKey(null);
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

            <label className="settings-form__checkbox-field">
              <input
                checked={showStudyNoteTemplates}
                name="showStudyNoteTemplates"
                onChange={(event) => {
                  setShowStudyNoteTemplates(event.target.checked);
                  setStatusMessageKey(null);
                }}
                type="checkbox"
              />
              <span>{t("settings.studyNoteTemplates.label")}</span>
            </label>

            {errorMessageKey !== null ? (
              <p
                className="auth-form__error settings-form__message"
                role="alert"
              >
                {t(errorMessageKey)}
              </p>
            ) : null}

            {statusMessageKey !== null ? (
              <p
                className="settings-status settings-form__message"
                role="status"
              >
                {t(statusMessageKey)}
              </p>
            ) : null}

            <button
              className="auth-submit settings-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? t("settings.submit.saving")
                : t("settings.submit.save")}
            </button>
          </form>
        </article>

        <article className="settings-panel settings-panel--summary">
          <div className="settings-panel__header">
            <p className="section-label">{t("settings.summary.section")}</p>
            <h3>{t("settings.summary.heading")}</h3>
          </div>
          <dl
            className="settings-summary"
            aria-label={t("settings.summary.label")}
          >
            <div>
              <dt>{t("settings.summary.email")}</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{t("settings.summary.status")}</dt>
              <dd>
                {hasPreferenceChanges
                  ? t("settings.summary.unsaved")
                  : t("settings.summary.saved")}
              </dd>
            </div>
            <div>
              <dt>{t("settings.language.label")}</dt>
              <dd>{languageLabels[userLanguage]}</dd>
            </div>
            <div>
              <dt>{t("settings.studyObjective.label")}</dt>
              <dd>{t(getStudyObjectiveLabelKey(studyObjective))}</dd>
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
              <dt>{t("settings.userTimeZone.label")}</dt>
              <dd>{userTimeZone}</dd>
            </div>
            <div>
              <dt>{t("settings.studyNoteTemplates.label")}</dt>
              <dd>
                {showStudyNoteTemplates
                  ? t("settings.toggle.enabled")
                  : t("settings.toggle.disabled")}
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
