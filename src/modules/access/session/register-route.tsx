import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { detectAnonymousUserLanguage, useAppTranslation } from "../../language";
import {
  defaultUserTimeZone,
  getAppAuthError,
  hasActiveSession,
  type UserTimeZonePreference,
} from "./session";

export const Route = createFileRoute("/_auth/register")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  beforeLoad: async ({ context, search }) => {
    const sessionSnapshot = await context.session.refresh();

    if (hasActiveSession(sessionSnapshot)) {
      throw redirect({
        to: search.redirect ?? "/notes",
      });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useAppTranslation();
  const search = Route.useSearch();
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const navigate = useNavigate();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pilotRegistrationCode, setPilotRegistrationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const redirectTarget = search.redirect ?? "/notes";
  const passwordVisibilityLabel = showPassword
    ? t("access.login.password.hide")
    : t("access.login.password.show");
  const submitLabel = isSubmitting
    ? t("access.register.submitting")
    : t("access.register.submit");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await session.register({
        displayName,
        email,
        password,
        pilotRegistrationCode,
        userLanguage: detectAnonymousUserLanguage(getBrowserLanguages()),
        userTimeZone: detectBrowserUserTimeZone(),
      });
      await router.invalidate();
      await navigate({ to: redirectTarget });
    } catch (error) {
      const appAuthError = getAppAuthError(error);

      if (appAuthError !== null) {
        setErrorMessage(appAuthError.message);
      } else {
        setErrorMessage(t("access.register.error.fallback"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="auth-card">
      <header className="auth-card__header">
        <h2 className="auth-card__heading">{t("access.register.heading")}</h2>
        <p className="auth-card__subtitle">{t("access.register.subtitle")}</p>
      </header>

      <form
        aria-label={t("access.register.formLabel")}
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label className="auth-field-label" htmlFor="register-name">
          {t("access.register.displayName.label")}
        </label>
        <div className="auth-field">
          <span aria-hidden="true" className="auth-field__icon">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
              width="18"
            >
              <title>{t("access.register.displayName.label")}</title>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </span>
          <input
            autoComplete="name"
            className="auth-field__input"
            id="register-name"
            name="displayName"
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("access.register.displayName.placeholder")}
            required
            type="text"
            value={displayName}
          />
        </div>

        <label className="auth-field-label" htmlFor="register-email">
          {t("access.register.email.label")}
        </label>
        <div className="auth-field">
          <span aria-hidden="true" className="auth-field__icon">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
              width="18"
            >
              <title>{t("access.register.email.label")}</title>
              <rect height="14" rx="2" width="18" x="3" y="5" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <input
            autoComplete="email"
            className="auth-field__input"
            id="register-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("access.register.email.placeholder")}
            required
            type="email"
            value={email}
          />
        </div>

        <label
          className="auth-field-label"
          htmlFor="register-pilot-registration-code"
        >
          {t("access.register.pilotCode.label")}
        </label>
        <div className="auth-field">
          <span aria-hidden="true" className="auth-field__icon">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
              width="18"
            >
              <title>{t("access.register.pilotCode.label")}</title>
              <path d="M4 7h16" />
              <path d="M7 4v6" />
              <path d="M17 4v6" />
              <rect height="12" rx="2" width="18" x="3" y="8" />
              <path d="M9 14h6" />
            </svg>
          </span>
          <input
            autoComplete="off"
            className="auth-field__input"
            id="register-pilot-registration-code"
            name="pilotRegistrationCode"
            onChange={(event) => setPilotRegistrationCode(event.target.value)}
            placeholder={t("access.register.pilotCode.placeholder")}
            required
            type="text"
            value={pilotRegistrationCode}
          />
        </div>

        <label className="auth-field-label" htmlFor="register-password">
          {t("access.register.password.label")}
        </label>
        <div className="auth-field">
          <span aria-hidden="true" className="auth-field__icon">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
              width="18"
            >
              <title>{t("access.register.password.label")}</title>
              <rect height="11" rx="2" width="14" x="5" y="11" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <input
            autoComplete="new-password"
            className="auth-field__input"
            id="register-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("access.register.password.placeholder")}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={passwordVisibilityLabel}
            className="auth-field__toggle"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
              width="18"
            >
              <title>{passwordVisibilityLabel}</title>
              {showPassword ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.1A10.5 10.5 0 0 1 12 6c5 0 9 4 10 6a13 13 0 0 1-3 3.7M6.6 6.6C4.5 8 3 10.5 2 12c1 2 5 6 10 6 1.5 0 2.9-.3 4.1-.8" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </>
              ) : (
                <>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>

        {errorMessage !== null ? (
          <p className="auth-form__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button className="auth-submit" disabled={isSubmitting} type="submit">
          {submitLabel}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t("common.or")}</span>
      </div>

      <p className="auth-footer">
        {t("access.register.footer.prompt")}{" "}
        <Link className="auth-link" search={(prev) => prev} to="/login">
          {t("access.register.footer.login")}
        </Link>
      </p>
    </article>
  );
}

function detectBrowserUserTimeZone(): UserTimeZonePreference {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? defaultUserTimeZone
  );
}

function getBrowserLanguages(): readonly string[] {
  if (navigator.languages.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}
