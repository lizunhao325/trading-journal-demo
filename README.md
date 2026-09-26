# Trading Analytics Dashboard — Portfolio Edition

A clean English portfolio/demo build of a client-side trading analytics dashboard.

## Privacy / separation
- No Vercel Analytics or third-party analytics package.
- No API routes or external trading-data connection.
- Trade entries are stored only in the browser under a dedicated storage namespace.
- This portfolio build does not read the storage keys used by the original dashboard.
- Deploy it as a new Netlify project rather than linking it to the existing site.

## Run locally

```bash
npm install
npm run dev
```
