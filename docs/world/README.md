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
| [`qi.md`](qi.md) | Qi, spiritual veins, regional density, thin-region ceilings, contested qi, spirit stones | 1, 2 and 3 |
| [`the-late-age.md`](the-late-age.md) | The aged world, depletion and monopoly, ruins, what survives, the texture to aim for | 2 and 3 |
| [`ancient.md`](ancient.md) | Authoring guide: the ancient tier. Modern is elemental and ancient is categorical; the three kinds of absence; what an ancient art costs and who can pay it; the thousand-year medicine | 2 and 3 |
| [`ruins.md`](ruins.md) | Authoring guide: ruins. The four axes (who left it, how gone-over, how long ago, who holds the door); convergence and the self-cancelling escape; loot as a record rather than a table; access; why a stripped ruin still teaches; mechanics that change the terms | 2 and 3 |
| [`architecture.md`](architecture.md) | Built places: what a compound is generated from, precincts and rooms, house style as an archaeological fingerprint, access as a chain of gates, and what knowing a room means. Also the authoring guide for adding one | 2 and 3 |
| [`techniques.md`](techniques.md) | What an art can DO, by height: the ladder that escalates in kind rather than magnitude, ending in causal speech; how it composes with class and era; dormant archives; what runs out | 1, 2 and 3 |
| [`manuals.md`](manuals.md) | Books as items with a count: who can copy one, where a manual stops, the shelf a disciple climbs, what a house can teach against what it can supply, and an art as a signature | 2 and 3 |
| [`sects.md`](sects.md) | Sects as political institutions, factions, succession, ancestral records, dormant and ascended ancestors, the standing powers | 2 and 3 |
| [`dao-houses.md`](dao-houses.md) | The ancient houses, specialisation without ownership, civil authority, counters and blind spots, rewritten histories | 2 and 3 |
| [`economy.md`](economy.md) | Scarcity, resources, spirit stones, provenance, possession and ownership and claim, trade, graves, inheritances | 2 and 3 |
| [`items.md`](items.md) | Every object that can be held: counted against tracked, what money cannot buy, why a holder keeps what they cannot use, spent rows, possession as a signature | 2 and 3 |
| [`immortals.md`](immortals.md) | The Immortal World as a place, ascension, what immortals leave behind, what crosses the Lid, immortal lineages | 2 and 3 |
| [`people.md`](people.md) | NPCs as protagonists of their own lives, personality, prodigies, goals, morality, characters persisting after being surpassed | 2 and 3 |
| [`tone.md`](tone.md) | The narrator's register, what to do and avoid, naming conventions, what makes a run interesting | 1 and 3 |
| [`understanding.md`](understanding.md) | Understanding as an axis distinct from accumulation, personal realms, achievements, visions, and what separates two cultivators at the same rank | 2 and 3 |
| [`discovery.md`](discovery.md) | How the player learns the world is bigger than they thought, and the rule that the narrator may never name what the player has not heard of | 2 and 3 |
| [`asking.md`](asking.md) | Who you ask and what you say; genuine ignorance versus deflection, and why the player rather than the character is what improves across runs | 2 and 3 |
| [`origin.md`](origin.md) | Where you were born and what it was worth; privilege buys inputs and never rank | 2 and 3 |
| [`past-the-ceiling.md`](past-the-ceiling.md) | What a capped cultivator does next: the routes past a manual's ceiling, who each is open to, and what every layer must supply | 2 and 3 |
| [`making-places-different.md`](making-places-different.md) | Authoring guide: how to keep regions and factions from being interchangeable | 3 |
| [`capability-gaps-by-realm.md`](capability-gaps-by-realm.md) | Design audit: the six capability questions answered for every realm, measured against the code, with what is built, what is indirect and what is absent; the same test applied to the four attributes | 3 |

Every file carries markers at section level, so a prompt builder may select on tier and
take paragraphs rather than files. A tier-2 section without a `trigger` is a bug; the
triggers themselves are the routing table below.

---

## Which file for which scene

