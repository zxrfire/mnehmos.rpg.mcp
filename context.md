# Context — What This Repository Is

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

The D&D *substrate* — dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime — is sound engineering and is retained. What is replaced is
the entire game-facing surface:

| D&D concept | Cultivation replacement |
|---|---|
| Character level 1–20 | Realm ordinal 0–44 (45 ranks) |
| Class | Spirit root (rolled once, permanent) |
| Ability scores (STR/DEX/CON/INT/WIS/CHA) | Innate attributes: Might, Insight, Fortune, Charm |
| Spells / spell slots | Techniques (arts) / qi pool |
| Gold, silver, copper | Spirit stones |
| XP | Cultivation progress |
| Long rest | Seclusion / meditation |
| Death saves, revival | **Permanent death** — no reload, run is over |

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
the agent's job is to describe that — not to soften it.

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
- Claude is integrated through the Claude API / agent interface — the engine does not
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
of what happened — so the time-skip produces an **event digest**, not just a new date.

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
- There is **no** action anywhere — admin or otherwise — that lets the agent declare an
  outcome without a corresponding state change. That option must never be added, because
  it is precisely the affordance that invites hallucination.

Every admin action is written to the audit log, and runs that used admin are flagged so
they are excluded from the death ledger and from any balance statistics.

---

# THE WORLD

Everything below is the setting bible. It is canon for the narrator, and it is the
reason the mechanics feel like they mean something. The systems in this engine are not
generic fantasy stats wearing Chinese names — each one is an expression of the world's
central cruelty.

The register to aim for is the bleak end of the genre: plain declarative sentences that
turn cruel without raising their voice; obsession as the engine of a life; cosmic scale
undercut by one small intimate loss. Not grandiosity. Grandiosity is what the
*characters* believe.

## The Vault

The sky is not a sky. It is a lid.

The world sits at the bottom of a sealed vessel called **the Vault**, and what mortals
call heaven is the underside of its **Lid** — a ceiling of nine seals, close enough that
on clear nights at high altitude you can see the seams. Nobody living knows who fired
the Vault or what it was firing. The Lid has one property everyone agrees on: things can
leave through it, and nothing has ever come back.

To **ascend** is to punch a hole in the Lid and go through. That is the summit of the
ladder and the ambition of every cultivator in the world.

## Ascension Is Subtraction

Here is the rule the world is built on, and it is not a metaphor:

> **The Vault charges a toll, and the toll is paid downward.**

When a cultivator ascends, they do not take their life with them. The Vault strips it
out — the remembered life, the people, the years, the name — and that remainder falls
back into the world as **ash**.

The ash does not disperse. It settles. It is drawn into stone and root and lung. And it
is *spiritual energy*: the qi that every cultivator in the world breathes, gathers,
condenses, and burns.

So the mechanics are literal. To cultivate is to inhale the discarded lives of
strangers. Every cultivator alive is climbing on the ash of everyone who left.

### The Toll

The Vault does not wait for ascension to start collecting. It takes an instalment at
every **realm boundary** — each time a cultivator crosses from one realm into the next,
not on the small steps between sub-ranks.

The toll is never a stat. It is always something that *mattered*:

- a person who knew you stops knowing you
- a memory you were using to stay yourself
- a technique you had mastered, gone as if never learned
- in the worst cases, your name — and thereafter people have to be told it, every time

**The cultivator does not choose what is taken.** The engine chooses, deterministically,
from what the run has actually accumulated: real bonds with real NPCs, real memories,
real techniques in the database. Then the player is *told* what was taken. The horror is
that it is legible: you can look at the ledger and see the shape of who you used to be.

This is why the powerful are hollow. A Void Refinement cultivator has crossed five
boundaries. They have paid five times. Whatever they were climbing *for* was almost
certainly among the things the climb took. Ask one what their mother's name was and
watch the pause.

The Hollow Court — Grand Ascension cultivators who reached the top and then refused to
step through — are the logical end of this. They have nothing left worth taking, which
makes them nearly invincible and almost entirely inert. They sit in their mountains like
furniture with opinions.

## Ash, Read Mechanically

The ambient-qi system is the ash system. When the engine reports an ambient state, this
is what it means in the world, and the narrator should describe it this way:

| Engine state | The world |
|---|---|
| **thin** | Swept ground. Little has fallen here, or something already drank it. Cultivating in thin ash is chewing on nothing — half rate, and breakthroughs suffer. Most of the world is thin. |
| **normal** | Ordinary settled fall. The baseline of an inhabited region. |
| **dense** | A recent or heavy fall. Someone ascended nearby, or died with a great deal still in them. Ash pools in low ground like snow that will not melt. |
| **spirit_tide** | **Someone has just ascended.** An entire life is coming down at once, over hours, and everyone within a hundred li can feel it on their skin. Sects mobilise. Wars pause. This is the single best thing that can happen to a cultivator and it happens because someone else finished. |

