<!-- tier: 3 -->

# The Social Memory Layer

> **Tier 3 - reference.** Design rationale and the contract of the code beside it. Never
> auto-injected into a narration prompt. The narrator's always-loaded text is
> [`../../../docs/world/NARRATOR-CORE.md`](../../../docs/world/NARRATOR-CORE.md).

What the world remembers about people, and what it has wrong. Relationships, the
obligation ledger, the epistemic layers, and secrets. Read this before changing anything
in `src/engine/social/`.

This layer is **storage, not simulation**. It guarantees that a grudge, a debt, a
relationship, a false belief or a stolen secret is still on file, exact and dated, forty
years and three generations later. The reasoning - whether the grudge is worth acting on,
whether the man is trustworthy, how the sect responds - belongs to the LLM, which reasons
from these records. See [`../README.md`](../README.md).

Three prohibitions shape everything here.

## Nothing decays, weights, or scores

There is no intensity curve, no reputation scalar, no incentive threshold, no expiry
column, no "stale record" sweep. A grudge does not get quietly smaller because time
passed, because a decay function is the engine making a judgement about how much someone
still cares. Records change when an **event** changes them, and events are written down.

A record leaves the open ledger exactly one way: something happens and somebody writes a
settlement saying what.

## Nothing ranks people by cultivation

No query in this directory orders, filters or prioritises people by realm ordinal. A
character matters here because of knowledge, family, faction, political authority,
history, secrets, relationships, resources, expertise, reputation, territory, emotional
connection, or unfinished goals. Cultivation is one axis among many, and it is not this
layer's axis.

The design reason is in
[`../../../docs/world/houses/people.md`](../../../docs/world/houses/people.md) - "importance is not
cultivation," and characters must persist after they are surpassed. A ranking query is how
that rule quietly stops being true.

## Belief is stored separately from truth, and belief may be false

These tables deliberately store things that are **false**. A knowledge record is not a
fact. A secret holding with status `falsified` is not the secret. Ground truth lives in
the world layer's history, and no character-facing query is allowed to read it directly.

---

## Relationships as first-class persistent state

The governing instruction is a prohibition: **do not reduce relationships to one
reputation number.** A single scalar can express "likes you 0.7". It cannot express "my
former disciple, who I taught for eleven years, who left without a word after the
Sweptground affair, who I would still take back" - and that sentence is the actual unit of
drama in this world.

So a relationship is a record with a type, a strength, a running history, the events that
made it what it is, and a current attitude in plain words.

**Directed.** `from -> to`, two rows, not one. A master's view of a disciple and that
disciple's view of the master are different objects with different attitudes, and the
interesting cases are exactly the asymmetric ones: he thinks they are friends; she has
been waiting nine years for an opening. `mutual` returns both halves so a caller can see
the gap.

---

## Grudges, gratitude, and the obligation ledger

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

The requirement is a **memory** requirement, not a behaviour requirement. The acting is
the narrator's job. The remembering is this module's, and it is the part a language model
cannot do on its own: a model that has to be reminded is a model that will eventually not
be.

`grudges.ts` holds grudges, debts, favours, oaths and blood feuds, and inherits the open
ledger on death via the world layer's `heirsOf` - see
[`../world/README.md`](../world/README.md).

**The cause lists are data and nothing in the engine branches on one.** They keep growing,
and the growth is harmless only while that stays true:
`../social-leverage/what-a-deed-leaves.ts` prices a deed from what it *cost*, whether it
comes back, and whether a word was given first - never from which word is on it - so a
wrong nobody has thought of yet arrives with a cost and gets a weight without anybody
editing a table. A `switch` on a cause that decides an outcome is a bug, not a feature.

### An account opens when somebody finds out, not when it happens

**The deed does not open the account. The telling does.** AGENTS.md's *a fact reaches a
person, and reaching them is an event* is the ruling; `hearing-of-a-wrong.ts` is the join
and `accounts-with-no-name.ts` is the state it needs that the ledger did not have.

The deed was already true and already on the record. What was missing was somebody who
could act on it, and being told supplies exactly that - so **a wrong nobody witnessed
stays true, stays findable, and opens nothing.** That is what makes doing a thing quietly
worth doing.

There are **three states, not two**, and the middle one is where most people live:

