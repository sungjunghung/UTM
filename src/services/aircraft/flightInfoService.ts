/**
 * Flight Info & Route Resolution Service
 * Provides airline identification, route (origin -> destination) resolution,
 * and aircraft manufacturer details without requiring any API keys.
 */
import { apiUrl } from '../apiBase'

export interface AirlineInfo {
  code: string
  nameZh: string
  nameEn: string
  country: string
}

export interface AirportInfo {
  icao: string
  iata: string
  name: string
  city: string
  coordinate?: [number, number] // [lon, lat]
}

export interface RouteInfo {
  origin: AirportInfo
  destination: AirportInfo
  rawRoute: string
}

export interface AircraftDetails {
  manufacturer?: string
  fullType?: string
  operator?: string
}

// Built-in high-speed airline lookup table (0ms)
const AIRLINE_DATABASE: Record<string, { nameZh: string; nameEn: string; country: string }> = {
  // Taiwan
  EVA: { nameZh: '長榮航空', nameEn: 'EVA Air', country: '台灣' },
  CAL: { nameZh: '中華航空', nameEn: 'China Airlines', country: '台灣' },
  SJX: { nameZh: '星宇航空', nameEn: 'STARLUX Airlines', country: '台灣' },
  MDA: { nameZh: '華信航空', nameEn: 'Mandarin Airlines', country: '台灣' },
  TTW: { nameZh: '台灣虎航', nameEn: 'Tigerair Taiwan', country: '台灣' },
  UIA: { nameZh: '立榮航空', nameEn: 'UNI Air', country: '台灣' },

  // Hong Kong & Macau
  CPA: { nameZh: '國泰航空', nameEn: 'Cathay Pacific', country: '香港' },
  HKE: { nameZh: '香港快運', nameEn: 'HK Express', country: '香港' },
  CRK: { nameZh: '香港航空', nameEn: 'Hong Kong Airlines', country: '香港' },
  AHK: { nameZh: '華民航空', nameEn: 'Air Hong Kong', country: '香港' },
  AMU: { nameZh: '澳門航空', nameEn: 'Air Macau', country: '澳門' },

  // Japan
  JAL: { nameZh: '日本航空', nameEn: 'Japan Airlines', country: '日本' },
  ANA: { nameZh: '全日空', nameEn: 'All Nippon Airways', country: '日本' },
  APJ: { nameZh: '樂桃航空', nameEn: 'Peach Aviation', country: '日本' },
  JJP: { nameZh: '捷星日本', nameEn: 'Jetstar Japan', country: '日本' },
  SNJ: { nameZh: '空之子航空', nameEn: 'Solaseed Air', country: '日本' },
  SFJ: { nameZh: '星悅航空', nameEn: 'StarFlyer', country: '日本' },
  SKY: { nameZh: '天馬航空', nameEn: 'Skymark Airlines', country: '日本' },
  NCA: { nameZh: '日本貨物航空', nameEn: 'Nippon Cargo Airlines', country: '日本' },

  // South Korea
  KAL: { nameZh: '大韓航空', nameEn: 'Korean Air', country: '韓國' },
  AAR: { nameZh: '韓亞航空', nameEn: 'Asiana Airlines', country: '韓國' },
  JNA: { nameZh: '真航空', nameEn: 'Jin Air', country: '韓國' },
  TWB: { nameZh: '德威航空', nameEn: "T'way Air", country: '韓國' },
  ASR: { nameZh: '首爾航空', nameEn: 'Air Seoul', country: '韓國' },
  ABL: { nameZh: '釜山航空', nameEn: 'Air Busan', country: '韓國' },
  ESR: { nameZh: '易斯達航空', nameEn: 'Eastar Jet', country: '韓國' },
  JJA: { nameZh: '濟州航空', nameEn: 'Jeju Air', country: '韓國' },

  // Southeast Asia
  SIA: { nameZh: '新加坡航空', nameEn: 'Singapore Airlines', country: '新加坡' },
  SCO: { nameZh: '酷航', nameEn: 'Scoot', country: '新加坡' },
  MAS: { nameZh: '馬來西亞航空', nameEn: 'Malaysia Airlines', country: '馬來西亞' },
  AXM: { nameZh: '全亞航', nameEn: 'AirAsia', country: '馬來西亞' },
  MXD: { nameZh: '峇迪航空', nameEn: 'Batik Air', country: '馬來西亞' },
  THA: { nameZh: '泰國航空', nameEn: 'Thai Airways', country: '泰國' },
  BKP: { nameZh: '曼谷航空', nameEn: 'Bangkok Airways', country: '泰國' },
  HVN: { nameZh: '越南航空', nameEn: 'Vietnam Airlines', country: '越南' },
  VJC: { nameZh: '越捷航空', nameEn: 'VietJet Air', country: '越南' },
  BAV: { nameZh: '竹子航空', nameEn: 'Bamboo Airways', country: '越南' },
  PAL: { nameZh: '菲律賓航空', nameEn: 'Philippine Airlines', country: '菲律賓' },
  CEB: { nameZh: '宿霧太平洋航空', nameEn: 'Cebu Pacific', country: '菲律賓' },
  GIA: { nameZh: '印尼鷹航', nameEn: 'Garuda Indonesia', country: '印尼' },

  // Mainland China
  CES: { nameZh: '中國東方航空', nameEn: 'China Eastern', country: '中國' },
  CSN: { nameZh: '中國南方航空', nameEn: 'China Southern', country: '中國' },
  CCA: { nameZh: '中國國際航空', nameEn: 'Air China', country: '中國' },
  CHH: { nameZh: '海南航空', nameEn: 'Hainan Airlines', country: '中國' },
  CXA: { nameZh: '廈門航空', nameEn: 'XiamenAir', country: '中國' },
  CSZ: { nameZh: '深圳航空', nameEn: 'Shenzhen Airlines', country: '中國' },
  CSC: { nameZh: '四川航空', nameEn: 'Sichuan Airlines', country: '中國' },
  DKH: { nameZh: '吉祥航空', nameEn: 'Juneyao Airlines', country: '中國' },
  CQH: { nameZh: '春秋航空', nameEn: 'Spring Airlines', country: '中國' },

  // Cargo & North America / Europe / Middle East
  FDX: { nameZh: '聯邦快遞', nameEn: 'FedEx Express', country: '美國' },
  UPS: { nameZh: '優比速', nameEn: 'UPS Airlines', country: '美國' },
  GTI: { nameZh: '亞特拉斯航空', nameEn: 'Atlas Air', country: '美國' },
  PAC: { nameZh: '極地航空', nameEn: 'Polar Air Cargo', country: '美國' },
  UAL: { nameZh: '聯合航空', nameEn: 'United Airlines', country: '美國' },
  DAL: { nameZh: '達美航空', nameEn: 'Delta Air Lines', country: '美國' },
  AAL: { nameZh: '美國航空', nameEn: 'American Airlines', country: '美國' },
  ACA: { nameZh: '加拿大航空', nameEn: 'Air Canada', country: '加拿大' },
  KLM: { nameZh: '荷蘭皇家航空', nameEn: 'KLM', country: '荷蘭' },
  AFR: { nameZh: '法國航空', nameEn: 'Air France', country: '法國' },
  DLH: { nameZh: '漢莎航空', nameEn: 'Lufthansa', country: '德國' },
  BAW: { nameZh: '英國航空', nameEn: 'British Airways', country: '英國' },
  THY: { nameZh: '土耳其航空', nameEn: 'Turkish Airlines', country: '土耳其' },
  UAE: { nameZh: '阿聯酋航空', nameEn: 'Emirates', country: '阿聯酋' },
  QTR: { nameZh: '卡達航空', nameEn: 'Qatar Airways', country: '卡達' },
  ETD: { nameZh: '阿提哈德航空', nameEn: 'Etihad Airways', country: '阿聯酋' },
  QFA: { nameZh: '澳洲航空', nameEn: 'Qantas', country: '澳洲' },
  ANZ: { nameZh: '紐西蘭航空', nameEn: 'Air New Zealand', country: '紐西蘭' },
}

