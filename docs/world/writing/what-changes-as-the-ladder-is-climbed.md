<!-- tier: 3 -->
<!-- no-catalog: this is a craft note about register, not about any catalog. The rungs it is organised by live in realms.ts, and the reads it names live in the web layer. -->

# What changes as the ladder is climbed

Calibration notes about register at different heights of the ladder. No source
is named here, for the same reason no source is named anywhere in this repo: the
design is an amalgamation and citing one work misrepresents it.

**Read the next paragraph before you use anything below it.**

> **The evidence here is thin, and deliberately labelled as such.** It comes
> from about a dozen chapters, sampled at intervals across the arc of a couple
> of long works, read once. That is a small enough sample that any single
> observation below could be an artifact of which chapters happened to be
> sampled, of one author's habits, or of a translator's. Nothing on this page
> was measured, counted, or checked against a second reader.
>
> So this file is **a set of hypotheses about register, not a finding and not a
> rule**. The one thing on it that carries real weight is the design owner's
> ruling in the next section, which came from the owner and not from the
> sample; the chapter observations are at best corroboration for it. When
> something here disagrees with a ruling, with the code, or with what plays
> well, it loses, and no argument from what the chapters did should be made.

The reason it is worth writing down at all: the repo's existing voice rules are
good and they are **calibrated to the bottom of the ladder**, against a run that
spends its early hours at Qi Condensation and its late ones somewhere else
entirely, with one unchanging narrator throughout.

---

## One rule, and the rest falls out of it

The design owner, cutting through the observations below:

> *"the higher up you are the more you know about the world, and the more you
> influence. at the beginning ur a village. at the end ur orchestrating the rise
> of the Azure Cloud Pavilion."*

**Rung is reach.** It is how much of the world a person can see and how much of
it moves when they act. Those two scale together and everything else on this
page is downstream of them.

At the bottom the reach is one village. Nobody has heard of you, and the
ordinary reaction to you arriving is some version of *who are you*. You cannot
perceive a rung, so nobody states one. Nobody explains anything, because nobody
has a reason to explain anything to you. Your problems are a day wide: food,
cold, the road.

At the top the reach is a house or a region. You can perceive rungs, so rungs
are ordinary conversation, and what you do lands on institutions rather than on
an afternoon.

**But the world did not become more forthcoming, and this is the part that is
easy to get wrong.** The owner, correcting exactly that reading:

> *"and if you ask a rando villager THEY STILL DON'T KNOW. But at Tribulation
> Transcendence those Core Formation disciples posted outside know, and your
> elders know what affects the region. It's exactly like how CEOs work."*

So the villager is the same villager at both ends of the game and knows the same
things. Nothing about your rung makes them better informed, and a narrator that
has the innkeeper start explaining regional history because the player got
strong has the mechanism backwards.

**Knowledge is a property of the person being asked. Never of the person
asking.** What climbing buys is not better answers from the same people: it is a
different set of people standing near you. Disciples posted outside a ruin whose
posting is to know what is in it. Elders whose business is what moves in the
region. A house that keeps records because keeping them is what a house is for.

The comparison the owner drew is the exact one: a chief executive does not get
better answers out of the front desk than anybody else does. What they have is a
staff, and people whose job is to have already found out. Same world, same front
desk, different position on the chart.

So the register changes at height not because the prose gets grander but because
**the character's position in the world changed and the prose is still honest
about it.** A narrator that talks the same way at both ends is being dishonest
at one of them.

The rest of this file is what that looks like in practice. Do not over-index on
any single item below: they are symptoms, and the rule above is the cause.

## And influence works the same way: you are admitted, you do not expand

The other half of *rung is reach* is influence, and it has the identical shape.
The owner, in four lines:

> *"you influence strategy. that should fall out. it's not really the world. but
> you get plugged into leadership infrastructure?"*

So a high cultivator does not personally move a region any more than they
personally know it. **They get admitted to the rooms where a house decides what
it is going to do, and the house moves the region.** The influence is over
strategy rather than over the world directly, and it is exercised through an
apparatus that already existed and was already running before they arrived.

*"That should fall out"* is the standing instruction and it applies cleanly
here: this must not be legislated as a rung rule. The repo already holds houses,
ranks, member rolls, grant chains and obligations, and admission to the rooms is
a fact about a rank on a roll. If a high cultivator's strategic influence has to
be written as its own mechanism, then the house machinery is what is underbuilt,
and that is where the fix belongs.

And the rooms are not interchangeable. **An apex house's leadership is
discussing different subject matter than a county house's**, not the same
subject matter at greater volume: what an era is doing, which houses are
combining, what is coming out of somewhere nobody has opened in an age. A small
house's leadership is discussing a road, a debt, and a marriage. So being
plugged in higher changes the *agenda* a person is exposed to, which is the
mechanism behind "the higher up you are the more you know" without any of it
being a property of their body.

## The unit of narration changes

At the bottom it is **one person with one physical problem**: tracking an
animal, killing something to eat, getting to a place before dark. Weather and
ground are established first and the person is narrowed to afterwards.

Through the middle it becomes **a faction**: who is on whose roll, who is owed
what, which hall a matter has been sent up to.

High up it becomes **a polity or an age**: a race, an army, an era, a treasure
that covers a region. Individuals are referred to by class rather than by name,
and years of consequence are summarised in a clause.

And then it comes back. Late chapters still spend whole scenes on two people in
a room noticing that a third is behaving oddly. **Scale oscillates; it does not
escalate monotonically.** A narrator that gets grander every rung and never
returns to a quiet room has the shape wrong.

## How a person is read changes

