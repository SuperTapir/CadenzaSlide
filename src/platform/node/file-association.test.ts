import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { installMacFileAssociation } from './file-association'

describe('macOS .cadenza file association', () => {
  it('creates and registers a launcher app that opens the selected archive', () => {
    const appPath = join(mkdtempSync(join(tmpdir(), 'cadenza-association-')), 'CadenzaSlide.app')
    const registered: string[] = []
    const scripts: string[] = []
    const result = installMacFileAssociation({
      appPath,
      nodePath: "/Applications/Node's Runtime/bin/node",
      cliPath: '/opt/Cadenza Slide/cadenza.js',
      compile: (script, path) => {
        scripts.push(script)
        mkdirSync(join(path, 'Contents', 'MacOS'), { recursive: true })
        writeFileSync(join(path, 'Contents', 'MacOS', 'droplet'), 'fixture')
      },
      register: path => { registered.push(path) },
    })

    expect(result).toEqual({ appPath })
    expect(registered).toEqual([appPath])
    expect(readFileSync(join(appPath, 'Contents', 'Info.plist'), 'utf8')).toContain('com.supertapir.cadenza.deck')
    expect(scripts[0]).toContain('on open deckFiles')
    expect(scripts[0]).toContain('/Applications/Node')
    expect(scripts[0]).toContain("'/opt/Cadenza Slide/cadenza.js' open ")
    expect(scripts[0]).toContain('quoted form of deckPath')
  })

  it('does not pretend file association is available on other platforms', () => {
    expect(() => installMacFileAssociation({ platform: 'linux' })).toThrow(/macOS/i)
  })
})
