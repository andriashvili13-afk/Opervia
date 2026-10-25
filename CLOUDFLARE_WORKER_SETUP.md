# Deploy Opervia CMS to an existing Cloudflare Worker

## Before the first push

1. Open `wrangler.jsonc` and change the `name` value from `opervia-cms` to the exact name of your existing Cloudflare Worker.
2. Ensure the files in this folder become the Worker project's root directory in Git. If your repository contains other projects, configure this folder as the Worker **Root directory** in Cloudflare's **Settings → Builds**.

## Create storage once in Cloudflare

### 1. D1 database

1. In Cloudflare Dashboard, select your account.
2. Go to **Workers & Pages → D1 SQL Database → Create**.
3. Create a database, for example `opervia-cms-data`.
4. Open your Worker, then **Settings → Bindings → Add binding → D1 database**.
5. Select the database and set the variable name to exactly `DB`.

### 2. R2 image bucket

1. In Cloudflare Dashboard, go to **R2 Object Storage → Create bucket**.
2. Create a bucket, for example `opervia-media`.
3. Open your Worker, then **Settings → Bindings → Add binding → R2 bucket**.
4. Select the bucket and set the variable name to exactly `MEDIA`.

### 3. CMS login secrets

1. Open your Worker → **Settings → Variables and Secrets**.
2. Add encrypted secret `CMS_USER` — for example `opervia-admin`.
3. Add encrypted secret `CMS_PASSWORD` — use a long, unique password.
4. Save the changes.

## Configure the Git-connected Worker

Open your Worker → **Settings → Builds** and set:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Leave blank if this folder is your repository root; otherwise set its relative path. |
| Build command | Leave blank. |
| Deploy command | `npm run deploy` |

Cloudflare will install the Wrangler dependency from `package.json`, deploy `src/worker.js`, and upload the static files in `public/`.

## Deploy

Commit and push the Cloudflare CMS version:

```bash
git add .
git commit -m "Add Opervia Cloudflare CMS"
git push
```

After the Worker build is green:

- Public website: your existing domain
- CMS dashboard: `https://your-domain.com/admin/`

On the first visit, the site uses the bundled Opervia starter content. Open `/admin/` and click **Save changes** once to create the persistent content record in D1. From that point, all CMS edits are stored in D1 and all uploaded images are stored in R2.

## Ongoing work

- Change a blog post, service, FAQ or translated copy in `/admin/`: no Git push is needed.
- Change site code or design: commit and push to `main`; Cloudflare deploys it automatically.
- In the CMS **Import / Export** section, download a JSON backup after major content changes.
