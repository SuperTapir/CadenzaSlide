import { STUDIO_ZOOM_MAX, STUDIO_ZOOM_MIN } from './studio-workspace-state'

export type Size = { width: number, height: number }

export function computeFitScale(canvas: Size, available: Size) {
  if (canvas.width <= 0 || canvas.height <= 0 || available.width <= 0 || available.height <= 0) return 0
  return Math.min(available.width / canvas.width, available.height / canvas.height)
}

export function clampZoomPercent(value: number) {
  return Math.max(STUDIO_ZOOM_MIN, Math.min(STUDIO_ZOOM_MAX, Math.round(value)))
}

export function createResizeFrameScheduler<T>(apply: (value: T) => void, requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame) {
  let frame = 0
  let latest: T
  return (value: T) => {
    latest = value
    if (frame) return
    frame = requestFrame(() => {
      frame = 0
      apply(latest)
    })
  }
}