| | what they hold | the row |
|---|---|---|
| 1 | nobody has noticed yet | none |
| 2 | it was done, and they cannot say by whom | open, `subject_id` NULL |
| 3 | who did it | the subject attaches, same row id |

**State 1 is not "they hold nothing about it."** From the design owner: *the ledger is not
empty before being told, it is there, they just don't have an outlet for their anger.* A
brother who is dead is dead, and the people who loved him do not need a teller to start
grieving - so **what being told supplies is not the wrong, it is the target.** State 1 is
the window before anybody NOTICES, and you leave it by noticing rather than by being told.

That is why `whatADeedLeaves` opens an unnamed account for a relative who cannot name the
actor, instead of nothing. The one exception is a **deniable** deed - a poisoning that
reads as a qi deviation, a junior left somewhere that reads as bad luck - where nothing
says a deed was done at all, and `Deed.deniable` is that field.

State 2 is why a killing with no witness still has a consequence, and it is what changes
what silencing a witness buys: **killing the only person who could name you converts a
named account into an unnamed one that goes looking.** You buy time and a wrong name, not
absolution.

Four rules govern all of it, and each one is a thing a future reader will otherwise undo:

- **The account is dated to the day they were told**, not the day it happened. One field,
  and the whole ruling.
- **The weight is the deed's.** Decided once, at creation, exactly as this ledger already
  requires. Finding out late makes a thing HELD, never heavier or cheaper.
- **It opens against whoever the telling NAMED.** There is deliberately no check that the
  name was right, because a hearer who could tell a true telling from a false one is a
  hearer with `KnowledgeLedger`'s omniscient view. `retell` already swaps the doer under
  `misattributed`, so a grudge held with complete conviction against the wrong man falls
  out of machinery that was already running.
- **Whether state 2 is available is a property of the ACT, not a list of causes.** One
  question: *could a stranger have done it?* A theft in the dark could; a betrayal could
  not, because being betrayed means somebody you had something with turned on you and the
  name came with the wrong. `theWrongedPartyAlreadyHasTheName` asks it of fields the deed
  already carries - never of the word on it.

**The record is never conditional on knowledge.** `world_chronicle` holds the deed and
provenance holds it whatever anybody knows. What is conditional is who holds an ACCOUNT
about it, and conflating the two deletes the thread that makes a quiet wrong discoverable
later.

An account with no name on it stores NULL, and there is exactly one stored representation
of it: `optional-obligation-subject.ts` relaxed the column and converted the empty strings
that briefly stood in. `NO_NAME_ON_IT` and `hasANameOnIt` are the read path, so nothing
else compares to either form.

**`triggering_event_id` names `world_chronicle.id`, not `world_facts.id`,** whatever the
schema comment used to say - measured on a played database, `world_facts` held 0 rows and
the chronicle 102, with every obligation resolving against the chronicle. It carries no
foreign key and cannot: the chronicle's key is `(world_id, id)` because fact ids are
per-world sequential text, so a single-column reference is rejected outright and the
composite form needs a `world_id` on `obligations`. Until that exists the migration sweeps
rows naming an event nothing holds, on every startup.

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
house that studies karma is one of the few things that can see the whole thread - see
[`../../../docs/world/houses/dao-houses.md`](../../../docs/world/houses/dao-houses.md).

Severance exists - concealing a connection, cutting one, transferring or redirecting
consequence, erasing traces, breaking inheritance. It is rare, dangerous, and never free.

---

## The four epistemic layers

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

`knowledge.ts` implements this as **five stored states, not five views of one state**:

```text
objective reality
what an NPC knows
what an NPC believes
what an NPC suspects
what the public believes
```

That separation buys two properties that are otherwise impossible.

1. **Characters can act rationally on incorrect information.** An NPC who believes the
   wrong person killed their brother is not confused or badly written. They are reasoning
   correctly from a false premise that is written down, dated, attributed to a source, and
   still on file forty years later. The narrator is handed the belief, never the fact.
2. **The world can be genuinely uncertain**, rather than a database that secretly knows
   everything while NPCs hold incorrect copies.

**Information is therefore a resource** - bought, sold, stolen, hidden, misunderstood and
weaponised. Knowing where a treasure lies, when a secret realm opens, an enemy's weakness,
or which technique counters another is a real advantage.

Progression can come from **knowledge**, not only from stats: discovering that what you
believed about cultivation was incomplete can unlock techniques, paths, regions, factions,
and explanations for things that already happened to you. The cultivation-side statement
of that is in [`../cultivation/README.md`](../cultivation/README.md).

