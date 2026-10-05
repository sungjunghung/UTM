import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type OlMap from 'ol/Map'
import { fromLonLat } from 'ol/proj'
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

  // Configuration
  private centerLat: number
  private centerLon: number
  private radiusNm: number
  private pollIntervalMs: number
  private showTrails: boolean = true

  // State
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private animationFrameId: number | null = null
  private animationStartTime: number = Date.now()
  private isPolling: boolean = false
  private selectedHex: string | null = null
  private followSelected: boolean = false

  // Callbacks
  private updateCallbacks: Set<(list: AircraftInfo[]) => void> = new Set()
  private selectCallbacks: Set<(info: AircraftInfo | null) => void> = new Set()
  private loadingCallbacks: Set<(loading: boolean) => void> = new Set()
  private errorCallbacks: Set<(err: string | null) => void> = new Set()

  constructor(options: AircraftManagerOptions = {}) {
    this.centerLat = options.centerLat ?? 23.838 // Center Taiwan
    this.centerLon = options.centerLon ?? 120.982
    this.radiusNm = options.radiusNm ?? 250
    this.pollIntervalMs = options.pollIntervalMs ?? 5000
    this.showTrails = options.showTrails ?? true

    // Initialize layers
    this.trailLayer = new VectorLayer({
      source: this.trailSource,
      zIndex: 15,
      visible: this.showTrails,
    })

    this.planeLayer = new VectorLayer({
      source: this.planeSource,
      zIndex: 25,
    })
  }

  /**
   * Attach AircraftManager layers to OpenLayers Map
   */
  public attachToMap(map: OlMap): void {
    this.map = map
    this.map.addLayer(this.trailLayer)
    this.map.addLayer(this.planeLayer)

    // Listen to map click on aircraft
    this.map.on('singleclick', (evt) => {
      let clickedHex: string | null = null
      this.map?.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const hex = feature.get('hex')
        if (hex && !clickedHex) {
          clickedHex = hex
        }
      })

      if (clickedHex) {
        this.selectAircraft(clickedHex)
      }
    })

    // Start background polling & 60fps interpolation loop
    this.start()
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

    // Start 60fps smooth interpolation loop
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
        // Rate limited: back off for 6 seconds
        this.cooldownUntil = Date.now() + 6000
        this.notifyError('API 請求過於頻繁，等待緩衝冷卻中...')
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
    this.animationStartTime = Date.now()
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
      }
    })

    // Remove stale planes not seen in 60s
    const now = Date.now()
    this.aircraftMap.forEach((entity, hex) => {
      if (!activeHexes.has(hex) && now - entity.lastSeen > 60000) {
        this.planeSource.removeFeature(entity.getPlaneFeature())
        this.trailSource.removeFeature(entity.getTrailFeature())
        this.aircraftMap.delete(hex)
        if (this.selectedHex === hex) {
          this.selectAircraft(null)
        }
      }
    })

    this.notifyUpdate()
  }

  /**
   * 60 FPS requestAnimationFrame Loop for linear interpolation
   */
  private startAnimationLoop(): void {
    const loop = () => {
      if (!this.isPolling) return
      const elapsed = Date.now() - this.animationStartTime
      const progress = Math.min(elapsed / this.pollIntervalMs, 1.0)

      this.aircraftMap.forEach((entity) => {
        entity.stepInterpolation(progress)
      })

      // Auto-follow selected flight if enabled
      if (this.selectedHex && this.followSelected && this.map) {
        const selectedEntity = this.aircraftMap.get(this.selectedHex)
        if (selectedEntity) {
          const view = this.map.getView()
          view.setCenter(fromLonLat(selectedEntity.currentLonLat))
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
    this.followSelected = follow
  }

  public isFollowingSelected(): boolean {
    return this.followSelected
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
    this.stop()
    this.updateCallbacks.clear()
    this.selectCallbacks.clear()
    this.loadingCallbacks.clear()
    this.errorCallbacks.clear()

    if (this.map) {
      this.map.removeLayer(this.planeLayer)
      this.map.removeLayer(this.trailLayer)
      this.map = null
    }

    this.planeSource.clear()
    this.trailSource.clear()
    this.aircraftMap.clear()
  }
}
