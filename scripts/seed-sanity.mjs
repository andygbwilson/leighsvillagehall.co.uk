import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@sanity/client';
import {
  faqs,
  gallery,
  groups,
  news,
  rooms,
  site,
  videos,
} from '../src/data/content.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  loadEnvFile(path.join(root, '.env'));
} catch {
  // Vars may already be in the environment.
}

const projectId = (process.env.PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID || '').trim();
const dataset = (process.env.PUBLIC_SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || 'production').trim();
const token = (process.env.SANITY_WRITE_TOKEN || '').trim().replace(/^['"]|['"]$/g, '');

if (!projectId || !token) {
  console.error(
    'Missing PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID) and/or SANITY_WRITE_TOKEN. Add them to .env (see .env.example) or export them in your shell.',
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2026-09-14',
  token,
  useCdn: false,
});

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const { heroImage, ...siteFields } = site;

const docs = [
  {
    _id: 'siteSettings',
    _type: 'siteSettings',
    ...siteFields,
    heroImagePath: heroImage,
  },
  ...rooms.map((room, order) => ({
    _id: `room-${room.slug}`,
    _type: 'room',
    ...room,
    slug: { _type: 'slug', current: room.slug },
    order,
  })),
  ...gallery.map((image, order) => ({
    _id: `gallery-${order + 1}`,
    _type: 'galleryImage',
    alt: image.alt,
    imagePath: image.src,
    order,
  })),
  ...videos.map((video, order) => ({
    _id: `video-${video.youtubeId}`,
    _type: 'video',
    ...video,
    order,
  })),
  ...news.map((post) => ({
    _id: `news-${post.slug}`,
    _type: 'newsPost',
    title: post.title,
    slug: { _type: 'slug', current: post.slug },
    date: post.date,
    author: post.author,
    body: post.body.map((paragraph) => ({
      _type: 'block',
      children: [{ _type: 'span', text: paragraph }],
    })),
  })),
  ...faqs.map((item, order) => ({
    _id: `faq-${order + 1}`,
    _type: 'faqItem',
    ...item,
    order,
  })),
  ...groups.map((group, order) => ({
    _id: `group-${slugify(group.name)}-${order}`,
    _type: 'communityGroup',
    ...group,
    order,
  })),
];

const transaction = docs.reduce((tx, doc) => tx.createOrReplace(doc), client.transaction());

try {
  await transaction.commit();
} catch (error) {
  const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
  const body = error && typeof error === 'object' && 'responseBody' in error ? error.responseBody : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Seed failed (${status ?? 'unknown status'}) for ${projectId}/${dataset}: ${message}`);
  if (typeof body === 'string') console.error(body);
  if (status === 401) {
    console.error(
      'The token was rejected for this project ID. Confirm PUBLIC_SANITY_PROJECT_ID is the Project ID (not the Organization ID) and SANITY_WRITE_TOKEN is an Editor token from that project.',
    );
  }
  process.exit(1);
}

console.log(`Seeded ${docs.length} documents to ${projectId}/${dataset}.`);
