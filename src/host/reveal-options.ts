export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export const revealHostOptions = {
  embedded: true,
  hash: true,
  controls: true,
  controlsTutorial: false,
  progress: true,
  center: false,
  width: SLIDE_WIDTH,
  height: SLIDE_HEIGHT,
  margin: 0,
  transition: 'none',
  backgroundTransition: 'none',
  viewDistance: 1,
  mobileViewDistance: 1,
  preloadIframes: false,
} as const
