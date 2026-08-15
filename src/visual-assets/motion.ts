import type { VisualAssetDefinition, VisualBehavior } from './catalog.ts'
import { generatedLineMdIcons } from './generated-line-md-icons.ts'

export type VisualMotionVerb = Exclude<VisualBehavior, 'none'>
export type VisualMotionIntent = 'create' | 'search' | 'edit' | 'sync' | 'growth' | 'accumulate' | 'confirm' | 'warning' | 'ai-thinking' | 'completion' | 'navigation' | 'dismiss' | 'home' | 'layout' | 'playback'

export interface VisualMotionPreset {
  durationMs: number
  easing: string
  loop: 'once' | 'idle'
  posterProgress: number
}

export interface VisualMotionFrame {
  moving: { translateX: number, translateY: number, rotate: number, scale: number, opacity: number }
}

interface MotionReadyVisualBase {
  asset: `icon:${string}`
  intent: VisualMotionIntent
  verb: VisualMotionVerb
  mode: 'enter' | 'loop' | 'morph'
}

export type MotionReadyVisual = MotionReadyVisualBase & (
  | { format: 'lottie', animation: { path: string, frameRate: number, inFrame: number, outFrame: number } }
  | { format: 'svg-smil', animation: { posterTimeMs: number } }
)

export const visualMotionPresets: Readonly<Record<VisualMotionVerb, VisualMotionPreset>> = Object.freeze({
  enter: { durationMs: 300, easing: 'cubic-bezier(.05,.7,.1,1)', loop: 'once', posterProgress: 1 },
  exit: { durationMs: 200, easing: 'cubic-bezier(.3,0,.8,.15)', loop: 'once', posterProgress: 0 },
  loop: { durationMs: 1200, easing: 'cubic-bezier(.2,0,0,1)', loop: 'idle', posterProgress: 1 },
  emphasis: { durationMs: 400, easing: 'cubic-bezier(.2,0,0,1)', loop: 'once', posterProgress: 1 },
  draw: { durationMs: 720, easing: 'cubic-bezier(.22,1,.36,1)', loop: 'once', posterProgress: 1 },
  focus: { durationMs: 720, easing: 'cubic-bezier(.22,1,.36,1)', loop: 'once', posterProgress: 1 },
  land: { durationMs: 560, easing: 'cubic-bezier(.16,1,.3,1)', loop: 'once', posterProgress: 1 },
  rise: { durationMs: 680, easing: 'cubic-bezier(.16,1,.3,1)', loop: 'once', posterProgress: 1 },
  pulse: { durationMs: 680, easing: 'cubic-bezier(.22,1,.36,1)', loop: 'once', posterProgress: 1 },
  replace: { durationMs: 820, easing: 'cubic-bezier(.22,1,.36,1)', loop: 'once', posterProgress: 1 },
  accumulate: { durationMs: 800, easing: 'cubic-bezier(.22,1,.36,1)', loop: 'once', posterProgress: 1 },
  lock: { durationMs: 520, easing: 'cubic-bezier(.16,1,.3,1)', loop: 'once', posterProgress: 1 },
})

const lineMdMotionReadyVisuals: readonly MotionReadyVisual[] = generatedLineMdIcons.filter(icon => icon.animated).map(icon => ({
  asset: `icon:line-md-${icon.name}`,
  intent: classifyLineMdIntent(icon.aliases as readonly string[]),
  verb: icon.mode as 'enter' | 'loop',
  mode: icon.mode as 'enter' | 'loop',
  format: 'svg-smil' as const,
  animation: { posterTimeMs: icon.posterTimeMs },
}))

function classifyLineMdIntent(aliases: readonly string[]): VisualMotionIntent {
  const has = (...terms: string[]) => terms.some(term => aliases.includes(term))
  if (has('bell', 'alert', 'warning', 'hazard')) return 'warning'
  if (has('search', 'zoom')) return 'search'
  if (has('edit', 'pencil', 'pen')) return 'edit'
  if (has('sync', 'refresh', 'loading', 'cog', 'restore')) return 'sync'
  if (has('chart', 'trending', 'growth', 'gauge', 'speed')) return 'growth'
  if (has('layers', 'list', 'database', 'stack')) return 'accumulate'
  if (has('check', 'confirm', 'lock', 'verified')) return 'confirm'
  if (has('brain', 'sparkles', 'star', 'stars', 'magic')) return 'ai-thinking'
  if (has('add', 'plus', 'create')) return 'create'
  if (has('download', 'upload', 'done', 'complete')) return 'completion'
  return 'navigation'
}

export const motionReadyVisuals: readonly MotionReadyVisual[] = Object.freeze(lineMdMotionReadyVisuals)

export const motionReadyVisualById: Readonly<Partial<Record<string, MotionReadyVisual>>> = Object.freeze(Object.fromEntries(
  motionReadyVisuals.map(definition => [definition.asset, definition]),
))

