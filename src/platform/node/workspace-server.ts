import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, watch as watchFiles, writeFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { coreLayoutIds } from '../../rendering/core-templates.ts'
import { parseDeckDocument } from '../../core/deck-document.ts'
import { environmentPresetIds } from '../../engine/environment-presets.ts'
import { motionPresetIds } from '../../motion/presets.ts'
import { fontThemeIds } from '../../typography/themes.ts'
import { WorkspaceRepository, type WorkspaceReader } from './workspace-repository.ts'
import { summarizeDeckDiff } from '../../diff/deck-diff.ts'
import { verifyWorkspaceDeck } from './workspace-verifier.ts'

export interface WorkspaceServerOptions {
  root: string
  host?: string
  port?: number
  publicRoot?: string
  watch?: boolean
  readOnly?: boolean
  closeWhenIdle?: boolean
  idleTimeoutMs?: number
  startupTimeoutMs?: number
  onClose?(): void
}

export interface RunningWorkspaceServer {
  origin: string
  close(): Promise<void>
}

export function createWorkspaceServer(options: WorkspaceServerOptions) {
  const root = resolve(options.root)
  const reader = new NodeReader()
  const repository = new WorkspaceRepository(root, reader)
  const sessionSnapshots = new Map(repository.list().map(deck => [deck.id, repository.load(deck.id)]))
  const eventClients = new Set<ServerResponse>()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let closeServer = () => {}
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://cadenza.local')
      if (url.pathname === '/api/config' && request.method === 'GET') return json(response, 200, repository.config)
      if (url.pathname === '/api/decks' && request.method === 'GET') return json(response, 200, repository.list())
      if (url.pathname === '/api/catalog' && request.method === 'GET') {
        return json(response, 200, { layouts: coreLayoutIds, typography: fontThemeIds, backgrounds: environmentPresetIds, motion: motionPresetIds })
      }
      if (url.pathname === '/api/events' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        response.write('event: ready\ndata: {}\n\n')
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined }
        eventClients.add(response)
        request.on('close', () => {
          eventClients.delete(response)
          if (options.closeWhenIdle && eventClients.size === 0) idleTimer = setTimeout(closeServer, options.idleTimeoutMs ?? 5000)
        })
        return
      }
      const diffMatch = /^\/api\/decks\/([^/]+)\/diff$/.exec(url.pathname)
      if (diffMatch && request.method === 'GET') {
        const deckId = validDeckId(decodeURIComponent(diffMatch[1]), response)
        if (!deckId) return
        const initial = sessionSnapshots.get(deckId)
        if (!initial) return jsonError(response, 404, 'deck.not-found', `Deck “${deckId}” not found`)
        return json(response, 200, { ok: true, deckId, source: 'session', diff: summarizeDeckDiff(initial, repository.load(deckId)) })
      }
      const assetMatch = /^\/api\/decks\/([^/]+)\/assets\/(.+)$/.exec(url.pathname)
      if (assetMatch && request.method === 'GET') {
        const deckId = validDeckId(decodeURIComponent(assetMatch[1]), response)
        if (!deckId) return
        let assetPath: string
        try { assetPath = decodeURIComponent(assetMatch[2]) } catch { return jsonError(response, 400, 'asset.path', 'Invalid asset path encoding') }
        if (assetPath.split('/').some(part => part === '..' || part === '.')) return jsonError(response, 400, 'asset.path', 'Asset path must stay inside the deck assets directory')
        const assetsRoot = resolve(root, repository.config.decksDirectory, deckId, 'assets')
        const path = resolve(assetsRoot, assetPath)
        assertInside(assetsRoot, path)
        if (!existsSync(path) || !statSync(path).isFile()) return jsonError(response, 404, 'asset.not-found', 'Asset not found')
        try { assertInside(realpathSync(assetsRoot), realpathSync(path)) } catch { return jsonError(response, 403, 'asset.escape', 'Asset resolves outside the deck assets directory') }
        return serveFile(response, path, request.headers.range)
      }
      const deckMatch = /^\/api\/decks\/([^/]+)$/.exec(url.pathname)
      if (deckMatch) {
        const deckId = decodeURIComponent(deckMatch[1])
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deckId)) return jsonError(response, 400, 'request.deck-id', 'Invalid deck id')
        const deckPath = deckFilePath(root, repository.config.decksDirectory, deckId)
        if (request.method === 'GET') {
          if (!existsSync(deckPath)) return jsonError(response, 404, 'deck.not-found', `Deck “${deckId}” not found`)
          const text = readFileSync(deckPath, 'utf8')
          response.setHeader('etag', etag(text))
          return json(response, 200, JSON.parse(text))
        }
        if (request.method === 'PUT') {
          if (options.readOnly) return jsonError(response, 403, 'workspace.read-only', 'Portable deck previews are read-only; unpack the archive to edit it')
          if (!existsSync(deckPath)) return jsonError(response, 404, 'deck.not-found', `Deck “${deckId}” not found`)
          const current = readFileSync(deckPath, 'utf8')
          if (request.headers['if-match'] !== etag(current)) return jsonError(response, 409, 'deck.conflict', 'Deck changed; refresh before saving')
          const text = await readBody(request)
          let parsed: unknown
          try { parsed = JSON.parse(text) } catch { return jsonError(response, 422, 'deck.json', 'Request body is not valid JSON') }
          let deck: ReturnType<typeof parseDeckDocument>
          try {
            deck = parseDeckDocument(parsed)
            if (deck.id !== deckId) return jsonError(response, 422, 'deck.id-mismatch', 'Deck id does not match URL')
            const report = verifyWorkspaceDeck(deck, resolve(deckPath, '..'))
            if (!report.ok) return jsonError(response, 422, 'deck.verify', report.findings.filter(finding => finding.severity === 'error').map(finding => `${finding.ruleId} ${finding.path}`).join('; '))
          } catch (error) {
            return jsonError(response, 422, 'deck.invalid', error instanceof Error ? error.message : String(error))
          }
          const temporary = join(resolve(deckPath, '..'), `.${basename(deckPath)}.${process.pid}.tmp`)
          writeFileSync(temporary, `${JSON.stringify(deck, null, 2)}\n`, { flag: 'wx' })
          renameSync(temporary, deckPath)
          const stored = readFileSync(deckPath, 'utf8')
          response.setHeader('etag', etag(stored))
          return json(response, 200, { ok: true })
        }
      }
      if (options.publicRoot && request.method === 'GET') return serveStatic(response, options.publicRoot, url.pathname)
      return jsonError(response, 404, 'request.not-found', 'Not found')
    } catch (error) {
      return jsonError(response, 500, 'server.failure', error instanceof Error ? error.message : String(error))
    }
  })

  const watcher = options.watch === false ? undefined : watchFiles(root, { recursive: true }, (_event, filename) => {
    if (!filename || !isWorkspaceWatchPath(String(filename))) return
    const payload = `event: workspace-change\ndata: ${JSON.stringify({ path: String(filename) })}\n\n`
    for (const client of eventClients) client.write(payload)
  })
  let closing: Promise<void> | undefined
  const close = () => closing ??= new Promise<void>((done, fail) => {
    if (idleTimer) clearTimeout(idleTimer)
    watcher?.close()
    for (const client of eventClients) client.end()
    server.close(error => {
      options.onClose?.()
      if (error) fail(error)
      else done()
    })
    server.closeAllConnections()
  })
  closeServer = () => { void close() }

  return {
    listen: () => new Promise<RunningWorkspaceServer>((resolveReady, reject) => {
      server.once('error', reject)
      server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
        server.off('error', reject)
        const address = server.address()
        if (!address || typeof address === 'string') return reject(new Error('Workspace server did not bind a TCP port'))
        const origin = `http://${options.host ?? '127.0.0.1'}:${address.port}`
        if (options.closeWhenIdle) idleTimer = setTimeout(closeServer, options.startupTimeoutMs ?? 30_000)
        resolveReady({ origin, close })
      })
    }),
  }
}

