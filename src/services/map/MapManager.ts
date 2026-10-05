import Map from 'ol/Map'
import View from 'ol/View'
import type Feature from 'ol/Feature'
import { fromLonLat, toLonLat } from 'ol/proj'
import { defaults as defaultControls, ScaleLine } from 'ol/control'
import { LayerManager } from './LayerManager'
import { MarkerManager } from './MarkerManager'
import type { BaseLayerType, MapManagerOptions, MarkerOptions } from './types'

export class MapManager {
  private map: Map | null = null
  private view: View | null = null
  private layerManager: LayerManager
  private markerManager: MarkerManager

  private defaultCenter: [number, number]
  private defaultZoom: number
  private minZoom: number
  private maxZoom: number

  private pointerMoveCallbacks: Set<(lonLat: [number, number] | null) => void> = new Set()
  private clickCallbacks: Set<(lonLat: [number, number]) => void> = new Set()
  private viewChangeCallbacks: Set<(info: { zoom: number; center: [number, number] }) => void> = new Set()

  constructor(options: Partial<MapManagerOptions> = {}) {
    // Default: Center on Taiwan [121.0, 23.8], zoom 8 (can be adjusted)
    this.defaultCenter = options.center || [120.982, 23.838]
    this.defaultZoom = options.zoom ?? 8
    this.minZoom = options.minZoom ?? 2
    this.maxZoom = options.maxZoom ?? 20

    this.layerManager = new LayerManager(options.baseLayer || 'osm')
    this.markerManager = new MarkerManager()
  }

  /**
   * Initialize map to target element
   */
  public initialize(target: HTMLElement | string): void {
    if (this.map) {
      this.destroy()
    }

    this.view = new View({
      center: fromLonLat(this.defaultCenter),
      zoom: this.defaultZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    })

    this.map = new Map({
      target,
      layers: [
        ...this.layerManager.getLayersArray(),
        this.markerManager.getLayer(),
      ],
      view: this.view,
      controls: defaultControls({
        zoom: false, // We provide modern DaisyUI controls
        attribution: false,
      }).extend([
        new ScaleLine({
          units: 'metric',
          bar: true,
          steps: 4,
          text: true,
          minWidth: 120,
          target: 'utm-scale-target',
        }),
      ]),
    })

    this.bindEvents()
  }

  private bindEvents(): void {
    if (!this.map || !this.view) return

    // Pointer move for coordinate display & clickable feature hover cursor
    this.map.on('pointermove', (event) => {
      const coordinate = event.coordinate
      if (coordinate && this.pointerMoveCallbacks.size > 0) {
        const lonLat = toLonLat(coordinate) as [number, number]
        this.notifyPointerMove([Number(lonLat[0].toFixed(5)), Number(lonLat[1].toFixed(5))])
      } else if (!coordinate && this.pointerMoveCallbacks.size > 0) {
        this.notifyPointerMove(null)
      }

      if (event.dragging) {
        this.markerManager.setHoveredMarker(null)
        const targetEl = this.map?.getTargetElement()
        if (targetEl) targetEl.style.cursor = ''
        return
      }

      // Hit-test for clickable interactive features (aircraft markers or custom markers)
      let isClickable = false
      let hoveredMarker: Feature | null = null

      this.map?.forEachFeatureAtPixel(
        event.pixel,
        (feature, layer) => {
          // 1. Aircraft plane marker
          if (feature.get('hex') && feature.get('entity')) {
            isClickable = true
            return true
          }
          // 2. Custom marker
          if (feature.get('isMarker') || layer === this.markerManager.getLayer()) {
            isClickable = true
            hoveredMarker = feature as Feature
            return true
          }
        },
        { hitTolerance: 8 }
      )

      // Notify marker manager of hovered marker
      this.markerManager.setHoveredMarker(hoveredMarker)

      // Update cursor icon to pointer if over a clickable item
      const targetEl = this.map?.getTargetElement()
      if (targetEl) {
        targetEl.style.cursor = isClickable ? 'pointer' : ''
      }
    })

    // Click event
    this.map.on('singleclick', (event) => {
      const coordinate = event.coordinate
      if (!coordinate) return
      const lonLat = toLonLat(coordinate) as [number, number]
      this.notifyClick([Number(lonLat[0].toFixed(5)), Number(lonLat[1].toFixed(5))])
    })

    // View change (zoom & center)
    this.view.on('change:resolution', () => this.notifyViewChange())
    this.view.on('change:center', () => this.notifyViewChange())
  }

  private notifyPointerMove(coords: [number, number] | null): void {
    this.pointerMoveCallbacks.forEach((cb) => cb(coords))
  }

  private notifyClick(coords: [number, number]): void {
    this.clickCallbacks.forEach((cb) => cb(coords))
  }

  private notifyViewChange(): void {
    if (!this.view || this.viewChangeCallbacks.size === 0) return
    const zoom = Math.round((this.view.getZoom() || this.defaultZoom) * 10) / 10
    const rawCenter = this.view.getCenter()
    const center = rawCenter ? (toLonLat(rawCenter) as [number, number]) : this.defaultCenter
    this.viewChangeCallbacks.forEach((cb) => cb({ zoom, center }))
  }

  // --- Public APIs ---

  public getMap(): Map | null {
    return this.map
  }

  public onPointerMove(callback: (lonLat: [number, number] | null) => void): () => void {
    this.pointerMoveCallbacks.add(callback)
    return () => this.pointerMoveCallbacks.delete(callback)
  }

  public onClick(callback: (lonLat: [number, number]) => void): () => void {
    this.clickCallbacks.add(callback)
    return () => this.clickCallbacks.delete(callback)
  }

  public onViewChange(callback: (info: { zoom: number; center: [number, number] }) => void): () => void {
    this.viewChangeCallbacks.add(callback)
    return () => this.viewChangeCallbacks.delete(callback)
  }

  public zoomIn(duration = 250): void {
    if (!this.view) return
    const current = this.view.getZoom() || this.defaultZoom
    this.view.animate({
      zoom: Math.min(current + 1, this.maxZoom),
      duration,
    })
  }

  public zoomOut(duration = 250): void {
    if (!this.view) return
    const current = this.view.getZoom() || this.defaultZoom
    this.view.animate({
      zoom: Math.max(current - 1, this.minZoom),
      duration,
    })
  }

  public resetView(duration = 500): void {
    if (!this.view) return
    this.view.animate({
      center: fromLonLat(this.defaultCenter),
      zoom: this.defaultZoom,
      duration,
    })
  }

  public flyTo(coordinate: [number, number], zoom = 14, duration = 1000): void {
    if (!this.view) return
    this.view.animate({
      center: fromLonLat(coordinate),
      zoom,
      duration,
    })
  }

  public switchBaseLayer(type: BaseLayerType): void {
    this.layerManager.switchBaseLayer(type)
  }

  public getActiveBaseLayer(): BaseLayerType {
    return this.layerManager.getCurrentType()
  }

  public addMarker(options: MarkerOptions) {
    return this.markerManager.addMarker(options)
  }

  public clearMarkers(): void {
    this.markerManager.clearAllMarkers()
  }

  public updateSize(): void {
    if (this.map) {
      this.map.updateSize()
    }
  }

  public destroy(): void {
    this.pointerMoveCallbacks.clear()
    this.clickCallbacks.clear()
    this.viewChangeCallbacks.clear()
    if (this.map) {
      this.map.setTarget(undefined)
      this.map = null
    }
    this.view = null
  }
}
