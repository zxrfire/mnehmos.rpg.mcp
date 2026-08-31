# Context - What This Repository Is

## Purpose

A **deterministic cultivation (xianxia) RPG engine** exposed over MCP, designed to be
driven by an LLM runtime agent that narrates but never decides.

This repo was forked from a D&D 5e MCP game engine and is being transformed into a
cultivation game in the spirit of the xianxia genre: a text-first cultivation roguelike
with permanent death, a 45-rank realm ladder, fixed innate talent, and a survival layer
(satiety, meridian injuries, lifespan, qi deviation) that makes most runs end badly.

The design is an amalgamation drawn from across the genre - progression ladders,
talent systems, survival pressures and tone are synthesised from many sources rather
than modelled on any single one, and the setting, mechanics and text are original.

The D&D *substrate* - dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime - is sound engineering and is retained. What is replaced is
the entire game-facing surface:

| D&D concept | Cultivation replacement |
|---|---|
| Character level 1-20 | Realm ordinal 0-44 (45 ranks) |
| Class | Spirit root (rolled once, permanent) |
| Ability scores (STR/DEX/CON/INT/WIS/CHA) | Innate attributes: Might, Insight, Fortune, Charm |
| Spells / spell slots | Techniques (arts) / qi pool |
| Gold, silver, copper | Spirit stones |
| XP | Cultivation progress |
| Long rest | Seclusion / meditation |
| Death saves, revival | **Permanent death** - no reload, run is over |

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

Character statistics · cultivation progress · realm changes · breakthrough outcomes ·
combat results · inventory · currency · health · lifespan · death · NPC statistics ·
world-state mutations · probability calculations · event resolution.

All of the above are handled by deterministic game systems. The agent must never
*claim* an outcome occurred without the corresponding engine state change having
actually happened. If the engine says the breakthrough failed and three meridians tore,
the agent's job is to describe that - not to soften it.

## Runtime Agent Architecture

```text
Player
  │
  ▼
Runtime Agent
  │
  ├── Claude   (primary/default)
  └── Ollama   (local/self-hosted)
       │
       ▼
    MCP tools
       │
       ▼
 Deterministic Game Engine
       │
       ▼
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

## High-Level Tool Contract

The agent talks to the engine in coarse, intent-level verbs, not micro-operations.

Player: *"I spend the next three months cultivating."*

Agent:

```text
cultivate(duration=90 days)
```

The engine then determines cultivation progress, resource consumption, breakthrough
eligibility, breakthrough success or failure, injuries, tribulation, NPC and world
changes, and random opportunities. The agent narrates the result it is handed.

## Long-Term Simulation

The agent must **not** be required to simulate time day by day. `"I cultivate for ten
years"` is resolved by the deterministic simulation in one pass, cheaply. The engine
advances time, resolves scheduled and stochastic events, and invokes the agent only
where a meaningful decision or a narratable event occurs.

The player must be able to return after those ten years and receive a coherent account
of what happened - so the time-skip produces an **event digest**, not just a new date.

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

# DESIGN CHARTER

The world bible below says what the world *is*. This section says what the simulation
must be *capable of*, and it outranks any individual feature.

## The goal, stated precisely

The wrong question is "how do we make the player feel like the hero of a cultivation
epic." The right question is:

> **What systems must exist for lives like that to emerge on their own?**

We are not scripting arcs. We are building a simulation whose ordinary operation produces
them. Success looks like the engine generating, without anyone authoring it: an
untalented person who becomes terrifying through persistence; a prodigy who dies at
twenty-three; a genius who is crippled and has to find another path; a weak cultivator
who wins by preparation and poison; someone who spends forty years on a single goal;
someone who outlives everyone they loved; a grudge that survives three generations; a
sect that rises and falls while the player is in seclusion.

No single outcome may be guaranteed. Including the good ones.

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

## Realm is social reality, not a stat

A cultivator's realm decides social status, political influence, resource access, who
will speak to them, who fears them, who wants to recruit them, who wants them dead, which
territories they can safely enter, and which opportunities exist at all. A Core Formation
cultivator lives in a materially different world from a mortal - not a better-equipped
version of the same one.

But strength must not eliminate politics. A weaker character survives through alliances,
deception, preparation, reputation, sect backing, formations, treasures, poison, escape
techniques, information, and by exploiting conflicts between stronger cultivators.

Upsets must be **possible and exceptional**. A weaker cultivator can win through superior
technique, an artifact, preparation, terrain, ambush, poison, a formation, numbers, or by
exploiting an existing injury. Routinely - no. Never - also no.

## Trajectories are non-linear

Progression must not read as `XP -> XP -> next realm`. The shape to support is:

```text
slow cultivation -> setback -> opportunity -> rapid development
    -> bottleneck -> catastrophe -> adaptation -> new path
```

Consequences the engine must actually model:

- **Talent is not destiny.** Ordinary aptitude plus persistence, opportunity,
  comprehension, unusual techniques, resources and extreme circumstance must be a viable
  road to the top. The muddled-root run has to be *winnable*, not merely survivable.
- **Foundation has quality and history**, not just a rank. It can be stable, unstable,
  damaged, exceptional, incomplete, transformed, sacrificed, or rebuilt. Two cultivators
  at the same ordinal may have very different futures, and the engine must be able to say
  why.
- **Experience is a form of power.** Surviving hardship should produce mechanical
  consequences: judgement, combat experience, caution, ruthlessness, knowledge, enemies,
  reputation, changed relationships.
- **Loss branches rather than subtracts.** Cultivation destroyed should open a search for
  another path - a new mentor, a new technique, a new faction, new enemies - not simply
  reduce a number.
- **Power creates problems.** Gaining it must generate attention, enemies, political
  obligations, resource requirements, faction interest, jealousy and reputation. Power is
  never purely beneficial.

## NPCs are protagonists of their own lives

This is among the most important requirements and the easiest to fake badly.

NPCs do not exist to serve the player. They have independent trajectories: they find
opportunities, become prodigies, join sects, betray people, marry, raise children, fail
breakthroughs, become elders, found clans, die, and leave descendants. **The player will
never witness most of it, and that is correct.** The world must be larger than the
player's story, and must keep running while the player is in seclusion for thirty years.

Exceptional NPCs emerge from the same inputs the player has - talent, comprehension,
physique, luck, choices, resources, relationships, opportunities, environment, faction,
experience, random events - never from a "this one is important" flag.

Prodigies must not all succeed. Some die young, some turn arrogant, some are used by their
sect, some meet someone stronger, some waste it, some vanish into a secret realm. Talent
creates potential, not destiny.

Personality must be real and varied - cowardly, ambitious, greedy, arrogant, kind,
paranoid, eccentric, lazy, obsessive, loyal, pragmatic - and must drive decisions. Not
every cultivator is a cold mysterious genius.

## Memory: grudges, gratitude, and reputation

- **Grudges persist for decades.** Humiliation, betrayal, robbery, injury, a killed loved
  one - these stay in an NPC's motivation. An NPC must be able to conclude "I cannot
  defeat him now; I will remember this," and act on it forty years later. Grudges outlive
  their owners and are inherited.
- **Gratitude persists too.** Someone the player saved may repay it, offer information,
  give shelter, sponsor a sect introduction, or protect the player's descendants.
