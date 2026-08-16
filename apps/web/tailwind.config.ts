import type { Config } from 'tailwindcss';

/**
 * M0 minimal design tokens (issue #11). Full design system lives in
 * packages/ui (Radix + Tailwind) per AGENTS.md repo map.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
