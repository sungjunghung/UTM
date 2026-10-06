import type OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat, toLonLat } from 'ol/proj'
import type { EventsKey } from 'ol/events'
import { DroneEntity } from './DroneEntity'
import type { DroneInfo, DroneManagerOptions } from './types'
import type { CollisionRisk } from './collisionTypes'
import { calculateCpaRisk } from './collisionService'
import { checkAirspaceViolations } from './airspaceAlertService'
import {
  createConflictPointStyle,
  createConflictVectorStyle,
  createThreatZoneStyles,
  createThreatConnectorStyle,
} from './conflictStyles'
import { getRealCaaZoneGeometry, getRealCaaZoneProperties } from '../airspace/monitoredAirspacePolygons'
import { buildAirspaceZoneInfo } from '../airspace/zoneInfo'
import type { AirspaceZoneInfo } from '../airspace/types'

export class DroneManager {
  private map: OlMap | null = null
  private droneSource = new VectorSource()
  private trailSource = new VectorSource()
  private missionSource = new VectorSource()
  private conflictSource = new VectorSource()
  private threatZoneSource = new VectorSource()

  private droneLayer: VectorLayer<VectorSource>
  private trailLayer: VectorLayer<VectorSource>
  private missionLayer: VectorLayer<VectorSource>
  private conflictLayer: VectorLayer<VectorSource>
  private threatZoneLayer: VectorLayer<VectorSource>

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
  private zoneSelectCallbacks: Set<(info: AirspaceZoneInfo | null) => void> = new Set()

  constructor(options: DroneManagerOptions = {}) {
    this.threatZoneLayer = new VectorLayer({
      source: this.threatZoneSource,
      zIndex: 32, // Renders dynamically highlighted airspace zones below trails/conflict vectors
    })

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

    this.seedInitialFleet(options.centerLat ?? 24.745, options.centerLon ?? 121.035)
  }

