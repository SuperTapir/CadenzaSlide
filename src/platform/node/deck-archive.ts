import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { once } from 'node:events'
import { strToU8, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, type ZipInputFile } from 'fflate'
import { parseDeckDocument } from '../../core/deck-document.ts'

const archiveMtime = new Date('1980-01-01T00:00:00.000Z')
const maxArchiveEntries = 4096
const maxExpandedBytes = 4 * 1024 * 1024 * 1024

interface ArchiveManifest {
  format: 'cadenza-deck'
  version: 1
  document: 'deck.cadenza.json'
}

export async function packDeckArchive(options: { deckDir: string, output: string }) {
  const deckDir = resolve(options.deckDir)
  const output = resolve(options.output)
  if (existsSync(output)) throw archiveError('archive.output-exists', `Output already exists: ${output}`)
  const documentPath = join(deckDir, 'deck.cadenza.json')
  const documentText = readFileSync(documentPath, 'utf8')
  const deck = parseDeckDocument(JSON.parse(documentText))
  const assetsRoot = join(deckDir, 'assets')
  const assets = existsSync(assetsRoot) ? assetFiles(assetsRoot) : []
  const manifest: ArchiveManifest = { format: 'cadenza-deck', version: 1, document: 'deck.cadenza.json' }

  mkdirSync(dirname(output), { recursive: true })
  try {
    await writeArchive(output, [
      { name: 'manifest.json', data: strToU8(`${JSON.stringify(manifest, null, 2)}\n`), compress: true },
      { name: 'deck.cadenza.json', data: strToU8(documentText), compress: true },
      ...assets.map(path => ({ name: `assets/${relative(assetsRoot, path).split(sep).join('/')}`, path, compress: false })),
    ])
  } catch (error) {
    if (existsSync(output)) unlinkSync(output)
    throw error
  }
  return { output, deckId: deck.id, assets: assets.length }
}

export async function extractDeckArchive(archivePath: string, targetPath: string) {
  const archive = resolve(archivePath)
  const target = resolve(targetPath)
  if (existsSync(target)) throw archiveError('archive.target-exists', `Target already exists: ${target}`)
  const parent = dirname(target)
  mkdirSync(parent, { recursive: true })
  const stage = mkdtempSync(join(parent, `.${basename(target)}.${process.pid}.cadenza-import-`))
  try {
    await extractZip(archive, stage)
    const manifest = parseManifest(readFileSync(join(stage, 'manifest.json'), 'utf8'))
    const documentPath = join(stage, manifest.document)
    const documentText = readFileSync(documentPath, 'utf8')
    const deck = parseDeckDocument(JSON.parse(documentText))
    const deckDir = join(stage, 'decks', deck.id)
    mkdirSync(deckDir, { recursive: true })
    renameSync(documentPath, join(deckDir, 'deck.cadenza.json'))
    if (existsSync(join(stage, 'assets'))) renameSync(join(stage, 'assets'), join(deckDir, 'assets'))
    else mkdirSync(join(deckDir, 'assets'))
    unlinkSync(join(stage, 'manifest.json'))
    writeFileSync(join(stage, 'cadenza.config.json'), `${JSON.stringify({ version: 1, decksDirectory: 'decks', defaultDeck: deck.id }, null, 2)}\n`)
    writeFileSync(join(stage, 'README.md'), '# Cadenza workspace\n\nImported from a portable `.cadenza` deck.\n')
    renameSync(stage, target)
    return { workspaceRoot: target, deckId: deck.id }
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
}

type ArchiveSource = { name: string, compress: boolean } & ({ data: Uint8Array, path?: never } | { path: string, data?: never })

async function writeArchive(outputPath: string, entries: ArchiveSource[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(outputPath, { flags: 'wx' })
    let blocked: Promise<unknown> | undefined
    let settled = false
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      output.destroy()
      reject(error)
    }
    const archive = new Zip((error, chunk, final) => {
      if (error) { fail(error); return }
      if (!output.write(chunk)) blocked = once(output, 'drain')
      if (final) output.end()
    })
    output.on('error', fail)
    output.on('finish', () => {
      if (settled) return
      settled = true
      resolvePromise()
    })
    void (async () => {
      for (const entry of entries) {
        const file = entry.compress ? new ZipDeflate(entry.name, { level: 6 }) : new ZipPassThrough(entry.name)
        setPortableAttributes(file)
        archive.add(file)
        if (entry.data) {
          file.push(entry.data, true)
          if (blocked) { await blocked; blocked = undefined }
          continue
        }
        for await (const chunk of createReadStream(entry.path)) {
          file.push(chunk, false)
          if (blocked) { await blocked; blocked = undefined }
        }
        file.push(new Uint8Array(), true)
        if (blocked) { await blocked; blocked = undefined }
      }
      archive.end()
    })().catch(error => { archive.terminate(); fail(error) })
  })
}

