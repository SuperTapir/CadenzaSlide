import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { createWorkspaceServer } from './src/platform/node/workspace-server.ts'

export default defineConfig(async ({ command, mode }) => {
  const workspaceRoot = resolve(process.env.CADENZA_WORKSPACE_ROOT ?? process.cwd())
  if (command !== 'serve' || mode === 'test' || process.env.CADENZA_WORKSPACE_API === 'off' || !existsSync(resolve(workspaceRoot, 'cadenza.config.json'))) return {}

  const workspace = await createWorkspaceServer({ root: workspaceRoot, watch: false }).listen()
  return {
    server: { proxy: { '/api': { target: workspace.origin } } },
    plugins: [{
      name: 'cadenza-workspace-api',
      configureServer(server) {
        server.httpServer?.once('close', () => { void workspace.close() })
      },
    }],
  }
})
