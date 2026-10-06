/**
 * adsb.lol proxy on Vercel (AWS Hong Kong region, see vercel.json).
 *
 * adsb.lol rate-limits Cloudflare's shared egress IPs (429), so the live ADS-B route can't go through
 * the Cloudflare Worker in worker/. This function serves only /api/adsb/*; the Worker keeps the rest.
 * Vercel's CDN caches responses for 3s (s-maxage) so upstream sees ~1 request / 3s regardless of viewers.
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://sungjunghung.github.io,http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  }
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' })

  // vercel.json rewrites /api/adsb/<path> → /api/adsb?p=<path>, e.g. p = v2/point/23.8/121.0/250
  const p = String(req.query.p || '')
  if (!/^[\w./-]+$/.test(p) || p.includes('..')) return res.status(400).json({ error: 'Bad path', ac: [] })
  const upstreamUrl = `https://api.adsb.lol/${p}`

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'UTM-FlightRadar/1.0', Accept: 'application/json' },
    })
    if (!upstreamRes.ok) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(502).json({ error: `Upstream returned ${upstreamRes.status}`, ac: [] })
    }
    const body = await upstreamRes.text()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=3, stale-while-revalidate=30')
    return res.status(200).send(body)
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ error: err?.message || 'Fetch failed', ac: [] })
  }
}
