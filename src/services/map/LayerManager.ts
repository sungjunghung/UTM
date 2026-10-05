import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import type { BaseLayerType } from './types'

export class LayerManager {
  private baseLayers: Map<BaseLayerType, TileLayer<OSM | XYZ>> = new Map()
  private currentType: BaseLayerType = 'osm-dark'

  constructor(defaultType: BaseLayerType = 'osm-dark') {
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

    // 5. 臺灣通用電子地圖 - 灰階版 (內政部國土測繪中心 NLSC 政府公開開放資料, 100% 免 API Key)
    const nlscGrayLayer = new TileLayer({
      source: new XYZ({
        url: 'https://wmts.nlsc.gov.tw/wmts/EMAP01/default/GoogleMapsCompatible/{z}/{y}/{x}',
        attributions: '&copy; 內政部國土測繪中心 (NLSC Open Data)',
        maxZoom: 19,
      }),
      visible: this.currentType === 'nlsc-gray',
      properties: { title: 'NLSC 國土測繪灰階', type: 'nlsc-gray' },
    })
    this.baseLayers.set('nlsc-gray', nlscGrayLayer)

    // 6. OpenStreetMap 暗夜雷達濾鏡 (100% 開源, 純前端濾鏡渲染, 永久免 API Key)
    const osmDarkLayer = new TileLayer({
      source: new OSM(),
      className: 'ol-dark-tiles',
      visible: this.currentType === 'osm-dark',
      properties: { title: 'OSM 開源暗夜雷達', type: 'osm-dark' },
    })
    this.baseLayers.set('osm-dark', osmDarkLayer)

    // 7. 衛星空照圖 (Esri World Imagery 高解析度航拍空照影像)
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }),
      visible: this.currentType === 'satellite',
      properties: { title: '衛星空照圖', type: 'satellite' },
    })
    this.baseLayers.set('satellite', satelliteLayer)
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
