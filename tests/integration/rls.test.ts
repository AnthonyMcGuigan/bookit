import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, createUniverse, userClient, type Client } from "./helpers";
import { planOf } from "./helpers";

let owner: Awaited<ReturnType<typeof userClient>>;
let intruder: Awaited<ReturnType<typeof userClient>>;
let universeId: string;
let wrestlerId: string;

beforeAll(async () => {
  owner = await userClient("Owner");
  intruder = await userClient("Intruder");
  const created = await createUniverse(owner.client, "Private save");
  universeId = created.universeId;
  wrestlerId = created.state.wrestlers[0].id;
});

describe("private universes", () => {
  it("are readable by their owner", async () => {
    const { data } = await owner.client.from("universes").select("id").eq("id", universeId);
    expect(data).toHaveLength(1);
    const { data: wrestlers } = await owner.client.from("wrestlers").select("id").eq("universe_id", universeId);
    expect(wrestlers!.length).toBeGreaterThan(10);
  });

  it("are invisible to other users and anonymous visitors", async () => {
    for (const client of [intruder.client, anonClient()] as Client[]) {
      expect((await client.from("universes").select("id").eq("id", universeId)).data ?? []).toHaveLength(0);
      expect((await client.from("wrestlers").select("id").eq("universe_id", universeId)).data ?? []).toHaveLength(0);
      expect((await client.from("shows").select("id").eq("universe_id", universeId)).data ?? []).toHaveLength(0);
    }
    const snapshot = await intruder.client.rpc("get_universe_snapshot", { p_universe: universeId });
    expect(snapshot.data ?? null).toBeNull();
  });

  it("cannot be modified or deleted by other users", async () => {
    await intruder.client.from("wrestlers").update({ popularity: 1 }).eq("id", wrestlerId);
    await intruder.client.from("universes").update({ name: "hacked" }).eq("id", universeId);
    await intruder.client.from("universes").delete().eq("id", universeId);
    const { data } = await owner.client.from("wrestlers").select("popularity").eq("id", wrestlerId).single();
    expect(data!.popularity).not.toBe(1);
    const { data: u } = await owner.client.from("universes").select("name").eq("id", universeId).single();
    expect(u!.name).toBe("Private save");
  });

  it("rejects writes into another user's universe through the RPCs", async () => {
    const imported = await intruder.client.rpc("import_universe_rows", { p_universe: null as never, p_universe_id: universeId, p_rows: {} as never });
    expect(imported.error?.message).toMatch(/UNIVERSE_NOT_FOUND/);
    const applied = await intruder.client.rpc("apply_world_changes", { p_universe: universeId, p_changes: { gameDate: "2030-01-01" } as never });
    expect(applied.error).not.toBeNull();
    const batch = await intruder.client.rpc("simulate_batch", { p_universe: universeId, p_expected_revision: 1, p_rows: {} as never, p_steps: [] as never });
    expect(batch.error).not.toBeNull();
  });

  it("forces the owner's id on new universes", async () => {
    const { data } = await owner.client.from("universes").select("owner_id").eq("id", universeId).single();
    expect(data!.owner_id).toBe(owner.id);
    const moved = await owner.client.from("universes").update({ owner_id: intruder.id } as never).eq("id", universeId);
    expect(moved.error).not.toBeNull();
  });
});

describe("protected account data", () => {
  it("users cannot grant themselves entitlements or roles", async () => {
    const ent = await owner.client.from("entitlements").insert({ user_id: owner.id, source: "grant", plan: "premium" } as never);
    expect(ent.error).not.toBeNull();
    const role = await owner.client.from("user_roles").insert({ user_id: owner.id, role: "admin" } as never);
    expect(role.error).not.toBeNull();
    expect(await planOf(owner.client)).toBe("free");
  });

  it("users cannot lift their own restrictions or read others' entitlements", async () => {
    const lift = await owner.client.from("account_restrictions").update({ lifted_at: new Date().toISOString() } as never).eq("user_id", owner.id);
    expect(lift.error ?? (lift.data ?? [])).toBeTruthy();
    const { data } = await intruder.client.from("entitlements").select("id").eq("user_id", owner.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("moderation functions are refused for regular users", async () => {
    const r = await owner.client.rpc("restrict_account", { p_user: intruder.id, p_kind: "suspended", p_reason: "nope", p_days: 1 });
    expect(r.error?.message).toMatch(/FORBIDDEN/);
    const role = await owner.client.rpc("set_user_role", { p_user: owner.id, p_role: "admin", p_grant: true, p_reason: "self" });
    expect(role.error?.message).toMatch(/FORBIDDEN/);
  });
});
