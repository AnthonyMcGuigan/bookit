# Premium and billing

Premium is **provider-independent**. The plan a player gets is computed in the
database (`effective_plan()`) from rows in `public.entitlements`, which only
server code using the service role can write. Clients can read their own
entitlements but can never create or change them, and no client-side flag is
ever trusted.

## What exists today

| Piece | Where | State |
| --- | --- | --- |
| Plan limits (slots, image storage, analytics, active creations) | `plan_limits` table, `lib/entitlements/features.ts` | Live |
| Entitlement records (`development`, `purchase`, `grant`) | `entitlements` table | Live |
| Development switcher | Account page, `dev_set_entitlement_state()` | Only when `ENABLE_DEV_ENTITLEMENTS=true` **and** `app_config.dev_entitlements_enabled = true` |
| Provider boundary | `lib/billing/provider.ts` | `nullProvider` only: purchases disabled |
| Webhook endpoint | `POST /api/billing/webhook` | Returns **503** until a provider is configured |
| Event processing | `lib/billing/entitlements.ts` | Idempotent (`billing_events` unique key), entitlements keyed by provider reference |

**No payment provider is integrated and nothing can be charged.** Do not enable
purchases until the provider, plan, pricing, terms and purchase flows have
been explicitly decided.

## What Premium never does

- Gate booking, simulation, championships, core saving or essential community participation.
- Delete or lock saves when it ends. Expiry only affects *new* actions: creating
  universes beyond the free slot count, uploading beyond the free storage, or
  publishing beyond the free active-creation limit. Existing universes,
  images and creations stay fully accessible.

## Adding a provider

1. Implement `BillingProvider` in `lib/billing/<provider>.ts`:
   - `createCheckout()` creates a hosted checkout session with the user id in metadata.
   - `parseWebhook()` **verifies the signature** with the provider SDK and maps events to `BillingEvent` (`entitlement.activated`, `renewed`, `cancelled`, `expired`, `revoked`).
2. Return it from `getBillingProvider()` when `BILLING_PROVIDER=<name>` and its secrets are set; set `purchasesEnabled` only when prices and terms are configured.
3. Add the provider's secrets to the server environment only (never `NEXT_PUBLIC_*`).
4. Add an "Upgrade" action on the account page that calls `createCheckout()` from a server action and redirects.
5. Point the provider's webhook at `https://<site>/api/billing/webhook`.
6. Test with the provider's test mode: duplicate deliveries must return `duplicate`, and cancelling must keep the entitlement until `expires_at`.

## Production checklist

- `ENABLE_DEV_ENTITLEMENTS` unset or `false`, and `update app_config set dev_entitlements_enabled = false`.
- Development entitlements are ignored by `effective_plan()` once the flag is off, even if rows remain.
