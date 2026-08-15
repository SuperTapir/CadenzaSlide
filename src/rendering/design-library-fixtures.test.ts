import { describe, expect, it } from 'vitest'
import { coreLayoutIds } from '../core/deck-master'
import { designLibraryFixtures, renderDesignLibraryFixture } from './design-library-fixtures'

describe('Design Library fixtures', () => {
  it('owns one fixture for every core layout', () => {
    expect(Object.keys(designLibraryFixtures)).toEqual(coreLayoutIds)
    for (const layout of coreLayoutIds) expect(designLibraryFixtures[layout].layout).toBe(layout)
  })
  it('shows both title and subtitle in every titled master preview', () => {
    for (const layout of ['title', 'title-photo', 'title-photo-alt', 'title-bullets', 'title-bullets-photo', 'section', 'title-only', 'agenda', 'statement'] as const) {
      expect(designLibraryFixtures[layout].title, layout).toBeTruthy()
      expect(designLibraryFixtures[layout].subtitle, layout).toBeTruthy()
    }
  })
  it('uses the real renderer and remains read-only', () => {
    const html = renderDesignLibraryFixture('gallery')
    expect(html).toContain('data-layout="gallery"')
    expect(html).not.toContain('data-apply')
  })
  it('provides composed examples with free page objects', () => {
    expect(designLibraryFixtures['title-bullets'].objects).toHaveLength(1)
    expect(designLibraryFixtures['title-only'].objects).toHaveLength(2)
  })
  it('demonstrates an independent caption for every Gallery and Photo image', () => {
    expect(designLibraryFixtures.gallery.images).toHaveLength(3)
    expect(designLibraryFixtures.gallery.images?.every(image => image.caption)).toBe(true)
    expect(designLibraryFixtures.photo.image?.caption).toBeTruthy()
  })
})