// Built-in high-speed airport lookup table with WGS84 coordinates (0ms)
const AIRPORT_DATABASE: Record<string, { iata: string; name: string; city: string; coordinate: [number, number] }> = {
  // Taiwan
  RCTP: { iata: 'TPE', name: '台北桃園國際機場', city: '台北/桃園', coordinate: [121.233, 25.0777] },
  RCSS: { iata: 'TSA', name: '台北松山機場', city: '台北', coordinate: [121.552, 25.0697] },
  RCKH: { iata: 'KHH', name: '高雄國際機場', city: '高雄', coordinate: [120.350, 22.5771] },
  RCMQ: { iata: 'RMQ', name: '台中國際機場', city: '台中', coordinate: [120.621, 24.2647] },
  RCQC: { iata: 'MZG', name: '澎湖馬公機場', city: '澎湖', coordinate: [119.629, 23.5678] },
  RCBS: { iata: 'KNH', name: '金門尚義機場', city: '金門', coordinate: [118.361, 24.4297] },
  RCFG: { iata: 'LZN', name: '馬祖南竿機場', city: '馬祖', coordinate: [119.958, 26.1594] },
  RCFS: { iata: 'MFK', name: '馬祖北竿機場', city: '馬祖', coordinate: [120.003, 26.2239] },
  RCFN: { iata: 'TTT', name: '台東機場', city: '台東', coordinate: [121.102, 22.7558] },
  RCKU: { iata: 'CYI', name: '嘉義機場', city: '嘉義', coordinate: [120.393, 23.4619] },
  RCNN: { iata: 'TNN', name: '台南機場', city: '台南', coordinate: [120.206, 22.9503] },
  RCKW: { iata: 'HCN', name: '恆春機場', city: '恆春', coordinate: [120.738, 22.0408] },
  RCPO: { iata: 'HCN', name: '新竹空軍基地', city: '新竹', coordinate: [120.943, 24.8183] },

  // Hong Kong & Macau
  VHHH: { iata: 'HKG', name: '香港國際機場', city: '香港', coordinate: [113.915, 22.3089] },
  VMMC: { iata: 'MFM', name: '澳門國際機場', city: '澳門', coordinate: [113.592, 22.1496] },

  // Japan
  RJTT: { iata: 'HND', name: '東京羽田國際機場', city: '東京', coordinate: [139.780, 35.5494] },
  RJAA: { iata: 'NRT', name: '東京成田國際機場', city: '東京', coordinate: [140.386, 35.7647] },
  RJBB: { iata: 'KIX', name: '大阪關西國際機場', city: '大阪', coordinate: [135.244, 34.4347] },
  RJOO: { iata: 'ITM', name: '大阪伊丹機場', city: '大阪', coordinate: [135.438, 34.7855] },
  RJGG: { iata: 'NGO', name: '名古屋中部國際機場', city: '名古屋', coordinate: [136.805, 34.8584] },
  RJFF: { iata: 'FUK', name: '福岡機場', city: '福岡', coordinate: [130.450, 33.5859] },
  RJCC: { iata: 'CTS', name: '札幌新千歲機場', city: '札幌', coordinate: [141.692, 42.7752] },
  ROAH: { iata: 'OKA', name: '沖繩那霸機場', city: '沖繩', coordinate: [127.646, 26.1958] },
  ROIG: { iata: 'ISG', name: '石垣機場', city: '石垣島', coordinate: [124.245, 24.3964] },
  RJSS: { iata: 'SDJ', name: '仙台機場', city: '仙台', coordinate: [140.917, 38.1397] },
  RJOT: { iata: 'TAK', name: '高松機場', city: '高松', coordinate: [134.015, 34.2142] },

  // South Korea
  RKSI: { iata: 'ICN', name: '首爾仁川國際機場', city: '首爾', coordinate: [126.451, 37.4602] },
  RKSS: { iata: 'GMP', name: '首爾金浦國際機場', city: '首爾', coordinate: [126.797, 37.5583] },
  RKPC: { iata: 'CJU', name: '濟州國際機場', city: '濟州', coordinate: [126.493, 33.5113] },
  RKPK: { iata: 'PUS', name: '釜山金海國際機場', city: '釜山', coordinate: [128.938, 35.1795] },
  RKTU: { iata: 'CJJ', name: '清州國際機場', city: '清州', coordinate: [127.499, 36.7166] },
  RKTN: { iata: 'TAE', name: '大邱國際機場', city: '大邱', coordinate: [128.659, 35.8941] },

  // Southeast Asia
  WSSS: { iata: 'SIN', name: '新加坡樟宜機場', city: '新加坡', coordinate: [103.991, 1.3644] },
  WMKK: { iata: 'KUL', name: '吉隆坡國際機場', city: '吉隆坡', coordinate: [101.710, 2.7456] },
  VTBS: { iata: 'BKK', name: '曼谷素萬那普機場', city: '曼谷', coordinate: [100.750, 13.6900] },
  VTBD: { iata: 'DMK', name: '曼谷廊曼機場', city: '曼谷', coordinate: [100.607, 13.9126] },
  VTSP: { iata: 'HKT', name: '普吉國際機場', city: '普吉', coordinate: [98.3064, 8.1132] },
  VVNB: { iata: 'HAN', name: '河內內排國際機場', city: '河內', coordinate: [105.807, 21.2212] },
  VVTS: { iata: 'SGN', name: '胡志明市新山一機場', city: '胡志明市', coordinate: [106.652, 10.8188] },
  VVDN: { iata: 'DAD', name: '峴港國際機場', city: '峴港', coordinate: [108.199, 16.0439] },
  RPLL: { iata: 'MNL', name: '馬尼拉國際機場', city: '馬尼拉', coordinate: [121.019, 14.5086] },
  RPLC: { iata: 'CRK', name: '克拉克國際機場', city: '克拉克', coordinate: [120.560, 15.1860] },
  RPMD: { iata: 'DVO', name: '達沃國際機場', city: '達沃', coordinate: [125.646, 7.1253] },

  // Mainland China
  ZSPD: { iata: 'PVG', name: '上海浦東國際機場', city: '上海', coordinate: [121.805, 31.1443] },
  ZSSS: { iata: 'SHA', name: '上海虹橋國際機場', city: '上海', coordinate: [121.336, 31.1979] },
  ZBAA: { iata: 'PEK', name: '北京首都國際機場', city: '北京', coordinate: [116.597, 40.0799] },
  ZBAD: { iata: 'PKX', name: '北京大興國際機場', city: '北京', coordinate: [116.410, 39.5098] },
  ZGGG: { iata: 'CAN', name: '廣州白雲國際機場', city: '廣州', coordinate: [113.299, 23.3924] },
  ZGSZ: { iata: 'SZX', name: '深圳寶安國際機場', city: '深圳', coordinate: [113.811, 22.6393] },
  ZSAM: { iata: 'XMN', name: '廈門高崎國際機場', city: '廈門', coordinate: [118.128, 24.5440] },
  ZSFT: { iata: 'FOC', name: '福州長樂國際機場', city: '福州', coordinate: [119.663, 25.9351] },
  ZUUU: { iata: 'CTU', name: '成都雙流國際機場', city: '成都', coordinate: [103.947, 30.5785] },
  ZUCK: { iata: 'CKG', name: '重慶江北國際機場', city: '重慶', coordinate: [106.642, 29.7192] },
  ZHHH: { iata: 'WUH', name: '武漢天河國際機場', city: '武漢', coordinate: [114.208, 30.7838] },
  ZSHC: { iata: 'HGH', name: '杭州蕭山國際機場', city: '杭州', coordinate: [120.434, 30.2295] },

  // Long Haul / America / Europe / Oceania / Middle East
  KLAX: { iata: 'LAX', name: '洛杉磯國際機場', city: '洛杉磯', coordinate: [-118.408, 33.9416] },
  KSFO: { iata: 'SFO', name: '舊金山國際機場', city: '舊金山', coordinate: [-122.375, 37.6188] },
  KJFK: { iata: 'JFK', name: '紐約甘迺迪國際機場', city: '紐約', coordinate: [-73.7781, 40.6413] },
  KSEA: { iata: 'SEA', name: '西雅圖國際機場', city: '西雅圖', coordinate: [-122.309, 47.4502] },
  KORD: { iata: 'ORD', name: '芝加哥歐哈爾機場', city: '芝加哥', coordinate: [-87.9073, 41.9742] },
  PHNL: { iata: 'HNL', name: '檀香山國際機場', city: '夏威夷', coordinate: [-157.922, 21.3187] },
  CYVR: { iata: 'YVR', name: '溫哥華國際機場', city: '溫哥華', coordinate: [-123.184, 49.1967] },
  CYYZ: { iata: 'YYZ', name: '多倫多皮爾遜機場', city: '多倫多', coordinate: [-79.6248, 43.6777] },
  EGLL: { iata: 'LHR', name: '倫敦希斯洛機場', city: '倫敦', coordinate: [-0.4543, 51.4700] },
  LFPG: { iata: 'CDG', name: '巴黎戴高樂機場', city: '巴黎', coordinate: [2.5500, 49.0097] },
  EDDF: { iata: 'FRA', name: '法蘭克福機場', city: '法蘭克福', coordinate: [8.5706, 50.0379] },
  EHAM: { iata: 'AMS', name: '阿姆斯特丹史基浦機場', city: '阿姆斯特丹', coordinate: [4.7639, 52.3105] },
  OMDB: { iata: 'DXB', name: '杜拜國際機場', city: '杜拜', coordinate: [55.3644, 25.2532] },
  OTHH: { iata: 'DOH', name: '杜哈哈馬德機場', city: '杜哈', coordinate: [51.6081, 25.2731] },
  YSSY: { iata: 'SYD', name: '雪梨國際機場', city: '雪梨', coordinate: [151.1772, -33.9461] },
  YMML: { iata: 'MEL', name: '墨爾本機場', city: '墨爾本', coordinate: [144.8433, -37.6733] },
  YBBN: { iata: 'BNE', name: '布里斯本機場', city: '布里斯本', coordinate: [153.1175, -27.3842] },
  NZAA: { iata: 'AKL', name: '奧克蘭國際機場', city: '奧克蘭', coordinate: [174.7922, -37.0082] },
}

