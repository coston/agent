import { defineConfig } from 'tsdown';

// One entry per subpath export. Peer dependencies (ai, @ai-sdk/*, react,
// @coston/ui, mcp-handler, @prisma/client, …) are externalized automatically,
// keeping the output a thin wiring layer rather than a re-bundle of the SDK.
export default defineConfig({
  // One top-level barrel per subpath (`src/server.ts`, `src/react.tsx`, …) with
  // implementation under `src/<name>/`. `unbundle` mirrors `src/` → `dist/` with
  // stable (un-hashed) names and keeps the output maximally tree-shakeable. Peer
  // deps are externalized by default.
  entry: ['src/server.ts', 'src/mcp.ts', 'src/persistence.ts', 'src/react.tsx'],
  format: 'esm',
  dts: true,
  unbundle: true,
  sourcemap: false,
  clean: true,
});
