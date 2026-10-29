import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (service worker enabled) talking to the local mock sync server.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: [
    { command: 'node scripts/mock-sync-server.mjs', port: 8787, reuseExistingServer: true },
    { command: 'npx vite preview --port 4173 --strictPort --outDir dist-e2e', port: 4173, reuseExistingServer: true },
  ],
});
