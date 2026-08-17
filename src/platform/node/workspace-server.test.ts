import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorkspaceServer, isWorkspaceWatchPath, type RunningWorkspaceServer } from './workspace-server'
import { createDefaultDeckMaster } from '../../core/deck-master'

const servers: RunningWorkspaceServer[] = []
afterEach(async () => Promise.all(servers.splice(0).map(server => server.close())))

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'cadenza-server-'))
  mkdirSync(join(root, 'decks', 'demo'), { recursive: true })
  writeFileSync(join(root, 'cadenza.config.json'), JSON.stringify({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' }))
  writeFileSync(join(root, 'decks', 'demo', 'deck.cadenza.json'), JSON.stringify({
    version: 1, id: 'demo', title: 'Demo', status: 'complete', master: createDefaultDeckMaster(),
    slides: { only: { id: 'only', role: 'content', layout: 'blank', label: 'Only', ariaLabel: 'Only' } },
    outline: [{ kind: 'slide', slideId: 'only' }],
  }))
  mkdirSync(join(root, 'decks', 'demo', '.cadenza'))
  mkdirSync(join(root, 'decks', 'demo', 'assets'))
  writeFileSync(join(root, 'decks', 'demo', 'assets', 'pixel.png'), 'image')
  writeFileSync(join(root, 'decks', 'demo', '.cadenza', 'source-analysis.json'), JSON.stringify({
    version: 1, deckId: 'demo', theme: 'Demo', audience: 'Team', coreMessage: 'One point',
    durationMinutes: 10, targetSlideCount: 6, keyMaterials: [], conflicts: [], missing: [],
  }))
  return root
}

describe('workspace HTTP server', () => {
  it('serves config, deck list, deck content and catalog without escaping the workspace', async () => {
    const root = makeWorkspace()
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)

    expect(await (await fetch(`${server.origin}/api/config`)).json()).toMatchObject({ defaultDeck: 'demo' })
    expect(await (await fetch(`${server.origin}/api/decks`)).json()).toEqual([
      { id: 'demo', title: 'Demo', path: `${root}/decks/demo/deck.cadenza.json` },
    ])
    const deckResponse = await fetch(`${server.origin}/api/decks/demo`)
    expect(deckResponse.headers.get('etag')).toMatch(/^"[a-f0-9]{64}"$/)
    expect((await deckResponse.json()).id).toBe('demo')
    expect(await (await fetch(`${server.origin}/api/catalog`)).json()).toMatchObject({ layouts: expect.any(Array), typography: expect.any(Array) })
    expect((await fetch(`${server.origin}/api/decks/..%2F..%2Fsecret`)).status).toBe(400)
  })

  it('serves deck-local assets and blocks traversal and symlink escape', async () => {
    const root = makeWorkspace()
    const outside = join(root, 'secret.txt')
    writeFileSync(outside, 'secret')
    symlinkSync(outside, join(root, 'decks', 'demo', 'assets', 'escape.txt'))
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)

    expect(await (await fetch(`${server.origin}/api/decks/demo/assets/pixel.png`)).text()).toBe('image')
    expect((await fetch(`${server.origin}/api/decks/demo/assets/..%2F..%2F..%2Fsecret.txt`)).status).toBe(400)
    expect((await fetch(`${server.origin}/api/decks/demo/assets/escape.txt`)).status).toBe(403)
  })

  it('serves byte ranges for seekable deck-local media', async () => {
    const root = makeWorkspace()
    writeFileSync(join(root, 'decks', 'demo', 'assets', 'clip.mp4'), '0123456789')
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)

    const response = await fetch(`${server.origin}/api/decks/demo/assets/clip.mp4`, { headers: { range: 'bytes=2-5' } })

    expect(response.status).toBe(206)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(response.headers.get('content-length')).toBe('4')
    expect(await response.text()).toBe('2345')
  })

  it('rejects unsatisfiable deck-local media ranges', async () => {
    const root = makeWorkspace()
    writeFileSync(join(root, 'decks', 'demo', 'assets', 'clip.mp4'), '0123456789')
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)

    const response = await fetch(`${server.origin}/api/decks/demo/assets/clip.mp4`, { headers: { range: 'bytes=20-30' } })

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */10')
  })

  it('writes atomically with etag protection and rejects stale or invalid documents', async () => {
    const root = makeWorkspace()
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)
    const url = `${server.origin}/api/decks/demo`
    const initial = await fetch(url)
    const etag = initial.headers.get('etag') ?? ''
    const deck = await initial.json()
    deck.title = 'Updated'
    const updated = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': etag }, body: JSON.stringify(deck) })
    expect(updated.status).toBe(200)
    const stored = JSON.parse(readFileSync(join(root, 'decks', 'demo', 'deck.cadenza.json'), 'utf8'))
    expect(stored.title).toBe('Updated')
    expect(stored.master.layouts['title-only'].slots.title.tag).toBe('title')

    deck.title = 'Stale overwrite'
    expect((await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': etag }, body: JSON.stringify(deck) })).status).toBe(409)
    const invalid = { ...deck, currentSlide: 3 }
    const current = await fetch(url)
    expect((await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': current.headers.get('etag') ?? '' }, body: JSON.stringify(invalid) })).status).toBe(422)
    const unverifiable = structuredClone(deck)
    unverifiable.slides.only.objects = [{ kind: 'image', frame: { x: 0, y: 0, width: 20, height: 20 }, src: ' ', alt: 'invalid source' }]
    expect((await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': current.headers.get('etag') ?? '' }, body: JSON.stringify(unverifiable) })).status).toBe(422)
  })

  it('serves portable archives read-only', async () => {
    const root = makeWorkspace()
    const server = await createWorkspaceServer({ root, watch: false, readOnly: true }).listen()
    servers.push(server)
    const url = `${server.origin}/api/decks/demo`
    const initial = await fetch(url)
    const deck = await initial.json()
    deck.title = 'Must not persist'

    const response = await fetch(url, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.headers.get('etag') ?? '' }, body: JSON.stringify(deck),
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: { code: 'workspace.read-only' } })
    expect(JSON.parse(readFileSync(join(root, 'decks', 'demo', 'deck.cadenza.json'), 'utf8')).title).toBe('Demo')
  })

  it('keeps an in-memory startup snapshot for diff without creating revision files', async () => {
    const root = makeWorkspace()
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    servers.push(server)
    const url = `${server.origin}/api/decks/demo`
    const initial = await fetch(url)
    const deck = await initial.json()
    deck.slides.only.notes = 'New speaker note'
    const saved = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.headers.get('etag') ?? '' }, body: JSON.stringify(deck) })
    expect(saved.status).toBe(200)

    const diff = await (await fetch(`${server.origin}/api/decks/demo/diff`)).json()
    expect(diff).toEqual({ ok: true, deckId: 'demo', source: 'session', diff: { slides: { only: ['notes'] }, outlineChanged: false, masterChanged: false } })
    expect(existsSync(join(root, 'decks', 'demo', '.cadenza', 'revisions'))).toBe(false)
  })

  it('closes promptly while an event stream is still connected', async () => {
    const root = makeWorkspace()
    const server = await createWorkspaceServer({ root, watch: false }).listen()
    const events = await fetch(`${server.origin}/api/events`)

    expect(events.status).toBe(200)
    await expect(Promise.race([
      server.close().then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('timed-out'), 250)),
    ])).resolves.toBe('closed')
  })

})

describe('workspace watch path filter', () => {
  it.each([
    'decks/demo/deck.cadenza.json',
    'design-system/custom/layouts.json',
  ])('accepts %s', path => expect(isWorkspaceWatchPath(path)).toBe(true))

  it.each(['node_modules/a.js', 'dist/index.html', '.git/index'])('ignores %s', path => {
    expect(isWorkspaceWatchPath(path)).toBe(false)
  })

  it('closes an archive preview after its Studio event stream disconnects', async () => {
    const root = makeWorkspace()
    let closed = false
    const server = await createWorkspaceServer({ root, watch: false, closeWhenIdle: true, idleTimeoutMs: 10, onClose: () => { closed = true } }).listen()
    const events = await fetch(`${server.origin}/api/events`)
    expect(events.status).toBe(200)
    await events.body?.cancel()

    await expect(Promise.race([
      new Promise<boolean>(resolve => {
        const check = () => closed ? resolve(true) : setTimeout(check, 10)
        check()
      }),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 500)),
    ])).resolves.toBe(true)
  })
})