class FlightInfoService {
  private routeCache = new Map<string, RouteInfo | null>()
  private aircraftCache = new Map<string, AircraftDetails | null>()
  private airportCache = new Map<string, AirportInfo>()
  private inFlightRoutes = new Map<string, Promise<RouteInfo | null>>()
  private inFlightAircraft = new Map<string, Promise<AircraftDetails | null>>()

  /**
   * Instantly resolve airline details from flight callsign in 0ms
   */
  public getAirline(flightCallsign: string): AirlineInfo | null {
    if (!flightCallsign) return null
    const clean = flightCallsign.trim().toUpperCase()
    // Extract first 3 letters for ICAO airline code (e.g. EVA from EVA802)
    const match = clean.match(/^([A-Z]{3})/)
    if (!match) return null

    const code = match[1]
    const found = AIRLINE_DATABASE[code]
    if (found) {
      return {
        code,
        nameZh: found.nameZh,
        nameEn: found.nameEn,
        country: found.country,
      }
    }

    return null
  }

  /**
   * Asynchronously resolve flight route (origin -> destination)
   * Queries free open database (hexdb.io via local proxy) with memory cache
   */
  public async getRoute(flightCallsign: string): Promise<RouteInfo | null> {
    if (!flightCallsign) return null
    const clean = flightCallsign.trim().toUpperCase()
    if (this.routeCache.has(clean)) {
      return this.routeCache.get(clean) || null
    }

    if (this.inFlightRoutes.has(clean)) {
      return this.inFlightRoutes.get(clean)!
    }

    const task = (async (): Promise<RouteInfo | null> => {
      // 1. Primary Query: hexdb.io
      try {
        const res = await fetch(apiUrl(`/api/hexdb/route/icao/${clean}`))
        if (res.ok) {
          const data = await res.json()
          const rawRoute: string = data.route || ''
          if (rawRoute && rawRoute.includes('-')) {
            const [origIcao, destIcao] = rawRoute.split('-').map((s) => s.trim().toUpperCase())
            const origin = await this.resolveAirport(origIcao)
            const destination = await this.resolveAirport(destIcao)
            const result: RouteInfo = { origin, destination, rawRoute }
            this.routeCache.set(clean, result)
            return result
          }
        }
      } catch {
        // Fall through to secondary
      }

      // 2. Secondary Fallback Query: adsbdb.com
      try {
        const res = await fetch(apiUrl(`/api/adsbdb/callsign/${clean}`))
        if (res.ok) {
          const data = await res.json()
          const flightObj = data.response?.flightroute
          if (flightObj) {
            const origIcao = flightObj.origin?.icao_code
            const destIcao = flightObj.destination?.icao_code
            if (origIcao && destIcao) {
              const origin = await this.resolveAirport(origIcao)
              const destination = await this.resolveAirport(destIcao)
              const result: RouteInfo = {
                origin,
                destination,
                rawRoute: `${origIcao}-${destIcao}`,
              }
              this.routeCache.set(clean, result)
              return result
            }
          }
        }
      } catch {
        // Ignore fallback error
      }

      this.routeCache.set(clean, null)
      return null
    })().finally(() => {
      this.inFlightRoutes.delete(clean)
    })

    this.inFlightRoutes.set(clean, task)
    return task
  }

