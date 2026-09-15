import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import {
  communityGroup,
  faqItem,
  galleryImage,
  newsPost,
  room,
  siteSettings,
  video,
} from './schemaTypes';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'lc8qwfpd';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';

export default defineConfig({
  name: 'leighs-village-hall',
  title: 'Leighs Village Hall',
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Site settings')
              .id('siteSettings')
              .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
            S.documentTypeListItem('newsPost').title('News'),
            S.documentTypeListItem('faqItem').title('FAQs'),
            S.documentTypeListItem('communityGroup').title('Clubs & contacts'),
            S.documentTypeListItem('room').title('Rooms'),
            S.documentTypeListItem('galleryImage').title('Gallery'),
            S.documentTypeListItem('video').title('Videos'),
          ]),
    }),
  ],
  schema: {
    types: [siteSettings, newsPost, faqItem, communityGroup, room, galleryImage, video],
  },
});
