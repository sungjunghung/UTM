import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import type { MarkerOptions } from './types'

function createMarkerStyle(title: string, color: string, isHovered: boolean = false): Style[] {
  const styles: Style[] = []

  if (isHovered) {
    // Outer halo pulse ring for hovered marker
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 17,
          stroke: new Stroke({ color, width: 2, lineDash: [3, 3] }),
          fill: new Fill({ color: 'rgba(59, 130, 246, 0.18)' }),
        }),
        zIndex: 95,
      })
    )
  }

  styles.push(
    new Style({
      image: new CircleStyle({
        radius: isHovered ? 12 : 9,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: isHovered ? 3 : 2.5 }),
      }),
      text: title
        ? new Text({
            text: title,
            offsetY: isHovered ? -20 : -16,
            font: isHovered ? 'bold 13px sans-serif' : 'bold 12px sans-serif',
            fill: new Fill({ color: isHovered ? '#0284c7' : '#1e293b' }),
            stroke: new Stroke({ color: '#ffffff', width: 3.5 }),
          })
        : undefined,
      zIndex: isHovered ? 100 : 10,
    })
  )

  return styles
}

export class MarkerManager {
  private source: VectorSource
  private layer: VectorLayer<VectorSource>
  private hoveredMarker: Feature | null = null

  constructor() {
    this.source = new VectorSource()
    this.layer = new VectorLayer({
      source: this.source,
      zIndex: 10,
    })
  }

  public getLayer(): VectorLayer<VectorSource> {
    return this.layer
  }

  public setHoveredMarker(feature: Feature | null): void {
    if (this.hoveredMarker === feature) return
    if (this.hoveredMarker) {
      this.updateMarkerStyle(this.hoveredMarker, false)
    }
    this.hoveredMarker = feature
    if (this.hoveredMarker) {
      this.updateMarkerStyle(this.hoveredMarker, true)
    }
  }

  private updateMarkerStyle(feature: Feature, isHovered: boolean): void {
    const title = feature.get('title') || ''
    const color = feature.get('color') || '#3b82f6'
    feature.setStyle(createMarkerStyle(title, color, isHovered))
  }

  public addMarker(options: MarkerOptions): Feature {
    const coordinates = fromLonLat(options.coordinate)
    const markerColor = options.color || '#3b82f6'
    const title = options.title || 'Marker'

    const feature = new Feature({
      geometry: new Point(coordinates),
      id: options.id || `marker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      description: options.description || '',
      color: markerColor,
      isMarker: true,
    })

    feature.setStyle(createMarkerStyle(title, markerColor, false))

    this.source.addFeature(feature)
    return feature
  }

  public removeMarker(feature: Feature): void {
    if (this.hoveredMarker === feature) {
      this.hoveredMarker = null
    }
    this.source.removeFeature(feature)
  }

  public clearAllMarkers(): void {
    this.source.clear()
  }

  public getAllFeatures(): Feature[] {
    return this.source.getFeatures()
  }
}
