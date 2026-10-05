export type BaseLayerType = 'osm' | 'carto-light' | 'carto-dark' | 'opentopo' | 'nlsc-gray' | 'osm-dark' | 'satellite'

export interface MapManagerOptions {
  target: HTMLElement | string
  center?: [number, number] // [lon, lat] in EPSG:4326
  zoom?: number
  minZoom?: number
  maxZoom?: number
  baseLayer?: BaseLayerType
}

export interface MarkerOptions {
  id?: string
  coordinate: [number, number] // [lon, lat]
  title?: string
  description?: string
  color?: string
}

export interface MapState {
  center: [number, number]
  zoom: number
  rotation: number
  pointerCoordinate: [number, number] | null
  activeBaseLayer: BaseLayerType
}
