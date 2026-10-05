import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type OlMap from 'ol/Map'
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom'
import { fromLonLat } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'
import { AircraftEntity } from './AircraftEntity'
import type { AdsbResponse, AircraftInfo } from './types'

export interface AircraftManagerOptions {
  centerLat?: number
  centerLon?: number
  radiusNm?: number // nautical miles
  pollIntervalMs?: number
  showTrails?: boolean
}

export class AircraftManager {
  private map: OlMap | null = null
  private aircraftMap: globalThis.Map<string, AircraftEntity> = new globalThis.Map()

  // OpenLayers Vector Layers
  private planeSource: VectorSource = new VectorSource()
  private planeLayer: VectorLayer<VectorSource>

  private trailSource: VectorSource = new VectorSource()
  private trailLayer: VectorLayer<VectorSource>

  private projectionSource: VectorSource = new VectorSource()
  private projectionLayer: VectorLayer<VectorSource>

  // Configuration
  private centerLat: number
  private centerLon: number
  private radiusNm: number
  private pollIntervalMs: number
  private showTrails: boolean = true

  // State
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private animationFrameId: number | null = null
  private lastFrameTimestamp: number = performance.now()
  private isPolling: boolean = false
  private selectedHex: string | null = null
  private followSelected: boolean = false
  private hoveredHex: string | null = null
  private singleClickKey: EventsKey | null = null
  private pointerMoveKey: EventsKey | null = null

  // Callbacks
  private updateCallbacks: Set<(list: AircraftInfo[]) => void> = new Set()
  private selectCallbacks: Set<(info: AircraftInfo | null) => void> = new Set()
  private followChangeCallbacks: Set<(following: boolean) => void> = new Set()
  private loadingCallbacks: Set<(loading: boolean) => void> = new Set()
  private errorCallbacks: Set<(err: string | null) => void> = new Set()

  constructor(options: AircraftManagerOptions = {}) {
    this.centerLat = options.centerLat ?? 24.7887 // NCHC Taiwan
    this.centerLon = options.centerLon ?? 121.0028
    this.radiusNm = options.radiusNm ?? 120
    this.pollIntervalMs = options.pollIntervalMs ?? 5000
    this.showTrails = options.showTrails ?? true

    // Initialize layers
    this.trailLayer = new VectorLayer({
      source: this.trailSource,
      zIndex: 15,
      visible: this.showTrails,
    })

    this.projectionLayer = new VectorLayer({
      source: this.projectionSource,
      zIndex: 20,
    })

    this.planeLayer = new VectorLayer({
      source: this.planeSource,
      zIndex: 30,
    })
  }

  /**
   * Attach AircraftManager layers to OpenLayers Map
   */
  public attachToMap(map: OlMap): void {
    this.map = map
    this.map.addLayer(this.trailLayer)
    this.map.addLayer(this.projectionLayer)
    this.map.addLayer(this.planeLayer)

    // Listen to map click on aircraft
    this.singleClickKey = this.map.on('singleclick', (evt) => {
      let clickedHex: string | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.planeLayer) {
            const hex = feature.get('hex')
            if (hex) {
              clickedHex = hex
              return true
            }
          }
        },
        { hitTolerance: 8 }
      )