export function qualifyVisualMotionCatalog(
  motions: readonly MotionReadyVisual[],
  assets: readonly Pick<VisualAssetDefinition, 'id' | 'kind'>[],
  geometries: Readonly<Record<string, { body: string }>>,
) {
  const issues: Array<{ code: string, asset: string, message: string }> = []
  const assetKinds = new Map(assets.map(asset => [asset.id, asset.kind]))
  const ids = new Set<string>()
  for (const motion of motions) {
    if (ids.has(motion.asset)) issues.push({ code: 'visual.motion-duplicate', asset: motion.asset, message: 'motion-ready asset must be unique' })
    ids.add(motion.asset)
    if (assetKinds.get(motion.asset) !== 'icon') issues.push({ code: 'visual.motion-asset', asset: motion.asset, message: 'motion-ready icon must resolve to a production icon' })
    const body = geometries[motion.asset]?.body ?? ''
    if (!/<(?:path|circle|ellipse|rect|line|polyline|polygon)\b/.test(body)) issues.push({ code: 'visual.motion-poster', asset: motion.asset, message: 'motion-ready icon requires local SVG poster geometry' })
    if (motion.format === 'lottie') {
      if (!('path' in motion.animation) || !motion.animation.path.startsWith('/visual-assets/animated/') || !motion.animation.path.endsWith('.json')) {
        issues.push({ code: 'visual.motion-source', asset: motion.asset, message: 'motion-ready Lottie icon requires a local registered animation' })
      }
      if (!('frameRate' in motion.animation) || !(motion.animation.frameRate > 0 && motion.animation.outFrame > motion.animation.inFrame)) {
        issues.push({ code: 'visual.motion-timing', asset: motion.asset, message: 'motion-ready Lottie icon requires bounded timing' })
      }
    } else {
      if (motion.animation.posterTimeMs <= 0) issues.push({ code: 'visual.motion-timing', asset: motion.asset, message: 'animated SVG requires a deterministic poster time' })
      if (!/<(?:animate|animateTransform|set)\b/.test(body)) issues.push({ code: 'visual.motion-source', asset: motion.asset, message: 'animated SVG requires declarative internal animation' })
      const indefinite = /repeatCount="indefinite"/.test(body)
      if ((motion.mode === 'loop') !== indefinite) issues.push({ code: 'visual.motion-loop', asset: motion.asset, message: 'loop mode must match an explicit indefinite source timeline' })
      if ([...body.matchAll(/<(?:animate|animateTransform)\b([^>]*)>/g)].some(([, attributes]) => {
        if (!/\bdur=/.test(attributes)) return false
        if (/calcMode="spline"/.test(attributes)) return !/\bkeySplines=/.test(attributes)
        return !(/calcMode="linear"/.test(attributes) && /repeatCount="indefinite"/.test(attributes))
      })) {
        issues.push({ code: 'visual.motion-easing', asset: motion.asset, message: 'SVG motion requires a qualified Material spline or an explicit linear continuous loop' })
      }
      if (/<(?:script|foreignObject|image|iframe)\b|\son[a-z]+\s*=|(?:href|src)="(?:https?:|\/\/|data:)/i.test(body)) {
        issues.push({ code: 'visual.motion-unsafe', asset: motion.asset, message: 'animated SVG contains executable or external content' })
      }
    }
  }
  return issues
}

export function resolveVisualMotionFrame(verb: VisualMotionVerb, progress: number): VisualMotionFrame {
  const t = clamp(progress)
  const wave = Math.sin(Math.PI * t)
  const cycle = Math.sin(Math.PI * 2 * t)
  const base: VisualMotionFrame = {
    moving: { translateX: 0, translateY: 0, rotate: 0, scale: 1, opacity: 1 },
  }
  switch (verb) {
    case 'enter': return { moving: { ...base.moving, translateY: 5 * (1 - t), scale: .92 + .08 * t, opacity: t } }
    case 'exit': return { moving: { ...base.moving, translateY: -4 * t, scale: 1 - .06 * t, opacity: 1 - t } }
    case 'loop': return { moving: { ...base.moving, rotate: 3 * Math.sin(Math.PI * 2 * t) } }
    case 'emphasis': return { moving: { ...base.moving, scale: 1 + .05 * wave } }
    case 'draw': return { moving: { ...base.moving, translateX: -7 * (1 - t), translateY: 7 * (1 - t), opacity: .35 + .65 * t } }
    case 'focus': return { moving: { ...base.moving, translateX: 4 * cycle, scale: 1 + .06 * wave } }
    case 'land': return { moving: { ...base.moving, translateY: -16 * (1 - t), scale: .82 + .18 * t, opacity: .2 + .8 * t } }
    case 'rise': return { moving: { ...base.moving, translateY: 16 * (1 - t), opacity: .25 + .75 * t } }
    case 'pulse': return { moving: { ...base.moving, translateY: -3 * wave, scale: 1 + .06 * wave } }
    case 'replace': return { moving: { ...base.moving, rotate: 360 * t } }
    case 'accumulate': return { moving: { ...base.moving, translateY: 12 * (1 - t), scale: .88 + .12 * t, opacity: .3 + .7 * t } }
    case 'lock': return { moving: { ...base.moving, rotate: -8 * (1 - t), scale: .76 + .24 * t, opacity: .25 + .75 * t } }
  }
}

function clamp(value: number) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) }
