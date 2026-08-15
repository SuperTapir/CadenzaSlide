import { describe, expect, it } from 'vitest'
import { audienceUrl, designLibraryUrl, resolveAppMode, studioUrl } from './app-mode'

describe('resolveAppMode', () => {
  it('opens Deck Library from the service root or its explicit URL', () => {
    expect(resolveAppMode(new URL('https://example.com/'))).toBe('decks')
    expect(resolveAppMode(new URL('https://example.com/?view=decks'))).toBe('decks')
  })

  it('keeps selected and explicit studio URLs in Studio', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?deck=demo'))).toBe('studio')
    expect(resolveAppMode(new URL('https://example.com/deck?view=studio'))).toBe('studio')
  })

  it('resolves the stable public Audience URL', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?view=audience'))).toBe('audience')
  })

  it('resolves the dedicated creation assistant view', () => {
  })

  it('resolves the dedicated high-density Overview', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?view=overview'))).toBe('overview')
  })

  it('resolves the dedicated read-only Design Library', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?view=library'))).toBe('library')
  })

  it('gives Reveal receiver URLs precedence as an internal Audience projection', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?receiver'))).toBe('receiver')
    expect(resolveAppMode(new URL('https://example.com/deck?view=studio&receiver&progress=false'))).toBe('receiver')
  })

  it('falls back safely to Studio for unsupported public views', () => {
    expect(resolveAppMode(new URL('https://example.com/deck?view=speaker'))).toBe('studio')
    expect(resolveAppMode(new URL('https://example.com/deck?view=unknown'))).toBe('studio')
  })
})

describe('audienceUrl', () => {
  it('preserves unrelated query parameters and the hash while selecting Audience', () => {
    expect(audienceUrl('https://example.com/deck?renderer=canvas2d&view=studio#/4/2')).toBe(
      'https://example.com/deck?renderer=canvas2d&view=audience#/4/2',
    )
  })

  it('removes Reveal receiver state from the shareable URL', () => {
    expect(audienceUrl(new URL('https://example.com/deck?receiver&progress=false#/3'))).toBe(
      'https://example.com/deck?progress=false&view=audience#/3',
    )
  })
})

describe('studioUrl', () => {
  it('preserves the deck, locale, source, and current slide while returning to Studio', () => {
    expect(studioUrl('https://example.com/deck?view=audience&source=demo&demo=en&lang=en#/10')).toBe(
      'https://example.com/deck?view=studio&source=demo&demo=en&lang=en#/10',
    )
  })

  it('removes internal receiver state', () => {
    expect(studioUrl('https://example.com/deck?receiver&deck=demo#/3')).toBe(
      'https://example.com/deck?deck=demo&view=studio#/3',
    )
  })
})

describe('designLibraryUrl', () => {
  it('preserves the deck query while opening the library at the top', () => {
    expect(designLibraryUrl('https://example.com/deck?deck=demo&view=studio#/4')).toBe(
      'https://example.com/deck?deck=demo&view=library',
    )
  })
})
