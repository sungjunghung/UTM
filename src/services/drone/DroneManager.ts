import type OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import type { EventsKey } from 'ol/events'
import { DroneEntity } from './DroneEntity'
import type { DroneInfo, DroneManagerOptions } from './types'
import type { CollisionRisk } from './collisionTypes'
import { calculateCpaRisk } from './collisionService'
import { createConflictPointStyle, createConflictVectorStyle } from './conflictStyles'

export class DroneManager {
  private map: OlMap | null = null
  private droneSource = new VectorSource()
  private trailSource = new VectorSource()
  private missionSource = new VectorSource()
  private conflictSource = new VectorSource()

  private droneLayer: VectorLayer<VectorSource>
  private trailLayer: VectorLayer<VectorSource>
  private missionLayer: VectorLayer<VectorSource>
  private conflictLayer: VectorLayer<VectorSource>

  private droneMap = new Map<string, DroneEntity>()
  private selectedDroneId: string | null = null
  private hoveredDroneId: string | null = null
  private followSelected: boolean = false

  private singleClickKey: EventsKey | null = null
  private pointerMoveKey: EventsKey | null = null
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private isRunning: boolean = false

  // CPA Collision Detection State
  private collisionRisks: CollisionRisk[] = []
  private isSimulatingConflict: boolean = false

  // Callbacks
  private updateCallbacks: Set<(list: DroneInfo[]) => void> = new Set()
  private selectCallbacks: Set<(info: DroneInfo | null) => void> = new Set()
  private selectedMoveCallbacks: Set<(lonLat: [number, number], info: DroneInfo) => void> = new Set()
  private followChangeCallbacks: Set<(following: boolean) => void> = new Set()
  private collisionCallbacks: Set<(risks: CollisionRisk[]) => void> = new Set()

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