A spirit tide is other people's grief falling as opportunity. Nobody in this world finds
that strange. That is the horror — it is *normal*.

**Spirit stones** are ash compressed under pressure until it holds. They are money. A
person's whole remembered life, refined, is worth perhaps two or three thousand stones.
Everyone knows this figure. Nobody says it out loud in polite company.

## Spirit Roots: How Your Body Drinks Ash

A spirit root is not an elemental affinity in the elemental-magic sense. It is the shape
of the aperture you breathe ash through — decided before you were born, unchangeable,
and worth more than any effort you will ever make.

- **Single roots** (metal, wood, water, fire, earth) drink one flavour cleanly and waste
  nothing. Roughly two people in five are born to one, and every one of them knows what
  they are worth.
- **Dual conflicting roots** (water–fire, metal–wood) drink two ashes that fight each
  other on the way down. This is qi deviation: not a rare accident but a standing
  condition, a low fever that never resolves.
- **The five-element muddled root** drinks everything and keeps almost none of it. It is
  the single most common draw in the world. The overwhelming majority of people who ever
  try to cultivate have this root, get nowhere, and die at eighty having spent their
  lives on it anyway.
- **Mutated roots** drink something that should not be falling at all. **Lightning** is
  the Lid's own charge, bled through the seams — devastating, and there are almost no
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

Ash taken in is ash owed. A cultivator who stops advancing does not merely stagnate —
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

Cultivators who fail tribulation do not leave bodies. They leave a **scar** — a patch of
ground where the ash will never settle again, permanently thin, useless to everyone
forever. The map of the world is pocked with them. Every scar was somebody's entire
ambition.

## Graves and Grave-Readers

When the Vault takes the toll, what it takes has to go somewhere.

It falls, like everything else — but it falls *coherently*, as a deposit rather than a
dispersal. These deposits are **graves**: not burial sites, but the settled remainder of
what a cultivator was made to give up in order to rise. A grave of a Nascent Soul
cultivator holds four boundaries' worth of taken things — techniques nobody living
remembers, names attached to no one, a face, a debt, a reason.

**Grave-readers** are the profession built on this. It is disreputable, extremely
profitable, and the fastest way for a low-realm cultivator to obtain something they have
no business having. It is also how a Qi Condensation cultivator can stumble onto the
grave of a Tribulation Transcender and find something that will either make them or kill
them within the year. Usually the latter.

Robbing a grave takes what someone else already paid for. Nobody in the Vault thinks
this is wrong, exactly. But it does attract attention.

## The Powers

- **The Ashwright Consortium** — neutral, mercantile, and the closest thing the Vault has
  to a functioning state. They refine ash into spirit stones and set the exchange rate,
  which means they set the price of everything. Not evil; simply incapable of seeing a
  falling life as anything but throughput.
- **Lantern Hall** — righteous. Archivists. They catch what falls and write it down: the
  names, the faces, the lives of people who no longer possess them. Their position is
  that ascension is theft and that a world running on stolen memory is a world eating
  itself. They are correct, and it has made them very unpopular.
- **The Severed** — demonic path, and the most coherent argument in the setting. Their
  reasoning: the Vault will take everything eventually, so take it yourself first, on
  your own terms, at a time of your choosing. They cut their own bonds, memories and
  names *in advance*. They climb faster than anyone. What arrives at the top is not
  really a person and does not pretend to be.
- **The Hollow Court** — Grand Ascension cultivators who reached the Lid and refused to
  go through. Nothing left to take, therefore nothing left to threaten. Functionally
  immortal, functionally inert, and the only beings in the Vault who can afford to be
  honest.
- **The Kiln Wardens** — they guard the world-heart, where the fire that fired the Vault
  is either still burning or has not been checked in a long time. They do not explain
  themselves and they do not recruit.

## Tone Guidance for the Narrator

**Do:**

- Keep sentences plain and let the cruelty arrive in the content, not the adjectives.
- Anchor cosmic events to one physical detail. A spirit tide is not "waves of resplendent
  spiritual energy" — it is ash on the back of the hand, warm, and it smells like
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
are verb-noun compounds, often numbered — *Nine Ash Severing*, *Lid-Watching Stance*,
*Borrowed Breath*. Pills are graded — *third-grade Meridian Knitting Pill*. Places are
plain and physical — Sweptground, the Low Fall, Scarwater.

## What Makes a Run Interesting

The engine produces the tragedy on its own if it is left alone to do so. A run is
interesting when the player has to choose between two things the Vault will make them
regret:

- Breakthrough now at poor odds, or stagnate toward settling.
- Rob the grave and take the attention, or stay poor and stay slow.
- Cut a bond yourself the Severed way, or let the Vault choose which one it takes.
- Eat, or keep the stones.

None of those choices has a right answer, and the engine is not required to provide one.
