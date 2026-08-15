import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const productionExtensions = new Set(['.ts', '.css'])

function productionFiles(directory = sourceRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return productionFiles(path)
    if (!productionExtensions.has(extname(path)) || path.endsWith('.test.ts')) return []
    return [path]
  })
}

function importsOf(path: string): string[] {
  const source = readFileSync(path, 'utf8')
  return [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1])
}

describe('product import boundaries', () => {
  it('uses explicit app and platform composition roots', () => {
    expect(existsSync(resolve(sourceRoot, 'apps/browser/main.ts'))).toBe(true)
    expect(existsSync(resolve(sourceRoot, 'apps/cli/cadenza.ts'))).toBe(true)
    expect(existsSync(resolve(sourceRoot, 'platform/browser/deck-document-store.ts'))).toBe(true)
    expect(existsSync(resolve(sourceRoot, 'platform/node/workspace-server.ts'))).toBe(true)

    for (const retiredRoot of ['app', 'cli', 'deck', 'server', 'workspace']) {
      expect(existsSync(resolve(sourceRoot, retiredRoot)), `${retiredRoot} must be retired`).toBe(false)
    }
  })

  it('keeps browser product code free of Node platform and test fixtures', () => {
    const violations = productionFiles().flatMap(path => importsOf(path).flatMap(specifier => {
      const owner = relative(sourceRoot, path)
      const isBrowserCode = !owner.startsWith('apps/cli/') && !owner.startsWith('platform/node/')
      if (specifier.includes('tests/fixtures')) return [`${owner} -> ${specifier}`]
      if (isBrowserCode && (specifier.startsWith('node:') || specifier.includes('/platform/node/'))) return [`${owner} -> ${specifier}`]
      return []
    }))
    expect(violations).toEqual([])
  })

  it('keeps feature modules independent from app composition roots', () => {
    const violations = productionFiles().flatMap(path => importsOf(path).flatMap(specifier => {
      const owner = relative(sourceRoot, path)
      if (owner.startsWith('apps/')) return []
      const resolvedImport = resolve(dirname(path), specifier)
      return resolvedImport.startsWith(resolve(sourceRoot, 'apps')) ? [`${owner} -> ${specifier}`] : []
    }))
    expect(violations).toEqual([])
  })

  it('keeps the bundled demo out of production entry modules', () => {
    for (const entry of ['presentation-entry.ts', 'overview-entry.ts']) {
      expect(importsOf(resolve(sourceRoot, 'apps/browser', entry))).not.toContain('../../examples/demo-deck')
    }
  })
})
