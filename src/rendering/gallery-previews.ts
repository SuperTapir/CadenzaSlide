import { environmentDrawers } from '../engine/environment-drawers'
import { isEnvironmentPresetId, type SceneId } from '../engine/environment-presets'
import { DEFAULT_ONE_BIT_OPTIONS, ditherRgba } from '../engine/one-bit/reference'
import type { GalleryComponentId } from './gallery-components'

export const galleryComponentSelectors: Record<GalleryComponentId, string> = {
  text: '[data-component-kind="text"]',
  image: '[data-component-kind="image"]',
  shape: '[data-component-kind="shape"]',
  table: '[data-component-kind="table"]',
  code: '[data-component-kind="code"]',
  video: '[data-component-kind="video"]',
  chart: '[data-component-kind="chart"]',
  html: '[data-component-kind="html"]',
}

export function hydrateGalleryPreviews(root: HTMLElement) {
  root.querySelectorAll<HTMLCanvasElement>('[data-gallery-environment-preview]').forEach((canvas) => {
    const scene = canvas.dataset.galleryEnvironmentPreview
    if (isEnvironmentPresetId(scene)) renderEnvironmentPreview(canvas, scene)
  })

  const previewHosts = [...root.querySelectorAll<HTMLElement>('[data-gallery-slide-preview]')]
  previewHosts.forEach(host => renderGallerySlidePreview(host, authoredSlideForPreview(root, host)))

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
    entries.forEach((entry) => scalePreview(entry.target as HTMLElement))
  })
  previewHosts.forEach((host) => {
    resizeObserver?.observe(host)
    scalePreview(host)
  })
  return () => resizeObserver?.disconnect()
}

export function renderGallerySlidePreview(host: HTMLElement, authoredSlide?: HTMLElement) {
  const template = host.querySelector<HTMLTemplateElement>('[data-gallery-preview-template]')
  const destination = host.querySelector<HTMLElement>('.gallery-preview-content')
  const section = (authoredSlide ?? template?.content.firstElementChild)?.cloneNode(true)
  if (!(section instanceof HTMLElement) || !destination) return false
  const scene = section.dataset.cadenzaScene ?? host.dataset.galleryPreviewBackground
  if (isEnvironmentPresetId(scene)) {
    let canvas = host.querySelector<HTMLCanvasElement>(':scope > canvas[data-gallery-environment-preview]')
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      canvas.setAttribute('aria-hidden', 'true')
      host.prepend(canvas)
    }
    canvas.dataset.galleryEnvironmentPreview = scene
    renderEnvironmentPreview(canvas, scene)
  }
  const reveal = document.createElement('div')
  reveal.className = 'reveal gallery-thumbnail-reveal'
  const slides = document.createElement('div')
  slides.className = 'slides'
  section.classList.add('present')
  const focusSelector = galleryComponentSelectors[host.dataset.galleryFocus as GalleryComponentId]
  if (focusSelector) section.querySelector<HTMLElement>(focusSelector)?.setAttribute('data-gallery-focused', 'true')
  replaceExecutableMedia(section)
  section.querySelectorAll<HTMLElement>('img, video').forEach(media => media.setAttribute('draggable', 'false'))
  slides.append(section)
  reveal.append(slides)
  destination.replaceChildren(reveal)
  scalePreview(host)
  return true
}

function replaceExecutableMedia(section: HTMLElement) {
  section.querySelectorAll<HTMLVideoElement>('video').forEach(video => {
    const label = video.getAttribute('aria-label') ?? 'Video'
    const poster = video.getAttribute('poster')
    const replacement = poster ? document.createElement('img') : document.createElement('div')
    replacement.className = video.className
    replacement.setAttribute('style', video.getAttribute('style') ?? '')
    replacement.setAttribute('role', 'img')
    replacement.setAttribute('aria-label', label)
    replacement.dataset.mediaPreview = 'video'
    if (replacement instanceof HTMLImageElement) { replacement.src = poster!; replacement.alt = label; replacement.loading = 'lazy' }
    video.replaceWith(replacement)
  })
  section.querySelectorAll<HTMLIFrameElement>('iframe').forEach(frame => {
    const replacement = document.createElement('div')
    replacement.className = frame.className
    replacement.setAttribute('style', frame.getAttribute('style') ?? '')
    replacement.setAttribute('role', 'img')
    replacement.setAttribute('aria-label', frame.title || 'Embedded media')
    replacement.dataset.mediaPreview = 'iframe'
    frame.replaceWith(replacement)
  })
}

function authoredSlideForPreview(root: HTMLElement, host: HTMLElement) {
  const slideId = host.querySelector<HTMLTemplateElement>('[data-gallery-preview-template]')?.content.firstElementChild?.getAttribute('data-slide-id')
  return slideId ? root.querySelector<HTMLElement>(`.deck-frame [data-slide-id="${CSS.escape(slideId)}"]`) ?? undefined : undefined
}

export function renderEnvironmentPreview(canvas: HTMLCanvasElement, scene: SceneId) {
  const source = document.createElement('canvas')
  source.width = canvas.width
  source.height = canvas.height
  const sourceContext = source.getContext('2d', { alpha: false })
  const outputContext = canvas.getContext('2d', { alpha: false })
  if (!sourceContext || !outputContext) return false
  environmentDrawers[scene]({
    context: sourceContext,
    width: source.width,
    height: source.height,
    time: 0,
    mode: 'static',
  })
  const image = sourceContext.getImageData(0, 0, source.width, source.height)
  image.data.set(ditherRgba(image.data, source.width, source.height, {
    ...DEFAULT_ONE_BIT_OPTIONS,
    gridScale: 1,
  }))
  outputContext.putImageData(image, 0, 0)
  return true
}

function scalePreview(host: HTMLElement) {
  const reveal = host.querySelector<HTMLElement>('.gallery-thumbnail-reveal')
  if (!reveal) return
  const width = host.getBoundingClientRect().width
  if (width > 0) reveal.style.setProperty('--gallery-preview-scale', String(width / 1280))
}
