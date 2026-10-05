import type OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Fill, Stroke, Text } from 'ol/style'
import { toLonLat } from 'ol/proj'
import type Feature from 'ol/Feature'
import type { EventsKey } from 'ol/events'
import { queryCaaAirspaceGeoJson } from './airspaceService'
import type { AirspaceZoneInfo, AirspaceGeoJsonFeature, AirspaceFilterOptions } from './types'

export class AirspaceManager {
  private map: OlMap | null = null
  private vectorSource = new VectorSource()
  private vectorLayer: VectorLayer<VectorSource>

  private loadedObjectIds = new Set<number>()
  private isFetching = false
  private isVisible = true
  private moveEndKey: EventsKey | null = null
  private pointerMoveKey: EventsKey | null = null
  private clickKey: EventsKey | null = null

  private hoveredFeature: Feature | null = null
  private geoJsonFormat = new GeoJSON()

  private filterOptions: AirspaceFilterOptions = {
    showRedZones: true,
    showYellowZones: true,
    showLabels: true,
    categories: {
      airport: true,
      government: true,
      fir: true,
    },
  }

  private hoverCallbacks: Set<(info: AirspaceZoneInfo | null) => void> = new Set()
  private selectCallbacks: Set<(info: AirspaceZoneInfo | null) => void> = new Set()
  private loadingCallbacks: Set<(loading: boolean) => void> = new Set()
  private filterChangeCallbacks: Set<(options: AirspaceFilterOptions) => void> = new Set()

