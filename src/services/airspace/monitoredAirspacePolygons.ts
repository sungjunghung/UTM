import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import rawData from './monitoredZonesGeoJson.json'

interface MonitoredZoneEntry {
  geometry: Geometry
  properties: Record<string, any>
}

const geoJsonFormat = new GeoJSON()
const zoneEntryMap = new Map<string, MonitoredZoneEntry>()

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
      const entry: MonitoredZoneEntry = { geometry: geom, properties: { ...feat.properties } }

      // Map by objectId, full name, and key aliases
      if (objectId) zoneEntryMap.set(objectId, entry)
      if (name) zoneEntryMap.set(name, entry)

      // Friendly aliases matching our monitored zone IDs / names
      if (name.includes('寶山淨水廠')) {
        zoneEntryMap.set('CAA-RED-BAOSHAN-WATER', entry)
        zoneEntryMap.set('竹縣20 寶山淨水廠', entry)
      }
      if (name.includes('竹園超高壓變電所') || name.includes('竹市149')) {
        zoneEntryMap.set('CAA-RED-SUBSTATION', entry)
        zoneEntryMap.set('竹市149 竹園超高壓變電所', entry)
      }
      if (name.includes('二、三重') || name.includes('二三重') || name.includes('竹縣32')) {
        zoneEntryMap.set('CAA-YELLOW-ERCHONG', entry)
        zoneEntryMap.set('竹縣32 二三重限航區', entry)
      }
    }
  })
} catch (e) {
  console.error('[monitoredAirspacePolygons] Failed to pre-parse CAA polygons:', e)
}

function findZoneEntry(zoneIdentifier: string): MonitoredZoneEntry | null {
  if (!zoneIdentifier) return null
  if (zoneEntryMap.has(zoneIdentifier)) {
    return zoneEntryMap.get(zoneIdentifier)!
  }

  // Fuzzy match by substring
  for (const [key, entry] of zoneEntryMap.entries()) {
    if (key.includes(zoneIdentifier) || zoneIdentifier.includes(key)) {
      return entry
    }
  }

  return null
}

/**
 * Retrieve the actual Civil Aeronautics Administration (CAA) exact polygon geometry
 * for a monitored No-Fly or Restricted zone. Never fall back to drawing circular approximations.
 */
export function getRealCaaZoneGeometry(zoneIdentifier: string): Geometry | null {
  return findZoneEntry(zoneIdentifier)?.geometry.clone() ?? null
}

/**
 * Retrieve the raw CAA attribute properties (空域名稱、空域說明、主管機關、罰則…) of a monitored zone.
 */
export function getRealCaaZoneProperties(zoneIdentifier: string): Record<string, any> | null {
  const entry = findZoneEntry(zoneIdentifier)
  return entry ? { ...entry.properties } : null
}
