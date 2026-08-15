import { describe, expect, it } from 'vitest'
import { createPresentationMessage, isPresentationMessage, presentationChannelName } from './presentation-session'

describe('presentation session contract', () => {
  it('scopes channels by deck and unpredictable session id', () => {
    expect(presentationChannelName('demo', 'session-123')).toBe('cadenza:presentation:demo:session-123')
  })

  it.each(['ready', 'request-state', 'state', 'ended'] as const)('round-trips %s messages with session identity', (type) => {
    const message = createPresentationMessage(type, 'session-123', type === 'state' ? { sequence: 2, revealState: { indexh: 3, indexf: 1 } } : type === 'ready' ? { role: 'presenter' } : {})
    expect(isPresentationMessage(message, 'session-123')).toBe(true)
    expect(isPresentationMessage(message, 'old-session')).toBe(false)
  })

  it('rejects malformed state and unknown messages', () => {
    expect(isPresentationMessage({ type: 'state', sessionId: 's' }, 's')).toBe(false)
    expect(isPresentationMessage({ type: 'ready', sessionId: 's', role: 'editor' }, 's')).toBe(false)
    expect(isPresentationMessage({ type: 'wat', sessionId: 's' }, 's')).toBe(false)
  })
})
