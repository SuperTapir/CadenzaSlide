import { defineConfig } from '@playwright/test'

const e2ePort = process.env.CADENZA_E2E_PORT ?? '4184'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    locale: 'zh-CN',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `CADENZA_WORKSPACE_API=off npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: true,
  },
})
