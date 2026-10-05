import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import type { BaseLayerType } from './types'

export class LayerManager {
  private baseLayers: Map<BaseLayerType, TileLayer<OSM | XYZ>> = new Map()
  private currentType: BaseLayerType = 'carto-dark'

  constructor(defaultType: BaseLayerType = 'carto-dark') {
    this.currentType = defaultType
    this.initBaseLayers()
  }

  private initBaseLayers(): void {
    // 1. OpenStreetMap
    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: this.currentType === 'osm',
      properties: { title: 'OpenStreetMap', type: 'osm' },
    })
    this.baseLayers.set('osm', osmLayer)

    // 2. CartoDB Positron (Light)
    const cartoLightLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }),
      visible: this.currentType === 'carto-light',
      properties: { title: 'Carto Light', type: 'carto-light' },
    })
    this.baseLayers.set('carto-light', cartoLightLayer)

    // 3. CartoDB Dark Matter
    const cartoDarkLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }),
      visible: this.currentType === 'carto-dark',
      properties: { title: 'Carto Dark', type: 'carto-dark' },
    })
    this.baseLayers.set('carto-dark', cartoDarkLayer)

    // 4. OpenTopoMap
    const topoLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attributions: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
      }),
      visible: this.currentType === 'opentopo',
      properties: { title: 'OpenTopoMap', type: 'opentopo' },
    })
    this.baseLayers.set('opentopo', topoLayer)
  }

  public getLayersArray(): TileLayer<OSM | XYZ>[] {
    return Array.from(this.baseLayers.values())
  }

  public switchBaseLayer(type: BaseLayerType): void {
    if (!this.baseLayers.has(type)) {
      console.warn(`Layer type "${type}" is not supported.`)
      return
    }
    this.currentType = type
    this.baseLayers.forEach((layer, key) => {
      layer.setVisible(key === type)
    })
  }

  public getCurrentType(): BaseLayerType {
    return this.currentType
  }
}
