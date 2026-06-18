import { ToolSet } from "ai";

//#region src/server/agent.d.ts

/**
 * A Markdown playbook loaded contextually (a progressive-disclosure "skills"
 * pattern). Only the `name` + `description` sit in the system prompt; the full
 * `content` is pulled in on demand via the auto-injected `load_skill` tool —
 * cheap context until the skill is actually needed.
 */
interface AgentSkill {
  /** Stable id the model passes to `load_skill`. */
  name: string;
  /** One line: when this skill applies (always in the prompt). */
  description: string;
  /** The Markdown playbook, loaded only when requested. */
  content: string;
}
interface DefineAgentOptions<TContext = void> {
  /** Base instructions (Markdown) — a string or a function of the per-request context. */
  instructions: string | ((context: TContext) => string | Promise<string>);
  /** The app's tools (a standard AI SDK `ToolSet`). May depend on context. */
  tools?: ToolSet | ((context: TContext) => ToolSet | Promise<ToolSet>);
  /** Markdown skill playbooks — advertised in the prompt, loaded via `load_skill`. */
  skills?: AgentSkill[];
  /** Tool names that require human approval before executing (sets `needsApproval`). */
  approvals?: string[];
  /** Extra dynamic context appended to the prompt (e.g. a live app-state snapshot). */
  context?: (context: TContext) => string | Promise<string>;
}
/** A compiled agent: a prompt builder + tool builder ready to hand to `createChatRoute`. */
interface CompiledAgent<TContext> {
  systemPrompt: (context: TContext) => Promise<string>;
  tools: (context: TContext) => Promise<ToolSet>;
  skills: AgentSkill[];
}
/**
 * Define an app-scoped agent from Markdown instructions, a standard tool set, and
 * optional Skills — a filesystem-shaped agent definition. Returns
 * `{ systemPrompt, tools }` to wire straight into `createChatRoute`. Apps load the
 * Markdown however they like (import, fs, inline); this keeps no opinion on the
 * filesystem so it stays edge/bundler-safe.
 */
declare function defineAgent<TContext = void>(options: DefineAgentOptions<TContext>): CompiledAgent<TContext>;
//#endregion
export { AgentSkill, CompiledAgent, DefineAgentOptions, defineAgent };