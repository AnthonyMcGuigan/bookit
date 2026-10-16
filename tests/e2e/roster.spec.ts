import { expect, test } from "@playwright/test";
import { createConfirmedUser, createStarterUniverse, expectNoHorizontalOverflow, signIn, trackPageErrors } from "./helpers";

test("manage roster, teams and championships", async ({ page }) => {
  const errors = trackPageErrors(page);
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  const universeId = await createStarterUniverse(page, "Roster E2E");
  const base = `/u/${universeId}`;

  // Roster list with filters.
  await page.getByRole("link", { name: "Roster" }).first().click();
  await expect(page.getByTestId("roster-list")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Search names").fill("Vane");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByTestId("roster-list").getByRole("link")).toHaveCount(1);

  // Create a wrestler and sign them.
  await page.goto(`${base}/roster/new`);
  await page.getByLabel("Ring name").fill("Test Subject Zero");
  await page.getByLabel("In-ring").fill("72");
  await page.getByRole("button", { name: "Create wrestler" }).click();
  await expect(page.getByRole("heading", { name: /Test Subject Zero/ })).toBeVisible();
  await expect(page.getByText("Ironside Pro Wrestling", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Release them.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Release" }).click();
  await expect(page.getByText("Free agent", { exact: true })).toBeVisible();

  // Record and heal a storyline injury.
  await page.getByText("Add an injury").click();
  await page.getByLabel("Description").fill("Bruised ribs");
  await page.getByRole("button", { name: "Record injury" }).click();
  await expect(page.getByText("Bruised ribs").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark healed" }).click();
  await expect(page.getByText("Fit to compete").first()).toBeVisible();

  // Create a tag team.
  await page.goto(`${base}/teams/new`);
  await page.getByLabel("Name", { exact: true }).fill("Test Tandem");
  const boxes = page.locator('input[name="members"]');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("heading", { name: /Test Tandem/ })).toBeVisible();

  // Vacate and award a championship.
  await page.goto(`${base}/championships`);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: /Ironside Heritage/ }).first().click();
  await page.getByText("Vacate or strip").click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Vacate championship" }).click();
  await expect(page.getByText("Championship vacated")).toBeVisible();
  await page.getByText("Award manually").click();
  await page.getByLabel("New champion").selectOption({ label: "Test Subject Zero" });
  await page.getByRole("button", { name: "Award championship" }).click();
  await expect(page.getByText("New champion recorded")).toBeVisible();
  await expect(page.getByText("Test Subject Zero").first()).toBeVisible();

  expect(errors).toEqual([]);
});
