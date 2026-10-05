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
  public speed: number
  public heading: number
  public verticalRate: number
  public squawk: string
  public lastSeen: number

  // Coordinates [lon, lat]
  public currentLonLat: [number, number]
  public startLonLat: [number, number]
  public targetLonLat: [number, number]
  public trail: [number, number][] = []

  // OpenLayers Features
  private planeFeature: Feature<Point>
  private trailFeature: Feature<LineString>

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
    this.startLonLat = [lon, lat]
    this.targetLonLat = [lon, lat]
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

    this.updateStyle()
    this.updateTrailStyle()
  }

  public getPlaneFeature(): Feature<Point> {
    return this.planeFeature
  }

  public getTrailFeature(): Feature<LineString> {
    return this.trailFeature
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
      this.startLonLat = [...this.currentLonLat]
      this.targetLonLat = [data.lon, data.lat]

      // Append to trail (keep max 30 points)
      this.trail.push([data.lon, data.lat])
      if (this.trail.length > 30) {
        this.trail.shift()
      }
      this.updateTrailGeometry()
    }

    this.updateStyle()
  }

  /**
   * Linear interpolation step (0.0 <= progress <= 1.0) for smooth gliding
   */
  public stepInterpolation(progress: number): void {
    const clamped = Math.min(Math.max(progress, 0), 1)
    const lon = this.startLonLat[0] + (this.targetLonLat[0] - this.startLonLat[0]) * clamped
    const lat = this.startLonLat[1] + (this.targetLonLat[1] - this.startLonLat[1]) * clamped
    this.currentLonLat = [lon, lat]

    // Update geometry point
    const geom = this.planeFeature.getGeometry()
    if (geom) {
      geom.setCoordinates(fromLonLat([lon, lat]))
    }
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected
    this.updateStyle()
    this.updateTrailStyle()
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
      const projected = this.trail.map((pt) => fromLonLat(pt))
      geom.setCoordinates(projected)
    }
  }

  private updateTrailStyle(): void {
    const color = this.isSelected ? '#ec4899' : getAltitudeColor(this.altitude, this.isGround)
    this.trailFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: this.isSelected ? 'rgba(236, 72, 153, 0.8)' : `${color}88`,
          width: this.isSelected ? 3 : 2,
          lineDash: [4, 4],
        }),
      })
    )
  }
}
