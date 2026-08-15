export interface MotionMediaQuery {
  matches: boolean
  addEventListener(event: 'change', listener: (event: { matches: boolean }) => void): void
  removeEventListener(event: 'change', listener: (event: { matches: boolean }) => void): void
}

export class MotionPreference {
  private listeners = new Set<(reduced: boolean) => void>()
  private disposed = false
  private readonly query: MotionMediaQuery
  private currentReduced: boolean

  constructor(query: MotionMediaQuery = matchMedia('(prefers-reduced-motion: reduce)')) {
    this.query = query
    this.currentReduced = query.matches
    this.query.addEventListener('change', this.handleChange)
  }

  get reduced() { return this.currentReduced }

  subscribe(listener: (reduced: boolean) => void) {
    if (this.disposed) throw new Error('MotionPreference is disposed')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.query.removeEventListener('change', this.handleChange)
    this.listeners.clear()
  }

  private handleChange = (event: { matches: boolean }) => {
    this.currentReduced = event.matches
    this.listeners.forEach((listener) => listener(this.currentReduced))
  }
}
