/**
 * Drone (UAV) Management Types for UTM System
 */

export type DroneFlightStatus = '巡航中' | '定點懸停' | '任務巡檢' | '自動返航' | '起降中'

export interface DroneWaypoint {
  coordinate: [number, number] // [lon, lat]
  altitudeMeters: number
  action?: string
}

export interface DroneInfo {
  id: string // e.g. UAV-NCHC-01
  callsign: string // e.g. 國網巡檢01號
  remoteId: string // e.g. CAA-TW-849201 (Taiwan CAA Remote ID)
  model: string // e.g. DJI Matrice 350 RTK
  operator: string // e.g. 國研院國網中心 (NCHC)
  missionType: string // e.g. 園區高壓電塔巡檢, 水庫環境監測, 物流快遞
  status: DroneFlightStatus
  latitude: number
  longitude: number
  altitudeAglMeters: number // Height Above Ground Level in meters
  altitudeAglFeet: number
  speedKmh: number
  heading: number // degrees (0-360)
  pitchDeg?: number // degrees (-90 to +90, nose up/down)
  rollDeg?: number // degrees (-180 to +180, bank left/right)
  yawDeg?: number // degrees (0-360)
  verticalRateMps: number // m/s climb/descent
  batteryPercent: number // 0-100
  linkQuality: number // 0-100%
  satellites: number // GNSS sat count
  homeCoordinate: [number, number]
  waypoints: [number, number][]
  trail: [number, number][]
  lastSeen: number
}

export interface DroneManagerOptions {
  centerLat?: number
  centerLon?: number
  showTrails?: boolean
  showMissionPaths?: boolean
}
