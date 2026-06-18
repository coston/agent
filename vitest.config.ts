import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX is transformed by oxc using tsconfig's `jsx: react-jsx`.
  test: {
    // Default to the Node environment; React component tests opt into jsdom
    // per-file with a `// @vitest-environment jsdom` pragma.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
