import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import { Stroke, Style } from 'ol/style'
import { createAircraftStyle, getAltitudeColor } from './aircraftIcons'
import type { AircraftInfo, RawAircraftData } from './types'

/**
 * Shortest angular distance interpolation (handles 359° <-> 1° wrapping)
 */
function lerpAngle(fromDeg: number, toDeg: number, t: number): number {
  const diff = ((toDeg - fromDeg + 540) % 360) - 180
  return (fromDeg + diff * t + 360) % 360
}

export class AircraftEntity {
  public hex: string
  public flight: string
  public registration: string
  public model: string
  public altitude: number
  public isGround: boolean
  public speed: number // knots
  public heading: number // degrees (0-360)
  public verticalRate: number // ft/min
  public squawk: string
  public lastSeen: number

  // Live coordinates on screen [lon, lat]
  public currentLonLat: [number, number]

  // Soft reconciliation offset [dLon, dLat] to smoothly absorb GPS packet discrepancy
  private correctionOffset: [number, number] = [0, 0]

  // Animated heading & rotation
  private currentHeading: number
  private targetHeading: number
  private lastRenderedHeading: number

  // Verified GPS/radar flight trail [lon, lat][]
  public trail: [number, number][] = []

  // OpenLayers Features
  private planeFeature: Feature<Point>
  private trailFeature: Feature<LineString>
  private projectionFeature: Feature<LineString>

  private isSelected: boolean = false
  private isHovered: boolean = false

  constructor(data: RawAircraftData) {
    this.hex = data.hex
    this.flight = (data.flight || '').trim() || data.hex.toUpperCase()
    this.registration = data.r || 'N/A'
    this.model = data.t || 'Unknown'
    this.isGround = data.alt_baro === 'ground'
    this.altitude = typeof data.alt_baro === 'number' ? data.alt_baro : data.alt_geom || 0
    this.speed = data.gs || 0
    this.heading = data.track || 0
    this.verticalRate = data.baro_rate || 0
    this.squawk = data.squawk || '----'
    this.lastSeen = Date.now()

    const lon = data.lon || 0
    const lat = data.lat || 0
    this.currentLonLat = [lon, lat]
    this.correctionOffset = [0, 0]
    this.currentHeading = this.heading
    this.targetHeading = this.heading
    this.lastRenderedHeading = this.heading

    // Add initial verified point to trail
    this.trail.push([lon, lat])

    // Initialize OpenLayers Features
    const projCoord = fromLonLat([lon, lat])
    this.planeFeature = new Feature({
      geometry: new Point(projCoord),
      hex: this.hex,
      entity: this,
    })

    this.trailFeature = new Feature({
      geometry: new LineString([projCoord]),
      hex: this.hex,
    })

    this.projectionFeature = new Feature({
      geometry: new LineString([projCoord, projCoord]),
      hex: this.hex,
    })

    this.updateStyle()
    this.updateTrailStyle()
    this.updateProjectionVector()
  }

  public getPlaneFeature(): Feature<Point> {
    return this.planeFeature
  }

  public getTrailFeature(): Feature<LineString> {
    return this.trailFeature
  }

  public getProjectionFeature(): Feature<LineString> {
    return this.projectionFeature
  }

  /**
   * Update entity when a new verified radar packet arrives from ADS-B API
   */
  public updateData(data: RawAircraftData): void {
    this.lastSeen = Date.now()
    if (data.flight) this.flight = data.flight.trim()
    if (data.r) this.registration = data.r
    if (data.t) this.model = data.t
    if (data.squawk) this.squawk = data.squawk
    if (data.gs !== undefined) this.speed = data.gs
    if (data.baro_rate !== undefined) this.verticalRate = data.baro_rate

    this.isGround = data.alt_baro === 'ground'
    if (typeof data.alt_baro === 'number') {
      this.altitude = data.alt_baro
    } else if (data.alt_geom) {
      this.altitude = data.alt_geom
    }

    if (data.lon !== undefined && data.lat !== undefined && (data.lon !== 0 || data.lat !== 0)) {
      const errLon = data.lon - this.currentLonLat[0]
      const errLat = data.lat - this.currentLonLat[1]
      const distApproxKm = Math.sqrt(errLon * errLon + errLat * errLat) * 111

      // 1. Update heading
      if (data.track !== undefined) {
        this.heading = data.track
        this.targetHeading = data.track
      } else if (distApproxKm > 0.05) {
        const rad = Math.atan2(
          errLon * Math.cos((data.lat * Math.PI) / 180),
          errLat
        )
        const computedTrack = ((rad * 180) / Math.PI + 360) % 360
        this.heading = computedTrack
        this.targetHeading = computedTrack
      }

      // 2. Append verified position to trail (if moved > 30 meters)
      if (distApproxKm > 0.03) {
        this.appendTrailPoint([data.lon, data.lat])
      }

      // 3. Smooth error reconciliation
      if (distApproxKm > 40) {
        // Large jump / signal re-acquisition: snap directly
        this.currentLonLat = [data.lon, data.lat]
        this.correctionOffset = [0, 0]
      } else {
        // Gently blend discrepancy into forward flight over ~1.5s
        this.correctionOffset = [errLon, errLat]
      }
    }

    this.updateStyle()
    this.updateProjectionVector()
  }

