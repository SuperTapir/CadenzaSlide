import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../../core/deck-master'
import { verifyWorkspaceDeck } from './workspace-verifier'

function deck(source: string) {
  return {
    version: 1, id: 'demo', title: 'Demo', status: 'complete', master: createDefaultDeckMaster(),
    slides: { only: { id: 'only', role: 'content', layout: 'photo', label: 'Only', ariaLabel: 'Only', image: { src: source, alt: 'Evidence' } } },
    outline: [{ kind: 'slide', slideId: 'only' }],
  }
}

describe('workspace deck media verification', () => {
  it('accepts existing deck-local media and rejects old, missing and escaping paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'cadenza-media-'))
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets', 'evidence.png'), 'image')
    expect(verifyWorkspaceDeck(deck('assets/evidence.png'), root).ok).toBe(true)
    expect(verifyWorkspaceDeck(deck('/decks/demo/evidence.png'), root).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'media.deck-local-path' })]))
    expect(verifyWorkspaceDeck(deck('assets/missing.png'), root).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'media.not-found' })]))
    expect(verifyWorkspaceDeck(deck('../secret.png'), root).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'media.deck-local-path' })]))
  })

  it('rejects symlinks that leave the deck assets directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'cadenza-media-'))
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'secret.png'), 'secret')
    symlinkSync(join(root, 'secret.png'), join(root, 'assets', 'escape.png'))
    expect(verifyWorkspaceDeck(deck('assets/escape.png'), root).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'media.path-escape' })]))
  })
})
