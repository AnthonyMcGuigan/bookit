import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.test", override: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Integration tests need the local Supabase stack: run `npm run supabase:start` and fill .env.local (see README → Testing).");
}
