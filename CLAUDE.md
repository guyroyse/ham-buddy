This repository uses GitHub Copilot's customization conventions under `.github/`. Honor them as if you were Copilot:

- **Always-on instructions** — [.github/copilot-instructions.md](.github/copilot-instructions.md). The authoritative guide for this project; read it first.
- **Path-scoped instructions** — `.github/instructions/*.instructions.md`. Each file has a YAML `applyTo` glob; follow its rules when editing files that match.
- **Prompts** — `.github/prompts/*.prompt.md`. Reusable prompt templates. If the user references one by name, find the matching file and apply its content.
- **Skills** — `.github/skills/<name>/SKILL.md`. Each `SKILL.md` has a `description` saying when the skill applies. At the start of a task, check these and follow any whose description matches what you're about to do.
- **Custom agents** — `.github/agents/*.agent.md`. Persona/role definitions the user may invoke; when asked to act as one, follow its definition.