    this.conflictLayer = new VectorLayer({
      source: this.conflictSource,
      zIndex: 55, // Render above mission/trails, below drone reticles
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
    this.map.addLayer(this.conflictLayer)
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
      this.map.removeLayer(this.conflictLayer)
      this.map.removeLayer(this.trailLayer)
      this.map.removeLayer(this.missionLayer)
      this.map = null
    }

    this.droneMap.clear()
    this.droneSource.clear()
    this.trailSource.clear()
    this.missionSource.clear()
    this.conflictSource.clear()
    this.updateCallbacks.clear()
    this.selectCallbacks.clear()
    this.selectedMoveCallbacks.clear()
    this.followChangeCallbacks.clear()
    this.collisionCallbacks.clear()
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

  public onCollisionAlerts(cb: (risks: CollisionRisk[]) => void): () => void {
    this.collisionCallbacks.add(cb)
    cb(this.collisionRisks)
    return () => this.collisionCallbacks.delete(cb)
  }

  public getDroneList(): DroneInfo[] {
    const list: DroneInfo[] = []
    this.droneMap.forEach((entity) => list.push(entity.getInfo()))
    return list
  }

  public getCollisionRisks(): CollisionRisk[] {
    return this.collisionRisks
  }

  public isConflictSimulationActive(): boolean {
    return this.isSimulatingConflict
  }

  public toggleLayer(visible: boolean): void {
    this.droneLayer.setVisible(visible)
    this.trailLayer.setVisible(visible)
    this.missionLayer.setVisible(visible)
    this.conflictLayer.setVisible(visible)
  }

  /**
   * Interactive Simulator: Trigger 2 simultaneous collision path encounters
   * Encounter 1: UAV-01 vs UAV-02 (Hsinchu Science Park)
   * Encounter 2: UAV-08 vs UAV-06 (Interchange / Guangfu Rd)
   */
  public triggerConflictSimulation(): void {
    const d1 = this.droneMap.get('UAV-NCHC-01')
    const d2 = this.droneMap.get('UAV-ITRI-02')
    const d8 = this.droneMap.get('UAV-POLICE-08')
    const d6 = this.droneMap.get('UAV-MED-06')
    if (!d1 || !d2) return

    this.isSimulatingConflict = true

    // --- Collision Encounter 1: Hsinchu Science Park [121.006, 24.787] ---
    const center1: [number, number] = [121.006, 24.787]
    d1.currentLonLat = [center1[0] - 0.0030, center1[1] - 0.0005]
    d1.speedKmh = 42
    d1.heading = 80
    d1.altitudeAglMeters = 72
    d1.trail = []
    d1.waypoints = [
      [center1[0] + 0.004, center1[1] + 0.001],
      [center1[0] - 0.004, center1[1] - 0.001],
    ]

    d2.currentLonLat = [center1[0] + 0.0030, center1[1] + 0.0005]
    d2.speedKmh = 45
    d2.heading = 260
    d2.altitudeAglMeters = 74
    d2.trail = []
    d2.waypoints = [
      [center1[0] - 0.004, center1[1] - 0.001],
      [center1[0] + 0.004, center1[1] + 0.001],
    ]

    // --- Collision Encounter 2: Interchange / Guangfu Rd [121.020, 24.798] ---
    if (d8 && d6) {
      const center2: [number, number] = [121.020, 24.798]
      // UAV-08 (Police) coming from SSW heading NNE
      d8.currentLonLat = [center2[0] - 0.0018, center2[1] - 0.0028]
      d8.speedKmh = 40
      d8.heading = 32
      d8.altitudeAglMeters = 86
      d8.trail = []
      d8.waypoints = [
        [center2[0] + 0.0025, center2[1] + 0.0040],
        [center2[0] - 0.0025, center2[1] - 0.0040],
      ]

      // UAV-06 (Medical) coming from ENE heading WSW
      d6.currentLonLat = [center2[0] + 0.0032, center2[1] + 0.0012]
      d6.speedKmh = 46
      d6.heading = 248
      d6.altitudeAglMeters = 88
      d6.trail = []
      d6.waypoints = [
        [center2[0] - 0.0040, center2[1] - 0.0020],
        [center2[0] + 0.0040, center2[1] + 0.0020],
      ]
    }

    // Pan map to overview both conflict zones simultaneously
    if (this.map) {
      const overviewCenter: [number, number] = [121.013, 24.7925]
      this.map.getView().animate({
        center: fromLonLat(overviewCenter),
        zoom: 14.8,
        duration: 600,
      })
    }
  }

  /**
   * Reset drones back to standard peacetime autonomous mission patrols
   */
  public resetSimulation(): void {
    this.isSimulatingConflict = false
    this.conflictSource.clear()
    this.collisionRisks = []
    this.droneMap.forEach((d) => d.setAlertSeverity('clear'))

    // Re-seed fleet
    this.droneMap.forEach((entity) => {
      this.droneSource.removeFeature(entity.getDroneFeature())
      this.trailSource.removeFeature(entity.getTrailFeature())
      this.missionSource.removeFeature(entity.getMissionFeature())
    })
    this.droneMap.clear()
    this.seedInitialFleet(24.7887, 121.0028)
    this.notifyUpdate()
    this.collisionCallbacks.forEach((cb) => cb([]))
  }

  private startAnimationLoop(): void {
    let lastCpaCalculationTime = 0

    const loop = (timestamp: number) => {
      if (!this.isRunning) return

      if (this.lastFrameTime === 0) this.lastFrameTime = timestamp
      const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1)
      this.lastFrameTime = timestamp

      // 1. Advance physics and waypoints of every drone (60 FPS)
      this.droneMap.forEach((entity) => {
        entity.stepPhysics(dt)
      })

      // 2. Real-time Predictive CPA Collision Avoidance Calculation (~10 Hz)
      if (timestamp - lastCpaCalculationTime > 100) {
        lastCpaCalculationTime = timestamp
        this.runCollisionDetection()
      }

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

  /**
   * Multi-drone pair-wise CPA calculation & GIS vector overlay update
   */
  private runCollisionDetection(): void {
    const entities = Array.from(this.droneMap.values())
    const risks: CollisionRisk[] = []
    const alertMap = new Map<string, 'clear' | 'advisory' | 'warning' | 'critical'>()

    // Initialize all to clear
    entities.forEach((e) => alertMap.set(e.id, 'clear'))

    // Pairwise calculation: O(N^2 / 2)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i]
        const b = entities[j]
        const risk = calculateCpaRisk(a, b, 30)
        if (risk) {
          risks.push(risk)

          // Update drone alert severity to worst case
          const rank = { clear: 0, advisory: 1, warning: 2, critical: 3 }
          const curA = alertMap.get(a.id) || 'clear'
          const curB = alertMap.get(b.id) || 'clear'
          if (rank[risk.severity] > rank[curA]) alertMap.set(a.id, risk.severity)
          if (rank[risk.severity] > rank[curB]) alertMap.set(b.id, risk.severity)
        }
      }
    }

    // Apply alert status to drone entities for map halo & styling
    entities.forEach((e) => {
      const sev = alertMap.get(e.id) || 'clear'
      e.setAlertSeverity(sev)
    })

    this.collisionRisks = risks
    this.updateConflictLayerFeatures(risks)
    this.collisionCallbacks.forEach((cb) => cb(risks))
  }