      if (clickedHex) {
        this.selectAircraft(clickedHex)
      }
    })

    // Listen to pointer move over aircraft for visual hover
    this.pointerMoveKey = this.map.on('pointermove', (evt) => {
      if (evt.dragging) {
        this.clearHover()
        return
      }

      let foundHex: string | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.planeLayer) {
            const hex = feature.get('hex')
            if (hex) {
              foundHex = hex
              return true
            }
          }
        },
        { hitTolerance: 8 }
      )

      if (foundHex !== this.hoveredHex) {
        if (this.hoveredHex) {
          const prev = this.aircraftMap.get(this.hoveredHex)
          prev?.setHovered(false)
        }
        this.hoveredHex = foundHex
        if (this.hoveredHex) {
          const next = this.aircraftMap.get(this.hoveredHex)
          next?.setHovered(true)
        }
      }
    })

    // Page visibility listener: stop polling when tab is hidden
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // Start background polling & 60fps velocity animation loop
    this.start()
  }

  public clearHover(): void {
    if (this.hoveredHex) {
      const prev = this.aircraftMap.get(this.hoveredHex)
      prev?.setHovered(false)
      this.hoveredHex = null
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop()
    } else {
      this.start()
    }
  }

  public start(): void {
    if (this.isPolling) return
    this.isPolling = true

    // Fetch immediately
    this.fetchData()

    // Interval fetch
    this.pollTimer = setInterval(() => {
      this.fetchData()
    }, this.pollIntervalMs)

    // Start continuous 60fps velocity physics loop
    this.startAnimationLoop()
  }

  public stop(): void {
    this.isPolling = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private isFetching: boolean = false
  private cooldownUntil: number = 0

  private async fetchData(): Promise<void> {
    if (this.isFetching) return
    if (Date.now() < this.cooldownUntil) return

    this.isFetching = true
    this.notifyLoading(true)

    try {
      const endpoint = `/api/adsb/v2/point/${this.centerLat}/${this.centerLon}/${this.radiusNm}`
      const response = await fetch(endpoint)
      if (response.status === 429) {
        this.cooldownUntil = Date.now() + 5000
        return
      }
      if (!response.ok) {
        throw new Error(`ADS-B API returned HTTP ${response.status}`)
      }
      const data: AdsbResponse = await response.json()
      const aircrafts = data.ac || []

      this.notifyError(null)
      this.processData(aircrafts)
    } catch (err: any) {
      this.notifyError(err.message || '無法取得飛機即時數據')
    } finally {
      this.isFetching = false
      this.notifyLoading(false)
    }
  }

  private processData(rawList: any[]): void {
    const activeHexes = new Set<string>()

    rawList.forEach((raw) => {
      if (!raw.hex || raw.lat === undefined || raw.lon === undefined) return
      activeHexes.add(raw.hex)

      if (this.aircraftMap.has(raw.hex)) {
        // Update existing entity
        const entity = this.aircraftMap.get(raw.hex)!
        entity.updateData(raw)
      } else {
        // Create new entity
        const entity = new AircraftEntity(raw)
        this.aircraftMap.set(raw.hex, entity)
        this.planeSource.addFeature(entity.getPlaneFeature())
        this.trailSource.addFeature(entity.getTrailFeature())
        this.projectionSource.addFeature(entity.getProjectionFeature())
      }
    })

    // Remove stale planes not seen in 60s
    const now = Date.now()
    this.aircraftMap.forEach((entity, hex) => {
      if (!activeHexes.has(hex) && now - entity.lastSeen > 60000) {
        this.planeSource.removeFeature(entity.getPlaneFeature())
        this.trailSource.removeFeature(entity.getTrailFeature())
        this.projectionSource.removeFeature(entity.getProjectionFeature())
        this.aircraftMap.delete(hex)
        if (this.hoveredHex === hex) {
          this.hoveredHex = null
        }
        if (this.selectedHex === hex) {
          this.selectAircraft(null)
        }
      }
    })

    this.notifyUpdate()
  }

  /**
   * Continuous 60 FPS velocity physics loop
   * Uses real delta time so aircraft glide smoothly across the screen without stopping
   */
  private startAnimationLoop(): void {
    this.lastFrameTimestamp = performance.now()

    const loop = (currentTimestamp: number) => {
      if (!this.isPolling) return
      const dt = Math.min((currentTimestamp - this.lastFrameTimestamp) / 1000, 0.1)
      this.lastFrameTimestamp = currentTimestamp

      // Advance physics position of every aircraft by velocity * dt
      this.aircraftMap.forEach((entity) => {
        entity.stepPhysics(dt)
      })

      // Request OpenLayers map canvas to render every animation frame!
      this.map?.render()

      // Auto-follow selected flight if enabled
      if (this.selectedHex && this.followSelected && this.map) {
        const selectedEntity = this.aircraftMap.get(this.selectedHex)
        if (selectedEntity) {
          const view = this.map.getView()

          // 1. If user is manually dragging/panning the map, gracefully release follow lock
          if (view.getInteracting()) {
            this.setFollowSelected(false)
          } else if (!view.getAnimating()) {
            // 2. Only update center when NOT in the middle of a wheel zoom animation
            // This allows mouse wheel zooming to execute completely smoothly!
            view.setCenter(fromLonLat(selectedEntity.currentLonLat))
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(loop)
    }

    this.animationFrameId = requestAnimationFrame(loop)
  }

  // --- Public Controls ---

  public selectAircraft(hex: string | null): void {
    if (this.selectedHex === hex) return

    // Deselect previous
    if (this.selectedHex && this.aircraftMap.has(this.selectedHex)) {
      this.aircraftMap.get(this.selectedHex)!.setSelected(false)
    }

    this.selectedHex = hex

    // If deselecting, release follow mode
    if (!hex) {
      this.setFollowSelected(false)
    }

    // Select new
    let info: AircraftInfo | null = null
    if (hex && this.aircraftMap.has(hex)) {
      const entity = this.aircraftMap.get(hex)!
      entity.setSelected(true)
      info = entity.getInfo()

      // Center map smoothly onto selected aircraft
      if (this.map) {
        this.map.getView().animate({
          center: fromLonLat(entity.currentLonLat),
          duration: 400,
        })
      }
    }

    this.notifySelect(info)
  }

  public setFollowSelected(follow: boolean): void {
    if (this.followSelected === follow) return
    this.followSelected = follow
    this.notifyFollowChange(follow)
    this.updateMouseWheelAnchor()
  }

  private updateMouseWheelAnchor(): void {
    if (!this.map) return
    this.map.getInteractions().forEach((interaction) => {
      if (interaction instanceof MouseWheelZoom) {
        // When following airplane, zoom centered on the airplane (useAnchor: false)
        // When not following, zoom towards mouse cursor position (useAnchor: true)
        interaction.setMouseAnchor(!this.followSelected)
      }
    })
  }

  public isFollowingSelected(): boolean {
    return this.followSelected
  }

  public onFollowChange(cb: (following: boolean) => void): () => void {
    this.followChangeCallbacks.add(cb)
    return () => this.followChangeCallbacks.delete(cb)
  }

  private notifyFollowChange(following: boolean): void {
    this.followChangeCallbacks.forEach((cb) => cb(following))
  }

  public toggleTrails(show: boolean): void {
    this.showTrails = show
    this.trailLayer.setVisible(show)
  }

  public getTrailsVisible(): boolean {
    return this.showTrails
  }

  public getAircraftList(): AircraftInfo[] {
    return Array.from(this.aircraftMap.values()).map((e) => e.getInfo())
  }

  public getSelectedAircraft(): AircraftInfo | null {
    if (!this.selectedHex || !this.aircraftMap.has(this.selectedHex)) return null
    return this.aircraftMap.get(this.selectedHex)!.getInfo()
  }

  // --- Event Subscriptions ---

  public onUpdate(cb: (list: AircraftInfo[]) => void): () => void {
    this.updateCallbacks.add(cb)
    return () => this.updateCallbacks.delete(cb)
  }

  public onSelect(cb: (info: AircraftInfo | null) => void): () => void {
    this.selectCallbacks.add(cb)
    return () => this.selectCallbacks.delete(cb)
  }

  public onLoading(cb: (loading: boolean) => void): () => void {
    this.loadingCallbacks.add(cb)
    return () => this.loadingCallbacks.delete(cb)
  }

  public onError(cb: (err: string | null) => void): () => void {
    this.errorCallbacks.add(cb)
    return () => this.errorCallbacks.delete(cb)
  }

  private notifyUpdate(): void {
    const list = this.getAircraftList()
    this.updateCallbacks.forEach((cb) => cb(list))
  }

  private notifySelect(info: AircraftInfo | null): void {
    this.selectCallbacks.forEach((cb) => cb(info))
  }

  private notifyLoading(loading: boolean): void {
    this.loadingCallbacks.forEach((cb) => cb(loading))
  }

  private notifyError(err: string | null): void {
    this.errorCallbacks.forEach((cb) => cb(err))
  }

  public destroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.clearHover()
    if (this.singleClickKey) {
      unByKey(this.singleClickKey)
      this.singleClickKey = null
    }
    if (this.pointerMoveKey) {
      unByKey(this.pointerMoveKey)
      this.pointerMoveKey = null
    }
    this.stop()
    this.updateCallbacks.clear()
    this.selectCallbacks.clear()
    this.loadingCallbacks.clear()
    this.errorCallbacks.clear()

    if (this.map) {
      this.map.removeLayer(this.planeLayer)
      this.map.removeLayer(this.projectionLayer)
      this.map.removeLayer(this.trailLayer)
      this.map = null
    }

    this.planeSource.clear()
    this.projectionSource.clear()
    this.trailSource.clear()
    this.aircraftMap.clear()
  }
}
