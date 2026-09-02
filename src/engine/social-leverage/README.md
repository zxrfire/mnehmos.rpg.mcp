<!-- tier: 3 -->

# Working On A Person

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected
> into a narration prompt.

A cultivator should be able to work on a person the way they work on a wall, and
it should sometimes be ugly, because this is a world with demonic sects in it.
This directory is the mechanism: seduction, bribery, deception and threat as one
resolver with real odds, real costs, and marks that outlive the moment.

Read this before changing anything in `src/engine/social-leverage/`.

## Why it is not in `engine/social/`

`engine/social/` is **storage**, and its charter forbids three things this
directory needs: scoring, weighting, and reading the ladder. So the two sit
side by side. This one decides; that one remembers. Every record produced here
is written in `social/`'s own types - an `ObligationInput`, a `Relationship` -
and nothing here persists anything itself.

```text
engine/social/            what the world remembers.  No scores, no ladder.
engine/social-leverage/   what happens when somebody tries.  Both.
```

## The rule this directory was most at risk of breaking

`src/web/actions.ts` states it:

> `intent` is a free-ish label, and it is safe precisely because NOTHING in the
> engine branches on it to decide an outcome. The moment a line of code reads
> `if (intent === 'bribe')` to pick a result, the design has failed.

**No function in this directory has ever seen the player's intent string.** What
it reads instead is `Approach.leverage` - the existing closed enum in
`schema/cultivation.ts` saying what is actually on the table - to which one
member was added: `attachment`, alongside `coin`, `favour`, `debt`, `name`,
`sect`, `force` and `secret`.

That single enum member is the whole of the schema change, and it is what makes
this not-bespoke. Seduction is priced by the machine that already prices a purse
and a threat. Take the leverage away and there is no seduction system left over.

## Charm works everywhere. The fallout is what differs

The design owner's ruling, and the load-bearing sentence for the whole
directory. `an-attempt-to-move-somebody.ts` reads **no faction and no
alignment at all**: a righteous elder, a demonic cultivator and a free-port
factor are resolved by the same function against the same terms, and there is
nowhere in this world somebody cannot be asked. A test pins it.

Everything that varies is downstream, in `what-a-house-will-do-about-it.ts`,
and it asks two questions that are **allowed to disagree**:

| | will it back you running one | what it does when done to one of its own |
|---|---|---|
| **righteous** | forbidden, for the channels that use a person | takes it up. One person's account becomes the house's |
| **demonic** | supplies it, and may have set the task | prices the member. You were moved and did not notice |
| **neutral** | prices it against the exposure | collects it. Leverage, not vengeance |
| **no house** | tolerated - a wanderer answers to nobody | nothing |

A righteous house refusing is not a moral gesture. It is a rule with a price: a
righteous cultivator running one is doing it *without their house*, which means
no leverage supplied and a second exposure waiting.

## The four outcomes

Two is not play.

```text
taken     they did it, and the tie or the obligation is real
turned    they did it AND took hold of you.  The bribe that buys somebody
          who then owns you back - a debt written the other way
refused   they said no, and now they know what you tried
reported  they said no and it reached their house
```

## Romance and using somebody are the same move until the numbers diverge

The tie written is **directed**, because `relationships.ts` is directed, and the
asymmetry is the entire mechanic:

- **their** side grows every time the attempt lands
- **your** side grows *only when you asked for nothing*

So a player who keeps coming back without wanting something ends up in a mutual
tie, and a player who does not ends up holding a strong one-way attachment they
can spend. The difference between courting somebody and working them is whether
you ever came back empty-handed, and it falls out of the arithmetic rather than
being declared anywhere.

## Being turned down and being found out are different injuries

`an-attempt-to-move-somebody.ts` writes refusals at `slight` or `serious` and
**can write nothing heavier**. Everything `grave` and `unforgivable` is written
by `when-somebody-works-out-what-you-did.ts`. That gap is the design.

The discovery is its own dated event with its own roll, because the years in
between are years the player spent believing it had worked cleanly. It can
never fire: somebody dying still attached and still wrong about it is a
legitimate outcome and the commonest one.

The consequence layer is `grudges.ts`, unchanged - the aggrieved party holds it,
the way `combat-manage.ts` writes a feud, and it is inherited on death like
everything else in that ledger.

## Both halves of the game

The repo's commonest defect is a system that binds every NPC and never reaches
the played game, or the reverse. The same resolver runs on both:

- **the player** - through `GameService.interact`, which before this returned
  `outcome: 'refused'` and *"Attempt recorded; outcome not resolvable yet"* for
  every approach ever made.
- **the world** - `leverage_applied` and `leverage_understood` in
  `world/the-world-changing-on-its-own.ts`.

`scripts/probe-does-anybody-actually-work-on-anybody.ts` is the guard on the
second half, and it earned its place: it found **four** separate gates that each
independently held the world's rate at zero, none of which any test caught.
See that file and the comments at the two templates.

## A fight two people arranged is the same shape

The directory's charter is *what happens when somebody tries*, and it is not
only about persuasion. `going-further-than-an-agreed-bout-allowed.ts` answers
the same question for a spar, a duel, a challenge - and it obeys the same rule
as `an-attempt-to-move-somebody.ts`, in the place that rule matters most.

The design owner's ruling, from AGENTS.md:

> **Kill somebody during an agreed bout and you will obviously face
> consequences.**

Nothing stops you. The bout runs through `resolveConfrontation` with the same
goal, the same exchanges, the same wounds and the same death gate a killing
runs through, and there is no path anywhere by which the word "spar" changes
what a body suffers. **The wound was identical. The meaning was not**, and the
whole of the difference is a downstream table in this directory.

|  | crippled | killed |
|---|---|---|
| **open terms** | `serious` | `grave` grudge |
| **agreed terms** | `grave` | `unforgivable` **blood feud**, and standing off the actor's own house |

Three things about it are load-bearing:

- **`terms` is a closed value set by the parser**, beside the verb, exactly the
  way `Approach.leverage` is - so nothing here has seen the player's sentence,
  and `combat.ts` and `combat-manage.ts` mention neither the type nor the
  module. A test reads both files and requires that to stay true.
- **An arrangement names the actor on its own.** The dead one's people know who
  they went to meet, so an empty courtyard is no protection and the account
  opens at full weight with nobody watching. That is why there is no
  body-on-the-low-road line here and why witnesses only price what the actor's
  own house has to have a position on.
- **It writes the record the loser's PEOPLE hold, and never the loser's own.**
  `seedObligations` in `cultivation/combat.ts` owns that one and is unchanged.
  For a killing it correctly writes nothing - the dead hold nothing - and the
  mistake was that nobody else was ever asked.

## Reading order

```text
an-attempt-to-move-somebody.ts          the odds, the four outcomes, the marks
what-a-house-will-do-about-it.ts        the alignment split, entirely downstream
when-somebody-works-out-what-you-did.ts the delayed discovery and its grudge
going-further-than-an-agreed-bout-allowed.ts
                                        the same job for an arranged fight
```

## Related

- [`../social/README.md`](../social/README.md) - the storage layer this writes into
- [`../cultivation/regard.ts`](../cultivation/regard.ts) - where the standing term comes from
- [`../world/manuals.ts`](../world/manuals.ts) - `ifCaughtPractising`, the pattern the alignment split copies
