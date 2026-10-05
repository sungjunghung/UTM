import type { DroneEntity } from './DroneEntity'
import type { CollisionRisk, AlertSeverity } from './collisionTypes'

const METERS_PER_DEGREE_LAT = 111139
const DEG_TO_RAD = Math.PI / 180

/**
 * Calculates predictive CPA (Closest Point of Approach) between two moving drones
 * using real-time spatial coordinates and 3D velocity vectors.
 */
export function calculateCpaRisk(
  a: DroneEntity,
  b: DroneEntity,
  predictionHorizonSeconds: number = 30
): CollisionRisk | null {
  const avgLat = ((a.currentLonLat[1] + b.currentLonLat[1]) / 2) * DEG_TO_RAD
  const metersPerDegLon = METERS_PER_DEGREE_LAT * Math.cos(avgLat)

  // Relative position in meters: (dx, dy)
  const dx = (b.currentLonLat[0] - a.currentLonLat[0]) * metersPerDegLon
  const dy = (b.currentLonLat[1] - a.currentLonLat[1]) * METERS_PER_DEGREE_LAT
  const currentHorizontalDist = Math.sqrt(dx * dx + dy * dy)
  const altitudeDiff = Math.abs(a.altitudeAglMeters - b.altitudeAglMeters)

  // Current velocity vectors in m/s (from speedKmh & heading degrees)
  // heading: 0 = North (dy > 0), 90 = East (dx > 0)
  const vA_mps = (a.speedKmh * 1000) / 3600
  const vB_mps = (b.speedKmh * 1000) / 3600

  const hARad = a.heading * DEG_TO_RAD
  const hBRad = b.heading * DEG_TO_RAD

  const vAx = vA_mps * Math.sin(hARad)
  const vAy = vA_mps * Math.cos(hARad)

  const vBx = vB_mps * Math.sin(hBRad)
  const vBy = vB_mps * Math.cos(hBRad)

  // Relative velocity vector (dvx, dvy) from A to B: V_rel = V_b - V_a
  const dvx = vBx - vAx
  const dvy = vBy - vAy
  const relSpeedSq = dvx * dvx + dvy * dvy

  let tcpa = 0 // Time to CPA in seconds
  let dcpa = currentHorizontalDist // Distance at CPA in meters

  if (relSpeedSq > 0.01) {
    // tcpa = - (r · v_rel) / |v_rel|^2
    // Where r = [dx, dy] is vector from A to B
    tcpa = -(dx * dvx + dy * dvy) / relSpeedSq
  }

  // If drones are moving apart (tcpa <= 0) and current distance is safe, no immediate CPA risk
  if (tcpa <= 0) {
    // If they are already dangerously close right now
    if (currentHorizontalDist < 50 && altitudeDiff < 25) {
      tcpa = 0
      dcpa = currentHorizontalDist
    } else {
      return null
    }
  } else if (tcpa > predictionHorizonSeconds) {
    // Too far in the future
    return null
  } else {
    // Predicted position offset at tcpa
    const cpaX = dx + dvx * tcpa
    const cpaY = dy + dvy * tcpa
    dcpa = Math.sqrt(cpaX * cpaX + cpaY * cpaY)
  }

  // Classification of collision alert severity based on CPA distance & time
  let severity: AlertSeverity = 'clear'
  let advisoryText = ''

  // Vertical separation check (drones can pass safely if vertical separation > 30m)
  const verticalSafe = altitudeDiff > 30

  if (!verticalSafe) {
    if (dcpa < 25 && tcpa < 8) {
      severity = 'critical'
      advisoryText = `🔴 緊急碰撞危險！預估 ${Math.round(tcpa)} 秒內最近距離 ${Math.round(dcpa)}m！建議 ${a.callsign} 爬升避讓，${b.callsign} 減速懸停！`
    } else if (dcpa < 50 && tcpa < 16) {
      severity = 'warning'
      advisoryText = `🟠 碰撞警戒！預計 ${Math.round(tcpa)} 秒後交叉接近（距離 ${Math.round(dcpa)}m），請飛手注意避讓`
    } else if (dcpa < 90 && tcpa < 30) {
      severity = 'advisory'
      advisoryText = `🟡 空域注意：預估 ${Math.round(tcpa)} 秒後航跡接近（預估間隔 ${Math.round(dcpa)}m）`
    }
  } else if (dcpa < 30 && tcpa < 15) {
    // Horizontal conflict, but with vertical clearance
    severity = 'advisory'
    advisoryText = `ℹ️ 立體交會：預估 ${Math.round(tcpa)} 秒後水平交會，高度差 ${Math.round(altitudeDiff)}m（安全立體分離）`
  }

  if (severity === 'clear') return null

  // Calculate predicted conflict GPS coordinate
  // At tcpa, Drone A will be at current + V_a * tcpa
  const conflictLon = a.currentLonLat[0] + (vAx * tcpa) / metersPerDegLon
  const conflictLat = a.currentLonLat[1] + (vAy * tcpa) / METERS_PER_DEGREE_LAT
  const cpaAlt = (a.altitudeAglMeters + b.altitudeAglMeters) / 2

  const sortedIds = [a.id, b.id].sort()
  const riskId = `${sortedIds[0]}:${sortedIds[1]}`

  return {
    id: riskId,
    droneAId: a.id,
    droneBId: b.id,
    droneACallsign: a.callsign,
    droneBCallsign: b.callsign,
    severity,
    currentDistanceMeters: Math.round(currentHorizontalDist),
    altitudeDiffMeters: Math.round(altitudeDiff),
    timeToCpaSeconds: Math.round(tcpa * 10) / 10,
    cpaDistanceMeters: Math.round(dcpa * 10) / 10,
    cpaCoordinate: [conflictLon, conflictLat],
    cpaAltitudeMeters: Math.round(cpaAlt),
    advisoryText,
    timestamp: Date.now(),
  }
}
