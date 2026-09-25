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

Its links rot on purpose and are not maintained: several of these documents point at
D&D-era modules the fork deleted (`schema/spell.ts`, `engine/magic/spell-resolver.ts`,
`consolidated/party-manage.ts`). The link checker skips this directory for that reason.

Four documents that came with the fork have been REMOVED rather than left to rot: two
engineering specs and two publishing specs, all of which named a third-party franchise
the design here has nothing to do with. They are in the history of the repository this
one was forked from, which is where they came from and where they belong.

| file | what it is |
|---|---|
| `00-campaign-bible.md` | the D&D campaign's setting bible |
| `01-sebastopyr-etymology.md` | naming for that campaign |
| `03-resolved-decisions.md` | decisions taken during that design |
| `04-world-brief.md` | the brief for that campaign |
| `06-honest-crunch-positioning.md` | where that design sat on crunch |
| `07-competency-mapping.md` | the model-competency ladder, which `config/competency-ladder.json` still uses |
| `SPEC.md`, `bastion-*.md`, `rpg-mcp-bootstrap.json` | what remains of the kickoff material |

---

## Where else to look

- [`../world/README.md`](../world/README.md) - the canon that replaced this. If a page here
  and a page there disagree, the world bible wins and this one is simply old.
- [`../../src/README.md`](../../src/README.md) - the code index, including which directories
  are retained substrate rather than cultivation code
  ([`spatial/`](../../src/engine/spatial/README.md),
  [`perception/`](../../src/engine/perception/README.md),
  [`server/handlers/`](../../src/server/handlers/README.md)). Those three are the live remainder
  of what this directory documents. The D&D-era `strategy/` module was removed.
- [`../../AGENTS.md`](../../AGENTS.md) - the rule about deleting an example once the thing it
  named has moved. Most of what is here is that, at directory scale.

