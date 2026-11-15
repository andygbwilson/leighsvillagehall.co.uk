// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import {
  handleAdminDevApi,
  handleDevBookingApi,
  ingestHboBookingEmail,
  loadHireAgreement,
  saveHireAgreement,
} from './scripts/hire-agreement-dev.ts';

function hireAgreementDevApi() {
  return {
    name: 'hire-agreement-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (await handleDevBookingApi(req, res, url)) return;
        if (await handleAdminDevApi(req, res, url)) return;

        if (url.pathname === '/api/booking-email' && req.method === 'POST') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8') || '{}';
          const body = raw.trim().startsWith('{') ? JSON.parse(raw) : { text: raw };
          const record = await ingestHboBookingEmail(String(body.text ?? body.body ?? raw));
          res.end(JSON.stringify({ ok: true, record }));
          return;
        }

        if (url.pathname !== '/api/hire-agreement') {
          next();
          return;
        }

        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');

        try {
          if (req.method === 'GET') {
            const booking = url.searchParams.get('booking') ?? '';
            const record = booking ? await loadHireAgreement(booking) : null;
            res.end(JSON.stringify({ found: Boolean(record), record }));
            return;
          }

          if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            const record = await saveHireAgreement(body);
            res.end(JSON.stringify({ ok: true, record }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed.' }));
        } catch (error) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'The hire agreement could not be saved.',
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_ORIGIN || 'https://www.leighsvillagehall.co.uk',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/admin'),
    }),
  ],
  vite: {
    plugins: [hireAgreementDevApi()],
  },
  redirects: {
    '/latest-news': '/news',
    '/contact': '/organisation-contacts',
    '/contacts': '/organisation-contacts',
    '/cookies': '/cookies-policy',
    '/2026/06/village-hall-agm-2/1050': '/news/village-hall-agm-2026',
    '/2025/06/village-hall-agm/1029': '/news/village-hall-agm-2025',
    '/2023/12/village-hall-events/1012': '/news/village-hall-events-2023',
    '/2023/06/village-hall-agm-26-6-23/1007': '/news/village-hall-agm-2023',
    '/2022/09/announcement-of-the-death-of-her-majesty-queen-elizabeth-ii-on-thursday-8th-september-2022/1001':
      '/news/queen-elizabeth-ii',
    '/2022/06/leighs-village-hall-agm-mon-27th-june-2022-7-30pm':
      '/news/village-hall-agm-2022',
  },
});