- **Betrayal is rational.** It arises from incentives - an NPC learns what the player
  carries; an elder decides the player's talent threatens their faction; an ally leaves
  because the enemy is overwhelming; a clan sacrifices one member to survive. Betrayal
  must make sense in retrospect. Never generate it for drama.

**Information is imperfect, and that is a modelled fact rather than a limitation.** The
engine must distinguish:

```text
what actually happened
    -> what a witness saw
        -> what someone was told
            -> what people believe
```

Rumours may be true, partly true, false, or deliberately fabricated. Reputation spreads
and distorts as it goes. The player may be wrong. NPCs may be wrong. Ancient history may
be misremembered, and legends may hold fragments of truth.

**Information is therefore a resource** - bought, sold, stolen, hidden, misunderstood and
weaponised. Knowing where a treasure lies, when a secret realm opens, an enemy's weakness,
or which technique counters another is a real advantage.

Progression can come from **knowledge**, not only from stats: discovering that what you
believed about cultivation was incomplete can unlock techniques, paths, regions, factions,
and explanations for things that already happened to you.

## Sects are institutions

A sect is not a quest hub. It has hierarchy, elders, disciples, resources, territory,
rules, internal factions, treasures, techniques, enemies, allies, political interests,
secrets, and succession problems.

Members' interests conflict. One elder protects the sect; another builds their faction; a
disciple wants to become an elder; another wants revenge on a rival. The sect behaves like
a political organisation, because it is one.

Resources are scarce - spirit stones, pills, herbs, cultivation grounds, caves,
inheritances, techniques, artifacts, rare beasts, secret realms - and scarcity is what
generates conflict. Two sects want the same vein. Two disciples want one inheritance. An
elder quietly favours their own. A talented disciple becomes politically dangerous because
several factions want to own them.

Cultivation should also be **embedded in society**, not confined to mountaintop hermits:
alchemists, formation masters, merchants, craftsmen, teachers, officials, military
cultivators, researchers, administrators, healers, explorers. That is what makes an
economy exist.

## Dao houses: knowledge accumulated for millennia is itself a form of power

Not every formidable faction should be "a sect with stronger cultivators." Some ancient
houses are formidable because they have spent thousands of years understanding one
fundamental aspect of reality better than anyone else alive.

Candidate principles: karma, fate, causality, space, time, life, death, dreams, memory,
names, oaths, order, chaos, severance, creation, destruction, flame, yin and yang, the
sword, souls.

> The strongest faction is not necessarily the one with the strongest individual.

A young prodigy can become enormously powerful. An ancient house has generations,
history, techniques, artifacts, relationships, territory, resources and secrets, and that
accumulated weight has to matter. **Civilisation itself is part of power progression.**

### Specialisation is not ownership

A house does not "own" karma or "control" fate. It understands a principle
extraordinarily well and holds an enormous advantage in it. Everyone else still interacts
with that principle - clumsily, and usually without noticing.

A five-thousand-year-old house holds knowledge a lone genius cannot reproduce overnight,
because it was built the long way:

```text
a founder develops a method -> disciples refine it -> descendants preserve it
  -> artifacts are made -> new techniques are derived -> unique resources accumulate
    -> the house becomes the authority on the subject
```

### The principle must operate outside combat

This is the part that is easy to get wrong. A karma specialist must never reduce to
"karma attack, 900 damage." The specialisation should shape how the house touches
civilisation:

| House of | Reaches into |
|---|---|
| Karma | Relationships, debts, oaths, inheritance, family, causal tracking, concealment, severance |
| Fate | Probability, divination, recognising which possibilities matter, seeing events converge |
| Oaths | Contracts, promises, restrictions, sworn agreements, the punishment for breaking one |
| Space | Travel, portals, territory, formations, storage, barriers |

Which is why such houses become **institutions**, not just powers. A karma house ends up
supplying judges, oath witnesses, debt arbiters, inheritance authorities and
investigators. A fate house ends up advising rulers. An oath house ends up holding the
treaties. Their authority is civil before it is martial.

### Their power should be frightening in a specific way

The interesting question is not *can I beat this person*. It is:

> "I could probably kill him. But what happens afterwards?"

Killing a member creates a permanent relationship with the whole house. Breaking an oath
invokes something. Entering their territory means being read by people who understand
that principle better than you do.

### Blind spots and counters are mandatory

No specialisation may be an automatic win.

- Every principle has a counter: karma against karmic severance, fate against fate
  concealment, oaths against nullification, space against spatial anchoring, souls
  against soul protection. Counters are rare, dangerous, and usually held by a rival
  house.
- Every house is *bad* at things. A karma house may be terrifying at relationships and
  poor at open warfare, alchemy or formations. A fate house may read possibilities and be
  useless in genuine chaos or against someone deliberately disrupting prediction. A space
  house may dominate movement and hold no political influence at all.
- Houses can disagree about reality itself. *Fate decides what happens* against *karma
  decides what must eventually be repaid* against *neither is absolute* is an ideological
  conflict before it is a fight.

And they are not omnipotent: they have enemies, internal factions, political problems,
resource shortages, declining branches, incomplete knowledge, failed techniques, and
ancestors who are simply dead.

### Karma is a relationship graph, not a score

Karma is modelled as **persistent relationships between entities** - favour, debt,
betrayal, blood feud, oath, inheritance, gratitude, revenge, teacher and disciple, family,
a killing, a rescue, ownership.

**Never surface this as a visible reputation number.** It is a graph that persists, is
inherited, and is mostly invisible to the people inside it.

It crosses generations without anyone tracking it:

```text
year 20    a dying cultivator is saved
year 20    that cultivator's family survives because of it
year 150   a descendant founds a sect
year 400   the sect becomes powerful
year 700   it meets the rescuer's descendant, and an old favour becomes load-bearing
```

Nobody involved needs to know the original connection. **The world remembers it.** A
house that studies karma is one of the few things that can see the whole thread.

Severance exists - concealing a connection, cutting one, transferring or redirecting
consequence, erasing traces, breaking inheritance. It is rare, dangerous, and never free.

### Houses rise, fall, and rewrite what happened

Ancient factions replace each other. A successor inherits territory, resources,
techniques, enemies, obligations, artifacts and reputation - and frequently rewrites the
record:

```text
official history   "the previous house was corrupt and was rightly destroyed"
the truth          they wanted the territory
   or              the predecessor had found something dangerous
   or              nobody now alive remembers what the quarrel was about
```

The player can uncover the discrepancy between official history, surviving records,
ruins, descendants, artifacts, and what actually happened.

A destroyed house leaves scars regardless: ruins, forbidden techniques, bloodlines,
descendants, artifacts, broken formations, cursed ground, inherited enemies, hidden
disciples, standing oaths, unsettled karma, altered geography. It can matter for thousands
of years after its last member died.

Territory therefore stacks:

```text
an older civilisation -> House A -> House B takes it from A -> B declines
  -> Sect C occupies the ruins -> the present
```

The player first learns only *"Sect C controls this region."* Much later: Sect C is built
on House B's ruins. Later: B took it from A. Later still: A was there to keep something
contained.

### Discovery, not exposition

Never announce that a house studies karma. The player arrives at it:

