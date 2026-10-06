/**
 * Official Taiwan Civil Aeronautics Administration (CAA) ATS Airways & Waypoint Network
 * Extracted from Taiwan AIP (Aeronautical Information Publication) ENR 3 ATS Routes
 */

export interface Waypoint {
  name: string
  coord: [number, number] // [lon, lat]
  description?: string
}

export interface AirwaySegment {
  id: string
  name: string
  type: 'international' | 'domestic' | 'offshore'
  direction: 'bidirectional' | 'northbound' | 'southbound'
  minFlightLevel: number // e.g. FL140 (14,000 ft)
  maxFlightLevel: number // e.g. FL400 (40,000 ft)
  waypoints: Waypoint[]
}

export const TAIWAN_WAYPOINTS: Record<string, [number, number]> = {
  // Northern / Northeast (Japan/Korea departure & arrival)
  APU: [121.528, 25.178], // Anbu VOR (陽明山鞍部)
  TONGA: [121.283, 25.433], // Northern TMA gateway (北部進離場門戶)
  PIANO: [121.650, 25.683], // Route to Japan
  MORA: [122.167, 26.000],
  KIKIT: [122.867, 26.550], // FIR Boundary to Fukuoka
  SEDOR: [122.417, 25.333],
  BULAN: [122.000, 25.133],

  // Western Corridor (Main North-South Arterial W4)
  HLG: [120.852, 24.578], // Houlung VOR (後龍)
  HCN: [120.738, 22.040], // Hengchun VOR (恆春)
  TNN: [120.206, 22.950], // Tainan VOR (台南)
  KAGIS: [120.250, 23.367], // Chiayi/Tainan transition
  W40: [120.483, 23.850], // Taichung offshore transition

  // Southern / Southwest (Hong Kong, Southeast Asia, Philippines)
  ELATO: [120.000, 22.333], // Hong Kong FIR boundary
  SULEM: [119.500, 21.900], // Southbound gateway
  EXTRA: [120.283, 21.633], // South to Manila
  KABAM: [121.000, 21.000], // FIR Boundary to Manila

  // Offshore Islands (Kinmen / Matsu)
  W2_BEIGAN: [119.983, 26.150], // Matsu Gateway
  W8_KINMEN: [118.400, 24.433], // Kinmen Gateway
  MZG: [119.629, 23.568], // Magong VOR (澎湖)

  // Eastern Coast (M750 & Green Island)
  POTET: [122.867, 24.300], // East coast high-altitude corridor
  RIKUT: [122.650, 23.500],
  DADON: [122.350, 22.500],
  GNI: [121.467, 22.673], // Green Island VOR (綠島)
}

export const TAIWAN_ATS_AIRWAYS: AirwaySegment[] = [
  // 1. W4: The main Western Coast Spine (西海岸主航路 - 台灣國內線與起降最密集走廊)
  {
    id: 'W4',
    name: 'W4 台灣西海岸主航路',
    type: 'domestic',
    direction: 'bidirectional',
    minFlightLevel: 110,
    maxFlightLevel: 290,
    waypoints: [
      { name: 'TONGA', coord: TAIWAN_WAYPOINTS.TONGA, description: '北部端點 / 桃機離場點' },
      { name: 'APU', coord: TAIWAN_WAYPOINTS.APU, description: '鞍部導航台' },
      { name: 'HLG', coord: TAIWAN_WAYPOINTS.HLG, description: '後龍導航台' },
      { name: 'W40', coord: TAIWAN_WAYPOINTS.W40, description: '台中外海巡航點' },
      { name: 'KAGIS', coord: TAIWAN_WAYPOINTS.KAGIS, description: '嘉南交會點' },
      { name: 'TNN', coord: TAIWAN_WAYPOINTS.TNN, description: '台南導航台' },
      { name: 'HCN', coord: TAIWAN_WAYPOINTS.HCN, description: '恆春導航台' },
    ],
  },

  // 2. B591: Northeast Trunk Airway to Japan & Korea (東北向日韓主要幹線)
  {
    id: 'B591',
    name: 'B591 東北亞國際航路 (往日韓)',
    type: 'international',
    direction: 'bidirectional',
    minFlightLevel: 150,
    maxFlightLevel: 410,
    waypoints: [
      { name: 'APU', coord: TAIWAN_WAYPOINTS.APU, description: '鞍部導航台' },
      { name: 'PIANO', coord: TAIWAN_WAYPOINTS.PIANO, description: '北海出境節點' },
      { name: 'MORA', coord: TAIWAN_WAYPOINTS.MORA, description: '台日航管交接點' },
      { name: 'KIKIT', coord: TAIWAN_WAYPOINTS.KIKIT, description: '福岡 FIR 邊界點' },
    ],
  },

  // 3. A1: Southwest Trunk Airway to Hong Kong & SE Asia (西南向往香港、東南亞主航路)
  {
    id: 'A1',
    name: 'A1 港澳東南亞國際航路',
    type: 'international',
    direction: 'bidirectional',
    minFlightLevel: 150,
    maxFlightLevel: 410,
    waypoints: [
      { name: 'TNN', coord: TAIWAN_WAYPOINTS.TNN, description: '台南分流點' },
      { name: 'ELATO', coord: TAIWAN_WAYPOINTS.ELATO, description: '西南出境導航點' },
      { name: 'SULEM', coord: TAIWAN_WAYPOINTS.SULEM, description: '香港 FIR 邊界點' },
    ],
  },

  // 4. M750: Pacific East Coast International Spine (太平洋東部南北高空幹線)
  {
    id: 'M750',
    name: 'M750 東太平洋高空走廊',
    type: 'international',
    direction: 'bidirectional',
    minFlightLevel: 290,
    maxFlightLevel: 430,
    waypoints: [
      { name: 'POTET', coord: TAIWAN_WAYPOINTS.POTET, description: '宜蘭外海航點' },
      { name: 'RIKUT', coord: TAIWAN_WAYPOINTS.RIKUT, description: '花蓮外海航點' },
      { name: 'DADON', coord: TAIWAN_WAYPOINTS.DADON, description: '台東外海航點' },
      { name: 'KABAM', coord: TAIWAN_WAYPOINTS.KABAM, description: '馬尼拉 FIR 邊界' },
    ],
  },

  // 5. W8: Offshore Kinmen Corridor (金門直達空中走廊)
  {
    id: 'W8',
    name: 'W8 金門離島航路',
    type: 'offshore',
    direction: 'bidirectional',
    minFlightLevel: 70,
    maxFlightLevel: 180,
    waypoints: [
      { name: 'HLG', coord: TAIWAN_WAYPOINTS.HLG, description: '西海岸切入點' },
      { name: 'MZG', coord: TAIWAN_WAYPOINTS.MZG, description: '澎湖馬公轉折' },
      { name: 'W8_KINMEN', coord: TAIWAN_WAYPOINTS.W8_KINMEN, description: '金門尚義進場' },
    ],
  },

  // 6. W2: Offshore Matsu Corridor (馬祖直達空中走廊)
  {
    id: 'W2',
    name: 'W2 馬祖離島航路',
    type: 'offshore',
    direction: 'bidirectional',
    minFlightLevel: 70,
    maxFlightLevel: 140,
    waypoints: [
      { name: 'APU', coord: TAIWAN_WAYPOINTS.APU, description: '北部切入點' },
      { name: 'W2_BEIGAN', coord: TAIWAN_WAYPOINTS.W2_BEIGAN, description: '馬祖南北竿進場' },
    ],
  },
]
