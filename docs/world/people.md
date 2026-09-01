<!-- tier: 2 trigger="any NPC is on screen, being reasoned about, or being remembered" -->

# People

NPCs as protagonists of their own lives: personality, prodigies, goals, why morality is
contextual, why the powerful act indirectly, and why nobody is deleted when the player
surpasses them. Load this whenever an NPC is in play, which is most of the time.

The storage model behind all of it is
[`../../src/engine/social/README.md`](../../src/engine/social/README.md) and
[`../../src/engine/world/README.md`](../../src/engine/world/README.md).

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [NPCs are protagonists of their own lives](#npcs-are-protagonists-of-their-own-lives) | an NPC does something the player did not prompt, or the player asks what somebody wants |
| [Goals persist, and outlive their holder](#goals-persist-and-outlive-their-holder) | an NPC's goal, deadline, or obstacle is in play, or somebody dies with an unfinished aim |
| [Morality is contextual](#morality-is-contextual) | an NPC's motives, allegiance, or willingness to do something ugly is in question |
| [Why didn't the stronger person just kill them?](#why-didnt-the-stronger-person-just-kill-them) | a stronger character declines to remove a weaker one |
| [The powerful act indirectly](#the-powerful-act-indirectly) | a powerful figure could act on the player directly and does not |
| [Characters persist after they are surpassed](#characters-persist-after-they-are-surpassed) | the player has grown past an NPC who mattered earlier |
| &nbsp;&nbsp;[Importance is not cultivation](#importance-is-not-cultivation) | somebody who matters is weaker than the people around them |
| &nbsp;&nbsp;[The cast grows sideways](#the-cast-grows-sideways) | **Tier 3** - never injected |
| &nbsp;&nbsp;[Death is a world-state transition](#death-is-a-world-state-transition) | an important character dies |
| [And none of it is promised to the player](#and-none-of-it-is-promised-to-the-player) | **Tier 3** - never injected |
| [Related](#related) | **Tier 3** - never injected |

---

## NPCs are protagonists of their own lives

<!-- tier: 2 trigger="an NPC does something the player did not prompt, or the player asks what somebody wants" -->

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
paranoid, eccentric, lazy, obsessive, loyal, pragmatic - and must drive decisions. **Not
every cultivator is a cold mysterious genius.**

## Goals persist, and outlive their holder

<!-- tier: 2 trigger="an NPC's goal, deadline, or obstacle is in play, or somebody dies with an unfinished aim" -->

A goal is five fields, not psychology: `goal | priority | progress | obstacles | deadline`.

*Avenge a father. High. Has identified the killer's faction. Insufficient strength. No
deadline.*

Three hundred years later that goal can still be live. And if its holder dies, **the goal
becomes legacy state** - a disciple continues the revenge, a descendant inherits the
grudge. That is the continuity the whole design is aiming at.

## Morality is contextual

<!-- tier: 2 trigger="an NPC's motives, allegiance, or willingness to do something ugly is in question" -->

No good/evil axis, and no alignment-by-faction. Cultivators hold competing values - family,
sect loyalty, survival, honour, ambition, revenge, wealth, enlightenment, immortality,
compassion, curiosity - and act on whichever is load-bearing at the time. An NPC can be
tender with their family and monstrous to outsiders. A sect can shelter its disciples and
bleed the mortals below it. The player may do indefensible things because the alternative
was dying.

The strong genuinely do prey on the weak here: extortion, tribute, theft, forced
recruitment, eliminating threats. But some powerful cultivators are honourable, some cruel,
some pragmatic, some protective, and some are generous in a way that is going somewhere.

Betrayal follows from this and never from a schedule. It arises from incentives, and it
must make sense in retrospect - see
[`../../src/engine/social/README.md`](../../src/engine/social/README.md).

---

## Why didn't the stronger person just kill them?

<!-- tier: 2 trigger="a stronger character declines to remove a weaker one" -->

Whenever an obviously stronger character does not simply remove a weaker one, there must
be an actual reason: political consequences, another faction, an oath, territorial
restriction, incomplete information, resource cost, risk of exposure, hidden protection,
strategic usefulness, or a conflicting objective. **Never unexplained plot armour.**

The most common real answer is a Dao house or a dormant sect ancestor: *"I could probably
kill him. But what happens afterwards?"* See [`dao-houses.md`](dao-houses.md) and
[`sects.md`](sects.md).

## The powerful act indirectly

<!-- tier: 2 trigger="a powerful figure could act on the player directly and does not" -->

Very powerful characters usually avoid direct confrontation. They manipulate factions,
send disciples, control resources, spread or suppress information, conceal their identity,
create incentives, arrange conflicts, and work through intermediaries. One may shape
events around the player for years before the player learns they exist.

---

## Characters persist after they are surpassed

<!-- tier: 2 trigger="the player has grown past an NPC who mattered earlier" -->

This is among the most important rules in the design, and it names a specific failure
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

<!-- tier: 2 trigger="somebody who matters is weaker than the people around them" -->

Never implement `stronger NPC = more important NPC`. A character can matter because of
knowledge, family, faction, political authority, history, secrets, relationships,
resources, expertise, reputation, territory, emotional connection, or unfinished goals.
Cultivation is one axis among many.

Their continued relevance is carried by: things they did (founded a sect, fought a war,
sealed an enemy, created a technique, swore an oath, caused a disaster), and by lineage -
parents, children, siblings, descendants, disciples, ancestors. The player may surpass an
NPC and then become entangled with their family, their sect, or the consequences of
something they did three centuries ago.

This is a code rule as well as a design rule: nothing in the social layer may rank people
by cultivation. See
[`../../src/engine/social/README.md`](../../src/engine/social/README.md).

### The cast grows sideways

<!-- tier: 3 -->

The protagonist grows vertically; the cast must grow **horizontally**. Friends, rivals,
mentors, disciples, family, faction leaders, merchants, scholars, enemies, political
contacts, ancient figures. The player should *accumulate* relationships, not continuously
replace old characters with stronger versions of the same role.

Powerful NPCs must also have their own lives - goals, relationships, history, factions,
secrets, conflicts, resources - and pursue things that have nothing to do with the player.
**A powerful character does not exist to demonstrate how strong the next opponent is.**

### Death is a world-state transition

<!-- tier: 2 trigger="an important character dies" -->

When an important character dies: their faction reacts, their family reacts, their
disciples react, their enemies react, succession begins, resources move, alliances shift,
rumours spread, and their unfinished goals remain. A powerful dead cultivator stays
historically important.

Death does not remove someone from the simulation; it changes their mode of existence. The
state set for that is in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md).

---

## And none of it is promised to the player

<!-- tier: 3 -->

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

## Related

<!-- tier: 3 -->

- [`../../src/engine/social/README.md`](../../src/engine/social/README.md) - relationships, grudges, belief, secrets
- [`../../src/engine/world/README.md`](../../src/engine/world/README.md) - NPC records, goals, lineage
- [`sects.md`](sects.md) - the institutions these people are inside
- [`tone.md`](tone.md) - how to write them
