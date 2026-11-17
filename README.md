# Leighs Village Hall

Astro frontend for [leighsvillagehall.co.uk](https://www.leighsvillagehall.co.uk), ready to deploy as a **static site on the Cloudflare Workers free tier**, with **Sanity** as the CMS.

The live WordPress site on AWS has been migrated: pages, news, FAQs, club contacts, hire PDFs, photos and floor plan. Hall hire is handled on this site: public requests at `/bookings`, then a hire agreement after the booking secretary reviews the date.

## Local development

Needs Node 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:4321. Pages load published content from Sanity (`lc8qwfpd` / `production`). Hire PDFs and navigation stay in `src/data/content.ts`. `src/data/content.ts` is also the fallback if Sanity is unreachable.

```sh
npm run build
npx wrangler dev
```

That last command serves the production build the same way Cloudflare Workers will.

## Sanity CMS

1. Create a free project at [sanity.io/manage](https://www.sanity.io/manage).
2. Copy `.env.example` to `.env` and `.env` into `studio/.env`:

```
PUBLIC_SANITY_PROJECT_ID=abc123
PUBLIC_SANITY_DATASET=production
SANITY_STUDIO_PROJECT_ID=abc123
SANITY_STUDIO_DATASET=production
SANITY_WRITE_TOKEN=                          # Editor token, seed script only
```

3. Install and start Studio (editors use this, not WordPress):

```sh
cd studio
npm install
npm run dev
```

4. Push the migrated copy into Sanity once:

```sh
npm run seed
```

5. Deploy the Studio to Sanity’s free hosting (needs your Sanity login, not the seed token):

```sh
cd studio
npx sanity login
npm run deploy
```

Studio URL: [https://leighsvillagehall.sanity.studio](https://leighsvillagehall.sanity.studio)

When `PUBLIC_SANITY_PROJECT_ID` is set, `astro build` reads published content from the Sanity CDN. Trigger a Cloudflare rebuild from a Sanity webhook (see below) after editors publish.

## Deploy to Cloudflare Workers (free)

This project is **static**. Cloudflare serves files as Worker assets, so page views do not consume Worker CPU time. That fits the free plan (100,000 requests/day is plenty for a village hall).

```sh
npx wrangler login
npm run deploy
```

In the Cloudflare dashboard you can then:

1. Add a Workers route or custom domain `www.leighsvillagehall.co.uk`.
2. Create a **Deploy Hook** URL.
3. In Sanity → API → Webhooks, POST to that hook on publish so the site rebuilds. If you build from GitHub instead, use Cloudflare’s Git integration and point the webhook at a GitHub Action / deploy hook.

Until DNS is switched, test on the `*.workers.dev` URL Wrangler prints.

## Staging

Staging is a separate Worker (`leighs-village-hall-staging`) with its own `BOOKINGS` KV store. It is built with noindex and `SITE_ORIGIN` set to `https://staging.leighsvillagehall.co.uk`.

```sh
npx wrangler secret put HIRE_ADMIN_PASSWORD --env staging
npm run deploy:staging
```

Then in the Cloudflare dashboard, add the custom domain `staging.leighsvillagehall.co.uk` to the **leighs-village-hall-staging** Worker. Do not point Hall Booking Online or Email Routing at staging; production keeps those.

## Bookings

The public `/bookings` page is the calendar and enquiry form. Requests notify the booking secretary, who reviews them at `/admin/bookings` and sends a hire-agreement invite when the date can be confirmed.

Hirers can review past and upcoming bookings without an account: `/bookings/access` asks for the email used on the booking and emails a 24-hour link to `/bookings/mine`. The same message is returned whether or not that email is on file. Local `npm run dev` logs the access email instead of sending it.

The enquiry form is protected with [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/). Local `npm run dev` uses Cloudflare’s always-pass dummy keys. The widget on the page is only the client half: the Worker must call Cloudflare’s `siteverify` API when someone sends an enquiry or requests booking access. For staging and production, create a widget in the Cloudflare dashboard, set `PUBLIC_TURNSTILE_SITE_KEY` for the **build**, and store the matching secret on the Worker:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY
```

A dashboard warning that siteverify is not being called usually means the secret is missing on that Worker, or no form has been submitted yet. Loading `/bookings` is not enough; send a test enquiry after the secret is set. Do not use Cloudflare’s “Fix with Spin” option — this site verifies tokens in the Worker.

Recurring requests (weekly or monthly) stay as a single date until the secretary confirms they are possible. Club series for next year can be placed on the admin calendar before the public period is opened in **Booking period**.

Admin logins are per person. The first sign-in with `HIRE_ADMIN_PASSWORD` and `leighsvillagehall@gmail.com` (`HIRE_ADMIN_EMAIL`) creates the booking secretary account. `HIRE_ADMIN_EXTRA` (currently `andygbwilson@gmail.com`) can sign in with the same password to create a full-access admin account. Further accounts (including accounting) are added under **Accounts**. Email copy is edited under **Email templates**.

## Hire agreement emails

Public booking requests now start on `/bookings`. Hall Booking Online email ingest remains as a fallback: when HBO emails `bookings@leighsvillagehall.co.uk`, Cloudflare Email Routing sends that message to this Worker. The Worker stores a draft hire agreement against the booking ID and emails `leighsvillagehall@gmail.com` a link to `/admin/agreement?booking=15441`. Admins review it there, add the deposit due, and send the hire-agreement invite. The original HBO message is also forwarded to that Gmail address.

This needs **Workers Paid** (to send mail to hirers) and Email Service set up on the domain:

1. Cloudflare dashboard → **Compute** → **Email Service** → **Email Routing** → onboard `leighsvillagehall.co.uk` (MX and SPF/DKIM records).
2. Add and verify destination address `leighsvillagehall@gmail.com`.
3. Onboard the domain for **Email Sending**, and send from `bookings@leighsvillagehall.co.uk`.
4. Routing rule: `bookings@leighsvillagehall.co.uk` → **Send to a Worker** → `leighs-village-hall`.
5. In Hall Booking Online, set the admin notification address to `bookings@leighsvillagehall.co.uk`.

Do not also route `bookings@` to a mailbox on the same address, or invite mail could loop. Keep Gmail as the forward destination only.

While testing, `HIRE_INVITE_ALLOWLIST` in `wrangler.jsonc` limits hire-agreement emails to those addresses (comma-separated). Bookings for other hirers are still stored. Clear the list to allow invites to every hirer.

Admins can review agreements at `/admin/hire-agreements`. Records are read-only until they choose to edit. Set the password with `npx wrangler secret put HIRE_ADMIN_PASSWORD`. Locally it defaults to `lvh-admin-dev`. Local invite sends are logged, not delivered.

Locally you can replay a booking email (no outbound send) with:

```sh
curl -X POST http://localhost:4321/api/booking-email --data-binary @scripts/fixtures/hbo-booking.txt
```

## Cut over from AWS WordPress

1. Confirm the Workers URL looks right (bookings still go to Hall Booking Online).
2. At your DNS host, point `www` and the apex `@` to Cloudflare (proxied orange cloud).
3. Keep WordPress/AWS for a week as a fallback, then remove the Lightsail/EC2/S3 site once you are happy.
4. Hire PDFs now live in `public/documents/`, so the old S3 bucket is no longer required for the public site.

Old WordPress news URLs redirect to `/news/...`. `/latest-news` redirects to `/news`. `/contact` redirects to `/organisation-contacts`.

## What editors can change in Sanity

- Site name, phone, email, address, booking links
- News posts
- FAQs
- Club contact list
- Room details
- Gallery captions (photos can stay as files in `public/images` or be uploaded to Sanity)

## Project layout

```
src/pages/          Public pages
src/data/content.ts Migrated WordPress copy (used when Sanity is unset)
src/lib/cms.ts      Sanity-or-local content layer
studio/             Sanity Studio schemas
public/images       Hall photos and floor plan
public/documents    Hire agreement and related PDFs
wrangler.jsonc      Cloudflare Workers static assets config
```
