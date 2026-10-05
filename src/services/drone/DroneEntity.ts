import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke } from 'ol/style'
import type { DroneInfo, DroneFlightStatus } from './types'
import { createDroneStyle } from './droneIcons'

function lerpAngle(fromDeg: number, toDeg: number, t: number): number {
  const diff = ((toDeg - fromDeg + 540) % 360) - 180
  return (fromDeg + diff * t + 360) % 360
}

export class DroneEntity {
  public id: string
  public callsign: string
  public remoteId: string
  public model: string
  public operator: string
  public missionType: string
  public status: DroneFlightStatus
  public altitudeAglMeters: number
  public airspaceZone?: 'yellow' | 'green'
  public maxLegalAltitudeMeters?: number
  public zoneName?: string
  public speedKmh: number
  public heading: number
  public verticalRateMps: number
  public batteryPercent: number
  public linkQuality: number
  public satellites: number
  public homeCoordinate: [number, number]
  public currentLonLat: [number, number]
  public waypoints: [number, number][]
  public trail: [number, number][] = []
  public lastSeen: number

  public pitchDeg: number = 0 // degrees (-90 to +90, nose down/up)
  public rollDeg: number = 0 // degrees (-180 to +180, bank left/right)
  public yawDeg: number = 0

  private currentHeading: number
  private targetHeading: number
  private currentWaypointIndex: number = 0
  private hoverTimer: number = 0
  private isSelected: boolean = false
  private isHovered: boolean = false
  public alertSeverity: 'clear' | 'advisory' | 'warning' | 'critical' = 'clear'

  // OpenLayers Features
  private droneFeature: Feature<Point>
  private trailFeature: Feature<LineString>
  private missionFeature: Feature<LineString>

  constructor(initialData: DroneInfo) {
    this.id = initialData.id
    this.callsign = initialData.callsign
    this.remoteId = initialData.remoteId
    this.model = initialData.model
    this.operator = initialData.operator
    this.missionType = initialData.missionType
    this.status = initialData.status
    this.altitudeAglMeters = initialData.altitudeAglMeters
    this.airspaceZone = initialData.airspaceZone || 'green'
    this.maxLegalAltitudeMeters = initialData.maxLegalAltitudeMeters || (this.airspaceZone === 'yellow' ? 60 : 120)
    this.zoneName = initialData.zoneName
    this.speedKmh = initialData.speedKmh
    this.heading = initialData.heading
    this.verticalRateMps = initialData.verticalRateMps
    this.batteryPercent = initialData.batteryPercent
    this.linkQuality = initialData.linkQuality
    this.satellites = initialData.satellites
    this.homeCoordinate = initialData.homeCoordinate
    this.waypoints = initialData.waypoints || []
    this.currentLonLat = [initialData.longitude, initialData.latitude]
    this.currentHeading = this.heading
    this.targetHeading = this.heading
    this.lastSeen = Date.now()

    this.trail.push([this.currentLonLat[0], this.currentLonLat[1]])

    // Initialize OpenLayers Features
    const projCoord = fromLonLat(this.currentLonLat)
    this.droneFeature = new Feature({
      geometry: new Point(projCoord),
      id: this.id,
      entity: this,
    })

    this.trailFeature = new Feature({
      geometry: new LineString([projCoord]),
      id: this.id,
    })

    // Mission planned corridor
    const missionCoords = this.waypoints.map((pt) => fromLonLat(pt))
    this.missionFeature = new Feature({
      geometry: new LineString(missionCoords),
      id: this.id,
    })

    this.updateStyle()
    this.updateTrailStyle()
    this.updateMissionStyle()
  }

  public getDroneFeature(): Feature<Point> {
    return this.droneFeature
  }

  public getTrailFeature(): Feature<LineString> {
    return this.trailFeature
  }

  public getMissionFeature(): Feature<LineString> {
    return this.missionFeature
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected
    this.updateStyle()
    this.updateTrailStyle()
    this.updateMissionStyle()
  }

  public setHovered(hovered: boolean): void {
    if (this.isHovered === hovered) return
    this.isHovered = hovered
    this.updateStyle()
  }

  public setAlertSeverity(severity: 'clear' | 'advisory' | 'warning' | 'critical'): void {
    if (this.alertSeverity === severity) return
    this.alertSeverity = severity
    this.updateStyle()
  }

  public getInfo(): DroneInfo {
    return {
      id: this.id,
      callsign: this.callsign,
      remoteId: this.remoteId,
      model: this.model,
      operator: this.operator,
      missionType: this.missionType,
      status: this.status,
      latitude: this.currentLonLat[1],
      longitude: this.currentLonLat[0],
      altitudeAglMeters: Math.round(this.altitudeAglMeters * 10) / 10,
      altitudeAglFeet: Math.round(this.altitudeAglMeters * 3.28084),
      airspaceZone: this.airspaceZone,
      maxLegalAltitudeMeters: this.maxLegalAltitudeMeters,
      zoneName: this.zoneName,
      speedKmh: Math.round(this.speedKmh * 10) / 10,
      heading: Math.round(this.currentHeading),
      pitchDeg: Math.round(this.pitchDeg * 10) / 10,
      rollDeg: Math.round(this.rollDeg * 10) / 10,
      yawDeg: Math.round(this.currentHeading),
      verticalRateMps: this.verticalRateMps,
      batteryPercent: Math.max(1, Math.round(this.batteryPercent)),
      linkQuality: this.linkQuality,
      satellites: this.satellites,
      homeCoordinate: this.homeCoordinate,
      waypoints: this.waypoints,
      trail: this.trail,
      lastSeen: this.lastSeen,
    }
  }

