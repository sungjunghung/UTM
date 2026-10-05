import type OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
import type { EventsKey } from 'ol/events'
import { DroneEntity } from './DroneEntity'
import type { DroneInfo, DroneManagerOptions } from './types'

export class DroneManager {
  private map: OlMap | null = null
  private droneSource = new VectorSource()
  private trailSource = new VectorSource()
  private missionSource = new VectorSource()

  private droneLayer: VectorLayer<VectorSource>
  private trailLayer: VectorLayer<VectorSource>
  private missionLayer: VectorLayer<VectorSource>

  private droneMap = new Map<string, DroneEntity>()
  private selectedDroneId: string | null = null
  private hoveredDroneId: string | null = null
  private followSelected: boolean = false

  private singleClickKey: EventsKey | null = null
  private pointerMoveKey: EventsKey | null = null
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private isRunning: boolean = false

  // Callbacks
  private updateCallbacks: Set<(list: DroneInfo[]) => void> = new Set()
  private selectCallbacks: Set<(info: DroneInfo | null) => void> = new Set()
  private selectedMoveCallbacks: Set<(lonLat: [number, number], info: DroneInfo) => void> = new Set()
  private followChangeCallbacks: Set<(following: boolean) => void> = new Set()

  constructor(options: DroneManagerOptions = {}) {
    this.trailLayer = new VectorLayer({
      source: this.trailSource,
      zIndex: 35,
      visible: options.showTrails ?? true,
    })

    this.missionLayer = new VectorLayer({
      source: this.missionSource,
      zIndex: 34,
      visible: options.showMissionPaths ?? true,
    })

    this.droneLayer = new VectorLayer({
      source: this.droneSource,
      zIndex: 45,
    })

    this.seedInitialFleet(options.centerLat ?? 24.7887, options.centerLon ?? 121.0028)
  }

  public attachToMap(map: OlMap): void {
    this.map = map
    this.map.addLayer(this.missionLayer)
    this.map.addLayer(this.trailLayer)
    this.map.addLayer(this.droneLayer)

    // Single click on drone
    this.singleClickKey = this.map.on('singleclick', (evt) => {
      let clickedId: string | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.droneLayer) {
            const id = feature.get('id')
            if (id) {
              clickedId = id
              return true
            }
          }
        },
        { hitTolerance: 10 }
      )

