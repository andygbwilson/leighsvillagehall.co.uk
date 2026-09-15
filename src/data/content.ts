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

export const site: SiteSettings = {
  name: 'Leighs Village Hall',
  tagline: 'Bringing the community together',
  description:
    'Leighs Village Hall in Great Leighs, near Chelmsford, offers two halls, a modern kitchen and accessible facilities for hire by clubs, families and organisations.',
  charityNumber: '301317',
  addressLines: ['Boreham Road', 'Great Leighs', 'Chelmsford'],
  postcode: 'CM3 1NH',
  phone: '01245 364193',
  phoneHref: 'tel:+441245364193',
  email: 'leighsvillagehall@gmail.com',
  bookingSecretary: 'Stuart Wilson',
  bookingUrl: 'https://hallbookingonline.com/leighsvillagehall/',
  bookingGuideUrl: 'https://hallbookingonline.com/leighsvillagehall/guide.php',
  bookingDocsUrl: 'https://www.hallbookingonline.com/leighsvillagehall/documentation.php',
  mapEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d2465.9322268250976!2d0.507404918041295!3d51.82566850776802!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47d8ee46b6876f7f%3A0x20a2530dd6c87385!2sLeighs%20Village%20Hall!5e0!3m2!1sen!2suk!4v1631872682896!5m2!1sen!2suk',
  mapDirectionsUrl: 'https://maps.google.com/maps?daddr=51.825812,0.507111',
  latitude: 51.825812,
  longitude: 0.507111,
  heroImage: '/images/hall-exterior.jpg',
  heroAlt: 'The cream-painted Leighs Village Hall with ramped access and a slate roof',
  intro: [
    'Leighs Village Hall, located in the village of Great Leighs near Chelmsford, was built in 1936 on land donated to the village and with funds raised within the village.',
    'Over the past 80 years the hall has been at the centre of village life, no more so than during the 2nd world war, when it played host to large numbers of American aircrew at the weekly held dances.',
    'By the turn of the millennium the Council of Management set about planning for the extensive renovation and extension that were urgently needed for the hall to meet its increasing use.',
    'Aided by money from the agreement associated with the new housing development within the village, extensive fund raising and generous help from funding bodies and Essex County Council, a £730,000 project was successfully completed in December 2009.',
    'Leighs Village Hall is now able to offer the highest possible standard of accommodation to all its users with the benefit of two halls that can be used separately or combined and serviced by a large modern fully equipped kitchen and excellent toilet facilities including disabled facilities.',
    'The hall is available for hire by organisations or individuals and there is no requirement for the users to be village based. Great care has been taken to ensure easy and safe access, especially for the elderly or disabled.',
    'Everyone is welcome.',
    'Inspection of the schedule of regular users will hopefully provide everyone with an opportunity to join in with the local community as well as providing the venue for parties, clubs, meetings, receptions and celebrations.',
  ],
};

export const rooms: Room[] = [
  {
    name: 'John Wright Hall',
    slug: 'john-wright',
    summary: 'The larger hall, with a curtained stage — suitable for parties, receptions, performances and larger meetings.',
    lengthM: 15.75,
    widthM: 7.5,
    extras: ['Stage 4.5m wide by 3.8m deep', 'Can be combined with the smaller hall', 'Shared access to the kitchen'],
  },
  {
    name: 'Brian Poultney Hall',
    slug: 'brian-poultney',
    summary: 'The smaller hall for clubs, meetings and gatherings, opening onto a paved verandah overlooking the playing field.',
    lengthM: 8.4,
    widthM: 5.5,
    extras: ['Opens onto a paved verandah', 'Overlooks the playing field', 'Shared access to the kitchen'],
  },
];

export const gallery: GalleryImage[] = [
  { src: '/images/gallery/gallery-1.jpg', alt: 'Exterior of Leighs Village Hall from the car park' },
  { src: '/images/gallery/gallery-7.jpg', alt: 'Main entrance porch with Leighs Village Hall sign' },
  { src: '/images/gallery/gallery-6.jpg', alt: 'Accessible lobby with ramps leading to the John Wright Hall' },
  { src: '/images/gallery/gallery-5.jpg', alt: 'Brian Poultney Hall set with tables and chairs, looking out to the playing field' },
  { src: '/images/gallery/gallery-4.jpg', alt: 'Fully equipped modern kitchen with stainless steel worktops' },
  { src: '/images/gallery/gallery-3.jpg', alt: 'Kitchen serving hatch looking through to a hall laid out for a meeting' },
  { src: '/images/gallery/gallery-2.jpg', alt: 'Accessible washroom with two basins and a hand dryer' },
];

