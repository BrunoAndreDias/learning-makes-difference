import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import {
  AppAuthError,
  type AppSessionSnapshot,
  hasActiveSession,
} from "../lib/session";

export const Route = createFileRoute("/_public/login")({
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

type AuthMode = "login" | "register";

function LoginPage() {
  const search = Route.useSearch();
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const navigate = useNavigate();
  const router = useRouter();
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const isRegistrationMode = mode === "register";
  const redirectTarget = search.redirect ?? "/notes";
  let submitButtonLabel = "Log in";

  if (isRegistrationMode) {
    submitButtonLabel = "Create account";
  }

  if (isSubmitting) {
    submitButtonLabel = "Submitting...";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      if (isRegistrationMode) {
        await session.register({
          displayName,
          email,
          password,
        });
      } else {
        await session.login({
          email,
          password,
        });
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
    <section className="stack">
      <article className="card stack">
        <p className="section-label">Public route</p>
        <h2>Welcome back</h2>
        <p>
          Register a new account or log in to continue into your protected study
          workspace.
        </p>
      </article>

      <div className="placeholder-grid auth-grid">
        <article className="card stack">
          <fieldset className="auth-mode-toggle">
            <legend className="section-label">Auth mode</legend>
            <button
              aria-pressed={mode === "login"}
              className="auth-mode-toggle__button"
              onClick={() => setMode("login")}
              type="button"
            >
              Log in
            </button>
            <button
              aria-pressed={mode === "register"}
              className="auth-mode-toggle__button"
              onClick={() => setMode("register")}
              type="button"
            >
              Create account
            </button>
          </fieldset>

          <form
            aria-label={isRegistrationMode ? "Registration form" : "Login form"}
            className="auth-form"
            onSubmit={handleSubmit}
          >
            {isRegistrationMode ? (
              <label className="auth-form__field">
                <span>Display name</span>
                <input
                  autoComplete="name"
                  name="displayName"
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  type="text"
                  value={displayName}
                />
              </label>
            ) : null}

            <label className="auth-form__field">
              <span>Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="auth-form__field">
              <span>Password</span>
              <input
                autoComplete={
                  isRegistrationMode ? "new-password" : "current-password"
                }
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {errorMessage !== null ? (
              <p className="auth-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="auth-form__submit"
              disabled={isSubmitting}
              type="submit"
            >
              {submitButtonLabel}
            </button>
          </form>
        </article>

        <article className="card stack">
          <p className="section-label">Entry point</p>
          <p>After authentication you'll continue to:</p>
          <code>{redirectTarget}</code>
          <div className="tag-row">
            <span className="tag">
              {sessionSnapshot.user === null
                ? "No active session"
                : `Signed in as ${sessionSnapshot.user.displayName}`}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
