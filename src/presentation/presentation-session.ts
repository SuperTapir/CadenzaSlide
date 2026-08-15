export type PresentationMessageType = 'ready' | 'request-state' | 'navigate' | 'state' | 'ended'

export type PresentationMessage =
  | { type: 'ready', sessionId: string, role: 'audience' | 'presenter' }
  | { type: 'request-state', sessionId: string }
  | { type: 'navigate', sessionId: string, revealState: Record<string, unknown> }
  | { type: 'state', sessionId: string, sequence: number, revealState: Record<string, unknown> }
  | { type: 'ended', sessionId: string }

export function presentationChannelName(deckId: string, sessionId: string) {
  return `cadenza:presentation:${deckId}:${sessionId}`
}

export function createPresentationMessage(type: PresentationMessageType, sessionId: string, value: { sequence?: number, revealState?: Record<string, unknown>, role?: 'audience' | 'presenter' }): PresentationMessage {
  if (type === 'state') return { type, sessionId, sequence: value.sequence ?? 0, revealState: value.revealState ?? {} }
  if (type === 'navigate') return { type, sessionId, revealState: value.revealState ?? {} }
  if (type === 'ready') return { type, sessionId, role: value.role ?? 'audience' }
  return { type, sessionId }
}

export function isPresentationMessage(value: unknown, sessionId: string): value is PresentationMessage {
  if (!isRecord(value) || value.sessionId !== sessionId) return false
  if (value.type === 'ready') return value.role === 'audience' || value.role === 'presenter'
  if (value.type === 'request-state' || value.type === 'ended') return true
  if (value.type === 'navigate') return isRecord(value.revealState)
  return value.type === 'state' && Number.isInteger(value.sequence) && isRecord(value.revealState)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
