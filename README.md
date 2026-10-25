# Opervia CMS — Cloudflare Worker edition

Opervia is now ready for a Cloudflare Worker deployment. The Worker serves the public website, the protected `/admin/` CMS, and the API from one domain.

## Cloudflare resources required

1. A **D1 database** bound to the Worker as `DB`. It stores all editable website content.
2. An **R2 bucket** bound to the Worker as `MEDIA`. It stores CMS image uploads.
3. Two Worker secrets: `CMS_USER` and `CMS_PASSWORD`. They protect `/admin/` and all CMS write APIs.

The Worker creates the D1 table automatically the first time the CMS is used. Its starter content is bundled into `src/default-content.js`; the first CMS save writes that content to D1 and makes it persistent.

## Deploy

1. Add the project to your Worker repository, including `src/`, `public/`, `wrangler.jsonc`, and `package.json`.
2. In Cloudflare Dashboard, open **Workers & Pages → your Worker → Settings → Bindings**:
   - Add a D1 binding named `DB`.
   - Add an R2 binding named `MEDIA`.
3. In **Settings → Variables and Secrets**, add encrypted secrets `CMS_USER` and `CMS_PASSWORD`.
4. Push the project to the Git branch connected to your Worker. Cloudflare builds and deploys it automatically.

See `CLOUDFLARE_WORKER_SETUP.md` for the exact Dashboard steps and Worker Builds settings.

For local Worker development, install dependencies and run:

```bash
npm install
npm run dev
```

## What the CMS manages

- English and Georgian home-page copy
- SEO title and description for both languages
- Brand details and the contact-email destination
- Services: add, edit, reorder, publish/unpublish, add a cover image
- Insights / blog: add, edit, publish/unpublish, select category, publish date, author, cover image and full article body
- FAQs
- Image uploads (PNG, JPG, WebP, GIF, up to 3 MB)
- Full JSON export for backup and bulk edits
