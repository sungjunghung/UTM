import { Icon, Style, Text, Fill, Stroke, Circle as CircleStyle } from 'ol/style'

/**
 * Top-down Multirotor Drone (Quadcopter) SVG pointing North (Up)
 */
function getDroneSvg(bodyColor: string, rotorColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 48" width="44" height="48">
    <defs>
      <!-- Forward Searchlight Beam Gradient (Heading / Nose Indicator) -->
      <linearGradient id="headlightBeam" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${rotorColor}" stop-opacity="0.6" />
        <stop offset="60%" stop-color="${rotorColor}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${rotorColor}" stop-opacity="0.0" />
      </linearGradient>
    </defs>

    <!-- Dynamic Forward Projection Searchlight Cone (Nose Direction) -->
    <polygon points="22,12 8,0 36,0" fill="url(#headlightBeam)" />

    <!-- 4 Diagonal Rotor Arms -->
    <line x1="12" y1="20" x2="32" y2="40" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
    <line x1="12" y1="40" x2="32" y2="20" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />

    <!-- 4 High-speed Spinning Rotor Discs -->
    <circle cx="12" cy="20" r="6" fill="none" stroke="${rotorColor}" stroke-width="1.8" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="32" cy="20" r="6" fill="none" stroke="${rotorColor}" stroke-width="1.8" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="12" cy="40" r="6" fill="none" stroke="${rotorColor}" stroke-width="1.8" opacity="0.85" stroke-dasharray="3 2" />
    <circle cx="32" cy="40" r="6" fill="none" stroke="${rotorColor}" stroke-width="1.8" opacity="0.85" stroke-dasharray="3 2" />

    <!-- Motor Mount Hubs -->
    <circle cx="12" cy="20" r="2.5" fill="#0f172a" stroke="${bodyColor}" stroke-width="1.2" />
    <circle cx="32" cy="20" r="2.5" fill="#0f172a" stroke="${bodyColor}" stroke-width="1.2" />
    <circle cx="12" cy="40" r="2.5" fill="#0f172a" stroke="${bodyColor}" stroke-width="1.2" />
    <circle cx="32" cy="40" r="2.5" fill="#0f172a" stroke="${bodyColor}" stroke-width="1.2" />

    <!-- Center Fuselage Body (High-tech aerodynamic pod) -->
    <rect x="17" y="23" width="10" height="15" rx="3.5" fill="${bodyColor}" stroke="#0f172a" stroke-width="1.5" />

    <!-- Prominent Directional Nose Cone (機頭箭頭) -->
    <polygon points="22,14 16,23 28,23" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
    <polygon points="22,17 18,22 26,22" fill="${bodyColor}" />

    <!-- Dual Ultra-bright Front Navigation Headlights (雙前探照燈) -->
    <circle cx="17.5" cy="18" r="1.5" fill="#ffffff" stroke="#38bdf8" stroke-width="0.8" />
    <circle cx="26.5" cy="18" r="1.5" fill="#ffffff" stroke="#38bdf8" stroke-width="0.8" />

    <!-- Center 4K Gimbal Camera Eye -->
    <circle cx="22" cy="30" r="2.5" fill="#0f172a" stroke="#ffffff" stroke-width="1" />
    <circle cx="22" cy="30" r="1" fill="#38bdf8" />
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
  isHovered: boolean = false,
  alertSeverity: 'clear' | 'advisory' | 'warning' | 'critical' = 'clear'
): Style[] {
  let colors: { body: string; rotor: string }
  if (alertSeverity === 'critical') {
    colors = { body: '#ef4444', rotor: '#f87171' }
  } else if (alertSeverity === 'warning') {
    colors = { body: '#f97316', rotor: '#fb923c' }
  } else if (alertSeverity === 'advisory') {
    colors = { body: '#eab308', rotor: '#facc15' }
  } else if (isSelected) {
    colors = { body: '#06b6d4', rotor: '#38bdf8' }
  } else {
    colors = getDroneAltitudeColor(altitudeMeters)
  }

  const src = getCachedDroneSvg(colors.body, colors.rotor)
  const rotation = (heading * Math.PI) / 180
  const scale = alertSeverity === 'critical' ? 1.35 : isSelected ? 1.3 : isHovered ? 1.2 : 1.0

  const styles: Style[] = []

  // 1. Halo ring for selected, hovered, or collision alert drone
  if (alertSeverity === 'critical') {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 34,
          stroke: new Stroke({ color: '#ef4444', width: 2.5, lineDash: [5, 3] }),
          fill: new Fill({ color: 'rgba(239, 68, 68, 0.25)' }),
        }),
        zIndex: 110,
      })
    )
  } else if (alertSeverity === 'warning') {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 32,
          stroke: new Stroke({ color: '#f97316', width: 2, lineDash: [4, 4] }),
          fill: new Fill({ color: 'rgba(249, 115, 22, 0.22)' }),
        }),
        zIndex: 105,
      })
    )
  } else if (isSelected) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 32,
          stroke: new Stroke({ color: '#06b6d4', width: 2.2, lineDash: [5, 3] }),
          fill: new Fill({ color: 'rgba(6, 182, 212, 0.22)' }),
        }),
        zIndex: 98,
      })
    )
  } else if (isHovered) {
    styles.push(
      new Style({
        image: new CircleStyle({
          radius: 28,
          stroke: new Stroke({ color: '#38bdf8', width: 1.8 }),
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
        offsetY: 36,
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
        offsetY: 32,
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
        offsetY: 28,
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
        anchor: [22, 30],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
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
