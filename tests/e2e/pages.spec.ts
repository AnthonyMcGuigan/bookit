import { expect, test } from "@playwright/test";
import { createConfirmedUser, createStarterUniverse, expectNoHorizontalOverflow, signIn, trackPageErrors } from "./helpers";

test("every universe screen renders on mobile without errors or sideways scrolling", async ({ page }) => {
  const errors = trackPageErrors(page);
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  const id = await createStarterUniverse(page, "Pages E2E");
  const paths = ["", "/roster", "/roster/new", "/teams", "/teams/new", "/booking", "/championships", "/championships/new", "/more", "/promotions", "/venues", "/storylines", "/storylines/new", "/history", "/history?tab=shows", "/finances", "/settings"];
  for (const p of paths) {
    const res = await page.goto(`/u/${id}${p}`);
    expect(res?.status(), p).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  // Detail pages reached by following the first link of each list.
  for (const [list, pattern] of [["/storylines", /\/storylines\/[0-9a-f-]{36}$/], ["/teams", /\/teams\/[0-9a-f-]{36}$/], ["/promotions", /\/promotions\/[0-9a-f-]{36}$/]] as const) {
    await page.goto(`/u/${id}${list}`);
    const href = await page.locator(`a[href*="${list}/"]`).filter({ hasNotText: "New" }).first().getAttribute("href");
    await page.goto(href!);
    await expect(page).toHaveURL(pattern);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("storyline lifecycle and settings changes", async ({ page }) => {
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  const id = await createStarterUniverse(page, "Story E2E");
  await page.goto(`/u/${id}/storylines/new`);
  await page.getByLabel("Title", { exact: true }).fill("The Long Road");
  await page.getByLabel("Protagonists").selectOption({ index: 0 });
  await page.getByLabel("Antagonists").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Start storyline" }).click();
  await expect(page.getByRole("heading", { name: "The Long Road" })).toBeVisible();
  await page.getByLabel("What happened?").fill("A sneak attack backstage");
  await page.getByRole("button", { name: "Add development" }).click();
  await expect(page.getByText("A sneak attack backstage")).toBeVisible();

  await page.goto(`/u/${id}/settings`);
  await page.getByLabel("Financial management").uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.goto(`/u/${id}/finances`);
  await expect(page.getByText("Finances are off")).toBeVisible();
});
