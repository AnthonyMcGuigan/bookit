import { expect, test } from "@playwright/test";
import { PASSWORD, latestEmailLink, signIn, uniqueEmail } from "./helpers";

/** Email links use the configured site URL; point them at the server under test. */
function onTestServer(link: string, baseURL: string | undefined) {
  const url = new URL(link);
  return `${baseURL}${url.pathname}${url.search}`;
}

test("sign up, confirm email, sign out, reset password and sign in again", async ({ page, baseURL }) => {
  const email = uniqueEmail("auth");
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("Auth Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("You must agree", { exact: false }).or(page.getByText("agree", { exact: false })).first()).toBeVisible();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Check ${email} for a confirmation link`)).toBeVisible();

  // Unconfirmed accounts can't sign in.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  const confirm = await latestEmailLink(email, "/auth/confirm");
  await page.goto(onTestServer(confirm, baseURL));
  await expect(page).toHaveURL(/\/universes/);
  await expect(page.getByRole("heading", { name: "Your universes" })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/universes");
  await expect(page).toHaveURL(/\/sign-in/);

  // Password recovery.
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
  let reset = "";
  for (let i = 0; i < 20 && !reset.includes("type=recovery"); i++) {
    reset = await latestEmailLink(email, "/auth/confirm");
    if (!reset.includes("type=recovery")) await page.waitForTimeout(500);
  }
  await page.goto(onTestServer(reset, baseURL));
  await expect(page).toHaveURL(/\/account\/reset-password/);
  const newPassword = "Brand-New-456!";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Your password has been updated.")).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, email, newPassword);
});

test("protected pages redirect signed-out visitors to sign in", async ({ page }) => {
  for (const path of ["/universes", "/account", "/community/mine", "/universes/import", "/moderation"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in\?next=/);
  }
  // The public library and policies stay open.
  for (const path of ["/community", "/policies/content", "/policies/ip"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});
