/**
 * Grants or revokes a moderator/admin role using the service role key.
 * Usage: npm run role -- <email> <moderator|admin> [--revoke]
 * Roles can otherwise only be changed by an existing admin in /moderation.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const [email, role = "moderator", flag] = process.argv.slice(2);
  if (!email || !["moderator", "admin"].includes(role)) {
    console.error("Usage: npm run role -- <email> <moderator|admin> [--revoke]");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  let userId: string | undefined;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No user with email ${email}`);
  if (flag === "--revoke") {
    const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) throw error;
    console.log(`Revoked ${role} from ${email}`);
  } else {
    const { error } = await admin.from("user_roles").upsert({ user_id: userId, role });
    if (error) throw error;
    console.log(`Granted ${role} to ${email}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