```text
a relationship that makes no sense -> an event with no visible cause -> rumours
  -> investigation -> an old record -> meeting a specialist -> understanding
```

### And it outlives its experts

If the greatest living karma cultivator dies, the discipline does not. It survives in
disciples, manuals, artifacts, descendants, sealed inheritances and fragments. A house can
lose its finest expert and remain dangerous, because the thing that made it dangerous was
never one person.


## Morality is contextual

No good/evil axis, and no alignment-by-faction. Cultivators hold competing values - family,
sect loyalty, survival, honour, ambition, revenge, wealth, enlightenment, immortality,
compassion, curiosity - and act on whichever is load-bearing at the time. An NPC can be
tender with their family and monstrous to outsiders. A sect can shelter its disciples and
bleed the mortals below it. The player may do indefensible things because the alternative
was dying.

The strong genuinely do prey on the weak here: extortion, tribute, theft, forced
recruitment, eliminating threats. But some powerful cultivators are honourable, some cruel,
some pragmatic, some protective, and some are generous in a way that is going somewhere.

## Time is a mechanic, not a calendar

Characters age. Sects change. Generations replace each other. Enemies die and their grudges
are inherited. Cities grow, factions collapse, techniques are lost, treasures are
rediscovered.

A ten-year retreat must genuinely change the world. The player must be able to vanish for
decades and return to a substantially different one.

Long life is bittersweet: outliving friends, watching generations die, losing touch with
where you came from, growing detached, accumulating enemies, becoming isolated.

## Tone

Serious, mysterious, occasionally funny, emotionally consequential, dangerous,
slow-burning, expansive.

Humour is required, not optional - eccentric cultivators, arrogant disciples, absurd sect
rules, rivalries, misunderstandings, merchants, drinking, gambling, petty arguments,
embarrassing failures. It should arise from character, and must never undercut a real
consequence.

Avoid constant melodrama. Avoid telling the player they are special. Avoid guaranteeing
that every action produces an event. The world is sometimes mundane, and that is what buys
the extraordinary its weight.

## The five pillars

The charter above governs *what the simulation must be capable of*. These five pillars
say what each part of it is **for**. They pull in different directions on purpose, and a
design decision that serves one at the total expense of another is usually wrong.

| Pillar | The question it answers |
|---|---|
| **Cost** | What cultivation does to a *person* - what it takes out of them to climb |
| **Scale** | What cultivation does to the *universe* - how the world keeps getting bigger |
| **Survival** | What it *feels like* to live inside it day to day - logistics, scarcity, fear |
| **Strategy** | Why people behave *strategically* inside it - incentives, schemes, preparation |
| **Attachment** | Why relationships stay load-bearing despite all of the above |

Cost and Survival are already expressed in the Toll, the injury ratchet, satiety,
stagnation and permadeath. Attachment is expressed in grudges, gratitude and inherited
consequence. Strategy is expressed in incentive-scored betrayal, imperfect information
and sect politics. **Scale is the pillar the rest of this section is about**, because it
is the one a realm ladder alone does not deliver.

---

## Depth, not scale: one planet, understood further down

The single most important structural property, and the one easiest to get backwards:

> **The world does not become larger. The player's access to it becomes deeper.**

The simulation begins on **one enormous planet**, and that is an implementation and
complexity constraint rather than a hard limit on what reality contains. It holds multiple
continents, enormous oceans, isolated civilisations, thousands of sects and clans, vast
wilderness, forbidden regions, ancient ruins, hidden peoples, secret realms, spatial
anomalies and unexplored territory. A player should be able to spend an entire cultivation
career on it and never run out of world.

**Do not predefine an escalating cosmology.** There is no authored ladder of
planet → galaxy → universe. Whether anything exists beyond this world is *unknown*, not
settled - and it is discovered, if ever, through events: a portal beneath a ruin, a
catastrophe that turns the planet hostile, the remnants of something that plainly came
from elsewhere. A higher realm grants greater capability; it never teleports anyone into a
larger world.

Its depth comes from geography, ancient history, hidden regions, powerful factions, lethal
environments, secret realms, sealed domains, portals, ancient formations, lost
civilisations, powerful individuals, and - above all - information the player does not
have.

Progression does not move the character to a bigger map. It changes what they can
perceive and survive on the map that was always there:

```text
a low cultivator sees        a dangerous mountain
a stronger one sees          a spiritual vein
a stronger one still sees    an ancient formation beneath the mountain
a very powerful one finds    the mountain is one node of a formation spanning the region
```

The mountain never changed. The character's ability to perceive reality did.

What the player should feel, repeatedly:

```text
"I became stronger."
    -> "I can survive somewhere I could not before."
        -> "Things are happening here I did not know existed."
            -> "Someone vastly stronger has been shaping events around me."
                -> "I finally understand what was happening."
                    -> "I am strong enough to shape events myself."
```

And then, still: *"the people I knew before still matter."* The protagonist does not
become the centre of reality. They become one of the people capable of shaping it.

### Expansion is earned by events, never granted by rank

If the world ever grows beyond the planet, it grows because something happened:

- **A spatial discovery.** A portal beneath a ruin. It might lead to another region of the
  same planet, a sealed realm, an ancient battlefield, the ruins of an extinct people, or
  somewhere genuinely else - and **nobody knows which until they investigate**. Portals can
  be stable, unstable, one-way, lethal, politically controlled, or destroyed.
- **A planetary catastrophe.** Continents fracture, oceans move, spiritual energy
  collapses, a planet-scale formation fails, an ancient thing wakes, a war ends a
  civilisation. Survivors may migrate, settle elsewhere, follow an older civilisation's
  route out, or stay and try to live in what is left. If this happens it is a **major
  historical transition**, not a routine advancement.
- **Contact.** Another cultivation civilisation, an unrelated human one, a non-human one,
  the remnants of an old inter-world empire, or people who have never heard of this planet.

### Scale is not power

Discovering somewhere new must never imply that everyone there is stronger. A civilisation
found elsewhere might be weaker, stronger, declining, prosperous, isolated, hostile,
spiritually different, structurally different, or unaware that cultivation exists at all.
The player finds out; they are never handed a power ranking.

### Nothing gets discarded

If the player ever leaves, the place they came from is **not** a tutorial world that stops
mattering. Their family is there. Their enemies are there. Their descendants, their
faction, their reputation and their history are there - and it keeps changing in their
absence, so returning after a long time means returning somewhere different.

Avoid this failure mode entirely:

```text
new world found -> old characters irrelevant -> old factions irrelevant
  -> new world holds stronger NPCs -> repeat
```

The correct shape adds without deleting:

```text
new world found + the old world remains + old relationships remain
  + old history remains + new opportunities appear
```

This is the same rule as characters persisting after they are surpassed, applied to
places.

### None of this is a required ladder

```text
village -> city -> sect -> region -> continent -> planet -> elsewhere
```

is a range of possibilities, **not** a progression everyone walks. Most cultivators remain
regional their whole lives. One player might be caught up in a planetary catastrophe;
another might fall through an inter-world portal by accident while looting a ruin; another
might farm spirit herbs in one valley for two centuries and die there. The simulation
follows circumstance, not a script.

### Implementation: simulate what matters, generate the rest on contact

