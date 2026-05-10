import { expect, test, type Page } from "@playwright/test";

function uniqueAccount(testTitle: string) {
  const slug = testTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    displayName: `E2E ${slug}`,
    email: `e2e-${slug}-${suffix}@example.test`,
    password: "Playwright-test-password-123",
    pilotRegistrationCode: process.env.PILOT_REGISTRATION_CODE ?? "pilot-123",
  };
}

async function registerAccount(
  page: Page,
  account = uniqueAccount(test.info().title),
) {
  await page.goto("/register?redirect=/study-notes");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(
    page.getByRole("button", { name: "Hide password" }),
  ).toBeVisible();
  await page.getByLabel("Display name").fill(account.displayName);
  await page.getByLabel("Email").fill(account.email);
  await page
    .getByLabel("Pilot registration code")
    .fill(account.pilotRegistrationCode);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/study-notes$/);

  return account;
}

test("redirects protected routes to sign in", async ({ page }) => {
  await page.goto("/study-notes");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("registers, navigates the app, and persists a Study Note after refresh", async ({
  page,
}) => {
  await registerAccount(page);

  const studyNotePrompt = `E2E spaced recall ${Date.now()}`;
  const expectedAnswer =
    "This Study Note proves browser registration, saving, and reload.";

  await page.getByRole("button", { name: "New Study Note" }).click();
  await page.getByLabel("Prompt").fill(studyNotePrompt);
  await page
    .getByRole("textbox", { name: "Expected answer" })
    .fill(expectedAnswer);
  await page.getByLabel("Source title").fill(studyNotePrompt);
  await page.getByRole("textbox", { name: "Source body" }).fill(expectedAnswer);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("button", { exact: true, name: studyNotePrompt }),
  ).toBeVisible();

  await page.reload();

  await page
    .getByRole("button", { exact: true, name: studyNotePrompt })
    .click();

  await expect(page.getByLabel("Prompt")).toHaveValue(studyNotePrompt);
  await expect(
    page.getByRole("textbox", { name: "Expected answer" }),
  ).toHaveValue(
    expectedAnswer,
  );

  const appSections = page.getByRole("navigation", { name: "App sections" });

  await appSections.getByRole("link", { name: "Labels" }).click();
  await expect(page).toHaveURL(/\/labels$/);

  await appSections.getByRole("link", { name: "Focus" }).click();
  await expect(page).toHaveURL(/\/focus$/);

  await appSections.getByRole("link", { name: "Recall" }).click();
  await expect(page).toHaveURL(/\/recall$/);

  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
