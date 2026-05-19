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

async function createStudyNote(page: Page, input: {
  expectedAnswer: string;
  prompt: string;
}) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("textbox", { name: "Prompt" })).toBeVisible();
  await page.getByLabel("Note title").fill(input.prompt);
  await page
    .getByRole("textbox", { name: "Explanation" })
    .fill(input.expectedAnswer);
  const promptField = page.getByRole("textbox", { name: "Prompt" });
  await promptField.click();
  await promptField.press("ControlOrMeta+A");
  await promptField.fill(input.prompt);
  await page
    .getByRole("textbox", { exact: true, name: "Expected answer" })
    .fill(input.expectedAnswer);
  await expect(promptField).toHaveValue(input.prompt);
  await expect(
    page.getByRole("textbox", { exact: true, name: "Expected answer" }),
  ).toHaveValue(input.expectedAnswer);

  const saveButton = page.getByRole("button", { name: /^Save/ });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForLoadState("networkidle");
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

  await createStudyNote(page, {
    expectedAnswer,
    prompt: studyNotePrompt,
  });

  await expect(
    page.getByRole("button", { name: new RegExp(studyNotePrompt) }),
  ).toBeVisible();

  await page.reload();

  await page
    .getByRole("button", { name: new RegExp(studyNotePrompt) })
    .click();

  await expect(page.getByLabel("Prompt")).toHaveValue(studyNotePrompt);
  await expect(
    page.getByRole("textbox", { name: "Expected answer" }),
  ).toHaveValue(
    expectedAnswer,
  );

  const appSections = page.getByRole("navigation", { name: "App sections" });

  await appSections.getByRole("link", { name: "Focus" }).click();
  await expect(page).toHaveURL(/\/focus$/);

  await appSections.getByRole("link", { name: "Recall" }).click();
  await expect(page).toHaveURL(/\/recall$/);

  await page.getByRole("button", { name: /account menu/i }).click({
    force: true,
  });
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("starts persisted recall sessions from Study Notes", async ({ page }) => {
  await registerAccount(page);

  const studyNotePrompt = `E2E recall start ${Date.now()}`;
  const expectedAnswer =
    "This Study Note proves persisted recall session startup.";

  await createStudyNote(page, {
    expectedAnswer,
    prompt: studyNotePrompt,
  });

  const appSections = page.getByRole("navigation", { name: "App sections" });
  await appSections.getByRole("link", { name: "Recall" }).click();
  await expect(page).toHaveURL(/\/recall$/);

  await page.getByRole("link", { name: "Manual Recall Selection" }).click();
  await expect(page).toHaveURL(/\/recall\/select$/);

  await page
    .getByRole("checkbox", { name: new RegExp(studyNotePrompt) })
    .click();
  await page.getByRole("button", { name: "Start recall" }).click();

  await expect(page).toHaveURL(/\/recall\/session$/);
  await expect(
    page.getByRole("heading", { level: 3, name: "Recall session" }),
  ).toBeVisible();
  await expect(page.getByText(studyNotePrompt).first()).toBeVisible();
});
