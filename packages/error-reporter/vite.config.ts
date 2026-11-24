// Vite+ per-package settings. See packages/custom-gatekeeper/vite.config.ts for why `build` and
// `test` are tasks rather than package.json scripts, and what each exclusion buys.

const ownDist = { base: 'package', pattern: '!dist/**' } as const

const vitestScratch = [
  { base: 'workspace', pattern: '!**/node_modules/.vite/**' },
  { base: 'workspace', pattern: '!**/node_modules/.vite-temp/**' },
  { base: 'workspace', pattern: '!**/.wrangler/**' },
] as const

export default {
  run: {
    tasks: {
      build: {
        command: 'tsc',
        input: [{ auto: true }, ownDist],
        output: ['dist/**'],
      },
      test: {
        // Narrower than `vitest run`: `src/index.ts` is a Worker entrypoint with no test of its own.
        command: 'vitest run src/format.test.ts',
        input: [{ auto: true }, ownDist, ...vitestScratch],
        output: [{ auto: true }, ownDist, ...vitestScratch],
      },
    },
  },
}
