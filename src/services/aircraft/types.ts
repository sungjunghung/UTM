export interface RawAircraftData {
  hex: string
  flight?: string
  r?: string // registration (e.g. B-LPN)
  t?: string // aircraft type (e.g. A320, B77W)
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number // ground speed (knots)
  track?: number // heading angle in degrees (0 - 360)
  baro_rate?: number // vertical speed (ft/min)
  squawk?: string
  lat?: number
  lon?: number
  seen?: number
}

export interface AdsbResponse {
  ac?: RawAircraftData[]
  total?: number
  ctime?: number
  now?: number
}

export interface AircraftInfo {
  hex: string
  flight: string
  registration: string
  model: string
  latitude: number
  longitude: number
  altitude: number
  isGround: boolean
  speed: number // knots
  heading: number // degrees (0-360)
  verticalRate: number // ft/min
  squawk: string
  trail: [number, number][]
  lastSeen: number
}
