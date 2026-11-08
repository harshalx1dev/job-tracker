import { expect, test } from "@playwright/test";

// A fresh throwaway account per run, on the local test domain.
const email = `e2e-${Date.now()}@trackr.test`;
const password = "e2e-pass-123456";

test.describe.configure({ mode: "serial" });

test("landing page shows the product and the main action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Job tracker",
  );
  await expect(
    page.getByRole("link", { name: "Create free account" }).first(),
  ).toBeVisible();
});

test("sign up, add a job, see it on the board and in the list", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/app/jobs", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Wishlist column" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Add job/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Company").fill("Playwright Inc");
  await dialog.getByLabel("Role").fill("Frontend Engineer");
  await dialog.getByRole("button", { name: "Add job" }).click();

  const card = page
    .getByRole("region", { name: "Wishlist column" })
    .getByText("Frontend Engineer");
  await expect(card).toBeVisible();

  await card.click();
  await expect(
    page.getByRole("dialog").getByText("Playwright Inc"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Added to Wishlist"),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "list" }).click();
  await expect(page.getByRole("table")).toContainText("Playwright Inc");
});

test("settings show the AI key form and the pipeline stages", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app/**");

  await page.goto("/app/settings");
  await expect(page.getByLabel("Gemini API key")).toBeVisible();
  await expect(page.getByLabel("Stage name").first()).toHaveValue("Wishlist");
});

test("forgot password answers the same for any email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.waitForURL("**/forgot-password");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(
    page.getByText("This link has expired or was already used"),
  ).toBeVisible();
});
