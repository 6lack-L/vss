## Project

V.S.S — a volunteer-request social platform. Astro 7 SSR on the Vercel adapter,
Supabase for auth and Postgres. See README.md for setup and architecture.

Four rules specific to this codebase:

1. **RLS is the security boundary.** Policies live in
   `supabase/migrations/0001_init.sql`. Actions re-check the session too, but
   never rely on that alone, and never add a service-role key.
2. **Client scripts init on `astro:page-load`.** View Transitions are on, so a
   bare top-level script runs once and dies on the first client-side nav.
3. **Mutations are Astro Actions posted from real `<form>`s** and must keep
   working with JavaScript disabled.
4. **Colors come from the CSS variables in `src/styles/global.css`.** Do not
   introduce new hex values in components.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
