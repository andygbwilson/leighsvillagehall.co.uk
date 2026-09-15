import { defineCliConfig } from '@sanity/cli';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'lc8qwfpd';
const dataset = process.env.SANITY_STUDIO_DATASET || 'production';

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  studioHost: 'leighsvillagehall',
  deployment: {
    appId: 'b6anuyw68t4rwgwtb5nswsrl',
    autoUpdates: false,
  },
});