### The ladder of knowing

`discovery.ts` implements the six stages
[`docs/world/houses/discovery.md`](../../../docs/world/houses/discovery.md) specifies:

```text
unaware        the name has never been spoken near you
whisper        a word got said. What it refers to is not known
named          you know it exists and roughly what it is. Nothing more
placed         you know where, or who, or when
encountered    you have been in a room with it
known          you have dealt with it, and it has dealt with you
```

**Nothing bespoke.** A stage is a property of an ordinary `knowledge_records`
row, carried on its own `tags` as `stage:<stage>` and mapped onto the existing
stance vocabulary. There is no stage table, no column and no migration: a row
written before the ladder existed still has a position, derived from its stance
and its source. Every query in this directory that has never heard of stages
keeps working unchanged.

Three rules are load-bearing and each has a test as a guard:

- **Each step needs a source, and the source caps the step.** `stageCeilingFor`
  is that sentence in code. Something overheard through a wall cannot rise
  above `whisper` however often it is re-heard, because the fragment was
  unresolvable and asking about it would reveal where the listener was
  standing. Being told, or reading it, reaches `placed`. Only having been there
  reaches the top.
- **Nothing here ranks the speaker.** A sect archivist and a drunk carter are
  both `told`. What separates them is the note on the row, never a rung - and
  the carter's may still be the true one.
- **Seeing is a knowledge state, not an access state.** No predicate in
  `discovery.ts` takes a realm, a threshold, an admission bar or a faction.
  Reaching `placed` on a sect's ground means the holder can say where it is and
  set out for it; whether the gate opens is the location layer's question and
  is asked separately.

Two predicates come out of it and they are different questions: **has a name
been said near them** (licenses the name, from `whisper`) and **do they know
where** (licenses setting out, from `placed`).

`travellers.ts` is the other half. Of the scarce sources the doc lists, the
traveller is the only one available to somebody with no sect, no archive, no
money and no reason to have been anywhere - so it is the main engine of
discovery for the ordinary case. Where a traveller came from is `placed`, since
they said it with a number of days attached; anything else they mention on the
way past is a `whisper` like any other dropped name. Pure and seeded: same
seed, same day, same place, same person on the road.

### Even the engine may not know

`world_facts` says what is true, but it must be able to say **unresolved**. Distinguish an
objective fact from a historically reconstructed one, and allow genuine gaps:

```text
year 430    an ancient sect disappeared
known       it existed; its territory was abandoned
claimed     destroyed / ascended / sealed itself / migrated
truth       unresolved
```

Otherwise the simulation degrades into "the database secretly knows everything and NPCs
merely hold incorrect copies," which is a much smaller idea than a world with real
uncertainty in it. An unresolved fact also relieves the narrator of inventing an answer
prematurely, and leaves room for one to be found later.

---

## Secrets: a lifecycle, and who is holding each one

`src/storage/repos/secret.repo.ts` and the `secrets` table already exist and are not
duplicated here. That system owns the **content** of a secret: its name, its public and
hidden descriptions, its world, its sensitivity, its leak patterns. `secrets.ts` in this
directory adds the two things that system does not have.

**1. A lifecycle.** The existing model is a boolean - `revealed`, plus the condition that
flipped it. That cannot express a secret that was *stolen* rather than discovered, *traded*
for something, *leaked* by a third party, deliberately *suppressed* after the fact,
*falsified* so that what circulates is wrong, or *misunderstood* by the person who now has
it. Those are different situations with different consequences.

**2. Holders.** `revealed` is a global flag: once true, it is true for everybody. A secret
in this world is held by particular people, in particular states, acquired on particular
dates from particular sources. Two people can hold the same secret in different states,
and one of them can be wrong.

A falsified holding is the sharpest case: what circulates is not the secret, and the
engine knows both.

---

## Reading order