export const videos: Video[] = [
  { title: 'Leighs Village Hall', youtubeId: 'r3NYIEWHkr0' },
  { title: 'Leighs Village Hall Entrance', youtubeId: 'bsr8Fo9qkrE' },
];

export const news: NewsPost[] = [
  {
    title: 'Village Hall AGM',
    slug: 'village-hall-agm-2026',
    date: '2026-06-21',
    body: [
      'The AGM for the Village Hall is being held in the Brian Poultney Hall starting at 7.15 on Monday 29th June 2026.',
    ],
  },
  {
    title: 'Village Hall AGM',
    slug: 'village-hall-agm-2025',
    date: '2025-06-03',
    author: 'Stuart Wilson, Chairman, Council of Management',
    body: [
      'The village hall AGM is being held on Monday 16th June 2025 in the Brian Poultney hall commencing at 7.15pm.',
    ],
  },
  {
    title: 'Village Hall Events',
    slug: 'village-hall-events-2023',
    date: '2023-12-12',
    body: [
      'Christmas Tree Lighting & Carol Singing Event – Wednesday 20th December 7.00pm.',
      'The hall committee is very pleased to confirm the tree lighting & carol singing event on Wednesday 20th December 2023 from 7.00pm. Please arrive by 6.50pm so the Colouring Competition winners can switch on the lights promptly at 7pm.',
      'Sandra Sykes will bless the tree and following the switch-on we will sing carols and imbibe some mulled wine and eat a few biscuits in the hall. We look forward to seeing you all there.',
    ],
  },
  {
    title: 'Village Hall AGM – 26/6/23',
    slug: 'village-hall-agm-2023',
    date: '2023-06-11',
    author: 'Stuart Wilson, Chairman, Council of Management',
    body: [
      'This post gives notice of the forthcoming Great & Little Leighs Village Hall Annual General Meeting to be held in the Brian Poultney Hall on Monday 26th June 2023 from 7.30pm.',
    ],
  },
  {
    title: 'Announcement of the death of Her Majesty Queen Elizabeth II',
    slug: 'queen-elizabeth-ii',
    date: '2022-09-08',
    author: 'Stuart Wilson',
    body: [
      'It is with deep sadness that we learned of the peaceful death of our Queen, Queen Elizabeth II, at Balmoral on Thursday 8th of September 2022.',
      'Great & Little Leighs Parish Council will shortly place a book of condolence in the lobby of the village hall where people will be able to pay their respects.',
    ],
  },
  {
    title: 'Leighs Village Hall AGM Mon 27th June 2022, 7.30pm',
    slug: 'village-hall-agm-2022',
    date: '2022-06-14',
    author: 'Stuart Wilson, Chairman, for and on behalf of Leighs Village Hall Council of Management',
    body: [
      'This post gives notice of the forthcoming Great & Little Leighs Village Hall annual general meeting to be held in the Brian Poultney hall on Monday 27th June 2022 commencing 7.30pm.',
    ],
  },
];

