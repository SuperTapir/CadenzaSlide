#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { execFile, execFileSync } from 'node:child_process'
import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { flattenOutline } from '../../core/deck-outline.ts'
import { createWorkspaceServer } from '../../platform/node/workspace-server.ts'
import { verifyDeckValue } from '../../verification/deck-verifier.ts'
import { verifyWorkspaceDeck } from '../../platform/node/workspace-verifier.ts'
import { summarizeDeckDiff } from '../../diff/deck-diff.ts'
import { parseDeckDocument } from '../../core/deck-document.ts'
import { runBrowserSmoke } from '../../platform/node/browser-smoke.ts'
import { productionVisualAssets, rankVisualAssets, type VisualBehavior } from '../../visual-assets/catalog.ts'
import { relative } from 'node:path'
import {
  WorkspaceRepository,
  type WorkspaceReader,
} from '../../platform/node/workspace-repository.ts'
import { defaultRuntimeRoot, initializeDeck, initializeWorkspace, resolveRuntimeContext } from './runtime-context.ts'

export interface CliEnvironment {
  cwd: string
  runtimeRoot?: string
  reader: WorkspaceReader
  stdout(value: string): void
  stderr(value: string): void
  startView?(root: string, view: WorkspaceView, deckId?: string): Promise<StartedWorkspaceView>
  openExternal?(url: string): Promise<void>
}

export type WorkspaceView = 'decks' | 'overview' | 'present'
export interface StartedWorkspaceView {
  origin: string
  url: string
  close(): Promise<void>
}

const help = `Cadenza workspace CLI (no AI calls)\n\nUsage:\n  cadenza init [path]\n  cadenza [--workspace <path>] new <deck-id> [--title=<title>]\n  cadenza [--workspace <path>] list\n  cadenza inspect <deck-id>/slide:<slide-id>\n  cadenza visuals <intent> [--motion=none|enter|loop|emphasis] [--limit=5] [--avoid=asset-id,...]\n  cadenza verify [deck-id] [--slides=id-a,id-b] [--browser]\n  cadenza diff <deck-id>\n  cadenza open [path] [--no-browser]\n  cadenza overview <deck-id>\n  cadenza present <deck-id>\n`

