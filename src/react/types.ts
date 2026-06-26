import type { ComponentType, ReactNode } from 'react';

/** The lifecycle states a tool part moves through in a UIMessage. */
export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error';

/**
 * A message in the AI SDK `UIMessage` shape — only the fields the renderer reads.
 * Kept structural so any app's `UIMessage<…>` type satisfies it.
 */
export interface AgentUIMessage {
  id: string;
  role: string;
  parts: readonly unknown[];
}

/** Per-tool display override, keyed by tool name (e.g. `"run_task"`). */
export interface ToolRenderer {
  /** Label shown while running (`"{label}…"`) and when complete (`"{label}"`). */
  label: string;
  /** Optional leading icon (e.g. a lucide icon). */
  icon?: ComponentType<{ className?: string }>;
  /**
   * Optional custom renderer for the tool's output. Receives the raw output
   * (the tool's return value, type `unknown`) and the original tool-call `input`
   * (so an output can be shown alongside what was requested), and returns the
   * expanded body. When omitted, output is rendered as markdown (strings) or a
   * JSON code block (objects). Use this to turn structured output into rich UI.
   */
  render?: (output: unknown, input?: unknown) => ReactNode;
  /** Show this tool's output expanded by default instead of collapsed. */
  defaultExpanded?: boolean;
  /**
   * Optional custom body for a needs-approval tool call (the AI SDK
   * `needsApproval` flow). Receives the proposed tool-call `input` plus
   * `approve`/`deny` callbacks, and returns the full card body — replacing the
   * default "Approve {label}?" prompt AND its buttons. Use this to preview a
   * batch/plan and let the user accept or send it back for changes. When
   * omitted, the default approval prompt is shown.
   */
  renderApproval?: (ctx: {
    input: unknown;
    approve: () => void;
    deny: () => void;
  }) => ReactNode;
}
