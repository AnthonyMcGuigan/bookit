import { expect, test } from "@playwright/test";
import { createConfirmedUser, createStarterUniverse, expectNoHorizontalOverflow, signIn, trackPageErrors } from "./helpers";

test("book, reorder and simulate a show exactly once", async ({ page }) => {
  const errors = trackPageErrors(page);
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  await createStarterUniverse(page, "Booking E2E");
  const before = await page.getByTestId("game-date").textContent();

  await page.getByRole("link", { name: "Booking" }).first().click();
  await expectNoHorizontalOverflow(page);
  await page.getByTestId("upcoming-shows").getByRole("link", { name: /Ironside Uprising #320/ }).click();
  const card = page.getByTestId("card-list");
  await expect(card).toBeVisible();
  const initialCount = await card.locator("li").count();

  // Add a promo segment.
  await page.getByRole("link", { name: "Add segment" }).click();
  await page.getByLabel("Segment type").selectOption("promo");
  await page.getByRole("button", { name: "+ Add participant" }).click();
  await page.getByLabel("Side A wrestler 1").selectOption({ index: 1 });
  await page.getByLabel("Title (optional)").fill("State of the Ironside");
  await page.getByRole("button", { name: "Add to card" }).click();
  await expect(card.locator("li")).toHaveCount(initialCount + 1);
  await expectNoHorizontalOverflow(page);

  // Move the new last segment up one slot.
  const lastRow = card.locator("li").last();
  await expect(lastRow).toContainText("State of the Ironside");
  await lastRow.getByRole("button", { name: /up$/ }).click();
  await expect(card.locator("li").nth(initialCount - 1)).toContainText("State of the Ironside");
  await expect(card).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("status").filter({ hasText: /changed|wrong/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("card-list").locator("li").nth(initialCount - 1)).toContainText("State of the Ironside");

  // Simulate.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Simulate show" }).click();
  await expect(page.getByTestId("show-rating")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("results").locator(":scope > li")).toHaveCount(initialCount + 1);
  await expect(page.getByTestId("game-date")).not.toHaveText(before ?? "");
  await expectNoHorizontalOverflow(page);
  // Reloading shows the saved results rather than simulating again.
  await page.reload();
  await expect(page.getByRole("button", { name: "Simulate show" })).toHaveCount(0);

  expect(errors).toEqual([]);
});
