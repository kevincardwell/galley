import { test, expect, type Page } from "@playwright/test";

const ADMIN = { name: "Ada Admin", email: "admin@example.test", password: "correct-horse-battery" };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/");
}

test.describe.serial("invite-only access", () => {
  let inviteUrl = "";

  test("fresh install asks for the admin account", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    await page.fill("#auth-name", ADMIN.name);
    await page.fill("#auth-email", ADMIN.email);
    await page.fill("#auth-password", ADMIN.password);
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
  });

  test("there is no sign-up route once set up", async ({ page }) => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("admin creates two workspaces", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    for (const name of ["Marlow & Finch Joinery", "Harbourside Bakery"]) {
      await page.goto("/");
      await page.getByRole("button", { name: "New workspace" }).first().click();
      await page.fill("#ws-name", name);
      await page.getByRole("button", { name: "Create workspace" }).click();
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
  });

  test("admin invites an editor to one workspace", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin");
    await page.fill("#inv-name", "Ellie Finch");
    await page.fill("#inv-email", "ellie@example.test");
    await page.selectOption("#inv-workspace", { label: "Marlow & Finch Joinery" });
    await page.selectOption("#inv-role", "editor");
    await page.getByRole("button", { name: "Create invite link" }).click();
    const link = page.locator("#inv-link");
    await expect(link).toBeVisible();
    inviteUrl = await link.inputValue();
    expect(inviteUrl).toContain("/invite/");
  });

  test("the invitee joins and sees only that workspace", async ({ page }) => {
    await page.goto(inviteUrl);
    await page.fill("#auth-name", "Ellie Finch");
    await page.fill("#auth-password", "another-long-password");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("main").getByText("Marlow & Finch Joinery")).toBeVisible();
    await expect(page.locator("main").getByText("Harbourside Bakery")).toHaveCount(0);
    await page.goto("/w/harbourside-bakery");
    await expect(page.getByText(/not found|could not be found/i)).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  });

  test("signed-out visitors are sent to login", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/w/marlow-finch-joinery");
    await expect(page).toHaveURL(/\/login\?next=/);
    await ctx.close();
  });
});