  /**
   * Render dynamic collision rays, conflict points, and CPA countdowns on OpenLayers map
   */
  private updateConflictLayerFeatures(risks: CollisionRisk[]): void {
    this.conflictSource.clear()

    risks.forEach((risk) => {
      const dA = this.droneMap.get(risk.droneAId)
      const dB = this.droneMap.get(risk.droneBId)
      if (!dA || !dB) return

      const posA = fromLonLat(dA.currentLonLat)
      const posB = fromLonLat(dB.currentLonLat)
      const posCpa = fromLonLat(risk.cpaCoordinate)

      // 1. Predictive Trajectory Vector Ray for Drone A to CPA point
      const lineAFeature = new Feature({
        geometry: new LineString([posA, posCpa]),
      })
      lineAFeature.setStyle(createConflictVectorStyle(risk.severity))
      this.conflictSource.addFeature(lineAFeature)

      // 2. Predictive Trajectory Vector Ray for Drone B to CPA point
      const lineBFeature = new Feature({
        geometry: new LineString([posB, posCpa]),
      })
      lineBFeature.setStyle(createConflictVectorStyle(risk.severity))
      this.conflictSource.addFeature(lineBFeature)

      // 3. Predicted Collision Point / Reticle marker with countdown & distance tag
      const pointFeature = new Feature({
        geometry: new Point(posCpa),
      })
      pointFeature.setStyle(
        createConflictPointStyle(risk.severity, risk.timeToCpaSeconds, risk.cpaDistanceMeters)
      )
      this.conflictSource.addFeature(pointFeature)
    })
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

  private notifyUpdate(): void {
    const list = this.getDroneList()
    this.updateCallbacks.forEach((cb) => cb(list))
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
      {
        id: 'UAV-MED-06',
        callsign: '台大生醫06號',
        remoteId: 'CAA-TW-384192',
        model: 'DJI Inspire 3 RTK',
        operator: '台大生醫醫院',
        missionType: '生醫園區急重症檢體冷鏈直送',
        status: '任務巡檢',
        latitude: 24.812,
        longitude: 121.035,
        altitudeAglMeters: 85,
        altitudeAglFeet: 279,
        speedKmh: 48,
        heading: 245,
        verticalRateMps: 0,
        batteryPercent: 93,
        linkQuality: 96,
        satellites: 26,
        homeCoordinate: [121.035, 24.812],
        waypoints: [
          [121.042, 24.818],
          [121.025, 24.805],
          [121.015, 24.795],
          [121.038, 24.810],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-GRID-07',
        callsign: '台電輸電07號',
        remoteId: 'CAA-TW-492816',
        model: '翔儀 VTOL Defender',
        operator: '台灣電力公司供電處',
        missionType: '新竹超高壓變電所電網熱影像稽查',
        status: '巡航中',
        latitude: 24.768,
        longitude: 121.052,
        altitudeAglMeters: 98,
        altitudeAglFeet: 321,
        speedKmh: 52,
        heading: 310,
        verticalRateMps: 0,
        batteryPercent: 78,
        linkQuality: 91,
        satellites: 23,
        homeCoordinate: [121.052, 24.768],
        waypoints: [
          [121.052, 24.768],
          [121.038, 24.782],
          [121.020, 24.770],
          [121.045, 24.755],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-POLICE-08',
        callsign: '警航交管08號',
        remoteId: 'CAA-TW-820155',
        model: 'DJI Matrice 30T',
        operator: '新竹縣市科技執法組',
        missionType: '國道一號竹科交流道尖峰車流監控',
        status: '任務巡檢',
        latitude: 24.792,
        longitude: 121.012,
        altitudeAglMeters: 88,
        altitudeAglFeet: 288,
        speedKmh: 40,
        heading: 35,
        verticalRateMps: 0,
        batteryPercent: 86,
        linkQuality: 97,
        satellites: 28,
        homeCoordinate: [121.012, 24.792],
        waypoints: [
          [121.012, 24.792],
          [121.022, 24.805],
          [121.010, 24.815],
          [121.005, 24.798],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-AGRI-09',
        callsign: '農業植保09號',
        remoteId: 'CAA-TW-174829',
        model: 'DJI Agras T40',
        operator: '農業部智慧農業示範場',
        missionType: '北埔茶園高光譜病蟲害即時監測',
        status: '定點懸停',
        latitude: 24.720,
        longitude: 121.060,
        altitudeAglMeters: 45,
        altitudeAglFeet: 147,
        speedKmh: 12,
        heading: 180,
        verticalRateMps: 0,
        batteryPercent: 68,
        linkQuality: 88,
        satellites: 21,
        homeCoordinate: [121.060, 24.720],
        waypoints: [
          [121.060, 24.720],
          [121.065, 24.715],
          [121.055, 24.718],
          [121.058, 24.725],
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
