import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/app/settings")({
  component: SettingsPlaceholder,
});

function SettingsPlaceholder() {
  return (
    <section className="card stack">
      <p className="section-label">Protected route</p>
      <h3>Settings placeholder</h3>
      <p>
        Profile, language, and future account configuration will be added in
        later issues.
      </p>
    </section>
  );
}
