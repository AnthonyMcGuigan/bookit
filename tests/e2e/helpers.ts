import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.test", override: true });

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function admin() {
  return createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export const PASSWORD = "Wrestling-123!";

/** Creates an already-confirmed account through the admin API. */
export async function createConfirmedUser(displayName = "E2E Booker"): Promise<{ email: string; id: string }> {
  const email = uniqueEmail();
  const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: displayName } });
  if (error) throw error;
  return { email, id: data.user.id };
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/universes/);
}

export async function createStarterUniverse(page: Page, name = "E2E Starter"): Promise<string> {
  await page.goto("/universes");
  await page.getByLabel("Universe name").fill(name);
  await page.getByRole("button", { name: "Create universe" }).click();
  await page.waitForURL(/\/u\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  return page.url().split("/u/")[1];
}

/** Finds the most recent email to an address in the local Mailpit inbox. */
export async function latestEmailLink(email: string, pathFragment: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: Array<{ ID: string }> };
      const id = body.messages?.[0]?.ID;
      if (id) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as { HTML?: string; Text?: string };
        const html = msg.HTML ?? msg.Text ?? "";
        const match = html.match(new RegExp(`https?://[^"'\\s<>]*${pathFragment}[^"'\\s<>]*`));
        if (match) return match[0].replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email with ${pathFragment} for ${email}`);
}
