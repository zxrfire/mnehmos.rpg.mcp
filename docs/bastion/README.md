<!-- tier: 3 -->

# Bastion - pre-fork D&D material

**This directory is legacy and is not canon for the cultivation engine.**

It is the campaign and design material from the D&D 5e project this repository was forked
from, kept because some of it records decisions the substrate still reflects - the tool
surface, the consolidated-handler shape, the competency ladder.

**Do not treat anything here as a statement about the current world.** The setting is
xianxia; canon lives in [`../world/`](../world/) and the engineering contracts live beside
the code they govern. Where this material and `docs/world/` disagree, `docs/world/` is
right and this is history.

Its links rot on purpose and are not maintained: `05-world-brief-vs-tool-surface.md` points
at D&D-era modules the fork deleted (`schema/spell.ts`, `engine/magic/spell-resolver.ts`,
`consolidated/party-manage.ts`) and at a different project on the author's disk. The
link checker skips this directory for that reason.

| file | what it is |
|---|---|
| `00-campaign-bible.md` | the D&D campaign's setting bible |
| `01-sebastopyr-etymology.md` | naming for that campaign |
| `02-engine-integration-spec.md` | how the campaign was to reach the engine |
| `03-resolved-decisions.md` | decisions taken during that design |
| `04-world-brief.md`, `05-world-brief-vs-tool-surface.md` | the brief, and its gap analysis against the tools of the time |
| `06-honest-crunch-positioning.md` | where that design sat on crunch |
| `07-competency-mapping.md` | the model-competency ladder, which `config/competency-ladder.json` still uses |
| `SPEC.md`, `bastion-*.md`, `rpg-mcp-bootstrap.json` | the deliverables and kickoff material |
