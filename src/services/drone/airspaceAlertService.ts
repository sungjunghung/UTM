import type { DroneEntity } from './DroneEntity'
import type { CollisionRisk } from './collisionTypes'

export interface MonitoredNoFlyZone {
  id: string
  name: string
  center: [number, number] // [lon, lat]
  radiusMeters: number
  description: string
  advisoryText: string
}

export interface MonitoredRestrictedZone {
  id: string
  name: string
  center: [number, number]
  radiusMeters: number
  maxLegalAltitudeMeters: number
  description: string
  advisoryText: string
}

export const MONITORED_NO_FLY_ZONES: MonitoredNoFlyZone[] = [
  {
    id: 'CAA-RED-BAOSHAN-WATER',
    name: '竹縣20 寶山淨水廠',
    center: [121.0354, 24.7543],
    radiusMeters: 300,
    description: '民航法第99-13條：重要民生水資源設施，全天候全高度禁止飛航',
    advisoryText: '民航法第99條違規！請飛手立即原路返航 (RTH) 並強制降落',
  },
  {
    id: 'CAA-RED-SUBSTATION',
    name: '竹市149 竹園超高壓變電所',
    center: [121.0224, 24.7650],
    radiusMeters: 220,
    description: '關鍵能源基礎設施，全天候全高度禁止無人機飛航',
    advisoryText: '誤入超高壓變電所紅區！請立即反向脫離禁航區範圍',
  },
]

export const MONITORED_RESTRICTED_ZONES: MonitoredRestrictedZone[] = [
  {
    id: 'CAA-YELLOW-ERCHONG',
    name: '竹縣32 二三重限航區',
    center: [121.048, 24.771],
    radiusMeters: 1600,
    maxLegalAltitudeMeters: 60,
    description: '都市計畫人口稠密限航區，法定飛行高度上限 60 公尺',
    advisoryText: '二三重都市計畫限航區法定上限 60m！請立即下壓油門降至安全層',
  },
]

