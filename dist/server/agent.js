import { jsonSchema, tool } from "ai";
//#region src/server/agent.ts
const SKILL_NOT_FOUND = (name, available) => `No skill named "${name}". Available skills: ${available.join(", ") || "(none)"}.`;
function skillsSection(skills) {
	if (skills.length === 0) return "";
	return `\n\n## Skills\nLoad a playbook with the \`load_skill\` tool when its topic comes up:\n${skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")}`;
}
/**
* Define an app-scoped agent from Markdown instructions, a standard tool set, and
* optional Skills — a filesystem-shaped agent definition. Returns
* `{ systemPrompt, tools }` to wire straight into `createChatRoute`. Apps load the
* Markdown however they like (import, fs, inline); this keeps no opinion on the
* filesystem so it stays edge/bundler-safe.
*/
function defineAgent(options) {
	const skills = options.skills ?? [];
	const approvals = new Set(options.approvals ?? []);
	async function systemPrompt(context) {
		const base = typeof options.instructions === "function" ? await options.instructions(context) : options.instructions;
		const dynamic = options.context ? await options.context(context) : "";
		return [
			base.trimEnd(),
			skillsSection(skills),
			dynamic ? `\n\n## Context\n${dynamic}` : ""
		].join("").trimEnd();
	}
	async function tools(context) {
		const appTools = typeof options.tools === "function" ? await options.tools(context) : options.tools ?? {};
		const gated = {};
		for (const [name, t] of Object.entries(appTools)) gated[name] = approvals.has(name) ? {
			...t,
			needsApproval: true
		} : t;
		if (skills.length === 0) return gated;
		const loadSkill = tool({
			description: "Load a skill playbook by name for detailed step-by-step guidance.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { name: {
					type: "string",
					description: "The skill name to load"
				} },
				required: ["name"],
				additionalProperties: false
			}),
			execute: async ({ name }) => {
				return skills.find((s) => s.name === name)?.content ?? SKILL_NOT_FOUND(name, skills.map((s) => s.name));
			}
		});
		return {
			...gated,
			load_skill: loadSkill
		};
	}
	return {
		systemPrompt,
		tools,
		skills
	};
}
//#endregion
export { defineAgent };
