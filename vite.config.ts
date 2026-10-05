import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/**
 * Vite plugin for caching ADS-B API requests with stale-while-revalidate.
 * Prevents HTTP 429 by ensuring upstream is queried at most once every 8 seconds,
 * coalescing concurrent requests, and serving cached data during upstream throttles.
 */
function adsbCachePlugin(): Plugin {
  let cachedJson = ''
  let cacheTimestamp = 0
  const CACHE_TTL_MS = 3000 // 3 seconds cache
  let inflightRequest: Promise<string> | null = null

  return {
    name: 'adsb-cache-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/hexdb/')) {
          const upstreamPath = req.url.replace(/^\/api\/hexdb/, '')
          try {
            const upstreamRes = await fetch(`https://hexdb.io/api/v1${upstreamPath}`, {
              headers: {
                'User-Agent': 'UTM-FlightRadar/1.0',
                Accept: 'application/json',
              },
            })
            const body = await upstreamRes.text()
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(body)
          } catch (err: any) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        if (req.url && req.url.startsWith('/api/caa/')) {
          const upstreamPath = req.url.replace(/^\/api\/caa/, '')
          const caaUrl = `https://dronegis.caa.gov.tw/server/rest/services/Hosted/UAV_fs_ryg/FeatureServer/0${upstreamPath}`
          try {
            const upstreamRes = await fetch(caaUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: 'https://dronegis.caa.gov.tw/',
                Accept: 'application/json',
              },
            })
            const body = await upstreamRes.text()
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=300')
            res.end(body)
          } catch (err: any) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        if (!req.url || !req.url.startsWith('/api/adsb/')) {
          return next()
        }

        const upstreamPath = req.url.replace(/^\/api\/adsb/, '')
        const now = Date.now()

        // 1. If cache is still valid, return instantly
        if (cachedJson && now - cacheTimestamp < CACHE_TTL_MS) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('X-Cache', 'HIT')
          res.end(cachedJson)
          return
        }

        // 2. Single-flight / Coalesce concurrent calls
        try {
          if (!inflightRequest) {
            inflightRequest = (async () => {
              const url = `https://api.adsb.lol${upstreamPath}`
              const upstreamRes = await fetch(url, {
                headers: {
                  'User-Agent': 'UTM-FlightRadar/1.0',
                  Accept: 'application/json',
                },
              })

              if (!upstreamRes.ok) {
                // If throttled (429) or error, fallback to stale cache if available
                if (upstreamRes.status === 429 && cachedJson) {
                  return cachedJson
                }
                throw new Error(`Upstream returned ${upstreamRes.status}`)
              }

              const body = await upstreamRes.text()
              cachedJson = body
              cacheTimestamp = Date.now()
              return body
            })().finally(() => {
              inflightRequest = null
            })
          }

          const responseText = await inflightRequest
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('X-Cache', 'MISS')
          res.end(responseText)
        } catch (err: any) {
          // Fallback to stale cache if network fails
          if (cachedJson) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('X-Cache', 'STALE')
            res.end(cachedJson)
            return
          }

          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Fetch failed', ac: [] }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    adsbCachePlugin(),
  ],
})
