const SCHOLAR_ID = 'nB2d3vgAAAAJ';
const SCHOLAR_URL = `https://scholar.google.com/citations?user=${SCHOLAR_ID}&hl=en`;
const FALLBACK_BASE = 'https://tanxuezhi.github.io/data';
const ALLOWED_ORIGINS = new Set(['https://tanxuezhi.github.io', 'http://localhost:8787']);

const json = (value, request, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
    'access-control-allow-origin': ALLOWED_ORIGINS.has(request.headers.get('Origin')) ? request.headers.get('Origin') : 'https://tanxuezhi.github.io',
    'vary': 'Origin',
  },
});

const classify = (title) => {
  const text = String(title || '').toLowerCase();
  const groups = {
    energy: ['wind energy', 'solar energy', 'hydropower', 'renewable energy', 'photovoltaic', 'wind power'],
    agri: ['agricultur', 'crop', 'maize', 'wheat', 'irrigation', 'nitrogen', 'soil moisture'],
    hazards: ['drought', 'flood', 'whiplash', 'disaster', 'hazard', 'cyclone'],
    extreme: ['precipitation', 'rainfall', 'rainstorm', 'extreme rain', 'moisture transport', 'monsoon'],
  };
  return Object.entries(groups).find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] || 'water';
};

const clean = (text) => String(text || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const pick = (text, expression) => text.match(expression)?.[1] || '';

function parseScholarPage(page) {
  const rows = page.match(/<tr[^>]*class=["'][^"']*\bgsc_a_tr\b[^"']*["'][^>]*>[\s\S]*?<\/tr>/g) || [];
  return rows.map((row) => {
    const title = clean(pick(row, /class=["'][^"']*\bgsc_a_at\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/));
    const href = pick(row, /class=["'][^"']*\bgsc_a_at\b[^"']*["'][^>]*href=["']([^"']+)/);
    const details = [...row.matchAll(/<div[^>]*class=["'][^"']*\bgs_gray\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/g)].map((match) => clean(match[1]));
    const citationText = clean(pick(row, /class=["'][^"']*\bgsc_a_ac\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/));
    const year = Number(pick(row, /class=["'][^"']*\bgsc_a_y\b[^"']*["'][^>]*>[\s\S]*?(\d{4})/)) || null;
    return title ? {
      title, authors: details[0] || '', venue: details[1] || 'Google Scholar', year,
      citations: Number(citationText.replace(/\D/g, '')) || 0, category: classify(title),
      url: href ? new URL(href.replace(/&amp;/g, '&'), 'https://scholar.google.com').href : SCHOLAR_URL,
    } : null;
  }).filter(Boolean);
}

function readMetrics(page) {
  const values = [...page.matchAll(/class=["']gsc_rsb_std["'][^>]*>\s*([^<]+)/g)].map((match) => Number(clean(match[1]).replace(/,/g, '')));
  if (values.length < 3 || values.slice(0, 3).some(Number.isNaN)) throw new Error('Scholar metrics were unavailable');
  return {citations: values[0], h_index: values[1], i10_index: values[2]};
}

async function fetchScholar() {
  const headers = {'user-agent': 'Mozilla/5.0 (compatible; XuezhiTanAcademicSite/1.0)', 'accept-language': 'en-US,en;q=0.9'};
  const first = await fetch(`${SCHOLAR_URL}&view_op=list_works&cstart=0&pagesize=100`, {headers});
  if (!first.ok) throw new Error(`Scholar returned HTTP ${first.status}`);
  const firstPage = await first.text();
  const metrics = readMetrics(firstPage);
  const publications = parseScholarPage(firstPage);
  if (!publications.length) throw new Error('Scholar returned no publication records');
  const second = await fetch(`${SCHOLAR_URL}&view_op=list_works&cstart=100&pagesize=100`, {headers});
  if (second.ok) publications.push(...parseScholarPage(await second.text()));
  const unique = [...new Map(publications.map((item) => [item.title, item])).values()];
  return {stats: {scholar_id: SCHOLAR_ID, ...metrics}, publications: unique};
}

async function fetchFallback() {
  const [statsResponse, publicationsResponse] = await Promise.all([
    fetch(`${FALLBACK_BASE}/scholar-stats.json`, {cf: {cacheTtl: 300}}),
    fetch(`${FALLBACK_BASE}/scholar-publications.json`, {cf: {cacheTtl: 300}}),
  ]);
  if (!statsResponse.ok || !publicationsResponse.ok) throw new Error('Fallback Scholar snapshot was unavailable');
  return {stats: await statsResponse.json(), publications: (await publicationsResponse.json()).publications || []};
}

async function refresh(env) {
  let payload;
  let source = 'google-scholar';
  try { payload = await fetchScholar(); }
  catch (_) { payload = await fetchFallback(); source = 'github-snapshot'; }
  const updated_at = new Date().toISOString();
  const stats = {...payload.stats, updated_at, source, refresh_mode: 'dynamic API'};
  const catalogue = {scholar_id: SCHOLAR_ID, updated_at, source, publications: payload.publications};
  await Promise.all([
    env.SCHOLAR_CACHE.put('stats', JSON.stringify(stats)),
    env.SCHOLAR_CACHE.put('publications', JSON.stringify(catalogue)),
  ]);
  return {stats, catalogue};
}

async function cached(env) {
  const [stats, publications] = await Promise.all([env.SCHOLAR_CACHE.get('stats', 'json'), env.SCHOLAR_CACHE.get('publications', 'json')]);
  if (stats && publications) return {stats, publications};
  const fresh = await refresh(env);
  return {stats: fresh.stats, publications: fresh.catalogue};
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {headers: {'access-control-allow-origin': 'https://tanxuezhi.github.io', 'access-control-allow-methods': 'GET, OPTIONS'}});
    if (request.method !== 'GET') return json({error: 'Method not allowed'}, request, 405);
    try {
      const data = await cached(env);
      if (url.pathname === '/api/v1/health') return json({status: 'ok', updated_at: data.stats.updated_at, source: data.stats.source}, request);
      if (url.pathname === '/api/v1/stats') return json(data.stats, request);
      if (url.pathname === '/api/v1/publications') {
        const category = url.searchParams.get('category');
        const publications = category ? data.publications.publications.filter((paper) => paper.category === category) : data.publications.publications;
        return json({...data.publications, publications}, request);
      }
      return json({error: 'Not found'}, request, 404);
    } catch (error) {
      return json({error: 'Scholar data temporarily unavailable', detail: String(error.message || error)}, request, 503);
    }
  },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(refresh(env)); },
};
