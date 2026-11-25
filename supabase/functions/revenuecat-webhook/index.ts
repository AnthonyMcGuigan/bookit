// BookIt Supporter in the iPhone app: RevenueCat calls this whenever Apple confirms, refunds or moves a purchase.
// The app buys the non-consumable "bookit_supporter_life" ($7.99) with the player's game account id as the
// RevenueCat App User ID, so each event says which player it is for. It writes public.supporters, like the
// Stripe webhook (bright-service) does for the web.
//
// Secret (Supabase → Edge Functions → Secrets, set it yourself and never share it):
//   REVENUECAT_WEBHOOK_AUTH  any long random text. Paste the same text into RevenueCat → Integrations →
//                            Webhooks → Authorization header value.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with JWT verification turned off, because RevenueCat sends its own Authorization header instead.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIFE = 'bookit_supporter_life';
// rows bought through Apple are marked so a refund never touches a Stripe supporter
const APPLE = 'apple';

function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length || !x.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
const ids = (e: any): string[] => [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].map(String).filter(x => UUID.test(x));

async function grant(uid: string, txn: string) {
  // a Stripe 'life' row already covers it; anything else (none, monthly, yearly, lapsed) becomes life
  const { data } = await db.from('supporters').select('plan, stripe_customer, status').eq('uid', uid).maybeSingle();
  if (data && data.plan === 'life' && data.status === 'active' && data.stripe_customer !== APPLE) return;
  const { error } = await db.from('supporters').upsert({
    uid, status: 'active', plan: 'life', period_end: '2999-12-31T00:00:00Z',
    stripe_customer: APPLE, stripe_sub: '', updated: new Date().toISOString(),
  }, { onConflict: 'uid' });
  if (error && error.code !== '23503') throw error; // 23503: no such player (deleted), so there is nothing to retry
  console.log('granted', uid, txn);
}
async function revoke(uid: string) {
  const { error } = await db.from('supporters').update({ status: 'refunded', period_end: new Date().toISOString(), updated: new Date().toISOString() })
    .eq('uid', uid).eq('stripe_customer', APPLE);
  if (error) throw error;
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  const want = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '', got = req.headers.get('authorization') ?? '';
  if (!same(got.replace(/^Bearer\s+/i, ''), want.replace(/^Bearer\s+/i, ''))) return new Response('unauthorized', { status: 401 });
  let e: any;
  try { e = (await req.json())?.event; } catch (_) { return new Response('bad body', { status: 400 }); }
  if (!e?.type) return new Response('bad body', { status: 400 });
  try {
    const t = String(e.type), life = String(e.product_id ?? '') === LIFE;
    if (t === 'TEST') return Response.json({ received: true });
    if (life && (t === 'INITIAL_PURCHASE' || t === 'NON_RENEWING_PURCHASE')) {
      const uid = ids(e)[0]; if (uid) await grant(uid, String(e.transaction_id ?? ''));
    } else if (life && t === 'CANCELLATION') {
      // for a one-time purchase, a cancellation means Apple refunded it
      for (const uid of ids(e)) await revoke(uid);
    } else if (t === 'TRANSFER') {
      // Restore purchases on another game account moves the purchase there
      const from = (e.transferred_from ?? []).map(String).filter((x: string) => UUID.test(x));
      const to = (e.transferred_to ?? []).map(String).filter((x: string) => UUID.test(x));
      // (the app sells only Supporter for life, so a transfer always carries it)
      if (to[0]) { for (const uid of from) await revoke(uid); await grant(to[0], 'transfer'); }
    }
  } catch (err) {
    console.error(err);
    return new Response('try again', { status: 500 }); // RevenueCat retries a few times
  }
  return Response.json({ received: true });
});
