import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style'
import type { AlertSeverity } from './collisionTypes'

export function getConflictColor(severity: AlertSeverity): { stroke: string; fill: string; text: string } {
  switch (severity) {
    case 'critical':
      return {
        stroke: '#ef4444',
        fill: 'rgba(239, 68, 68, 0.25)',
        text: '#f87171',
      }
    case 'warning':
      return {
        stroke: '#f97316',
        fill: 'rgba(249, 115, 22, 0.25)',
        text: '#fb923c',
      }
    case 'advisory':
    default:
      return {
        stroke: '#eab308',
        fill: 'rgba(234, 179, 8, 0.2)',
        text: '#facc15',
      }
  }
}

export function createConflictVectorStyle(severity: AlertSeverity): Style {
  const colors = getConflictColor(severity)
  return new Style({
    stroke: new Stroke({
      color: colors.stroke,
      width: severity === 'critical' ? 2.5 : 2,
      lineDash: [6, 4],
    }),
  })
}

export function createConflictPointStyle(
  severity: AlertSeverity,
  tcpa: number,
  dcpa: number
): Style[] {
  const colors = getConflictColor(severity)
  const isCritical = severity === 'critical'

  return [
    // Outer pulsed ripple ring
    new Style({
      image: new CircleStyle({
        radius: isCritical ? 26 : 20,
        stroke: new Stroke({
          color: colors.stroke,
          width: isCritical ? 2 : 1.5,
          lineDash: isCritical ? [4, 4] : undefined,
        }),
        fill: new Fill({ color: colors.fill }),
      }),
      zIndex: 60,
    }),
    // Center point & alert HUD tag
    new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: colors.stroke }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: `⚠️ CPA: ${Math.round(dcpa)}m (${Math.round(tcpa)}s)`,
        textBaseline: 'bottom',
        offsetY: -12,
        font: 'bold 11px system-ui, sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#0f172a', width: 3.5 }),
        backgroundFill: new Fill({
          color: isCritical ? 'rgba(220, 38, 38, 0.95)' : 'rgba(217, 119, 6, 0.95)',
        }),
        backgroundStroke: new Stroke({ color: '#ffffff', width: 1 }),
        padding: [2, 6, 2, 6],
      }),
      zIndex: 70,
    }),
  ]
}

/**
 * Visual styling for dynamic threatened airspace zones (即將誤觸或已入侵的禁限航區)
 */
export function createThreatZoneStyles(
  risk: import('./collisionTypes').CollisionRisk
): Style[] {
  const isNoFly = risk.type === 'no-fly-zone'
  const isBreached = risk.stage === 'breached'

  let fillColor = 'rgba(249, 115, 22, 0.22)'
  let strokeColor = '#f97316'
  let outerGlowColor = 'rgba(249, 115, 22, 0.35)'

  if (isNoFly) {
    if (isBreached) {
      fillColor = 'rgba(239, 68, 68, 0.32)'
      strokeColor = '#ef4444'
      outerGlowColor = 'rgba(239, 68, 68, 0.45)'
    }
  } else {
    // Altitude violation in Restricted Yellow Zone
    if (isBreached) {
      fillColor = 'rgba(234, 179, 8, 0.28)'
      strokeColor = '#ef4444'
      outerGlowColor = 'rgba(239, 68, 68, 0.35)'
    } else {
      fillColor = 'rgba(234, 179, 8, 0.20)'
      strokeColor = '#eab308'
      outerGlowColor = 'rgba(234, 179, 8, 0.35)'
    }
  }

  return [
    // Outer glow perimeter
    new Style({
      stroke: new Stroke({
        color: outerGlowColor,
        width: 8,
      }),
      zIndex: 28,
    }),
    // Main boundary stroke with translucent fill
    new Style({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({
        color: strokeColor,
        width: 3.5,
        lineDash: [8, 5],
      }),
      zIndex: 29,
    }),
  ]
}

/**
 * Connector ray pointing from drone to threatened zone boundary/center
 */
export function createThreatConnectorStyle(
  risk: import('./collisionTypes').CollisionRisk
): Style {
  const isBreached = risk.stage === 'breached'
  return new Style({
    stroke: new Stroke({
      color: isBreached ? '#ef4444' : '#f97316',
      width: 2.5,
      lineDash: [6, 4],
    }),
    zIndex: 30,
  })
}