**Route in two hops, never one.** The scene picks a *hub*; the hub's own section triggers
pick the paragraphs. Loading a whole hub file to answer one question is the failure this
scheme exists to prevent. Measured across this directory: **1,700 words are tier 1,**
**33,200 are tier 2, and 12,800 are tier 3 that is never injected** - and the largest
single hub is over 6,000 words. A scene should cost a few hundred.

Every hub below is cut into tier-2 sections with their own `trigger`. Read the hub's
markers and take the sections that match; do not take the file.

**Hop two is visible in the file itself.** Every hub carries a `## Sections` table
immediately under its heading: each section, and the scene it loads on. That table is
tier 3 and is never injected - it exists so a human, or an agent adding content, can
read the routing the markers encode without parsing them.

### Hop one: where is the player, and what are they doing

The place hierarchy is the spine, because most scenes are somewhere before they are
anything else. Descend it until the rows stop applying.

| Where they are | Hub |
|---|---|
| **The world at large** - a region, its ground, why cultivation goes well or badly here | [`qi.md`](qi.md) |
| **A settlement** - a city, a town, a market, anywhere people simply live | [`economy.md`](economy.md), [`architecture.md`](architecture.md) |
| **A sect or house** - its politics, its ladder, who it answers to | [`sects.md`](sects.md) |
| **A Dao house** - karma, oaths, names, or space invoked as authority | [`dao-houses.md`](dao-houses.md) |
| **Inside a built place** - a gate, a hall, a compound, somebody's residence | [`architecture.md`](architecture.md) |
| **A ruin, sealed site, or convergence** | [`ruins.md`](ruins.md) |
| **Above the Lid** | [`immortals.md`](immortals.md) |

### Hop two: what is actually happening there

These cut across place. A scene commonly takes one row from each table.

| What is happening | Hub |
|---|---|
| **Any turn at all** | [`NARRATOR-CORE.md`](NARRATOR-CORE.md), always |
| A run begins, or somebody's birth starts to matter | [`origin.md`](origin.md) |
| The player asks somebody a question | [`asking.md`](asking.md) |
| The player hears of something they have never met | [`discovery.md`](discovery.md) |
| An NPC is present, remembered, or being reasoned about | [`people.md`](people.md) |
| An art is used, taught, refused, or compared | [`techniques.md`](techniques.md) |
| A book is held, copied, bought, refused, or stolen | [`manuals.md`](manuals.md) |
| Nobody present recognises what somebody is practising | [`ancient.md`](ancient.md) |
| The player has run out of manual | [`past-the-ceiling.md`](past-the-ceiling.md) |
| Two people of the same rank are not equally dangerous | [`understanding.md`](understanding.md) |
| Something old, inherited, or built by somebody else is described | [`the-late-age.md`](the-late-age.md) |
| Ownership, price, or provenance is disputed | [`economy.md`](economy.md) |
| An object changes hands, is copied, spent, hidden, or refused; or somebody asks how many exist | [`items.md`](items.md) |
| The narrator is unsure how much to say, or in what voice | [`tone.md`](tone.md) |
| A house's standing, ancestry, succession, or vault is in question | [`sects.md`](sects.md) |
| A consequence arrives and nobody can trace where it came from | [`dao-houses.md`](dao-houses.md) |
| Ascension, the Lid, or an ascended ancestor is raised | [`immortals.md`](immortals.md) |

### Never routed to a scene

Tier 3 is for humans and for agents adding content. It is never injected:

- [`making-places-different.md`](making-places-different.md) - before writing a new region
  or faction, so the next one is not the last one with the nouns swapped.
- [`capability-gaps-by-realm.md`](capability-gaps-by-realm.md) - before adding anything to a
  realm, so the addition is a decision rather than a multiplier, and so it is not something
  the engine already does under another name.
- [`architecture.md`](architecture.md) - its authoring sections, before writing a new
  compound. Its descriptive sections are tier 2 and do route.

[`ancient.md`](ancient.md) and [`architecture.md`](architecture.md) are both kinds at once:
authoring guides whose sections carry their own tier-2 triggers, because the material they
govern also has to reach the table.

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
