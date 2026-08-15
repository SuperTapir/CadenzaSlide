import { oneBitOptionsFromTokens } from '../rendering/media-one-bit'
import { AnimationLoop } from '../engine/animation-loop'
import { OneBitRenderer } from '../engine/one-bit/renderer'
import { motionReadyVisualById, resolveVisualMotionFrame, visualMotionPresets, type VisualMotionVerb } from './motion'
import { visualAssetById } from './catalog'

export type VisualRenderProfile = 'stage' | 'thumbnail' | 'export'
export type VisualFramePolicy = 'active' | 'poster'

export const visualOneBitSelector = '.cadenza-visual[data-axis-treatment="one-bit-pixel"] .cadenza-visual-stage'
const sourceFrameCache = new Map<string, Promise<HTMLCanvasElement>>()

interface OneBitVisualSession {
  stage: HTMLElement
  renderer: OneBitRenderer
  source: HTMLCanvasElement
  fixed: HTMLCanvasElement | null
  moving: HTMLCanvasElement | null
  frame: HTMLCanvasElement
  behavior: VisualMotionVerb | null
  startedAt: number | null
  completed: boolean
  posterRendered: boolean
  smil: { svg: SVGSVGElement, mode: 'enter' | 'loop' | 'morph', durationMs: number, periodMs: number } | null
}

export function resolveVisualFramePolicy(input: { profile: VisualRenderProfile, visible: boolean, reducedMotion: boolean, animated: boolean }): VisualFramePolicy {
  return input.profile === 'stage' && input.visible && !input.reducedMotion && input.animated ? 'active' : 'poster'
}

export function visualOneBitCacheKey(input: { asset: string, state: string, timeMs: number, width: number, height: number, paper: string, ink: string, gridScale: number }) {
  return `${input.asset}|${input.state}@${input.timeMs}|${input.width}x${input.height}|${input.paper}/${input.ink}|${input.gridScale}`
}

