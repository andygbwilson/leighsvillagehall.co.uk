export type NavLink = {
  href: string;
  label: string;
};

export type SiteSettings = {
  name: string;
  tagline: string;
  description: string;
  charityNumber: string;
  addressLines: string[];
  postcode: string;
  phone: string;
  phoneHref: string;
  email: string;
  bookingSecretary: string;
  bookingUrl: string;
  bookingGuideUrl: string;
  bookingDocsUrl: string;
  mapEmbedUrl: string;
  mapDirectionsUrl: string;
  latitude: number;
  longitude: number;
  heroImage: string;
  heroAlt: string;
  intro: string[];
};

export type Room = {
  name: string;
  slug: string;
  summary: string;
  lengthM: number;
  widthM: number;
  extras: string[];
};

export type GalleryImage = {
  src: string;
  alt: string;
};

export type Video = {
  title: string;
  youtubeId: string;
};

export type NewsPost = {
  title: string;
  slug: string;
  date: string;
  body: string[];
  author?: string;
};

export type FaqItem = {
  question: string;
  answerHtml: string;
};

export type CommunityGroup = {
  name: string;
  times: string;
  contact: string;
  telephone: string;
};

export type DocumentLink = {
  title: string;
  href: string;
};
