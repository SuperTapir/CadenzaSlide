import { motionReadyVisualById, type VisualMotionVerb } from './motion'
import type { VisualRenderProfile } from './one-bit-visual'

export type SmilPlaybackPolicy = 'active' | 'poster'

export function resolveSmilPlaybackPolicy(input: { profile: VisualRenderProfile, visible: boolean, reducedMotion: boolean, behavior: VisualMotionVerb | 'none' }): SmilPlaybackPolicy {
  return input.profile === 'stage' && input.visible && !input.reducedMotion && input.behavior !== 'none' ? 'active' : 'poster'
}

export function hydrateSmilVisuals(root: ParentNode) {
  const sessions = new Map<HTMLElement, { svg: SVGSVGElement, timeout: number | null }>()
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let disposed = false

  const hydrate = (visual: HTMLElement) => {
    if (disposed || sessions.has(visual) || visual.dataset.axisTreatment === 'one-bit-pixel') return
    const motion = motionReadyVisualById[visual.dataset.visualAsset ?? '']
    if (!motion || motion.format !== 'svg-smil' || visual.dataset.axisBehavior !== motion.verb) return
    const stage = visual.querySelector<HTMLElement>(':scope > .cadenza-visual-stage')
    const svg = stage?.querySelector<SVGSVGElement>(':scope > svg')
    if (!stage || !svg) return
    const session = { svg, timeout: null as number | null }
    sessions.set(visual, session)
    stage.dataset.smilRenderer = 'native-svg'
    applyPolicy(visual, stage, motion.mode, motion.animation.posterTimeMs, session)
  }

  const applyPolicy = (visual: HTMLElement, stage: HTMLElement, mode: 'enter' | 'loop' | 'morph', posterTimeMs: number, session: { svg: SVGSVGElement, timeout: number | null }) => {
    if (session.timeout !== null) window.clearTimeout(session.timeout)
    session.timeout = null
    const active = policyFor(stage, visual.dataset.axisBehavior as VisualMotionVerb, reducedMotion?.matches ?? false) === 'active'
    try {
      if (!active) {
        session.svg.pauseAnimations()
        session.svg.setCurrentTime(posterTimeMs / 1000)
        stage.dataset.visualFrame = 'poster'
        return
      }
      session.svg.setCurrentTime(0)
      session.svg.unpauseAnimations()
      stage.dataset.visualFrame = 'active'
      if (mode !== 'loop') session.timeout = window.setTimeout(() => {
        if (!visual.isConnected) return
        session.svg.pauseAnimations()
        session.svg.setCurrentTime(posterTimeMs / 1000)
        stage.dataset.visualFrame = 'poster'
      }, posterTimeMs)
    } catch {
      visual.dataset.smilError = ''
    }
  }

  const processWithin = (node: ParentNode) => {
    if (node instanceof HTMLElement && node.matches('.cadenza-visual')) hydrate(node)
    node.querySelectorAll<HTMLElement>('.cadenza-visual').forEach(hydrate)
  }
  const reconcile = () => sessions.forEach((session, visual) => {
    if (!visual.isConnected) {
      if (session.timeout !== null) window.clearTimeout(session.timeout)
      sessions.delete(visual)
      return
    }
    const motion = motionReadyVisualById[visual.dataset.visualAsset ?? '']
    const stage = visual.querySelector<HTMLElement>(':scope > .cadenza-visual-stage')
    if (motion?.format === 'svg-smil' && stage) applyPolicy(visual, stage, motion.mode, motion.animation.posterTimeMs, session)
  })

  processWithin(root)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => { if (node instanceof Element) processWithin(node) }))
    queueMicrotask(reconcile)
  })
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] })
  const preferenceChanged = () => reconcile()
  reducedMotion?.addEventListener?.('change', preferenceChanged)
  document.addEventListener('visibilitychange', reconcile)

  return () => {
    disposed = true
    observer.disconnect()
    reducedMotion?.removeEventListener?.('change', preferenceChanged)
    document.removeEventListener('visibilitychange', reconcile)
    sessions.forEach(session => {
      if (session.timeout !== null) window.clearTimeout(session.timeout)
      try { session.svg.pauseAnimations() } catch { /* detached SVG */ }
    })
    sessions.clear()
  }
}

function policyFor(stage: HTMLElement, behavior: VisualMotionVerb, reducedMotion: boolean) {
  const profile: VisualRenderProfile = document.documentElement.dataset.renderProfile === 'export'
    ? 'export'
    : stage.closest('.gallery-card, .overview-card, .navigator-thumbnail') ? 'thumbnail' : 'stage'
  const dialog = stage.closest<HTMLDialogElement>('dialog')
  const slide = stage.closest<HTMLElement>('.reveal .slides > section')
  const visible = document.visibilityState !== 'hidden'
    && !stage.closest('[hidden]')
    && !stage.closest('.visual-preview-poster')
    && (!dialog || dialog.open)
    && (!slide || slide.classList.contains('present'))
  return resolveSmilPlaybackPolicy({ profile, visible, reducedMotion, behavior })
}