export function hydrateOneBitVisuals(root: ParentNode, tokenRoot: Element = document.documentElement) {
  const sessions = new Map<HTMLElement, OneBitVisualSession>()
  let disposed = false
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const animationLoop = new AnimationLoop((time) => {
    let active = false
    sessions.forEach(session => {
      if (!session.stage.isConnected) return disposeSession(session)
      const policy = framePolicyForStage(session.stage, Boolean(session.behavior), reducedMotion?.matches ?? false)
      if (policy === 'active' && session.behavior && !session.completed) {
        active = true
        renderActiveFrame(session, time)
      } else renderPoster(session)
    })
    if (!active) animationLoop.stop()
  })

  const reconcileLoop = () => {
    const hasActive = [...sessions.values()].some(session => (
      !session.completed && framePolicyForStage(session.stage, Boolean(session.behavior), reducedMotion?.matches ?? false) === 'active'
    ))
    if (hasActive) animationLoop.start()
    else animationLoop.stop()
  }

  const processWithin = (node: ParentNode) => {
    if (node instanceof HTMLElement && node.matches(visualOneBitSelector)) void hydrateStage(node)
    node.querySelectorAll<HTMLElement>(visualOneBitSelector).forEach(stage => { void hydrateStage(stage) })
  }

  const hydrateStage = async (stage: HTMLElement) => {
    if (disposed || sessions.has(stage) || stage.hasAttribute('data-one-bit-processing')) return
    const svg = stage.querySelector<SVGSVGElement>(':scope > svg')
      ?? stage.querySelector<HTMLTemplateElement>(':scope > template[data-one-bit-source]')?.content.querySelector<SVGSVGElement>('svg')
    if (!svg) return
    const sourceTemplate = document.createElement('template')
    sourceTemplate.dataset.oneBitSource = ''
    sourceTemplate.content.append(svg.cloneNode(true))
    stage.setAttribute('data-one-bit-processing', '')
    try {
      const styles = getComputedStyle(tokenRoot)
      const paper = styles.getPropertyValue('--paper').trim()
      const ink = styles.getPropertyValue('--ink').trim()
      const options = oneBitOptionsFromTokens(paper, ink)
      const visual = stage.closest<HTMLElement>('.cadenza-visual')
      const asset = visual?.dataset.visualAsset ?? 'unknown'
      const state = visual?.dataset.axisState ?? 'default'
      const motion = motionReadyVisualById[asset]
      const registered = visualAssetById[asset]
      const viewBox = svg.viewBox.baseVal
      // Rasterize at the logical display size. Line MD uses a 24×24 viewBox;
      // quantizing that tiny source before enlargement erases subtle part motion.
      const cssWidth = Math.max(1, Math.round(stage.clientWidth || viewBox.width || 128))
      const cssHeight = Math.max(1, Math.round(stage.clientHeight || viewBox.height || 128))
      const smilPosterTimeMs = motion?.format === 'svg-smil' ? motion.animation.posterTimeMs : undefined
      const sourceKey = `${asset}:${state}:${smilPosterTimeMs ?? 0}:${cssWidth}x${cssHeight}`
      let sourcePromise = sourceFrameCache.get(sourceKey)
      if (!sourcePromise) {
        sourcePromise = smilPosterTimeMs === undefined
          ? svgImageSource(svg, undefined, cssWidth, cssHeight)
          : smilFrameSource(svg, smilPosterTimeMs, cssWidth, cssHeight)
        sourceFrameCache.set(sourceKey, sourcePromise)
      }
      const source = await sourcePromise
      const hasParts = Boolean(svg.querySelector('[data-visual-motion-part="fixed"]') && svg.querySelector('[data-visual-motion-part="moving"]'))
      const [fixed, moving] = hasParts
        ? await Promise.all([svgImageSource(svg, 'fixed', cssWidth, cssHeight), svgImageSource(svg, 'moving', cssWidth, cssHeight)])
        : [null, null]
      if (disposed || !stage.isConnected) return
      const label = svg.getAttribute('aria-label') ?? ''
      const renderer = new OneBitRenderer(stage, { ...options, gridScale: options.gridScale, preferWebGl: false })
      renderer.resize(cssWidth, cssHeight)
      renderer.render(source)
      renderer.canvas.classList.add('visual-one-bit-canvas')
      renderer.canvas.style.imageRendering = 'pixelated'
      stage.append(sourceTemplate)
      stage.closest<HTMLElement>('.cadenza-visual')?.setAttribute('aria-label', label)
      stage.closest<HTMLElement>('.cadenza-visual')?.setAttribute('role', 'img')
      stage.dataset.oneBitReady = ''
      stage.dataset.visualFrame = 'poster'
      const configuredBehavior = visual?.dataset.axisBehavior
      const behavior = configuredBehavior && configuredBehavior !== 'none' && (motion?.verb === configuredBehavior || registered?.behaviors.includes(configuredBehavior as VisualMotionVerb))
        ? configuredBehavior as VisualMotionVerb : null
      const frame = document.createElement('canvas')
      frame.width = source.width
      frame.height = source.height
      const smil = motion?.format === 'svg-smil' && behavior
        ? createSmilCanvasSession(svg, motion.mode, motion.animation.posterTimeMs)
        : null
      sessions.set(stage, { stage, renderer, source, fixed, moving, frame, behavior, startedAt: null, completed: false, posterRendered: true, smil })
      reconcileLoop()
    } catch {
      stage.dataset.oneBitError = ''
    } finally {
      stage.removeAttribute('data-one-bit-processing')
    }
  }

  processWithin(root)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node instanceof Element) processWithin(node)
    }))
    reconcileLoop()
  })
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] })
  const handleMotionPreference = () => {
    sessions.forEach(session => { session.completed = false; session.startedAt = null })
    reconcileLoop()
  }
  reducedMotion?.addEventListener?.('change', handleMotionPreference)
  document.addEventListener('visibilitychange', reconcileLoop)

  return () => {
    disposed = true
    observer.disconnect()
    animationLoop.dispose()
    reducedMotion?.removeEventListener?.('change', handleMotionPreference)
    document.removeEventListener('visibilitychange', reconcileLoop)
    sessions.forEach(session => { session.smil?.svg.remove(); session.renderer.dispose() })
    sessions.clear()
  }

  function disposeSession(session: OneBitVisualSession) {
    session.smil?.svg.remove()
    session.renderer.dispose()
    sessions.delete(session.stage)
  }
}

function framePolicyForStage(stage: HTMLElement, animated: boolean, reducedMotion: boolean) {
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
  return resolveVisualFramePolicy({ profile, visible, reducedMotion, animated })
}

