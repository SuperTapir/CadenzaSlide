import { describe, expect, it, vi } from 'vitest'
import { demoDeckDocument } from '../../examples/demo-deck'
import { BrowserDeckRepository } from './browser-deck-repository'

describe('BrowserDeckRepository', () => {
  it('distinguishes its own persisted ETag from an external file update', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(demoDeckDocument), { status: 200, headers: { 'content-type': 'application/json', etag: '"v1"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(demoDeckDocument), { status: 200, headers: { 'content-type': 'application/json', etag: '"v1"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(demoDeckDocument), { status: 200, headers: { 'content-type': 'application/json', etag: '"v2"' } }))

    const repository = await BrowserDeckRepository.open(new URL('http://local/?deck=cadenza-demo'))
    await expect(repository.hasExternalChange()).resolves.toBe(false)
    await expect(repository.hasExternalChange()).resolves.toBe(true)
    fetchMock.mockRestore()
  })
  it('fails explicitly when the workspace API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(BrowserDeckRepository.open(new URL('http://local/'))).rejects.toThrow('offline')
    vi.unstubAllGlobals()
  })

  it('supports an explicit development-only memory repository', async () => {
    const repository = BrowserDeckRepository.memory(demoDeckDocument)
    expect(repository.document.id).toBe('cadenza-demo')
    expect(await repository.save(repository.document)).toEqual({ persisted: false })
  })

  it('uses etag for file writes and exposes concurrent Agent conflicts', async () => {
    const responses = [
      new Response(JSON.stringify({ defaultDeck: 'cadenza-demo' }), { headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify(demoDeckDocument), { headers: { 'content-type': 'application/json', etag: '"one"' } }),
      new Response(JSON.stringify({ ok: false }), { status: 409, headers: { 'content-type': 'application/json' } }),
    ]
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()))
    vi.stubGlobal('fetch', fetchMock)
    const repository = await BrowserDeckRepository.open(new URL('http://local/'))
    await expect(repository.save(repository.document)).rejects.toThrow(/deck\.conflict/)
    expect(fetchMock.mock.calls[2][1].headers['if-match']).toBe('"one"')
    vi.unstubAllGlobals()
  })

  it('maps connected deck-local assets to the workspace API and restores paths on save', async () => {
    const source = structuredClone(demoDeckDocument)
    ;(source.slides['title-photo'] as { image: { src: string } }).image.src = 'assets/local.png'
    const responses = [
      new Response(JSON.stringify({ defaultDeck: 'cadenza-demo' }), { headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify(source), { headers: { 'content-type': 'application/json', etag: '"one"' } }),
      new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', etag: '"two"' } }),
    ]
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()))
    vi.stubGlobal('fetch', fetchMock)
    const repository = await BrowserDeckRepository.open(new URL('http://local/'))
    expect((repository.document.slides['title-photo'] as { image: { src: string } }).image.src).toBe('/api/decks/cadenza-demo/assets/local.png')
    await repository.save(repository.document)
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).slides['title-photo'].image.src).toBe('assets/local.png')
    vi.unstubAllGlobals()
  })

  it('rejects a parser-valid document when verification finds a blocking error', async () => {
    const repository = BrowserDeckRepository.memory(demoDeckDocument)
    const invalid = structuredClone(repository.document)
    const imageSlide = invalid.slides['title-photo'] as { image?: { src: string } }
    imageSlide.image!.src = ' '
    await expect(repository.save(invalid)).rejects.toThrow(/media\.reference/)
  })
})
