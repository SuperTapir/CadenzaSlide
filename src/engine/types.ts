import { environmentPresets, type EnvironmentMode, type SceneId } from './environment-presets'

export type DitherScale = 3 | 5
export type { SceneId } from './environment-presets'
export type { EnvironmentMode } from './environment-presets'

export interface StageState {
  scene: SceneId
  environmentMode: EnvironmentMode
  ditherScale: DitherScale
  playing: boolean
}

export interface SceneCopy {
  label: string
  title: string
  description: string
}

export const sceneCopy: Record<SceneId, SceneCopy> = environmentPresets
