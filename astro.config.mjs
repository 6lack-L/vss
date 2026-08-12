// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { siteConfig } from './src/config.ts';

// https://astro.build/config
export default defineConfig({
  // This file is loaded by Node, not by Vite, so `import.meta.env` inside
  // config.ts is empty here and `siteConfig.site` falls back to localhost.
  // Read the build environment directly, or `Astro.site` — which wins over
  // siteConfig in BaseLayout — pins every canonical and og:url to localhost.
  site: process.env.PUBLIC_SITE_URL || siteConfig.site || undefined,
  output: 'server',
  adapter: vercel(),
});
