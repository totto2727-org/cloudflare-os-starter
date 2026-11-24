import { generateIgnorePatterns } from '@totto2727/gitignore-patterns'
import { defineConfig } from 'vite-plus'

const ignorePatterns = await generateIgnorePatterns(new URL('.', import.meta.url))

// Keep workspace formatting exclusions here. Package configurations define their own tasks.
export default defineConfig({
  check: {
    // The tree has never been formatted with oxfmt, so `vp check` would report every file. `vp fmt`
    // still works if invoked directly.
    fmt: false,
  },
  fmt: { ignorePatterns },
})
