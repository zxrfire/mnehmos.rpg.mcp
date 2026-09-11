# Context - What This Repository Is

The entry point. What the repo is, the rule that governs everything, how the runtime agent
is wired, and where every other document lives. Everything else has been split into files
that sit next to the code they govern - see [where everything lives](#where-everything-lives)
at the bottom.

## Purpose

A **deterministic cultivation (xianxia) RPG engine** exposed over MCP, designed to be
driven by an LLM runtime agent that narrates but never decides.

This repo was forked from a D&D 5e MCP game engine and is being transformed into a
cultivation game in the spirit of the xianxia genre: a text-first cultivation roguelike
with permanent death, an ordinal realm ladder, fixed innate talent, and a survival layer
(satiety, meridian injuries, lifespan, qi deviation) that makes most runs end badly.

The design is an amalgamation drawn from across the genre - progression ladders,
talent systems, survival pressures and tone are synthesised from many sources rather
than modelled on any single one, and the setting, mechanics and text are original.

The D&D *substrate* - dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime - is sound engineering and is retained. What is replaced is
the entire game-facing surface:

| D&D concept | Cultivation replacement |
|---|---|
| Character level 1-20 | Realm ordinal, `0..MAX_ORDINAL` |
| Class | Spirit root (rolled once, permanent) |
| Ability scores (STR/DEX/CON/INT/WIS/CHA) | Innate attributes: Might, Insight, Fortune, Charm |
| Spells / spell slots | Techniques (arts) / qi pool |
| Gold, silver, copper | Spirit stones |
| XP | Cultivation progress |
| Long rest | Seclusion / meditation |
| Death saves, revival | **Permanent death** - no reload, run is over |

`src/engine/cultivation/realms.ts` is the single authority on the ladder's bounds. Do not
restate the number of ranks in prose anywhere: it goes stale silently, and it has before.

### The Immortal realm is a place, not a rank band

The top of the ladder is not more of the same ladder. The Immortal realm is somewhere the
cultivator physically is, on the far side of the Lid, and what is there is other immortals
and immortal beasts - not the province they came from.

This has consequences the code must honour, and some of them were being got wrong:

- **A True Immortal is not in the mortal world.** They are not standing in a town, they
  cannot be hired, sold to, spoken with or bargained with, because none of those things
  has anybody on the other end of it. Coming back down is possible and it is the most
  expensive act in the setting - `evaluateLidTransit` prices a descent at nine strikes of
  the heaviest tribulation there is, and it buys ten or fifteen breaths. It is not the
  default state of a run. `GameService` gates the mortal-world actions on
  `canExistBeyondTheLid` for exactly this reason.
- **A False Immortal is.** They came out over the Lid rather than through it, and they are
  still here, walking around, for a vast and finite span. Everything the mortal world does
  still applies to them - they are simply the strongest thing in it.
- **Nothing up there is denominated in qi.** `progressRequiredForOrdinal` returns `null` at
  both rungs on purpose. Immortal qi is not the mortal currency and there is no exchange
  rate worth writing down, so no surface may render a figure there.
- **The mortal economy stops well below it.** Nobody offers work above
  `MORTAL_WORK_CEILING_ORDINAL`, because a town that sends a delegation out to meet
  somebody does not also put them on a day rate.

See [`docs/world/immortals.md`](docs/world/immortals.md) for what the Immortal World is
like as a place, and [`src/engine/cultivation/README.md`](src/engine/cultivation/README.md)
for the two rungs and the crossing that lands on them.

## The Central Design Rule

> **The AI narrates. The engine decides.**

This is not a stylistic preference; it is the architecture. The runtime agent has no
write access to game state except through MCP tools, and every tool call is validated
and resolved by deterministic code backed by SQLite.

### The runtime agent IS responsible for

- Interpreting the player's natural-language intent
- Selecting appropriate game actions/tools
- Interacting with NPCs through the game systems
- Deciding how an NPC behaves **when an LLM decision is genuinely required**
- Generating dialogue and narrative description
- Presenting world events to the player
- Summarizing relevant world state
- Maintaining the conversational experience

### The runtime agent is NOT authoritative over

Character statistics, cultivation progress, realm changes, breakthrough outcomes, combat
results, inventory, currency, health, lifespan, death, NPC statistics, world-state
mutations, probability calculations, event resolution.

All of the above are handled by deterministic game systems. The agent must never
*claim* an outcome occurred without the corresponding engine state change having
actually happened. If the engine says the breakthrough failed and three meridians tore,
the agent's job is to describe that - not to soften it.

How that rule is enforced in code, phase by phase, is
[`src/web/README.md`](src/web/README.md).

## Runtime Agent Architecture

```text
Player
  |
  v
Runtime Agent
  |
  +-- Claude   (primary/default)
  +-- Ollama   (local/self-hosted)
       |
       v
    MCP tools
       |
       v
 Deterministic Game Engine
       |
       v
     SQLite
```

### Provider abstraction

Providers live behind a single interface (`src/agent/provider/types.ts`) and are
selected by configuration, never by engine code:

```text
runtime_provider = claude
```

or

```text
runtime_provider = ollama
ollama_model = <model>
```

Constraints this must satisfy:

- **No provider-specific logic in the game engine.** Claude-specific and Ollama-specific
  code stays behind the provider interface.
- **The same saved world is playable under either provider.** A player can switch from
  Claude to Ollama without changing or resetting the world.
- **Game state, MCP tools, simulation engine and persistence are identical** across
  providers. Only prose style differs.
- Claude is integrated through the Claude API / agent interface - the engine does not
  assume a human is manually operating Claude Code.

Config resolution precedence, and the rule that no provider name is interpreted outside
`config.ts`, are in [`src/agent/provider/README.md`](src/agent/provider/README.md).

## Tool contract and long-term simulation

The agent talks to the engine in coarse, intent-level verbs, not micro-operations.
*"I spend the next three months cultivating"* becomes `cultivate(duration=90 days)`, and
the engine determines progress, resource consumption, breakthrough eligibility and
outcome, injuries, tribulation, NPC and world changes, and random opportunities. The agent
narrates the result it is handed.

The agent must **not** be required to simulate time day by day. `"I cultivate for ten
years"` resolves in one deterministic pass, cheaply: the engine advances time, resolves
scheduled and stochastic events, and invokes the agent only where a meaningful decision or
a narratable event occurs. The player must be able to return after those ten years and
receive a coherent account of what happened, so a time-skip produces an **event digest**,
not just a new date.

## NPC Simulation Policy

Routine NPC behaviour is deterministic and cheap. LLM calls are reserved for decisions
where personality, goals, relationships, uncertainty, or genuinely complex circumstances
make reasoning useful.

| Deterministic (no LLM) | LLM-worthy |
|---|---|
| Walking to work, daily schedules | Betrayal / loyalty decisions |
| Routine cultivation ticks | Negotiating under conflicting goals |
| Ordinary trading | Reacting to a grudge or debt |
| Aging, resource consumption | Novel or ambiguous situations |

## Deployment

Self-hosted, single-user, no paid tiers, no turn limits, no metering. One command
brings up the GUI and all backend services.

## ADMIN Mode (exploratory testing)

Saying `ADMIN` in play unlocks a privileged tool surface for exploratory testing. It is
deliberately designed so that it does **not** create a hallucination surface.

**ADMIN does not relax the authority rule.** The agent still may not assert state. What
changes is that the engine exposes `admin_manage`, whose actions perform real,
deterministic, audited mutations that are normally gated.

The distinction that makes this safe:

- ADMIN bypasses **gates**, not **truth**. Spawning the grave of a Tribulation
  Transcender while the player sits at Qi Condensation Layer 2 is a content gate being
  lifted: the engine genuinely creates that site, writes it to SQLite, and hands it back.
  The agent narrates something that actually exists.
- There is **no** action anywhere - admin or otherwise - that lets the agent declare an
  outcome without a corresponding state change. That option must never be added, because
  it is precisely the affordance that invites hallucination.

Every admin action is written to the audit log, and runs that used admin are flagged so
they are excluded from the death ledger and from any balance statistics.

---

# The Design Charter, in brief

The world bible says what the world *is*. The charter says what the simulation must be
*capable of*, and it outranks any individual feature. Its priority order and its hardest
rules are here; the rest is distributed across the documents indexed below.

## The goal, stated precisely

The wrong question is "how do we make the player feel like the hero of a cultivation
epic." The right question is:

> **What systems must exist for lives like that to emerge on their own?**

We are not scripting arcs. We are building a simulation whose ordinary operation produces
them, and **no single outcome may be guaranteed - including the good ones.** What that
demands of each subsystem is spelled out in
[`src/engine/README.md`](src/engine/README.md).

## Priority order

When two design goals conflict, resolve in this order:

1. **Internal simulation consistency**
2. **Persistent consequences**
3. **NPC autonomy**
4. **Cultivation-world logic**
5. **Scarcity and meaningful progression**
6. **Character relationships**
7. **Narrative quality**
8. **Spectacle**

Never sacrifice consistency to produce a dramatic scene. A dramatic scene the simulation
did not actually earn is worth less than nothing, because it teaches the player that
none of it is real.

## The hardest rule: the world does not protect the player

**Never secretly adjust probabilities in the player's favour.** No rubber-banding, no
hidden floor under a losing fight, no quiet re-roll of a fatal result, no scaling an
encounter down because the run is going badly. The player may die, fail, miss the
opportunity, lose the fight, be betrayed, lose their cultivation, and choose badly.

The counterpart matters as much: **do not manufacture drama either.** Betrayal happens
when an NPC's incentives make it rational, not because the story is due for a twist.
Opportunities are not sprinkled in to maintain excitement. Long mundane stretches are
correct and necessary - years of cultivating, earning, travelling, recovering, studying,
dealing with ordinary people. That contrast is the only thing that makes an extraordinary
event feel extraordinary.

---

# The standing goal

> *"do this for ALL THE MECHANICS SOMEONE MIGHT THINK ABOUT."*

Written down here because it is not a task with an end. Every mechanic a player might
reach for gets taken to a finished state, and "finished" is defined by the method below
rather than by anybody's impression of the code.

## The method

It is one loop, and it is the only one that has found real defects:

1. **Probe by playing.** Twenty-odd sentences a person would actually type, through the
   real parser, then everything that routes played against the real engine. Not a review
   of the code - the code always looks fine.
2. **Read the answer as a reader would.** Not "is this correct" but "is this what a
   novel does here." Both halves count: the info can be right and the prose wrong, and
   that is still a defect.
3. **Fix the cause, not the symptom.** The measured ratio has held at roughly ten
   symptoms per cause. Patching the symptom leaves the other nine.
4. **Leave a test whose header is the defect** - the sentence typed, the answer that came
   back, the numbers if any were measured, and the ruling. That header is this repo's
   primary design record, and it is what stops the class coming back.

## The four classes worth naming

Every sweep so far has found the same four, in roughly these proportions:

- **It blocks play.** The sentence reaches `unclear`, or reaches the wrong verb. Usually
  the machinery exists and nothing routes to it.
- **The game contradicts itself on one screen.** The largest class by count. Three
  causes: a row read from before the update, a paragraph pushed unconditionally, and
  state asserted but never enforced.
- **Flat prose, or the engine's own voice.** A rubric recited, a raw stat printed, a
  scene block appended to a turn it has nothing to do with.
- **It is not symmetric.** An NPC can do it and the player cannot, or the reverse. See
  AGENTS.md: an asymmetry without a written reason beside it is a defect.

## And the two rules the sweeps keep rediscovering

**The engine states facts; the narrator writes prose.** Extended by measurement into:
the engine may only state what somebody standing there could actually perceive, and it
states findings rather than the rubric that produced them.

**Do not author what the world already generates.** If the variables exist - a birth
house, a ground, a household, a relationship - hand them over and let the narrator
synthesise. Writing the prose into the engine is the same defect as reciting a rubric,
reached from the pleasant direction.

**Look for the answer before writing one.** When a mechanic reads badly, the reader for
it usually already exists, is already tested, and has no sentence pointing at it. One
blind sweep found four in a row: `assessProvisioning` warned about a span that would
starve you and had no caller outside its own test; `whereThisFightStands` printed the
footer under every round and could not be asked; `whatTheWorldHoldsAbout` answered what
the world holds about a person and was wired for everybody but the player;
`describeFoundation` said what your foundation costs you and was reachable only in the
instant it was laid. So the first move on a bad read is to grep for the function that
would answer it - not to design one. `scripts/find-unwired-exports.mjs` is the standing
version of that search, and the plan's workstream U calls this shape by name: a write
side that shipped and a read side that did not.

---

# Where everything lives

Design docs sit next to the code they govern. The world bible is split by topic under
[`docs/world/`](docs/world/), and every section of it carries a **tier marker** saying
whether a narrator must always hold it, should load it for a particular situation, or
should never have it auto-injected at all.

## Engineering contracts, co-located

| Doc | What it governs |
|---|---|
| [`src/engine/README.md`](src/engine/README.md) | Implementation philosophy - small code, intelligent agent - and the five pillars the subsystems serve |
| [`src/engine/cultivation/README.md`](src/engine/cultivation/README.md) | The realm ladder and what each realm above Core Formation makes possible, talent, breakthrough, the Price of Advancement, foundation quality, tribulation, the last crossing and True/False Immortal, existence states, lifespan and the five deaths, Fortune's rule |
| [`src/engine/world/README.md`](src/engine/world/README.md) | Depth rather than scale, locations as environmental modifiers, the capability predicates, environmental gating, opportunity windows, history including failed branches, the mutable-world rules, the three kinds of world event, the Consequence Test, lineage, possessions, time advancement |
| [`src/engine/social/README.md`](src/engine/social/README.md) | Relationships as first-class state, grudges and gratitude and inheritance, the four epistemic layers, secrets and their lifecycle, unresolved truth, karma as a graph rather than a score, and why nothing may rank people by cultivation |
| [`src/data/cultivation/README.md`](src/data/cultivation/README.md) | The content catalogs, grade as a single legible balance axis, provenance (taught / ruin / grave), techniques as developed rather than selected, and how content is authored |
| [`src/web/README.md`](src/web/README.md) | The narrator's three-phase split, the closed action enum, why `intent` is open but never branched on, target resolution, the deterministic fallback, where the authority boundary lives in code, and **the standing register** - the world reference sheet, built from the catalogs in `src/web/register.ts` and served at `/api/admin/register.html` |
| [`src/agent/provider/README.md`](src/agent/provider/README.md) | The provider abstraction, config resolution precedence, and the rule that no provider name is interpreted outside `config.ts` |
| [`src/storage/README.md`](src/storage/README.md) | Migration conventions, the idempotent-ALTER pattern, schema shape decisions, and repository conventions |

## The world bible, by topic

[`docs/world/README.md`](docs/world/README.md) is the index and carries the tier scheme in
full. The files, briefly:

- [`NARRATOR-CORE.md`](docs/world/NARRATOR-CORE.md) - **Tier 1.** The assembled always-loaded text. Load it whole, every turn
- [`qi.md`](docs/world/qi.md) - qi, spiritual veins, density, thin-region ceilings, contested qi, spirit stones
- [`the-late-age.md`](docs/world/the-late-age.md) - the aged world, depletion and monopoly, what ruins are for, the texture to aim for
- [`sects.md`](docs/world/sects.md) - sects as political institutions, ancestral records, the millennial offering, the standing powers
- [`dao-houses.md`](docs/world/dao-houses.md) - the ancient houses, specialisation without ownership, counters and blind spots, rewritten histories
- [`economy.md`](docs/world/economy.md) - scarcity, what things cost, provenance, possession versus ownership versus claim, graves and inheritances
- [`immortals.md`](docs/world/immortals.md) - the Immortal World as a place, what immortals leave behind, what crosses the Lid, immortal lineages
- [`people.md`](docs/world/people.md) - NPCs as protagonists of their own lives, morality as contextual, characters persisting after being surpassed
- [`tone.md`](docs/world/tone.md) - the register, naming conventions, what makes a run interesting, the core emotional principle

## Working agreements

- [`AGENTS.md`](AGENTS.md) - the coding-agent working agreement: conventions, commands,
  parallel-work boundaries, and the acceptance test the design is frozen against.
  `CLAUDE.md` is a symlink to it.
- [`README.md`](README.md) - the player-facing introduction and how to run it.

## Who parses what the player meant

**The model reads the sentence. The verb table is the fallback.**

The point of this game is that the AI works out what somebody meant. Phase 1 is
a model with the square, the player's own words, the previous turn and every
name it printed in front of it, and it is far better placed to read an ordinary
English sentence than a regular expression is.

`verb-pattern-table.ts` exists for the tier below that: the sentence still has to
work when no model answers. It is not the primary reader and must not become
one by accretion.

So when play surfaces a sentence that routes badly, the first question is
whether **phase 1's prompt** can be made to read it - more context handed over,
a clearer instruction, the candidates named in the block it already receives.
A pattern is the right answer in two cases and they are narrow:

- the sentence must work with no model at all, or
- the table is actively MIS-routing - a question that executes an act, a read
  that spends a day, a name that becomes a place.

Growing a branch per synonym is neither of those. It makes the fallback the
thing being tuned while the reader that actually runs stays untouched.

**And the fallback is ALLOWED to be clunkier.** Without a model the game does not
play as smoothly, and a player has to be explicit about what they want to do.
That is the expected shape of the tier, not a defect in it. A sentence that
reaches `unclear` with no model running has cost the player a moment and nothing
else - which is exactly what `unclear` is for - and the remedy available to them
is to say it more plainly. So a near-synonym that the table does not know is not,
on its own, something to fix. What IS worth fixing is the table doing something
WRONG with a sentence it does know.

**Never try to replicate an LLM with a non-LLM.** A regular expression reaching for the
understanding a model already has is the failure mode this whole section is
about, and it does not end: every synonym has another synonym, every phrasing
another phrasing, and the table grows toward a language model it can never be.
The reader that can do that job is already running. Give it what it needs.

### What engine-only mode is for, and what to test there

Engine-only is the mode with no model in it. It is **supposed** to require the
player to be specific. English understanding without a language model is hard,
and this tier does not attempt it: what it offers is a closed vocabulary that
answers reliably when somebody says plainly what they want.

So the expectation for that mode is *name the thing, name the verb*, and a test
at that tier should hold it to that and nothing more.

**Do not test English comprehension against the pattern table.** In particular:

- no back-references - `it`, `that one`, `the second one`, `the cheaper one`.
  Those resolve against the previous turn, which is phase 1's job and is tested
  with a scripted plan.
- no vague or elliptical sentences, and no sweeps of near-synonyms to prove the
  table knows them all. It does not, it never will, and the player's remedy is
  to say it plainly.

**What IS worth testing at that tier**, and all of it is about the engine rather
than about English:

- an explicit sentence reaches the verb it names,
- nothing MIS-ROUTES into spending - a question does not execute an act, a read
  does not take a day, a category word does not become a place or a person,
- every name the engine PRINTS is a name it accepts back, which is the one
  vocabulary promise this tier does make.

Anaphora, ambiguity and ordinary conversational phrasing belong to phase-1
tests, where a scripted plan stands in for the model and the thing under test is
what the engine does with the reading - not whether a regular expression arrived
at it.


**And the engine never hedges at the player.** Where a reference cannot be
settled, drop the field and let the verb answer the general question; do not
print *"X could be A or B, name it and it is settled"*. That sentence is the
engine asking the player to do the model's job, and the one time it shipped it
was also wrong - `"manual" could be Cold Sword Sect or Hollow Bell Wanderers`,
printed at somebody looking at a stall, because a kind word had matched a
listing of houses.
