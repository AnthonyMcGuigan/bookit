# BookIt Supporter: setup

BookIt Supporter is an optional subscription: **$2.99 a month or $24.99 a year**. The whole game stays free.

**The rule (Anthony, 2026-11-27): Supporter only pays for things that cost money to run.** Anything that runs on the
player's own device stays free for everyone. Supporter covers server space and bandwidth only:

- 6 cloud save slots (3 free)
- more Community space: up to 10 shared worlds (3 free), 800 KB per upload for bigger photo-heavy worlds (400 KB free),
  and 10 roster photo slots (5 free)
- a gold Supporter badge in Community, as a thank-you (it costs nothing to run)

There is also a **tip jar**: a one-off, pay-what-you-like payment that unlocks nothing (see the end of this file).

How it works: the game opens a Stripe Payment Link with the player's account id. When they pay, Stripe calls the
`stripe-webhook` edge function, which records them in `public.supporters`. The database rules in `setup.sql`
enforce the perks, so nobody can unlock them by editing the game.

## What Anthony sets up (only you can do these)

Do it all in Stripe's **Test mode** first, then repeat in live mode.

1. **Stripe account.** Sign up at stripe.com and finish activation (business details and a bank account for payouts).
2. **Product.** Product catalogue → Add product → "BookIt Supporter", with two recurring prices: $2.99 monthly and $24.99 yearly.
3. **Payment Links.** Create one link for each price. Under *After payment*, choose *Don't show confirmation page* and redirect to
   `https://anthonymcguigan.github.io/bookit/?supporter=done`. Send the two `https://buy.stripe.com/...` links to Claude. They are public, so they're safe to share.
4. **Customer portal.** Settings → Billing → Customer portal → turn it on and allow cancelling. Send Claude the login link (`https://billing.stripe.com/p/login/...`), so supporters can cancel or change their card.
5. **Restricted key.** Developers → API keys → Create restricted key, with **Subscriptions: Read** and nothing else. Keep it private.
6. **Webhook** (after the function is deployed). Developers → Webhooks → Add endpoint:
   `https://svqfswhnesaglciviprw.supabase.co/functions/v1/stripe-webhook`, with the events
   `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy its signing secret (`whsec_...`).
7. **Secrets.** Supabase dashboard → Edge Functions → Secrets: add `STRIPE_SECRET_KEY` (the restricted key) and
   `STRIPE_WEBHOOK_SECRET` (the signing secret). **Never paste these into a chat or the game.**
8. **Test.** In the game, sign in with your email, open Menu → Support the game, pay with Stripe's test card `4242 4242 4242 4242`, and check the Supporter message and cloud slots 4 to 6.
9. **Tax.** Check whether you have to collect sales tax or GST where you and your players live. Stripe Tax can do it for you.
10. **Supabase Pro.** Upgrade (about $25 a month) when the database passes about 300 MB, then raise the space guard limits in `setup.sql`.

## What Claude does (with your OK)

- Apply the new sections of `setup.sql` to the live database.
- Deploy `supabase/functions/stripe-webhook` with JWT verification turned off (Stripe signs its own requests).
- Put the Payment Links and portal link into `SUP_LINKS` and `SUP_PORTAL` in `index.html`. Until then, the game says "Supporter opens soon."

## Supporter for life ($7.99 one time)

Since v1.9.5 the game sells a one-time Supporter for life once its link is filled in. Until then it keeps showing the monthly and yearly plans.

1. **Redeploy the webhook.** In Supabase → Edge Functions → bright-service, replace the code with `functions/stripe-webhook/index.ts` from this repo and deploy (JWT verification stays off). It now also records one-time payments as plan `life`, which never expires.
2. **Make the product in Stripe** (live mode): Product catalogue → Add product → name "BookIt Supporter for life", price $7.99, **One-off**.
3. **Make a Payment Link** for it: Payment Links → New → that product. Under After payment, choose "Don't show confirmation page" and redirect to `https://anthonymcguigan.github.io/bookit/?supporter=done`. Turn off quantity changes.
4. **Check the webhook events**: the endpoint already listens for `checkout.session.completed`, which covers one-time payments too. Nothing to add.
5. **Send the buy.stripe.com link** to Claude. It goes into `SUP_LIVE.life`, and the Supporter page switches to the single $7.99 plan. People already on monthly or yearly keep their plans and can still manage them.
6. Optional: archive the monthly and yearly Payment Links in Stripe so nobody new can find them. Don't cancel the existing subscriptions.

## Tip jar (one-off, pay what you like)

The Support page has a Tip jar on the web. Tips unlock nothing. The tip jar is not shown in the Google Play or iPhone apps, because store rules don't allow outside payment links there.

1. **Make the product in Stripe** (test mode first): Product catalogue → Add product → "Tip for BookIt", pricing **Customer chooses price**, suggested $5, minimum $1, currency USD.
2. **Make a Payment Link** for it. Under After payment, show the confirmation page with a short thank-you (no redirect needed). Turn off quantity changes.
3. **Add metadata to the Payment Link**: key `kind`, value `tip`. The webhook reads it and never turns a tip into Supporter for life.
4. **Redeploy the webhook**: in Supabase → Edge Functions → bright-service, replace the code with `functions/stripe-webhook/index.ts` from this repo and deploy (JWT verification stays off). It now skips tips, and any one-off payment under $7.99.
5. **Send the buy.stripe.com link** to Claude. The test link goes in `TIP_TEST` (shown with `?suptest`) and the live link in `TIP_LIVE` in `index.html`. Until then the Tip jar says "opens soon".

A tip link saved from the owner box on the Support page (Ko-fi and so on) still works and takes priority over the Stripe link.
