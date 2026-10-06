import Feature from 'ol/Feature'
import { LineString, Point } from 'ol/geom'
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import type { RouteInfo } from './flightInfoService'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Generate Great-Circle (geodesic) intermediate points between two lon/lat coordinates
 */
export function generateGreatCirclePoints(
  start: [number, number],
  end: [number, number],
  numPoints: number = 40
): [number, number][] {
  const lon1 = start[0] * DEG_TO_RAD
  const lat1 = start[1] * DEG_TO_RAD
  const lon2 = end[0] * DEG_TO_RAD
  const lat2 = end[1] * DEG_TO_RAD

  // Spherical distance d
  const sinDLat2 = Math.sin((lat2 - lat1) / 2)
  const sinDLon2 = Math.sin((lon2 - lon1) / 2)
  const a = sinDLat2 * sinDLat2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon2 * sinDLon2
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))

  if (d < 0.0001) return [start, end]

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG
    const lon = Math.atan2(y, x) * RAD_TO_DEG
    points.push([lon, lat])
  }
  return points
}

/**
 * Create OpenLayers vector features for aircraft flight route:
 * 1. Flown segment (Origin -> Current position)
 * 2. Projected segment (Current position -> Destination)
 * 3. Origin airport marker
 * 4. Destination airport marker
 */
export function createFlightRouteFeatures(
  route: RouteInfo,
  currentPlaneLonLat: [number, number]
): Feature[] {
  const features: Feature[] = []
  const origCoord = route.origin.coordinate
  const destCoord = route.destination.coordinate

  // 1. Flown Segment (Origin -> Plane)
  if (origCoord) {
    const flownPoints = generateGreatCirclePoints(origCoord, currentPlaneLonLat, 30)
    const flownCoords = flownPoints.map((p) => fromLonLat(p))
    const flownFeature = new Feature({
      geometry: new LineString(flownCoords),
    })
    flownFeature.setStyle([
      new Style({
        stroke: new Stroke({
          color: 'rgba(56, 189, 248, 0.25)',
          width: 7,
        }),
        zIndex: 20,
      }),
      new Style({
        stroke: new Stroke({
          color: '#38bdf8',
          width: 2.5,
        }),
        zIndex: 21,
      }),
    ])
    features.push(flownFeature)

    // Origin Airport Pin
    const origFeature = new Feature({
      geometry: new Point(fromLonLat(origCoord)),
    })
    origFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#38bdf8' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: `🛫 ${route.origin.city || route.origin.name} (${route.origin.iata || route.origin.icao})`,
          font: 'bold 11px system-ui, sans-serif',
          textBaseline: 'bottom',
          offsetY: -8,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#0f172a', width: 3 }),
          backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
          backgroundStroke: new Stroke({ color: '#38bdf8', width: 1 }),
          padding: [2, 6, 2, 6],
        }),
        zIndex: 25,
      })
    )
    features.push(origFeature)
  }

  // 2. Projected Segment (Plane -> Destination)
  if (destCoord) {
    const projPoints = generateGreatCirclePoints(currentPlaneLonLat, destCoord, 30)
    const projCoords = projPoints.map((p) => fromLonLat(p))
    const projFeature = new Feature({
      geometry: new LineString(projCoords),
    })
    projFeature.setStyle([
      new Style({
        stroke: new Stroke({
          color: 'rgba(52, 211, 153, 0.2)',
          width: 7,
        }),
        zIndex: 20,
      }),
      new Style({
        stroke: new Stroke({
          color: '#34d399',
          width: 2.5,
          lineDash: [8, 5],
        }),
        zIndex: 21,
      }),
    ])
    features.push(projFeature)

    // Destination Airport Pin
    const destFeature = new Feature({
      geometry: new Point(fromLonLat(destCoord)),
    })
    destFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#34d399' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: `🛬 ${route.destination.city || route.destination.name} (${route.destination.iata || route.destination.icao})`,
          font: 'bold 11px system-ui, sans-serif',
          textBaseline: 'bottom',
          offsetY: -8,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#0f172a', width: 3 }),
          backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
          backgroundStroke: new Stroke({ color: '#34d399', width: 1 }),
          padding: [2, 6, 2, 6],
        }),
        zIndex: 25,
      })
    )
    features.push(destFeature)
  }

  return features
}

/**
 * Generate Dead Reckoning flight corridor for aircraft without timetable routes
 * Extrapolates 20 minutes (~150-200 km) forward along current heading & speed.
 */
export function createDeadReckoningFeatures(
  currentPlaneLonLat: [number, number],
  headingDeg: number,
  speedKnots: number,
  flightCallsign: string
): Feature[] {
  const features: Feature[] = []
  const safeSpeed = Math.max(80, speedKnots || 250) // Default 250 kts cruise if zero
  // 20 minutes forward distance in meters
  const distMeters = (safeSpeed * 0.514444) * (20 * 60)

  const rad = (headingDeg * Math.PI) / 180
  const dLat = (distMeters * Math.cos(rad)) / 111320
  const latRad = (currentPlaneLonLat[1] * Math.PI) / 180
  const dLon = (distMeters * Math.sin(rad)) / (111320 * Math.max(Math.cos(latRad), 0.1))

  const pStart = currentPlaneLonLat
  const pEnd: [number, number] = [currentPlaneLonLat[0] + dLon, currentPlaneLonLat[1] + dLat]

  const lineCoords = [fromLonLat(pStart), fromLonLat(pEnd)]

  // 1. Projected Heading Ray Feature (Amber/Cyan Glow)
  const rayFeature = new Feature({
    geometry: new LineString(lineCoords),
  })
  rayFeature.setStyle([
    new Style({
      stroke: new Stroke({
        color: 'rgba(56, 189, 248, 0.22)',
        width: 8,
      }),
      zIndex: 20,
    }),
    new Style({
      stroke: new Stroke({
        color: '#38bdf8',
        width: 2.5,
        lineDash: [10, 6],
      }),
      zIndex: 21,
    }),
  ])
  features.push(rayFeature)

  // 2. Projected Waypoint Pin (20-min forward estimate)
  const waypointFeature = new Feature({
    geometry: new Point(fromLonLat(pEnd)),
  })
  waypointFeature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 4.5,
        fill: new Fill({ color: '#38bdf8' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: `🧭 ${flightCallsign} 預計空域 (+20分 / ${Math.round(distMeters / 1000)}km)`,
        font: 'bold 11px system-ui, sans-serif',
        textBaseline: 'bottom',
        offsetY: -8,
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#0f172a', width: 3 }),
        backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
        backgroundStroke: new Stroke({ color: '#38bdf8', width: 1 }),
        padding: [2, 6, 2, 6],
      }),
      zIndex: 25,
    })
  )
  features.push(waypointFeature)

  return features
}
