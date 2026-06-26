# @coston/agent

[![npm](https://img.shields.io/npm/v/@coston/agent)](https://www.npmjs.com/package/@coston/agent)
[![Release](https://github.com/coston/agent/actions/workflows/release.yml/badge.svg)](https://github.com/coston/agent/actions/workflows/release.yml)

Reusable, standards-first agent-chat for app-scoped LLM copilots. A thin wiring
layer over the [Vercel AI SDK](https://ai-sdk.dev) and
[MCP](https://modelcontextprotocol.io) — not a framework. Each app keeps its own
agent, scoped to its own API; this package removes the copy-paste.

- [Why](#why)
- [Subpath exports](#subpath-exports)
- [Install](#install)
- [Releases](#releases)
- [`@coston/agent/server` — chat route](#costonagentserver--chat-route)
- [Develop](#develop)
- **Adopting in a new app?** → [USAGE.md](./USAGE.md)
- **Design rationale** → [ARCHITECTURE.md](./ARCHITECTURE.md)

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

The model registry and provider-label helpers (`MODELS_BY_PROVIDER`,
`DEFAULT_MODEL`, `providerNeedsKey`, `providerDisplayName`, `shortModelName`, …)
are re-exported from both `/server` and `/react` for building settings UIs; the
exported types are the reference.

**Adopting in a new app?** See **[USAGE.md](./USAGE.md)** — a complete, generic
recipe (prerequisites, the required data model, and wiring all four subpaths).

## Install

```bash
npm install @coston/agent
```

**Requires Node >=20.** Peer deps resolve from the consuming app, and most are
optional — pulled only by the subpath that uses them. Always required: `ai`,
`@ai-sdk/anthropic`, `@ai-sdk/openai`. Optional, by subpath: `@ai-sdk/react`,
`react`, `react-dom`, `@coston/ui` (`>=0.3.0 <0.5.0`), `lucide-react`,
`streamdown` for `/react`; `mcp-handler`, `@modelcontextprotocol/sdk` for `/mcp`;
`@ai-sdk/openai-compatible` for the browser local transport. See
[USAGE.md](./USAGE.md) §1 for the exact set.

## Releases

Automated by **semantic-release**. On push to `main`, the GitHub Actions workflow
type-checks, tests, builds, bumps the SemVer version from the Conventional-Commit
history, **publishes to npm**, tags `vX.Y.Z`, and cuts a GitHub Release. Use
`fix:` / `feat:` / `feat!:` commit prefixes to drive patch / minor / major bumps.
(`dist/` is a build artifact — rebuilt in CI and shipped in the npm tarball, not
committed to git.)

The [GitHub Releases](https://github.com/coston/agent/releases) page is the
changelog — each release lists the changes generated from the commit history.

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

### Images work by default

`ChatSession` ships an image composer — attach, camera capture, and paste/drag-drop —
and `MessageBubble` renders image `file` parts inline (click to enlarge). With no
configuration, picked images inline as `data:` URLs that vision models read directly.

Two opt-in hooks adapt it to your storage and privacy needs:

- **`uploadFile`** (React, on `ChatSession`) — `(file) => Promise<{ url, mediaType, filename,
  providerMetadata? }>`. When provided, attachments are uploaded first and sent as a *reference*
  instead of inlined — keeping history lightweight and bytes private.
- **`resolveAttachments`** (server, on `createChatRoute`) — `(messages, request) =>
  Promise<UIMessage[]>`. Transform messages **just before the model call** (e.g. resolve those
  private references to inline bytes). The returned messages feed the model only; the
  untransformed messages are what get persisted, so inlined bytes never reach storage and the
  assistant's reply round-trips unchanged.

Toggle the affordances with `enableAttachments` / `enableCamera` (both default `true`).

### Tool calls render as collapsible cards

`MessageBubble` renders each tool part as a compact card: a spinner + `"{label}…"`
while running, then a clickable header that expands to reveal the output. Output is
**collapsed by default** so long results never flood the transcript. The package
hard-codes no tool — pass `toolRenderers` to override per tool, keyed by tool name:

```tsx
import { ListIcon } from 'lucide-react';

<ChatSession
  toolRenderers={{
    list_tasks: {
      label: 'List tasks',
      icon: ListIcon,
      // Optional: turn raw output into rich UI. Omit it and strings render as
      // markdown, objects as a JSON code block.
      render: output => <TaskList tasks={output as Task[]} />,
    },
  }}
/>;
```

Unknown tools fall back to a humanized name (`list_tasks` → `List tasks`).

#### Rich approval bodies (`renderApproval`)

A tool flagged `needsApproval` pauses the agentic loop and renders an Approve/Deny
card. Add `renderApproval` to a tool's renderer to replace that default prompt with
a custom body built from the **proposed tool-call input** — e.g. preview a whole
batch/plan and let the user accept it or send it back for changes. It receives the
call `input` plus `approve`/`deny` callbacks (wired to `addToolApprovalResponse`):

```tsx
<ChatSession
  toolRenderers={{
    propose_plan: {
      label: 'Plan',
      // Pending (awaiting approval): preview the plan + your own buttons.
      renderApproval: ({ input, approve, deny }) => (
        <PlanPreview plan={input as Plan} onApprove={approve} onRequestChanges={deny} />
      ),
      // Applied (after approval): the tool's return value.
      render: output => <PlanResult result={output as PlanOutcome} />,
    },
  }}
/>;
```

"Request changes" is the deny path: a denial auto-resumes the loop so the model
revises (typing a change while a plan is pending also denies it, with the typed
text as the reason — a user turn can't follow an unresolved tool call). The input
is read from the `tool-<name>` part's `approval-requested` state, so it is always
available to the renderer. Set `defaultExpanded: true` on a renderer to show the
tool's output expanded instead of collapsed — handy when a tool's result *is* the
turn's answer (e.g. an applied plan).

To end the turn on a tool's output instead of making another model call, pass
`stopWhen` to `createChatRoute` (e.g. `[stepCountIs(12), hasToolCall('apply_plan')]`).

### Agent definition (`defineAgent`)

Define an agent from Markdown instructions, a tool set, and **Skills** — Markdown
playbooks pulled on demand via an auto-injected `load_skill` tool (progressive
disclosure):

```ts
import { defineAgent } from '@coston/agent/server';
import instructions from './agent/instructions.md'; // app loads the markdown

const agent = defineAgent({
  instructions, // Markdown
  tools: ctx => buildAppTools(ctx), // standard AI SDK ToolSet (or a plain ToolSet)
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
