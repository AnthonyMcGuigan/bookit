import { afterAll, describe, expect, it } from "vitest";
import { adminClient, createUniverse, userClient } from "./helpers";
import { planOf } from "./helpers";

describe("entitlements", () => {
  const admin = adminClient();
  afterAll(async () => {
    await admin.from("app_config").update({ dev_entitlements_enabled: true }).eq("id", true);
  });

  it("development grants only count while the server flag is on", async () => {
    const user = await userClient("Premium tester");
    await admin.from("app_config").update({ dev_entitlements_enabled: true }).eq("id", true);
    expect((await user.client.rpc("dev_set_entitlement_state", { p_state: "active" })).error).toBeNull();
    expect((await planOf(user.client))).toBe("premium");

    await admin.from("app_config").update({ dev_entitlements_enabled: false }).eq("id", true);
    expect((await planOf(user.client))).toBe("free");
    expect((await user.client.rpc("dev_set_entitlement_state", { p_state: "none" })).error?.message).toMatch(/DEV_ENTITLEMENTS_DISABLED/);
  });

  it("expired Premium keeps every existing save but blocks new slots beyond the free limit", async () => {
    const user = await userClient("Expiring");
    await admin.from("app_config").update({ dev_entitlements_enabled: true }).eq("id", true);
    await user.client.rpc("dev_set_entitlement_state", { p_state: "active" });
    for (let i = 0; i < 4; i++) await createUniverse(user.client, `Slot ${i}`);
    await user.client.rpc("dev_set_entitlement_state", { p_state: "expired" });
    expect((await planOf(user.client))).toBe("free");
    const { data } = await user.client.from("universes").select("id");
    expect(data).toHaveLength(4);
    await expect(createUniverse(user.client, "Too many")).rejects.toMatchObject({ message: expect.stringMatching(/UNIVERSE_LIMIT_REACHED/) });
  });
});
