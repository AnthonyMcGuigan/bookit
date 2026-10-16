import { test } from "@playwright/test";
import { createConfirmedUser, signIn, createStarterUniverse } from "./helpers";
test("smoke", async ({ page }) => {
  const u = await createConfirmedUser();
  await signIn(page, u.email);
  await createStarterUniverse(page);
  const wide = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) out.push(`${el.tagName}.${(el as HTMLElement).className?.toString().slice(0, 80)} right=${Math.round(r.right)}`);
    });
    const sw: string[] = [];
    document.querySelectorAll("body *").forEach((el) => { if ((el as HTMLElement).scrollWidth > 420 && el.tagName !== "NAV" && el.tagName !== "UL") sw.push(`${el.tagName}.${(el as HTMLElement).className?.toString().slice(0, 60)} sw=${(el as HTMLElement).scrollWidth} w=${Math.round(el.getBoundingClientRect().width)}`); });
    return { vw, iw: window.innerWidth, dsw: document.documentElement.scrollWidth, sw: sw.slice(0, 20) };
  });
  console.log(JSON.stringify(wide, null, 1));
});
