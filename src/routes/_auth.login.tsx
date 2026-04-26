import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { AppAuthError, hasActiveSession } from "../features/session/session";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  beforeLoad: ({ context, search }) => {
    if (hasActiveSession(context.session.getSnapshot())) {
      throw redirect({
        to: search.redirect ?? "/notes",
      });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const redirectTarget = search.redirect ?? "/notes";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await session.login({ email, password });

      if (!rememberMe && typeof window !== "undefined") {
        // Session lib persists to localStorage; clear it on tab close so
        // unchecked "Remember me" doesn't survive a browser close.
        window.addEventListener(
          "beforeunload",
          () => {
            session.logout();
          },
          { once: true },
        );
      }

      await router.invalidate();
      await navigate({ to: redirectTarget });
    } catch (error) {
      if (error instanceof AppAuthError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Authentication failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="auth-card">
      <header className="auth-card__header">
        <h2 className="auth-card__heading">Welcome back</h2>
        <p className="auth-card__subtitle">
          Log in to your account to continue
        </p>
      </header>

      <form
        aria-label="Sign in form"
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label className="auth-field-label" htmlFor="login-email">
          Email
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
              <title>Email</title>
              <rect height="14" rx="2" width="18" x="3" y="5" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <input
            autoComplete="email"
            className="auth-field__input"
            id="login-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            required
            type="email"
            value={email}
          />
        </div>

        <label className="auth-field-label" htmlFor="login-password">
          Password
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
              <title>Password</title>
              <rect height="11" rx="2" width="14" x="5" y="11" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <input
            autoComplete="current-password"
            className="auth-field__input"
            id="login-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
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
              <title>{showPassword ? "Hide password" : "Show password"}</title>
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

        <div className="auth-row">
          <label className="auth-remember">
            <input
              checked={rememberMe}
              name="remember"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <span>Remember me</span>
          </label>
          <Link className="auth-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {errorMessage !== null ? (
          <p className="auth-form__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button className="auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <p className="auth-footer">
        Don't have an account?{" "}
        <Link className="auth-link" search={(prev) => prev} to="/register">
          Sign up
        </Link>
      </p>
    </article>
  );
}
