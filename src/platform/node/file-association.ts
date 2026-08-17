import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const bundleIdentifier = 'com.supertapir.CadenzaSlide'
const launchServices = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

export function installMacFileAssociation(options: {
  platform?: NodeJS.Platform
  appPath?: string
  nodePath?: string
  cliPath?: string
  compile?: (script: string, appPath: string) => void
  register?: (appPath: string) => void
} = {}) {
  if ((options.platform ?? process.platform) !== 'darwin') throw associationError('association.platform', 'File association installation currently supports macOS only')
  const appPath = resolve(options.appPath ?? join(homedir(), 'Applications', 'CadenzaSlide.app'))
  const nodePath = resolve(options.nodePath ?? process.execPath)
  const cliPath = resolve(options.cliPath ?? process.argv[1])
  mkdirSync(dirname(appPath), { recursive: true })
  const stage = join(dirname(appPath), `.${basename(appPath, '.app')}.${process.pid}.${randomUUID()}.tmp.app`)
  const script = appleScript(nodePath, cliPath)
  const compile = options.compile ?? ((source, path) => { execFileSync('/usr/bin/osacompile', ['-o', path, '-e', source], { stdio: 'ignore' }) })
  compile(script, stage)
  mkdirSync(join(stage, 'Contents'), { recursive: true })
  writeFileSync(join(stage, 'Contents', 'Info.plist'), infoPlist())

  if (existsSync(appPath)) {
    const plist = join(appPath, 'Contents', 'Info.plist')
    if (!existsSync(plist) || !readFileSync(plist, 'utf8').includes(bundleIdentifier)) {
      rmSync(stage, { recursive: true, force: true })
      throw associationError('association.target', `Refusing to replace unrelated app at ${appPath}`)
    }
    rmSync(appPath, { recursive: true })
  }
  renameSync(stage, appPath)
  const register = options.register ?? (path => { execFileSync(launchServices, ['-f', path], { stdio: 'ignore' }) })
  register(appPath)
  return { appPath }
}

function infoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>${bundleIdentifier}</string>
  <key>CFBundleName</key><string>CadenzaSlide</string>
  <key>CFBundleExecutable</key><string>droplet</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
  <key>CFBundleDocumentTypes</key><array><dict>
    <key>CFBundleTypeName</key><string>Cadenza deck</string>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>LSHandlerRank</key><string>Owner</string>
    <key>LSItemContentTypes</key><array><string>com.supertapir.cadenza.deck</string></array>
  </dict></array>
  <key>UTExportedTypeDeclarations</key><array><dict>
    <key>UTTypeIdentifier</key><string>com.supertapir.cadenza.deck</string>
    <key>UTTypeDescription</key><string>Cadenza portable deck</string>
    <key>UTTypeConformsTo</key><array><string>public.zip-archive</string></array>
    <key>UTTypeTagSpecification</key><dict>
      <key>public.filename-extension</key><array><string>cadenza</string></array>
      <key>public.mime-type</key><string>application/vnd.cadenza.deck+zip</string>
    </dict>
  </dict></array>
</dict></plist>
`
}

function appleScript(nodePath: string, cliPath: string) {
  const prefix = `${shellQuote(nodePath)} ${shellQuote(cliPath)} open `
  return `on open deckFiles
  repeat with deckFile in deckFiles
    set deckPath to POSIX path of deckFile
    do shell script ${appleScriptString(prefix)} & quoted form of deckPath & " >/dev/null 2>&1 &"
  end repeat
end open`
}

function shellQuote(value: string) { return `'${value.replaceAll("'", "'\\''")}'` }
function appleScriptString(value: string) { return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` }

function associationError(code: string, message: string) { return Object.assign(new Error(message), { code }) }
