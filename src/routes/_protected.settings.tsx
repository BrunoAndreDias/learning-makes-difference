import { createFileRoute } from "@tanstack/react-router";

import { ProductAreaPlaceholder } from "./-product-area-placeholder";

export const Route = createFileRoute("/_protected/settings")({
  component: SettingsPlaceholder,
});

function SettingsPlaceholder() {
  return (
    <ProductAreaPlaceholder
      description="Settings will eventually cover profile data, interface language, and account-level preferences."
      heading="Settings placeholder"
      intro="This stub keeps room for account details, localization controls, and future auth-adjacent actions inside the shared shell."
      sections={[
        {
          description:
            "Profile basics should sit near the top as the most common personal updates.",
          title: "Profile details",
        },
        {
          description:
            "Language controls will need enough room for explanatory copy and defaults.",
          title: "Language preferences",
        },
        {
          description:
            "Sensitive account actions should stay visually separated from routine settings.",
          title: "Account actions",
        },
      ]}
      summary={
        <p>
          The page confirms the shell can host both simple preference forms and
          more cautious account-management panels without breaking spacing or
          navigation continuity.
        </p>
      }
    />
  );
}
