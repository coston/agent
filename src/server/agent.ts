import { jsonSchema, tool, type ToolSet } from 'ai';

/**
 * A Markdown playbook loaded contextually (a progressive-disclosure "skills"
 * pattern). Only the `name` + `description` sit in the system prompt; the full
 * `content` is pulled in on demand via the auto-injected `load_skill` tool —
 * cheap context until the skill is actually needed.
 */
export interface AgentSkill {
  /** Stable id the model passes to `load_skill`. */
  name: string;
  /** One line: when this skill applies (always in the prompt). */
  description: string;
  /** The Markdown playbook, loaded only when requested. */
  content: string;
}

export interface DefineAgentOptions<TContext = void> {
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
export interface CompiledAgent<TContext> {
  systemPrompt: (context: TContext) => Promise<string>;
  tools: (context: TContext) => Promise<ToolSet>;
  skills: AgentSkill[];
}

const SKILL_NOT_FOUND = (name: string, available: string[]) =>
  `No skill named "${name}". Available skills: ${available.join(', ') || '(none)'}.`;

function skillsSection(skills: AgentSkill[]): string {
  if (skills.length === 0) return '';
  const lines = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
  return `\n\n## Skills\nLoad a playbook with the \`load_skill\` tool when its topic comes up:\n${lines}`;
}

/**
 * Define an app-scoped agent from Markdown instructions, a standard tool set, and
 * optional Skills — a filesystem-shaped agent definition. Returns
 * `{ systemPrompt, tools }` to wire straight into `createChatRoute`. Apps load the
 * Markdown however they like (import, fs, inline); this keeps no opinion on the
 * filesystem so it stays edge/bundler-safe.
 */
export function defineAgent<TContext = void>(
  options: DefineAgentOptions<TContext>
): CompiledAgent<TContext> {
  const skills = options.skills ?? [];
  const approvals = new Set(options.approvals ?? []);

  async function systemPrompt(context: TContext): Promise<string> {
    const base =
      typeof options.instructions === 'function'
        ? await options.instructions(context)
        : options.instructions;
    const dynamic = options.context ? await options.context(context) : '';
    return [base.trimEnd(), skillsSection(skills), dynamic ? `\n\n## Context\n${dynamic}` : '']
      .join('')
      .trimEnd();
  }

  async function tools(context: TContext): Promise<ToolSet> {
    const appTools =
      typeof options.tools === 'function' ? await options.tools(context) : (options.tools ?? {});

    // Gate the named tools behind human approval (the AI SDK's `needsApproval`).
    const gated: ToolSet = {};
    for (const [name, t] of Object.entries(appTools)) {
      gated[name] = approvals.has(name) ? { ...t, needsApproval: true } : t;
    }

    if (skills.length === 0) return gated;

    // Progressive-disclosure: one tool that returns a skill's full playbook.
    const loadSkill = tool({
      description: 'Load a skill playbook by name for detailed step-by-step guidance.',
      inputSchema: jsonSchema<{ name: string }>({
        type: 'object',
        properties: { name: { type: 'string', description: 'The skill name to load' } },
        required: ['name'],
        additionalProperties: false,
      }),
      execute: async ({ name }) => {
        const skill = skills.find(s => s.name === name);
        return skill?.content ?? SKILL_NOT_FOUND(name, skills.map(s => s.name));
      },
    });

    return { ...gated, load_skill: loadSkill };
  }

  return { systemPrompt, tools, skills };
}