      if (clickedId) {
        this.selectDrone(clickedId)
      }
    })

    // Pointer move over drone for visual hover
    this.pointerMoveKey = this.map.on('pointermove', (evt) => {
      if (evt.dragging) {
        this.clearHover()
        return
      }

      let foundId: string | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.droneLayer) {
            const id = feature.get('id')
            if (id) {
              foundId = id
              return true
            }
          }
        },
        { hitTolerance: 8 }
      )

      if (foundId !== this.hoveredDroneId) {
        this.clearHover()
        if (foundId && this.droneMap.has(foundId)) {
          this.hoveredDroneId = foundId
          this.droneMap.get(foundId)!.setHovered(true)
        }
      }
    })

    this.start()
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.startAnimationLoop()
  }

  public stop(): void {
    this.isRunning = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  public destroy(): void {
    this.stop()
    if (this.singleClickKey) this.singleClickKey = null
    if (this.pointerMoveKey) this.pointerMoveKey = null

    if (this.map) {
      this.map.removeLayer(this.droneLayer)
      this.map.removeLayer(this.trailLayer)
      this.map.removeLayer(this.missionLayer)
      this.map = null
    }

    this.droneMap.clear()
    this.droneSource.clear()
    this.trailSource.clear()
    this.missionSource.clear()
  }

  public selectDrone(id: string | null): void {
    if (this.selectedDroneId === id) return

    if (this.selectedDroneId && this.droneMap.has(this.selectedDroneId)) {
      this.droneMap.get(this.selectedDroneId)!.setSelected(false)
    }

    this.selectedDroneId = id
    if (!id) {
      this.setFollowSelected(false)
    }

    let info: DroneInfo | null = null
    if (id && this.droneMap.has(id)) {
      const entity = this.droneMap.get(id)!
      entity.setSelected(true)
      info = entity.getInfo()

      // Smoothly fly camera to selected drone
      if (this.map) {
        this.map.getView().animate({
          center: fromLonLat(entity.currentLonLat),
          duration: 350,
        })
      }
    }

    this.notifySelect(info)
  }

  public setFollowSelected(follow: boolean): void {
    if (this.followSelected === follow) return
    this.followSelected = follow
    this.notifyFollowChange(follow)
  }

  public onUpdate(cb: (list: DroneInfo[]) => void): () => void {
    this.updateCallbacks.add(cb)
    cb(this.getDroneList())
    return () => this.updateCallbacks.delete(cb)
  }

  public onSelect(cb: (info: DroneInfo | null) => void): () => void {
    this.selectCallbacks.add(cb)
    return () => this.selectCallbacks.delete(cb)
  }

  public onSelectedMove(cb: (lonLat: [number, number], info: DroneInfo) => void): () => void {
    this.selectedMoveCallbacks.add(cb)
    return () => this.selectedMoveCallbacks.delete(cb)
  }

  public onFollowChange(cb: (following: boolean) => void): () => void {
    this.followChangeCallbacks.add(cb)
    return () => this.followChangeCallbacks.delete(cb)
  }

  public getDroneList(): DroneInfo[] {
    const list: DroneInfo[] = []
    this.droneMap.forEach((entity) => list.push(entity.getInfo()))
    return list
  }

  public toggleLayer(visible: boolean): void {
    this.droneLayer.setVisible(visible)
    this.trailLayer.setVisible(visible)
    this.missionLayer.setVisible(visible)
  }

  private startAnimationLoop(): void {
    const loop = (timestamp: number) => {
      if (!this.isRunning) return

      if (this.lastFrameTime === 0) this.lastFrameTime = timestamp
      const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1)
      this.lastFrameTime = timestamp

      // Advance physics and waypoints of every drone
      this.droneMap.forEach((entity) => {
        entity.stepPhysics(dt)
      })

      this.map?.render()

      // Notify selected drone live movement at 60fps
      if (this.selectedDroneId) {
        const selectedEntity = this.droneMap.get(this.selectedDroneId)
        if (selectedEntity) {
          const lonLat = selectedEntity.currentLonLat
          this.selectedMoveCallbacks.forEach((cb) => cb(lonLat, selectedEntity.getInfo()))

          // Auto camera follow
          if (this.followSelected && this.map) {
            const view = this.map.getView()
            if (view.getInteracting()) {
              this.setFollowSelected(false)
            } else if (!view.getAnimating()) {
              view.setCenter(fromLonLat(lonLat))
            }
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(loop)
    }

    this.animationFrameId = requestAnimationFrame(loop)
  }

  private clearHover(): void {
    if (this.hoveredDroneId && this.droneMap.has(this.hoveredDroneId)) {
      this.droneMap.get(this.hoveredDroneId)!.setHovered(false)
      this.hoveredDroneId = null
    }
  }

  private notifySelect(info: DroneInfo | null): void {
    this.selectCallbacks.forEach((cb) => cb(info))
  }

  private notifyFollowChange(following: boolean): void {
    this.followChangeCallbacks.forEach((cb) => cb(following))
  }

  /**
   * Seed realistic active drone operations in Hsinchu / Science Park / Coast / Dams
   */
  private seedInitialFleet(centerLat: number, centerLon: number): void {
    const fleetData: DroneInfo[] = [
      {
        id: 'UAV-NCHC-01',
        callsign: '國網巡檢01號',
        remoteId: 'CAA-TW-849201',
        model: 'DJI Matrice 350 RTK',
        operator: '國研院國網中心 (NCHC)',
        missionType: '園區伺服器高壓電塔巡檢',
        status: '任務巡檢',
        latitude: centerLat + 0.0035,
        longitude: centerLon - 0.002,
        altitudeAglMeters: 65,
        altitudeAglFeet: 213,
        speedKmh: 36,
        heading: 45,
        verticalRateMps: 0,
        batteryPercent: 88,
        linkQuality: 98,
        satellites: 26,
        homeCoordinate: [centerLon, centerLat],
        waypoints: [
          [centerLon - 0.005, centerLat + 0.002],
          [centerLon + 0.004, centerLat + 0.006],
          [centerLon + 0.008, centerLat - 0.001],
          [centerLon - 0.002, centerLat - 0.004],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-ITRI-02',
        callsign: '工研自主02號',
        remoteId: 'CAA-TW-710492',
        model: 'Flyby VTOL Express',
        operator: '工研院資通所 (ITRI)',
        missionType: '竹科B2B緊急晶圓物資遞送',
        status: '巡航中',
        latitude: centerLat - 0.012,
        longitude: centerLon + 0.015,
        altitudeAglMeters: 92,
        altitudeAglFeet: 301,
        speedKmh: 58,
        heading: 210,
        verticalRateMps: 0,
        batteryPercent: 74,
        linkQuality: 92,
        satellites: 24,
        homeCoordinate: [centerLon + 0.015, centerLat - 0.012],
        waypoints: [
          [centerLon + 0.015, centerLat - 0.012],
          [centerLon + 0.008, centerLat - 0.025],
          [centerLon - 0.01, centerLat - 0.018],
          [centerLon + 0.002, centerLat - 0.006],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-WATER-03',
        callsign: '寶山水保03號',
        remoteId: 'CAA-TW-938210',
        model: 'Skydio X2D Enterprise',
        operator: '北區水資源局',
        missionType: '寶山水庫水質與集水區巡查',
        status: '任務巡檢',
        latitude: 24.745,
        longitude: 121.035,
        altitudeAglMeters: 78,
        altitudeAglFeet: 255,
        speedKmh: 28,
        heading: 320,
        verticalRateMps: 0,
        batteryPercent: 65,
        linkQuality: 89,
        satellites: 22,
        homeCoordinate: [121.035, 24.745],
        waypoints: [
          [121.035, 24.745],
          [121.042, 24.752],
          [121.028, 24.758],
          [121.022, 24.748],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-COAST-04',
        callsign: '南寮海巡04號',
        remoteId: 'CAA-TW-605823',
        model: 'Thunder Tiger VTOL Sirius',
        operator: '海巡署艦隊分隊',
        missionType: '新竹漁港外海空域安全巡弋',
        status: '巡航中',
        latitude: 24.852,
        longitude: 120.922,
        altitudeAglMeters: 110,
        altitudeAglFeet: 360,
        speedKmh: 64,
        heading: 15,
        verticalRateMps: 0,
        batteryPercent: 82,
        linkQuality: 95,
        satellites: 25,
        homeCoordinate: [120.922, 24.852],
        waypoints: [
          [120.915, 24.84],
          [120.908, 24.87],
          [120.935, 24.885],
          [120.942, 24.855],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-FIRE-05',
        callsign: '消防應變05號',
        remoteId: 'CAA-TW-519284',
        model: 'Autel EVO Max 4T',
        operator: '新竹市消防局災防中心',
        missionType: '市區高樓火警紅外線空拍待命',
        status: '定點懸停',
        latitude: 24.808,
        longitude: 120.975,
        altitudeAglMeters: 55,
        altitudeAglFeet: 180,
        speedKmh: 4,
        heading: 90,
        verticalRateMps: 0,
        batteryPercent: 91,
        linkQuality: 99,
        satellites: 27,
        homeCoordinate: [120.975, 24.808],
        waypoints: [
          [120.975, 24.808],
          [120.982, 24.812],
          [120.968, 24.815],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
    ]

    fleetData.forEach((data) => {
      const entity = new DroneEntity(data)
      this.droneMap.set(data.id, entity)
      this.droneSource.addFeature(entity.getDroneFeature())
      this.trailSource.addFeature(entity.getTrailFeature())
      this.missionSource.addFeature(entity.getMissionFeature())
    })
  }
}
