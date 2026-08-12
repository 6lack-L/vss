// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { siteConfig } from './src/config.ts';

// https://astro.build/config
export default defineConfig({
  site: siteConfig.site || undefined,
  output: 'server',
  adapter: vercel(),
});
