import type { UIMessage } from 'ai';
import type {
  CachedMessage,
  ChatSessionSummary,
  SessionController,
} from '@coston/agent/react';
import type { ProviderSetting } from '@coston/agent/react';

/**
 * Crafted UIMessages, one set per renderable state. Typed loosely and cast to
 * `UIMessage[]` — the renderer reads parts structurally, and tool/approval parts
 * use the dynamic `tool-${name}` shape the AI SDK streams at runtime.
 */
const msg = (m: { id: string; role: string; parts: unknown[] }) => m as unknown as UIMessage;

// A small inline SVG so the image-message view has something legible to capture
// without depending on a network asset.
const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/>
       </linearGradient></defs>
       <rect width="320" height="200" fill="url(#g)"/>
       <text x="160" y="108" font-family="sans-serif" font-size="20" fill="white"
         text-anchor="middle">sunset.png</text>
     </svg>`
  );

export const conversationMessages: UIMessage[] = [
  msg({ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'What can you help me with?' }] }),
  msg({
    id: 'm2',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text:
          'I can help with a few things:\n\n' +
          '- **Answer questions** about your workspace\n' +
          '- **Run tools** on your behalf\n' +
          '- Summarize long documents\n\n' +
          'Just ask me anything to get started.',
      },
    ],
  }),
  msg({ id: 'm3', role: 'user', parts: [{ type: 'text', text: 'Great — summarize the latest report.' }] }),
];

export const imageMessages: UIMessage[] = [
  msg({
    id: 'i1',
    role: 'user',
    parts: [
      { type: 'text', text: 'Here is the photo from yesterday.' },
      { type: 'file', url: SAMPLE_IMAGE, mediaType: 'image/svg+xml', filename: 'sunset.png' },
    ],
  }),
  msg({
    id: 'i2',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Nice shot — warm gradient, looks like a sunset over water.' }],
  }),
];

export const toolRunningMessages: UIMessage[] = [
  msg({ id: 't1', role: 'user', parts: [{ type: 'text', text: 'Add milk and eggs to my list.' }] }),
  msg({
    id: 't2',
    role: 'assistant',
    parts: [{ type: 'tool-add_items', state: 'input-available', toolCallId: 'c1', input: { items: ['milk', 'eggs'] } }],
  }),
];

export const toolDoneMessages: UIMessage[] = [
  msg({ id: 'd1', role: 'user', parts: [{ type: 'text', text: 'Add milk and eggs to my list.' }] }),
  msg({
    id: 'd2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-add_items',
        state: 'output-available',
        toolCallId: 'c1',
        input: { items: ['milk', 'eggs'] },
        output: 'Added 2 items to your shopping list.',
      },
    ],
  }),
];

export const toolErrorMessages: UIMessage[] = [
  msg({ id: 'e1', role: 'user', parts: [{ type: 'text', text: 'Add milk and eggs to my list.' }] }),
  msg({
    id: 'e2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-add_items',
        state: 'output-error',
        toolCallId: 'c1',
        input: { items: ['milk', 'eggs'] },
        errorText: 'The list service timed out. Please try again.',
      },
    ],
  }),
];

export const toolApprovalMessages: UIMessage[] = [
  msg({ id: 'a1', role: 'user', parts: [{ type: 'text', text: 'Delete the archived projects.' }] }),
  msg({
    id: 'a2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-approval-request',
        approvalId: 'ap1',
        toolCall: { toolName: 'delete_projects' },
      },
    ],
  }),
];

export const SUGGESTIONS = [
  'Summarize my latest document',
  'What changed this week?',
  'Draft a reply to the last message',
];

// ── ChatPanel fixtures ────────────────────────────────────────────────────────

export const panelConversations: ChatSessionSummary[] = [
  { id: 'conv-1', title: 'Q3 planning notes' },
  { id: 'conv-2', title: 'Bug triage' },
  { id: 'conv-3', title: 'Onboarding checklist' },
];

export const panelInitialMessages: CachedMessage[] = conversationMessages.map(m => ({
  id: m.id,
  role: m.role,
  parts: m.parts,
}));

/** A SessionController whose mutations are no-ops — the panel never persists in the demo. */
export const mockSessions: SessionController = {
  async create() {
    return { id: 'conv-new', title: 'New chat' };
  },
  async rename(id, title) {
    return { id, title };
  },
  async remove() {},
  async loadMessages() {
    return panelInitialMessages;
  },
};

// ── ProviderForm fixtures ─────────────────────────────────────────────────────

export const providerSettings: Record<string, ProviderSetting> = {
  gateway: { provider: 'gateway', model: 'anthropic/claude-sonnet-4.6', hasKey: true, baseUrl: null },
  anthropic: { provider: 'anthropic', model: 'claude-sonnet-4-6', hasKey: true, baseUrl: null },
  openai: { provider: 'openai', model: 'gpt-5.1', hasKey: false, baseUrl: null },
  local: { provider: 'openai_compatible', model: 'llama3.1', hasKey: false, baseUrl: 'http://localhost:11434/v1' },
};
