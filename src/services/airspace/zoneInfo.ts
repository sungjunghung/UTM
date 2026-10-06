import type { AirspaceZoneInfo } from './types'

/**
 * Convert raw CAA airspace feature properties into the AirspaceZoneInfo shown by AirspaceDetailCard.
 * Shared by the CAA airspace layer and the drone threat-zone (違規警示) layer.
 */
export function buildAirspaceZoneInfo(props: Record<string, any>, coordinate?: [number, number]): AirspaceZoneInfo {
  const isRed = props['限制區'] === '紅區'

  return {
    id: String(props['objectid'] || Math.random()),
    name: props['空域名稱'] || (isRed ? '法定禁航管制區' : '法定限航管制區'),
    zoneType: isRed ? 'red' : 'yellow',
    zoneLabel: isRed ? '🔴 禁航區 (No-Fly Zone)' : '🟠 限航區 (Restricted Zone)',
    description: props['空域說明'] || '依據民用航空法遙控無人機專章規定劃設之管制空域。',
    authority: props['主管機關名稱'] || props['主管機關'] || '交通部民用航空局',
    validFrom: props['有效日期起'] || undefined,
    validTo: props['有效日期迄'] || undefined,
    penalty: props['罰則'] || '違規操作將依民用航空法第118條之2裁處新台幣3萬至150萬元罰鍰並沒入遙控無人機。',
    coordinate,
  }
}
