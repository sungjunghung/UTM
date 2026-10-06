import TileLayer from 'ol/layer/Tile'
import LayerGroup from 'ol/layer/Group'
import type BaseLayer from 'ol/layer/Base'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import type { BaseLayerType, CartoTone } from './types'

// CARTO Basemaps 需 API Key (免費申請: https://carto.com/basemaps/apikey)，設定於 .env.local 的 VITE_CARTO_API_KEY
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY as string | undefined
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'

function cartoTileUrl(style: string): string {
  const base = `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png`
  return CARTO_API_KEY ? `${base}?key=${encodeURIComponent(CARTO_API_KEY)}` : base
}

export class LayerManager {
  private baseLayers: Map<BaseLayerType, BaseLayer> = new Map()
  private currentType: BaseLayerType = 'osm-dark'

  private cartoTone: CartoTone = 'light'
  private cartoToneLayers: Record<CartoTone, TileLayer<XYZ>> | null = null

  constructor(defaultType: BaseLayerType = 'osm-dark', cartoTone: CartoTone = 'light') {
    this.currentType = defaultType
    this.cartoTone = cartoTone
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

    // 2. CARTO 三段色調底圖：淺色 Positron / 灰色 (Positron 降亮度濾鏡) / 深色 Dark Matter
    //    灰色不用淺深兩圖交疊：兩圖明暗相反，疊 50% 會互相抵消成一片灰、道路與文字都糊掉
    const cartoLightSource = new XYZ({ url: cartoTileUrl('light_all'), attributions: CARTO_ATTRIBUTION })
    this.cartoToneLayers = {
      light: new TileLayer({ source: cartoLightSource }),
      // 與淺色共用同一 source (圖磚只抓一次)；獨立 className 讓 CSS 濾鏡只作用在這一層
      gray: new TileLayer({ source: cartoLightSource, className: 'ol-carto-gray-tiles' }),
      dark: new TileLayer({
        source: new XYZ({ url: cartoTileUrl('dark_all'), attributions: CARTO_ATTRIBUTION }),
        className: 'ol-carto-dark-tiles',
      }),
    }
    const cartoGroup = new LayerGroup({
      layers: Object.values(this.cartoToneLayers),
      visible: this.currentType === 'carto',
      properties: { title: 'Carto', type: 'carto' },
    })
    this.applyCartoTone()
    this.baseLayers.set('carto', cartoGroup)

    // 3. CartoDB Dark Matter (Ultra-clean, No-Labels radar baseline)
    const cartoDarkLayer = new TileLayer({
      source: new XYZ({
        url: cartoTileUrl('dark_nolabels'),
        attributions: CARTO_ATTRIBUTION,
      }),
      visible: this.currentType === 'carto-dark',
      properties: { title: '極簡暗夜雷達 (無雜訊)', type: 'carto-dark' },
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

    // 5. 臺灣通用電子地圖 - 灰階版 (內政部國土測繪中心 NLSC, 100% 免 API Key, 專注台灣無外地雜訊)
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

  public getLayersArray(): BaseLayer[] {
    return Array.from(this.baseLayers.values())
  }

  public setCartoTone(tone: CartoTone): void {
    this.cartoTone = tone
    this.applyCartoTone()
  }

  public getCartoTone(): CartoTone {
    return this.cartoTone
  }

  private applyCartoTone(): void {
    if (!this.cartoToneLayers) return
    for (const [tone, layer] of Object.entries(this.cartoToneLayers)) {
      layer.setVisible(tone === this.cartoTone)
    }
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