The lore may be enormous; the running state must not be. Keep detailed state only for
**currently relevant locations, discovered locations, important NPCs, known factions,
important historical events, discovered worlds, active portals, and persistent player
relationships.**

Everything else stays abstract until something makes it real, at which point it is
generated and *then* persisted - so it is stable and consistent forever after, but cost
nothing until someone looked. This is what lets the universe be effectively unbounded while
the simulation stays small.


### Environmental gating

Power decides which environments a character can enter and operate in. A location carries
four thresholds:

```text
entry        can set foot in it at all
survival     can remain without dying
operational  can act, fight, search, cultivate there
mastery      can manipulate the environment itself
```

Crucially, **specialised techniques, artifacts, physiques or knowledge modify these
thresholds.** A lower-realm specialist may survive somewhere a stronger generalist cannot.
That is what keeps specialisation valuable and stops realm from being the only axis.

### Secret realms and portals

The planet contains secret realms, pocket dimensions, sealed domains, isolated spaces,
ancient ruins and portals. A portal is never merely fast travel - it leads somewhere with
its own spiritual conditions, ancient inhabitants, strange rules, rare resources, unique
creatures, sealed beings, lost inheritances, cultivation suppression, temporal anomalies,
or an unfinished ancient conflict.

A secret realm is not a dungeon. It has its own history, previous inhabitants, factions,
ecosystem, rules, resources, mysteries and changing conditions. **NPCs enter secret realms
independently of the player**, and may return with things the player wanted.

A single realm can involve many power levels at once - outer regions for lower
cultivators, inner regions for mid, a centre for the strong, a sealed core holding
something ancient. What makes this work is **interdependence**: lower-level participants
must hold something the powerful cannot simply replace - a specialised technique, a unique
artifact, a passage only they can enter, historical knowledge, an unusual physique, the
ability to activate a particular formation.

### Realms are qualitative

Never model cultivation as `realm 1 = 100 power, realm 2 = 200`. Ask instead: *what is
possible at this realm that was fundamentally impossible before?* A breakthrough can
change physical capability, lifespan, perception, soul, energy quality, movement,
environmental resistance, available techniques, strategic options and influence.

A realm sets a broad **capability ceiling**; it does not determine actual strength. Within
a realm, internal progression is real, and two cultivators at the same stage can differ
enormously by cultivation method, foundation quality, comprehension, techniques, body,
soul, artifacts, experience, resources, preparation, information and environment.

A peak cultivator of one realm can threaten the weakest of the next. **Large realm gaps
must remain nearly insurmountable.** A character several major realms below another should
generally be helpless in a direct confrontation - their options are to flee, hide,
negotiate, seek protection, exploit terrain, use a specialised counter, manipulate another
faction, prepare, or avoid detection entirely. Exceptions are rare and earned. Cleverness
must not casually dissolve the hierarchy.

### Why didn't the stronger person just kill them?

Whenever an obviously stronger character does not simply remove a weaker one, there must
be an actual reason: political consequences, another faction, an oath, territorial
restriction, incomplete information, resource cost, risk of exposure, hidden protection,
strategic usefulness, or a conflicting objective. **Never unexplained plot armour.**

### The powerful act indirectly

Very powerful characters usually avoid direct confrontation. They manipulate factions,
send disciples, control resources, spread or suppress information, conceal their identity,
create incentives, arrange conflicts, and work through intermediaries. One may shape
events around the player for years before the player learns they exist.

## The world remembers, and the world changes

Depth is only half of it. The other half:

> **The world persists, but the world is not immutable.**

The player is not progressing through a sequence of maps. They are living through the
history of a world that the people inside it can change - including while the player is
not looking.

### The map is not sacred

A location is not a permanent object with a fixed description. It can be destroyed,
abandoned, conquered, rebuilt, forbidden, corrupted, enriched, sunk, raised, split,
merged, sealed off, turned into a secret realm, have its spiritual conditions altered, or
have its ecosystem transformed.

A player must be able to return somewhere familiar and find it fundamentally changed.

### Locations carry their history as state

Every location conceptually holds `origin → historical changes → current state`, and the
player uncovers that history gradually:

```text
Blackwater Valley
  origin           an ordinary river valley
  3000 years ago   a sect established here
  1800 years ago   the sect destroyed
  500 years ago    a battle moved the river
  100 years ago    a merchant city built on the ruin
  now              a half-ruined city beside a corrupted river
```

This is stored state, not lore text. The layers must be separately queryable, because the
current inhabitants may hold competing explanations, the ancient records may be
incomplete, and the true cause may be recoverable centuries later.

### Catastrophes make geography

A sufficiently violent event permanently alters the physical world: a mountain range
broken, a river diverted, a city buried, a sea opened, an island raised, a region split, a
buried structure exposed, an underground world opened, a portal created or destroyed.

**Do not model this as a new map.** Modify the existing world state. The map does not grow
- it scars.

### Forbidden zones are made, not placed

A normal region becomes forbidden *because something happened there*: a battle between
powerful beings, a failed breakthrough, an ancient weapon, the death of something large,
spiritual contamination, dimensional instability, a curse, mass death.

```text
before      a fertile forest
event       an ancient cultivator dies here
after       a forbidden forest
then        plants mutate, beasts turn, the spiritual conditions change,
            ordinary people evacuate, cultivators come to investigate,
            rare resources appear, and nearby factions fight over access
```

And centuries later, the cause is forgotten. A region should sometimes exist in its
present form because of something that happened three thousand years ago that nobody
alive can explain. *"Nobody knows why"* is a legitimate and desirable state of the world -
right up until someone finds out.

### History is physically visible

Broken mountains, dead rivers, craters, ruined cities, abandoned sects, shattered
formations, strange local climates, dead zones, anomalous regions, old battlefields. These
must **affect play**, not merely decorate it - they gate access, hold resources, distort
cultivation, and draw factions.

### Environment interacts with cultivation

A cultivator's capability is contextual. A poison specialist is stronger in a corrupted
region; a fire cultivator near a volcanic vein; a soul cultivator weaker inside a
soul-suppressing domain; a sword cultivator inside an old sword formation. This is what
makes geography mechanically real, and it pairs with the entry/survival/operational/
mastery thresholds: *where* you are changes *what you are worth*.

### Scale of destruction tracks power

Low-level conflicts wreck buildings. Higher ones break mountains. Higher still reshape
regions. Only the very top threatens something planetary - and **not every high-level
fight is automatically apocalyptic.** Escalate the physical consequence with the power
actually involved.

### Change creates power vacuums

Events generate incentives, and incentives reorganise the world:

```text
an old mountain collapses -> buried ruins exposed -> sects investigate
  -> a treasure surfaces -> factions compete -> war -> cultivators migrate
    -> a new city grows where there was nothing
```

NPCs react on their own: they flee, investigate, exploit, defend, conquer, trade, migrate,
ally, betray, take revenge, settle, abandon their sect. **The player does not need to
initiate any of it.**

Change also transforms existing relationships. Two sect brothers whose sect is destroyed
may spend the next ten years each believing the other abandoned them - both alive, both
advanced, both now in different factions, the old event still load-bearing.

### Destruction opens as much as it closes

