import { NextResponse, type NextRequest } from "next/server";
import { BillingNotConfiguredError, getBillingProvider } from "@/lib/billing/provider";
import { applyBillingEvent } from "@/lib/billing/entitlements";

/**
 * Payment-provider webhook. Returns 503 until a provider is configured, so no
 * request can grant an entitlement. With a provider, only events whose
 * signature verifies are applied.
 */
export async function POST(request: NextRequest) {
  const provider = getBillingProvider();
  if (!provider.purchasesEnabled) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }
  const body = await request.text();
  if (body.length > 1_000_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  let event;
  try {
    event = await provider.parseWebhook(body, request.headers);
  } catch (e) {
    if (e instanceof BillingNotConfiguredError) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    const result = await applyBillingEvent(event);
    return NextResponse.json({ result });
  } catch {
    // Non-2xx makes the provider retry; the event store keeps processing idempotent.
    return NextResponse.json({ error: "Could not process event." }, { status: 500 });
  }
}
