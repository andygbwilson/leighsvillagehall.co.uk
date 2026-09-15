import groq from 'groq';
import * as local from '../data/content';
import { sanityClient, sanityEnabled } from './sanity';
import type {
  CommunityGroup,
  DocumentLink,
  FaqItem,
  GalleryImage,
  NewsPost,
  Room,
  SiteSettings,
  Video,
} from './types';

const siteQuery = groq`*[_id == "siteSettings"][0]{
  name, tagline, description, charityNumber, addressLines, postcode,
  phone, phoneHref, email, bookingSecretary, bookingUrl, bookingGuideUrl,
  bookingDocsUrl, mapEmbedUrl, mapDirectionsUrl, latitude, longitude,
  heroAlt, intro, "heroImage": coalesce(heroImage.asset->url, heroImagePath)
}`;

const roomsQuery = groq`*[_type == "room"] | order(order asc) {
  name, slug, summary, lengthM, widthM, extras
}`;

const galleryQuery = groq`*[_type == "galleryImage"] | order(order asc) {
  alt, "src": coalesce(image.asset->url, imagePath)
}`;

const videosQuery = groq`*[_type == "video"] | order(order asc) { title, youtubeId }`;

const newsQuery = groq`*[_type == "newsPost"] | order(date desc) {
  title, "slug": slug.current, date, body, author
}`;

const faqQuery = groq`*[_type == "faqItem"] | order(order asc) { question, answerHtml }`;

const groupsQuery = groq`*[_type == "communityGroup"] | order(order asc) {
  name, times, contact, telephone
}`;

async function fetchOrLocal<T>(query: string, fallback: T): Promise<T> {
  if (!sanityEnabled || !sanityClient) return fallback;
  try {
    const data = await sanityClient.fetch<T>(query);
    if (data == null || (Array.isArray(data) && data.length === 0)) return fallback;
    return data;
  } catch (error) {
    console.warn('Sanity fetch failed, using local content.', error);
    return fallback;
  }
}

export async function getSite(): Promise<SiteSettings> {
  return fetchOrLocal(siteQuery, local.site);
}

export async function getRooms(): Promise<Room[]> {
  return fetchOrLocal(roomsQuery, local.rooms);
}

export async function getGallery(): Promise<GalleryImage[]> {
  return fetchOrLocal(galleryQuery, local.gallery);
}

export async function getVideos(): Promise<Video[]> {
  return fetchOrLocal(videosQuery, local.videos);
}

export async function getNews(): Promise<NewsPost[]> {
  const posts = await fetchOrLocal(newsQuery, local.news);
  return posts.map(normaliseNews);
}

export async function getNewsBySlug(slug: string): Promise<NewsPost | undefined> {
  const posts = await getNews();
  return posts.find((post) => post.slug === slug);
}

export async function getFaqs(): Promise<FaqItem[]> {
  return fetchOrLocal(faqQuery, local.faqs);
}

export async function getGroups(): Promise<CommunityGroup[]> {
  return fetchOrLocal(groupsQuery, local.groups);
}

export function getDocuments(): DocumentLink[] {
  return local.documents;
}

export function getMainNav() {
  return local.mainNav;
}

export function getFooterNav() {
  return local.footerNav;
}

function normaliseNews(post: NewsPost & { body?: unknown }): NewsPost {
  return {
    ...post,
    body: Array.isArray(post.body)
      ? post.body.map((block) => {
          if (typeof block === 'string') return block;
          if (block && typeof block === 'object' && 'children' in block) {
            const children = (block as { children?: { text?: string }[] }).children ?? [];
            return children.map((child) => child.text ?? '').join('');
          }
          return String(block);
        })
      : [],
  };
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
}