A destroyed place becomes ruins, a forbidden zone, a treasure site, a pilgrimage site, an
excavation, a new settlement, a battlefield, a secret-realm entrance, or a resource. The
end of a location is a transition, not a deletion.

### The player is not the world's clock

Major events happen while the player is in seclusion, travelling, inside a secret realm,
injured, or busy elsewhere. **They will miss things, permanently, and that is correct.**
They return and the world has moved.

There is no single predetermined timeline. A different faction winning produces different
territory, different resources, different people rising, and different conflicts - and the
divergence is irreversible.

### The Consequence Test

For every event that claims to be major, the engine and the narrator should be able to
answer all ten:

1. What changed immediately?
2. What changed **physically**?
3. Who benefited?
4. Who lost something?
5. Which factions reacted?
6. Which relationships changed?
7. What new opportunities appeared?
8. What old opportunities disappeared?
9. What rumours spread?
10. What is still true ten years later?

**If an event has no consequences once the scene ends, it was not a major event.** Either
give it consequences or stop calling it one.

The feeling to produce:

> *"The world I knew is still here, but it isn't the same world any more."*


## Catastrophe: the player lives in history, and does not own it

Some history happens because of the player. Some happens around them. Some happens despite
them. And some is so far beyond them that surviving long enough to see the outcome is the
entire achievement.

### Three kinds of world event

| Kind | The player's position | How they encounter it |
|---|---|---|
| **Historical** | Not alive, or not yet involved | Ruins, survivors, records, scars, descendants, political consequences |
| **Concurrent** | Alive, elsewhere | Rumour, messengers, refugees, sect announcements, merchants, shifted trade, changed borders |
| **Witnessed** | Physically present | Directly - and usually far beyond their power to affect |

All three must be able to occur. Only the third involves the player at all, and even then
involvement is not the same as participation.

### The player is not the centre of catastrophe

A world-scale event can occur when the player did nothing, was pursuing something else,
was in the wrong place, was far too weak to matter, or never learned it was coming. **The
world does not wait for the protagonist**, and it does not schedule its disasters around
their readiness.

### Powerlessness is valid gameplay

Witnessing a conflict between vastly stronger beings must not suddenly make a low
cultivator capable of joining it. The honest shape of that encounter:

```text
a distant sound -> a mountain goes -> an aura that stops the body working
  -> the understanding that something is very wrong -> flight
    -> the terrain changing while you are still in it -> barely surviving
```

**That is a successful encounter.** Survival is sometimes the whole of it, and the engine
must be willing to end an event with the player having achieved nothing but living.

Do not guarantee a reward. A catastrophe *may* leave trauma, knowledge, rumours,
reputation, opportunity, enemies, a cultivation insight, or a relationship with a
survivor. It may also leave nothing but the fact that you are still breathing.

### Observed is not understood

The player may see the sky change, a mountain break, a city stop existing, a portal open,
an aura arrive, an old formation wake, or a region turn - and have no idea what caused
any of it. The truth should be recoverable *later*, sometimes much later, sometimes never.
This is where mystery comes from, and it must not be spoiled by a narrator explaining the
event as it happens.

### Witnessed events write real state

If the player watches a mountain be destroyed, the database records **the mountain is
destroyed** - not "the player saw a dramatic scene." The location's state changes, its
history gains an entry, and every downstream consequence follows from that record.

This is the same authority rule as everywhere else: narration describes a state change
that actually happened.

### Lived memory and world record can diverge

The player remembers: *"there used to be a mountain here."* A character born later says:
*"there has never been a mountain here."*

**Both are correct**, and the engine must be able to hold both at once - ground truth, the
world's surviving record, and what any given person believes are separate layers. The
player's lived history is real even when the world has forgotten it. Occasionally the
player will be the only remaining witness to something, and that is a form of knowledge
worth having.

### One catastrophe seeds years of world activity

```text
powerful beings fight -> a mountain is destroyed -> an old ruin is exposed
  -> factions find it -> treasure hunters arrive -> a town grows to serve them
    -> a sect claims the territory -> conflict
```

A single witnessed disaster should be capable of generating months or years of subsequent
world movement, none of which requires the player.

### The long arc

Over a very long run, the player's relationship to events of this scale should change:

```text
helpless witness -> survivor -> participant -> influential actor
  -> someone capable of causing one
```

That progression is earned across a lifetime and is never promised. Most cultivators stop
at the first step, having survived one bad afternoon that they will describe, inaccurately,
for the rest of their lives.


## Power is composite, not a single number

Realm is the spine, but it must never be the whole of a character's capability. Model
power as a composite of at least: energy/cultivation base, **physical body**, **soul**,
**comprehension**, techniques and secret techniques, artifacts, weapons and armour,
bloodline or physique, innate abilities, **battle experience**, movement and defensive
capability, and environmental compatibility.

**Two cultivators at the same realm must be able to differ enormously in what they can
actually do**, and the engine must be able to say exactly why.

### The body is a real path

Body cultivation is a legitimate route to power, not a passive defence stat. It can raise
strength, durability, speed, regeneration, senses, resistance, longevity, and the ability
to survive hostile environments - and a specialised body should fundamentally change what
combat and exploration look like, not just add armour.

### Comprehension is separate from accumulation

Keep three quantities distinct:

```text
cultivation quantity   (how much you have accumulated)
cultivation quality    (how good your foundation is)
understanding          (what you actually comprehend)
```

A character with enormous accumulated energy and poor understanding hits a wall that no
amount of further accumulation clears. A character with extraordinary comprehension
advances rapidly the moment they find the right insight. Understanding must unlock
*qualitatively different* abilities - never be a second experience bar with a different
name.

Progression through knowledge is therefore real progression: learning that what you
believed about cultivation was incomplete can unlock techniques, paths, regions,
factions, and explanations for things that already happened to you.

### Bloodlines and physiques: potential, not destiny

Inherited gifts create meaningful differences between characters. They also routinely
come to nothing: a character with an extraordinary physique can still die, lack the
resources to use it, choose the wrong path, become politically isolated, or never
understand what they have. Conversely an ordinary character can reach extraordinary
heights through persistence, comprehension, opportunity, and unconventional methods.

### Battle experience is tracked

A veteran and a novice at identical cultivation must not fight identically. Track combat
experience, tactical knowledge, familiarity with specific techniques and opponents, and
the ability to exploit a weakness.

---

## Techniques are developed, not selected

A technique is not a spell chosen from a menu. Over time a cultivator can learn it,
practise it, master it, *understand* it, modify it, combine it with other insights,
derive something new, find its flaws, discover higher applications, teach it, or abandon
it.

```text
basic technique -> mastery -> understanding -> modification -> personalised technique
```

Two characters who begin from the same manual must be able to end up with genuinely
different arts. High comprehension is what makes that possible.

**Specialisation matters.** Sword, body, soul, elemental, formations, alchemy, artifact
refinement, movement, assassination, defence, domain. No character should need to be good
at everything; specialisation is what makes characters asymmetrical, and a chosen path
should shape identity and opportunity, not just damage type.

**Unconventional paths must be viable.** A character should be able to find or build a
route that is not the standard one - a body-focused road, an unusual energy system, a
self-created method. Non-standard paths carry real trade-offs: slower at first, harder to
understand, resource-hungry, politically unsupported. And potentially exceptional.

