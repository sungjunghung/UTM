import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import rawData from './monitoredZonesGeoJson.json'

const geoJsonFormat = new GeoJSON()
const zoneGeometryMap = new Map<string, Geometry>()

// Pre-parse the real CAA polygon geometries into EPSG:3857
try {
  rawData.features.forEach((feat) => {
    const olFeature = geoJsonFormat.readFeature(feat, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }) as import('ol/Feature').default
    const geom = olFeature ? olFeature.getGeometry() : null
    if (geom) {
      const name = (feat.properties?.空域名稱 as string) || ''
      const objectId = String(feat.id || feat.properties?.objectid || '')

      // Map by objectId, full name, and key aliases
      if (objectId) zoneGeometryMap.set(objectId, geom)
      if (name) zoneGeometryMap.set(name, geom)

      // Friendly aliases matching our monitored zone IDs / names
      if (name.includes('寶山淨水廠')) {
        zoneGeometryMap.set('CAA-RED-BAOSHAN-WATER', geom)
        zoneGeometryMap.set('竹縣20 寶山淨水廠', geom)
      }
      if (name.includes('竹園超高壓變電所') || name.includes('竹市149')) {
        zoneGeometryMap.set('CAA-RED-SUBSTATION', geom)
        zoneGeometryMap.set('竹市149 竹園超高壓變電所', geom)
      }
      if (name.includes('二、三重') || name.includes('二三重') || name.includes('竹縣32')) {
        zoneGeometryMap.set('CAA-YELLOW-ERCHONG', geom)
        zoneGeometryMap.set('竹縣32 二三重限航區', geom)
      }
    }
  })
} catch (e) {
  console.error('[monitoredAirspacePolygons] Failed to pre-parse CAA polygons:', e)
}

/**
 * Retrieve the actual Civil Aeronautics Administration (CAA) exact polygon geometry
 * for a monitored No-Fly or Restricted zone. Never fall back to drawing circular approximations.
 */
export function getRealCaaZoneGeometry(zoneIdentifier: string): Geometry | null {
  if (zoneGeometryMap.has(zoneIdentifier)) {
    return zoneGeometryMap.get(zoneIdentifier)!.clone()
  }

  // Fuzzy match by substring
  for (const [key, geom] of zoneGeometryMap.entries()) {
    if (key.includes(zoneIdentifier) || zoneIdentifier.includes(key)) {
      return geom.clone()
    }
  }

  return null
}
