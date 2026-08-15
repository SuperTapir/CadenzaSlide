export const STUDIO_ZOOM_MIN = 25
export const STUDIO_ZOOM_MAX = 200
export const STUDIO_ZOOM_STEP = 10

export type StudioPanel = 'layout' | 'notes' | 'edits'
export type StudioRailMode = 'expanded' | 'collapsed' | 'overlay'

export type StudioWorkspaceState = {
  selectedSlideId: string
  railMode: StudioRailMode
  activePanel: StudioPanel | null
  drawerExtent: number
  zoomMode: 'fit' | 'manual'
  zoomPercent: number
  fullscreen: boolean
}

export type StudioWorkspaceAction =
  | { type: 'slide.select', slideId: string }
  | { type: 'rail.set', mode: StudioRailMode }
  | { type: 'panel.open', panel: StudioPanel }
  | { type: 'panel.close' }
  | { type: 'drawer.resize', extent: number }
  | { type: 'zoom.set', percent: number }
  | { type: 'zoom.fit' }
  | { type: 'fullscreen.set', value: boolean }

export function createStudioWorkspaceState(selectedSlideId: string): StudioWorkspaceState {
  return {
    selectedSlideId,
    railMode: 'expanded',
    activePanel: null,
    drawerExtent: 280,
    zoomMode: 'fit',
    zoomPercent: 100,
    fullscreen: false,
  }
}

export function reduceStudioWorkspace(state: StudioWorkspaceState, action: StudioWorkspaceAction): StudioWorkspaceState {
  switch (action.type) {
    case 'slide.select': return { ...state, selectedSlideId: action.slideId }
    case 'rail.set': return { ...state, railMode: action.mode }
    case 'panel.open': return { ...state, activePanel: action.panel }
    case 'panel.close': return { ...state, activePanel: null }
    case 'drawer.resize': return { ...state, drawerExtent: Math.max(180, Math.min(520, action.extent)) }
    case 'zoom.set': return { ...state, zoomMode: 'manual', zoomPercent: Math.max(STUDIO_ZOOM_MIN, Math.min(STUDIO_ZOOM_MAX, action.percent)) }
    case 'zoom.fit': return { ...state, zoomMode: 'fit', zoomPercent: 100 }
    case 'fullscreen.set': return { ...state, fullscreen: action.value }
  }
}