---

## Inheritances and opportunities

An inheritance is never "a chest containing experience." It is a mechanism for
transmitting power and knowledge across ages, and it should be capable of changing a
cultivator's entire trajectory. It may carry techniques, treasures, bloodline alteration,
knowledge, trials, a cultivation environment, restrictions, or legacy obligations.

It should also carry friction: compatibility requirements, hidden costs, incomplete
information, traps, guardians, time limits, and **competing claimants**.

Extraordinary opportunities - a rare treasure, a secret realm, an unusual cultivation
environment, an expert encountered at the right moment, a bloodline awakening - must be
capable of enormous trajectory changes, and must stay **rare**. Most cultivators live
ordinary cultivation lives and never receive one. That is precisely what makes them
extraordinary when they land.

**Exploration is how they are found**, and it must carry risk, preparation, information,
navigation, environmental hazard and competition. Even a powerful character should still
encounter things they do not understand.

---

## Characters persist after they are surpassed

This is among the most important rules in the document, and it names a specific failure
mode to avoid:

```text
protagonist meets powerful senior -> senior matters -> protagonist catches up
    -> senior becomes irrelevant -> a stronger senior is introduced -> repeat forever
```

**Do not do this.** When the protagonist surpasses someone, it changes their
*relationship*, it does not delete the character. Power relationships are allowed - and
expected - to reverse:

```text
early: NPC >>> player    middle: NPC > player    later: NPC ~ player    eventually: player >>> NPC
```

That is a good outcome, not a problem to fix. **Never power-creep an NPC merely to keep
them combat-relevant.** Their cultivation may stay low while their importance stays high.

### Importance is not cultivation

Never implement `stronger NPC = more important NPC`. A character can matter because of
knowledge, family, faction, political authority, history, secrets, relationships,
resources, expertise, reputation, territory, emotional connection, or unfinished goals.
Cultivation is one axis among many.

Their continued relevance is carried by: things they did (founded a sect, fought a war,
sealed an enemy, created a technique, swore an oath, caused a disaster), and by lineage -
parents, children, siblings, descendants, disciples, ancestors. The player may surpass an
NPC and then become entangled with their family, their sect, or the consequences of
something they did three centuries ago.

### The cast grows sideways

The protagonist grows vertically; the cast must grow **horizontally**. Friends, rivals,
mentors, disciples, family, faction leaders, merchants, scholars, enemies, political
contacts, ancient figures. The player should *accumulate* relationships, not continuously
replace old characters with stronger versions of the same role.

Powerful NPCs must also have their own lives - goals, relationships, history, factions,
secrets, conflicts, resources - and pursue things that have nothing to do with the player.
A powerful character does not exist to demonstrate how strong the next opponent is.

### Death is a world-state transition

When an important character dies: their faction reacts, their family reacts, their
disciples react, their enemies react, succession begins, resources move, alliances shift,
rumours spread, and their unfinished goals remain. A powerful dead cultivator stays
historically important.

## And none of it is promised to the player

The simulation must be *capable* of the full escalation. It must never steer anyone
toward it. A run may end with the player as a mediocre cultivator, a respected local
figure, a sect elder, a merchant, a wandering expert, the founder of a family, someone
who found an unconventional path - or a corpse at twenty-two.

**NPCs must be capable of the identical arc**, independently. An NPC can rise from
nothing through opportunity, cultivation, breakthrough, a new faction, new resources, new
enemies, and regional influence - and the player may meet them before their rise, during
it, after it, after their fall, or only as a name on a grave. That trajectory exists
whether or not the player is there to see it.

The objective is never to write the journey. It is to create the conditions under which
such a journey can occur - to anyone, including no one.


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
events - but never replaces causal reasoning.

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
important history and faction changes, and discarding conversational trivia.

### Situations, not quests

Never generate `"collect ten herbs"`. Generate *circumstances* and let conflict emerge:

```text
an NPC needs a rare herb + three factions want it + the NPC owes a debt to one of them
  + the player can reach the region + another faction offers payment
  + the player knows something the NPC does not
  = a situation with no clean answer
```

The system generates conditions. The story is what happens in them.

## The core emotional principle

The simulation should repeatedly produce, without anyone authoring it:

> *"I could have done something differently."*

and sometimes:

> *"There was nothing I could do."*

Ambition, wonder, fear, attachment, betrayal, regret, loss, revenge, discovery, triumph -
all of it emerging from persistent consequences rather than from scripted plot.

---

# THE WORLD

Everything below is the setting bible. It is canon for the narrator, and it is the
reason the mechanics feel like they mean something. The systems in this engine are not
generic fantasy stats wearing Chinese names - each one is an expression of the world's
central cruelty.

The register to aim for is the bleak end of the genre: plain declarative sentences that
turn cruel without raising their voice; obsession as the engine of a life; cosmic scale
undercut by one small intimate loss. Not grandiosity. Grandiosity is what the
*characters* believe.

## The Vault

The sky is not a sky. It is a lid.

The world sits at the bottom of a sealed vessel called **the Vault**, and what mortals
call heaven is the underside of its **Lid** - a ceiling of nine seals, close enough that
on clear nights at high altitude you can see the seams. Nobody living knows who fired
the Vault or what it was firing. The Lid has one property everyone agrees on: things can
leave through it, and nothing has ever come back.

To **ascend** is to punch a hole in the Lid and go through. That is the summit of the
ladder and the ambition of every cultivator in the world.

## Ascension Is Subtraction

Here is the rule the world is built on, and it is not a metaphor:

> **The Vault charges a toll, and the toll is paid downward.**

When a cultivator ascends, they do not take their life with them. The Vault strips it
out - the remembered life, the people, the years, the name - and that remainder falls
back into the world as **ash**.

The ash does not disperse. It settles. It is drawn into stone and root and lung. And it
is *spiritual energy*: the qi that every cultivator in the world breathes, gathers,
condenses, and burns.

So the mechanics are literal. To cultivate is to inhale the discarded lives of
strangers. Every cultivator alive is climbing on the ash of everyone who left.

### The Toll

The Vault does not wait for ascension to start collecting. It takes an instalment at
every **realm boundary** - each time a cultivator crosses from one realm into the next,
not on the small steps between sub-ranks.

The toll is never a stat. It is always something that *mattered*:

- a person who knew you stops knowing you
- a memory you were using to stay yourself
- a technique you had mastered, gone as if never learned
- in the worst cases, your name - and thereafter people have to be told it, every time

**The toll is not certain, and it is not fair.** It is rolled. Crossing a boundary puts
you at risk of losing something, not under a guarantee of it - and the odds move:

- **Fortune** shifts them. The attribute that can legally come up zero is the one that
  decides whether the Vault notices you on the way past.
- **Sect elders can stand between you and it.** A sect that has decided you are worth
  protecting will spend real resources shielding a disciple's crossing - formations,
  elders holding the qi steady, pills nobody at your realm could afford. This is most of
  why anyone tolerates a sect. It is also why sects let you know, precisely, what the
  protection cost them.
- **Preparation matters.** The right pill, a stable site, dense ash, an unhurried
  crossing. Cultivators who break through in a cave they chose live differently from
  cultivators who break through in a ditch because something was chasing them.
