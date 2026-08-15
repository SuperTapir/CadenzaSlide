export interface FrameScheduler {
  request(callback: FrameRequestCallback): number
  cancel(id: number): void
}

function browserFrameScheduler(): FrameScheduler {
  return {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  }
}

export class AnimationLoop {
  private frame: number | null = null
  private running = false
  private disposed = false
  private readonly renderFrame: FrameRequestCallback
  private readonly scheduler: FrameScheduler

  constructor(renderFrame: FrameRequestCallback, scheduler: FrameScheduler = browserFrameScheduler()) {
    this.renderFrame = renderFrame
    this.scheduler = scheduler
  }

  get isRunning() { return this.running }

  start() {
    if (this.disposed) throw new Error('AnimationLoop is disposed')
    if (this.running) return
    this.running = true
    this.frame = this.scheduler.request(this.tick)
  }

  stop() {
    if (!this.running) return
    this.running = false
    if (this.frame !== null) this.scheduler.cancel(this.frame)
    this.frame = null
  }

  dispose() {
    if (this.disposed) return
    this.stop()
    this.disposed = true
  }

  private tick: FrameRequestCallback = (time) => {
    if (!this.running) return
    this.frame = null
    this.renderFrame(time)
    if (this.running) this.frame = this.scheduler.request(this.tick)
  }
}
