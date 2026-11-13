// BookIt Supporter: Stripe calls this after a checkout and whenever a subscription changes.
// It records who is a supporter in public.supporters. Nothing else in the game can write that table.
//
// Secrets (Supabase → Edge Functions → Secrets, set them yourself and never share them):
//   STRIPE_SECRET_KEY      a restricted key with "Subscriptions: Read" only
//   STRIPE_WEBHOOK_SECRET  the signing secret (whsec_...) of the webhook endpoint for this function
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with JWT verification turned off, because Stripe signs its own requests instead.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });
const crypto = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// newer Stripe API versions keep the period end on the subscription item
const periodEnd = (s: Stripe.Subscription) => Number((s as any).current_period_end ?? (s.items?.data?.[0] as any)?.current_period_end ?? 0);

function row(s: Stripe.Subscription) {
  return {
    status: String(s.status),
    plan: String(s.items?.data?.[0]?.price?.recurring?.interval ?? ''),
    period_end: new Date(periodEnd(s) * 1000).toISOString(),
    stripe_customer: String(typeof s.customer === 'string' ? s.customer : s.customer?.id ?? ''),
    stripe_sub: s.id,
    updated: new Date().toISOString(),
  };
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  const body = await req.text();
  let ev: Stripe.Event;
  try {
    ev = await stripe.webhooks.constructEventAsync(body, req.headers.get('stripe-signature') ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, crypto);
  } catch (_) {
    return new Response('bad signature', { status: 400 });
  }
  try {
    if (ev.type === 'checkout.session.completed') {
      // the game opens the Payment Link with client_reference_id = the player's account id
      const s = ev.data.object as Stripe.Checkout.Session, uid = String(s.client_reference_id ?? '');
      if (s.mode === 'subscription' && s.subscription && UUID.test(uid)) {
        const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        const { error } = await db.from('supporters').upsert({ uid, ...row(sub) }, { onConflict: 'uid' });
        if (error && error.code !== '23503') throw error; // 23503: no such player, so there is nothing to retry
      }
    } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
      const sub = ev.data.object as Stripe.Subscription;
      const { error } = await db.from('supporters').update(row(sub)).eq('stripe_sub', sub.id);
      if (error) throw error;
    }
  } catch (e) {
    console.error(e);
    return new Response('try again', { status: 500 }); // Stripe retries for a few days
  }
  return Response.json({ received: true });
});
