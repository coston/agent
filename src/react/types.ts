import type { ComponentType, ReactNode } from 'react';

/** The lifecycle states a tool part moves through in a UIMessage. */
export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
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
   * (the tool's return value, type `unknown`) and returns the expanded body.
   * When omitted, output is rendered as markdown (strings) or a JSON code
   * block (objects). Use this to turn structured output into rich UI.
   */
  render?: (output: unknown) => ReactNode;
}
