import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Setup file patches the CJS require cache before any modules
    // are loaded, allowing us to mock modules loaded via CJS
    // require() which vi.mock() cannot intercept.
    setupFiles: ['vitest.setup.js'],
    coverage: {
      provider: 'v8',
      include: [
        'src/app.js',
        'src/repository/taskRepository.js',
        'src/services/taskService.js',
        'src/utils/pagination.js',
      ],
      exclude: ['src/server.js'],
      reporter: ['text', 'html'],
      thresholds: {
        perFile: true,
        lines: 85,
        functions: 80,
        branches: 80,
        statements: 85
      }
    }
  }
})
