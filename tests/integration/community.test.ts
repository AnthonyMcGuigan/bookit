import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createUniverse, userClient } from "./helpers";
import { buildPackage } from "@/lib/packages/build";
import { PACKAGE_SCHEMA_VERSION } from "@/lib/packages/schema";

let creator: Awaited<ReturnType<typeof userClient>>;
let fan: Awaited<ReturnType<typeof userClient>>;

const universes = new WeakMap<object, Awaited<ReturnType<typeof createUniverse>>["state"]>();

async function publish(client: typeof creator.client, overrides: Record<string, unknown> = {}) {
  if (!universes.has(client)) universes.set(client, (await createUniverse(client, "Pub")).state);
  const state = universes.get(client)!;
  const pkg = buildPackage(state, { kind: "wrestler", rootId: state.wrestlers[0].id });
  const json = JSON.stringify(pkg);
  return client.rpc("publish_creation", {
    p_creation: null as unknown as string,
    p_category: "wrestler",
    p_title: `Integration ${Date.now()}`,
    p_summary: "",
    p_description: "",
    p_tags: ["test"],
    p_visibility: "published",
    p_is_fan_content: false,
    p_allow_derivatives: true,
    p_source_creation: null as unknown as string,
    p_source_version: null as unknown as number,
    p_lineage: [] as never,
    p_package: pkg as never,
    p_package_bytes: json.length,
    p_schema_version: PACKAGE_SCHEMA_VERSION,
    p_media: [],
    p_thumbnail: null as unknown as string,
    p_changelog: "",
    p_entity_counts: {} as never,
    ...overrides,
  });
}

beforeAll(async () => {
  creator = await userClient("Creator");
  fan = await userClient("Fan");
});

describe("community rules", () => {
  it("publishes text-only content straight to the library", async () => {
    const { data, error } = await publish(creator.client);
    expect(error).toBeNull();
    const row = data![0];
    expect(row.moderation_state).toBe("approved");
    const visible = await anonClient().from("community_creations").select("id").eq("id", row.creation_id);
    expect(visible.data).toHaveLength(1);
  });

  it("allows one rating per user, never on your own creation, and counts downloads once", async () => {
    const { data } = await publish(creator.client);
    const id = data![0].creation_id;
    expect((await creator.client.rpc("rate_creation", { p_creation: id, p_stars: 5 })).error?.message).toMatch(/CANNOT_RATE_OWN_CREATION/);
    await fan.client.rpc("rate_creation", { p_creation: id, p_stars: 2 });
    await fan.client.rpc("rate_creation", { p_creation: id, p_stars: 4 });
    await fan.client.rpc("record_creation_download", { p_creation: id, p_version: 1 });
    await fan.client.rpc("record_creation_download", { p_creation: id, p_version: 1 });
    const { data: c } = await anonClient().from("community_creations").select("rating_count, rating_sum, download_count").eq("id", id).single();
    expect(c).toEqual({ rating_count: 1, rating_sum: 4, download_count: 1 });
  });

  it("owners cannot change moderation state or counters directly", async () => {
    const { data } = await publish(creator.client);
    const id = data![0].creation_id;
    const res = await creator.client.from("community_creations").update({ moderation_state: "approved", download_count: 9999 } as never).eq("id", id);
    expect(res.error).not.toBeNull();
    const ok = await creator.client.from("community_creations").update({ summary: "edited" }).eq("id", id);
    expect(ok.error).toBeNull();
  });

  it("refuses remixes when the source doesn't allow them", async () => {
    const { data } = await publish(creator.client, { p_allow_derivatives: false });
    const source = data![0].creation_id;
    const remix = await publish(fan.client, { p_source_creation: source, p_source_version: 1 });
    expect(remix.error?.message).toMatch(/REMIX_NOT_ALLOWED/);
  });

  it("refuses images the publisher doesn't own", async () => {
    const res = await publish(fan.client, { p_media: ["00000000-0000-4000-8000-000000000001"] });
    expect(res.error?.message).toMatch(/FORBIDDEN/);
  });

  it("hides content after an IP report and blocks publishing for restricted accounts", async () => {
    const { data } = await publish(creator.client);
    const id = data![0].creation_id;
    await fan.client.rpc("file_report", { p_target_type: "creation", p_creation: id, p_user: null as unknown as string, p_category: "ip_infringement", p_details: "" });
    expect((await anonClient().from("community_creations").select("id").eq("id", id)).data).toHaveLength(0);
    const again = await fan.client.rpc("file_report", { p_target_type: "creation", p_creation: id, p_user: null as unknown as string, p_category: "spam", p_details: "" });
    expect(again.error).not.toBeNull();

    const restricted = await userClient("Restricted");
    await adminClient().from("account_restrictions").insert({ user_id: restricted.id, kind: "publishing_disabled", reason: "test restriction" });
    expect((await publish(restricted.client)).error?.message).toMatch(/ACCOUNT_RESTRICTED/);
  });

  it("enforces the active creation limit, including draft to published switches", async () => {
    const limited = await userClient("Limited");
    const admin = adminClient();
    const before = await admin.from("plan_limits").select("limit_value").eq("plan", "free").eq("feature", "published_creations").single();
    await admin.from("plan_limits").update({ limit_value: 1 }).eq("plan", "free").eq("feature", "published_creations");
    try {
      expect((await publish(limited.client)).error).toBeNull();
      expect((await publish(limited.client)).error?.message).toMatch(/PUBLISH_LIMIT_REACHED/);
      const draft = await publish(limited.client, { p_visibility: "draft" });
      expect(draft.error).toBeNull();
      const flip = await limited.client.from("community_creations").update({ visibility: "published" }).eq("id", draft.data![0].creation_id);
      expect(flip.error?.message).toMatch(/PUBLISH_LIMIT_REACHED/);
    } finally {
      await admin.from("plan_limits").update({ limit_value: before.data!.limit_value }).eq("plan", "free").eq("feature", "published_creations");
    }
  });
});