function renderActiveFrame(session: OneBitVisualSession, time: number) {
  const verb = session.behavior!
  const preset = session.smil
      ? { durationMs: session.smil.durationMs, loop: session.smil.mode === 'loop' ? 'idle' as const : 'once' as const }
    : visualMotionPresets[verb]
  session.startedAt ??= time
  const elapsed = Math.max(0, time - session.startedAt)
  const progress = preset.loop === 'idle' ? (elapsed % preset.durationMs) / preset.durationMs : Math.min(1, elapsed / preset.durationMs)
  const frame = resolveVisualMotionFrame(verb, progress)
  const context = session.frame.getContext('2d', { alpha: false })
  if (!context) return
  const { width, height } = session.frame
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  if (session.smil) {
    const sourceTimeMs = session.smil.mode === 'loop' ? elapsed % session.smil.periodMs : Math.min(elapsed, session.smil.durationMs)
    session.smil.svg.setCurrentTime(sourceTimeMs / 1000)
    drawSmilSvgFrame(session.smil.svg, context, width, height)
    session.renderer.render(session.frame)
    session.posterRendered = false
    session.stage.dataset.visualFrame = 'active'
    session.stage.dataset.smilRenderer = 'native-svg-image+one-bit'
    if (preset.loop === 'once' && progress >= 1) {
      session.completed = true
      renderPoster(session)
    }
    return
  }
  context.save()
  context.translate(width / 2, height / 2)
  if (session.fixed && session.moving) {
    context.drawImage(session.fixed, -width / 2, -height / 2, width, height)
    context.translate(frame.moving.translateX, frame.moving.translateY)
    context.rotate(frame.moving.rotate * Math.PI / 180)
    context.scale(frame.moving.scale, frame.moving.scale)
    context.globalAlpha = frame.moving.opacity
    context.drawImage(session.moving, -width / 2, -height / 2, width, height)
  } else {
    context.translate(frame.moving.translateX, frame.moving.translateY)
    context.rotate(frame.moving.rotate * Math.PI / 180)
    context.scale(frame.moving.scale, frame.moving.scale)
    context.globalAlpha = frame.moving.opacity
    context.drawImage(session.source, -width / 2, -height / 2, width, height)
  }
  context.restore()
  session.renderer.render(session.frame)
  session.posterRendered = false
  session.stage.dataset.visualFrame = 'active'
  if (preset.loop === 'once' && progress >= 1) {
    session.completed = true
    renderPoster(session)
  }
}

function renderPoster(session: OneBitVisualSession) {
  if (!session.posterRendered) session.renderer.render(session.source)
  session.posterRendered = true
  session.stage.dataset.visualFrame = 'poster'
}

export function motionFrameHasDetachedDecoration(accent: { kind: string, opacity: number } | null) {
  return Boolean(accent && accent.opacity > .01 && ['ring', 'trail', 'ray', 'dot'].includes(accent.kind))
}

async function svgImageSource(svg: SVGSVGElement, keepPart?: 'fixed' | 'moving', outputWidth?: number, outputHeight?: number) {
  const clone = preparedSvgClone(svg, !keepPart)
  bakeSmilPoster(clone)
  if (keepPart) clone.querySelectorAll(`[data-visual-motion-part]:not([data-visual-motion-part="${keepPart}"])`).forEach(node => node.remove())
  const image = await decodeSvgImage(clone)
  const viewBox = numericViewBox(clone)
  const [, , width, height] = viewBox
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(outputWidth ?? width))
  canvas.height = Math.max(1, Math.round(outputHeight ?? height))
  const context = canvas.getContext('2d', { alpha: Boolean(keepPart) })
  if (!context) throw new Error('visual SVG staging canvas is unavailable')
  context.imageSmoothingEnabled = true
  if (!keepPart) {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function smilFrameSource(svg: SVGSVGElement, timeMs: number, outputWidth: number, outputHeight: number) {
  const clone = preparedSvgClone(svg, false)
  const [, , viewWidth, viewHeight] = numericViewBox(clone)
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText = `position:fixed;left:-10000px;top:0;width:${viewWidth}px;height:${viewHeight}px;pointer-events:none`
  document.body.append(clone)
  clone.pauseAnimations()
  clone.setCurrentTime(timeMs / 1000)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(outputWidth))
  canvas.height = Math.max(1, Math.round(outputHeight))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) { clone.remove(); throw new Error('visual SVG staging canvas is unavailable') }
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawSmilSvgFrame(clone, context, canvas.width, canvas.height)
  clone.remove()
  return Promise.resolve(canvas)
}

