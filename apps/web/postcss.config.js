import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// The dev server runs from the repo root, so Tailwind's default cwd-based config
// lookup misses apps/web/tailwind.config.ts. Point it at the config explicitly so
// the brand tokens (border, background, primary, …) load regardless of cwd.
const here = dirname(fileURLToPath(import.meta.url))

export default {
  plugins: [tailwindcss({ config: resolve(here, 'tailwind.config.ts') }), autoprefixer()],
}