| rung | what a stranger is read off |
|---|---|
| bottom | clothing and its condition, and what is lying next to them |
| middle | rank, house, and who defers to them |
| top | what class of being they are |

At the bottom nobody perceives a rank, so nobody states one: a man is read off a
worn robe, a limp, an empty sleeve, or the three corpses beside him, and the
reader draws the conclusion. This is what `whatTheyCanPlaceAbout` is for and the
engine already holds it.

**The game currently reads everybody the same way at every height** - a standing
comparison against the player - which is right for none of the three rows.

## Power comparison is a high-rung register, not a defect

`AGENTS.md` and the narrator prompt ban power-level exposition outright. That
ban is correct at the bottom, where nobody can perceive a rung and saying one
aloud is the engine leaking.

It is not what the genre does at height. Late chapters state plainly that a
particular art could shake a particular class of being, and rank one named
ability against another. At that point the vocabulary IS the world's own: people
who can perceive rungs talk about rungs.

**Ruled, and it turns out not to be about height either.** The axis is the
speaker, exactly as with exposition above: somebody whose job is to appraise
says what they appraise, and the narrator never says it on its own account. A
gate disciple posted to size up arrivals states what they see. A villager does
not, at any point in the game, because a villager cannot see it.

That leaves the discovery gate untouched, which is why this reading is preferred
to a rung-aware ban. The gate withholds what a player cannot place; this rule
only ever puts words in the mouth of somebody who could. The two looked
entangled because both were written as rules about the player. Neither is.
See `docs/world/houses/discovery.md`.

## Exposition belongs to somebody whose job is to know

The show-never-explain rule reads like a rule about height and it is not. It is
a rule about **who is talking**: nobody explains the world to somebody who has
just left their village, because in the village there is no such job.

The job is what changes, not the rung. A disciple posted outside a ruin can say
what era it is from and what has been coming out of it, because that is the
posting. An elder can say what is moving in the region, because that is what an
elder is for. A records hall answers questions about lineage because answering
them is the hall. Every one of those people could be met by a low cultivator who
happened to be standing in the right place, and would answer the same way.

What height changes is **how many such people are within reach and how many of
them owe you an answer.** At the bottom you rarely meet one and have no claim on
them. At the top several of them work for you.

So the test on an expository line is never *is the player high enough for this*.
It is **whose job was it to know this, and are they here**. That question already
has an answer in the engine: a posting, a rank, a records hall, the house that
holds the ground.

And a cost is stated with the history rather than with the power alone: what a
class of technique is, which era made it, and what it does to the people who use
it, in one breath.

## The costs are graded, and the grading is the content

Whenever a strong thing is introduced late, its price is introduced in the same
breath, and the price scales with the strength. The stronger the art, the worse
what it does to the person using it.

This repo already has the machinery: grades, the toll, permanent wound rows, a
foundation that can be set wrong. The note here is about EMPHASIS. A late-rung
answer that states a capability without stating what it costs is missing the
half the genre thinks is interesting.

### An example: a gift at height

One worked case of the rule above, and only that - it is not its own law.

The design owner: *"if someone gives you something, THEY BETTER KNOW."*

Low on the ladder a thing can change hands by accident. Somebody sells a slip
without knowing what is folded into it, a book is worth more than the stall
holder thinks, a dead man's pack is opened by whoever found it first. That is
most of the economy and it is fine.

**High on the ladder there are no careless gifts.** Somebody at that height who
hands a thing over knows what it is, what it costs, where it came from and what
it will do to the person taking it. If the reason looks strange, the reason is
simply above the receiver's stratum - which is the rule `immortal-items.ts`
already states about immortals being neither sloppy nor mistaken, read from the
giving side.

So the asymmetry at height is not knowledge against ignorance in general. It is
that **the ignorance is all on the receiving end**. A player handed something by
somebody far above them has been handed a decision that was already made, for
reasons they cannot yet read, and the interesting question is never "did they
mean to" - they did - but "what does it cost me that I cannot see yet".

What this asks of the engine, none of which is a new system:

- A transfer from far above should never resolve as a random or incidental
  draw. `provenance` already records who handed a thing over and why; at height
  that entry is the content rather than the bookkeeping.
- The receiver's read of it should be gated the way everything else is. They
  hold the object and not the reason, and `whatTheyCanPlaceAbout` is the shape
  that already says so.
- A gift at height that the narration presents as luck is the same defect as
  power-level exposition at the bottom: the wrong rung's register.

## Humour survives to the top

It is not a low-rung flavour that burns off. The same work that opens on a
village celebrating that the protagonist has finally left is still making jokes
at its own hero's expense a thousand chapters later, while he is fighting things
that could unmake a region.

`tone.md`'s humour section is tier 1 for this reason. It was tier 3 and never
reached the narrator, which is why the prose read as uniformly bleak.

## What this suggests, in order of confidence

Confidence here means **what the item rests on**, not how strongly it is felt.
The first two follow from the owner's ruling and would stand if the chapters had
never been read. The rest rest on the sample, which is thin, so they are worth
trying and not worth defending.

1. **Follows from the ruling.** The register is not one register. Anything that reads the same
   at Qi Condensation and at Tribulation Transcendence is wrong at one end.
2. **Follows from the ruling.** A person read should change what it reads them off as the rung
   climbs. Clothing and circumstance low, rank and house middle, class of being
   high.
3. **Follows from the ruling.** Neither the power-exposition ban nor the
   show-never-explain rule is about the player's height. Both are about whether
   the speaker's job is to know, and rung only changes who is standing near you.
4. **Thin: sample only.** Scale should be allowed to come back down. A quiet room is a
   correct late-game scene.
5. **Thin: sample only, and worth testing.** Late-rung answers that name a capability should name its
   price in the same answer.