export function getDistanceMeters(c1: [number, number], c2: [number, number]): number {
  const R = 6371000
  const lat1 = (c1[1] * Math.PI) / 180
  const lat2 = (c2[1] * Math.PI) / 180
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180
  const dLon = ((c2[0] - c1[0]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const METERS_PER_DEGREE_LAT = 111139
const DEG_TO_RAD = Math.PI / 180

export interface TrajectoryIntersection {
  isIntersecting: boolean
  entryDistanceMeters: number
  timeToEntrySeconds: number
  entryCoordinate: [number, number]
  closestDistanceMeters: number
}

/**
 * Predicts whether a drone's straight-line flight path along its current heading
 * will intersect a circular zone boundary, and calculates the exact entry point and ETA.
 * Filters out drones that are flying away or whose trajectory will not cross the zone.
 */
export function predictZoneIntersection(
  dronePos: [number, number],
  headingDeg: number,
  speedMps: number,
  zoneCenter: [number, number],
  zoneRadiusMeters: number,
  timeHorizonSeconds: number = 45
): TrajectoryIntersection | null {
  const avgLat = ((dronePos[1] + zoneCenter[1]) / 2) * DEG_TO_RAD
  const metersPerDegLon = METERS_PER_DEGREE_LAT * Math.cos(avgLat)

  // Relative vector from drone to zone center (dx: East, dy: North) in meters
  const dx = (zoneCenter[0] - dronePos[0]) * metersPerDegLon
  const dy = (zoneCenter[1] - dronePos[1]) * METERS_PER_DEGREE_LAT
  const distToCenter = Math.sqrt(dx * dx + dy * dy)

  // If already inside the circle
  if (distToCenter <= zoneRadiusMeters) {
    return null // Handled directly as breached
  }

  // Heading unit vector (0 deg = North, 90 deg = East)
  const hRad = headingDeg * DEG_TO_RAD
  const ux = Math.sin(hRad)
  const uy = Math.cos(hRad)

  // Projection length of (dx, dy) onto forward heading vector
  // Represents forward distance to the Point of Closest Approach (PCA)
  const tProj = dx * ux + dy * uy

  // If tProj <= 0, PCA is behind the drone (flying away from zone center)
  if (tProj <= 0) {
    return null
  }

  // Perpendicular distance squared from zone center to flight path line
  // distToCenter^2 = tProj^2 + dPerp^2
  const dPerpSq = Math.max(0, distToCenter * distToCenter - tProj * tProj)
  const rSq = zoneRadiusMeters * zoneRadiusMeters

  // If closest distance exceeds zone radius, flight line misses the zone completely
  if (dPerpSq > rSq) {
    return null
  }

  // Half chord length inside the zone
  const halfChord = Math.sqrt(rSq - dPerpSq)

  // Distance along heading to the zone boundary entry point
  const entryDistanceMeters = tProj - halfChord
  if (entryDistanceMeters <= 0) {
    return null
  }

  const effectiveSpeed = Math.max(1, speedMps)
  const timeToEntrySeconds = Math.round((entryDistanceMeters / effectiveSpeed) * 10) / 10

  // Filter by lookahead horizon (e.g. within 45 seconds)
  if (timeToEntrySeconds > timeHorizonSeconds) {
    return null
  }

  // Calculate exact intersection coordinate on zone boundary
  const entryLon = dronePos[0] + (ux * entryDistanceMeters) / metersPerDegLon
  const entryLat = dronePos[1] + (uy * entryDistanceMeters) / METERS_PER_DEGREE_LAT

  return {
    isIntersecting: true,
    entryDistanceMeters: Math.round(entryDistanceMeters),
    timeToEntrySeconds,
    entryCoordinate: [entryLon, entryLat],
    closestDistanceMeters: Math.round(Math.sqrt(dPerpSq)),
  }
}

/**
 * Multi-stage Geofence Proximity & Altitude Ceiling Violation Detection
 * Evaluates both "Approaching" (預估路徑直線即將進入) and "Breached" (已直接闖入) with real-time distance and countdown.
 */
export function checkAirspaceViolations(drones: DroneEntity[]): CollisionRisk[] {
  const alerts: CollisionRisk[] = []
  const now = Date.now()

  drones.forEach((drone) => {
    const dronePos = drone.currentLonLat
    const droneAlt = Math.round(drone.altitudeAglMeters * 10) / 10
    const speedMps = Math.max(6, (drone.speedKmh * 1000) / 3600)

    // 1. Check No-Fly Red Zones (Proximity 預估射線進入 & Breach 直接闖入)
    for (const zone of MONITORED_NO_FLY_ZONES) {
      const distToCenter = getDistanceMeters(dronePos, zone.center)
      const distToBoundary = distToCenter - zone.radiusMeters

      if (distToBoundary <= 0) {
        // [階段 2：違規入侵 (Critical)] - 已直接闖入紅區邊界內
        const breachDepth = Math.round(Math.abs(distToBoundary))
        alerts.push({
          id: `no-fly:${drone.id}:${zone.id}`,
          type: 'no-fly-zone',
          severity: 'critical',
          stage: 'breached',
          droneAId: drone.id,
          droneACallsign: drone.callsign,
          zoneName: zone.name,
          zoneCenter: zone.center,
          zoneRadiusMeters: zone.radiusMeters,
          currentAltitudeMeters: droneAlt,
          cpaCoordinate: [dronePos[0], dronePos[1]],
          cpaAltitudeMeters: droneAlt,
          metricPrimaryTitle: '空域狀態',
          metricPrimaryValue: '已越界入侵',
          metricSecondaryTitle: '入侵深度',
          metricSecondaryValue: `${breachDepth}m`,
          advisoryText: zone.advisoryText,
          timestamp: now,
        })
        break
      }

      // [階段 1：預測前進直線方向是否會進入禁航區]
      const prediction = predictZoneIntersection(
        dronePos,
        drone.heading,
        speedMps,
        zone.center,
        zone.radiusMeters,
        45 // 45 秒預警視窗
      )

      if (prediction) {
        alerts.push({
          id: `no-fly:${drone.id}:${zone.id}`,
          type: 'no-fly-zone',
          severity: 'warning',
          stage: 'approaching',
          droneAId: drone.id,
          droneACallsign: drone.callsign,
          zoneName: zone.name,
          zoneCenter: zone.center,
          zoneRadiusMeters: zone.radiusMeters,
          currentAltitudeMeters: droneAlt,
          timeToCpaSeconds: prediction.timeToEntrySeconds,
          cpaDistanceMeters: prediction.entryDistanceMeters,
          cpaCoordinate: prediction.entryCoordinate,
          cpaAltitudeMeters: droneAlt,
          metricPrimaryTitle: '預估誤觸',
          metricPrimaryValue: `${prediction.timeToEntrySeconds}s 後`,
          metricSecondaryTitle: '距切入點',
          metricSecondaryValue: `${prediction.entryDistanceMeters}m`,
          advisoryText: `航向直線預估 ${prediction.timeToEntrySeconds} 秒後切入 ${zone.name}！請立即變更航向避開紅區`,
          timestamp: now,
        })
        break
      }
    }

    // 2. Check Restricted Yellow Zones (Proximity 爬升接近 & Breach 超高違規)
    for (const zone of MONITORED_RESTRICTED_ZONES) {
      const distToCenter = getDistanceMeters(dronePos, zone.center)
      if (distToCenter <= zone.radiusMeters) {
        if (droneAlt > zone.maxLegalAltitudeMeters + 1.0) {
          // [階段 2：超高違規 (Warning)] - 已突破 60m 上限
          const exceededMeters = Math.round((droneAlt - zone.maxLegalAltitudeMeters) * 10) / 10
          alerts.push({
            id: `altitude:${drone.id}:${zone.id}`,
            type: 'altitude-violation',
            severity: 'warning',
            stage: 'breached',
            droneAId: drone.id,
            droneACallsign: drone.callsign,
            zoneName: zone.name,
            zoneCenter: zone.center,
            zoneRadiusMeters: zone.radiusMeters,
            currentAltitudeMeters: droneAlt,
            maxLegalAltitudeMeters: zone.maxLegalAltitudeMeters,
            cpaCoordinate: [dronePos[0], dronePos[1]],
            cpaAltitudeMeters: droneAlt,
            metricPrimaryTitle: '當前高度',
            metricPrimaryValue: `${droneAlt}m`,
            metricSecondaryTitle: '超高幅度',
            metricSecondaryValue: `+${exceededMeters}m`,
            advisoryText: zone.advisoryText,
            timestamp: now,
          })
          break
        } else if (droneAlt >= 53.0 && drone.verticalRateMps > 0) {
          // [階段 1：高度接近預警 (Advisory)] - 爬升中逼近 60m 上限
          const remainingMeters = Math.round((zone.maxLegalAltitudeMeters - droneAlt) * 10) / 10
          alerts.push({
            id: `altitude:${drone.id}:${zone.id}`,
            type: 'altitude-violation',
            severity: 'advisory',
            stage: 'approaching',
            droneAId: drone.id,
            droneACallsign: drone.callsign,
            zoneName: zone.name,
            zoneCenter: zone.center,
            zoneRadiusMeters: zone.radiusMeters,
            currentAltitudeMeters: droneAlt,
            maxLegalAltitudeMeters: zone.maxLegalAltitudeMeters,
            cpaCoordinate: [dronePos[0], dronePos[1]],
            cpaAltitudeMeters: droneAlt,
            metricPrimaryTitle: '當前高度',
            metricPrimaryValue: `${droneAlt}m`,
            metricSecondaryTitle: '距上限僅',
            metricSecondaryValue: `${remainingMeters}m`,
            advisoryText: `無人機爬升中接近 ${zone.maxLegalAltitudeMeters}m 法定上限！請注意空域高度限制`,
            timestamp: now,
          })
          break
        }
      }
    }
  })

  return alerts
}
