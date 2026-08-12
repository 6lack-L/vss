// Site Configuration
// Centralize all settings here, do not hardcode in components.

export const siteConfig = {
  // Site title — displayed in nav, footer, and page titles
  title: 'V.S.S',

  // Site description — used in meta tags and the hero section
  description: 'Post volunteer requests, find help nearby, lend a hand.',

  // Site URL — MUST be the real deployment origin.
  // Share links and Open Graph tags build absolute URLs from this; if it is
  // wrong, shared listings will unfurl with broken links.
  site: import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321',

  // HTML lang attribute — affects SEO and accessibility
  lang: 'en',

  // Navigation links — displayed in the capsule nav bar and the mobile menu.
  // `icon` selects the inline SVG in Navigation.astro.
  nav: [
    { title: 'Feed', href: '/', icon: 'home' },
    { title: 'Listings', href: '/listings', icon: 'list' },
    { title: 'About', href: '/about', icon: 'info' },
  ],

  // Social links — leave empty to hide
  social: {
    github: '',
  },

  // Feature toggles
  features: {
    // Google sign-in. Turning this on is not enough on its own: you must also
    // add a Google client ID/secret in Supabase → Authentication → Providers,
    // and register /auth/callback as a Redirect URL for every origin.
    googleAuth: false,
    backToTop: true,      // Show back-to-top button
    reactions: true,      // "Interested" reactions on listings
    share: true,          // Share menu on listing pages
    locationFilter: true, // Town filter on /listings
  },

  // Reaction kinds available on a listing
  reactions: [
    { kind: 'interested', label: 'Interested' },
  ],

  // How long a new listing stays open, in days (used as the composer default)
  defaultListingDays: 14,
};

export type SiteConfig = typeof siteConfig;
