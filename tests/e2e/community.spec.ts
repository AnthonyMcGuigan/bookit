import { expect, test } from "@playwright/test";
import { createConfirmedUser, createStarterUniverse, expectNoHorizontalOverflow, signIn, trackPageErrors } from "./helpers";

test("export, publish, rate, import with a conflict and report", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  const creator = await createConfirmedUser("Creator One");
  await signIn(page, creator.email);
  const universeId = await createStarterUniverse(page, "Creator World");

  // Full-universe JSON export of the player's own save.
  const exported = await page.request.get(`/u/${universeId}/export/download?kind=universe&format=json`);
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-disposition"]).toMatch(/attachment; filename=".+\.universe\.json"/);
  const pkg = JSON.parse(await exported.text());
  expect(pkg.format).toBe("pwbs-package");
  expect(pkg.content.wrestlers.length).toBeGreaterThan(10);

  // Publish one wrestler.
  await page.goto(`/u/${universeId}/community`);
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("What to share").selectOption("wrestler");
  const wrestlerSelect = page.locator("#root_wrestler");
  const wrestlerName = (await wrestlerSelect.locator("option:checked").textContent())!.trim();
  const title = `E2E ${wrestlerName} ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("A test publication");
  await page.getByLabel("Tags").fill("e2e, Test Tag");
  await page.getByLabel("I have the right to share this").check();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/community\/[0-9a-f-]{36}\?published=1/);
  await expect(page.getByText("Version 1 published")).toBeVisible();
  const creationUrl = page.url().split("?")[0];
  const creationPath = new URL(creationUrl).pathname;

  // It appears in the public library search, also for signed-out visitors.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${new URL(creationUrl).origin}/community?q=${encodeURIComponent(title)}`);
  await expect(anonPage.getByTestId("creation-card")).toHaveCount(1);
  await anonPage.goto(creationUrl);
  await expect(anonPage.getByText("Sign in to import, rate or report.")).toBeVisible();
  await anon.close();

  // A second player with the same starter roster rates and imports it.
  const ctx = await browser.newContext({ ...test.info().project.use });
  const player = await ctx.newPage();
  const playerErrors = trackPageErrors(player);
  const other = await createConfirmedUser("Player Two");
  await signIn(player, other.email);
  const targetId = await createStarterUniverse(player, "Player World");
  await player.goto(creationPath);
  await player.getByLabel("Your rating").selectOption("4");
  await player.getByRole("button", { name: "Rate" }).click();
  await expect(player.getByTestId("creation-rating")).toContainText("4.0");

  await player.getByTestId("import-creation").click();
  await player.getByRole("button", { name: "Check package" }).click();
  const conflicts = player.getByTestId("import-conflicts");
  await expect(conflicts).toContainText(wrestlerName);
  await player.getByLabel(`What to do with ${wrestlerName}`).selectOption("rename");
  await player.getByLabel(`New name for ${wrestlerName}`).fill(`${wrestlerName} II`);
  await player.getByRole("button", { name: "Import", exact: true }).click();
  await player.waitForURL(new RegExp(`/u/${targetId}\\?imported=1`));
  await expect(player.getByTestId("import-complete")).toContainText("1 record(s) imported");
  await player.goto(`/u/${targetId}/roster?group=free&q=${encodeURIComponent(`${wrestlerName} II`)}`);
  await expect(player.getByText(`${wrestlerName} II`).first()).toBeVisible();

  await player.goto(creationPath);
  await expect(player.getByTestId("creation-downloads")).toContainText("1 download");

  // Import the creator's full-universe file as a brand-new save.
  await player.goto("/universes/import");
  await player.getByLabel("Package file").setInputFiles({ name: "world.universe.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pkg)) });
  await expect(player.getByLabel("New universe name")).toHaveValue("Creator World");
  await player.getByLabel("New universe name").fill("Imported World");
  await player.getByRole("button", { name: "Create universe" }).click();
  await player.waitForURL(/\/u\/[0-9a-f-]{36}\?imported=/);
  expect(player.url()).not.toContain(targetId);
  await expect(player.getByText("Imported World").first()).toBeVisible();

  // Reporting works once per creation.
  await player.goto(creationPath);
  await player.getByText("Report this creation").click();
  await player.getByLabel("Reason").selectOption("spam");
  await player.getByRole("button", { name: "Send report" }).click();
  await expect(player.getByText("Moderators will review your report.")).toBeVisible();

  // The creator sees it in My creations and can't rate their own work.
  await page.goto("/community/mine");
  await expect(page.getByTestId("my-creations")).toContainText(title);
  await page.goto(creationPath);
  await expect(page.getByText("You can't rate your own creation.")).toBeVisible();

  expect(errors).toEqual([]);
  expect(playerErrors).toEqual([]);
  await ctx.close();
});

test("rejects a damaged package with a clear message", async ({ page }) => {
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  await page.goto("/universes/import");
  await page.getByLabel("Package file").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
  await expect(page.getByText("This file isn't valid JSON.")).toBeVisible();
  await page.getByLabel("Package file").setInputFiles({ name: "future.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "pwbs-package", schemaVersion: 99 })) });
  await expect(page.getByText("newer version of the game")).toBeVisible();
});
