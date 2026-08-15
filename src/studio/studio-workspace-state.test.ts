import { describe, expect, it } from 'vitest'
import { createStudioWorkspaceState, reduceStudioWorkspace } from './studio-workspace-state'

describe('Studio workspace state', () => {
  it('keeps chrome state independent from the deck document', () => {
    const initial = createStudioWorkspaceState('intro')
    const next = reduceStudioWorkspace(initial, { type: 'panel.open', panel: 'notes' })

    expect(next).toMatchObject({ selectedSlideId: 'intro', activePanel: 'notes', drawerExtent: 280 })
    expect(initial).toMatchObject({ activePanel: null, zoomMode: 'fit', zoomPercent: 100 })
  })

  it('clamps manual zoom and restores fit without changing selection', () => {
    const initial = createStudioWorkspaceState('slide-12')
    const zoomed = reduceStudioWorkspace(initial, { type: 'zoom.set', percent: 999 })
    const fitted = reduceStudioWorkspace(zoomed, { type: 'zoom.fit' })

    expect(zoomed).toMatchObject({ zoomMode: 'manual', zoomPercent: 200, selectedSlideId: 'slide-12' })
    expect(fitted).toMatchObject({ zoomMode: 'fit', zoomPercent: 100, selectedSlideId: 'slide-12' })
  })

  it('clamps the resizable drawer while preserving the current panel', () => {
    const initial = reduceStudioWorkspace(createStudioWorkspaceState('intro'), { type: 'panel.open', panel: 'notes' })

    expect(reduceStudioWorkspace(initial, { type: 'drawer.resize', extent: 999 })).toMatchObject({ activePanel: 'notes', drawerExtent: 520 })
    expect(reduceStudioWorkspace(initial, { type: 'drawer.resize', extent: 20 })).toMatchObject({ activePanel: 'notes', drawerExtent: 180 })
  })

  it('opens the inspect edit queue as a first-class drawer panel', () => {
    expect(reduceStudioWorkspace(createStudioWorkspaceState('intro'), { type: 'panel.open', panel: 'edits' })).toMatchObject({ activePanel: 'edits' })
  })
})
