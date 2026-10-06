import Feature from 'ol/Feature'
import { LineString, Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style'
import { TAIWAN_ATS_AIRWAYS, type AirwaySegment } from './taiwanAirwaysData'

/**
 * Generate OpenLayers Features for ATS Airways
 * @param highlightedAirwayId If specified, draws that specific airway with an active pulse highlight
 */
export function createAirwaysFeatures(highlightedAirwayId?: string | null): Feature[] {
  const features: Feature[] = []

  // Add Airways Lines
  for (const airway of TAIWAN_ATS_AIRWAYS) {
    const isHighlighted = highlightedAirwayId === airway.id
    const coords = airway.waypoints.map((w) => fromLonLat(w.coord))

    const lineFeature = new Feature({
      geometry: new LineString(coords),
      id: airway.id,
      name: airway.name,
      type: 'airway-line',
    })

    if (isHighlighted) {
      // Highlighted Airway (Active flight corridor)
      lineFeature.setStyle([
        // Outer glowing buffer corridor
        new Style({
          stroke: new Stroke({
            color: 'rgba(56, 189, 248, 0.35)',
            width: 14,
          }),
          zIndex: 40,
        }),
        // Central sharp highway lane
        new Style({
          stroke: new Stroke({
            color: '#38bdf8',
            width: 3.5,
          }),
          text: new Text({
            text: `  ✈ 法定航路 ${airway.name} (FL${airway.minFlightLevel}-FL${airway.maxFlightLevel})  `,
            placement: 'line',
            font: 'bold 12px system-ui, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
            backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
            backgroundStroke: new Stroke({ color: '#38bdf8', width: 1 }),
            padding: [2, 8, 2, 8],
          }),
          zIndex: 42,
        }),
      ])
    } else {
      // Standard Airway baseline (Atmospheric airway grid)
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: airway.type === 'domestic' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.35)',
            width: 1.8,
            lineDash: [8, 6],
          }),
          text: new Text({
            text: ` ${airway.id} `,
            placement: 'line',
            font: 'bold 10px monospace',
            fill: new Fill({ color: '#94a3b8' }),
            stroke: new Stroke({ color: '#0f172a', width: 2.5 }),
          }),
          zIndex: 10,
        })
      )
    }

    features.push(lineFeature)

    // Add Waypoint Badges (Only for highlighted or domestic main spine)
    if (isHighlighted || airway.id === 'W4') {
      airway.waypoints.forEach((wp) => {
        const wpFeature = new Feature({
          geometry: new Point(fromLonLat(wp.coord)),
          name: wp.name,
          type: 'waypoint',
        })

        wpFeature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: isHighlighted ? 4.5 : 3,
              fill: new Fill({ color: isHighlighted ? '#38bdf8' : '#64748b' }),
              stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
            }),
            text: new Text({
              text: wp.name,
              font: isHighlighted ? 'bold 11px system-ui, sans-serif' : '9px monospace',
              offsetY: -9,
              fill: new Fill({ color: isHighlighted ? '#ffffff' : '#cbd5e1' }),
              stroke: new Stroke({ color: '#0f172a', width: 2.5 }),
            }),
            zIndex: isHighlighted ? 45 : 12,
          })
        )
        features.push(wpFeature)
      })
    }
  }

  return features
}

/**
 * Match an aircraft to the nearest Taiwan official ATS airway based on position & heading
 */
export function findMatchingAirway(
  planeLonLat: [number, number],
  headingDeg: number
): AirwaySegment | null {
  const [pLon, pLat] = planeLonLat

  // Search each airway to find if the plane is within ~35km lateral corridor
  for (const airway of TAIWAN_ATS_AIRWAYS) {
    for (let i = 0; i < airway.waypoints.length - 1; i++) {
      const a = airway.waypoints[i].coord
      const b = airway.waypoints[i + 1].coord

      // Bounding box pre-filter (~0.4 degrees approx 40km)
      const minLon = Math.min(a[0], b[0]) - 0.45
      const maxLon = Math.max(a[0], b[0]) + 0.45
      const minLat = Math.min(a[1], b[1]) - 0.45
      const maxLat = Math.max(a[1], b[1]) + 0.45

      if (pLon >= minLon && pLon <= maxLon && pLat >= minLat && pLat <= maxLat) {
        // Compute airway segment bearing
        const segRad = Math.atan2(b[0] - a[0], b[1] - a[1])
        let segDeg = (segRad * 180) / Math.PI
        if (segDeg < 0) segDeg += 360

        // Check if aircraft heading is roughly aligned (within 45 degrees forward or backward)
        const angleDiff1 = Math.abs(((headingDeg - segDeg + 540) % 360) - 180)
        const angleDiff2 = Math.abs(((headingDeg - (segDeg + 180) + 540) % 360) - 180)

        if (angleDiff1 < 45 || angleDiff2 < 45) {
          return airway
        }
      }
    }
  }

  return null
}
