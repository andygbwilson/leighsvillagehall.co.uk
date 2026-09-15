// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.leighsvillagehall.co.uk',
  integrations: [sitemap()],
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