  /**
   * 60 FPS Physics & Motion Controller
   * Runs EVERY frame. Planes continuously glide forward at speed & heading.
   */
  public stepPhysics(dt: number): void {
    if (dt <= 0 || dt > 1.0) dt = 0.016

    // 1. Continuous Forward Flight:
    // Move along current heading at reported speed (knots)
    // 1 knot = 0.514444 m/s. Works for drones, helicopters, and jets.
    if (!this.isGround && this.speed > 2) {
      const distMeters = this.speed * 0.514444 * dt
      const rad = (this.currentHeading * Math.PI) / 180
      const dLat = (distMeters * Math.cos(rad)) / 111320
      const latRad = (this.currentLonLat[1] * Math.PI) / 180
      const dLon = (distMeters * Math.sin(rad)) / (111320 * Math.max(Math.cos(latRad), 0.1))

      this.currentLonLat[0] += dLon
      this.currentLonLat[1] += dLat
    }

    // 2. Soft Error Reconciliation:
    // Gently absorbs the residual GPS discrepancy without pulling backwards
    if (Math.abs(this.correctionOffset[0]) > 0.000001 || Math.abs(this.correctionOffset[1]) > 0.000001) {
      const blendRate = Math.min(dt * 1.5, 0.2)
      const stepLon = this.correctionOffset[0] * blendRate
      const stepLat = this.correctionOffset[1] * blendRate

      this.currentLonLat[0] += stepLon
      this.currentLonLat[1] += stepLat
      this.correctionOffset[0] -= stepLon
      this.correctionOffset[1] -= stepLat
    }

    // 3. Smooth Heading Rotation
    this.currentHeading = lerpAngle(this.currentHeading, this.targetHeading, Math.min(dt * 5, 0.2))

    // 4. Update OpenLayers plane marker position
    const geom = this.planeFeature.getGeometry()
    if (geom) {
      geom.setCoordinates(fromLonLat(this.currentLonLat))
    }

    // 5. Update visual style if heading rotated by > 1.2 degrees
    if (Math.abs(this.currentHeading - this.lastRenderedHeading) > 1.2) {
      this.lastRenderedHeading = this.currentHeading
      this.updateStyle()
    }

    // 6. Update real-time flight trail geometry (verified history + current live position)
    this.updateTrailGeometry()

    // 7. Update forward heading projection line
    if (this.isSelected) {
      this.updateProjectionVector()
    }
  }

  private appendTrailPoint(pt: [number, number]): void {
    if (this.trail.length > 0) {
      const last = this.trail[this.trail.length - 1]
      const dLon = pt[0] - last[0]
      const dLat = pt[1] - last[1]
      // Skip if closer than ~30 meters to avoid duplicate clustering
      if (Math.abs(dLon) < 0.0003 && Math.abs(dLat) < 0.0003) {
        return
      }
    }
    this.trail.push(pt)
    if (this.trail.length > 100) {
      this.trail.shift()
    }
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected
    this.updateStyle()
    this.updateTrailStyle()
    this.updateProjectionVector()
  }

  public setHovered(hovered: boolean): void {
    if (this.isHovered === hovered) return
    this.isHovered = hovered
    this.updateStyle()
  }

  public getIsHovered(): boolean {
    return this.isHovered
  }

  public getInfo(): AircraftInfo {
    return {
      hex: this.hex,
      flight: this.flight,
      registration: this.registration,
      model: this.model,
      latitude: this.currentLonLat[1],
      longitude: this.currentLonLat[0],
      altitude: this.altitude,
      isGround: this.isGround,
      speed: this.speed,
      heading: Math.round(this.currentHeading),
      verticalRate: this.verticalRate,
      squawk: this.squawk,
      trail: this.trail,
      lastSeen: this.lastSeen,
    }
  }

  private updateStyle(): void {
    const label = `${this.flight}\n${this.isGround ? 'GND' : `${Math.round(this.altitude / 100)}FL`}`
    this.planeFeature.setStyle(
      createAircraftStyle(this.currentHeading, this.altitude, this.isGround, label, this.isSelected, this.isHovered)
    )
  }

  private updateTrailGeometry(): void {
    const geom = this.trailFeature.getGeometry()
    if (!geom) return
    if (this.trail.length > 0) {
      // Connect verified historical points + current real-time plane position
      const points = [...this.trail, this.currentLonLat]
      geom.setCoordinates(points.map((pt) => fromLonLat(pt)))
    } else {
      geom.setCoordinates([])
    }
  }

  private updateTrailStyle(): void {
    const color = this.isSelected ? '#f43f5e' : getAltitudeColor(this.altitude, this.isGround)
    this.trailFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: this.isSelected ? '#f43f5e' : `${color}cc`,
          width: this.isSelected ? 3.5 : 2.5,
          lineDash: this.isSelected ? undefined : [6, 4],
        }),
      })
    )
  }

  /**
   * Compute forward projected heading vector (Ahead route line)
   * Projects 25 nautical miles forward along heading
   */
  private updateProjectionVector(): void {
    const geom = this.projectionFeature.getGeometry()
    if (!geom) return

    if (!this.isSelected || this.isGround || this.speed < 20) {
      geom.setCoordinates([])
      return
    }

    // Project 25 nautical miles (~46.3 km) in the direction of flight
    const aheadMeters = 46300
    const rad = (this.currentHeading * Math.PI) / 180
    const dLat = (aheadMeters * Math.cos(rad)) / 111320
    const latRad = (this.currentLonLat[1] * Math.PI) / 180
    const dLon = (aheadMeters * Math.sin(rad)) / (111320 * Math.max(Math.cos(latRad), 0.1))

    const pStart = fromLonLat(this.currentLonLat)
    const pEnd = fromLonLat([this.currentLonLat[0] + dLon, this.currentLonLat[1] + dLat])

    geom.setCoordinates([pStart, pEnd])

    this.projectionFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#38bdf8',
          width: 2.5,
          lineDash: [8, 6],
        }),
      })
    )
  }
}
