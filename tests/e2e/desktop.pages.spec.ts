import { expect, test } from "@playwright/test";
import { createConfirmedUser, createStarterUniverse, expectNoHorizontalOverflow, signIn, trackPageErrors } from "./helpers";

test("main screens render on a desktop viewport", async ({ page }) => {
  const errors = trackPageErrors(page);
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  const id = await createStarterUniverse(page, "Desktop E2E");
  for (const p of ["", "/roster", "/booking", "/championships", "/history", "/export"]) {
    await page.goto(`/u/${id}${p}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Community library" })).toBeVisible();
  expect(errors).toEqual([]);
});