  /**
   * 60 FPS Physics & Autonomous Navigation Loop
   */
  public stepPhysics(dt: number): void {
    if (dt <= 0 || dt > 0.5) dt = 0.016
    this.lastSeen = Date.now()

    // Autonomous Waypoint Navigation
    if (this.waypoints.length > 1) {
      if (this.hoverTimer > 0) {
        this.hoverTimer -= dt
        this.status = '定點懸停'
        this.speedKmh = Math.max(0, this.speedKmh - dt * 20)
      } else {
        this.status = '任務巡檢'
        const targetWaypoint = this.waypoints[this.currentWaypointIndex]
        const dLonDeg = targetWaypoint[0] - this.currentLonLat[0]
        const dLatDeg = targetWaypoint[1] - this.currentLonLat[1]
        const latRad = (this.currentLonLat[1] * Math.PI) / 180
        const dxMeters = dLonDeg * 111320 * Math.cos(latRad)
        const dyMeters = dLatDeg * 111320
        const distMeters = Math.hypot(dxMeters, dyMeters)

        if (distMeters < 8) {
          // Arrived at waypoint: dwell/hover for 4-6 seconds to inspect
          this.hoverTimer = 4.5
          this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length
        } else {
          // Calculate heading towards target waypoint
          const targetRad = Math.atan2(dxMeters, dyMeters)
          this.targetHeading = ((targetRad * 180) / Math.PI + 360) % 360

          // Accelerate to nominal inspection speed (~32 - 45 km/h)
          const cruiseSpeed = 38
          this.speedKmh += (cruiseSpeed - this.speedKmh) * Math.min(dt * 2, 0.2)

          // Advance forward along heading
          const speedMps = (this.speedKmh * 1000) / 3600
          const forwardMeters = Math.min(speedMps * dt, distMeters)
          const moveRad = (this.currentHeading * Math.PI) / 180

          const stepDx = forwardMeters * Math.sin(moveRad)
          const stepDy = forwardMeters * Math.cos(moveRad)

          this.currentLonLat[0] += stepDx / (111320 * Math.max(Math.cos(latRad), 0.1))
          this.currentLonLat[1] += stepDy / 111320
        }
      }
    }

    // Heading change rate (turn rate) for bank angle (Roll)
    const headingDiff = ((this.targetHeading - this.currentHeading + 540) % 360) - 180
    this.currentHeading = lerpAngle(this.currentHeading, this.targetHeading, Math.min(dt * 3.5, 0.2))

    // Dynamic Drone Attitude Physics:
    // 1. Pitch: Forward acceleration & cruising tilt (multirotor tilts nose-down when moving forward, up to ~15°)
    const targetPitch = this.status === '定點懸停'
      ? (Math.sin(Date.now() / 800) * 1.2) // slight hover wind sway
      : -Math.min(18, (this.speedKmh / 45) * 12 + (Math.sin(Date.now() / 500) * 1.5))
    this.pitchDeg += (targetPitch - this.pitchDeg) * Math.min(dt * 4, 0.3)

    // 2. Roll: Bank angle proportional to turn rate (banking into turn, up to ±20°)
    const targetRoll = this.status === '定點懸停'
      ? (Math.cos(Date.now() / 900) * 1.2)
      : Math.max(-25, Math.min(25, headingDiff * 0.45))
    this.rollDeg += (targetRoll - this.rollDeg) * Math.min(dt * 4, 0.3)

    // Tiny realistic atmospheric altitude turbulence (±0.05m)
    this.altitudeAglMeters += (Math.random() - 0.5) * 0.04
    this.altitudeAglMeters = Math.max(10, Math.min(180, this.altitudeAglMeters))

    // Battery slow realistic discharge
    this.batteryPercent = Math.max(5, this.batteryPercent - (dt * 0.003))

    // Update OpenLayers Feature position
    const geom = this.droneFeature.getGeometry()
    if (geom) {
      geom.setCoordinates(fromLonLat(this.currentLonLat))
    }

    // Continuously update icon rotation (機頭動態轉向)
    this.updateStyle()

    // Append to trail
    this.appendTrailPoint([this.currentLonLat[0], this.currentLonLat[1]])
    this.updateTrailGeometry()
  }

  private appendTrailPoint(pt: [number, number]): void {
    if (this.trail.length > 0) {
      const last = this.trail[this.trail.length - 1]
      const dLon = pt[0] - last[0]
      const dLat = pt[1] - last[1]
      if (Math.abs(dLon) < 0.0001 && Math.abs(dLat) < 0.0001) return
    }
    this.trail.push(pt)
    if (this.trail.length > 80) this.trail.shift()
  }

  private updateTrailGeometry(): void {
    const geom = this.trailFeature.getGeometry()
    if (!geom) return
    if (this.trail.length > 0) {
      geom.setCoordinates(this.trail.map((p) => fromLonLat(p)))
    }
  }

  private updateStyle(): void {
    const label = `${this.callsign}\n${Math.round(this.altitudeAglMeters)}m AGL`
    this.droneFeature.setStyle(
      createDroneStyle(this.currentHeading, this.altitudeAglMeters, label, this.isSelected, this.isHovered, this.alertSeverity)
    )
  }

  private updateTrailStyle(): void {
    this.trailFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: this.isSelected ? '#06b6d4' : 'rgba(6, 182, 212, 0.55)',
          width: this.isSelected ? 2.5 : 1.8,
          lineDash: [4, 4],
        }),
      })
    )
  }

  private updateMissionStyle(): void {
    this.missionFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: this.isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.35)',
          width: this.isSelected ? 2 : 1.2,
          lineDash: [6, 4],
        }),
      })
    )
  }
}
