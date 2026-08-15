import { afterEach, describe, expect, it, vi } from 'vitest'
import { openBrowserDeck } from './open-browser-deck'

afterEach(() => vi.unstubAllGlobals())

describe('openBrowserDeck', () => {
  it('loads the bundled Demo only for an explicit source', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('workspace must not be read'))
    vi.stubGlobal('fetch', fetchMock)

    const repository = await openBrowserDeck(new URL('http://local/?view=audience&source=demo'), false)

    expect(repository.document.id).toBe('cadenza-demo')
    expect(repository.isConnected).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads the explicitly selected English bundled Demo independently of the interface language', async () => {
    const repository = await openBrowserDeck(new URL('http://local/?view=audience&source=demo&demo=en&lang=zh-CN'), false)

    expect(repository.document.id).toBe('cadenza-demo-en')
    expect(repository.document.slides.opening).toMatchObject({ label: 'Compose With Intent' })
  })

  it('loads the explicitly selected Chinese bundled Demo independently of the interface language', async () => {
    const repository = await openBrowserDeck(new URL('http://local/?view=audience&source=demo&demo=zh-CN&lang=en'), false)

    expect(repository.document.id).toBe('cadenza-demo')
  })

  it('does not turn a production workspace failure into the Demo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('workspace offline')))

    await expect(openBrowserDeck(new URL('http://local/?deck=missing'), false)).rejects.toThrow('workspace offline')
  })
})