```text
common.ts         day indices, stable ids, engine-owned seeded rolls
relationships.ts  directed ties with type, strength, history and attitude
grudges.ts        grudges, debts, favours, oaths and blood feuds; inherited
knowledge.ts      objective reality kept apart from knows / believes / suspects,
                  and from what the public believes. The heart of it.
discovery.ts      the six-stage ladder of knowing, as a property of an ordinary
                  knowledge record rather than a table of its own
travellers.ts     who came through, and which names they brought with them
secrets.ts        per-holder secret lifecycle, extending secret.repo.ts
shame.ts          a fact about somebody that other people hold and that lowers
                  them - neither a grudge nor a secret
how-near-you-stand-to-somebody.ts
                  how near one person stands to another. The only thing that
                  decides whether they get the story or the fact
what-is-said-about-somebody.ts
                  reputation, derived at read time and never stored
hearing-of-a-wrong.ts
                  somebody finding out, and the account that opens because they
                  did. The three states and the two transitions a telling makes
accounts-with-no-name.ts
                  an account held against nobody, when one can be, and what it
                  makes its holder want
```

## Reputation is derived, and the gap between it and the ledger is the feature

The two halves are deliberately not the same thing:

- **The ledger is what happened.** Grudges, favours, oaths. The engine knows these for
  certain and they never move.
- **Reputation is what is said.** It is downstream of the ledger and *not equal to it*,
  because it travels through people, and people are partial, ignorant, loyal and afraid.

There is **no reputation column, no score, and no `reputationType` field**, and there must
never be one. A written reputation goes stale the instant somebody does something and then
lies with a straight face - the failure AGENTS.md records under *a field nothing writes*,
whose own conclusion is to prefer deriving where the answer moves.

### Truth depends on proximity

One asymmetry produces the whole model, and nothing is enumerated:

> At a distance you get the story, and **from out there you cannot tell whether it is
> true.** Close in you get the fact. Evidence does not travel; it stays where it happened.

So the deserved good name, the fake one, the decent person nobody speaks well of, and the
wrongdoer whose own house has his measure are the *same function* with the observer moved.
`whatIsSaidAbout` runs two passes that are never allowed to inform each other - what
reached them, and what they stand near enough to hold - and reads the gap off the two
answers. Nothing checks a rumour against the ledger, which is what keeps **slander real**:
a bad report is not evidence of a bad deed, and the only cure is somebody getting near
enough to know better.

Proximity is **social first and geographic second**, and it is something a player can
change. Learning the truth about somebody is not a roll and needs no investigation verb: it
is getting nearer to the people who are already near them, which is the courtesy-and-tie
machinery. **The investigation system is the social system.**

### Concealment and a fake good name are different fields

- **Concealment** is about who *holds* a fact - `heldBy` on a shame, `participants` on an
  obligation. Few know; nothing is said either way.
- **A fake good name** is about what is actively *said*. Praise, in circulation, that is
  not earned. That needs speech, not silence.

Either can occur without the other, so one field could not carry both, and they are kept
apart on purpose. Note the difference in how the two record types answer *who knows*: a
shame carries an explicit short list and that list is the whole of the fact, while an
obligation does not - its parties hold it and everybody **near** them can find out, which
is how a house comes to know what one of its own did without anybody having published it.

`shame.ts` is the third thing this layer keeps about a person and it is worth saying why
it is not one of the other two. A grudge is between two parties. A secret is a fact whose
whole value is that it has not got out. A shame is a fact that IS out, among the people who
matter, and costs its subject standing every time it is remembered. It follows the same four
rules as the obligation ledger - nothing expires, severity is a stored word, it is held by
PEOPLE rather than by the world, nothing is ranked by cultivation - and it is deliberately
not a morality system: no code anywhere asks it whether somebody is good.

Its `heldBy` list is the interesting field, because it is what makes a concealed fostering
different from a public one without either of them needing a branch. Where the layer holding
a person has no ledger to write to - `WorldState` holds NPCs, not ledgers - a shame rides on
a prefixed tag, encoded and decoded in the module so nothing else parses one.

`hearing.ts` and `stealth-perception.ts` are retained substrate from the D&D engine
(hearing range and opposed stealth/perception rolls) and are not part of the social memory
model above.

## Related

- [`../README.md`](../README.md) - implementation philosophy and the five pillars
- [`../world/README.md`](../world/README.md) - ground truth, the surviving record, lineage
- [`../../storage/README.md`](../../storage/README.md) - how these tables are migrated
- [`../../../docs/world/houses/people.md`](../../../docs/world/houses/people.md) - why NPCs are protagonists of their own lives
- [`../../../docs/world/houses/dao-houses.md`](../../../docs/world/houses/dao-houses.md) - the houses that study these principles directly
