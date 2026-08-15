import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../core/deck-master'
import { renderDeckMaster } from './deck-master-gallery'

describe('Deck Master gallery', () => {
  it('renders English read-only guidance when requested', () => {
    const html = renderDeckMaster(createDefaultDeckMaster(), 'en')
    expect(html).toContain('DECK MASTER / READ ONLY')
    expect(html).toContain('Current deck master')
    expect(html).toContain('Ask the Agent to change the master')
    expect(html).not.toContain('当前演示文稿母版')
  })
})
