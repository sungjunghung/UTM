/**
 * UTM API proxy (Cloudflare Worker)
 *
 * GitHub Pages is static, and adsb.lol / CAA dronegis don't send CORS headers browsers accept,
 * so this Worker mirrors the dev-server proxy routes in vite.config.ts:
 *   /api/adsb/*   → https://api.adsb.lol/*                       (live ADS-B traffic)
 *   /api/caa/*    → CAA dronegis UAV_fs_ryg FeatureServer layer 0 (drone no-fly / restricted zones)
 *   /api/hexdb/*  → https://hexdb.io/api/v1/*                     (route / aircraft / airport lookup)
 *   /api/adsbdb/* → https://api.adsbdb.com/v0/*                   (route lookup fallback)
 *
 * Responses are cached at the edge. `ttl` = how long a cached copy is served as fresh;
 * `staleTtl` = how long it is kept as a fallback when the upstream errors or rate-limits (429).
 */

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ROUTES = [
  {
    prefix: '/api/adsb',
    upstream: 'https://api.adsb.lol',
    ttl: 3,
    staleTtl: 120,
    headers: { 'User-Agent': 'UTM-FlightRadar/1.0', Accept: 'application/json' },
    // adsb.lol rate-limits (429) Cloudflare's shared egress IPs; fall back to adsb.fi (same readsb data)
    fallback: adsbFiFallback,
  },
  {
    prefix: '/api/caa',
    upstream: 'https://dronegis.caa.gov.tw/server/rest/services/Hosted/UAV_fs_ryg/FeatureServer/0',
    ttl: 300,
    staleTtl: 86400,
    headers: { 'User-Agent': BROWSER_UA, Referer: 'https://dronegis.caa.gov.tw/', Accept: 'application/json' },
  },
  {
    prefix: '/api/hexdb',
    upstream: 'https://hexdb.io/api/v1',
    ttl: 86400,
    staleTtl: 86400 * 7,
    headers: { 'User-Agent': 'UTM-FlightRadar/1.0', Accept: 'application/json' },
  },
  {
    prefix: '/api/adsbdb',
    upstream: 'https://api.adsbdb.com/v0',
    ttl: 86400,
    staleTtl: 86400 * 7,
    headers: { 'User-Agent': 'UTM-FlightRadar/1.0', Accept: 'application/json' },
  },
]

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    const originAllowed = allowedOrigins.includes(origin)
    const cors = originAllowed
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' }
      : {}

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originAllowed ? 204 : 403, headers: cors })
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, cors)
    }
    // Only serve the UTM front-end (browsers always send Origin on cross-origin fetch)
    if (!originAllowed) {
      return json({ error: 'Origin not allowed' }, 403, cors)
    }

    const url = new URL(request.url)
    const route = ROUTES.find((r) => url.pathname === r.prefix || url.pathname.startsWith(`${r.prefix}/`))
    if (!route) {
      return json({ error: 'Not found' }, 404, cors)
    }

    const upstreamUrl = `${route.upstream}${url.pathname.slice(route.prefix.length)}${url.search}`
    const cache = caches.default
    const cacheKey = new Request(upstreamUrl, { method: 'GET' })
    const cached = await cache.match(cacheKey)
    const cachedAge = cached ? (Date.now() - Number(cached.headers.get('X-Fetched-At') || 0)) / 1000 : Infinity

    // Browser-facing cache lifetime is always the route's fresh ttl (the edge copy lives longer as a fallback)
    const clientHeaders = (status) => ({ ...cors, 'X-Cache': status, 'Cache-Control': `public, max-age=${route.ttl}` })

    if (cached && cachedAge < route.ttl) {
      return withHeaders(cached, clientHeaders('HIT'))
    }

    try {
      let body = null
      let status = 0
      const upstreamRes = await fetch(upstreamUrl, { headers: route.headers })
      status = upstreamRes.status
      if (upstreamRes.ok) {
        body = await upstreamRes.text()
      } else if (route.fallback) {
        body = await route.fallback(url.pathname.slice(route.prefix.length)).catch(() => null)
      }

      if (body === null) {
        if (cached) return withHeaders(cached, clientHeaders('STALE'))
        return json({ error: `Upstream returned ${status}`, ac: [] }, 502, cors)
      }

      const fresh = new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${route.staleTtl}`,
          'X-Fetched-At': String(Date.now()),
        },
      })
      ctx.waitUntil(cache.put(cacheKey, fresh.clone()))
      return withHeaders(fresh, clientHeaders('MISS'))
    } catch (err) {
      if (cached) return withHeaders(cached, clientHeaders('STALE'))
      return json({ error: err?.message || 'Fetch failed', ac: [] }, 502, cors)
    }
  },
}

/**
 * adsb.lol path /v2/point/{lat}/{lon}/{radiusNm} → adsb.fi /api/v2/lat/{lat}/lon/{lon}/dist/{radiusNm},
 * reshaped to adsb.lol's { ac, now, total } so the front-end needs no changes. Returns null if unsupported/failed.
 */
async function adsbFiFallback(path) {
  const m = path.match(/^\/v2\/point\/(-?[\d.]+)\/(-?[\d.]+)\/([\d.]+)$/)
  if (!m) return null
  const res = await fetch(`https://opendata.adsb.fi/api/v2/lat/${m[1]}/lon/${m[2]}/dist/${m[3]}`, {
    headers: { 'User-Agent': 'UTM-FlightRadar/1.0', Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json()
  const ac = data.aircraft || data.ac || []
  return JSON.stringify({ ac, now: data.now, total: ac.length, source: 'adsb.fi' })
}

function withHeaders(res, extra) {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v)
  return out
}

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}