export function isWorkspaceWatchPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  return /(^|\/)deck\.cadenza\.json$/.test(normalized)
    || normalized.startsWith('design-system/custom/')
}

function deckFilePath(root: string, decksDirectory: string, deckId: string) {
  const path = resolve(root, decksDirectory, deckId, 'deck.cadenza.json')
  assertInside(root, path)
  return path
}

function validDeckId(value: string, response: ServerResponse) {
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value
  jsonError(response, 400, 'request.deck-id', 'Invalid deck id')
  return undefined
}

function assertInside(root: string, path: string) {
  const child = relative(root, path)
  if (child.startsWith(`..${sep}`) || child === '..' || resolve(path) === resolve(root)) throw new Error('Resolved path escapes workspace root')
}

function etag(text: string) {
  return `"${createHash('sha256').update(text).digest('hex')}"`
}

async function readBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 5_000_000) throw new Error('Request body exceeds 5 MB')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(`${JSON.stringify(value)}\n`)
}

function jsonError(response: ServerResponse, status: number, code: string, message: string) {
  json(response, status, { ok: false, error: { code, message } })
}

function serveStatic(response: ServerResponse, publicRoot: string, pathname: string) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  let path = resolve(publicRoot, requested)
  assertInside(resolve(publicRoot), path)
  if (!existsSync(path) || statSync(path).isDirectory()) path = resolve(publicRoot, 'index.html')
  serveFile(response, path)
}

function serveFile(response: ServerResponse, path: string, range?: string) {
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4' }
  const contentType = types[extname(path).toLowerCase()] ?? 'application/octet-stream'
  const size = statSync(path).size
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    let start = match?.[1] ? Number(match[1]) : undefined
    let end = match?.[2] ? Number(match[2]) : undefined
    if (start === undefined && end !== undefined) {
      start = Math.max(0, size - end)
      end = size - 1
    } else {
      start ??= 0
      end = Math.min(end ?? size - 1, size - 1)
    }
    if (!match || start >= size || start > end) {
      response.writeHead(416, { 'content-range': `bytes */${size}` })
      return response.end()
    }
    response.writeHead(206, {
      'accept-ranges': 'bytes',
      'content-type': contentType,
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    })
    return createReadStream(path, { start, end }).pipe(response)
  }
  response.writeHead(200, { 'accept-ranges': 'bytes', 'content-type': contentType, 'content-length': size })
  return createReadStream(path).pipe(response)
}

class NodeReader implements WorkspaceReader {
  exists(path: string) { return existsSync(path) }
  readText(path: string) { return readFileSync(path, 'utf8') }
  listDirectories(path: string) { return readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name) }
}
