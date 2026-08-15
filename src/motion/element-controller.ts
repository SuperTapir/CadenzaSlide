interface FragmentEvent { fragment?: HTMLElement }

interface FragmentDeck {
  on(event: 'fragmentshown' | 'fragmenthidden', listener: (event: FragmentEvent) => void): void
  off(event: 'fragmentshown' | 'fragmenthidden', listener: (event: FragmentEvent) => void): void
}

interface AnimationScheduler {
  now(): number
  request(callback: FrameRequestCallback): number
  cancel(id: number): void
}

export interface ParsedCountValue {
  prefix: string
  value: number
  suffix: string
  precision: number
  pad: number
}

const defaultScheduler: AnimationScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

export function parseCountValue(input: string): ParsedCountValue | null {
  const match = input.trim().match(/^([^\d+-]*)([+-]?(?:\d[\d,]*)(?:\.\d+)?)(.*)$/)
  if (!match) return null
  const numeric = match[2]!.replaceAll(',', '')
  const value = Number(numeric)
  if (!Number.isFinite(value)) return null
  const decimal = numeric.split('.')[1]
  const integer = numeric.replace(/^[+-]/, '').split('.')[0]!
  const pad = decimal === undefined && integer.length > 1 && integer.startsWith('0') ? integer.length : 0
  return { prefix: match[1]!, value, suffix: match[3]!, precision: decimal?.length ?? 0, pad }
}

export class ElementMotionController {
  private started = false
  private frameId: number | null = null
  private readonly deck: FragmentDeck
  private reducedMotion: boolean
  private readonly scheduler: AnimationScheduler

  constructor(
    deck: FragmentDeck,
    reducedMotion: boolean,
    scheduler: AnimationScheduler = defaultScheduler,
  ) {
    this.deck = deck
    this.reducedMotion = reducedMotion
    this.scheduler = scheduler
  }

  start() {
    if (this.started) return
    this.started = true
    this.deck.on('fragmentshown', this.onShown)
    this.deck.on('fragmenthidden', this.onHidden)
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
  }

  dispose() {
    if (!this.started) return
    this.started = false
    if (this.frameId !== null) this.scheduler.cancel(this.frameId)
    this.frameId = null
    this.deck.off('fragmentshown', this.onShown)
    this.deck.off('fragmenthidden', this.onHidden)
  }

  private readonly onShown = ({ fragment }: FragmentEvent) => {
    const target = findCountTarget(fragment)
    if (!target) return
    const parsed = parseCountValue(target.dataset.countValue!)
    if (!parsed) return
    if (this.frameId !== null) this.scheduler.cancel(this.frameId)
    if (this.reducedMotion) {
      target.textContent = formatCount(parsed, parsed.value)
      return
    }
    const startedAt = this.scheduler.now()
    const tick = () => {
      const progress = Math.min(1, (this.scheduler.now() - startedAt) / 280)
      const eased = 1 - Math.pow(1 - progress, 3)
      target.textContent = formatCount(parsed, parsed.value * eased)
      if (progress < 1) this.frameId = this.scheduler.request(tick)
      else this.frameId = null
    }
    target.textContent = formatCount(parsed, 0)
    this.frameId = this.scheduler.request(tick)
  }

  private readonly onHidden = ({ fragment }: FragmentEvent) => {
    const target = findCountTarget(fragment)
    if (!target) return
    if (this.frameId !== null) this.scheduler.cancel(this.frameId)
    this.frameId = null
    const parsed = parseCountValue(target.dataset.countValue!)
    if (parsed) target.textContent = formatCount(parsed, 0)
  }
}

function findCountTarget(fragment: HTMLElement | undefined) {
  if (!fragment) return null
  if (fragment.dataset.countValue !== undefined) return fragment
  return fragment.querySelector<HTMLElement>('[data-count-value]')
}

function formatCount(parsed: ParsedCountValue, value: number) {
  const fixed = value.toFixed(parsed.precision)
  const [integer, decimal] = fixed.split('.')
  const padded = parsed.pad > 0 ? integer!.padStart(parsed.pad, '0') : integer!
  return `${parsed.prefix}${padded}${decimal === undefined ? '' : `.${decimal}`}${parsed.suffix}`
}