  /**
   * Asynchronously resolve aircraft details (Manufacturer, full model name, operator)
   */
  public async getAircraftDetails(hex: string): Promise<AircraftDetails | null> {
    if (!hex) return null
    const clean = hex.trim().toLowerCase()
    if (this.aircraftCache.has(clean)) {
      return this.aircraftCache.get(clean) || null
    }

    if (this.inFlightAircraft.has(clean)) {
      return this.inFlightAircraft.get(clean)!
    }

    const task = (async (): Promise<AircraftDetails | null> => {
      try {
        const res = await fetch(apiUrl(`/api/hexdb/aircraft/${clean}`))
        if (!res.ok) {
          this.aircraftCache.set(clean, null)
          return null
        }

        const data = await res.json()
        const details: AircraftDetails = {
          manufacturer: data.Manufacturer || undefined,
          fullType: data.Type || undefined,
          operator: data.RegisteredOwners || undefined,
        }

        this.aircraftCache.set(clean, details)
        return details
      } catch {
        this.aircraftCache.set(clean, null)
        return null
      } finally {
        this.inFlightAircraft.delete(clean)
      }
    })()

    this.inFlightAircraft.set(clean, task)
    return task
  }

  /**
   * Helper to resolve airport details from ICAO code
   */
  public async resolveAirport(icao: string): Promise<AirportInfo> {
    const clean = icao.trim().toUpperCase()
    if (AIRPORT_DATABASE[clean]) {
      const info = AIRPORT_DATABASE[clean]
      return {
        icao: clean,
        iata: info.iata,
        name: info.name,
        city: info.city,
        coordinate: info.coordinate,
      }
    }

    if (this.airportCache.has(clean)) {
      return this.airportCache.get(clean)!
    }

    // Fallback: Query hexdb airport database
    try {
      const res = await fetch(apiUrl(`/api/hexdb/airport/icao/${clean}`))
      if (res.ok) {
        const data = await res.json()
        const lat = data.lat !== undefined ? Number(data.lat) : undefined
        const lon = data.lon !== undefined ? Number(data.lon) : undefined
        const info: AirportInfo = {
          icao: clean,
          iata: data.iata || clean,
          name: data.airport || clean,
          city: data.region_name || data.country_code || '',
          coordinate: lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon) ? [lon, lat] : undefined,
        }
        this.airportCache.set(clean, info)
        return info
      }
    } catch {
      // Ignore
    }

    // Default basic fallback
    const fallback: AirportInfo = {
      icao: clean,
      iata: clean,
      name: clean,
      city: '',
    }
    this.airportCache.set(clean, fallback)
    return fallback
  }
}

export const flightInfoService = new FlightInfoService()
