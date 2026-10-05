import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import { Stroke, Style } from 'ol/style'
import { createAircraftStyle, getAltitudeColor } from './aircraftIcons'
import type { AircraftInfo, RawAircraftData } from './types'

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

  // Current physics coordinates [lon, lat]
  public currentLonLat: [number, number]

  // Last verified radar coordinates
  private lastRadarLonLat: [number, number]

  // Soft reconciliation offset [dLon, dLat] to smoothly absorb GPS packet drift
  private correctionOffset: [number, number] = [0, 0]

  // Flight history trail [lon, lat][]
  public trail: [number, number][] = []
  private lastTrailRecordTime: number = 0

  // OpenLayers Features
  private planeFeature: Feature<Point>
  private trailFeature: Feature<LineString>
  private projectionFeature: Feature<LineString> // Ahead heading vector line

  private isSelected: boolean = false

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
    this.lastRadarLonLat = [lon, lat]
    this.trail.push([lon, lat])
    this.lastTrailRecordTime = Date.now()

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

    // Forward projection heading vector line
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
   * Update with newly polled ADS-B packet
   */
  public updateData(data: RawAircraftData): void {
    this.lastSeen = Date.now()
    if (data.flight) this.flight = data.flight.trim()
    if (data.r) this.registration = data.r
    if (data.t) this.model = data.t
    if (data.squawk) this.squawk = data.squawk
    if (data.gs !== undefined) this.speed = data.gs
    if (data.track !== undefined) this.heading = data.track
    if (data.baro_rate !== undefined) this.verticalRate = data.baro_rate

    this.isGround = data.alt_baro === 'ground'
    if (typeof data.alt_baro === 'number') {
      this.altitude = data.alt_baro
    } else if (data.alt_geom) {
      this.altitude = data.alt_geom
    }

    if (data.lon !== undefined && data.lat !== undefined) {
      const isNewCoordinate =
        Math.abs(data.lon - this.lastRadarLonLat[0]) > 0.0001 ||
        Math.abs(data.lat - this.lastRadarLonLat[1]) > 0.0001

      if (isNewCoordinate) {
        this.lastRadarLonLat = [data.lon, data.lat]

        // Calculate discrepancy between current extrapolated position and new radar packet
        const errLon = data.lon - this.currentLonLat[0]
        const errLat = data.lat - this.currentLonLat[1]
        const errDistApproxKm = Math.sqrt(errLon * errLon + errLat * errLat) * 111

        if (errDistApproxKm > 10) {
          // Large teleport or first sync: snap directly
          this.currentLonLat = [data.lon, data.lat]
          this.correctionOffset = [0, 0]
        } else {
          // Small drift: gently blend error over the next few frames without stopping!
          this.correctionOffset = [errLon, errLat]
        }

        // Add verified radar point to trail
        this.appendTrailPoint([data.lon, data.lat])
      }
    }

    this.updateStyle()
    this.updateProjectionVector()
  }

  /**
   * Continuous 60 FPS Physics Step based on ground speed (knots) and heading (track)
   * dt: elapsed seconds since last frame (~0.016s)
   */
  public stepPhysics(dt: number): void {
    if (dt <= 0 || dt > 1.0) dt = 0.016 // safeguard against tab freeze spikes

    // 1. Move plane forward along heading if in flight
    if (!this.isGround && this.speed > 15) {
      const distMeters = this.speed * 0.514444 * dt
      const rad = (this.heading * Math.PI) / 180
      const dLat = (distMeters * Math.cos(rad)) / 111320
      const latRad = (this.currentLonLat[1] * Math.PI) / 180
      const dLon = (distMeters * Math.sin(rad)) / (111320 * Math.max(Math.cos(latRad), 0.1))

      this.currentLonLat[0] += dLon
      this.currentLonLat[1] += dLat
    }

    // 2. Gently absorb soft radar packet correction offset (Kalman-style smoothing)
    if (Math.abs(this.correctionOffset[0]) > 0.00001 || Math.abs(this.correctionOffset[1]) > 0.00001) {
      const blendRate = Math.min(dt * 0.8, 0.15)
      const stepLon = this.correctionOffset[0] * blendRate
      const stepLat = this.correctionOffset[1] * blendRate

      this.currentLonLat[0] += stepLon
      this.currentLonLat[1] += stepLat
      this.correctionOffset[0] -= stepLon
      this.correctionOffset[1] -= stepLat
    }

    // 3. Update OpenLayers plane marker position
    const geom = this.planeFeature.getGeometry()
    if (geom) {
      geom.setCoordinates(fromLonLat(this.currentLonLat))
    }

    // 4. Record continuous trail point every 1.5 seconds while moving
    const now = Date.now()
    if (now - this.lastTrailRecordTime > 1500 && this.speed > 25) {
      this.lastTrailRecordTime = now
      this.appendTrailPoint([...this.currentLonLat])
    }

    // 5. Update heading vector line (projected forward route)
    this.updateProjectionVector()
  }

  private appendTrailPoint(pt: [number, number]): void {
    this.trail.push(pt)
    if (this.trail.length > 40) {
      this.trail.shift()
    }
    this.updateTrailGeometry()
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected
    this.updateStyle()
    this.updateTrailStyle()
    this.updateProjectionVector()
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
      heading: this.heading,
      verticalRate: this.verticalRate,
      squawk: this.squawk,
      trail: this.trail,
      lastSeen: this.lastSeen,
    }
  }

  private updateStyle(): void {
    const label = `${this.flight}\n${this.isGround ? 'GND' : `${Math.round(this.altitude / 100)}FL`}`
    this.planeFeature.setStyle(
      createAircraftStyle(this.heading, this.altitude, this.isGround, label, this.isSelected)
    )
  }

  private updateTrailGeometry(): void {
    const geom = this.trailFeature.getGeometry()
    if (geom && this.trail.length > 1) {
      // Connect trail up to current real-time plane position
      const points = [...this.trail, this.currentLonLat]
      const projected = points.map((pt) => fromLonLat(pt))
      geom.setCoordinates(projected)
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

    if (!this.isSelected || this.isGround || this.speed < 30) {
      geom.setCoordinates([])
      return
    }

    // Project 25 nautical miles (~46.3 km) in the direction of flight
    const aheadMeters = 46300
    const rad = (this.heading * Math.PI) / 180
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
