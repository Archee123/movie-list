# Frame

A shared movie list for Archie and Susu, built with Next.js App Router, React, TypeScript and Vercel private Blob storage.

## Using Frame

Choose Archie or Susu and enter the shared passcode. Both profiles see the same list. Search for a movie, choose the correct title/year, and add it. The tick moves it to Watched; ticking it again moves it back. Profile names record who added or marked a film watched. Switch / lock signs out, allowing either profile to unlock again. Sessions last 30 days.

Movie search and posters come from TMDB. IMDb ratings come from OMDb, matched by the IMDb ID returned by TMDB. No TMDB score is presented as an IMDb rating. Missing ratings display a dash. Ratings are fetched when saving and cached for up to seven days. Manual title entries have no poster or rating. Search results identify films by poster and year; ratings appear on saved films.

Both profiles share storage across devices. Lists refresh on window focus and every 30 seconds while visible. Each movie has its own private record; writes to different movies do not overwrite each other. Simultaneous changes to the same movie use the last successful write. Remove soft-deletes a record.

## Local development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, fill in server-only settings, then run `npm run dev`. Never commit `.env.local` or `.vercel` files.

| Setting                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `SITE_PASSCODE`         | Shared site passcode, configured in Vercel                 |
| `SESSION_SECRET`        | Random secret of at least 32 characters for signed cookies |
| `BLOB_READ_WRITE_TOKEN` | Connected private Vercel Blob store                        |
| `TMDB_READ_TOKEN`       | TMDB API read access token (preferred)                     |
| `TMDB_API_KEY`          | Optional v3 key when no read token is set                  |
| `OMDB_API_KEY`          | OMDb key for IMDb ratings                                  |

The production project is `movie-list` in the `archie-af77` Vercel team, connected to `Archee123/movie-list`, production branch `main`. Pushes to main deploy automatically. Environment variable changes require a new deployment. Runtime credentials and the passcode live in Vercel, never in browser bundles or this repository.

## Checks

- `npm run check` — TypeScript
- `npm test` — session integrity and expiry tests
- `npm run build` — production build
- `npm audit --omit=dev` — dependency advisories
- With a running app: set `TEST_BASE_URL=http://127.0.0.1:3000` and run `node --env-file=.env.local --experimental-strip-types --test tests/*.test.mjs` for real auth, TMDB search, shared-storage and watched-status checks. Integration tests create and soft-delete only their own uniquely named test record.

## Access model

This is a shared passcode gate with two attribution profiles, not independent passwords for each person. APIs authenticate signed, expiring, HttpOnly cookies and reject mutations from other origins. Production cookies require HTTPS. Invalid login attempts have an in-memory per-instance throttle (10 attempts / 15 minutes); this is not a global distributed brute-force limit. The four-digit passcode is suitable for this casual private list, not sensitive personal records. Blob storage is private and accessed only by server code. API responses are not publicly cached.

## Credits

Manrope is bundled locally through Fontsource. Artwork is original CSS. Posters/details use TMDB; the approved TMDB logo and attribution appear under Movie data & credits. This product uses the TMDB API but is not endorsed or certified by TMDB. IMDb ratings are supplied by OMDb. No demo movies are preloaded into the shared list.
