import { describe, expect, it } from 'vitest'
import {
  environmentPresetIds,
  environmentModes,
  environmentPresets,
  isEnvironmentPresetId,
  isEnvironmentMode,
  loopPhase,
} from './environment-presets'

describe('environment preset library', () => {
  it('registers a unique, discoverable set of one-bit environments', () => {
    expect(environmentPresetIds).toEqual([
      'black',
      'white',
      'field',
      'grid',
      'beam',
      'contour',
      'void',
      'float',
      'halo',
      'raster',
      'aperture',
      'track',
      'shutter',
      'orbit',
      'steps',
      'fold',
      'portal',
      'ribbon',
      'strata',
      'target',
    ])
    expect(new Set(environmentPresetIds).size).toBe(environmentPresetIds.length)
    expect(Object.keys(environmentPresets)).toEqual(environmentPresetIds)
    expect(isEnvironmentPresetId('contour')).toBe(true)
    expect(isEnvironmentPresetId('reveal')).toBe(false)
  })

  it('uses visual-motif names instead of ambiguous content-type names', () => {
    expect(environmentPresets.halo).toMatchObject({ label: 'HALO', motif: 'focal-halo' })
    expect(environmentPresets.raster).toMatchObject({ label: 'RASTER', motif: 'raster-stage' })
    expect(isEnvironmentPresetId('image')).toBe(false)
    expect(isEnvironmentPresetId('media')).toBe(false)
  })

  it('offers static and subtle loop modes for every environment', () => {
    expect(environmentModes).toEqual(['static', 'loop'])
    for (const preset of Object.values(environmentPresets)) {
      expect(preset.modes).toEqual(environmentModes)
      expect(preset.defaultMode).toBe('static')
      expect(preset.motif.length).toBeGreaterThan(0)
      expect(preset.verb.length).toBeGreaterThan(0)
    }
    expect(new Set(Object.values(environmentPresets).map((preset) => preset.motif)).size).toBe(environmentPresetIds.length)
    expect(isEnvironmentMode('loop')).toBe(true)
    expect(isEnvironmentMode('ambient')).toBe(false)
  })

  it('uses a long, repeatable loop phase', () => {
    expect(loopPhase(0)).toBeCloseTo(0)
    expect(loopPhase(3000)).toBeCloseTo(1)
    expect(loopPhase(6000)).toBeCloseTo(0)
    expect(loopPhase(12_000)).toBeCloseTo(0)
  })
})
