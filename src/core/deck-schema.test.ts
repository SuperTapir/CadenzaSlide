import { describe, expect, it } from 'vitest'
import schema from '../../cadenza.schema.json'
import { coreLayoutIds } from './deck-master'
import { DECK_DOCUMENT_VERSION } from './deck-document'

describe('cadenza.schema.json', () => {
  const root = schema as Record<string, any>
  it('publishes DeckDocument as the initial schema with a file-backed master', () => {
    expect(DECK_DOCUMENT_VERSION).toBe(1)
    expect(root.title).toBe('Cadenza DeckDocument')
    expect(root.$id).toBe('https://cadenza.local/schema/deck.json')
    expect(root.properties.version.const).toBe(DECK_DOCUMENT_VERSION)
    expect(root.required).toEqual(expect.arrayContaining(['version', 'id', 'title', 'master', 'slides', 'outline']))
  })
  it('requires exactly the fourteen registered master layouts', () => {
    expect(root.$defs.master.properties.layouts.required).toEqual(coreLayoutIds)
    expect(root.$defs.slide.properties.layout.enum).toEqual(coreLayoutIds)
  })
  it('publishes tagged placeholders, fixed objects and page visibility state', () => {
    expect(root.$defs.layoutMaster.required).toEqual(expect.arrayContaining(['slots', 'backgroundObjects']))
    expect(root.$defs.slot.required).toEqual(expect.arrayContaining(['tag', 'frame']))
    expect(root.$defs.slide.properties.hiddenPlaceholders).toMatchObject({ type: 'array', uniqueItems: true })
    expect(root.$defs).not.toHaveProperty('masterAuthoring')
  })
  it('limits titles and gallery image counts in schema', () => {
    expect(root.$defs.slide.properties.title.maxItems).toBe(3)
    expect(root.$defs.slide.properties.images).toMatchObject({ minItems: 0, maxItems: 4 })
  })
  it('publishes cover author and date fields', () => {
    expect(root.$defs.slide.properties.author).toMatchObject({ type: 'string' })
    expect(root.$defs.slide.properties.date).toMatchObject({ type: 'string' })
    expect(root.$defs.slide.allOf ?? []).toHaveLength(0)
  })
  it('publishes the sourced Quote contract', () => {
    expect(root.$defs.slide.properties.quote).toMatchObject({ type: 'string', minLength: 1 })
    expect(root.$defs.slide.properties.attribution).toMatchObject({ type: 'string', minLength: 1 })
    expect(root.$defs.slide.properties.source).toMatchObject({ type: 'string', minLength: 1 })
    expect(root.$defs.slide.required).not.toContain('quote')
  })
  it('publishes atomic composition references and removes retired semantic kinds', () => {
    expect(root.$defs.object.properties.kind.enum).toContain('composition')
    expect(root.$defs.object.properties.kind.enum).not.toEqual(expect.arrayContaining(['metric', 'collection', 'process', 'timeline']))
    expect(root.$defs.object.properties.compositionId).toMatchObject({ $ref: '#/$defs/id' })
    expect(root.$defs.object.properties.tree).toMatchObject({ $ref: '#/$defs/compositionNode' })
  })
})