function createSmilCanvasSession(svg: SVGSVGElement, mode: 'enter' | 'loop' | 'morph', durationMs: number) {
  const clone = preparedSvgClone(svg, false)
  const [, , width, height] = numericViewBox(clone)
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none`
  document.body.append(clone)
  clone.pauseAnimations()
  const periods = [...clone.querySelectorAll<SVGElement>('[repeatCount="indefinite"][dur]')].map(node => parseClockMs(node.getAttribute('dur') ?? '0s'))
  return { svg: clone, mode, durationMs, periodMs: Math.max(durationMs, ...periods) }
}

function parseClockMs(value: string) {
  const match = /^([\d.]+)(ms|s)$/.exec(value.trim())
  if (!match) return 0
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}

function drawSmilSvgFrame(svg: SVGSVGElement, context: CanvasRenderingContext2D, width: number, height: number) {
  const [viewX, viewY, viewWidth, viewHeight] = numericViewBox(svg)
  const scaleX = width / viewWidth
  const scaleY = height / viewHeight
  const geometry = [...svg.querySelectorAll<SVGGeometryElement>('path, circle, ellipse, rect, line, polyline, polygon')]
    .filter(shape => !shape.closest('defs, mask, clipPath'))
  for (const shape of geometry) {
    const maskReference = /^url\(#(.+)\)$/.exec(shape.getAttribute('mask') ?? '')?.[1]
    if (!maskReference) {
      drawGeometryShape(shape, context, { viewX, viewY, scaleX, scaleY })
      continue
    }
    const mask = svg.querySelector<SVGMaskElement>(`#${CSS.escape(maskReference)}`)
    if (!mask) continue
    const contentCanvas = document.createElement('canvas'); contentCanvas.width = width; contentCanvas.height = height
    const content = contentCanvas.getContext('2d')!
    drawGeometryShape(shape, content, { viewX, viewY, scaleX, scaleY })
    const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height
    const maskContext = maskCanvas.getContext('2d')!
    mask.querySelectorAll<SVGGeometryElement>('path, circle, ellipse, rect, line, polyline, polygon').forEach(maskShape => {
      drawGeometryShape(maskShape, maskContext, { viewX, viewY, scaleX, scaleY })
    })
    const maskPixels = maskContext.getImageData(0, 0, width, height)
    for (let index = 0; index < maskPixels.data.length; index += 4) {
      const luminance = (maskPixels.data[index] * .2126 + maskPixels.data[index + 1] * .7152 + maskPixels.data[index + 2] * .0722) / 255
      maskPixels.data[index + 3] = Math.round(maskPixels.data[index + 3] * luminance)
    }
    maskContext.putImageData(maskPixels, 0, 0)
    content.globalCompositeOperation = 'destination-in'
    content.drawImage(maskCanvas, 0, 0)
    context.drawImage(contentCanvas, 0, 0)
  }
}

