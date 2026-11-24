import { generateIgnorePatterns } from '@totto2727/gitignore-patterns'
import { defineConfig } from 'vite-plus'

const ignorePatterns = await generateIgnorePatterns(new URL('.', import.meta.url))

/**
 * Repo-wide toolchain config, ported from the submodule's own `vite.config.ts` so a contributor
 * moving between the two repositories meets the same ruleset.
 *
 * Lint only. There is deliberately no `run.tasks` block here: Vite+ creates a task for every
 * package from a workspace-root task definition, including the root package itself, and the root
 * has no sources for one to act on. Per-package tasks live in each package's own `vite.config.ts`.
 */
export default defineConfig({
  check: {
    // The tree has never been formatted with oxfmt, so `vp check` would report every file. `vp fmt`
    // still works if invoked directly.
    fmt: false,
  },
  fmt: { ignorePatterns },
})
