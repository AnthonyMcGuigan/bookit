import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { createConfirmedUser, createStarterUniverse, signIn, trackPageErrors } from "./helpers";

test("upload, serve privately and remove a wrestler portrait", async ({ page, browser }) => {
  const errors = trackPageErrors(page);
  const user = await createConfirmedUser();
  await signIn(page, user.email);
  const id = await createStarterUniverse(page, "Media E2E");
  await page.goto(`/u/${id}/roster`);
  const href = await page.getByTestId("roster-list").getByRole("link").first().getAttribute("href");
  await page.goto(`${href}/edit`);

  const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#3355aa" } }).png().toBuffer();
  await page.getByLabel("Portrait").setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Image uploaded.")).toBeVisible();

  await page.goto(href!);
  const img = page.locator('img[alt$="portrait"]').first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/media\/[0-9a-f-]{36}\?v=thumb$/);
  const own = await page.request.get(src!);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("image/webp");

  // Another account (and anonymous visitors) cannot fetch the private image.
  const other = await createConfirmedUser("Other");
  const ctx = await browser.newContext();
  const otherPage = await ctx.newPage();
  await signIn(otherPage, other.email);
  expect((await otherPage.request.get(src!)).status()).toBe(404);
  const anon = await browser.newContext();
  expect((await (await anon.newPage()).request.get(`${new URL(page.url()).origin}${src}`)).status()).toBe(404);
  await ctx.close();
  await anon.close();

  // Invalid files are rejected by the server even if the browser check is bypassed.
  await page.goto(`${href}/edit`);
  await page.getByLabel("Portrait").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image at all") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("That file isn't a valid image.")).toBeVisible();

  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(page.getByText(/Image removed/)).toBeVisible();
  expect((await page.request.get(src!)).status()).toBe(404);
  expect(errors).toEqual([]);
});
