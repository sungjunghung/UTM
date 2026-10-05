import { Icon, Style, Text, Fill, Stroke } from 'ol/style'

// Clean top-down aircraft SVG pointing North (up)
function getAirplaneSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <path fill="${color}" stroke="#0f172a" stroke-width="1" stroke-linejoin="round" d="M16 2 L14 10 L4 16 L4 19 L14 15 L14 24 L11 26 L11 28 L16 27 L21 28 L21 26 L18 24 L18 15 L28 19 L28 16 L18 10 Z"/>
    <circle cx="16" cy="12" r="1.5" fill="#ffffff" />
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Get color based on flight altitude (feet)
 */
export function getAltitudeColor(alt: number, isGround: boolean): string {
  if (isGround || alt < 1500) return '#10b981' // Emerald (Ground / Approach)
  if (alt < 10000) return '#06b6d4' // Cyan (Low altitude)
  if (alt < 24000) return '#3b82f6' // Blue (Mid altitude)
  if (alt < 34000) return '#8b5cf6' // Purple (High cruise)
  return '#f59e0b' // Amber (Ultra high cruise > 34,000 ft)
}

const iconCache = new Map<string, string>()

function getCachedSvgUri(color: string): string {
  if (!iconCache.has(color)) {
    iconCache.set(color, getAirplaneSvg(color))
  }
  return iconCache.get(color)!
}

export function createAircraftStyle(
  heading: number,
  altitude: number,
  isGround: boolean,
  label?: string,
  isSelected: boolean = false
): Style {
  const color = isSelected ? '#ec4899' : getAltitudeColor(altitude, isGround)
  const src = getCachedSvgUri(color)
  const rotation = (heading * Math.PI) / 180

  return new Style({
    image: new Icon({
      src,
      anchor: [0.5, 0.5],
      rotateWithView: true,
      rotation,
      scale: isSelected ? 1.3 : 1.0,
    }),
    text: label
      ? new Text({
          text: label,
          offsetY: 20,
          font: isSelected ? 'bold 11px system-ui' : '10px system-ui',
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#0f172a', width: 3 }),
          backgroundFill: isSelected ? new Fill({ color: 'rgba(236, 72, 153, 0.85)' }) : undefined,
          padding: isSelected ? [2, 4, 1, 4] : undefined,
        })
      : undefined,
    zIndex: isSelected ? 100 : 20,
  })
}
