/**
 * Base URL for the /api/* proxy routes (adsb.lol, hexdb, adsbdb, CAA).
 * - Dev: empty → served by the Vite middleware in vite.config.ts
 * - GitHub Pages: set VITE_API_BASE to the Cloudflare Worker URL (worker/ mirrors the same /api/* routes)
 */
const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
