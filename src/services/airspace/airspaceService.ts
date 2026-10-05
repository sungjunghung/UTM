import type { AirspaceGeoJsonCollection } from './types'

/**
 * Spatial query to Civil Aeronautics Administration (CAA) Drone GIS FeatureServer
 * Retrieves Red (No-Fly) and Yellow (Restricted) airspace zones for a given bounding box.
 */
export async function queryCaaAirspaceGeoJson(
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
): Promise<AirspaceGeoJsonCollection | null> {
  const [minLon, minLat, maxLon, maxLat] = bbox

  // Buffer slightly (approx 0.04 degrees ~ 4.5 km) to preload perimeter zones
  const buffer = 0.04
  const bXmin = (minLon - buffer).toFixed(5)
  const bYmin = (minLat - buffer).toFixed(5)
  const bXmax = (maxLon + buffer).toFixed(5)
  const bYmax = (maxLat + buffer).toFixed(5)

  const params = new URLSearchParams({
    where: "限制區 IN ('紅區','黃區')",
    geometry: `${bXmin},${bYmin},${bXmax},${bYmax}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'objectid,限制區,空域名稱,空域說明,主管機關,主管機關名稱,有效日期起,有效日期迄,罰則',
    f: 'geojson',
    returnGeometry: 'true',
  })

  // 1. Try local proxy endpoint first (avoids CORS and adds server caching)
  try {
    const res = await fetch(`/api/caa/query?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.type === 'FeatureCollection') {
        return data as AirspaceGeoJsonCollection
      }
    }
  } catch (err) {
    console.warn('[AirspaceService] Local proxy failed, trying direct CAA upstream...', err)
  }

  // 2. Direct upstream fallback
  try {
    const directUrl = `https://dronegis.caa.gov.tw/server/rest/services/Hosted/UAV_fs_ryg/FeatureServer/0/query?${params.toString()}`
    const res = await fetch(directUrl, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (res.ok) {
      return (await res.json()) as AirspaceGeoJsonCollection
    }
  } catch (directErr) {
    console.error('[AirspaceService] Both proxy and direct CAA queries failed:', directErr)
  }

  return null
}