export async function runCli(args: readonly string[], environment: CliEnvironment) {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    environment.stdout(help)
    return 0
  }

  try {
    const parsed = parseGlobalArgs(args)
    args = parsed.args
    if (args[0] === 'init') {
      const workspace = initializeWorkspace(resolve(environment.cwd, args[1] ?? '.'))
      writeJson(environment.stdout, { ok: true, command: 'init', workspace })
      return 0
    }
    const openWorkspace = args[0] === 'open' && args[1] && !args[1].startsWith('--') ? args[1] : undefined
    const selectedWorkspace = parsed.workspace ?? openWorkspace
    const context = resolveRuntimeContext({ cwd: environment.cwd, runtimeRoot: environment.runtimeRoot, workspace: selectedWorkspace, reader: environment.reader })
    if (!context) throw cliError('cli.workspace-not-found', `No cadenza.config.json found from ${selectedWorkspace ?? environment.cwd}`)
    const root = context.workspaceRoot
    const repository = new WorkspaceRepository(root, environment.reader)
    if (args[0] === 'new') {
      const deckId = args[1]
      if (!deckId) throw cliError('cli.deck-required', 'new requires a deck id')
      const title = args.find(value => value.startsWith('--title='))?.slice('--title='.length)
      const created = initializeDeck(root, repository.config.decksDirectory, deckId, title)
      writeJson(environment.stdout, { ok: true, command: 'new', workspace: root, ...created })
      return 0
    }
    if (args[0] === 'list') {
      writeJson(environment.stdout, { ok: true, workspace: root, decks: repository.list() })
      return 0
    }
    if (args[0] === 'visuals') {
      const intent = args.slice(1).filter(value => !value.startsWith('--')).join(' ').trim()
      if (!intent) throw cliError('visuals.intent-required', 'visuals requires a semantic intent')
      const motion = args.find(value => value.startsWith('--motion='))?.slice('--motion='.length) ?? 'none'
      if (!['none', 'enter', 'loop', 'emphasis'].includes(motion)) throw cliError('visuals.motion', `Unsupported visual motion “${motion}”`)
      const requestedLimit = Number(args.find(value => value.startsWith('--limit='))?.slice('--limit='.length) ?? 5)
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 20) throw cliError('visuals.limit', 'visuals limit must be an integer from 1 to 20')
      const avoidIds = args.find(value => value.startsWith('--avoid='))?.slice('--avoid='.length).split(',').filter(Boolean) ?? []
      const assets = motion === 'none'
        ? productionVisualAssets.filter(asset => asset.kind === 'icon' && asset.family?.startsWith('lucide:'))
        : productionVisualAssets.filter(asset => asset.kind === 'icon' && asset.family === 'line-md:animated')
      const matches = rankVisualAssets(assets, { intent, kind: 'icon', behavior: motion as VisualBehavior, avoidIds }).slice(0, requestedLimit)
      writeJson(environment.stdout, {
        ok: true, command: 'visuals', workspace: root, intent, motion,
        matches: matches.map(match => ({
          assetId: match.asset.id, label: match.asset.label, family: match.asset.family,
          behavior: motion, treatments: match.asset.treatments, score: match.score, matchedTerms: match.matchedTerms,
          provenance: match.asset.provenance,
        })),
      })
      return 0
    }
    if (args[0] === 'inspect') {
      const target = parseInspectTarget(args[1])
      const deck = repository.load(target.deckId)
      const file = repository.list().find(candidate => candidate.id === target.deckId)?.path
      const slide = deck.slides[target.slideId]
      if (!slide) throw cliError('cli.slide-not-found', `Slide “${target.slideId}” not found in deck “${target.deckId}”`)
      const group = deck.outline.find(item => item.kind === 'group' && item.slideIds.includes(target.slideId))
      writeJson(environment.stdout, {
        ok: true,
        workspace: root,
        file,
        deck: { id: deck.id, title: deck.title, status: deck.status },
        slide,
        contentSummary: summarizeSlide(slide),
        notes: { present: Boolean(slide.notes?.trim()), characters: slide.notes?.trim().length ?? 0 },
        location: {
          playbackIndex: flattenOutline(deck.outline).indexOf(target.slideId),
          group: group?.kind === 'group' ? { id: group.id, title: group.title } : null,
        },
        appliedMaster: { typography: deck.master.typography, transition: deck.master.slideTransition, layout: deck.master.layouts[slide.layout in deck.master.layouts ? slide.layout as keyof typeof deck.master.layouts : 'blank'] },
      })
      return 0
    }
    if (args[0] === 'verify') {
      const requestedDeckId = args.slice(1).find(value => !value.startsWith('--'))
      const selected = requestedDeckId ? repository.load(requestedDeckId) : repository.loadDefault()
      const deckDir = dirname(repository.list().find(deck => deck.id === selected.id)!.path)
      const report = verifyWorkspaceDeck(selected, deckDir)
      if (!report.ok) { writeJson(environment.stderr, { workspace: root, deckId: selected.id, ...report }); return 1 }
      const requestedSlides = args.find(value => value.startsWith('--slides='))?.slice('--slides='.length).split(',').filter(Boolean)
      const slideIds = requestedSlides ?? flattenOutline(selected.outline)
      const missing = slideIds.filter(id => !(id in selected.slides))
      if (missing.length) throw cliError('verify.slide-not-found', `Unknown slide id(s): ${missing.join(', ')}`)
      if (args.includes('--browser')) {
        assertRuntimeBuilt(context.runtimeRoot)
        const running = await createWorkspaceServer({ root, publicRoot: resolve(context.runtimeRoot, 'dist'), watch: false }).listen()
        try {
          const browser = await runBrowserSmoke(running.origin, selected.id, slideIds)
          writeJson(browser.ok ? environment.stdout : environment.stderr, { workspace: root, deckId: selected.id, scope: requestedSlides ? 'incremental' : 'full', file: { ...report, checkedSlides: slideIds.length }, browser })
          return browser.ok ? 0 : 1
        } finally { await running.close() }
      }
      writeJson(environment.stdout, { workspace: root, deckId: selected.id, scope: requestedSlides ? 'incremental' : 'full', ...report, checkedSlides: slideIds.length })
      return 0
    }
    if (args[0] === 'diff') {
      const deckId = args[1]
      if (!deckId) throw cliError('cli.deck-required', 'diff requires a deck id')
      const current = repository.load(deckId)
      const summary = gitBaseline(root, repository.list().find(deck => deck.id === deckId)?.path ?? '', current)
      writeJson(environment.stdout, { ok: true, workspace: root, deckId, source: summary.source, diff: summary.diff })
      return 0
    }
    if (args[0] === 'open') {
      const started = environment.startView
        ? await environment.startView(root, 'decks')
        : await startWorkspaceView(root, 'decks', undefined, context.runtimeRoot)
      if (!args.includes('--no-browser')) {
        try { await (environment.openExternal ?? openExternal)(started.url) }
        catch (error) { await started.close(); throw error }
      }
      installShutdown(started)
      writeJson(environment.stdout, { ok: true, workspace: root, command: 'open', url: started.url })
      return 0
    }
    if (args[0] === 'overview' || args[0] === 'present') {
      const view = args[0]
      const deckId = args[1]
      if (!deckId) throw cliError('cli.deck-required', `${view} requires a deck id`)
      const selected = repository.load(deckId)
      if (view === 'present' && selected.status === 'outline') throw cliError('present.outline', 'Outline draft must be confirmed and generated before presentation')
      let presentVerification: ReturnType<typeof verifyDeckValue> | undefined
      if (view === 'present') {
        const selected = repository.load(deckId!)
        presentVerification = verifyWorkspaceDeck(selected, dirname(repository.list().find(deck => deck.id === deckId)!.path))
        if (!presentVerification.ok) throw cliError('present.verify', 'File smoke failed before presentation')
        if (!environment.startView) assertRuntimeBuilt(context.runtimeRoot)
      }
      const started = environment.startView
        ? await environment.startView(root, view, deckId)
        : await startWorkspaceView(root, view, deckId, context.runtimeRoot)
      if (view === 'present' && !environment.startView) {
        const selected = repository.load(deckId!)
        const browser = await runBrowserSmoke(started.origin, deckId!, flattenOutline(selected.outline))
        if (!browser.ok) { await started.close(); throw cliError('present.browser-smoke', JSON.stringify(browser.findings)) }
      }
      installShutdown(started)
      writeJson(environment.stdout, { ok: true, workspace: root, command: view, url: started.url, ...(presentVerification ? { checkedSlides: presentVerification.checkedSlides } : {}) })
      return 0
    }
    throw cliError('cli.command', `Unknown command “${args[0]}”`)
  } catch (error) {
    const normalized = normalizeError(error)
    writeJson(environment.stderr, { ok: false, error: normalized })
    return 1
  }
}

