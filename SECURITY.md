# SECURITY.md

## Secrets extracted from the legacy codebase

The legacy vanilla site (preserved in git history) committed credentials
directly in source. Disposition during this migration:

| Legacy secret                          | Where it lived                         | Action taken                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainSmtpToken` = `b52b8a29-…`         | `src/index.js:6`                       | **Dead config** - referenced nowhere in any legacy file. Not carried into the new codebase at all. ⚠️ Treat as compromised regardless (it was pushed to a public-ish repo): revoke/rotate on the SMTP provider. |
| `companySmtpToken` = `88263185-…`      | `src/index.js:7`                       | Same as above - dead, removed, rotate recommended.                                                                                                                                                              |
| EmailJS service id `service_k2c0eve`   | `src/contact.js:406`                   | Moved to `VITE_EMAILJS_SERVICE_ID` (.env).                                                                                                                                                                      |
| EmailJS template id `template_kmxsnuc` | `src/contact.js:407`                   | Moved to `VITE_EMAILJS_TEMPLATE_ID` (.env).                                                                                                                                                                     |
| EmailJS public key `2y064p5z9qRvVxOHN` | inline `<script>` in every legacy page | Moved to `VITE_EMAILJS_PUBLIC_KEY` (.env). Public keys are public-by-design, but they are configuration, not code.                                                                                              |
| Font Awesome kit URL (`4f48855ba9`)    | every legacy page                      | Eliminated entirely - replaced with `react-icons`; no per-account dependency remains.                                                                                                                           |

## What stays in source (intentionally NOT secrets)

Phone number, email addresses, street address, Facebook page URL, Google Maps
embed id and Waze deep link are **public-facing business details** displayed on
the site. They live in `client/src/config/siteConfig.ts` as typed constants.

## Environment variable rules

- Everything is prefixed `VITE_`. **Vite bakes these into the client bundle -
  assume anything in them is public.** Never place server-only credentials here.
- `.env` is git-ignored; `.env.example` documents the required shape.
- `client/src/config/env.ts` validates the variables through a Zod schema at
  startup:
  - production builds **fail fast** when required values are missing;
  - dev/test builds warn and fall back to disabled-email placeholders so the
    app still boots without a `.env`.

## CI

The pipeline runs fully mocked: e2e tests intercept the BOI/CBS/EmailJS
endpoints, so CI requires **zero** real secrets (dummy values are exported in
the workflow). If real deployment credentials are introduced later (e.g. a
deploy job), store them as GitHub **environment secrets** scoped to dedicated
`dev` / `qa` / `production` environments - never as repository-wide secrets,
and never printed in logs.
