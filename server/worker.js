/* Fahem proxy — a Cloudflare Worker that holds your Gemini API key so visitors get AI
 * explanations and natural voice in any browser without entering keys.
 *
 * Settings (Worker → Settings → Variables):
 *   GEMINI_API_KEY   secret   your key from Google AI Studio
 *   ALLOWED_ORIGINS  text     comma-separated site origins, e.g. https://mobhim.github.io
 *   MODELS           text     optional comma-separated allowlist of model ids
 *
 * It forwards only POST /v1beta/models/<model>:generateContent, only for allowed models,
 * and only when the browser's Origin is on your list. Origin can be forged by non-browser
 * clients, so also add a rate-limiting rule in the Cloudflare dashboard and set a spending
 * cap on the key in Google Cloud. */
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-tts'];
const MAX_BODY = 6 * 1024 * 1024; // a slide image plus the prompt

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const reply = (status, message) => new Response(JSON.stringify({ error: { message } }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (!allowed.includes(origin)) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.GEMINI_API_KEY) return reply(500, 'GEMINI_API_KEY is not set on the worker.');

    const path = new URL(request.url).pathname;
    const match = path.match(/^\/v1beta\/models\/([\w.-]+):generateContent$/);
    if (request.method !== 'POST' || !match) return reply(404, 'Not found.');
    const models = String(env.MODELS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!(models.length ? models : DEFAULT_MODELS).includes(match[1])) return reply(403, 'Model not allowed.');

    const body = await request.text();
    if (body.length > MAX_BODY) return reply(413, 'Request too large.');
    const upstream = await fetch(`https://generativelanguage.googleapis.com${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body,
    });
    return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
