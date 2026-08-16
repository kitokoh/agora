import { nextjs } from '@agora/config/eslint';

// The `nextjs` preset already includes the monorepo-wide `base` preset.
// Next.js apps (web, dashboard, admin) receive the React/Next rules via the
// preset's `files` scoping; the remaining workspaces get the base rules.
export default [...nextjs];
