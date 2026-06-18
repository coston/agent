# Agent Rules

1. Avoid leaving script (.sh) files in the repo. Prefer framework integration.
2. Prefer DRY, immutable, functional programming.
3. Prefer expressive, declarative constructs (e.g., map/flatMap) over imperative
   loops. Optimize for performance only when there is clear evidence it matters.
4. This is a published ESM package. Build output must be tree-shakeable,
   side-effect free, and consumable in any Next.js/React app or bundler. Subpath
   exports (`./server`, `./react`, `./persistence`, `./mcp`) keep server-only
   code (`node:crypto`, Prisma, `mcp-handler`) out of the client bundle.
5. **Subscribe to standards, don't reinvent.** This package is a thin wiring
   layer over the Vercel AI SDK and MCP. Tools are AI SDK `tool()`/`ToolSet`;
   messages are `UIMessage`; transport is `ChatTransport`; streaming is
   `streamText`/`useChat`; MCP uses `mcp-handler` + `experimental_createMCPClient`.
   The only bespoke interface is `PersistenceAdapter` (the SDK has no storage
   primitive). If a standard primitive already does it, expose/wire it — never
   wrap it in new vocabulary.
6. Auth and persistence are **injected, never owned**. The package ships no token
   verifier and no opinion on which auth library or store you use.
7. Tests use Vitest (co-located `*.test.ts(x)`); React components use Testing
   Library with a `// @vitest-environment jsdom` pragma. The agent must
   self-prove the implementation works (build + tests green) before claiming done.
8. Prefer defaults over custom config files.
9. Always aim to reduce and simplify the codebase.
10. Keep README.md, ARCHITECTURE.md, and USAGE.md up to date as things evolve.
11. Defend the user's data: never print or log secrets (provider API keys are
    AES-256-GCM encrypted at rest, decrypted server-side only); never turn a
    user-supplied base URL into a server-side request (local models run in the
    browser).