export const faqs: FaqItem[] = [
  {
    question: 'How do I book the village hall?',
    answerHtml: `<p>There are currently two options:</p>
<ol>
<li>You may use the <a href="https://hallbookingonline.com/leighsvillagehall/guide.php">online booking form</a> to provisionally book a slot subject to availability. The system will notify the booking secretary, who will then confirm the date and time and ensure you have completed the appropriate Hire Agreement and received a copy of the Conditions of Hire.</li>
<li>Contact Stuart Wilson (booking secretary) on <a href="tel:+441245364193">01245 364193</a>. A hire agreement form will be emailed or posted with a copy of the conditions of hire.</li>
</ol>`,
  },
  {
    question: 'Who do I contact if I want to start a club?',
    answerHtml:
      '<p>Any organisation may hire the hall subject to availability. Please follow the normal booking process.</p>',
  },
  {
    question: 'Can I book sections of the village hall?',
    answerHtml:
      '<p>The John Wright Hall (large) and the Brian Poultney Hall (small) can both be booked individually. Either hall will have access to the kitchen on a shared basis where relevant.</p>',
  },
  {
    question: 'Must I live in the village to book the hall?',
    answerHtml:
      '<p>There is no requirement for hirers to live in the village of Great &amp; Little Leighs.</p>',
  },
  {
    question: 'How many car parking spaces are there?',
    answerHtml:
      '<p>There are two marked parking bays located adjacent to the entrance for drivers and passengers where the vehicle is displaying a Blue Badge. The remainder of the car park is not marked with bays and users are requested to park courteously. Please note that on occasions the West End parking area nearest to Main Road is allocated solely for users of the playing field.</p>',
  },
  {
    question: 'Do we have a licence for the sale of alcohol?',
    answerHtml:
      '<p>No. However you can apply to Chelmsford City Council for a Temporary Event Notice, which is subject to an approval process. There is a charge for this service made by the city council.</p>',
  },
  {
    question: 'Where can I view the hall’s Conditions of Hire?',
    answerHtml:
      '<p>See the <a href="https://www.hallbookingonline.com/leighsvillagehall/documentation.php">documents section of the hall booking website</a>, or download the <a href="/documents/LVH-Conditions-of-Hire.pdf">Conditions of Hire (PDF)</a>.</p>',
  },
  {
    question: 'Where can I find hall dimensions, charges and other key information?',
    answerHtml:
      '<p>Hall dimensions are listed on the <a href="/facilities">facilities page</a>. Charges and other hire documents are in the <a href="https://www.hallbookingonline.com/leighsvillagehall/documentation.php">documents section of the hall booking website</a>.</p>',
  },
];

export const groups: CommunityGroup[] = [
  { name: 'Artpals', times: 'Wed 10am–12pm', contact: 'Angela', telephone: '01245 361458' },
  { name: 'Art Group', times: 'Thu 10am–12pm', contact: 'Roger Stokoe', telephone: '01376 321567' },
  { name: 'Beavers/Cubs', times: 'Mon 5.15pm–7.45pm', contact: 'Ann Quartermain', telephone: 'Ann.Quartermain@greatnotleyscouts.org' },
  { name: 'Bingo', times: 'Thu 7.00pm', contact: 'Una White', telephone: '01245 361493' },
  { name: 'Choir (Vocal Reflections)', times: 'Wed 7.00–9.00pm', contact: 'Linda Hargrave', telephone: '01376 323793' },
  { name: 'Art Class', times: 'Mon 10.30am–12.30pm', contact: 'Angela Gridley', telephone: '01376 321471 / 07500 494088' },
  { name: 'Friendship Club', times: '4th Thu 2.30pm', contact: 'Mavis Greenwood', telephone: '01245 361971' },
  { name: 'Karate (Yong Gi Do)', times: 'Tue 7.30–9.00pm & Sat 9.30–11.30am', contact: 'Kate Malyon', telephone: '07981 362039' },
  { name: 'Leighs Nursery', times: 'School terms', contact: 'Lindsay Grice', telephone: '01376 344744' },
  { name: 'Leighs Educational Trust', times: 'Notice board flyer', contact: 'Sue Bunton', telephone: 'leighseducationalchty@gmail.com' },
  { name: 'Little Stars', times: 'Fri 3.45–7.00pm', contact: 'Vicki', telephone: '07743 650845' },
  { name: 'Parish Council Meetings', times: '3rd Thu of the month 7.45pm', contact: 'James Raven', telephone: '07889 650339' },
  { name: 'Scouts', times: 'Mon (except 1st of month) 6.45–8.45pm', contact: 'Ann Quartermain', telephone: 'Ann.Quartermain@greatnotleyscouts.org' },
  { name: 'W.I.', times: '1st Mon of the month', contact: 'Jean Middleton', telephone: '01376 329986' },
  { name: 'Yoga', times: 'Sat 8am–9am & Tue 6pm–7pm', contact: 'Amy Ellis', telephone: '07445 602622' },
];

export const documents: DocumentLink[] = [
  { title: 'Hire agreement', href: '/documents/LVH-Hire-Agreement.pdf' },
  { title: 'Conditions of hire', href: '/documents/LVH-Conditions-of-Hire.pdf' },
  { title: 'Organisation contacts', href: '/documents/LVH-Organisation-Contacts.pdf' },
];

export const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/facilities', label: 'Facilities' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/news', label: 'News' },
  { href: '/faq', label: 'FAQ' },
  { href: '/find-us', label: 'Find us' },
];

export const footerNav = [
  { href: '/organisation-contacts', label: 'Clubs & contacts' },
  { href: '/cookies-policy', label: 'Cookies' },
];
