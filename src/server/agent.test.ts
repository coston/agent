import { describe, expect, it } from 'vitest';
import { jsonSchema, tool, type ToolSet } from 'ai';
import { defineAgent } from './agent';

const appTools: ToolSet = {
  delete_item: tool({
    description: 'Delete an item',
    inputSchema: jsonSchema<{ id: string }>({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    }),
    execute: async () => 'deleted',
  }),
};

const skills = [
  { name: 'onboarding', description: 'When a new item is created', content: '# Onboarding\n1. First step' },
];

async function callExecute(tools: ToolSet, name: string, input: unknown): Promise<unknown> {
  const exec = tools[name]?.execute;
  if (!exec) throw new Error(`tool ${name} has no execute`);
  return exec(input as never, {} as never);
}

describe('defineAgent', () => {
  it('composes instructions, a skills section, and dynamic context', async () => {
    const agent = defineAgent<{ workspace: string }>({
      instructions: 'You are a copilot.',
      skills,
      context: ctx => `Active workspace: ${ctx.workspace}`,
    });
    const prompt = await agent.systemPrompt({ workspace: 'w1' });
    expect(prompt).toContain('You are a copilot.');
    expect(prompt).toContain('## Skills');
    expect(prompt).toContain('- onboarding: When a new item is created');
    expect(prompt).toContain('## Context\nActive workspace: w1');
  });

  it('omits the skills section and load_skill tool when there are no skills', async () => {
    const agent = defineAgent({ instructions: 'hi', tools: appTools });
    expect(await agent.systemPrompt()).not.toContain('## Skills');
    const tools = await agent.tools();
    expect(tools.load_skill).toBeUndefined();
    expect(tools.delete_item).toBeDefined();
  });

  it('injects a load_skill tool that returns playbook content on demand', async () => {
    const agent = defineAgent({ instructions: 'hi', skills });
    const tools = await agent.tools();
    expect(tools.load_skill).toBeDefined();
    expect(await callExecute(tools, 'load_skill', { name: 'onboarding' })).toContain('First step');
    expect(await callExecute(tools, 'load_skill', { name: 'nope' })).toContain('No skill named "nope"');
  });

  it('gates named tools behind approval', async () => {
    const agent = defineAgent({ instructions: 'hi', tools: appTools, approvals: ['delete_item'] });
    const tools = await agent.tools();
    expect(tools.delete_item?.needsApproval).toBe(true);
  });

  it('supports instructions as a function of context', async () => {
    const agent = defineAgent<{ role: string }>({
      instructions: ctx => `Role: ${ctx.role}`,
    });
    expect(await agent.systemPrompt({ role: 'owner' })).toContain('Role: owner');
  });
});