function drawGeometryShape(shape: SVGGeometryElement, context: CanvasRenderingContext2D, viewport: { viewX: number, viewY: number, scaleX: number, scaleY: number }) {
    const style = getComputedStyle(shape)
    const path = geometryPath(shape, style)
    if (!path) return
    const matrix = shape.getCTM()
    context.save()
    if (matrix) context.setTransform(matrix.a * viewport.scaleX, matrix.b * viewport.scaleY, matrix.c * viewport.scaleX, matrix.d * viewport.scaleY, (matrix.e - viewport.viewX) * viewport.scaleX, (matrix.f - viewport.viewY) * viewport.scaleY)
    const opacity = ancestorOpacity(shape)
    const fill = style.fill
    if (fill !== 'none' && Number(style.fillOpacity) > 0) {
      context.globalAlpha = opacity * numericOpacity(style.fillOpacity)
      context.fillStyle = fill
      context.fill(path, style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero')
    }
    const stroke = style.stroke
    const strokeWidth = Number.parseFloat(style.strokeWidth)
    if (stroke !== 'none' && strokeWidth > 0 && Number(style.strokeOpacity) > 0) {
      context.globalAlpha = opacity * numericOpacity(style.strokeOpacity)
      context.strokeStyle = stroke
      context.lineWidth = strokeWidth
      context.lineCap = style.strokeLinecap as CanvasLineCap
      context.lineJoin = style.strokeLinejoin as CanvasLineJoin
      context.miterLimit = Number.parseFloat(style.strokeMiterlimit) || 4
      context.setLineDash(style.strokeDasharray === 'none'
        ? []
        : style.strokeDasharray
            .split(/[ ,]+/)
            .map((value) => Number.parseFloat(value))
            .filter(Number.isFinite))
      context.lineDashOffset = Number.parseFloat(style.strokeDashoffset) || 0
      context.stroke(path)
    }
    context.restore()
}

function geometryPath(shape: SVGGeometryElement, style: CSSStyleDeclaration) {
  const path = new Path2D()
  if (shape instanceof SVGPathElement) {
    const computed = style.getPropertyValue('d').trim()
    const animated = /^path\(["']([\s\S]*)["']\)$/.exec(computed)?.[1]
    return new Path2D(animated ?? shape.getAttribute('d') ?? '')
  }
  if (shape instanceof SVGCircleElement) { path.arc(shape.cx.animVal.value, shape.cy.animVal.value, shape.r.animVal.value, 0, Math.PI * 2); return path }
  if (shape instanceof SVGEllipseElement) { path.ellipse(shape.cx.animVal.value, shape.cy.animVal.value, shape.rx.animVal.value, shape.ry.animVal.value, 0, 0, Math.PI * 2); return path }
  if (shape instanceof SVGRectElement) { path.roundRect(shape.x.animVal.value, shape.y.animVal.value, shape.width.animVal.value, shape.height.animVal.value, [shape.rx.animVal.value, shape.ry.animVal.value]); return path }
  if (shape instanceof SVGLineElement) { path.moveTo(shape.x1.animVal.value, shape.y1.animVal.value); path.lineTo(shape.x2.animVal.value, shape.y2.animVal.value); return path }
  if (shape instanceof SVGPolylineElement || shape instanceof SVGPolygonElement) {
    const points = shape.points
    if (!points.numberOfItems) return null
    const first = points.getItem(0); path.moveTo(first.x, first.y)
    for (let index = 1; index < points.numberOfItems; index += 1) { const point = points.getItem(index); path.lineTo(point.x, point.y) }
    if (shape instanceof SVGPolygonElement) path.closePath()
    return path
  }
  return null
}

function ancestorOpacity(shape: Element) {
  let opacity = 1
  for (let current: Element | null = shape; current && !(current instanceof SVGSVGElement); current = current.parentElement) opacity *= numericOpacity(getComputedStyle(current).opacity)
  return opacity
}

function numericOpacity(value: string) { const number = Number.parseFloat(value); return Number.isFinite(number) ? number : 1 }

function preparedSvgClone(svg: SVGSVGElement, includeBackground: boolean) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // The one-bit renderer owns token mapping. Use a full-range monochrome mask
  // here so the paper field stays clean instead of being re-dithered.
  clone.setAttribute('color', '#000')
  clone.setAttribute('fill', '#000')
  clone.style.setProperty('--paper', '#fff')
  clone.style.setProperty('--accent', '#000')
  clone.querySelector('[data-visual-motion-accent]')?.remove()
  if (includeBackground) {
    const [x, y, width, height] = numericViewBox(clone)
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    background.setAttribute('x', String(x))
    background.setAttribute('y', String(y))
    background.setAttribute('width', String(width))
    background.setAttribute('height', String(height))
    background.setAttribute('fill', '#fff')
    clone.prepend(background)
  }
  return clone
}

function numericViewBox(svg: SVGSVGElement): [number, number, number, number] {
  const values = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? []
  return values.length === 4 && values.every(Number.isFinite) ? values as [number, number, number, number] : [0, 0, 256, 256]
}

function bakeSmilPoster(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>('animate, animateTransform, set').forEach(animation => {
    const parent = animation.parentElement
    const attributeName = animation.getAttribute('attributeName')
    const values = animation.getAttribute('values')?.split(';').map(value => value.trim()).filter(Boolean)
    const value = animation.getAttribute('to') ?? values?.at(-1)
    if (parent && attributeName && value !== undefined) {
      if (animation.tagName === 'animateTransform') {
        const type = animation.getAttribute('type') ?? 'translate'
        parent.setAttribute(attributeName, `${type}(${value.replaceAll(' ', ',')})`)
      } else parent.setAttribute(attributeName, value)
    }
    animation.remove()
  })
}

async function decodeSvgImage(svg: SVGSVGElement) {
  const image = new Image()
  image.decoding = 'async'
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  if (typeof image.decode === 'function') await image.decode()
  else await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(new Error('visual SVG failed to decode')), { once: true })
  })
  return image
}
