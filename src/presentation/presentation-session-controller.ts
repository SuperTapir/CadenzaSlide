import {
  createPresentationMessage,
  isPresentationMessage,
  presentationChannelName,
  type PresentationMessage,
} from './presentation-session'

export type PresentationSessionMode = 'studio' | 'audience' | 'receiver'
type PresentationDeckEvent = 'slidechanged' | 'fragmentshown' | 'fragmenthidden'

export interface PresentationDeckLike {
  getState(): Record<string, unknown>
  setState(state: Record<string, unknown>): void
  on(event: PresentationDeckEvent, listener: () => void): void
  off(event: PresentationDeckEvent, listener: () => void): void
}

export interface PresentationChannelLike {
  postMessage(message: PresentationMessage): void
  addEventListener(event: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(event: 'message', listener: (event: MessageEvent) => void): void
  close(): void
}

type PresentationSessionOptions = {
  mode: PresentationSessionMode
  deckId: string
  sessionId: string
  deck: PresentationDeckLike
  channel?: PresentationChannelLike | null
  onParticipantReady?: (role: 'audience' | 'presenter') => void
  onEnded?: () => void
}

const deckEvents: PresentationDeckEvent[] = ['slidechanged', 'fragmentshown', 'fragmenthidden']

export class PresentationSessionController {
  private readonly mode: PresentationSessionMode
  private readonly sessionId: string
  private readonly deck: PresentationDeckLike
  private readonly channel: PresentationChannelLike | null
  private readonly onParticipantReady: (role: 'audience' | 'presenter') => void
  private readonly onEnded: () => void
  private started = false
  private disposed = false
  private active: boolean
  private ended = false
  private sequence = 0
  private lastAppliedSequence = -1
  private applyingRemoteState = false

  constructor(options: PresentationSessionOptions) {
    this.mode = options.mode
    this.sessionId = options.sessionId
    this.deck = options.deck
    this.channel = options.channel === undefined ? createChannel(presentationChannelName(options.deckId, options.sessionId)) : options.channel
    this.onParticipantReady = options.onParticipantReady ?? (() => {})
    this.onEnded = options.onEnded ?? (() => {})
    this.active = options.mode !== 'studio'
  }

  start() {
    if (this.started || this.disposed) return
    this.started = true
    this.channel?.addEventListener('message', this.handleMessage)
    if (this.mode === 'studio') deckEvents.forEach(event => this.deck.on(event, this.broadcastState))
    if (this.mode === 'audience') {
      deckEvents.forEach(event => this.deck.on(event, this.broadcastNavigation))
      this.channel?.postMessage(createPresentationMessage('ready', this.sessionId, { role: 'audience' }))
      this.channel?.postMessage(createPresentationMessage('request-state', this.sessionId, {}))
    }
    if (this.mode === 'receiver') this.channel?.postMessage(createPresentationMessage('ready', this.sessionId, { role: 'presenter' }))
  }

  activate() {
    if (this.mode !== 'studio' || this.disposed) return
    this.active = true
    this.ended = false
  }

  end() {
    if (this.mode !== 'studio' || !this.active || this.ended) return
    this.channel?.postMessage(createPresentationMessage('ended', this.sessionId, {}))
    this.active = false
    this.ended = true
  }

  dispose() {
    if (this.disposed) return
    this.end()
    this.disposed = true
    if (this.started) {
      if (this.mode === 'studio') deckEvents.forEach(event => this.deck.off(event, this.broadcastState))
      if (this.mode === 'audience') deckEvents.forEach(event => this.deck.off(event, this.broadcastNavigation))
      this.channel?.removeEventListener('message', this.handleMessage)
    }
    this.channel?.close()
  }

  private broadcastState = () => {
    if (!this.active || this.disposed) return
    this.channel?.postMessage(createPresentationMessage('state', this.sessionId, {
      sequence: ++this.sequence,
      revealState: this.deck.getState(),
    }))
  }

  private broadcastNavigation = () => {
    if (this.applyingRemoteState || this.ended || this.disposed) return
    this.channel?.postMessage(createPresentationMessage('navigate', this.sessionId, {
      revealState: this.deck.getState(),
    }))
  }

  private handleMessage = (event: MessageEvent) => {
    const message = event.data
    if (!isPresentationMessage(message, this.sessionId)) return
    if (this.mode === 'studio' && message.type === 'ready') {
      this.onParticipantReady(message.role)
      this.broadcastState()
    } else if (this.mode === 'studio' && message.type === 'request-state') this.broadcastState()
    else if (this.mode === 'studio' && message.type === 'navigate' && this.active && !this.ended) this.deck.setState(message.revealState)
    else if (this.mode === 'audience' && message.type === 'state' && !this.ended && message.sequence > this.lastAppliedSequence) {
      this.lastAppliedSequence = message.sequence
      this.applyingRemoteState = true
      this.deck.setState(message.revealState)
      queueMicrotask(() => { this.applyingRemoteState = false })
    } else if (this.mode === 'audience' && message.type === 'ended' && !this.ended) {
      this.ended = true
      this.onEnded()
    }
  }
}

function createChannel(name: string): PresentationChannelLike | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name)
}
