export type AirspaceZoneType = '紅區' | '黃區' | '綠區'

export interface AirspaceProperties {
  objectid: number
  空域名稱?: string
  限制區?: AirspaceZoneType | string
  空域說明?: string
  主管機關?: string
  主管機關名稱?: string
  有效日期起?: string | null
  有效日期迄?: string | null
  罰則?: string | null
}

export interface AirspaceZoneInfo {
  id: string
  name: string
  zoneType: 'red' | 'yellow'
  zoneLabel: string
  description: string
  authority: string
  validFrom?: string
  validTo?: string
  penalty?: string
  coordinate?: [number, number]
}

export interface AirspaceGeoJsonFeature {
  type: string
  id?: number | string
  geometry: any
  properties: AirspaceProperties
}

export interface AirspaceGeoJsonCollection {
  type: string
  features: AirspaceGeoJsonFeature[]
}
