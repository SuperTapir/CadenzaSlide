export interface NormalizedPoint {
  x: number
  y: number
}

export interface RenderSizeRequest {
  cssWidth: number
  cssHeight: number
  devicePixelRatio: number
  maxPixelRatio: number
  maxPixelCount: number
}

export interface RenderSize {
  width: number
  height: number
  scaleX: number
  scaleY: number
}

function requirePositiveFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive finite number`)
}

export function computeRenderSize(request: RenderSizeRequest): RenderSize {
  requirePositiveFinite(request.cssWidth, 'cssWidth')
  requirePositiveFinite(request.cssHeight, 'cssHeight')
  requirePositiveFinite(request.devicePixelRatio, 'devicePixelRatio')
  requirePositiveFinite(request.maxPixelRatio, 'maxPixelRatio')
  requirePositiveFinite(request.maxPixelCount, 'maxPixelCount')

  const requestedRatio = Math.min(request.devicePixelRatio, request.maxPixelRatio)
  let width = Math.max(1, Math.floor(request.cssWidth * requestedRatio))
  let height = Math.max(1, Math.floor(request.cssHeight * requestedRatio))
  const pixelCount = width * height

  if (pixelCount > request.maxPixelCount) {
    const budgetScale = Math.sqrt(request.maxPixelCount / pixelCount)
    width = Math.max(1, Math.floor(width * budgetScale))
    height = Math.max(1, Math.floor(height * budgetScale))
  }

  return {
    width,
    height,
    scaleX: width / request.cssWidth,
    scaleY: height / request.cssHeight,
  }
}

export function projectNormalizedPoint(point: NormalizedPoint, width: number, height: number) {
  requirePositiveFinite(width, 'width')
  requirePositiveFinite(height, 'height')
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new RangeError('point must contain finite coordinates')
  return { x: point.x * width, y: point.y * height }
}
