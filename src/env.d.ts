/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from './lib/types';

declare global {
  namespace App {
    interface Locals {
      /** Request-scoped Supabase client bound to the visitor's session cookies. */
      supabase: SupabaseClient;
      /** The signed-in user, or null. Set by src/middleware.ts. */
      user: User | null;
      /** The signed-in user's profile row, or null. */
      profile: Profile | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
