/**
 * Drone Collision Avoidance & CPA (Closest Point of Approach) Types
 * Standard UTM / DAA (Detect and Avoid) Collision Alert Models
 */

export type AlertSeverity = 'clear' | 'advisory' | 'warning' | 'critical'

export interface CollisionRisk {
  id: string // e.g. "UAV-NCHC-01:UAV-ITRI-02"
  droneAId: string
  droneBId: string
  droneACallsign: string
  droneBCallsign: string
  severity: AlertSeverity

  // Real-time spatial metrics
  currentDistanceMeters: number
  altitudeDiffMeters: number

  // Predictive CPA metrics (derived from real-time velocity vectors)
  timeToCpaSeconds: number // TCPA (seconds until closest approach)
  cpaDistanceMeters: number // DCPA (minimum predicted distance)
  cpaCoordinate: [number, number] // [lon, lat] predicted conflict location
  cpaAltitudeMeters: number

  // Suggested advisory action
  advisoryText: string
  timestamp: number
}
