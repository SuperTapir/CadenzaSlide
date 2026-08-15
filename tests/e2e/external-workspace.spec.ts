import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { createDefaultDeckMaster } from '../../src/core/deck-master'
import { createWorkspaceServer } from '../../src/platform/node/workspace-server'

const runtimeRoot = resolve(import.meta.dirname, '../..')
const cli = resolve(runtimeRoot, 'src/apps/cli/cadenza.ts')

test.beforeAll(() => execFileSync('npm', ['run', 'build'], { cwd: runtimeRoot, stdio: 'pipe' }))

test('installed runtime renders a deck from a repository-external workspace', () => {
  const workspace = mkdtempSync(`${tmpdir()}/cadenza-external-e2e-`)
  const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', cli, ...args], { cwd: runtimeRoot, encoding: 'utf8' }))
  expect(run('init', workspace)).toMatchObject({ ok: true, workspace })
  expect(run('--workspace', workspace, 'new', 'demo', '--title=External deck')).toMatchObject({ ok: true, workspace, deckId: 'demo' })
  const deckPath = resolve(workspace, 'decks/demo/deck.cadenza.json')
  const deck = JSON.parse(readFileSync(deckPath, 'utf8'))
  deck.status = 'complete'
  deck.slides.intro.subtitle = 'Runtime and content stay separate'
  writeFileSync(deckPath, `${JSON.stringify(deck, null, 2)}\n`)

  expect(run('--workspace', workspace, 'list')).toMatchObject({ ok: true, workspace, decks: [{ id: 'demo' }] })
  expect(run('--workspace', workspace, 'inspect', 'demo/slide:intro')).toMatchObject({ ok: true, workspace, slide: { id: 'intro' } })
  expect(run('--workspace', workspace, 'verify', 'demo', '--browser')).toMatchObject({ workspace, deckId: 'demo', browser: { ok: true, checkedSlides: 1 } })
  expect(existsSync(resolve(workspace, 'package.json'))).toBe(false)
  expect(existsSync(resolve(workspace, 'src'))).toBe(false)
  expect(existsSync(resolve(workspace, 'dist'))).toBe(false)
  expect(existsSync(resolve(workspace, 'node_modules'))).toBe(false)
})

test('Studio persists notes and downward slide reordering into the workspace deck', async ({ page }) => {
  const workspace = mkdtempSync(`${tmpdir()}/cadenza-studio-persistence-`)
  const deckPath = resolve(workspace, 'decks/demo/deck.cadenza.json')
  mkdirSync(resolve(workspace, 'decks/demo/assets'), { recursive: true })
  writeFileSync(resolve(workspace, 'cadenza.config.json'), JSON.stringify({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' }))
  writeFileSync(deckPath, JSON.stringify({
    version: 1,
    id: 'demo',
    title: 'Persistence',
    status: 'complete',
    master: createDefaultDeckMaster(),
    slides: {
      intro: { id: 'intro', role: 'intro', layout: 'title', label: 'Intro', ariaLabel: 'Intro', title: ['Intro'] },
      second: { id: 'second', role: 'content', layout: 'blank', label: 'Second', ariaLabel: 'Second' },
    },
    outline: [{ kind: 'slide', slideId: 'intro' }, { kind: 'slide', slideId: 'second' }],
  }, null, 2))
  const server = await createWorkspaceServer({ root: workspace, publicRoot: resolve(runtimeRoot, 'dist'), watch: false }).listen()

  try {
    await page.goto(`${server.origin}/?deck=demo`)
    await page.getByRole('button', { name: 'Notes' }).click()
    await page.getByLabel('当前页面的演讲者注释').fill('Persisted from Studio')
    await expect(page.locator('#workspace-status')).toHaveText('已保存到 deck 文件')
    await page.locator('[data-navigator-slide="intro"]').dragTo(page.locator('[data-navigator-slide="second"]'))
    await expect.poll(() => JSON.parse(readFileSync(deckPath, 'utf8')).outline[0].slideId).toBe('second')

    await page.reload()
    await expect(page.locator('[data-navigator-slide]').first()).toHaveAttribute('data-navigator-slide', 'second')
    expect(JSON.parse(readFileSync(deckPath, 'utf8')).slides.intro.notes).toBe('Persisted from Studio')
  } finally {
    await server.close()
  }
})
