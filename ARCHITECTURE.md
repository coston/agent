# Architecture

## Principle: thin wiring over standards

`@coston/agent` adds **no new runtime concepts** on top of the Vercel AI SDK and
MCP. Each factory takes/returns standard types:

- Tools → AI SDK `tool()` / `ToolSet` (optional `execute` = the SDK's own
  server-vs-client split).
- Messages → `UIMessage`, stored verbatim (`parts`).
- Transport → `ChatTransport` (`DefaultChatTransport`; the local plugin is the
  same interface).
- Streaming → `streamText` + `toUIMessageStreamResponse` (wired inside
  `createChatRoute`) + `useChat` from `@ai-sdk/react` on the client.
- Providers → `createAnthropic`/`createOpenAI`/`createOpenAICompatible` + the
  Gateway `provider/model` string; `buildModel` returns a `LanguageModel`.
- MCP → `mcp-handler` (server) and `experimental_createMCPClient` (future
  federation client).

The **only** bespoke interface is `PersistenceAdapter`, because the SDK does not
standardize chat storage. It still stores standard `UIMessage` parts. Its
contract (and a custom, non-Prisma implementation) is in
[USAGE.md → Custom store](./USAGE.md#3-provider-resolution--persistence-server).

## Layout

```
src/
  shared/        client-safe types (provider-types, models, messages)
  server.ts      → @coston/agent/server barrel
  server/        provider, crypto, models, route, errors, agent
  react.tsx      → @coston/agent/react barrel
  react/         ChatPanel, ChatSession, MessageBubble, ProviderForm, local-transport
  persistence.ts → @coston/agent/persistence barrel
  persistence/   PersistenceAdapter, prisma adapter
  mcp.ts         → @coston/agent/mcp barrel
  mcp/           createMcpRoute, scoped, mcpText
```

`tsdown` builds with `unbundle: true`, mirroring `src/ → dist/` with stable,
un-hashed names. Peer deps (`ai`, `@ai-sdk/*`, `react`, `@coston/ui`,
`mcp-handler`) are externalized. Persistence is **structural** over the app's
Prisma client (duck-typed delegates), so the package takes no Prisma dependency
at all.

## The hard seams (one module, different app shapes)

Apps that adopt the package differ along a few axes; each is an injection point,
so no app-specifics live in the package:

| Divergence | Resolution |
| --- | --- |
| Server-execute tools vs client-side `onToolCall` | Optional `execute` on a standard `ToolSet`; `onToolCall` injected into `<ChatPanel>` |
| Browser local-model inference | Opt-in `createLocalTransport` (browser only); the server resolver refuses `openai_compatible` (SSRF guard) |
| Prisma vs raw SQL / RLS storage | One `PersistenceAdapter`; a `createPrismaPersistence` with injected ownership clauses, or a custom adapter |
| Any auth scheme | `authorize` (chat) and `verifyToken` (mcp) are injected; the package owns no auth |
| Ownership by partition column vs join | `scope = { userId, partitionId? }`; the route only ever calls `saveMessages` |

## Agent definition

`defineAgent` (in `@coston/agent/server`) is a filesystem-shaped agent definition
— Markdown instructions + a standard `ToolSet` + **Skills** — returning
`{ systemPrompt, tools }` to hand straight to `createChatRoute`.

- **Instructions** — a Markdown string (or a function of per-request context). Apps
  load it however they like (import, `fs`, inline); the package keeps no opinion on
  the filesystem, so it stays edge/bundler-safe.
- **Skills** — Markdown playbooks. Only `name` + `description` sit in the prompt;
  the body is pulled on demand via an auto-injected `load_skill` tool
  (progressive disclosure — cheap context until the skill is needed).
- **Approvals** — `approvals: ['delete_item']` sets the AI SDK's standard
  `tool({ needsApproval })`. The chat UI renders an Approve/Deny prompt
  (`tool-approval-request` part) wired to `useChat().addToolApprovalResponse`.
