<!-- tier: 2 trigger="the cultivator is at Tribulation Transcendence or above, or the player is investigating ascension, the Lid, or an immortal ancestor" -->

# The Immortal World

What is on the other side of the Lid, what an ascending cultivator leaves behind, what can
cross in either direction, and why immortal-era play is deliberately thin. **Do not load
this for ordinary play.** It is Tier 2 with a high threshold: the player has to be near the
top of the ladder, or actively investigating ascension, for any of it to matter.

The three ways the last crossing resolves - True Immortal (ordinal 46), False Immortal
(ordinal 45), and the
ordinary failure - are mechanics, and live in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md).

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [It is a place, not only a rank](#it-is-a-place-not-only-a-rank) | the Immortal Realm is described, or somebody asks what is actually on the other side of the Lid |
| &nbsp;&nbsp;[What it is like up there](#what-it-is-like-up-there) | somebody is above the Lid, or the conditions there are being described |
| &nbsp;&nbsp;[They can still die](#they-can-still-die) | somebody assumes an ascended ancestor is safe, or an immortal's survival is in question |
| &nbsp;&nbsp;&nbsp;&nbsp;[And nobody below can tell which](#and-nobody-below-can-tell-which) | a house's channel has stopped answering, or somebody asks whether an ascended ancestor is still alive |
| &nbsp;&nbsp;[A newly ascended immortal is a nobody](#a-newly-ascended-immortal-is-a-nobody) | somebody has just ascended, or a house expects its new immortal to be able to help it |
| &nbsp;&nbsp;[The lower world does not pause](#the-lower-world-does-not-pause) | years pass below while somebody is above, or a returning immortal asks what happened while they were gone |
| &nbsp;&nbsp;[It is not a hard reset](#it-is-not-a-hard-reset) | somebody has ascended and their debts, grudges, descendants, or artifacts below are still in play |
| &nbsp;&nbsp;[Higher layers, later or never](#higher-layers-later-or-never) | **Tier 3** - never injected |
| [The ones who did not get through](#the-ones-who-did-not-get-through) | a False Immortal is encountered, claimed, or counted; or somebody asks how many there are |
| &nbsp;&nbsp;[They have three hundred thousand years and nothing to attempt](#they-have-three-hundred-thousand-years-and-nothing-to-attempt) | a False Immortal's motives are in question, or somebody asks what they do with the time |
| &nbsp;&nbsp;[Which is why there is one, and not a crowd](#which-is-why-there-is-one-and-not-a-crowd) | somebody claims to have met more than one False Immortal, or asks why the rank has not accumulated |
| [What a False Immortal is for](#what-a-false-immortal-is-for) | a False Immortal is encountered or asked about, or a cultivator reaches ordinal 44 |
| &nbsp;&nbsp;[The years are not the same for everybody](#the-years-are-not-the-same-for-everybody) | a False Immortal's remaining years are counted, claimed, or bargained with |
| [Going mad from age](#going-mad-from-age) | **Tier 3** - never injected |
| [The dao protector](#the-dao-protector) | a sect's protector is mentioned, or a False Immortal is offered a post |
| &nbsp;&nbsp;[Typically they are your own](#typically-they-are-your-own) | a house is looking for a dao protector, or a protector's loyalty to the house is in question |
| &nbsp;&nbsp;[It obliges nothing](#it-obliges-nothing) | a house gives its protector an instruction, or expects one to act on its behalf |
| &nbsp;&nbsp;[The post is vacant, not abolished](#the-post-is-vacant-not-abolished) | somebody asks who holds the protector's post, or why no house has one |
| &nbsp;&nbsp;[Carving](#carving) | **Tier 3** - never injected |
| &nbsp;&nbsp;[And the one man who is doing it now](#and-the-one-man-who-is-doing-it-now) | the living False Immortal is met, named, or sought out |
| [What immortals leave behind](#what-immortals-leave-behind) | the player finds a designed inheritance, or asks who built one |
| [What crosses the Lid](#what-crosses-the-lid) | somebody proposes sending a person or an object through the Lid in either direction |
| &nbsp;&nbsp;[The two crossings nobody makes](#the-two-crossings-nobody-makes) | somebody plans to send a mortal up, or to call an immortal down |
| [Immortal lineages](#immortal-lineages) | a sect's or clan's ancestry is being counted, claimed, or disputed |
| &nbsp;&nbsp;[Characters cross the boundary](#characters-cross-the-boundary) | an NPC the player knows ascends, or an immortal descends into the player's world |
| [Immortal-era play is deliberately light](#immortal-era-play-is-deliberately-light) | **Tier 3** - never injected |
| &nbsp;&nbsp;[Ascension does not end the run](#ascension-does-not-end-the-run) | **Tier 3** - never injected |
| &nbsp;&nbsp;[What an immortal run actually is](#what-an-immortal-run-actually-is) | **Tier 3** - never injected |
| [Related](#related) | **Tier 3** - never injected |

---

## It is a place, not only a rank

<!-- tier: 2 trigger="the Immortal Realm is described, or somebody asks what is actually on the other side of the Lid" -->

The Immortal Realm is not only a rank. It is a **place**, and reaching it moves you there.

This is the one point where cultivation progression is also *geographic* progression. A
True Immortal does not keep walking around their starting province as a stronger version of
themselves; they go through the Lid, and what is on the other side is a different layer of
the same world - not another planet, not another universe, and not a second game.

### What it is like up there

<!-- tier: 2 trigger="somebody is above the Lid, or the conditions there are being described" -->

Not the same map with bigger numbers. A genuinely different environment:

- qi at densities the lower world cannot produce, and has not held since before its history
- natural law that behaves differently, and is not negotiable by anyone newly arrived
- resources, materials and techniques with no equivalent below
- native cultivators who were born there
- civilisations, immortal sects and clans that are older than the lower world's records
- environmental dangers calibrated for immortals, which is a phrase worth taking seriously
- politics that has been running, uninterrupted, for a very long time

All of it is implemented in [`../../src/engine/world/layers.ts`](../../src/engine/world/layers.ts)
(the two layers, and what crosses the Lid in either direction) and
[`../../src/engine/world/immortal-world.ts`](../../src/engine/world/immortal-world.ts)
(the place, the transition at 46, standing, and what still kills). The far side is
materialised on first contact and derives entirely from the world seed, so the sky a
world has is a property of the world and not of when anybody first looked at it.

**One correction, from the measurement.** The first line above used to read as though
the qi figures do not overlap at all. They do: the density scale is 0..1 *by
definition* - 1.0 is the richest ground the world has ever carried - so a sealed ruin
and a worked vein below both already reach it, and nothing above can sit off the end
of a scale with an end. What is actually true is where the figure sits and how much of
the map carries it. The age below runs about a third and only ever falls; the places
at the ceiling are a small minority and every one of them is sealed or contested.
Above, the ceiling is the floor, over the whole layer, and nobody is guarding it.
`immortalWorldShape` reports both halves rather than the one that reads better.

### They can still die

<!-- tier: 2 trigger="somebody assumes an ascended ancestor is safe, or an immortal's survival is in question" -->

Ascension removes two of the three things that kill a cultivator and none of the rest.

**Heavenly tribulation is behind them.** It was the last crossing; there is not another
one. **Lifespan has stopped being a number** - that is what the rank means, and it does not
quietly run out later.

Everything else on the list above still applies. Environmental dangers calibrated for
immortals kill immortals. Politics that has been running uninterrupted for a very long
time kills the people who lose at it. A newly arrived nobody with no standing, no
protector and a lower-world accent is exactly the sort of person that happens to, and
three thousand years is a long time to keep not losing.

So **"ascended" is not a terminal state and must never be written as one.** Somebody who
crossed four thousand years ago may be up there now, or may have been gone for most of
that time. Both are ordinary.

#### And nobody below can tell which

<!-- tier: 2 trigger="a house's channel has stopped answering, or somebody asks whether an ascended ancestor is still alive" -->

There is no signal. The Lid does not report deaths, the crossing is one-way for people,
and the few objects that carry information across carry what somebody chooses to send.
A house whose channel still answers knows that *somebody* is picking up. A house whose
channel has gone quiet knows nothing at all: the silence is equally consistent with death,
with disinterest, with a war up there, and with an object down here that stopped working.

This is why a sect's claim to a living ancestor is a claim rather than a fact, and why
`claimsLivingAncestor` and `claimIsTrue` are separate fields. The sect is not necessarily
lying. It frequently does not know.

The engine records the truth - `afterCrossing` on a sect ancestor is `still_above` or
`died_above` - because the engine is allowed to know things the world cannot. Every
character in the world is guessing, including the ones who sound certain.

### A newly ascended immortal is a nobody

<!-- tier: 2 trigger="somebody has just ascended, or a house expects its new immortal to be able to help it" -->

This is the important part and the reason the layer exists.

Measured against the world they left, a newly ascended immortal is beyond comprehension -
a being whose descent would reorganise a continent. Measured against the world they have
arrived in, they are a newcomer with no lineage, no standing, no allies, and cultivation
that is unremarkable.

Both facts are true simultaneously, and the gap between them is the entire perspective
shift. It also produces one of the best available payoffs: an immortal descends into the
lower world and is an absolute monster there, and the player later discovers that this
"invincible ancestor" is not considered exceptional at all where they come from.

That gives the scaling shift without the universe having to become infinitely larger,
which is the world layer's governing constraint - see
[`../../src/engine/world/README.md`](../../src/engine/world/README.md).

### The lower world does not pause

<!-- tier: 2 trigger="years pass below while somebody is above, or a returning immortal asks what happened while they were gone" -->

Both layers keep running. The mortal world continues its own history after an ascension -
the sect grows or is destroyed, the disciple becomes an elder and then a corpse, a war
starts, a new prodigy appears and dies young - none of it waiting for anyone.

An ascended cultivator therefore does not leave a snapshot behind. They leave a world that
will be substantially different whenever they next look at it.

### It is not a hard reset

<!-- tier: 2 trigger="somebody has ascended and their debts, grudges, descendants, or artifacts below are still in play" -->

The player has not entered Game World 2. History, karma, relationships, factions,
artifacts, descendants, debts and consequences all cross the boundary. What changes is
*access*, and access is restricted in both directions - the crossings described below are
ruinous precisely so that the boundary means something.

### Higher layers, later or never

<!-- tier: 3 -->

The architecture should permit `mortal world -> immortal world -> something further`
without any of it existing now. **One mortal world plus one immortal world is sufficient.**
Do not generate additional layers to increase scale; add one only if the world's own
history ever produces a reason for it, and probably never.

---

## The ones who did not get through

<!-- tier: 2 trigger="a False Immortal is encountered, claimed, or counted; or somebody asks how many there are" -->

A False Immortal survived the last crossing and did not complete it. What they are is in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md); what
they *do* is here, because it is the fact that makes the setting's arithmetic work.

### They have three hundred thousand years and nothing to attempt

<!-- tier: 2 trigger="a False Immortal's motives are in question, or somebody asks what they do with the time" -->

That is not a retirement. The one thing they were built for is permanently shut against
them - the Lid does not open twice for the same name - and no amount of the enormous time
they have left changes it by a day. Cultivation has no rung above them they can reach.
Politics is a diversion for people who need something. There is no next thing.

So **almost none of them stay.**

They go looking. Down old seams and into ruins nobody living can open, out past the edge of
any province with a name, at the dead ground where an age burned itself out, at whatever
might be an answer. Some of them are looking for another way up. Some are looking for
whatever declined them. Some are simply looking, because standing still with that much time
is worse.

**And going looking is what kills them.** Their span is not what ends them; the search is.
The places worth a False Immortal's attention are places that were sealed by people who
could seal things against a False Immortal, and the odds out there are not written down
anywhere.

### Which is why there is one, and not a crowd

<!-- tier: 2 trigger="somebody claims to have met more than one False Immortal, or asks why the rank has not accumulated" -->

This resolves the thing that otherwise does not add up. A rank with a three-hundred-thousand
year span that nobody can climb off looks like it must accumulate: produce them at any
ordinary rate for four and a half thousand years of recorded history and the province should
be knee-deep in them.

It is not, because **residence is production minus departure**, and departure is nearly
everyone. They are produced at an unremarkable rate and they are gone within a few
centuries. One to three standing in the world at any time is what that arithmetic gives, and
one to three is what the world has.

**Lu Sheng is not the only False Immortal the world has ever made. He is the one who
stayed.** Six hundred and forty years resident is already extraordinary, and it is the most
interesting fact about him - more interesting than the crossing itself. Everybody else with
his problem went to find out what the far side declined. He is still here, walking around,
asking.

Three consequences for play, and they are all good ones:

- **A False Immortal who leaves is not dead and is not gone.** They can come back, and
  coming back after four hundred years with something nobody has seen is one of the better
  entrances available to the setting.
- **There is somewhere for future ones to go.** The count stays at one to three without the
  engine having to suppress the outcome, so the crossing can keep resolving honestly.
- **Nobody down here can distinguish "left" from "died out there".** Same as with ascension,
  and for the same reason: there is no signal. A court that has not heard from its fourth
  Seat in two centuries knows nothing at all.

The arithmetic lives in `immortalStock` in
[`../../src/engine/world/ladder-odds.ts`](../../src/engine/world/ladder-odds.ts), alongside
the record it is fitted to. What that residence figure is actually made of - where they go,
what is known about anybody who went there, and why a departure and a death produce the same
evidence - is `DEPARTURE` and `DEPARTURE_DESTINATIONS` in
[`../../src/data/cultivation/false-immortals.ts`](../../src/data/cultivation/false-immortals.ts).

---

## What a False Immortal is for

<!-- tier: 2 trigger="a False Immortal is encountered or asked about, or a cultivator reaches ordinal 44" -->

Rank is shut at ordinal 45 and shut permanently. **The dao is not.** Nothing in the
understanding layer reads an ordinal, insight has no ceiling tied to the ladder, and a False
Immortal keeps going deeper for as long as there is anywhere deeper to go.

So what they have is **one open axis and a fixed number of years**, and what they do with
both is **legacy**. Three forms, and they account for the behaviour of every one of them:

```text
protector       legacy through an institution - you outlive the house that raised
                you and become the reason it survives
peak            legacy through understanding - going as deep as the axis allows,
                for its own sake, with nobody to show it to
transmission    legacy through handing it on - students where there are students,
                and carved stone where there are not
```

Path two is what "went looking and did not come back" almost always is: **not sightseeing,
but going where the answer is.** Write it that way.

### The years are not the same for everybody

<!-- tier: 2 trigger="a False Immortal's remaining years are counted, claimed, or bargained with" -->

`FALSE_IMMORTAL_LIFESPAN_YEARS` is 300,000 and that is the **rung's grant**, not what
anybody walks away with. The crossing takes a share, the share is enormous, and it is not
the same twice - so what an individual holds is the grant minus whatever did not come back
with them. Lu Sheng crossed 640 years ago and holds 11,000 years, about four per cent of the
figure. **That is the price of his crossing, charged once, and settled.** It is not a
decline, it does not get worse, and it must never be written as a wasting.

It also decides a great deal. Most False Immortals come out with a few thousand years, spend
them, and die having never gone near the far end of anything.

## Going mad from age

<!-- tier: 3 -->

Not boredom, not decay, and not age by itself. **It is what a mind does when the only open
axis closes, or when the thing the depth was being left to stops existing.** Understanding
is what holds a False Immortal together; a dao has a peak and reaching it is an event with a
date; a house can fall and a carving can go unread.

Five stages, in `MADNESS_STAGES`. Years set the pace; whether the legacy still holds sets
the speed - a finished axis or a failed legacy advances the trajectory by one band, which is
`madnessStageAt(yearsSinceCrossing, legacy)`.

| Stage | Years since crossing | What it looks like |
|---|---|---|
| The Interval | 0 - 2,000 | Nothing. A capable person finishing a life they had mostly finished, who knows their own remaining figure to the year and will give it to anybody who asks |
| The Long Work | 2,000 - 20,000 | Disproportion and nothing worse. The work gets a weight nothing else gets; everything outside it is handled with mild, incurious inaccuracy. Nearly everything the world has from a False Immortal was made here |
| The Settled Error | 20,000 - 90,000 | Lucid, articulate, long correct reasoning from premises that were true when acquired and have not been checked since. This is the stage that ruins institutions, and it does it without a raised voice |
| The Long Repetition | 90,000 - 220,000 | Keeping. A place held, a border walked, a path people are turned back from - courteously, without explanation, and without any possibility of being talked out of it |
| The Standing Silence | 220,000 - 300,000 | Stillness. Not seclusion, not sealing, not death; the power intact and nothing addressed to them arriving. **Nobody has ever seen this** and the description is reconstructed |

Two things this must not become. It is **not a monster generator** - see
`AGE_IS_NOT_MENACE` in the sealed-ancestor catalog, which applies here in full. And it is
**not on Lu Sheng's road**: 640 years in with 11,000 remaining, his whole existence ends
inside the second band. He is young, he is entirely sane, and he stays that way.

## The dao protector

<!-- tier: 2 trigger="a sect's protector is mentioned, or a False Immortal is offered a post" -->

The phrase does two jobs and the two senses almost never meet.

**At an ordinary sect it is a job, and it is filled.** A Nascent Soul who does not travel, a
Core Formation veteran of forty years, somebody whose whole function is to be in the
compound when something arrives. Unremarkable, and most houses that have the position have
somebody in it right now.

**At the top of the world it is reserved for a False Immortal,** and those houses will not
fill it with anyone else. That is why the emptiness means something: an apex with a vacant
protector's chair is not short of strong people, it is declining to pretend a strong person
is the same thing.

### Typically they are your own

<!-- tier: 2 trigger="a house is looking for a dao protector, or a protector's loyalty to the house is in question" -->

A protector is not hired. **They are one of yours who crossed and came back** - which means
only a house that has itself produced somebody who reached the last crossing can expect one
at all. Recruitment from outside happens and is rare, and it carries an awkwardness the
internal case never does: somebody else's existence on your ground, with no history there
and no reason to die for the place.

Which produces the reading worth having, and it is the opposite of failure. **Every
completed crossing in the records is a house that could have had a protector and got a True
Immortal instead.** Azure Cloud sent Ru Anjing 380 years ago. Sweptground sent the First
Abbot 2,600 years ago and is now four monks with a chair. The Storm Tyrant Court sent the
First Tyrant 3,400 years ago. The Hollow Court has sent six. Those chairs are empty because
those houses succeeded.

### It obliges nothing

<!-- tier: 2 trigger="a house gives its protector an instruction, or expects one to act on its behalf" -->

Eleven instruments survive and the obligations in all eleven run one way: the house
undertakes, and the guest is described. **Not one contains a sentence in which the guest
agrees to anything.** The one thing a house cannot do is give an order - a house that gives
a protector an instruction has a protector until the end of the sentence.

And nobody has ever banked one. The seal band runs Void Refinement to Tribulation
Transcendence, ordinal 29 to 44; a False Immortal is 45. **No sect has ever held one in
reserve because no sect could**, and every protector in the record was there by choice and
free to leave at any hour.

### The post is vacant, not abolished

<!-- tier: 2 trigger="somebody asks who holds the protector's post, or why no house has one" -->

Nobody ended it. No house struck it off a roll and no age closed it. It has had no incumbent
anywhere for **eight hundred years**, and the reason is **a lack of False Immortals** - no
falling-out, no turning point, nobody at fault. What "a lack" consists of is worth being
precise about: production has not fallen. Residence has. They go looking, or the trajectory
takes them, and no seal can hold one to keep them.

What is left is residue that says "vacant" better than any statement: a stipend line carried
forward at the same figure for eight centuries and never drawn against, quarters swept on a
schedule with no bedding in them, a place laid at the end of a ceremony row that the
officiant announces as vacant every year.

**So it could be filled tomorrow**, and that is the point of writing it this way. A
cultivator who survives the last crossing and does not complete it is, that morning, the
natural candidate at the house that raised them - if that house is one of the few with a
reserved chair. Which house you joined at ordinal 3 decides whether there is a chair at
ordinal 45.

### Carving

<!-- tier: 3 -->

Legacy is the objective and a student is not always available, so they cut it into a face
and let the reader be a problem for later. Frequently it is not a technique at all - a name,
a date, a rank, a course of cutting on the inside of a stone where nobody would look. **The
name outlasting everything else is very often the whole of what was intended.**

Most of it cannot be read, and the obstacle is not a cipher: somebody who has stopped
assuming a reader writes in their own hand, compressed by somebody who had already
understood it. Some of it is perfectly legible and still ruinous, because a correct reading
of a true statement about a world that no longer exists is how a table of distances comes to
be wrong for eleven hundred years with nobody having made an error.

Distinguish both from the curriculum above the Frostmirror ice field, which is legible and
unusable because the obstacle is the reader's *body*. Neither is a puzzle to be solved.

### And the one man who is doing it now

<!-- tier: 2 trigger="the living False Immortal is met, named, or sought out" -->

Lu Sheng is on path three. He built his arts himself out of what came back, there is no
manual because he never had a reason to write one for a reader who does not exist, and
effectively the only way any of it gets out is through a student.

He has **not** done the durable carving - that is what path three does when there is
nobody left to hand anything to, and he still has students. What there is instead is
residue: a lecture needs a surface, he works on whatever is there, and he does not take
the stone away afterwards. Three faces exist, in the ordinary hand, cut for people who
were in the room and had it shown to them first. A later reader gets the surface an
afternoon was worked out on without the afternoon, from an author who is still alive and
could simply have been asked, and pays the whole of what reading costs.

And **he holds no object at all**, of any rung. He was of the Hollow Court once and is
not, so nothing of theirs is his to carry, and nothing else in the world would be handed
to him. That makes the arts the entire account of why he is dangerous - and it is
measurable: against the three mobilised apexes he takes the Deep Survey every time, the
Azure Cloud Pavilion about seven times in eight, and the Long Cut four times in five. The
ordering tracks the object each house is holding rather than the head's rung, so the
strongest person below the Lid can be fought to a standstill one time in five by somebody
three rungs beneath him, purely because they were given something and he was not. That
asymmetry is the character. Nothing should fix it.

He is **eligible** for the Hollow Court's reserved post and does not hold it. Nobody found
him wanting; he does not care for titles, having 11,000 years and no rank left to gain, so
the question has never become interesting enough to answer. The Court cannot seat him
anyway - seats go by ordinal then remaining years, and a man with no attempts left cannot be
ordered by a queue for the crossing - and he held First Seat before the crossing and no
longer belongs to them the way holding their office would require. He likes them. He goes
back. He does not appear to mind.

**And he gives them dao lectures**, on no schedule and under no obligation, which is the
substantive half of what a protector was ever for, being performed right now by the only
False Immortal in the world. He wants no name for it.

One Seat did say something to him once - in person, alone, in the course of an afternoon
that was about several other things: that the chair was there, that it had been kept, and
that the Court would be glad of him in it. Nothing was proposed and nothing was asked for.
He said he is too unrestrained for that sort of thing, lightly, in the tone of a man
conceding a small and well-known fault, and then asked about something else. **He did not
accept and he did not decline.** Whether that was his reason or the nearest true thing to
hand is not established, and neither is whether he heard an offer in it at all.

Three things stay open and none of them may be resolved: whether he would come if the
mountains were attacked (**unknown to him as much as to anybody**); whether that afternoon
was an offer at all, since **nothing formal has ever been put to him**; and a thin rumour
that he declined, whose entire population is three people inside the Court, tracing back at
second hand to that same remark, and which nobody can check because that Court does not
announce, deny, correct or brief.

The catalog is [`../../src/data/cultivation/false-immortals.ts`](../../src/data/cultivation/false-immortals.ts).

---

## What immortals leave behind

<!-- tier: 2 trigger="the player finds a designed inheritance, or asks who built one" -->

Nothing goes through the Lid except the cultivator. They know this well in advance, and
they act on it.

So the years before a crossing are spent **divesting**. An ascending cultivator sells,
gifts, buries, seals and arranges: artifacts they will not need, manuals they will not
read again, spirit stones that will buy nothing where they are going, and above all
**inheritances** - deliberately constructed, deliberately hidden, deliberately gated, left
for whoever proves worth them.

**This is the author of the world's entire inheritance economy.** It is why sealed caves
have trials in them, why the trials are *calibrated* rather than merely lethal, why a
manual three grades above anything taught is sitting behind a door with a riddle on it.
Somebody put it there on purpose, on their way out, knowing they would never come back to
check.

It is also why the sect an ancestor left is holding a parting gift, and why the recency of
a crossing is most of a sect's prestige - see [`sects.md`](sects.md). And it is what
separates an inheritance from a grave, which is a profession's worth of distinction:
[`economy.md`](economy.md).

## What crosses the Lid

<!-- tier: 2 trigger="somebody proposes sending a person or an object through the Lid in either direction" -->

**People do not.** A cultivator below True Immortal who reaches the other side is crushed -
not attacked, simply unable to exist at that pressure. And an immortal returning downward
draws tribulation lightning on the way through, because the Lid does not distinguish
between a hole made outward and one made inward.

Neither is *impossible*. Both are ruinously expensive. An immortal who comes back down
pays a price that almost none of them are willing to pay, and the ones who did are
remembered for it - usually because whatever they came back for was worth more to them
than what it cost, which is by itself the most interesting fact anyone will ever learn
about them.

**Information does.** There exist artifacts - extremely rare, mostly ancient, several of
them the deliberate parting gift of somebody's ascension - through which knowledge can
pass the Lid in either direction. A message. An answer. A warning. The confirmation that
someone arrived.

This is the setting's only reliable channel between the two sides, and it is the reason
anything below the Lid knows the other side exists at all. It also means the most valuable
commodity in the world is not a treasure or a technique but **a working line of enquiry to
somebody who already went through** - which is precisely the sort of thing a Dao house
would kill to control, and precisely the sort of thing that gets misreported, faked and
sold.

### The two crossings nobody makes

<!-- tier: 2 trigger="somebody plans to send a mortal up, or to call an immortal down" -->

**Sending someone up is not a plan, it is a way to destroy two things at once.**

A cultivator below True Immortal cannot exist on the other side. Not "faces long odds" -
cannot exist. And the artifacts capable of moving something through the Lid are among the
rarest objects in the world. So the trade is: burn an irreplaceable treasure, and the
person you spent it on dies on arrival. Nobody who understands the exchange proposes it,
and the handful of times it has been attempted are remembered as a category of madness
rather than as a gamble.

**Coming down costs an immortal more than it is worth, almost always.**

An immortal returning below the Lid is not travelling; they are forcing an opening
inward, and the Lid does not distinguish that from any other breach. They pay for it out
of cultivation condensed over ages - the actual substance of what they became - and they
get very little time. Ten breaths is the figure people quote, and people who quote it have
usually never seen it done.

If it goes badly, and it often does: the body fails and what is left is a single drop of
blood, drawn back up through the seam by the Lid itself. The immortal survives, technically,
and spends the next several thousand years recovering enough to be a person again.

If it goes worse than that, they do not come back at all. **This is one of the few ways an
immortal actually dies**, and it is why the ones who did come down are remembered so
precisely: whatever they returned for was worth more to them than the several thousand
years, and working out what it was is one of the most interesting questions in the world.

The engine should treat both crossings as real, resolvable, and catastrophically
expensive - never as a travel option, and never as a narration flourish.

---

## Immortal lineages

<!-- tier: 2 trigger="a sect's or clan's ancestry is being counted, claimed, or disputed" -->

Sects and clans are counted by how many immortals they have produced, and the counting is
the prestige:

```text
1 immortal            a supreme lineage
2                     extraordinary
3                     legendary
4+ in succession      very nearly mythical
```

Track current immortals, historical immortals, the total produced, and consecutive
generations producing one. **Prestige should emerge from that history rather than from a
hardcoded multiplier** - a lineage with three immortals is formidable because of what those
three did and left, not because a number says so.

**Mortal sects can be branches of immortal lineages.** An ancient immortal clan above, a
branch established below, a regional sect that descends from it. The branch may know this,
may have forgotten it, or may be *claiming* it without proof - which is another thing the
Dao houses sell verification of, and another thing worth killing to keep unexamined.

A recognised branch can expect inheritance, protection and enormous political leverage. It
can also expect to be used.

### Characters cross the boundary

<!-- tier: 2 trigger="an NPC the player knows ascends, or an immortal descends into the player's world" -->

People stay relevant through ascension in both directions. Someone important in the lower
world may later ascend, be summoned upward, deliberately remain below, become a branch
ancestor, die, or found a lineage. And an ancient immortal may descend and become
important to a story that began long before anyone knew they existed.

---

## Immortal-era play is deliberately light

<!-- tier: 3 -->

**Immortal-era play is intentionally thin, and should stay that way.**

It is the "you have beaten the game" state. There is lore up there, there are things to
find out, and there is a quiet loop. There should **not** be a second full progression
system, a second economy, or a second survival layer. The weight of this game lives below
the Lid, and the Immortal World's job is to give that weight somewhere to point.

### Ascension does not end the run

<!-- tier: 3 -->

Reaching True Immortal is not a game-over screen. The player may keep going.

An immortal run is a different game, and deliberately so: the concerns are no longer
survival and scarcity but obligation, legacy, what to leave, whom to answer, and what is
worth the price of reaching back down. Everything below is still there - the sects, the
descendants, the grudges, the people who knew them - and they can still be reached, at
cost.

**And the player may end the run whenever they choose.** Ascension is the one point at
which a run can be closed voluntarily rather than by dying: a cultivator can go through,
settle their affairs, leave what they leave, and step off the ladder deliberately. The
ledger records the run as ended by ascension rather than by death, which - in a game where
almost every other run ends with a corpse - is the rarest line in it.

### What an immortal run actually is

<!-- tier: 3 -->

It is a quieter game, and a deliberately smaller one.

An immortal has no survival pressure, no scarcity, and nothing above them to climb toward
that anyone below the Lid can describe. What they have is **time, resources, and the
people they left**. So the loop is:

- potter about, largely undisturbed
- spend absurd money throwing something down to a sect, a descendant, a disciple - a
  technique nobody in the world can teach, an artifact three grades above anything in the
  region, a warning
- receive word back: a descendant has done something, a sect has risen or been destroyed,
  someone has died, someone is asking after them
- eventually get bored, and step off the ladder

That last one is a real ending and the player chooses when. Nothing forces it.

The emotional content is that everything below keeps moving and you can only ever touch it
at arm's length, through objects and messages, while the people who remember you die off
one at a time. Sending a gift down is the most an immortal does in a century, and it is
enough to reshape a region.

## Related

<!-- tier: 3 -->

- [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) - the last crossing, True and False Immortal
- [`sects.md`](sects.md) - ancestral records and the millennial offering
- [`economy.md`](economy.md) - graves versus inheritances
- [`the-late-age.md`](the-late-age.md) - why nobody has crossed in living memory
- [`../../src/engine/world/README.md`](../../src/engine/world/README.md) - why the world gains depth rather than layers