  constructor(visible: boolean = true) {
    this.isVisible = visible

    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      zIndex: 18, // Above base maps and flight corridors, below tactical telemetry & radar
      visible: this.isVisible,
      style: (feature, resolution) => this.getFeatureStyle(feature as Feature, resolution),
    })
  }

  public getLayer(): VectorLayer<VectorSource> {
    return this.vectorLayer
  }

  public getFilterOptions(): AirspaceFilterOptions {
    return {
      ...this.filterOptions,
      categories: { ...this.filterOptions.categories },
    }
  }

  public setFilterOptions(options: Partial<AirspaceFilterOptions>): void {
    if (options.showRedZones !== undefined) this.filterOptions.showRedZones = options.showRedZones
    if (options.showYellowZones !== undefined) this.filterOptions.showYellowZones = options.showYellowZones
    if (options.showLabels !== undefined) this.filterOptions.showLabels = options.showLabels
    if (options.categories) {
      this.filterOptions.categories = {
        ...this.filterOptions.categories,
        ...options.categories,
      }
    }
    // Re-evaluate styles immediately across all vector features
    this.vectorLayer.changed()
    this.filterChangeCallbacks.forEach((cb) => cb(this.getFilterOptions()))
  }

  public onFilterChange(cb: (options: AirspaceFilterOptions) => void): () => void {
    this.filterChangeCallbacks.add(cb)
    return () => this.filterChangeCallbacks.delete(cb)
  }

  public isFeatureVisible(feature: Feature): boolean {
    const zoneType = feature.get('限制區')
    const categoryName = feature.get('空域類別名稱') || ''

    // 1. Zone type filtering (Red / Yellow)
    if (zoneType === '紅區' && !this.filterOptions.showRedZones) return false
    if (zoneType === '黃區' && !this.filterOptions.showYellowZones) return false

    // 2. Sub-category filtering
    if (categoryName.includes('機場') && !this.filterOptions.categories.airport) return false
    if (categoryName.includes('縣市') && !this.filterOptions.categories.government) return false
    if (categoryName.includes('情報') && !this.filterOptions.categories.fir) return false

    return true
  }

  public attachToMap(map: OlMap): void {
    this.map = map
    this.map.addLayer(this.vectorLayer)

    // Listen to map pan/zoom events to load visible airspace sectors
    this.moveEndKey = this.map.on('moveend', () => {
      if (this.isVisible) {
        this.fetchCurrentExtentAirspace()
      }
    })

    // Pointer move for hover inspection
    this.pointerMoveKey = this.map.on('pointermove', (evt) => {
      if (evt.dragging || !this.isVisible) return

      let foundFeature: Feature | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.vectorLayer && this.isFeatureVisible(feature as Feature)) {
            foundFeature = feature as Feature
            return true
          }
        },
        { hitTolerance: 5 }
      )

      if (foundFeature !== this.hoveredFeature) {
        this.hoveredFeature = foundFeature
        const info = foundFeature ? this.extractZoneInfo(foundFeature, toLonLat(evt.coordinate) as [number, number]) : null
        this.hoverCallbacks.forEach((cb) => cb(info))
      }
    })

    // Single click for fixed selection
    this.clickKey = this.map.on('singleclick', (evt) => {
      if (!this.isVisible) return

      let clickedFeature: Feature | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.vectorLayer && this.isFeatureVisible(feature as Feature)) {
            clickedFeature = feature as Feature
            return true
          }
        },
        { hitTolerance: 5 }
      )

      const info = clickedFeature ? this.extractZoneInfo(clickedFeature, toLonLat(evt.coordinate) as [number, number]) : null
      this.selectCallbacks.forEach((cb) => cb(info))
    })

    // Initial load
    if (this.isVisible) {
      setTimeout(() => this.fetchCurrentExtentAirspace(), 300)
    }
  }

  public detach(): void {
    if (this.map) {
      this.map.removeLayer(this.vectorLayer)
      if (this.moveEndKey) this.map.un('moveend', this.moveEndKey.listener)
      if (this.pointerMoveKey) this.map.un('pointermove', this.pointerMoveKey.listener)
      if (this.clickKey) this.map.un('singleclick', this.clickKey.listener)
    }
    this.map = null
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible
    this.vectorLayer.setVisible(visible)
    if (visible && this.map) {
      this.fetchCurrentExtentAirspace()
    } else {
      this.hoverCallbacks.forEach((cb) => cb(null))
      this.selectCallbacks.forEach((cb) => cb(null))
    }
  }

  public getVisible(): boolean {
    return this.isVisible
  }

  public onHover(cb: (info: AirspaceZoneInfo | null) => void): () => void {
    this.hoverCallbacks.add(cb)
    return () => this.hoverCallbacks.delete(cb)
  }

  public onSelect(cb: (info: AirspaceZoneInfo | null) => void): () => void {
    this.selectCallbacks.add(cb)
    return () => this.selectCallbacks.delete(cb)
  }

  public onLoading(cb: (loading: boolean) => void): () => void {
    this.loadingCallbacks.add(cb)
    return () => this.loadingCallbacks.delete(cb)
  }

  /**
   * Fetch CAA airspace polygon features intersecting current map view extent
   */
  public async fetchCurrentExtentAirspace(): Promise<void> {
    if (!this.map || this.isFetching || !this.isVisible) return

    const view = this.map.getView()
    const extent = view.calculateExtent(this.map.getSize())
    const minCoord = toLonLat([extent[0], extent[1]])
    const maxCoord = toLonLat([extent[2], extent[3]])

    const bbox: [number, number, number, number] = [
      Math.min(minCoord[0], maxCoord[0]),
      Math.min(minCoord[1], maxCoord[1]),
      Math.max(minCoord[0], maxCoord[0]),
      Math.max(minCoord[1], maxCoord[1]),
    ]

    this.isFetching = true
    this.loadingCallbacks.forEach((cb) => cb(true))

    try {
      const geoJson = await queryCaaAirspaceGeoJson(bbox)
      if (geoJson && geoJson.features) {
        const newFeatures: Feature[] = []

        geoJson.features.forEach((feat: AirspaceGeoJsonFeature) => {
          const oid = feat.properties?.objectid
          if (oid && !this.loadedObjectIds.has(oid)) {
            this.loadedObjectIds.add(oid)
            const olFeature = this.geoJsonFormat.readFeature(feat, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            }) as Feature
            newFeatures.push(olFeature)
          }
        })

        if (newFeatures.length > 0) {
          this.vectorSource.addFeatures(newFeatures)
        }
      }
    } catch (err) {
      console.error('[AirspaceManager] Error fetching CAA airspace:', err)
    } finally {
      this.isFetching = false
      this.loadingCallbacks.forEach((cb) => cb(false))
    }
  }

  /**
   * Military C2 Tactical Styling for CAA Airspace Restrictions
   */
  private getFeatureStyle(feature: Feature, resolution: number): Style | undefined {
    if (!this.isFeatureVisible(feature)) {
      return undefined
    }

    const zoneType = feature.get('限制區')
    const name = feature.get('空域名稱') || ''
    const isRed = zoneType === '紅區'

    // Show name label when showLabels is enabled and resolution is fine enough (approx zoom >= 11.5)
    const showLabel = this.filterOptions.showLabels && resolution < 50 && !!name

    return new Style({
      fill: new Fill({
        color: isRed
          ? 'rgba(220, 38, 38, 0.22)' // Crimson red for No-Fly Zone
          : 'rgba(217, 119, 6, 0.16)', // Amber gold for Restricted Zone
      }),
      stroke: new Stroke({
        color: isRed ? '#ef4444' : '#f59e0b',
        width: isRed ? 1.5 : 1.5,
        lineDash: isRed ? undefined : [6, 4],
      }),
      text: showLabel
        ? new Text({
            text: `${name}\n[${isRed ? '禁航' : '限航'}]`,
            font: 'bold 10px monospace, sans-serif',
            fill: new Fill({ color: isRed ? '#fecaca' : '#fef3c7' }),
            stroke: new Stroke({ color: isRed ? '#450a0a' : '#451a03', width: 3 }),
            overflow: true,
            placement: 'point',
          })
        : undefined,
    })
  }

  private extractZoneInfo(feature: Feature, coordinate?: [number, number]): AirspaceZoneInfo {
    const props = feature.getProperties()
    const isRed = props['限制區'] === '紅區'

    return {
      id: String(props['objectid'] || Math.random()),
      name: props['空域名稱'] || (isRed ? '法定禁航管制區' : '法定限航管制區'),
      zoneType: isRed ? 'red' : 'yellow',
      zoneLabel: isRed ? '🔴 禁航區 (No-Fly Zone)' : '🟠 限航區 (Restricted Zone)',
      description: props['空域說明'] || '依據民用航空法遙控無人機專章規定劃設之管制空域。',
      authority: props['主管機關名稱'] || props['主管機關'] || '交通部民用航空局',
      validFrom: props['有效日期起'] || undefined,
      validTo: props['有效日期迄'] || undefined,
      penalty: props['罰則'] || '違規操作將依民用航空法第118條之2裁處新台幣3萬至150萬元罰鍰並沒入遙控無人機。',
      coordinate,
    }
  }
}
