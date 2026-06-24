/**
 * The navigable pages, shared by the sidebar nav (`nav.tsx`), the router
 * (`App.tsx`), and the visual spec (`tests/visual.spec.ts`) so the three never
 * drift. Pure data — safe to import from the Playwright (Node) test context.
 *
 * Note: the spec captures a few extra *interaction* states (the panel's open
 * switcher/dialogs) that live on the `/panel` page rather than separate routes.
 */
export interface ViewMeta {
  name: string;
  label: string;
  path: string;
  group: string;
}

export const VIEWS: ViewMeta[] = [
  { group: 'Chat', name: 'chat-conversation', label: 'Conversation', path: '/chat/conversation' },
  { group: 'Chat', name: 'chat-empty', label: 'Empty state', path: '/chat/empty' },
  { group: 'Chat', name: 'chat-not-connected', label: 'Not connected', path: '/chat/not-connected' },
  { group: 'Chat', name: 'chat-image-message', label: 'Image message', path: '/chat/image-message' },
  { group: 'Chat', name: 'chat-attachments', label: 'Attachments', path: '/chat/attachments' },
  { group: 'Tool calls', name: 'chat-tool-running', label: 'Running', path: '/chat/tool-running' },
  { group: 'Tool calls', name: 'chat-tool-done', label: 'Completed', path: '/chat/tool-done' },
  { group: 'Tool calls', name: 'chat-tool-error', label: 'Error', path: '/chat/tool-error' },
  { group: 'Tool calls', name: 'chat-tool-approval', label: 'Approval', path: '/chat/tool-approval' },
  { group: 'Panel', name: 'panel', label: 'Session panel', path: '/panel' },
  { group: 'Provider', name: 'provider-gateway', label: 'Gateway', path: '/provider/gateway' },
  { group: 'Provider', name: 'provider-anthropic', label: 'Anthropic', path: '/provider/anthropic' },
  { group: 'Provider', name: 'provider-openai', label: 'OpenAI', path: '/provider/openai' },
  { group: 'Provider', name: 'provider-local', label: 'Local / compatible', path: '/provider/local' },
  { group: 'Other', name: 'camera', label: 'Camera', path: '/camera' },
];

export const VIEW_GROUPS = [...new Set(VIEWS.map(v => v.group))];
