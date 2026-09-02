<!-- tier: 2 trigger="the player encounters something above their current stratum, or asks about the wider world" -->

# Discovery: the world reveals itself upward

How the player learns the world is bigger than they thought, and the rule that protects it.

Read with [understanding.md](understanding.md) (access gates comprehension) and
[sects.md](sects.md).

## Three ways in, and they are different questions

<!-- tier: 2 trigger="the player asks what lies beyond what they have already met" -->

Most of this document is about the first of these, and for most of a cultivator's life
that is correct. It is not the whole of it.

| | What it is gated on | What it yields |
|---|---|---|
| **Being told** | proximity, and whether they are willing | names, and everything a name carries |
| **Seeing** | your rung | the world, and nothing that lives in it |
| **Demanding** | your standing, and whether they can refuse you | what one person will say, under pressure |

The second was missing, and its absence had shaped the whole design:

> *"at higher ranks you should just be able to fly and look around. **why should the
> entire thing be dependent on asking? that's a mortal's POV.**"*

Which is right. Everything below this section is an account of how the world reaches a
farm child at Qi Condensation Layer 1, and for that person it is exact and load-bearing.
It is the wrong account of somebody who can leave the ground. **A Void Refinement
cultivator does not need a carter to mention that there is a mountain over there.**

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [You do not start knowing what exists](#you-do-not-start-knowing-what-exists) | the player asks what lies beyond what they have already met |
| [What you can see, which is not what you have been told](#what-you-can-see-which-is-not-what-you-have-been-told) | the player is above Foundation and asks what is around them |
| [Making somebody tell you](#making-somebody-tell-you) | the player puts weight behind a question |
| [The ladder of knowing](#the-ladder-of-knowing) | the player learns of something new, or their grasp of it is in question |
| [Encountering something from above](#encountering-something-from-above) | the player meets something plainly beyond their stratum |
| [The hard rule for the narrator](#the-hard-rule-for-the-narrator) | the narrator is about to name a place, house, or person |
| [Why this is the payoff](#why-this-is-the-payoff) | **Tier 3** - never injected |
| [Characters assume you know](#characters-assume-you-know) | an NPC talks past the player about things the player has never heard of |
| &nbsp;&nbsp;[Overheard](#overheard) | the player is somewhere people are talking and not to them |

## You do not start knowing what exists

<!-- tier: 2 trigger="the player asks what lies beyond what they have already met" -->

A Qi Condensation cultivator in a village does not know the ancient sects exist. Not
"has not visited" - **does not know**. The names have never been said in front of them.
Their world is the county, the local sect that takes disciples, the market town, and
whatever their grandmother believed.

This is not ignorance to be corrected. It is the accurate state of almost everyone, and
the world is *designed* so that most people die in it.

## What you can see, which is not what you have been told

<!-- tier: 2 trigger="the player is above Foundation and asks what is around them" -->

**Perception gives you the world. It does not give you people.**

You can see the mountain. You cannot see whose mountain it is.

| Physical, and a high cultivator perceives it | Social, and it stays behind the gate above |
|---|---|
| That there is a settlement in that valley | What it is called |
| How far away it is, and which way | Whose it is, and what house runs it |
| What the ground under it carries | How far that province carries anybody |
| Whether anything is standing on it | Who is standing on it |
| What a compound looks like from outside | That it is a sect at all |

This is not a new principle. It is one the setting already holds, pointed at geography:
**an object's nature is realm-gated perception and its provenance is proximity-gated.**
Somebody high enough can tell a relic is genuine anywhere in the world, and no amount of
altitude tells them whose ancestor carried it.

### Flight already existed, and it is not a realm grant

Worth stating because the temptation on reading the ruling is to mint one, and there is
nothing to mint. Flight is in the technique catalog and nowhere else:

```text
gale-riding-sword-flight   ordinal 15   "the first true flight most cultivators achieve"
thousand-li-cloud-tread    ordinal 22   "sustained flight at the height where the air
                                         thins and the birds stop"
'no flight'                             a local law a place may declare
```

So the honest reading is the catalog's own - **leaving the ground is a Foundation-era
capability and real altitude is a Nascent Soul one** - and that is what the perceptual
channel is keyed on. It is deliberately not gated on holding either art: the description
says *most cultivators achieve*, so keying on a technique id would turn a universal
capability into one house's privilege, and gating perception behind something a player has
to be told about would rebuild the exact problem this exists to fix, one layer down.

### One scale, and no rungs in it

What a height buys is **one number**: how far away a thing can be and still be made out,
in the travel days the gazetteer already prices roads in. Everything else is
`distance <= horizon`. A tenth thing visible at a tenth height needs no branch, because
there are no branches on height at all.

Where it lands, read against the roads that actually exist:

```text
below 15         nothing. The next ridge, and the sky behind it
15               your own province, and nothing past it - the shortest road is six days
22               the near provinces. Not the ones seventeen and thirty-four days out
26               the whole world
```

It saturates against the map rather than against a constant, so nothing has to be capped
and nothing has to be maintained. That the world closes at Deity Transformation was not
arranged: the cultivation README already claims *"spiritual perception extends across a
region rather than a field"* for that realm, and the curve arrives there on its own.

**The gate scales; it does not vanish.** Below the floor the read returns nothing at all,
and says so, and says what would change it. And what a cultivator at the top of the ladder
gets is still shapes on ground, a bearing and a distance - **never the catalog.** The list
of everything that exists stays something the world has to say out loud.

`src/web/what-you-can-see-from-up-there.ts` owns this, and the enforcement is in the type
rather than in a rule: a `Sighting` has no name field, so the module cannot leak one
because it is never handed one.

### What the engine has no answer for yet

**The awareness ladder below has no rung for what perception produces.** It runs
`unaware -> whisper -> named -> placed`, which assumes the name arrives first and is then
located. Seeing inverts that: you know exactly where a thing is and have no idea what it
is called. There is currently nowhere to record that, so a sighting is a read and not a
knowledge row, and **a player cannot yet set out for something they have only seen.** The
setting already knows what that would look like - a Blown Ground finder *"sells the
location once and does not lead the buyer to it; the buyer takes the direction and the
distance and finds it themselves"* - so the shape exists and the machinery does not.

## Making somebody tell you

<!-- tier: 2 trigger="the player puts weight behind a question" -->

> *"you can **DEMAND** knowledge. whether it succeeds is whether people respect you -
> either via power or something else."*

**A demand is not a politer ask with a louder voice, and it is not a second system.**
Asking depends on somebody being willing. Demanding depends on their being unable, or
unwilling, to refuse - and what decides that is already modelled in full: the gap in
standing, charm, the tie they hold, what is owed your way, what grudges they carry, what
they want from you, who is watching, and how freely that particular person parts with
anything.

That list is what *"either via power or something else"* means, and **the something else
is most of it.** An elder at no great rung who is owed a great deal can demand
successfully. A strong stranger with a bad name may not.

### It does not bypass the gate. It changes who opens it

[`asking.md`](asking.md) gives three limits, and a demand can reach two of them:

```text
1  what this person could know          UNREACHABLE. No amount of standing moves it
2  what they are placed to say          reachable
3  what saying it would cost them       reachable
```

> **Somebody who does not know cannot be made to know, however far above them you stand.**

And that refusal must **read differently** from an unwilling one, or the two collapse and
the whole channel becomes a coin flip. It does, and it is refused before anything is
resolved - no day spent, no attempt recorded, no grudge - because leaning on somebody
about a thing they have never heard of could not have worked.

### And a failed demand is not a failed ask

Being turned down costs a day. **Leaning on somebody and being told no is a different
event**: you have said out loud what you believe your standing to be, been corrected, and
there were people in the room.

The funnier half, and the one that teaches the mechanic fastest: **leaning on somebody who
was going to tell you anyway is a pure loss.** You get the answer, you spend the days and
the marks, and they have noticed which of the two you thought was necessary.

One more property, which falls out rather than being imposed: somebody with a position who
is *made* to answer gives the minimum. **You can make a person tell you, and what you get
is the least they can get away with saying** - less than turning up twice would have got
you for nothing.

`src/web/making-somebody-tell-you.ts` owns the register. Nothing in it decides an outcome:
`resolveAttempt` does, and it is the same call a bribe and a threat go through.

## The ladder of knowing

<!-- tier: 2 trigger="the player learns of something new, or their grasp of it is in question" -->

Awareness moves in stages, and each stage is a different kind of thing:

```text
unaware        the name has never been spoken near you
whisper        an elder mentions something, imprecisely, and changes the subject
named          you know it exists and roughly what it is. Nothing more.
placed         you know where, or who, or when
encountered    you have been in a room with it
known          you have dealt with it, and it has dealt with you
```

**Each step needs a source**, and the sources are scarce: a sect elder who has heard
things, a record in a library you have access to, a traveller, a ruin's inscriptions, an
auction catalogue, a rumour that turns out to be half true - or the thing itself walking
past.

Joining a sect is one of the largest single jumps available, which is another reason a
sect is worth a lifetime: not only access to comprehension, but access to *knowing what
is out there*. An elder saying "there are older things than us, and we do not speak of
them at the outer gate" moves a disciple a whole stage in one sentence.

## Encountering something from above

<!-- tier: 2 trigger="the player meets something plainly beyond their stratum" -->

The texture to aim for when the player finally meets someone from a higher stratum:

**The entourage tells them more than the person does.** Someone from an ancient sect
arrives in a cave the player is exploring, and what makes the moment land is not their
aura - it is the six competent cultivators arranged around them who are *deferring*, any
one of whom would have been the most dangerous person the player had ever met a year ago.
The player does the arithmetic themselves.

Other reliable notes:

- **Casual behaviour reveals scale better than display.** They are not showing off. They
  are mildly inconvenienced. They spend, on something ordinary, what the player has spent
  a decade failing to earn.
- **They are usually not interested.** The player is not a rival, an obstacle, or a
  recruit. Being *ignored* by something enormous is more affecting than being threatened
  by it, and truer to the world.
- **Do not explain them.** Nobody helpfully states what sect they are from or where it
  stands. The player leaves with a fragment - a crest, a manner, a phrase, a name they may
  or may not have heard right - and finds out later, or never.
- **The stratum keeps existing afterwards.** Whatever was revealed does not become
  reachable because it was seen. Seeing is a knowledge state, not an access state.

## The hard rule for the narrator

<!-- tier: 2 trigger="the narrator is about to name a place, house, or person" -->

> **Never reference an entity the player has no knowledge record for.**

This is the enforcement the whole design depends on, and it is the easiest thing for a
narrating model to break - it will cheerfully drop an ancient sect's name into a
description because the name is in its context and the sentence wants one.

Concretely:

- If the player has never heard of a faction, it may not be named in narration, not even
  in passing, not even as colour.
- It can still *act*. The consequence arrives without attribution: a road is closed, a
  price moves, a village is empty, a body is found. **The world may act on a player who
  cannot name what acted.**
- When a name does surface, it should surface from a source the player can point at, and
  the knowledge layer should record where they got it - because a name learned from a
  drunk in a market town and a name read in a sect archive are different facts, and one of
  them may be wrong.

The knowledge layer already models exactly this: what is true, what a person knows,
believes, suspects, and what the public believes are separate. Awareness of *existence* is
a knowledge record like any other. There is no new machinery here - only the discipline
not to spend it.

**And the perceptual channel does not soften this rule by one word.** A cultivator who can
see a compound from the air has seen a compound. They have not learned a name, and the
narrator still may not supply one - not as colour, not in passing, not because the
sentence wants it. What the engine hands over up there is a shape, a bearing and a
distance, and the correct narration of it is a shape, a bearing and a distance. If a
paragraph about something seen from height contains a proper noun, the rule has been
broken in the one place it is easiest to break it and hardest to notice.

## Why this is the payoff

<!-- tier: 3 -->

Power progression and world revelation are the same movement. As a cultivator rises they
do not merely become able to survive more; they become able to **perceive** more, be
admitted to more, and be told more. The mountain was always a formation node. The ancient
sect was always there. What changed is that someone finally said the name where they could
hear it.

And the sequence should keep going long enough to be humbling more than once:

```text
"the strongest person I know is the sect's Core Formation elder"
    -> "our sect is not, it turns out, an important sect"
        -> "there are institutions that regard mine as a tenant"
            -> "the person who ignored me in that cave has been dead for a century,
                and what I met was a projection"
```

Each rung should arrive rarely, be earned, and cost the player a comfortable belief.

## Characters assume you know

<!-- tier: 2 trigger="an NPC talks past the player about things the player has never heard of" -->

The rule above governs the **narrator's own voice**. It does not gag the people in the
world, and it must not.

A cultivator will say a name flatly, with no context, because *of course* you know it -
everyone they have ever spoken to knew it. They are not withholding. It does not occur to
them that explanation is required, any more than you would explain what a road is.

> "Road's shut past the ford. Sill business, so it'll be shut a while."
>
> He says it the way you would say a bank holiday, and moves on to the price of salt.

This is the **primary way names should enter the player's world**, and it is better than
any deliberate revelation:

- The player hears a name they cannot place, cannot act on, and cannot evaluate.
- It goes into the knowledge layer at the lowest stage - *heard*, not *known*. They have
  the word and nothing else, from one interested source who may be wrong.
- **The narrator still may not explain it.** A character said a name; that grants the name,
  not the meaning. If the next paragraph tells the player what the Sill is, the
  moment has been spent for nothing.
- The player may **ask** - and asking is a real act with a real cost, because not knowing
  marks them. The answer depends entirely on who they asked: a shrug, a short correction, a
  look, amusement, suspicion about where they are from, a lie, or an honest answer that is
  out of date by two centuries.

Notes:

- **Not knowing is legible to others.** Asking who the Sill are, in the wrong room,
  tells everyone present exactly how far you have come from. That is a social fact with
  consequences, not merely a missed opportunity.
- **The mundane and the enormous sound identical** when both are assumed knowledge. The
  same flat register carries the name of a local ferryman and the name of something that
  has not been seen in nine hundred years. The player cannot tell which is which, and
  neither can the speaker's tone - because to *them* both are ordinary.
- **A name heard is not a name understood.** Record the source. A name from a drunk carter
  and a name from a sect archivist are different facts, and the carter's may still be the
  true one.

### Overheard

<!-- tier: 2 trigger="the player is somewhere people are talking and not to them" -->

The sharpest form, because the option to ask is gone.

Two elders talking on the other side of a courtyard wall. Not to the player, not for the
player, and not moderated for an audience. They use names, shorthand, half-sentences and a
shared history neither is going to summarise. One of them is annoyed.

> "- and if the Marches send another, we send it back with the same answer."
>
> "You will not be the one answering. Ninefold has already been asked."
>
> A pause. Then, quieter, about the weather.

What the player gets:

- **A fragment they cannot resolve.** Two names, a relationship implied between them, an
  event that has apparently already happened, and no way to place any of it.
- **No opportunity to ask.** Interrupting is impossible or unwise. Asking *later* reveals
  where they were standing, which is its own problem.
- **Knowledge with compromising provenance.** They know something they cannot admit to
  knowing. Acting on it exposes how they came by it - so the fact sits in their hands
  unusable until it can be corroborated from somewhere they are allowed to have got it.
  Record the source honestly as *overheard*; it should read differently from *told*.
- **Possibly about them.** Not always. But the version where the player realises, four
  sentences in, that the thing being discussed is *them* is the best use of the device and
  should be rare enough to land.

Rules for writing one:

- **Write it as it would actually be spoken** - elliptical, mid-conversation, assuming
  everything. Do not have either speaker helpfully restate context for the benefit of a
  listener they do not know is there. That is the whole failure mode this exists to avoid.
- **Do not resolve it in the same scene**, or ideally for a long time. An overheard
  fragment that is explained a paragraph later was just exposition wearing a costume.
- The player may be **wrong** about what they heard, and should sometimes be allowed to act
  on a misreading. A half-heard name and a confident conclusion is a very ordinary way for
  a cultivator to get into trouble.
- The speakers should have been having this conversation anyway. If it exists to inform the
  player, it is a briefing with a wall in front of it.
