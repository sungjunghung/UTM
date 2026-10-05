/**
 * Drone UTM Collision Avoidance & Airspace Violation Types
 * Standard UTM / DAA (Detect and Avoid) Alert Models
 */

export type AlertType = 'collision' | 'no-fly-zone' | 'altitude-violation'
export type AlertSeverity = 'clear' | 'advisory' | 'warning' | 'critical'

export interface CollisionRisk {
  id: string // e.g. "UAV-NCHC-01:UAV-ITRI-02" or "no-fly:UAV-SURVEY-10" or "altitude:UAV-INSPECT-11"
  type?: AlertType // default 'collision'
  droneAId: string
  droneBId?: string
  droneACallsign: string
  droneBCallsign?: string
  severity: AlertSeverity

  // Real-time spatial metrics (for collision)
  currentDistanceMeters?: number
  altitudeDiffMeters?: number

  // Predictive CPA metrics (derived from real-time velocity vectors)
  timeToCpaSeconds?: number // TCPA (seconds until closest approach)
  cpaDistanceMeters?: number // DCPA (minimum predicted distance)
  cpaCoordinate: [number, number] // [lon, lat] predicted conflict or violation location
  cpaAltitudeMeters?: number

  // Airspace violation metrics (for no-fly / restricted altitude limit)
  zoneName?: string
  currentAltitudeMeters?: number
  maxLegalAltitudeMeters?: number

  // Flexible display metrics for the top alert banner
  metricPrimaryTitle?: string
  metricPrimaryValue?: string
  metricSecondaryTitle?: string
  metricSecondaryValue?: string

  // Suggested advisory action
  advisoryText: string
  timestamp: number
}