export async function startWorkspaceView(root: string, view: WorkspaceView, deckId?: string, runtimeRoot = defaultRuntimeRoot): Promise<StartedWorkspaceView> {
  const running = await createWorkspaceServer({ root, publicRoot: resolve(runtimeRoot, 'dist') }).listen()
  const url = workspaceViewUrl(running.origin, view, deckId)
  return { ...running, url }
}

export function workspaceViewUrl(origin: string, view: WorkspaceView, deckId?: string) {
  const url = new URL('/', origin)
  url.searchParams.set('view', view)
  if (deckId) url.searchParams.set('deck', deckId)
  return url.href
}

export function openExternal(url: string): Promise<void> {
  const [command, args] = process.platform === 'darwin'
    ? ['open', [url]] as const
    : process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]] as const
      : ['xdg-open', [url]] as const
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, error => error ? reject(error) : resolvePromise())
  })
}

function gitBaseline(root: string, path: string, current: ReturnType<WorkspaceRepository['load']>) {
  try {
    const repositoryPath = relative(root, path).replaceAll('\\', '/')
    const text = execFileSync('git', ['show', `HEAD:${repositoryPath}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return { source: 'git' as const, diff: summarizeDeckDiff(parseDeckDocument(JSON.parse(text)), current) }
  } catch {
    return { source: 'untracked' as const, diff: { slides: Object.fromEntries(Object.keys(current.slides).map(id => [id, ['added']])), outlineChanged: true, masterChanged: true } }
  }
}

function assertRuntimeBuilt(runtimeRoot: string) {
  if (!existsSync(resolve(runtimeRoot, 'dist', 'index.html'))) throw cliError('runtime.not-built', `Cadenza renderer is missing at ${resolve(runtimeRoot, 'dist')}`)
}

function installShutdown(server: StartedWorkspaceView) {
  const close = () => { void server.close().finally(() => { process.exitCode = 0 }) }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}

function parseInspectTarget(value: string | undefined) {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/slide:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value ?? '')
  if (!match) throw cliError('cli.inspect-target', 'Expected <deck-id>/slide:<slide-id>')
  return { deckId: match[1], slideId: match[2] }
}

function parseGlobalArgs(values: readonly string[]) {
  const args = [...values]
  const index = args.findIndex(value => value === '--workspace' || value.startsWith('--workspace='))
  if (index < 0) return { args, workspace: undefined }
  const inline = args[index].startsWith('--workspace=') ? args[index].slice('--workspace='.length) : undefined
  const workspace = inline ?? args[index + 1]
  if (!workspace) throw cliError('cli.workspace-argument', '--workspace requires a path')
  args.splice(index, inline === undefined ? 2 : 1)
  return { args, workspace }
}

function summarizeSlide(slide: object) {
  const record = slide as Record<string, unknown>
  const values = [record.title, record.subtitle, record.body, record.quote]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  return values.join(' · ').slice(0, 240)
}

function cliError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'cli.failure'
    return { code, message: error.message }
  }
  return { code: 'cli.failure', message: String(error) }
}

function writeJson(write: (value: string) => void, value: unknown) {
  write(`${JSON.stringify(value)}\n`)
}

class NodeWorkspaceReader implements WorkspaceReader {
  exists(path: string) { return existsSync(path) }
  readText(path: string) { return readFileSync(path, 'utf8') }
  listDirectories(path: string) {
    return readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  }
}

export async function runNodeCli(args = process.argv.slice(2)) {
  const exitCode = await runCli(args, {
    cwd: process.cwd(),
    reader: new NodeWorkspaceReader(),
    stdout: value => process.stdout.write(value),
    stderr: value => process.stderr.write(value),
  })
  process.exitCode = exitCode
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runNodeCli()
}
