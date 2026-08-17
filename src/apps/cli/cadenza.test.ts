import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { runCli, type CliEnvironment } from './cadenza'
import type { WorkspaceReader } from '../../platform/node/workspace-repository'
import { createDefaultDeckMaster } from '../../core/deck-master'
import { defaultRuntimeRoot } from './runtime-context'

const slide = (id: string, notes = '') => ({
  id, role: 'content', layout: 'blank', label: id.toUpperCase(),
  ariaLabel: id, notes,
})

function fixture(status: 'complete' | 'outline' = 'complete') {
  const files = new Map<string, string>([
    ['/work/cadenza.config.json', JSON.stringify({ version: 1, decksDirectory: 'decks' })],
    ['/work/decks/demo/deck.cadenza.json', JSON.stringify({
      version: 1, id: 'demo', title: 'Demo deck', status, master: { ...createDefaultDeckMaster(), typography: 'editorial' },
      slides: { intro: slide('intro'), detail: slide('detail', 'Explain **why**.') },
      outline: [
        { kind: 'slide', slideId: 'intro' },
        { kind: 'group', id: 'body', title: 'Body', slideIds: ['detail'] },
      ],
    })],
  ])
  const reader: WorkspaceReader = {
    exists: path => files.has(path),
    readText: path => files.get(path) ?? (() => { throw new Error(`ENOENT ${path}`) })(),
    listDirectories: path => [...new Set([...files.keys()]
      .filter(file => file.startsWith(`${path}/`))
      .map(file => file.slice(path.length + 1).split('/')[0]))],
  }
  const stdout: string[] = []
  const stderr: string[] = []
  const env: CliEnvironment = { cwd: '/work/decks/demo', reader, stdout: value => stdout.push(value), stderr: value => stderr.push(value) }
  return { env, stdout, stderr, files }
}