- **The Severed pay in advance**, on their own terms, and cross clean. That is the whole
  argument of their path, and it works.

So some cultivators climb four realms and lose nothing, and know they were lucky, and are
insufferable about it. Others lose a brother at Foundation Establishment and never get
another thing taken again. The path is soaked in blood, but it is not evenly distributed
blood - and the ones who got through clean rarely believe luck had anything to do with it.

**What is taken is never chosen by the cultivator.** When the roll goes against you, the
engine selects from what the run has actually accumulated: real bonds with real NPCs, real
memories, real techniques in the database. Then you are *told*. The horror is that it is
legible - you can read the ledger and see the shape of who you used to be.

This is why the powerful tend toward hollow. A Void Refinement cultivator has crossed five
boundaries and rolled five times. Some of them still have a family. Most do not. Ask one
what their mother's name was and watch which kind you're talking to.

The Hollow Court - Grand Ascension cultivators who reached the top and then refused to
step through - are the logical end of this. They have nothing left worth taking, which
makes them nearly invincible and almost entirely inert. They sit in their mountains like
furniture with opinions.

## The Late Age

The world is old, and it is not what it was.

This is not a fresh world with its great age ahead of it. The great ages are behind it.
Cultivators today walk through the wreckage of civilisations that were categorically
stronger than anything now living, and they walk through it *constantly* - you cannot
cross a province without passing a collapsed sect mountain, a battlefield where the
craters are still too regular to be natural, or a sealed door with a formation on it that
nobody alive knows how to read.

The reason is mechanical, and it is the same ash.

**Ash degrades each time it is breathed.** Every pass through a body takes something out
of it. The ash falling now has been through a hundred thousand cultivators already,
across ages nobody kept a record of, and what is left is thin stuff - which is exactly
why the world is thin half the time. The current age is not unlucky. It is *late*. It is
breathing the same air the ancients already used.

This is why the ladder has a practical ceiling now that it did not used to have. Ordinals
in the upper realms exist, and the manuals describing them exist, and the people who
wrote those manuals were real. But nobody has ascended in living memory. The last
confirmed ascension is centuries back, and it is remembered because of the spirit tide it
caused - a whole life falling at once across half a continent, which is now spoken of as
a golden year by people whose great-grandparents weren't born for it.

### What ruins are for

A sealed ruin is a pocket of ash that has not been breathed.

That is the entire economy of exploration. A cave that was closed two ages ago holds
deposits at a density the open world cannot produce any more, along with the things its
owner did not get to take: technique manuals in grades that are no longer taught,
because there is no living teacher; pills refined by methods that are no longer known;
formations still drawing power off a vein that was rich when it was tapped.

It is also the only realistic path upward for someone born without talent. You will not
out-cultivate a single-root prodigy on ambient ash in the Late Age. You might out-*dig*
them.

The obvious problem: ruins were sealed by people who were much stronger than you, usually
for a reason, and the seals are frequently still working. Guardian formations still run.
Corpses in some of those caves are still cultivating - slowly, badly, and for a very long
time. Inheritance trials left by the last generation of a dead sect were calibrated for
disciples of that sect, and the calibration was not gentle.

### The texture to aim for

- **Ruins are ordinary, not special.** A village builds its granary against a wall it did
  not make. Farmers plough up fragments and sell them by weight. A child's toy is a
  spirit-tool with the qi long gone out of it. Nobody finds this remarkable.
- **The past outranks the present, and everyone knows it.** The strongest sect in a
  region is squatting in a compound it did not build, using nine of the forty-one
  formation nodes, having lost the manual for the rest.
- **Knowledge is recovered, not invented.** Progress in this world means finding
  something, not discovering something. A breakthrough in alchemy is a recipe dug out of
  a tomb.
- **Scale down what survives.** The remnant should be legible and small - a doorway with
  handprints burned into it at a height too tall for a person; a courtyard of stone seats
  arranged for an audience of two hundred, in a sect that now has eleven disciples.

## Ash, Read Mechanically

The ambient-qi system is the ash system. When the engine reports an ambient state, this
is what it means in the world, and the narrator should describe it this way:

| Engine state | The world |
|---|---|
| **thin** | Swept ground. Little has fallen here, or something already drank it. Cultivating in thin ash is chewing on nothing - half rate, and breakthroughs suffer. Most of the world is thin. |
| **normal** | Ordinary settled fall. The baseline of an inhabited region. |
| **dense** | A recent or heavy fall. Someone ascended nearby, or died with a great deal still in them. Ash pools in low ground like snow that will not melt. |
| **spirit_tide** | **Someone has just ascended.** An entire life is coming down at once, over hours, and everyone within a hundred li can feel it on their skin. Sects mobilise. Wars pause. This is the single best thing that can happen to a cultivator and it happens because someone else finished. |

A spirit tide is other people's grief falling as opportunity. Nobody in this world finds
that strange. That is the horror - it is *normal*.

**Spirit stones** are ash compressed under pressure until it holds. They are money. A
person's whole remembered life, refined, is worth perhaps two or three thousand stones.
Everyone knows this figure. Nobody says it out loud in polite company.

## Spirit Roots: How Your Body Drinks Ash

A spirit root is not an elemental affinity in the elemental-magic sense. It is the shape
of the aperture you breathe ash through - decided before you were born, unchangeable,
and worth more than any effort you will ever make.

- **Single roots** (metal, wood, water, fire, earth) drink one flavour cleanly and waste
  nothing. Roughly two people in five are born to one, and every one of them knows what
  they are worth.
- **Dual conflicting roots** (water-fire, metal-wood) drink two ashes that fight each
  other on the way down. This is qi deviation: not a rare accident but a standing
  condition, a low fever that never resolves.
- **The five-element muddled root** drinks everything and keeps almost none of it. It is
  the single most common draw in the world. The overwhelming majority of people who ever
  try to cultivate have this root, get nowhere, and die at eighty having spent their
  lives on it anyway.
- **Mutated roots** drink something that should not be falling at all. **Lightning** is
  the Lid's own charge, bled through the seams - devastating, and there are almost no
  manuals for it because almost nobody who had it lived long enough to write one.
  **Ice** is ash from before the Kiln was lit, older than the Vault's own fire, and it
  takes as readily as it gives.

Talent is not earned, cannot be improved, and decides nearly everything. The engine
rolls it once and locks it. A player who draws a muddled root has drawn the real
experience of this world.

## The Four Innate Attributes, In-World

| Attribute | What it actually is |
|---|---|
| **Might** | How much ash your body can hold before it starts holding you. |
| **Insight** | How quickly you can read a life you did not live. Manuals are other people's memories; comprehension is archaeology. |
| **Fortune** | Whether the ash that lands on you belonged to anyone who mattered. It can be zero, and for most people it is. |
| **Charm** | Whether people see you, or see the ash on you. |

## Why You Still Have to Eat

Ash feeds the meridians. It does not feed the body.

Until a cultivator obtains a **Grain Abstinence Pill**, the flesh keeps its mortal
arithmetic: it wants food, it starves without it, and it dies on schedule. A Qi
Condensation cultivator who forgets to eat dies exactly as fast as a farmer who forgets
to eat, and considerably more embarrassingly.

