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

  it('does not turn a production workspace failure into the Demo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('workspace offline')))

    await expect(openBrowserDeck(new URL('http://local/?deck=missing'), false)).rejects.toThrow('workspace offline')
  })
})
