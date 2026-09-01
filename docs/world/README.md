<!-- tier: 3 -->

# The World

The setting bible, split by topic. This is canon for the narrator, and it is the reason
the mechanics feel like they mean something. The systems in this engine are not generic
fantasy stats wearing Chinese names - each one is an expression of the world's central
cruelty.

The engineering contracts that implement all of this live next to the code they govern.
Start from [`../../context.md`](../../context.md).

---

## The tier scheme

The world material is far too long to send to a narrator on every turn, and sending an
arbitrary slice of it silently drops something load-bearing. So every section in this
directory carries an explicit tier, marked in the file as a parseable HTML comment
immediately after its heading:

```text
<!-- tier: 1 -->
<!-- tier: 2 trigger="the player is dealing with a sect" -->
<!-- tier: 3 -->
```

| Tier | Meaning | When it is loaded |
|---|---|---|
| **1** | What the narrator cannot function without | **Always.** Every prompt, every turn |
| **2** | Situational world knowledge | When the named trigger is true |
| **3** | Deep lore, historical detail, design rationale | Never auto-injected. Read by humans and by agents doing design work |

A file may carry a default tier at the top and override it per section. A tier-2 marker
without a `trigger` is a bug.

### Tier 1 lives in one file

[`NARRATOR-CORE.md`](NARRATOR-CORE.md) is the assembled Tier-1 text, maintained as a
single file so a prompt builder can load one path rather than reassembling fragments. It
is deliberately short enough to paste into every prompt without thought.

Sections elsewhere that contributed to it are marked `<!-- tier: 1 -->` so the lineage is
traceable, but **`NARRATOR-CORE.md` is the copy that ships.** Edit it directly when the
core changes, and keep the contributing sections in step.

`src/web/prompt.ts` currently hand-maintains its own compression of the bible. It should
converge on `NARRATOR-CORE.md`.

---

## The files

| File | Covers | Default tier |
|---|---|---|
| [`NARRATOR-CORE.md`](NARRATOR-CORE.md) | The always-loaded core: authority, permadeath, qi, register | 1 |
| [`qi.md`](qi.md) | Qi, spiritual veins, regional density, thin-region ceilings, contested qi, spirit stones | 1 and 2 |
| [`the-late-age.md`](the-late-age.md) | The aged world, depletion and monopoly, ruins, what survives, the texture to aim for | 2 |
| [`ancient.md`](ancient.md) | Authoring guide: the ancient tier. Modern is elemental and ancient is categorical; the three kinds of absence; what an ancient art costs and who can pay it; the thousand-year medicine | 2 |
| [`ruins.md`](ruins.md) | Authoring guide: ruins. The four axes (who left it, how gone-over, how long ago, who holds the door); convergence and the self-cancelling escape; loot as a record rather than a table; access; why a stripped ruin still teaches; mechanics that change the terms | 2 |
| [`techniques.md`](techniques.md) | What an art can DO, by height: the ladder that escalates in kind rather than magnitude, ending in causal speech; how it composes with class and era; dormant archives; what runs out | 2 |
| [`sects.md`](sects.md) | Sects as political institutions, factions, succession, ancestral records, dormant and ascended ancestors, the standing powers | 2 |
| [`dao-houses.md`](dao-houses.md) | The ancient houses, specialisation without ownership, civil authority, counters and blind spots, rewritten histories | 2 |
| [`economy.md`](economy.md) | Scarcity, resources, spirit stones, provenance, possession and ownership and claim, trade, graves, inheritances | 2 |
| [`immortals.md`](immortals.md) | The Immortal World as a place, ascension, what immortals leave behind, what crosses the Lid, immortal lineages | 2 |
| [`people.md`](people.md) | NPCs as protagonists of their own lives, personality, prodigies, goals, morality, characters persisting after being surpassed | 2 |
| [`tone.md`](tone.md) | The narrator's register, what to do and avoid, naming conventions, what makes a run interesting | 1 and 3 |
| [`understanding.md`](understanding.md) | Understanding as an axis distinct from accumulation, and what separates two cultivators at the same rank | not yet marked |
| [`making-places-different.md`](making-places-different.md) | Authoring guide: how to keep regions and factions from being interchangeable | not yet marked |

The last two arrived from a parallel workstream and do not yet carry tier markers. They
should be marked before any prompt builder starts selecting on tier.

---

## Where the mechanics live

Design docs sit next to the code they govern. When the lore says something must be true,
the file that makes it true is usually one of these:

| Doc | Governs |
|---|---|
| [`../../src/engine/README.md`](../../src/engine/README.md) | Implementation philosophy, the five pillars |
| [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) | The realm ladder, talent, breakthrough, the price of advancement, existence states, death |
| [`../../src/engine/world/README.md`](../../src/engine/world/README.md) | Places, capability predicates, opportunity windows, history, lineage, time |
| [`../../src/engine/social/README.md`](../../src/engine/social/README.md) | Relationships, grudges, belief, secrets, karma as a graph |
| [`../../src/data/cultivation/README.md`](../../src/data/cultivation/README.md) | The content catalogs and how they are authored |
| [`../../src/web/README.md`](../../src/web/README.md) | The narrator's three-phase split and the authority boundary in code |
| [`../../src/agent/provider/README.md`](../../src/agent/provider/README.md) | Provider abstraction and config precedence |
| [`../../src/storage/README.md`](../../src/storage/README.md) | Migrations and repository conventions |

---

## A note on numbers

Do not quote counts in these files - not the number of ranks on the ladder, not the number
of sects, techniques or pills. They change, and a number written into prose goes stale
silently while reading as though it were checked. Say "the full ladder", "the top of the
ladder", "the catalog". `MAX_ORDINAL` in `src/engine/cultivation/realms.ts` is the
authority on the ladder's bounds; the catalogs are the authority on their own size.

- [discovery.md](discovery.md) - how the player learns the world is bigger than they thought, and the rule that the narrator may never name what the player has not heard of.
- [asking.md](asking.md) - who you ask and what you say; genuine ignorance versus deflection, the right words, and why the player rather than the character is what improves across runs.
- [origin.md](origin.md) - where you were born and what it was worth; privilege buys inputs and never rank, and the children of great houses mostly fail anyway.
- [escapes.md](escapes.md) - what a capped cultivator does next; the nine routes past a manual's ceiling, who each one is open to, and what every layer must supply to make them playable.
