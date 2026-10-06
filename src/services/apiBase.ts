/**
 * Base URLs for the /api/* proxy routes.
 * - Dev: both empty → served by the Vite middleware in vite.config.ts
 * - GitHub Pages:
 *   VITE_API_BASE      → Cloudflare Worker (worker/): /api/caa, /api/hexdb, /api/adsbdb
 *   VITE_ADSB_API_BASE → Vercel function (proxy-vercel/): /api/adsb
 *     (adsb.lol rate-limits Cloudflare's shared egress IPs, so live traffic can't use the Worker)
 */
const trimBase = (v: unknown) => ((v as string | undefined) ?? '').replace(/\/+$/, '')
const API_BASE = trimBase(import.meta.env.VITE_API_BASE)
const ADSB_API_BASE = trimBase(import.meta.env.VITE_ADSB_API_BASE) || API_BASE

export function apiUrl(path: string): string {
  return `${path.startsWith('/api/adsb/') ? ADSB_API_BASE : API_BASE}${path}`
}
