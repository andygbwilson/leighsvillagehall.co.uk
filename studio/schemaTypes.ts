import { defineArrayMember, defineField, defineType } from 'sanity';

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'tagline', type: 'string' }),
    defineField({ name: 'description', type: 'text' as const, rows: 3 }),
    defineField({ name: 'charityNumber', type: 'string' }),
    defineField({
      name: 'addressLines',
      type: 'array' as const,
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({ name: 'postcode', type: 'string' }),
    defineField({ name: 'phone', type: 'string' }),
    defineField({ name: 'phoneHref', type: 'string' }),
    defineField({ name: 'email', type: 'string' }),
    defineField({ name: 'bookingSecretary', type: 'string' }),
    defineField({ name: 'bookingUrl', type: 'url' }),
    defineField({ name: 'bookingGuideUrl', type: 'url' }),
    defineField({ name: 'bookingDocsUrl', type: 'url' }),
    defineField({ name: 'mapEmbedUrl', type: 'url' }),
    defineField({ name: 'mapDirectionsUrl', type: 'url' }),
    defineField({ name: 'latitude', type: 'number' }),
    defineField({ name: 'longitude', type: 'number' }),
    defineField({ name: 'heroImage', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'heroImagePath', type: 'string', title: 'Hero image path (fallback)' }),
    defineField({ name: 'heroAlt', type: 'string' }),
    defineField({
      name: 'intro',
      type: 'array' as const,
      of: [defineArrayMember({ type: 'text' })],
    }),
  ],
});

export const room = defineType({
  name: 'room',
  title: 'Room',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string' }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' } }),
    defineField({ name: 'summary', type: 'text' }),
    defineField({ name: 'lengthM', type: 'number' }),
    defineField({ name: 'widthM', type: 'number' }),
    defineField({
      name: 'extras',
      type: 'array' as const,
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({ name: 'order', type: 'number' }),
  ],
});

export const galleryImage = defineType({
  name: 'galleryImage',
  title: 'Gallery image',
  type: 'document',
  fields: [
    defineField({ name: 'alt', type: 'string' }),
    defineField({ name: 'image', type: 'image' }),
    defineField({ name: 'imagePath', type: 'string', title: 'Local image path (fallback)' }),
    defineField({ name: 'order', type: 'number' }),
  ],
});

export const video = defineType({
  name: 'video',
  title: 'Video',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'youtubeId', type: 'string' }),
    defineField({ name: 'order', type: 'number' }),
  ],
});

export const newsPost = defineType({
  name: 'newsPost',
  title: 'News post',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string' }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'date', type: 'date' }),
    defineField({ name: 'author', type: 'string' }),
    defineField({
      name: 'body',
      type: 'array' as const,
      of: [defineArrayMember({ type: 'block' })],
    }),
  ],
  orderings: [{ title: 'Date, newest', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] }],
});

export const faqItem = defineType({
  name: 'faqItem',
  title: 'FAQ',
  type: 'document',
  fields: [
    defineField({ name: 'question', type: 'string' }),
    defineField({ name: 'answerHtml', type: 'text' as const, rows: 8, title: 'Answer (HTML allowed for links)' }),
    defineField({ name: 'order', type: 'number' }),
  ],
});

export const communityGroup = defineType({
  name: 'communityGroup',
  title: 'Community group',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string' }),
    defineField({ name: 'times', type: 'string' }),
    defineField({ name: 'contact', type: 'string' }),
    defineField({ name: 'telephone', type: 'string', title: 'Telephone or email' }),
    defineField({ name: 'order', type: 'number' }),
  ],
});
