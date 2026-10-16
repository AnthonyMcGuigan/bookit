import { expect, test, type Browser } from "@playwright/test";
import sharp from "sharp";
import { admin, createConfirmedUser, createStarterUniverse, signIn, trackPageErrors } from "./helpers";

async function signedInPage(browser: Browser, email: string) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  const page = await ctx.newPage();
  await signIn(page, email);
  return { ctx, page };
}

test("review queue, reports, appeals, restrictions and takedowns", async ({ page, browser, baseURL }) => {
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  const creator = await createConfirmedUser("Creator Mod");
  await signIn(page, creator.email);
  const universeId = await createStarterUniverse(page, "Moderated World");

  // Give a wrestler a portrait, then publish that wrestler with images (needs review).
  await page.goto(`/u/${universeId}/roster`);
  const href = (await page.getByTestId("roster-list").getByRole("link").first().getAttribute("href"))!;
  const wrestlerId = href.split("/").pop()!;
  await page.goto(`${href}/edit`);
  const png = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#aa3355" } }).png().toBuffer();
  await page.getByLabel("Portrait").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Image uploaded.")).toBeVisible();

  await page.goto(`/u/${universeId}/community`);
  await page.getByLabel("What to share").selectOption("wrestler");
  await page.locator("#root_wrestler").selectOption(wrestlerId);
  const title = `Moderated ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("I have the right to share this").check();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/community\/[0-9a-f-]{36}\?published=1&review=1/);
  await expect(page.getByText("Submitted for review")).toBeVisible();
  const creationPath = new URL(page.url()).pathname;
  const creationId = creationPath.split("/").pop()!;
  const { data: creationRow } = await admin().from("community_creations").select("thumbnail_asset_id").eq("id", creationId).single();
  const thumbUrl = `${baseURL}/media/${creationRow!.thumbnail_asset_id}`;

  // Pending content is invisible to others, including its shared image.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  expect((await anonPage.goto(`${baseURL}${creationPath}`))!.status()).toBe(404);
  expect((await anonPage.request.get(thumbUrl)).status()).toBe(404);

  // Non-moderators can't open the dashboard.
  const reporterUser = await createConfirmedUser("Reporter");
  const reporter = await signedInPage(browser, reporterUser.email);
  expect((await reporter.page.goto("/moderation"))!.status()).toBe(404);

  // A moderator approves it from the queue.
  const modUser = await createConfirmedUser("Mod Person");
  await admin().from("user_roles").insert({ user_id: modUser.id, role: "moderator" });
  const mod = await signedInPage(browser, modUser.email);
  await mod.page.goto("/moderation");
  const card = mod.page.getByTestId("moderation-queue").locator("li", { hasText: title });
  await card.getByLabel("Decision").selectOption("approve");
  await card.getByLabel(/^Reason/).fill("Original artwork, approved.");
  await card.getByRole("button", { name: "Record decision" }).click();
  await expect(mod.page.getByText("Decision recorded.")).toBeVisible();
  expect((await anonPage.goto(`${baseURL}${creationPath}`))!.status()).toBe(200);
  expect((await anonPage.request.get(thumbUrl)).status()).toBe(200);

  // An IP report hides it pending review.
  await reporter.page.goto(creationPath);
  await reporter.page.getByText("Report this creation").click();
  await reporter.page.getByLabel("Reason").selectOption("ip_infringement");
  await reporter.page.getByRole("button", { name: "Send report" }).click();
  await expect(reporter.page.getByText("Moderators will review your report.")).toBeVisible();
  expect((await anonPage.goto(`${baseURL}${creationPath}`))!.status()).toBe(404);
  expect((await anonPage.request.get(thumbUrl)).status()).toBe(404);

  // The creator sees the notice and appeals.
  await page.goto("/account/moderation");
  await expect(page.getByText("Hidden pending review").first()).toBeVisible();
  await page.getByText("Appeal this decision").click();
  await page.getByLabel("Why should this decision change?").fill("This portrait is my own original artwork.");
  await page.getByRole("button", { name: "Submit appeal" }).click();
  await expect(page.getByText("Appeal submitted.")).toBeVisible();

  // The moderator upholds the appeal; the creation is visible again and the audit log has it.
  await mod.page.goto("/moderation?tab=appeals");
  await mod.page.getByLabel("Decision").selectOption("uphold");
  await mod.page.getByLabel(/^Explanation/).fill("Verified the artwork is original.");
  await mod.page.getByRole("button", { name: "Decide" }).click();
  await expect(mod.page.getByText("Appeal upheld")).toBeVisible();
  expect((await anonPage.goto(`${baseURL}${creationPath}`))!.status()).toBe(200);
  await mod.page.goto("/moderation?tab=audit");
  await expect(mod.page.getByTestId("audit-log")).toContainText("appeal upheld");
  await expect(mod.page.getByTestId("audit-log")).toContainText("auto hide");

  // Restricting publishing blocks the creator's publish page but not their universe.
  const { data: profile } = await admin().from("profiles").select("handle").eq("id", creator.id).single();
  await mod.page.goto("/moderation?tab=accounts");
  await mod.page.getByLabel("Creator handle").first().fill(profile!.handle);
  await mod.page.getByLabel(/^Reason/).first().fill("Repeated low-effort spam.");
  await mod.page.getByLabel("Days (blank = until lifted)").fill("7");
  await mod.page.getByRole("button", { name: "Apply restriction" }).click();
  await expect(mod.page.getByText("Restriction applied.")).toBeVisible();
  await page.goto(`/u/${universeId}/community`);
  await expect(page.getByText("Publishing is unavailable")).toBeVisible();
  await page.goto(`/u/${universeId}`);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Anyone can file a takedown; a linked creation is hidden while it's reviewed.
  await anonPage.goto(`${baseURL}/policies/ip`);
  await anonPage.getByLabel("Your full name", { exact: true }).fill("Rights Holder");
  await anonPage.getByLabel("Email", { exact: true }).fill("legal@example.test");
  await anonPage.getByLabel("The work you own").fill("Our registered character artwork is used without permission.");
  await anonPage.getByLabel("Link to the content").fill(`${baseURL}${creationPath}`);
  await anonPage.getByLabel(/good faith/).check();
  await anonPage.getByLabel(/information in this request is accurate/).check();
  await anonPage.getByLabel("Electronic signature (type your full name)").fill("Rights Holder");
  await anonPage.getByRole("button", { name: "Submit request" }).click();
  await expect(anonPage.getByText("Request received.")).toBeVisible();
  expect((await anonPage.goto(`${baseURL}${creationPath}`))!.status()).toBe(404);
  await mod.page.goto("/moderation?tab=takedowns");
  await expect(mod.page.getByText("Rights Holder").first()).toBeVisible();

  expect(errors).toEqual([]);
  await Promise.all([anon.close(), reporter.ctx.close(), mod.ctx.close()]);
});
