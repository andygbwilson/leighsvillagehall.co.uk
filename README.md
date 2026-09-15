# Leighs Village Hall

Astro frontend for [leighsvillagehall.co.uk](https://www.leighsvillagehall.co.uk), ready to deploy as a **static site on the Cloudflare Workers free tier**, with **Sanity** as an optional CMS.

The live WordPress site on AWS has been migrated: pages, news, FAQs, club contacts, hire PDFs, photos and floor plan. Hall hire stays on [Hall Booking Online](https://hallbookingonline.com/leighsvillagehall/) — that system is not replaced.

## Local development

Needs Node 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:4321. Content comes from `src/data/content.ts` until a Sanity project is connected.

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

5. Deploy the Studio to Sanity’s free hosting:

```sh
cd studio
npx sanity login
npm run deploy
```

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
