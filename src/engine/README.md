<!-- tier: 3 -->

# The Engine

> **Tier 3 - reference.** Design rationale for the code beside it. Never auto-injected
> into a narration prompt. The narrator's always-loaded text is
> [`../../docs/world/NARRATOR-CORE.md`](../../docs/world/NARRATOR-CORE.md).

The architectural constraint that governs every subdirectory here, and what each
subsystem is *for*. Read this before adding a system, and especially before adding a
simulation loop.

The one rule above it is in [`../../context.md`](../../context.md): the AI narrates, the
engine decides.

---

## What the simulation is for

The charter's question is not "how do we make the player feel like the hero of a
cultivation epic" but:

> **What systems must exist for lives like that to emerge on their own?**

We are not scripting arcs. We are building a simulation whose ordinary operation produces
them. Success looks like the engine generating, without anyone authoring it: an
untalented person who becomes terrifying through persistence; a prodigy who dies at
twenty-three; a genius who is crippled and has to find another path; a weak cultivator
who wins by preparation and poison; someone who spends forty years on a single goal;
someone who outlives everyone they loved; a grudge that survives three generations; a
sect that rises and falls while the player is in seclusion.

No single outcome may be guaranteed. Including the good ones. The priority order that
resolves conflicts between these goals is in
[`../../context.md`](../../context.md).

---

## Implementation philosophy: small code, intelligent agent

**Do not build a giant simulation engine.** This is a hard architectural constraint, not a
preference.

- **The LLM is the reasoning engine.**
- **The database is the source of truth.**
- **The code provides: persistence, retrieval, time, randomness, state updates.** That is
  close to all of it.

Explicitly do NOT implement: behaviour trees for every NPC, a full political simulation, a
physics engine, or mathematically resolved combat for every interaction. Do not build a
deterministic NPC-behaviour simulator.

### The split

| Hard state - the database owns it | Narrative reasoning - the LLM owns it |
|---|---|
| Current date | Why someone acted |
| Character location, realm, inventory | What someone might do next |
| Resources, faction membership | Whether a person is trustworthy |
| Important relationships | How a faction responds |
| Major world events, persistent memories | What a character feels |

The agent must not casually invent anything in the left column. When unsure, it **queries
state** rather than inventing it. Everything in the right column is the agent's job, and
should not be reduced to a computed score.

**Randomness is engine-owned.** The agent requests a roll and the engine returns it, so
the agent can never unconsciously choose the result it wants. Randomness influences
encounters, opportunities, discoveries, accidents, weather, NPC decisions and cultivation
events - but never replaces causal reasoning. Every stochastic system draws from the run
seed through a named sub-stream, so a run is reproducible and adding a system does not
invalidate old replays.

### State stays small

Store durable facts, not every thought an NPC ever had. For an NPC this is enough:

```text
identity | cultivation | location | faction | goals
important relationships | important history | important memories
```

From that, the agent reconstructs believable behaviour. Factions similarly need only:
`name, leaders, territory, resources, allies, enemies, goals, internal conflicts`.

**Memory compresses.** A hundred accumulated events become five to ten durable memories,
preserving relationships, betrayals, promises, debts, major discoveries, major losses,
important history and faction changes, and discarding conversational trivia. The engine
chooses what may be compressed and refuses to lose a betrayal, a promise or a debt; the
LLM writes the summaries.

The lore may be enormous; the running state must not be. Keep detailed state only for
**currently relevant locations, discovered locations, important NPCs, known factions,
important historical events, discovered worlds, active portals, and persistent player
relationships.** Everything else stays abstract until something makes it real, at which
point it is generated and *then* persisted - so it is stable and consistent forever after,
but cost nothing until someone looked. This is what lets the world be effectively
unbounded while the simulation stays small.

### Situations, not quests

Never generate `"collect ten herbs"`. Generate *circumstances* and let conflict emerge:

```text
an NPC needs a rare herb + three factions want it + the NPC owes a debt to one of them
  + the player can reach the region + another faction offers payment
  + the player knows something the NPC does not
  = a situation with no clean answer
```

The system generates conditions. The story is what happens in them.

---

## The five pillars

The design charter governs *what the simulation must be capable of*. These five pillars
say what each part of it is **for**. They pull in different directions on purpose, and a
design decision that serves one at the total expense of another is usually wrong.

| Pillar | The question it answers |
|---|---|
| **Cost** | What cultivation does to a *person* - what it takes out of them to climb |
| **Scale** | What cultivation does to the *universe* - how the world keeps getting bigger |
| **Survival** | What it *feels like* to live inside it day to day - logistics, scarcity, fear |
| **Strategy** | Why people behave *strategically* inside it - incentives, schemes, preparation |
| **Attachment** | Why relationships stay load-bearing despite all of the above |

Where each currently lives:

- **Cost** and **Survival**: [`cultivation/README.md`](cultivation/README.md) - the Price
  of Advancement, the injury ratchet, satiety, settling, permadeath.
- **Attachment**: [`social/README.md`](social/README.md) - grudges, gratitude, inherited
  consequence.
- **Strategy**: [`social/README.md`](social/README.md) and
  [`../../docs/world/houses/sects.md`](../../docs/world/houses/sects.md) - incentive-driven betrayal,
  imperfect information, sect politics.
- **Scale**: [`world/README.md`](world/README.md). This is the pillar a realm ladder alone
  does not deliver, and the world layer's answer to it is *depth, not size*.

---

## Subsystems

| Directory | What it owns | Doc |
|---|---|---|
| `cultivation/` | The realm ladder, talent, progress, breakthrough, the price of advancement, existence states, death | [README](cultivation/README.md) |
| `world/` | Places, capability predicates, opportunity windows, history, lineage, possessions, time | [README](world/README.md) |
| `social/` | Relationships, obligations, knowledge and belief, secrets | [README](social/README.md) |
| `spatial/` | Grid, collision, movement | retained substrate |
| `worldgen/` | Procedural generation | retained substrate |
| `strategy/` | Nation simulation | retained substrate |
| `perception/` | The Operator's constraint-perception lens | see `data/subsystems/` |

The retained substrate came from the D&D 5e engine this repo was forked from. It is sound
engineering and is kept; the game-facing surface above it is what has been replaced.

`combat/` and `magic/` are gone. Spellcasting, spell slots, concentration, scrolls and auras
described a game this engine no longer runs, and the D&D combat engine went with them. Combat is
now `cultivation/combat.ts` - the categorical realm gap, composite power, upsets that have to be
paid for, and the two traditions' different answers to being killed.
