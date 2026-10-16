import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildStarterUniverse } from "@/lib/seed/starter";
import { remapUniverseIds, toImportRows } from "@/lib/storage/remap";
import { universeRow } from "@/lib/storage/universe-row";

export type Client = SupabaseClient<Database>;
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export function adminClient(): Client {
  return createClient<Database>(url(), (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
}

export function anonClient(): Client {
  return createClient<Database>(url(), anonKey(), { auth: { persistSession: false } });
}

/** Creates a confirmed user and returns a client signed in as them. */
export async function userClient(name = "Tester"): Promise<{ client: Client; id: string; email: string }> {
  const email = `int-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.test`;
  const password = "Integration-123!";
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
  if (error) throw error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, id: data.user.id, email };
}

/** Creates a starter universe owned by the client's user via the real import RPC. */
export async function createUniverse(client: Client, name = "Integration") {
  const { state } = remapUniverseIds(buildStarterUniverse({ name }));
  const { data, error } = await client.rpc("import_universe_rows", {
    p_universe: universeRow(state.universe) as never,
    p_universe_id: state.universe.id,
    p_rows: toImportRows(state) as never,
  });
  if (error) throw error;
  return { universeId: data as string, state };
}

/** The caller's effective plan as the server computes it. */
export async function planOf(client: Client): Promise<string> {
  const { data, error } = await client.rpc("my_entitlements");
  if (error) throw error;
  return (data as { plan: string }).plan;
}
