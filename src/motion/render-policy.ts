import type { EnvironmentMode } from '../engine/environment-presets'

export function shouldRenderContinuously(state: {
  mode: EnvironmentMode
  playing: boolean
}) {
  return state.mode === 'loop' && state.playing
}