  public attachToMap(map: OlMap): void {
    this.map = map
    this.map.addLayer(this.threatZoneLayer)
    this.map.addLayer(this.missionLayer)
    this.map.addLayer(this.trailLayer)
    this.map.addLayer(this.conflictLayer)
    this.map.addLayer(this.droneLayer)

    // Single click on drone (priority) or on a highlighted threat zone (違規警示空域)
    this.singleClickKey = this.map.on('singleclick', (evt) => {
      let clickedId: string | null = null
      let clickedZoneProps: Record<string, any> | null = null
      this.map?.forEachFeatureAtPixel(
        evt.pixel,
        (feature, layer) => {
          if (layer === this.droneLayer) {
            const id = feature.get('id')
            if (id) {
              clickedId = id
              return true
            }
          } else if (layer === this.threatZoneLayer && !clickedZoneProps) {
            clickedZoneProps = feature.get('zoneProps') || null
          }
        },
        { hitTolerance: 10 }
      )

      if (clickedId) {
        this.selectDrone(clickedId)
      }

      const zoneInfo =
        !clickedId && clickedZoneProps
          ? buildAirspaceZoneInfo(clickedZoneProps, toLonLat(evt.coordinate) as [number, number])
          : null
      this.zoneSelectCallbacks.forEach((cb) => cb(zoneInfo))
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
    this.collisionRisks = []
    this.collisionCallbacks.forEach((cb) => cb([]))
    this.conflictSource.clear()
    this.threatZoneSource.clear()
  }

  public destroy(): void {
    this.stop()
    if (this.singleClickKey) this.singleClickKey = null
    if (this.pointerMoveKey) this.pointerMoveKey = null

    if (this.map) {
      this.map.removeLayer(this.droneLayer)
      this.map.removeLayer(this.conflictLayer)
      this.map.removeLayer(this.threatZoneLayer)
      this.map.removeLayer(this.trailLayer)
      this.map.removeLayer(this.missionLayer)
      this.map = null
    }

    this.droneMap.clear()
    this.droneSource.clear()
    this.trailSource.clear()
    this.missionSource.clear()
    this.conflictSource.clear()
    this.threatZoneSource.clear()
    this.updateCallbacks.clear()
    this.selectCallbacks.clear()
    this.selectedMoveCallbacks.clear()
    this.followChangeCallbacks.clear()
    this.collisionCallbacks.clear()
    this.zoneSelectCallbacks.clear()
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

  /** Fired on every map click: zone info when a highlighted threat zone is clicked, otherwise null */
  public onZoneSelect(cb: (info: AirspaceZoneInfo | null) => void): () => void {
    this.zoneSelectCallbacks.add(cb)
    return () => this.zoneSelectCallbacks.delete(cb)
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
    this.threatZoneLayer.setVisible(visible)
    if (!visible) {
      this.collisionRisks = []
      this.collisionCallbacks.forEach((cb) => cb([]))
      this.conflictSource.clear()
      this.threatZoneSource.clear()
    }
  }

  /**
   * Interactive Simulator: Trigger 2 simultaneous collision path encounters
   * Encounter 1: UAV-01 vs UAV-02 (Baoshan Green Zone / 非管制空域 ≤120m)
   * Encounter 2: UAV-08 vs UAV-06 (Zhudong Erchong Yellow Zone / 限航區 ≤60m)
   */
  public triggerConflictSimulation(): void {
    const d1 = this.droneMap.get('UAV-NCHC-01')
    const d2 = this.droneMap.get('UAV-ITRI-02')
    const d8 = this.droneMap.get('UAV-POLICE-08')
    const d6 = this.droneMap.get('UAV-MED-06')
    if (!d1 || !d2) return

    this.isSimulatingConflict = true

    // --- Collision Encounter 1: Baoshan Green Zone [121.028, 24.742] ---
    const center1: [number, number] = [121.028, 24.742]
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

    // --- Collision Encounter 2: Zhudong Erchong Yellow Zone [121.049, 24.771] ---
    // In Yellow Zone, altitude is strictly simulated at <= 60m (54m vs 56m)
    if (d8 && d6) {
      const center2: [number, number] = [121.049, 24.771]
      // UAV-08 (Police) coming from SSW heading NNE
      d8.currentLonLat = [center2[0] - 0.0015, center2[1] - 0.0025]
      d8.speedKmh = 40
      d8.heading = 35
      d8.altitudeAglMeters = 54 // Accurate Yellow zone altitude <= 60m
      d8.trail = []
      d8.waypoints = [
        [center2[0] + 0.0025, center2[1] + 0.0030],
        [center2[0] - 0.0025, center2[1] - 0.0030],
      ]

      // UAV-06 (Medical) coming from ENE heading WSW
      d6.currentLonLat = [center2[0] + 0.0025, center2[1] + 0.0015]
      d6.speedKmh = 44
      d6.heading = 225
      d6.altitudeAglMeters = 56 // Accurate Yellow zone altitude <= 60m
      d6.trail = []
      d6.waypoints = [
        [center2[0] - 0.0030, center2[1] - 0.0020],
        [center2[0] + 0.0030, center2[1] + 0.0020],
      ]
    }

    // Pan map to overview both conflict zones simultaneously
    if (this.map) {
      const overviewCenter: [number, number] = [121.038, 24.756]
      this.map.getView().animate({
        center: fromLonLat(overviewCenter),
        zoom: 13.8,
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
    this.threatZoneSource.clear()
    this.collisionRisks = []
    this.droneMap.forEach((d) => d.setAlertSeverity('clear'))

    // Re-seed fleet
    this.droneMap.forEach((entity) => {
      this.droneSource.removeFeature(entity.getDroneFeature())
      this.trailSource.removeFeature(entity.getTrailFeature())
      this.missionSource.removeFeature(entity.getMissionFeature())
    })
    this.droneMap.clear()
    this.seedInitialFleet(24.745, 121.035)
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

    // 1. Pairwise CPA collision calculation: O(N^2 / 2)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i]
        const b = entities[j]
        const risk = calculateCpaRisk(a, b, 30)
        if (risk) {
          risk.type = 'collision'
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

    // 2. Real-time Airspace Geofence & Altitude Violations (誤闖禁航區 / 誤觸限航區上限)
    const airspaceAlerts = checkAirspaceViolations(entities)
    airspaceAlerts.forEach((alert) => {
      const rank = { clear: 0, advisory: 1, warning: 2, critical: 3 }
      const cur = alertMap.get(alert.droneAId) || 'clear'
      if (rank[alert.severity] > rank[cur]) {
        alertMap.set(alert.droneAId, alert.severity)
      }
    })

    // Apply worst-case alert status to drone entities for map halo & styling
    entities.forEach((e) => {
      const sev = alertMap.get(e.id) || 'clear'
      e.setAlertSeverity(sev)
    })

    const allAlerts: CollisionRisk[] = [...risks, ...airspaceAlerts]
    this.collisionRisks = allAlerts
    this.updateConflictLayerFeatures(risks)
    this.updateThreatZoneFeatures(airspaceAlerts)
    this.collisionCallbacks.forEach((cb) => cb(allAlerts))
  }

  /**
   * Render dynamic collision rays, conflict points, and CPA countdowns on OpenLayers map
   */
  private updateConflictLayerFeatures(risks: CollisionRisk[]): void {
    this.conflictSource.clear()

    risks.forEach((risk) => {
      if (!risk.droneBId) return
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
        createConflictPointStyle(risk.severity, risk.timeToCpaSeconds ?? 0, risk.cpaDistanceMeters ?? 0)
      )
      this.conflictSource.addFeature(pointFeature)
    })
  }

  /**
   * Render dynamic threatened airspace zones (即將誤觸或已入侵的民航局禁限航區) using authentic CAA polygon boundaries
   * NEVER draws artificial circles: strictly renders the real polygon geometry of the designated zone!
   * Once alerts clear, threatZoneSource is completely emptied so the zone immediately disappears from the map.
   */
  private updateThreatZoneFeatures(alerts: CollisionRisk[]): void {
    this.threatZoneSource.clear()
    if (!alerts || alerts.length === 0) {
      return // 解除後立即消失！
    }

    const renderedZoneKeys = new Set<string>()

    alerts.forEach((alert) => {
      const zoneKey = alert.zoneName || alert.id
      if (!renderedZoneKeys.has(zoneKey)) {
        renderedZoneKeys.add(zoneKey)

        // 1. Retrieve the EXACT Civil Aeronautics Administration (CAA) Polygon Geometry
        // 不是畫圈圈，直接呈現真實法定禁限航區多邊形！
        let zoneGeom = getRealCaaZoneGeometry(alert.zoneName || '')
        let zoneProps = getRealCaaZoneProperties(alert.zoneName || '')
        if (!zoneGeom && alert.id) {
          zoneGeom = getRealCaaZoneGeometry(alert.id)
          zoneProps = getRealCaaZoneProperties(alert.id)
        }

        if (zoneGeom) {
          const zoneFeature = new Feature({
            geometry: zoneGeom,
            id: `threat-zone-${alert.id}`,
            // Raw CAA attributes so clicking the highlighted zone opens the airspace detail card
            zoneProps: zoneProps ?? { 空域名稱: alert.zoneName, 限制區: alert.type === 'no-fly-zone' ? '紅區' : '黃區' },
          })
          zoneFeature.setStyle(createThreatZoneStyles(alert))
          this.threatZoneSource.addFeature(zoneFeature)
        }
      }

      // 2. Dynamic Trajectory Ray pointing from the offending drone towards the threatened zone center
      const drone = this.droneMap.get(alert.droneAId)
      if (drone && alert.zoneCenter) {
        const dronePosProj = fromLonLat(drone.currentLonLat)
        const zoneCenterProj = fromLonLat(alert.zoneCenter)
        const rayFeature = new Feature({
          geometry: new LineString([dronePosProj, zoneCenterProj]),
        })
        rayFeature.setStyle(createThreatConnectorStyle(alert))
        this.threatZoneSource.addFeature(rayFeature)
      }
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
   * Seed realistic active drone operations strictly OUTSIDE No-Fly Zones (禁航區/紅區)
   * Yellow Zone (限航區 ≤60m) and Green Zone (非管制空域 ≤120m) with accurate legal altitudes.
   */
  private seedInitialFleet(_centerLat?: number, _centerLon?: number): void {
    const fleetData: DroneInfo[] = [
      {
        id: 'UAV-NCHC-01',
        callsign: '國網巡檢01號',
        remoteId: 'CAA-TW-849201',
        model: 'DJI Matrice 350 RTK',
        operator: '國研院國網中心 (NCHC)',
        missionType: '寶山研發基地智慧巡檢',
        status: '任務巡檢',
        latitude: 24.745,
        longitude: 121.026,
        altitudeAglMeters: 68,
        altitudeAglFeet: 223,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 36,
        heading: 45,
        verticalRateMps: 0,
        batteryPercent: 88,
        linkQuality: 98,
        satellites: 26,
        homeCoordinate: [121.026, 24.745],
        waypoints: [
          [121.026, 24.745],
          [121.031, 24.748],
          [121.034, 24.741],
          [121.023, 24.739],
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
        missionType: '寶山至二重緊急物流走廊',
        status: '巡航中',
        latitude: 24.738,
        longitude: 121.035,
        altitudeAglMeters: 72,
        altitudeAglFeet: 236,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 54,
        heading: 210,
        verticalRateMps: 0,
        batteryPercent: 74,
        linkQuality: 92,
        satellites: 24,
        homeCoordinate: [121.035, 24.738],
        waypoints: [
          [121.035, 24.738],
          [121.040, 24.733],
          [121.031, 24.730],
          [121.025, 24.735],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-WATER-03',
        callsign: '二重環境03號',
        remoteId: 'CAA-TW-938210',
        model: 'Skydio X2D Enterprise',
        operator: '竹縣環保局水保科',
        missionType: '頭前溪南岸水質生態監測',
        status: '任務巡檢',
        latitude: 24.770,
        longitude: 121.050,
        altitudeAglMeters: 48, // Yellow Zone strictly <= 60m
        altitudeAglFeet: 157,
        airspaceZone: 'yellow',
        maxLegalAltitudeMeters: 60,
        zoneName: '竹縣32 二三重限航區',
        speedKmh: 28,
        heading: 320,
        verticalRateMps: 0,
        batteryPercent: 65,
        linkQuality: 89,
        satellites: 22,
        homeCoordinate: [121.050, 24.770],
        waypoints: [
          [121.050, 24.770],
          [121.054, 24.772],
          [121.052, 24.768],
          [121.046, 24.769],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-COAST-04',
        callsign: '北埔文資04號',
        remoteId: 'CAA-TW-605823',
        model: 'Thunder Tiger VTOL Sirius',
        operator: '文化資產維護組',
        missionType: '北埔老街文資聚落空拍巡檢',
        status: '巡航中',
        latitude: 24.702,
        longitude: 121.052,
        altitudeAglMeters: 52, // Yellow Zone strictly <= 60m
        altitudeAglFeet: 171,
        airspaceZone: 'yellow',
        maxLegalAltitudeMeters: 60,
        zoneName: '竹縣41 北埔限航區',
        speedKmh: 42,
        heading: 75,
        verticalRateMps: 0,
        batteryPercent: 82,
        linkQuality: 95,
        satellites: 25,
        homeCoordinate: [121.052, 24.702],
        waypoints: [
          [121.052, 24.702],
          [121.055, 24.704],
          [121.056, 24.699],
          [121.048, 24.698],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-FIRE-05',
        callsign: '寶山林防05號',
        remoteId: 'CAA-TW-519284',
        model: 'Autel EVO Max 4T',
        operator: '新竹縣消防局災防中心',
        missionType: '寶山林野山防熱成像待命',
        status: '定點懸停',
        latitude: 24.735,
        longitude: 121.018,
        altitudeAglMeters: 65,
        altitudeAglFeet: 213,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 6,
        heading: 90,
        verticalRateMps: 0,
        batteryPercent: 91,
        linkQuality: 99,
        satellites: 27,
        homeCoordinate: [121.018, 24.735],
        waypoints: [
          [121.018, 24.735],
          [121.022, 24.738],
          [121.015, 24.740],
          [121.012, 24.733],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-MED-06',
        callsign: '二重生醫06號',
        remoteId: 'CAA-TW-384192',
        model: 'DJI Inspire 3 RTK',
        operator: '生醫急救物流隊',
        missionType: '二重生醫急重症冷鏈直送',
        status: '任務巡檢',
        latitude: 24.772,
        longitude: 121.046,
        altitudeAglMeters: 56, // Yellow Zone strictly <= 60m
        altitudeAglFeet: 184,
        airspaceZone: 'yellow',
        maxLegalAltitudeMeters: 60,
        zoneName: '竹縣32 二三重限航區',
        speedKmh: 46,
        heading: 245,
        verticalRateMps: 0,
        batteryPercent: 93,
        linkQuality: 96,
        satellites: 26,
        homeCoordinate: [121.046, 24.772],
        waypoints: [
          [121.046, 24.772],
          [121.051, 24.773],
          [121.053, 24.769],
          [121.047, 24.768],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-GRID-07',
        callsign: '峨眉輸電07號',
        remoteId: 'CAA-TW-492816',
        model: '翔儀 VTOL Defender',
        operator: '台灣電力公司供電處',
        missionType: '峨眉超高壓電網走廊熱影像稽查',
        status: '巡航中',
        latitude: 24.680,
        longitude: 121.015,
        altitudeAglMeters: 95,
        altitudeAglFeet: 312,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '峨眉非管制空域',
        speedKmh: 52,
        heading: 310,
        verticalRateMps: 0,
        batteryPercent: 78,
        linkQuality: 91,
        satellites: 23,
        homeCoordinate: [121.015, 24.680],
        waypoints: [
          [121.015, 24.680],
          [121.022, 24.685],
          [121.026, 24.678],
          [121.012, 24.675],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-POLICE-08',
        callsign: '二重交管08號',
        remoteId: 'CAA-TW-820155',
        model: 'DJI Matrice 30T',
        operator: '竹東分局科技執法組',
        missionType: '中興路工研院路口車流監控',
        status: '任務巡檢',
        latitude: 24.771,
        longitude: 121.048,
        altitudeAglMeters: 54, // Yellow Zone strictly <= 60m
        altitudeAglFeet: 177,
        airspaceZone: 'yellow',
        maxLegalAltitudeMeters: 60,
        zoneName: '竹縣32 二三重限航區',
        speedKmh: 38,
        heading: 35,
        verticalRateMps: 0,
        batteryPercent: 86,
        linkQuality: 97,
        satellites: 28,
        homeCoordinate: [121.048, 24.771],
        waypoints: [
          [121.048, 24.771],
          [121.052, 24.774],
          [121.054, 24.770],
          [121.046, 24.770],
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
        latitude: 24.695,
        longitude: 121.070,
        altitudeAglMeters: 38,
        altitudeAglFeet: 125,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '北埔非管制空域',
        speedKmh: 12,
        heading: 180,
        verticalRateMps: 0,
        batteryPercent: 68,
        linkQuality: 88,
        satellites: 21,
        homeCoordinate: [121.070, 24.695],
        waypoints: [
          [121.070, 24.695],
          [121.075, 24.690],
          [121.066, 24.688],
          [121.068, 24.700],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-SURVEY-10',
        callsign: '寶山測繪10號',
        remoteId: 'CAA-TW-501832',
        model: 'DJI Matrice 300 RTK',
        operator: '地籍測量資訊中心',
        missionType: '寶山水資源高精地籍測繪 (循環示範：誤闖禁航區)',
        status: '任務巡檢',
        latitude: 24.7525,
        longitude: 121.0295,
        altitudeAglMeters: 72,
        altitudeAglFeet: 236,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 42,
        heading: 70,
        verticalRateMps: 0,
        batteryPercent: 84,
        linkQuality: 97,
        satellites: 26,
        homeCoordinate: [121.0295, 24.7525],
        // Autonomous continuous loop (~75s): Safe -> Approaching (Stage 1) -> Breached Red Zone (Stage 2) -> Exiting & Cleared -> Repeat
        waypoints: [
          [121.0295, 24.7525], // Safe outside 350m buffer (~630m to center, ~330m to boundary) -> Clear
          [121.0328, 24.7538], // Enters 350m buffer heading east -> Triggers Stage 1: Approaching Warning with live countdown!
          [121.0365, 24.7546], // Deep inside 寶山淨水廠 300m Red Zone -> Triggers Stage 2: Breached Critical (Depth 300m)!
          [121.0395, 24.7535], // Exits boundary flying away -> Alert instantly clears, threatened zone disappears!
          [121.0350, 24.7505], // Safe compliant return corridor
          [121.0295, 24.7525], // Loop start
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-INSPECT-11',
        callsign: '二重巡視11號',
        remoteId: 'CAA-TW-672914',
        model: 'Autel Alpha Enterprise',
        operator: '竹科工程監造組',
        missionType: '二三重都市計畫科技執法 (循環示範：限航區違規超高)',
        status: '任務巡檢',
        latitude: 24.7660,
        longitude: 121.0440,
        altitudeAglMeters: 42, // Compliant <= 60m
        altitudeAglFeet: 138,
        airspaceZone: 'yellow',
        maxLegalAltitudeMeters: 60,
        zoneName: '竹縣32 二三重限航區',
        speedKmh: 38,
        heading: 45,
        verticalRateMps: 0,
        batteryPercent: 79,
        linkQuality: 94,
        satellites: 24,
        homeCoordinate: [121.0440, 24.7660],
        // Autonomous continuous loop (~70s): Compliant (42m) -> Climbing Approaching (Stage 1, 56m) -> Breached Ceiling (Stage 2, 82m-85m) -> Descent Recovery (46m, Cleared) -> Repeat
        waypoints: [
          [121.0440, 24.7660, 42], // Compliant <= 60m (Clear, zone hidden)
          [121.0475, 24.7695, 56], // Climbs to 56m -> Triggers Stage 1: Approaching Ceiling Warning (距上限僅 4m)
          [121.0505, 24.7725, 82], // Climbs to 82m -> Triggers Stage 2: Breached Ceiling (超高幅度 +22m)
          [121.0535, 24.7705, 85], // 85m (Critical breach active)
          [121.0495, 24.7655, 46], // Glides down to 46m -> Recovers below 60m limit, alert clears, zone disappears!
          [121.0440, 24.7660, 42], // Compliant loop return
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-CARGO-12',
        callsign: '竹科物流12號',
        remoteId: 'CAA-TW-902341',
        model: 'Flyby VTOL Express',
        operator: '聯發科技物流隊',
        missionType: '竹科半導體晶圓快速接駁走廊',
        status: '巡航中',
        latitude: 24.765,
        longitude: 121.015,
        altitudeAglMeters: 75,
        altitudeAglFeet: 246,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 56,
        heading: 105,
        verticalRateMps: 0,
        batteryPercent: 90,
        linkQuality: 98,
        satellites: 27,
        homeCoordinate: [121.015, 24.765],
        waypoints: [
          [121.015, 24.765],
          [121.028, 24.762],
          [121.035, 24.758],
          [121.020, 24.759],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-RESCUE-13',
        callsign: '水域搜救13號',
        remoteId: 'CAA-TW-419820',
        model: 'Thunder Tiger Sirius',
        operator: '新竹縣水上救生協會',
        missionType: '寶山第二水庫水域搜救演習',
        status: '任務巡檢',
        latitude: 24.722,
        longitude: 121.058,
        altitudeAglMeters: 68,
        altitudeAglFeet: 223,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '寶山非管制空域',
        speedKmh: 46,
        heading: 40,
        verticalRateMps: 0,
        batteryPercent: 88,
        linkQuality: 96,
        satellites: 25,
        homeCoordinate: [121.058, 24.722],
        waypoints: [
          [121.058, 24.722],
          [121.062, 24.726],
          [121.056, 24.730],
          [121.052, 24.724],
        ],
        trail: [],
        lastSeen: Date.now(),
      },
      {
        id: 'UAV-POWER-14',
        callsign: '綠能風電14號',
        remoteId: 'CAA-TW-330198',
        model: 'Skydio X2D Enterprise',
        operator: '離岸風電運維組',
        missionType: '香山沿海離岸風場巡航稽查',
        status: '任務巡檢',
        latitude: 24.780,
        longitude: 120.925,
        altitudeAglMeters: 55,
        altitudeAglFeet: 180,
        airspaceZone: 'green',
        maxLegalAltitudeMeters: 120,
        zoneName: '香山沿海非管制空域',
        speedKmh: 44,
        heading: 30,
        verticalRateMps: 0,
        batteryPercent: 85,
        linkQuality: 93,
        satellites: 22,
        homeCoordinate: [120.925, 24.780],
        waypoints: [
          [120.925, 24.780],
          [120.932, 24.785],
          [120.935, 24.778],
          [120.922, 24.775],
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
