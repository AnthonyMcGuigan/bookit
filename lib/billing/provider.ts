/**
 * Payment-provider boundary. The game never talks to a payment provider
 * directly: a provider adapter turns verified webhook events into
 * BillingEvents, and lib/billing/entitlements.ts turns those into
 * entitlement records. No provider is configured by default, so nothing can
 * be purchased or charged until an operator wires one up (see docs/billing.md).
 */
export interface BillingEvent {
  provider: string;
  eventId: string;
  type: "entitlement.activated" | "entitlement.renewed" | "entitlement.cancelled" | "entitlement.expired" | "entitlement.revoked" | "ignored";
  userId: string | null;
  /** Provider's subscription or purchase id; entitlements are keyed by it. */
  reference: string | null;
  customerId: string | null;
  expiresAt: string | null;
  autoRenews: boolean;
  raw: unknown;
}

export interface CheckoutRequest {
  userId: string;
  email: string;
  plan: "premium";
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  readonly name: string;
  /** True only when credentials, prices and terms have been configured. */
  readonly purchasesEnabled: boolean;
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
  /** Verifies the webhook signature and parses it. Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<BillingEvent>;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Purchases aren't available: no payment provider is configured.");
  }
}

/** The default provider: purchases disabled, webhooks rejected. */
export const nullProvider: BillingProvider = {
  name: "none",
  purchasesEnabled: false,
  async createCheckout() {
    throw new BillingNotConfiguredError();
  },
  async parseWebhook() {
    throw new BillingNotConfiguredError();
  },
};

/**
 * Returns the configured provider. Add real adapters here once a provider,
 * plan, pricing, terms and purchase flow have been explicitly approved.
 */
export function getBillingProvider(): BillingProvider {
  const name = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  switch (name) {
    case undefined:
    case "":
    case "none":
      return nullProvider;
    default:
      // An unknown provider name never enables purchases.
      return nullProvider;
  }
}
