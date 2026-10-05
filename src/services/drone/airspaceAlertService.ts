import type { DroneEntity } from './DroneEntity'
import type { CollisionRisk } from './collisionTypes'

interface MonitoredNoFlyZone {
  id: string
  name: string
  center: [number, number] // [lon, lat]
  radiusMeters: number
  description: string
  advisoryText: string
}

interface MonitoredRestrictedZone {
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

function getDistanceMeters(c1: [number, number], c2: [number, number]): number {
  const R = 6371000
  const lat1 = (c1[1] * Math.PI) / 180
  const lat2 = (c2[1] * Math.PI) / 180
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180
  const dLon = ((c2[0] - c1[0]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Real-time Geofence & Airspace Ceiling Violation Detection
 * Inspects all active drones against CAA No-Fly (Red) and Restricted (Yellow) zones.
 */
export function checkAirspaceViolations(drones: DroneEntity[]): CollisionRisk[] {
  const alerts: CollisionRisk[] = []
  const now = Date.now()

  drones.forEach((drone) => {
    const dronePos = drone.currentLonLat
    const droneAlt = Math.round(drone.altitudeAglMeters * 10) / 10

    // 1. Check No-Fly Zone Intrusions (紅區誤闖 - 嚴重 Critical)
    for (const zone of MONITORED_NO_FLY_ZONES) {
      const distToCenter = getDistanceMeters(dronePos, zone.center)
      if (distToCenter <= zone.radiusMeters) {
        alerts.push({
          id: `no-fly:${drone.id}:${zone.id}`,
          type: 'no-fly-zone',
          severity: 'critical',
          droneAId: drone.id,
          droneACallsign: drone.callsign,
          zoneName: zone.name,
          currentAltitudeMeters: droneAlt,
          cpaCoordinate: [dronePos[0], dronePos[1]],
          cpaAltitudeMeters: droneAlt,
          metricPrimaryTitle: '違規狀態',
          metricPrimaryValue: '禁航區越界',
          metricSecondaryTitle: '管制標的',
          metricSecondaryValue: zone.name,
          advisoryText: zone.advisoryText,
          timestamp: now,
        })
        break // 1 no-fly alert per drone
      }
    }

    // 2. Check Restricted Zone Altitude Violations (黃區超高 - 警戒 Warning)
    for (const zone of MONITORED_RESTRICTED_ZONES) {
      const distToCenter = getDistanceMeters(dronePos, zone.center)
      if (distToCenter <= zone.radiusMeters) {
        if (droneAlt > zone.maxLegalAltitudeMeters + 1.5) {
          const exceededMeters = Math.round((droneAlt - zone.maxLegalAltitudeMeters) * 10) / 10
          alerts.push({
            id: `altitude:${drone.id}:${zone.id}`,
            type: 'altitude-violation',
            severity: 'warning',
            droneAId: drone.id,
            droneACallsign: drone.callsign,
            zoneName: zone.name,
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
        }
      }
    }
  })

  return alerts
}
