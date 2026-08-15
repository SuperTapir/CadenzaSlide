import { describe, expect, it, vi } from 'vitest'
import { createPresentationMessage, type PresentationMessage } from './presentation-session'
import { PresentationSessionController, type PresentationChannelLike, type PresentationDeckLike } from './presentation-session-controller'

class FakeDeck implements PresentationDeckLike {
  private listeners = new Map<string, Set<() => void>>()
  state: Record<string, unknown> = { indexh: 2 }
  readonly applied: Record<string, unknown>[] = []

  getState() { return this.state }
  setState(state: Record<string, unknown>) { this.applied.push(state) }
  on(event: 'slidechanged' | 'fragmentshown' | 'fragmenthidden', listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }
  off(event: 'slidechanged' | 'fragmentshown' | 'fragmenthidden', listener: () => void) {
    this.listeners.get(event)?.delete(listener)
  }
  emit(event: 'slidechanged' | 'fragmentshown' | 'fragmenthidden') {
    this.listeners.get(event)?.forEach(listener => listener())
  }
  listenerCount() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0) }
}

class FakeChannel implements PresentationChannelLike {
  readonly sent: PresentationMessage[] = []
  readonly close = vi.fn()
  private listeners = new Set<(event: MessageEvent) => void>()

  postMessage(message: PresentationMessage) { this.sent.push(message) }
  addEventListener(_event: 'message', listener: (event: MessageEvent) => void) { this.listeners.add(listener) }
  removeEventListener(_event: 'message', listener: (event: MessageEvent) => void) { this.listeners.delete(listener) }
  receive(message: unknown) { this.listeners.forEach(listener => listener({ data: message } as MessageEvent)) }
  listenerCount() { return this.listeners.size }
}

describe('PresentationSessionController', () => {
  it('lets Studio own state broadcasting, participant readiness, ending, and cleanup', () => {
    const deck = new FakeDeck()
    const channel = new FakeChannel()
    const onParticipantReady = vi.fn()
    const controller = new PresentationSessionController({
      mode: 'studio', deckId: 'demo', sessionId: 'session-1', deck, channel,
      onParticipantReady,
    })

    controller.start()
    expect(deck.listenerCount()).toBe(3)
    deck.emit('slidechanged')
    expect(channel.sent).toEqual([])

    controller.activate()
    deck.emit('slidechanged')
    channel.receive(createPresentationMessage('ready', 'session-1', { role: 'presenter' }))
    channel.receive(createPresentationMessage('request-state', 'session-1', {}))

    expect(onParticipantReady).toHaveBeenCalledWith('presenter')
    expect(channel.sent.filter(message => message.type === 'state').map(message => message.type === 'state' && message.sequence)).toEqual([1, 2, 3])

    controller.dispose()
    controller.dispose()
    expect(channel.sent.filter(message => message.type === 'ended')).toHaveLength(1)
    expect(deck.listenerCount()).toBe(0)
    expect(channel.listenerCount()).toBe(0)
    expect(channel.close).toHaveBeenCalledOnce()
  })

  it('applies only newer state for the active Audience session and stops after ended', () => {
    const deck = new FakeDeck()
    const channel = new FakeChannel()
    const onEnded = vi.fn()
    const controller = new PresentationSessionController({
      mode: 'audience', deckId: 'demo', sessionId: 'session-1', deck, channel, onEnded,
    })

    controller.start()
    expect(channel.sent.map(message => message.type)).toEqual(['ready', 'request-state'])
    channel.receive(createPresentationMessage('state', 'session-1', { sequence: 2, revealState: { indexh: 2 } }))
    channel.receive(createPresentationMessage('state', 'session-1', { sequence: 1, revealState: { indexh: 1 } }))
    channel.receive(createPresentationMessage('state', 'other', { sequence: 3, revealState: { indexh: 3 } }))
    channel.receive(createPresentationMessage('ended', 'session-1', {}))
    channel.receive(createPresentationMessage('state', 'session-1', { sequence: 4, revealState: { indexh: 4 } }))

    expect(deck.applied).toEqual([{ indexh: 2 }])
    expect(onEnded).toHaveBeenCalledOnce()
  })

  it('lets Audience navigation control the shared session without echoing remote state', () => {
    const deck = new FakeDeck()
    const channel = new FakeChannel()
    const controller = new PresentationSessionController({
      mode: 'audience', deckId: 'demo', sessionId: 'session-1', deck, channel,
    })

    controller.start()
    channel.sent.length = 0
    deck.state = { indexh: 3 }
    deck.emit('slidechanged')
    expect(channel.sent).toEqual([
      createPresentationMessage('navigate', 'session-1', { revealState: { indexh: 3 } }),
    ])

    channel.sent.length = 0
    channel.receive(createPresentationMessage('state', 'session-1', { sequence: 2, revealState: { indexh: 4 } }))
    deck.emit('slidechanged')
    expect(channel.sent).toEqual([])
  })

  it('applies Audience navigation in Studio so it becomes canonical state', () => {
    const deck = new FakeDeck()
    const channel = new FakeChannel()
    const controller = new PresentationSessionController({
      mode: 'studio', deckId: 'demo', sessionId: 'session-1', deck, channel,
    })

    controller.start()
    controller.activate()
    channel.receive(createPresentationMessage('navigate', 'session-1', { revealState: { indexh: 5 } }))

    expect(deck.applied).toEqual([{ indexh: 5 }])
  })

  it('only announces readiness in Presenter receiver mode', () => {
    const deck = new FakeDeck()
    const channel = new FakeChannel()
    const controller = new PresentationSessionController({
      mode: 'receiver', deckId: 'demo', sessionId: 'session-1', deck, channel,
    })

    controller.start()
    expect(channel.sent).toEqual([createPresentationMessage('ready', 'session-1', { role: 'presenter' })])
    expect(deck.listenerCount()).toBe(0)
  })
})
