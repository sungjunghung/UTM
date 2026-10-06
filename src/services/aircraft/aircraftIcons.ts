import { Icon, Style, Text, Fill, Stroke, Circle as CircleStyle } from 'ol/style'

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
  isSelected: boolean = false,
  isHovered: boolean = false
): Style[] {
  const baseColor = isSelected ? '#ec4899' : getAltitudeColor(altitude, isGround)
  const src = getCachedSvgUri(baseColor)
  const rotation = (heading * Math.PI) / 180

  const styles: Style[] = []

  // 1. Halo Ring for Selected or Hovered state
  if (isSelected) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 20,
          stroke: new Stroke({ color: '#ec4899', width: 2.5 }),
          fill: new Fill({ color: 'rgba(236, 72, 153, 0.22)' }),
        }),
        zIndex: 98,
      })
    )
  } else if (isHovered) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 18,
          stroke: new Stroke({ color: '#38bdf8', width: 2, lineDash: [4, 3] }),
          fill: new Fill({ color: 'rgba(56, 189, 248, 0.2)' }),
        }),
        zIndex: 88,
      })
    )
  }

  // 2. Aircraft Icon and Label
  const scale = isSelected ? 1.35 : isHovered ? 1.25 : 1.0
  const zIndex = isSelected ? 100 : isHovered ? 90 : 20

  let textStyle: Text | undefined = undefined
  // When aircraft is selected, the floating HUD detail card is displayed; hide bottom label to prevent overlap
  if (label && !isSelected) {
    if (isHovered) {
      textStyle = new Text({
        text: label,
        textBaseline: 'top',
        offsetY: 28,
        font: 'bold 11px system-ui, sans-serif',
        fill: new Fill({ color: '#38bdf8' }),
        stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
        backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.92)' }),
        backgroundStroke: new Stroke({ color: '#38bdf8', width: 1.5 }),
        padding: [2, 5, 2, 5],
      })
    } else {
      textStyle = new Text({
        text: label,
        textBaseline: 'top',
        offsetY: 24,
        font: '10px system-ui, sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#0f172a', width: 3 }),
      })
    }
  }

  styles.push(
    new Style({
      image: new Icon({
        src,
        anchor: [0.5, 0.5],
        rotateWithView: true,
        rotation,
        scale,
      }),
      text: textStyle,
      zIndex,
    })
  )

  return styles
}
