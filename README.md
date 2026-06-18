# @coston/agent

Reusable, standards-first agent-chat for app-scoped LLM copilots. A thin wiring
layer over the [Vercel AI SDK](https://ai-sdk.dev) and
[MCP](https://modelcontextprotocol.io) — not a framework. Each app keeps its own
agent, scoped to its own API; this package removes the copy-paste.

## Why

Apps that embed an LLM copilot keep re-growing the same chat plumbing: the
`streamText → toUIMessageStreamResponse → useChat` route, provider resolution +
API-key encryption, conversation persistence, the chat panel, and an MCP server.
This package is that shared core; each app injects what's app-specific — tools,
system prompt, auth, and persistence.

## Subpath exports

| Import | What it gives you |
| --- | --- |
| `@coston/agent/server` | `createChatRoute`, `createProviderResolver`/`buildModel`, secret crypto, the model registry, `defineAgent` |
| `@coston/agent/react` | `ChatPanel`/`ChatSession`/`MessageBubble`, `ProviderForm`, `createLocalTransport` |
| `@coston/agent/persistence` | `PersistenceAdapter` + `createPrismaPersistence` |
| `@coston/agent/mcp` | `createMcpRoute`, `createScopedHelper`, `mcpText` |

Server, persistence, and mcp are server-only; only `react` ships to the browser.

**Adopting in a new app?** See **[USAGE.md](./USAGE.md)** — a complete, generic
recipe (prerequisites, the required data model, and wiring all four subpaths).

## Install (from git)

Distributed via this **git repo**, versioned with SemVer tags. Consumers pin a
SemVer range against the tags:

```jsonc
// package.json
"dependencies": {
  "@coston/agent": "git+https://github.com/coston/agent.git#semver:^0.2.0"
}
```

`dist/` is committed at each tagged release, so `npm install` pulls **prebuilt**
output — no build step on the consumer side. Peer deps (`ai`, `@ai-sdk/*`,
`react`, `@coston/ui`, `mcp-handler`, …) resolve from the consuming app. Requires
`@coston/ui >= 0.3.0`.

## Releases

Automated by **semantic-release** (git-only — `npmPublish: false`). On push to
`main`, the GitHub Actions workflow type-checks, tests, builds, bumps the SemVer
version from the Conventional-Commit history, commits the rebuilt `dist`, tags
`vX.Y.Z`, and cuts a GitHub Release. Nothing is published to npm. Use
`fix:` / `feat:` / `feat!:` commit prefixes to drive patch / minor / major bumps.

## `@coston/agent/server` — chat route

```ts
// app/api/chat/route.ts
import { createChatRoute, createProviderResolver, decryptSecret } from '@coston/agent/server';

const { resolveUserModel } = createProviderResolver({
  loadSetting: userId => db.aiProviderSetting.findUnique({ where: { userId } }),
  decrypt: decryptSecret,
});

export const { POST } = createChatRoute({
  authorize: async (req, body) => {
    /* app owns ALL auth — return { userId, scope, context } or { error, status } */
  },
  resolveModel: resolveUserModel,
  buildTools: ({ context }) => buildAppTools(context), // standard AI SDK ToolSet
  buildSystemPrompt: ({ context, body }) => buildPrompt(context, body),
  persistence, // or: saveMessages: ({ conversationId, scope, messages }) => …
  conversationIdFrom: body => body.conversationId,
  maxSteps: 12,
});
```

The same `ToolSet` works for both actuation styles: tools **with** `execute` run
server-side; tools **without** `execute` are surfaced to the browser via
`useChat`'s `onToolCall`. The package never names a tool.

### Agent definition (`defineAgent`)

Define an agent from Markdown instructions, a tool set, and **Skills** — Markdown
playbooks pulled on demand via an auto-injected `load_skill` tool (progressive
disclosure):

```ts
import { defineAgent } from '@coston/agent/server';
import instructions from './agent/instructions.md'; // app loads the markdown

const agent = defineAgent({
  instructions, // Markdown
  tools: buildAppTools(ctx),
  skills: [{ name: 'example', description: 'When this applies', content: exampleMd }],
  approvals: ['delete_item'], // → AI SDK needsApproval; UI renders Approve/Deny
  context: ctx => snapshot(ctx),
});

// in createChatRoute:
buildTools: ({ context }) => agent.tools(context),
buildSystemPrompt: ({ context }) => agent.systemPrompt(context),
```

Skills add only `name`/`description` to the prompt; the body loads on demand.

## Develop

```bash
npm install
npm run build      # tsdown → dist/ (ESM, externalized peers, stable d.ts names)
npm test           # vitest
npm run type-check
npm run lint
```

## License

MIT
