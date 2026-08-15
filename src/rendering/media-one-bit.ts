import { DEFAULT_ONE_BIT_OPTIONS, ditherRgba, type OneBitOptions, type Rgb } from '../engine/one-bit/reference'

export const oneBitImageSelector = [
  '.component-image-area img[data-media-treatment="one-bit"]',
  '.component-object-image img[data-media-treatment="one-bit"]',
  '.cadenza-media img[data-media-treatment="one-bit"]',
  '.cadenza-profile > img[data-media-treatment="one-bit"]',
  '.cadenza-logo img[data-media-treatment="one-bit"]',
].join(', ')

const renderedSources = new Map<string, Promise<string>>()

export function oneBitOptionsFromTokens(paper: string, ink: string): OneBitOptions {
  return {
    ...DEFAULT_ONE_BIT_OPTIONS,
    paper: parseCssColour(paper),
    ink: parseCssColour(ink),
  }
}

export function hydrateOneBitImages(root: ParentNode, tokenRoot: Element = document.documentElement) {
  const styles = getComputedStyle(tokenRoot)
  const options = oneBitOptionsFromTokens(styles.getPropertyValue('--paper'), styles.getPropertyValue('--ink'))
  const processWithin = (node: ParentNode) => {
    if (node instanceof HTMLImageElement && node.matches(oneBitImageSelector)) void renderOneBitImage(node, options)
    node.querySelectorAll<HTMLImageElement>(oneBitImageSelector).forEach(image => { void renderOneBitImage(image, options) })
  }
  processWithin(root)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node instanceof Element) processWithin(node)
    }))
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}

async function renderOneBitImage(image: HTMLImageElement, options: Readonly<OneBitOptions>) {
  if (image.hasAttribute('data-one-bit-ready') || image.hasAttribute('data-one-bit-processing')) return
  const source = image.currentSrc || image.src
  if (!source) return
  image.setAttribute('data-one-bit-processing', '')
  image.dataset.oneBitSource = source
  try {
    const key = `${source}|${options.paper.join(',')}|${options.ink.join(',')}|${options.contrast}|${options.gridScale}`
    let rendered = renderedSources.get(key)
    if (!rendered) {
      rendered = renderSource(source, options)
      renderedSources.set(key, rendered)
    }
    image.src = await rendered
    await decodeImage(image)
    image.setAttribute('data-one-bit-ready', '')
  } catch {
    image.setAttribute('data-one-bit-error', '')
  } finally {
    image.removeAttribute('data-one-bit-processing')
  }
}

async function renderSource(source: string, options: Readonly<OneBitOptions>) {
  const image = new Image()
  image.decoding = 'async'
  image.src = source
  await decodeImage(image)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { alpha: false })
  if (!context || !canvas.width || !canvas.height) throw new Error('one-bit image canvas is unavailable')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  pixels.data.set(ditherRgba(pixels.data, canvas.width, canvas.height, options))
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

async function decodeImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return
  if (typeof image.decode === 'function') {
    try { await image.decode(); return } catch { /* fall through to events */ }
  }
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(new Error('image failed to load')), { once: true })
  })
}

function parseCssColour(value: string): Rgb {
  const colour = value.trim().toLowerCase()
  const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(colour)
  if (shortHex) return shortHex.slice(1).map(channel => Number.parseInt(channel + channel, 16)) as unknown as Rgb
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour)
  if (hex) return hex.slice(1).map(channel => Number.parseInt(channel, 16)) as unknown as Rgb
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/.exec(colour)
  if (rgb) return rgb.slice(1, 4).map(channel => Math.round(Number(channel))) as unknown as Rgb
  throw new TypeError(`Unsupported design-token colour: ${value}`)
}
