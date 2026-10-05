import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import type { MarkerOptions } from './types'

export class MarkerManager {
  private source: VectorSource
  private layer: VectorLayer<VectorSource>

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

  public addMarker(options: MarkerOptions): Feature {
    const coordinates = fromLonLat(options.coordinate)
    const feature = new Feature({
      geometry: new Point(coordinates),
      id: options.id || `marker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: options.title || 'Marker',
      description: options.description || '',
    })

    const markerColor = options.color || '#3b82f6'

    feature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: markerColor }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
        }),
        text: options.title
          ? new Text({
              text: options.title,
              offsetY: -16,
              font: 'bold 12px sans-serif',
              fill: new Fill({ color: '#1e293b' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
            })
          : undefined,
      })
    )

    this.source.addFeature(feature)
    return feature
  }

  public removeMarker(feature: Feature): void {
    this.source.removeFeature(feature)
  }

  public clearAllMarkers(): void {
    this.source.clear()
  }

  public getAllFeatures(): Feature[] {
    return this.source.getFeatures()
  }
}
