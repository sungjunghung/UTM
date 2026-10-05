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
