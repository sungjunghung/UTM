import { Icon, Style, Text, Fill, Stroke, Circle as CircleStyle } from 'ol/style'

/**
 * Top-down Multirotor Drone (Quadcopter) SVG pointing North (Up)
 */
function getDroneSvg(bodyColor: string, rotorColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
    <!-- 4 Diagonal Rotor Arms -->
    <line x1="8" y1="8" x2="28" y2="28" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />
    <line x1="8" y1="28" x2="28" y2="8" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />

    <!-- 4 Rotor Discs with high-speed blur look -->
    <circle cx="8" cy="8" r="5" fill="none" stroke="${rotorColor}" stroke-width="1.5" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="28" cy="8" r="5" fill="none" stroke="${rotorColor}" stroke-width="1.5" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="8" cy="28" r="5" fill="none" stroke="${rotorColor}" stroke-width="1.5" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="28" cy="28" r="5" fill="none" stroke="${rotorColor}" stroke-width="1.5" opacity="0.85" stroke-dasharray="3 2" />

    <!-- Motor Mount Hubs -->
    <circle cx="8" cy="8" r="2" fill="#0f172a" stroke="${bodyColor}" stroke-width="1" />
    <circle cx="28" cy="8" r="2" fill="#0f172a" stroke="${bodyColor}" stroke-width="1" />
    <circle cx="8" cy="28" r="2" fill="#0f172a" stroke="${bodyColor}" stroke-width="1" />
    <circle cx="28" cy="28" r="2" fill="#0f172a" stroke="${bodyColor}" stroke-width="1" />

    <!-- Center Fuselage Body (X-frame pod) -->
    <rect x="13" y="11" width="10" height="14" rx="3" fill="${bodyColor}" stroke="#0f172a" stroke-width="1.2" />

    <!-- Front Directional Nose Cone Indicator (Points UP) -->
    <polygon points="18,6 14,11 22,11" fill="${bodyColor}" stroke="#0f172a" stroke-width="1" />

    <!-- Center Sensor / Gimbal Eye -->
    <circle cx="18" cy="18" r="2.5" fill="#0f172a" stroke="#ffffff" stroke-width="0.8" />
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const droneSvgCache = new Map<string, string>()

function getCachedDroneSvg(bodyColor: string, rotorColor: string): string {
  const key = `${bodyColor}_${rotorColor}`
  if (!droneSvgCache.has(key)) {
    droneSvgCache.set(key, getDroneSvg(bodyColor, rotorColor))
  }
  return droneSvgCache.get(key)!
}

/**
 * Altitude AGL color indicator (Taiwan CAA legal limit is 120m / 400ft)
 */
export function getDroneAltitudeColor(altMeters: number): { body: string; rotor: string } {
  if (altMeters > 120) {
    // Over regulatory height limit: Warning Amber
    return { body: '#f59e0b', rotor: '#fbbf24' }
  }
  if (altMeters > 60) {
    // Normal cruising height: High-tech Cyan
    return { body: '#06b6d4', rotor: '#38bdf8' }
  }
  // Low altitude / approach / ground: Emerald Green
  return { body: '#10b981', rotor: '#34d399' }
}

export function createDroneStyle(
  heading: number,
  altitudeMeters: number,
  label: string,
  isSelected: boolean = false,
  isHovered: boolean = false
): Style[] {
  const colors = isSelected
    ? { body: '#06b6d4', rotor: '#38bdf8' }
    : getDroneAltitudeColor(altitudeMeters)

  const src = getCachedDroneSvg(colors.body, colors.rotor)
  const rotation = (heading * Math.PI) / 180
  const scale = isSelected ? 1.3 : isHovered ? 1.2 : 1.0

  const styles: Style[] = []

  // 1. Halo ring for selected or hovered drone
  if (isSelected) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 22,
          stroke: new Stroke({ color: '#06b6d4', width: 2, lineDash: [4, 3] }),
          fill: new Fill({ color: 'rgba(6, 182, 212, 0.22)' }),
        }),
        zIndex: 98,
      })
    )
  } else if (isHovered) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 19,
          stroke: new Stroke({ color: '#38bdf8', width: 1.5 }),
          fill: new Fill({ color: 'rgba(56, 189, 248, 0.15)' }),
        }),
        zIndex: 88,
      })
    )
  }

  // 2. Drone Icon with non-overlapping label below
  let textStyle: Text | undefined = undefined
  if (label) {
    if (isSelected) {
      textStyle = new Text({
        text: label,
        textBaseline: 'top',
        offsetY: 26,
        font: 'bold 11px system-ui, sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
        backgroundFill: new Fill({ color: 'rgba(14, 165, 233, 0.92)' }),
        backgroundStroke: new Stroke({ color: '#ffffff', width: 1 }),
        padding: [2, 6, 2, 6],
      })
    } else if (isHovered) {
      textStyle = new Text({
        text: label,
        textBaseline: 'top',
        offsetY: 24,
        font: 'bold 11px system-ui, sans-serif',
        fill: new Fill({ color: '#38bdf8' }),
        stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
        backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
        backgroundStroke: new Stroke({ color: '#38bdf8', width: 1 }),
        padding: [2, 5, 2, 5],
      })
    } else {
      textStyle = new Text({
        text: label,
        textBaseline: 'top',
        offsetY: 22,
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
      zIndex: isSelected ? 100 : isHovered ? 90 : 25,
    })
  )

  return styles
}