function setPortableAttributes(file: ZipInputFile) {
  file.mtime = archiveMtime
  file.os = 3
  file.attrs = 0o644 << 16
}

async function extractZip(archivePath: string, stage: string) {
  let entries = 0
  let expandedBytes = 0
  let failure: unknown
  const openFiles = new Set<number>()
  const unzip = new Unzip(file => {
    try {
      assertArchivePath(file.name)
      if (++entries > maxArchiveEntries) throw archiveError('archive.entry-limit', `Archive contains more than ${maxArchiveEntries} entries`)
      const path = join(stage, ...file.name.split('/'))
      mkdirSync(dirname(path), { recursive: true })
      const descriptor = openSync(path, 'wx')
      openFiles.add(descriptor)
      file.ondata = (error, chunk, final) => {
        if (failure) return
        if (error) { failure = error; return }
        expandedBytes += chunk.length
        if (expandedBytes > maxExpandedBytes) {
          failure = archiveError('archive.size-limit', 'Expanded archive exceeds 4 GiB')
          file.terminate()
          return
        }
        writeSync(descriptor, chunk)
        if (final) { closeSync(descriptor); openFiles.delete(descriptor) }
      }
      file.start()
    } catch (error) {
      failure = error
      file.terminate()
    }
  })
  unzip.register(UnzipInflate)
  try {
    for await (const chunk of createReadStream(archivePath)) {
      unzip.push(chunk, false)
      if (failure) throw failure
    }
    unzip.push(new Uint8Array(), true)
    if (failure) throw failure
  } finally {
    for (const descriptor of openFiles) closeSync(descriptor)
  }
}

function assetFiles(root: string) {
  const rootStats = lstatSync(root)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw archiveError('archive.assets-root', `Deck assets must be a real directory: ${root}`)
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name)
      const stats = lstatSync(path)
      if (stats.isSymbolicLink()) throw archiveError('archive.asset-symlink', `Cannot pack symlinked asset: ${path}`)
      if (stats.isDirectory()) visit(path)
      else if (stats.isFile()) files.push(path)
      else throw archiveError('archive.asset-type', `Cannot pack non-file asset: ${path}`)
    }
  }
  visit(root)
  return files
}

function assertArchivePath(path: string) {
  const safe = !path.includes('\\')
    && !path.startsWith('/')
    && !path.endsWith('/')
    && path.split('/').every(part => part && part !== '.' && part !== '..')
    && (path === 'manifest.json' || path === 'deck.cadenza.json' || path.startsWith('assets/'))
  if (!safe) throw archiveError('archive.unsafe-path', `Unsafe archive path: ${path}`)
}

function parseManifest(text: string): ArchiveManifest {
  const value = JSON.parse(text) as Partial<ArchiveManifest>
  if (value.format !== 'cadenza-deck' || value.version !== 1 || value.document !== 'deck.cadenza.json') {
    throw archiveError('archive.manifest', 'Unsupported or invalid Cadenza archive manifest')
  }
  return { format: value.format, version: value.version, document: value.document }
}

function archiveError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}