This is why the hunger clock exists mechanically and why the Grain Abstinence Pill is a
genuine mid-game goal rather than a convenience item. Half the deaths in the Vault are
logistical.

## Settling: Death By Standing Still

Ash taken in is ash owed. A cultivator who stops advancing does not merely stagnate -
the ash they have already absorbed begins, slowly, to absorb *them*. The body greys. The
memory thins in the same way an ascended one's does, but with nothing gained for it.

Fifty years at one realm, and the process finishes. This is called **settling**, and it
is the most common death among cultivators who survive long enough to have a choice
about it. The engine calls it death by aging. The world calls it becoming furniture.

## Tribulation

At the last realm, the Lid stops ignoring you.

Heavenly tribulation is not a divine judgement on virtue. It is structural: the Vault
testing whether the hole you are about to punch is worth the ash it will cost to seal
behind you. The lightning is the seam discharging. It is not personal, and it is not
survivable by being a good person.

Cultivators who fail tribulation do not leave bodies. They leave a **scar** - a patch of
ground where the ash will never settle again, permanently thin, useless to everyone
forever. The map of the world is pocked with them. Every scar was somebody's entire
ambition.

## The Last Crossing: True Immortal and False Immortal

Tribulation Transcendence is not the summit. It is the approach to it.

At the end of that realm sits one final attempt - the crossing that actually goes through
the Lid - and it resolves three ways rather than two.

### True Immortal

The hole is punched, and the cultivator goes through it. This is the top of the ladder and
the end of a run in the only way that is not a death. Lifespan stops being a number that
means anything.

It is also, structurally, the moment the Vault collects in full. Everything the Toll had
been taking in instalments comes due at once: whatever the cultivator still had, they do
not take with them. What falls back is the spirit tide that a whole region will remember as
a golden year, and which the cultivator will never know they caused.

Nobody currently alive has done this. The last confirmed crossing is centuries back, and it
is remembered for the tide rather than the person.

### False Immortal

The half-failure, and the more interesting outcome.

The tribulation is survived. The hole is opened. But the crossing does not complete - the
seam closes early, or the body will not follow the soul, or something on the other side
declines to take them. What is left stays on this side of the Lid, permanently.

A False Immortal is:

- **Enormously powerful.** Stronger than anything at Tribulation Transcendence, because
  part of the transformation did happen.
- **Permanently barred.** The Lid has already been opened once against their name and will
  not open again for them. They cannot re-attempt, and everyone who understands what they
  are knows it.
- **Not immortal.** Their lifespan is vast and it is finite, and they can count it. They
  will die on this side, having been most of the way through.
- **Incomplete in a way that shows.** Something did not come back. What is missing varies
  and it is never nothing.

This is the Hollow Court's real membership. Those who "reached the top and refused to step
through" is the polite version of the story, and some of them did choose it - but a good
number of the oldest and quietest ones tried, and are what came back. They do not correct
the polite version.

A False Immortal is therefore one of the most dangerous things in the world and one of the
most stuck. They have nothing left to lose, no way forward, and a great deal of time to
think about it. They make excellent patrons, excellent enemies, and the most reliable
sources of true history in existence, because they were there.

### Failure

The third outcome is the ordinary one. Cultivators who fail the last crossing leave a scar
and nothing else.


## Graves and Grave-Readers

When the Vault takes the toll, what it takes has to go somewhere.

It falls, like everything else - but it falls *coherently*, as a deposit rather than a
dispersal. These deposits are **graves**: not burial sites, but the settled remainder of
what a cultivator was made to give up in order to rise. A grave of a Nascent Soul
cultivator holds four boundaries' worth of taken things - techniques nobody living
remembers, names attached to no one, a face, a debt, a reason.

**Grave-readers** are the profession built on this. It is disreputable, extremely
profitable, and the fastest way for a low-realm cultivator to obtain something they have
no business having. It is also how a Qi Condensation cultivator can stumble onto the
grave of a Tribulation Transcender and find something that will either make them or kill
them within the year. Usually the latter.

Robbing a grave takes what someone else already paid for. Nobody in the Vault thinks
this is wrong, exactly. But it does attract attention.

## The Powers

- **The Ashwright Consortium** - neutral, mercantile, and the closest thing the Vault has
  to a functioning state. They refine ash into spirit stones and set the exchange rate,
  which means they set the price of everything. Not evil; simply incapable of seeing a
  falling life as anything but throughput.
- **Lantern Hall** - righteous. Archivists. They catch what falls and write it down: the
  names, the faces, the lives of people who no longer possess them. Their position is
  that ascension is theft and that a world running on stolen memory is a world eating
  itself. They are correct, and it has made them very unpopular.
- **The Severed** - demonic path, and the most coherent argument in the setting. Their
  reasoning: the Vault will take everything eventually, so take it yourself first, on
  your own terms, at a time of your choosing. They cut their own bonds, memories and
  names *in advance*. They climb faster than anyone. What arrives at the top is not
  really a person and does not pretend to be.
- **The Hollow Court** - Grand Ascension cultivators who reached the Lid and refused to
  go through. Nothing left to take, therefore nothing left to threaten. Functionally
  immortal, functionally inert, and the only beings in the Vault who can afford to be
  honest.
- **The Kiln Wardens** - they guard the world-heart, where the fire that fired the Vault
  is either still burning or has not been checked in a long time. They do not explain
  themselves and they do not recruit.

## Tone Guidance for the Narrator

**Do:**

- Keep sentences plain and let the cruelty arrive in the content, not the adjectives.
- Anchor cosmic events to one physical detail. A spirit tide is not "waves of resplendent
  spiritual energy" - it is ash on the back of the hand, warm, and it smells like
  somebody's house.
- Let NPCs be genuinely convinced of things. Nobody in the Vault thinks they are in a
  tragedy.
- Treat the toll as bureaucratic. The world processes it the way ours processes tax.
- Let the player's ambition be real. This only hurts if climbing is genuinely worth it.

**Don't:**

- Don't explain the setting's rules in dialogue. Characters live here; they don't lecture.
- Don't do power-level exposition ("as a mere Qi Condensation Layer 3, he could never…").
  The engine knows the numbers. Show consequences instead.
- Don't soften engine outcomes. If the tool returned a torn meridian, narrate a torn
  meridian.
- Don't reach for the genre's tired furniture: the trash-of-the-clan opening, the
  arrogant young master, the beautiful senior sister who exists to be impressed. If one
  appears, give it a reason to exist that the setting supplies.

**Naming conventions:** sects take Hall / Pavilion / Court / Consortium / Sect. Techniques
are verb-noun compounds, often numbered - *Nine Ash Severing*, *Lid-Watching Stance*,
*Borrowed Breath*. Pills are graded - *third-grade Meridian Knitting Pill*. Places are
plain and physical - Sweptground, the Low Fall, Scarwater.

## What Makes a Run Interesting

The engine produces the tragedy on its own if it is left alone to do so. A run is
interesting when the player has to choose between two things the Vault will make them
regret:

- Breakthrough now at poor odds, or stagnate toward settling.
- Rob the grave and take the attention, or stay poor and stay slow.
- Cut a bond yourself the Severed way, or let the Vault choose which one it takes.
- Eat, or keep the stones.

None of those choices has a right answer, and the engine is not required to provide one.
