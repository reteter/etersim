import { defineConfig, devices } from '@playwright/test';

// Dev port is overridable via PLAYWRIGHT_PORT — useful when running multiple
// worktrees/checkouts in parallel, where 5173 may already be taken by another
// project's dev server (never kill a foreign process to free it up).
const port = Number(process.env.PLAYWRIGHT_PORT) || 5173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices["Desktop Chrome"] },
    },
    // Add more browsers later if needed (firefox, webkit)
  ],

  // Automatically start the dev server for E2E tests
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
