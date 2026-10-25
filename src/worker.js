import { DEFAULT_CONTENT } from './default-content.js';

let schemaReady;

const json = (value, init = {}) => new Response(JSON.stringify(value), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
});
const apiError = (message, status = 400) => json({ error: message }, { status });

async function ensureDatabase(db) {
  if (!db) return;
  if (!schemaReady) {
    schemaReady = db.exec(`CREATE TABLE IF NOT EXISTS cms_content (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
  }
  return schemaReady;
}
async function contentFromDatabase(env) {
  if (!env.DB) return structuredClone(DEFAULT_CONTENT);
  await ensureDatabase(env.DB);
  const row = await env.DB.prepare('SELECT data FROM cms_content WHERE id = ?').bind('site').first();
  return row ? JSON.parse(row.data) : structuredClone(DEFAULT_CONTENT);
}
function basicAuthorised(request, env) {
  if (!env.CMS_USER || !env.CMS_PASSWORD) return false;
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = atob(auth.slice(6));
    const separator = decoded.indexOf(':');
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return user === env.CMS_USER && password === env.CMS_PASSWORD;
  } catch { return false; }
}
function unauthorized() {
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8', 'www-authenticate': 'Basic realm="Opervia CMS"', 'cache-control': 'no-store' }
  });
}
async function requireAdmin(request, env) {
  if (!env.CMS_USER || !env.CMS_PASSWORD) return apiError('Set CMS_USER and CMS_PASSWORD Worker secrets before using the CMS.', 503);
  return basicAuthorised(request, env) ? null : unauthorized();
}
function mediaKey(pathname) { return pathname.replace(/^\/media\//, '').replace(/[^a-zA-Z0-9._/-]/g, ''); }
function contentType(mime) { return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime) ? mime : null; }

async function handleUpload(request, env) {
  if (!env.MEDIA) return apiError('Add an R2 binding named MEDIA before uploading images.', 503);
  const { filename, dataUrl } = await request.json();
  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return apiError('Upload a PNG, JPG, WebP or GIF image.');
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  if (bytes.byteLength > 3 * 1024 * 1024) return apiError('Choose an image under 3 MB.', 413);
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[match[1]];
  const stem = String(filename || 'image').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'image';
  const key = `${stem}-${crypto.randomUUID().slice(0, 10)}.${extension}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: match[1] } });
  return json({ url: `/media/${key}` }, { status: 201 });
}
async function serveMedia(pathname, env) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA.get(mediaKey(pathname));
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'GET' && pathname === '/api/content') {
      try { return json(await contentFromDatabase(env)); }
      catch (error) { return apiError(`Could not load CMS content: ${error.message}`, 500); }
    }
    if (pathname.startsWith('/media/')) return serveMedia(pathname, env);
    if (pathname.startsWith('/api/admin')) {
      const access = await requireAdmin(request, env); if (access) return access;
      try {
        if (request.method === 'GET' && pathname === '/api/admin/content') return json(await contentFromDatabase(env));
        if (request.method === 'PUT' && pathname === '/api/admin/content') {
          if (!env.DB) return apiError('Add a D1 binding named DB before saving content.', 503);
          const { content } = await request.json();
          if (!content || typeof content !== 'object' || Array.isArray(content)) return apiError('A content object is required.');
          await ensureDatabase(env.DB);
          await env.DB.prepare('INSERT INTO cms_content (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind('site', JSON.stringify(content), new Date().toISOString()).run();
          return json({ ok: true, updatedAt: new Date().toISOString() });
        }
        if (request.method === 'POST' && pathname === '/api/admin/upload') return handleUpload(request, env);
        return apiError('Not found', 404);
      } catch (error) { return apiError(error.message || 'Unexpected CMS error', 500); }
    }
    if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
      const access = await requireAdmin(request, env); if (access) return access;
      if (pathname === '/admin' || pathname === '/admin/') return env.ASSETS.fetch(new Request(new URL('/admin/index.html', url), request));
    }
    return env.ASSETS.fetch(request);
  }
};
