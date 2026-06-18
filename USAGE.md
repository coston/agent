# Adopting `@coston/agent` in any app

A recipe for wiring an app-scoped copilot into a Next.js app. The example uses a
generic **"notes"** app — substitute your own domain. Nothing here is specific to
any one app; everything app-specific is injected.

## 1. Prerequisites

```jsonc
// package.json
"dependencies": {
  "@coston/agent": "git+https://github.com/coston/agent.git#semver:^0.2.0",
  // peers the package expects the app to provide:
  "ai": "^6", "@ai-sdk/anthropic": "^3", "@ai-sdk/openai": "^3",
  "@ai-sdk/react": "^3", "@coston/ui": "^0.3", "lucide-react": "^1",
  "streamdown": "^2", "react": "^19", "react-dom": "^19",
  // only if you expose an MCP server:
  "@modelcontextprotocol/sdk": "^1", "mcp-handler": "^1"
}
```

**Env vars:** `ENCRYPTION_KEY` (base64, 32 bytes — `openssl rand -base64 32`) for
provider-key encryption, plus whichever of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
/ `AI_GATEWAY_API_KEY` you default to.

## 2. Data model (Prisma)

The package is storage-agnostic (`PersistenceAdapter`), but `createPrismaPersistence`
expects a conversation + message pair and a provider-settings row. The **ownership
columns are yours** — wire them via the adapter `mapping`. A column-scoped shape
(`userId` + a partition column):

```prisma
model AiProviderSetting {
  userId           String  @id
  provider         String  @default("gateway")
  model            String  @default("anthropic/claude-sonnet-4.6")
  apiKeyCiphertext String?
  baseUrl          String?
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  notebookId String  // your partition column (a workspace / document / project id)
  title     String   @default("New chat")
  renamed   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  ChatMessage[]
  @@index([notebookId, userId, updatedAt])
}

model ChatMessage {
  id             String   @id
  conversationId String
  role           String
  parts          Json     // the AI SDK UIMessage parts, stored verbatim
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

## 3. Provider resolution + persistence (server)

```ts
// lib/agent.ts
import { createProviderResolver, decryptSecret } from '@coston/agent/server';
import { createPrismaPersistence } from '@coston/agent/persistence';
import { db } from '@/lib/db';

export const { resolveUserModel } = createProviderResolver({
  loadSetting: async userId => db.aiProviderSetting.findUnique({ where: { userId } }),
  decrypt: decryptSecret,
});

export const persistence = createPrismaPersistence({
  db,
  conversation: db.conversation,
  message: db.chatMessage,
  mapping: {
    // ownership for a single conversation (combined with { id }):
    ownershipWhere: s => ({ userId: s.userId }),
    // all conversations in the partition for this user:
    partitionWhere: s => ({ notebookId: s.partitionId, userId: s.userId }),
    createData: (s, title) => ({ notebookId: s.partitionId, userId: s.userId, title }),
  },
});
```

## 4. Chat route — `app/api/chat/route.ts`

Two ways to supply tools + prompt: inline, or via `defineAgent` (recommended —
adds Markdown instructions + Skills + approval gates).

```ts
import { createChatRoute } from '@coston/agent/server';
import { defineAgent } from '@coston/agent/server';
import { auth } from '@/lib/auth';
import { resolveUserModel, persistence } from '@/lib/agent';
import { buildNoteTools } from '@/lib/note-tools';
import instructions from '@/agent/instructions.md'; // app loads the markdown

interface Body { messages: import('ai').UIMessage[]; conversationId: string; notebookId: string }

const agent = defineAgent<{ userId: string; notebookId: string }>({
  instructions,
  tools: ctx => buildNoteTools(ctx),            // standard ToolSet — passed directly, no cast
  skills: [/* { name, description, content } */],
  approvals: ['delete_note'],                    // → AI SDK needsApproval → Approve/Deny UI
});

export const { POST } = createChatRoute<Body, { userId: string; notebookId: string }>({
  conversationIdFrom: b => b.conversationId,
  authorize: async (_req, b) => {
    const session = await auth();
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 };
    // ...verify the conversation belongs to (user, notebook)...
    return {
      userId: session.user.id,
      scope: { userId: session.user.id, partitionId: b.notebookId },
      context: { userId: session.user.id, notebookId: b.notebookId },
    };
  },
  resolveModel: resolveUserModel,
  buildTools: ({ context }) => agent.tools(context),
  buildSystemPrompt: ({ context }) => agent.systemPrompt(context),
  saveMessages: ({ conversationId, scope, messages }) =>
    persistence.saveMessages(conversationId, scope, messages),
});
```

## 5. MCP server (optional) — `app/api/[transport]/route.ts`

```ts
import { createMcpRoute, createScopedHelper, mcpText } from '@coston/agent/mcp';
import { verifyToken } from '@/lib/mcp/verify-token'; // app-owned (PAT and/or OAuth)

const scoped = createScopedHelper<'notes:read' | 'notes:write'>();

export const { GET, POST, DELETE } = createMcpRoute({
  serverInfo: { name: 'notes', version: '1.0.0' },
  verifyToken,
  registerTools: server => {
    server.tool('list_notes', 'List your notes', {}, scoped('notes:read', async (_a, { userId }) =>
      mcpText(/* ... */ '')));
  },
});
```

## 6. The panel (client)

`ChatPanel` owns session orchestration; you provide a `SessionController` (thin
wrappers over your server actions) and render the active session. For **server-side
tools** the session is just `<ChatSession>` with a `DefaultChatTransport`; for
**client-side tools** (executed in the browser), pass `onToolCall`.

```tsx
'use client';
import { DefaultChatTransport } from 'ai';
import { ChatPanel, ChatSession } from '@coston/agent/react';
import { toast } from 'sonner';
import { createConvo, renameConvo, deleteConvo, loadConvo } from '@/actions/conversations';

export function NotesCopilot({ notebookId, conversations, activeConversationId, initialMessages, providerReady }) {
  return (
    <ChatPanel
      partitionId={notebookId}
      conversations={conversations}
      activeConversationId={activeConversationId}
      initialMessages={initialMessages}
      providerReady={providerReady}
      sessions={{
        create: () => createConvo(notebookId),
        rename: (id, title) => renameConvo(id, title),
        remove: id => deleteConvo(id),
        loadMessages: id => loadConvo(id),
      }}
      onError={m => toast.error(m)}
      renderSession={({ conversationId, initialMessages, onBusyChange, onMessagesSynced }) => (
        <ChatSession
          conversationId={conversationId}
          initialMessages={initialMessages}
          providerReady={providerReady}
          transport={new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, conversationId, notebookId } }),
          })}
          onBusyChange={onBusyChange}
          onMessagesSynced={onMessagesSynced}
          onError={m => toast.error(m)}
        />
      )}
    />
  );
}
```

**Server tools vs client tools.** Tools with `execute` run on the server (the
default — the route's `streamText` runs them). Tools *without* `execute` are
surfaced to the browser; pass an `onToolCall` to `<ChatSession>` to run them
against live client state (client-side actuation). The same `ToolSet`
supports a mix. See `@coston/agent/react`'s `createLocalTransport` for browser-side
inference against a user's own OpenAI-compatible endpoint.