describe('cadenza CLI', () => {
  it('resolves the installed runtime root after the CLI entry moved under apps', () => {
    expect(existsSync(join(defaultRuntimeRoot, 'package.json'))).toBe(true)
  })

  it('prints concise help with deterministic commands', async () => {
    const { env, stdout } = fixture()
    expect(await runCli([], env)).toBe(0)
    const help = stdout.join('')
    for (const command of ['init', 'new', 'list', 'inspect', 'visuals', 'verify', 'diff', 'pack', 'unpack', 'open', 'associate', 'overview', 'present']) {
      expect(help).toContain(command)
    }
    expect(help).not.toContain('verify-run')
  })

  it('lists workspace decks as structured JSON', async () => {
    const { env, stdout, stderr } = fixture()
    expect(await runCli(['list'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toEqual({
      ok: true,
      workspace: '/work',
      decks: [{ id: 'demo', title: 'Demo deck', path: '/work/decks/demo/deck.cadenza.json' }],
    })
    expect(stderr).toEqual([])
  })

  it('selects an explicit external workspace independently of the runtime root', async () => {
    const { env, stdout } = fixture()
    env.cwd = '/outside'
    env.runtimeRoot = '/installed/cadenza'
    expect(await runCli(['--workspace', '/work', 'list'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({ ok: true, workspace: '/work', decks: [{ id: 'demo' }] })
  })

  it('initializes a minimal external workspace without copying the renderer', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cadenza-cli-'))
    const workspace = join(parent, 'talks')
    const output = execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'init', workspace], { cwd: process.cwd(), encoding: 'utf8' })
    expect(JSON.parse(output)).toMatchObject({ ok: true, command: 'init', workspace })
    expect(JSON.parse(readFileSync(join(workspace, 'cadenza.config.json'), 'utf8'))).toEqual({ version: 1, decksDirectory: 'decks' })
    expect(existsSync(join(workspace, 'decks'))).toBe(true)
    expect(existsSync(join(workspace, 'package.json'))).toBe(false)
    writeFileSync(join(workspace, 'notes.txt'), 'keep')
    expect(() => execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'init', workspace], { cwd: process.cwd(), stdio: 'pipe' })).toThrow()
    expect(readFileSync(join(workspace, 'notes.txt'), 'utf8')).toBe('keep')
  })

  it('creates a valid outline deck without requiring renderer source files', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cadenza-cli-'))
    const workspace = join(parent, 'talks')
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'init', workspace], { cwd: process.cwd() })

    const output = execFileSync(process.execPath, [
      '--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace,
      'new', 'product-story', '--title=Product Story',
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result).toMatchObject({ ok: true, command: 'new', workspace, deckId: 'product-story' })
    expect(existsSync(join(workspace, 'decks/product-story/assets'))).toBe(true)
    const deck = JSON.parse(readFileSync(join(workspace, 'decks/product-story/deck.cadenza.json'), 'utf8'))
    expect(deck).toMatchObject({
      version: 1,
      id: 'product-story',
      title: 'Product Story',
      status: 'outline',
      slides: { intro: { id: 'intro', role: 'intro', layout: 'title', title: ['Product Story'] } },
      outline: [{ kind: 'slide', slideId: 'intro' }],
    })
    expect(() => execFileSync(process.execPath, [
      '--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace,
      'new', 'product-story',
    ], { cwd: process.cwd(), stdio: 'pipe' })).toThrow()
  })

  it('packs and unpacks a deck through the real CLI entrypoint', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cadenza-portable-cli-'))
    const workspace = join(parent, 'talks')
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'init', workspace], { cwd: process.cwd() })
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace, 'new', 'portable'], { cwd: process.cwd() })
    const archive = join(parent, 'portable.cadenza')

    const packed = JSON.parse(execFileSync(process.execPath, [
      '--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace,
      'pack', 'portable', `--output=${archive}`,
    ], { cwd: process.cwd(), encoding: 'utf8' }))
    expect(packed).toMatchObject({ ok: true, command: 'pack', deckId: 'portable', output: archive })

    const restored = join(parent, 'restored')
    const unpacked = JSON.parse(execFileSync(process.execPath, [
      '--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'unpack', archive, restored,
    ], { cwd: process.cwd(), encoding: 'utf8' }))
    expect(unpacked).toMatchObject({ ok: true, command: 'unpack', deckId: 'portable', workspace: restored })
    expect(JSON.parse(readFileSync(join(restored, 'cadenza.config.json'), 'utf8'))).toMatchObject({ defaultDeck: 'portable' })
  })

  it('installs the native file association without requiring a workspace', async () => {
    const { env, stdout } = fixture()
    env.cwd = '/outside'
    env.installFileAssociation = () => ({ appPath: '/Users/example/Applications/CadenzaSlide.app' })
    expect(await runCli(['associate'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toEqual({ ok: true, command: 'associate', appPath: '/Users/example/Applications/CadenzaSlide.app' })
  })

  it('queries production visual assets with semantic evidence for Agent authoring', async () => {
    const { env, stdout } = fixture()
    expect(await runCli(['visuals', '增长趋势', '--motion=none', '--limit=3'], env)).toBe(0)
    const output = JSON.parse(stdout[0])
    expect(output).toMatchObject({ ok: true, command: 'visuals', intent: '增长趋势' })
    expect(output.matches[0]).toMatchObject({ assetId: 'icon:lucide-trending-up', family: 'lucide:data', behavior: 'none', matchedTerms: expect.arrayContaining(['增长', 'trending', 'up']) })
  })

  it('loads the visual query through the real Node strip-types entrypoint', () => {
    const output = execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'visuals', '增长趋势', '--motion=none', '--limit=1'], { cwd: process.cwd(), encoding: 'utf8' })
    expect(JSON.parse(output)).toMatchObject({ ok: true, matches: [{ assetId: 'icon:lucide-trending-up' }] })
  })

  it('inspects a slide by stable id with group, notes and applied master', async () => {
    const { env, stdout } = fixture()
    expect(await runCli(['inspect', 'demo/slide:detail'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({
      ok: true,
      deck: { id: 'demo', title: 'Demo deck' },
      slide: { id: 'detail', notes: 'Explain **why**.' },
      location: { group: { id: 'body', title: 'Body' }, playbackIndex: 1 },
      appliedMaster: { typography: 'editorial', transition: 'dissolve' },
    })
  })

  it.each([
    { args: ['wat'], code: 'cli.command' },
    { args: ['inspect', 'demo/slide:missing'], code: 'cli.slide-not-found' },
    { args: ['inspect', 'wrong-shape'], code: 'cli.inspect-target' },
  ])('returns non-zero structured errors for $code', async ({ args, code }) => {
    const { env, stdout, stderr } = fixture()
    expect(await runCli(args, env)).toBe(1)
    expect(stdout).toEqual([])
    expect(JSON.parse(stderr[0])).toMatchObject({ ok: false, error: { code } })
  })

  it.each([
    { command: 'overview', target: 'demo', expected: '/?view=overview&deck=demo' },
    { command: 'present', target: 'demo', expected: '/?view=present&deck=demo' },
  ])('starts $command and prints its deterministic view URL', async ({ command, target, expected }) => {
    const { env, stdout } = fixture()
    env.startView = async (_root, view, deckId) => ({
      origin: 'http://127.0.0.1:4312',
      url: `http://127.0.0.1:4312/?view=${view}&deck=${deckId}`,
      close: async () => {},
    })
    expect(await runCli([command, ...(target ? [target] : [])], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({ ok: true, command, url: `http://127.0.0.1:4312${expected}` })
  })

  it('opens the workspace Deck Library without requiring a deck id', async () => {
    const { env, stdout } = fixture()
    const opened: string[] = []
    env.openExternal = async url => { opened.push(url) }
    env.startView = async (_root, view) => ({
      origin: 'http://127.0.0.1:4312',
      url: `http://127.0.0.1:4312/?view=${view}`,
      close: async () => {},
    })

    expect(await runCli(['open'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({
      ok: true,
      workspace: '/work',
      command: 'open',
      url: 'http://127.0.0.1:4312/?view=decks',
    })
    expect(opened).toEqual(['http://127.0.0.1:4312/?view=decks'])
  })

  it('opens a positional workspace and lets automation suppress the browser', async () => {
    const { env, stdout } = fixture()
    env.cwd = '/outside'
    const opened: string[] = []
    env.openExternal = async url => { opened.push(url) }
    env.startView = async (_root, view) => ({
      origin: 'http://127.0.0.1:4312',
      url: `http://127.0.0.1:4312/?view=${view}`,
      close: async () => {},
    })

    expect(await runCli(['open', '/work', '--no-browser'], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({ workspace: '/work', command: 'open' })
    expect(opened).toEqual([])
  })

  it('opens a portable deck directly in a temporary read-only Studio', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'cadenza-portable-open-'))
    const workspace = join(parent, 'talks')
    const archive = join(parent, 'portable.cadenza')
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', 'init', workspace], { cwd: process.cwd() })
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace, 'new', 'portable'], { cwd: process.cwd() })
    execFileSync(process.execPath, ['--experimental-strip-types', 'src/apps/cli/cadenza-bin.ts', '--workspace', workspace, 'pack', 'portable', `--output=${archive}`], { cwd: process.cwd() })
    const { env, stdout } = fixture()
    env.cwd = parent
    let temporaryRoot = ''
    env.startView = async (root, view, deckId, options) => {
      temporaryRoot = root
      expect({ view, deckId, options }).toEqual({ view: 'studio', deckId: 'portable', options: { readOnly: true } })
      return { origin: 'http://127.0.0.1:4312', url: 'http://127.0.0.1:4312/?view=studio&deck=portable', close: async () => {} }
    }
    env.openExternal = async () => {}

    expect(await runCli(['open', archive], env)).toBe(0)
    expect(JSON.parse(stdout[0])).toMatchObject({ command: 'open', source: 'archive', deckId: 'portable', readOnly: true })
    expect(existsSync(join(temporaryRoot, 'decks', 'portable', 'deck.cadenza.json'))).toBe(true)
    rmSync(dirname(temporaryRoot), { recursive: true, force: true })
  })

  it('closes the workspace server when opening the system browser fails', async () => {
    const { env, stdout, stderr } = fixture()
    let closed = false
    env.openExternal = async () => { throw new Error('browser unavailable') }
    env.startView = async (_root, view) => ({
      origin: 'http://127.0.0.1:4312',
      url: `http://127.0.0.1:4312/?view=${view}`,
      close: async () => { closed = true },
    })

    expect(await runCli(['open'], env)).toBe(1)
    expect(closed).toBe(true)
    expect(stdout).toEqual([])
    expect(JSON.parse(stderr[0])).toMatchObject({ ok: false, error: { message: 'browser unavailable' } })
  })

  it('refuses to present an outline draft before content generation', async () => {
    const { env, stdout, stderr } = fixture('outline')
    let started = false
    env.startView = async () => { started = true; throw new Error('must not start') }
    expect(await runCli(['present', 'demo'], env)).toBe(1)
    expect(started).toBe(false)
    expect(stdout).toEqual([])
    expect(JSON.parse(stderr[0])).toMatchObject({ ok: false, error: { code: 'present.outline' } })
  })

  it('reports a deterministic incremental verify scope and rejects unknown slide ids', async () => {
    const first = fixture()
    expect(await runCli(['verify', 'demo', '--slides=detail'], first.env)).toBe(0)
    expect(JSON.parse(first.stdout[0])).toMatchObject({ ok: true, deckId: 'demo', scope: 'incremental', checkedSlides: 1 })
    const second = fixture()
    expect(await runCli(['verify', 'demo', '--slides=missing'], second.env)).toBe(1)
    expect(JSON.parse(second.stderr[0])).toMatchObject({ error: { code: 'verify.slide-not-found' } })
  })

  it('rejects the removed verification orchestration surface', async () => {
    const { env, stderr } = fixture()
    expect(await runCli(['verify-run', 'start', 'demo'], env)).toBe(1)
    expect(JSON.parse(stderr[0])).toMatchObject({ ok: false, error: { code: 'cli.command' } })
  })

})
