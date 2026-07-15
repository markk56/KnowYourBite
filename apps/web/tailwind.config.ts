import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from 'tailwindcss'

// Brand system per "Claude - Know Your Bite Design Protocol.md". Tokens are bare
// HSL channels in src/index.css; wrapping them as hsl(var(--x) / <alpha-value>)
// lets opacity modifiers (bg-primary/90, text-muted-foreground/50, …) work.
const here = dirname(fileURLToPath(import.meta.url))
const withAlpha = (variable: string) => `hsl(var(${variable}) / <alpha-value>)`

export default {
  darkMode: ['class'],
  // Absolute globs: the dev server runs from the repo root, so cwd-relative
  // content paths would scan the wrong directory and generate no utilities.
  content: [resolve(here, 'index.html'), resolve(here, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        card: { DEFAULT: withAlpha('--card'), foreground: withAlpha('--card-foreground') },
        popover: { DEFAULT: withAlpha('--popover'), foreground: withAlpha('--popover-foreground') },
        primary: { DEFAULT: withAlpha('--primary'), foreground: withAlpha('--primary-foreground') },
        secondary: { DEFAULT: withAlpha('--secondary'), foreground: withAlpha('--secondary-foreground') },
        muted: { DEFAULT: withAlpha('--muted'), foreground: withAlpha('--muted-foreground') },
        accent: { DEFAULT: withAlpha('--accent'), foreground: withAlpha('--accent-foreground') },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
          foreground: withAlpha('--destructive-foreground'),
        },
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        chart: {
          1: withAlpha('--chart-1'),
          2: withAlpha('--chart-2'),
          3: withAlpha('--chart-3'),
          4: withAlpha('--chart-4'),
          5: withAlpha('--chart-5'),
        },
        sidebar: {
          DEFAULT: withAlpha('--sidebar'),
          foreground: withAlpha('--sidebar-foreground'),
          primary: withAlpha('--sidebar-primary'),
          'primary-foreground': withAlpha('--sidebar-primary-foreground'),
          accent: withAlpha('--sidebar-accent'),
          'accent-foreground': withAlpha('--sidebar-accent-foreground'),
          border: withAlpha('--sidebar-border'),
          ring: withAlpha('--sidebar-ring'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
} satisfies Config
