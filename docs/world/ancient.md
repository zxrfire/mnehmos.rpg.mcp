<!-- tier: 2 trigger="ruins, portals, an unfamiliar art, an elder practising something nobody recognises, or any question about why the past could do things nobody can now" -->

# The Ancient Tier

An authoring guide, in the shape of [`making-places-different.md`](making-places-different.md).
Read it before you add anything to a ruin.

**The failure mode this exists to prevent:** *ancient* collapsing into *better*. A sealed
site whose contents are the modern catalog with larger numbers is the same failure that
document exists to prevent for regions - interchangeable furniture with the proper nouns
swapped. If the reward for opening a door two ages old is a sword with a bigger figure on
it, nothing about the past was different. It was just earlier.

The material for all of this lives in
[`../../src/data/cultivation/lost-ages.ts`](../../src/data/cultivation/lost-ages.ts).
Every object it names is an ordinary row in an ordinary catalog.

---

## Modern is elemental. Ancient is categorical.

<!-- tier: 2 trigger="describing an art, or comparing what somebody can do to what somebody else can do" -->

This is the spine. Everything else on this page is downstream of it.

**Modern arts are elemental, and they scale to the horizon.** Fire, ice, wind, stone, a
blade, a shield, a step - and the whole ladder is those ideas taken further. Nothing about
that is modest. At the top of the ladder an elemental art is one of the most frightening
things in the world: somebody sends lightning out of their fingers, or becomes it. Weather
stops being weather. A river is not there afterwards. Ground will not carry anything for a
century and a province still names the place. The elemental line is what every institution
alive has spent the late age refining, and its summit is enormous.

**Ancient arts are categorical.** They do things that have no elemental reading at all,
and no rung of any modern art becomes them:

- a battlefield cut off from reality - a piece of ground taken out of the world for an hour
- spears summoned out of qi, standing where they fall
- portals, and stepping across a distance without crossing it
- vitality taken out of one body and put into another
- a person acting while the person inside them watches
- a second body

**The worked example, which says it better than any abstraction.** A cultivator at the top
of the elemental line becomes lightning. An ancient practitioner makes spears out of qi and
**hands them to their descendants to carry**. The second half of that sentence is the whole
distinction. One of them is a very dangerous person; the other has changed what their house
can do, permanently, for people who are not them. There is no exchange rate between those,
and no rung of the first ever turns into the second.

That is the family worth reaching for when authoring: **ancient arts that act *through*
other people, or leave something behind that outlasts the using.**

### Neither one is better

Ancient is not the weaker option and it is not the stronger one. Sometimes it is plainly
the better thing to be holding and sometimes it is useless, and which one depends entirely
on the situation. **Grandeur is the wrong axis.** A rung-44 fire art and an art that seals a
battlefield off from reality are both extraordinary, and neither is a version of the other.

The one thing forbidden is a **strict** upgrade - an ancient art that is better in every
situation - because then the abandonment makes no sense and the whole tier collapses into
"old is stronger".

### Why the era changed

An age that could afford to cut a piece of reality off from the rest wrote its arts on that
assumption. A poorer age cannot feed them, so it developed the elemental line instead:
efficient, reliable, cheap to teach, and asking nothing the world cannot supply.

**Modern cultivation is what you build when you cannot afford the old way.** That is the
late age in one sentence, and it is why the elemental line is not a decline. It is an
adaptation, and a good one.

---

## Three tiers of absence

<!-- tier: 2 trigger="the player finds something nobody can make, use, or read any more" -->

They are genuinely different in kind, and a thing in one tier behaves nothing like a thing
in another.

| Tier | What survives | What is gone | Voluntary? |
|---|---|---|---|
| **abandoned** | everything - the method works perfectly | nothing; people stopped | **yes** |
| **lost** | the recipe, in full, readable | the materials | no |
| **no surviving copy** | the record that it existed | the last copy | no |

### Abandoned - it still works, and nobody uses it

The interesting one socially, because it poses a question the other two do not: **if it
still works, why did everybody stop?**

The answer is always a fact about the *era*, never about the method. They stopped paying.
The capability was never the problem; the price was, and an age decided collectively that
it was not worth it - and **they were right**, which is the part that keeps this coherent. A
cultivator today who takes one up is making a defensible and eccentric choice, not
discovering that everyone else was an idiot.

**Abandoned is not the same as condemned**, and the difference decides what happens to a
player who takes one up:

| | |
|---|---|
| **demonic** | Condemned. People know about it and forbid it. Possession is an offence. Taking one up gets you **hunted**. |
| **ancient** | Finished with. People know about it and stopped. Nothing forbids it. Taking one up gets you **looked at strangely** by people who know exactly what you are paying. |

The catalog carries both, and you can see which is which in `category` without anybody
having added a field: the condemned four are filed `forbidden`; the ancient roads are filed
under what they do - attack, defence, movement, support - because they are not condemned
and never were.

One of the four is misfiled by the world rather than by the catalog. **Lifespan-Devouring
Heaven Theft** spends the user's own allotted years as ammunition and nobody else's; there
is no victim in it anywhere, and it reads as abandoned rather than condemned. It stays under
`forbidden` because that is where four centuries of righteous sects have put it and the
catalog records what the world believes - but the world is wrong about which of the two it
is, and the people holding copies know that perfectly well. The **Crimson Tithe Palm** is
the same argument one grade down with one difference that matters: its manual conceals the
cost until the last page, and concealment is worth condemning even where the method is not.

### Lost - they have the recipe, just not the materials

The knowledge survived; the inputs did not.

This is a far better scarcity model than "old things are better", and the **recipe being
public makes the loss sharper**. A house can read exactly what it can no longer make, and
price it to the stone. That is a much more interesting kind of poverty than not knowing, and
it is [`the-late-age.md`](the-late-age.md)'s *library they can no longer read* - except
worse, because they **can** read it.

The mechanism in the catalog is one set membership and nothing else. `EXTINCT_HERB_IDS` in
`herbs.ts` takes a herb out of the forage pool; the row stays, so every recipe naming it
still resolves and a player can still read it, cost it and go shopping. There is no flag on
the recipe and no branch in the refiner.

It comes in two shapes, and they are the same sentence applied differently:

- **discrete** - a finished object nobody can make another of. The Thousand-Autumn Pill.
- **continuous** - an art whose *practice* consumes something extinct. This is why an ancient
  art can be a standing commitment rather than an acquisition: finding the manual is not
  the end of the story.

**Even the immortal realm lost some of it.** What is above the Lid depended on things that
grew below it, and when those went the art went up there too. That inversion is worth
keeping and worth saying out loud: the ones above are not exempt from the late age, they are
just further from the ground it happened to.

### No surviving copy - the last one is gone

Declared already, in `NO_SURVIVING_COPY_TECHNIQUE_IDS`, with a reason per entry. An art the
world can name, date and describe the effect of, and cannot produce, because everybody who
held the working died holding it.

Keep this tier tiny. It is the only one with nothing at the end of it.

---

## What an ancient art costs

<!-- tier: 2 trigger="a player picks up, is offered, or is seen practising an ancient art" -->

An ancient art is defined by two things at once: **it does something nothing modern can do,
and it always takes something from the person using it.** That pairing is what makes it a
bargain rather than an upgrade, and it is the answer to why an era stopped.

Up to three prices, and the third is optional:

1. **A capability** no modern art has at any rung.
2. **A cost on you** - lifespan, blood, something that does not come back. The interesting
   shape is a cost that **compounds**, because that is what makes abandonment rational
   rather than squeamish: the first use is cheap, the hundredth is ruinous, and a whole era
   working that out and stopping is a believable history.
3. **A cost the world cannot supply** - a material that no longer exists. *Not always, but
   sometimes.* A rule applied uniformly is a tax rather than a characteristic.

The third does not resolve, which is the point. Practising the art consumes something
extinct, so holding it is a standing commitment to keep finding more - **which is a far
better engine for expeditions than a treasure hunt, because it never completes.** This is
what the user asked the whole tier for: a reason to send people out.

### The old are the practitioners, and no rule says so

The cost is years, and years are worth what remains of them.

| | |
|---|---|
| a young cultivator | pays years they were going to use. Ruinous. |
| an old cultivator | pays years they were not going to get anyway. Nearly free. |

So the price is progressive without a single branch, and it produces a whole class of
practitioner nobody had to author. **The frightening old woman with an art nobody has seen
in an age is not a trope you have to write; she is what the cost function makes.**

Two things fall out for free:

- **A young practitioner is doubly remarkable.** They are paying at full price, in public,
  which reads as a statement about *them* rather than about the art.
- **An old practitioner who breaks through has bought themselves out.** A rung is lifespan;
  somebody old enough to take up an ancient road who then advances has reset the clock they
  were spending, and now holds at a discount a thing they can afford to keep. That is a real
  arc and it is available to anybody who does the arithmetic.

And there is a second kind of old practitioner, who did not choose anything: **somebody who
learned it when it was simply how cultivation was done, and never stopped.** The era changed
around them. They are not eccentric; they are old.

The world cannot tell the two apart, and that uncertainty is content. An elder with a
strange art may be a survivor of the prosperous age or somebody who found a manual in a ruin
two centuries ago. There is no test that separates them, which is why asking is rude and
being told is worth a great deal.

**And a house can manufacture one.** A sect with a sealed ancestor from the older era, a
thousand-year medicine, and a reason has all three parts of a single act: wake her, feed
her, and it is holding somebody who practises an art nobody living has seen and now has the
span to use it. Waking generally ends an ancestor and the medicine cannot be replaced, so
this is a house spending both of its irreplaceable things in one afternoon. Nobody has done
it. Several houses could.

---

## The upkeep is legible, and that is the point

<!-- tier: 2 trigger="a knowledgeable NPC sees what the player is practising" -->

Anybody who knows what an art takes can do the arithmetic themselves, and the conclusion is
not about the art. It is about you: **either you got extraordinarily lucky, or a house is
spending on you.** There is no third explanation, and that is what makes an upkeep a status
marker rather than a cost.

Two reactions, from the same knowledge, and both should exist:

- **Impressed.** *How did somebody like you get that far up it?* From people who understand
  what the upkeep costs and can see you have been paying it.
- **Dismissive, and correct.** *"You won't cultivate that past the fifth level. There aren't
  enough of the materials on the whole of this side to do it."* Delivered as a put-down and
  true as a prediction - and the person saying it is usually not speculating. **They are
  describing their own house's history.** They watched their own people stall at that exact
  place with that exact book.

Which reaction a cultivator gets should follow from the observer - their standing, whether
they know the art, whether they have seen somebody hit the wall - not from a flag on the
player.

**The prediction should be mechanically true.** If a knowledgeable elder says the resources
do not exist past a certain depth, the engine must agree, or the world's experts are wrong
and the player learns to ignore them. The honest way to produce that ceiling is not a rule
saying *you may not* - it is an upkeep nobody can meet.

> The engine does not enforce this yet. `worldSupplyCeiling` in `lost-ages.ts` records where
> the world's supply stops, on `mastery`'s own `[0, 1]` scale, and nothing in the technique
> or combat layer currently reads it. That is worth stating rather than implying: today it
> is a fact the world believes and the catalog records.

**A player who defies the prediction and is right is the best story this tier can produce.**
It should be rare, earned, and visible to everybody who understands what they are looking at.

### The four routes to being able to feed one

- **luck** - a ruin nobody had opened, with the stock still in it
- **a portal, or an environmental event** that put somebody where the world no longer is
- **an ancient inheritance**, stocked deliberately by whoever left it
- **a major sect's backing** - their chosen, with people sent out on their behalf

The last one is the most interesting socially, because **practising the art advertises the
backing.** You cannot hide that a house is spending on you; the art itself is the evidence.
That makes a person a client, a target and a curiosity at once, and it gives the house a
hold that needs no contract, because the supply is theirs to continue or to stop. **An
ancient art with a material requirement is a relationship, not an acquisition.**

### The library that holds the book and none of the material

A great house holds a copy, brought back by an expedition generations ago, and has nothing
left to feed it. Four things follow:

1. **It explains why a house would part with one.** Giving away a book nobody there can use
   costs nothing, so an ancient manual can be a reward, a favour, or a consolation prize,
   handed over by people who are not being generous. The manual becomes reachable while the
   art stays out of reach.
2. **It explains where the dismissal comes from.** See above: the elder is quoting their own
   institution's failures.
3. **It dates the loss.** *From past expeditions* means the house once could resupply and now
   cannot, which is the late age in miniature.
4. **It gives a player a goal with a known destination.** You can read the book, you know
   exactly what you need, and you know nobody has any.

`ARCHIVE_COPIES` records which houses hold a copy and whether their stock is `spent`,
`never_had_any`, or - once, and it should stay once - a `remnant` they have told nobody
about. A house with the book and no material is a different house from one with neither, and
from one quietly holding the last of both.

### Stocked inheritances

The answer to how anybody without a house behind them gets far up a material-gated art:
**somebody at the top of the ladder planned for it and paid in advance.**

A cultivator at the last rung is the one person who can. They have the reach to have gathered
the material, the standing to have held it, and a crossing ahead of them that consumes tens
of thousands of years and that they may not come back from. Leaving a stocked inheritance is
not eccentric; it is the obvious act of somebody with everything and a deadline.

**"Enough for level *x*" is a metered, deliberate choice.** The ceiling is set by a dead
person's judgement about how far their heir should get, and it is legible before anybody
starts - which makes it a decision rather than a surprise. It also gives the *"you won't get
past the fifth level"* dismissal something to be wrong about: the elder is right about the
world and wrong about this cultivator, because somebody privately provisioned them past it.
That is the best version of defying a correct prediction, and it is earned rather than lucky.

Keep them rare and keep the ceilings honest. If a stocked inheritance routinely carries
somebody to the top of an art, the scarcity the tier rests on evaporates. The interesting
number is one that gets somebody genuinely far and then stops, **leaving them standing
exactly where a dead person's generosity ran out.**

There is exactly one in the catalog. Defend that number.

---

## The thousand-year medicine

<!-- tier: 2 trigger="the player finds, is offered, or hears of a life-extending medicine, or asks what an old house is holding" -->

A pill. It grants **a thousand years, flat, at any rung, to anybody who swallows it**, at no
cost on the way in.

**Why it is a pill and not a new kind of thing.** `extend_lifespan` already existed and the
lifespan ladder already ran five, twenty, a hundred, five hundred and three thousand years,
so this is a sixth rung of a ladder that was already there. Per
[`../../AGENTS.md`](../../AGENTS.md): no parallel catalogs for important things. Its
significance is legible *because* it sits in the same column as a pill that mortals ruin
families for.

**It is not the biggest number and that is deliberate.** The Immortal Longevity Pill grants
three times as long. What is different is two ordinary fields: **toxicity zero**, where every
other rung of that ladder is a bargain with a price attached, and a value at the exact
ceiling of what the catalog can price. The most valuable object anybody can name, and not for
sale anywhere.

**It prices itself.** A thousand years is a rounding error to somebody with a century of
ambition and decisive to somebody at the top of the ladder facing a crossing that consumes
tens of thousands of years of their span. Nothing branches on who swallows it.

**No more are coming.** The flower needed an arterial vein reaching the surface and staying
there, which the world no longer produces, and nothing is sent down from above either -
because what is above the Lid depended on what grew below it.

**"Sparingly" means it is being held for somebody.** A house sitting on one is not
hoarding in the abstract; it is waiting for a specific person's remaining years to matter.
The natural consumer is an elder running out of time - the same person the ancient roads
sort themselves toward, which is not a coincidence.

`MEDICINE_HOLDINGS` records who still has theirs, who has spent it, and the one house nobody
can confirm either way. **A house that has spent its one is a different house from a house
that has not**, and that is exactly the sort of fact the Standing Register and
`standoff.ts` are built to argue about.

---

## Where all of this is, and where it is not

<!-- tier: 2 trigger="deciding where to place an ancient object, or whether a low-realm cultivator would know about one" -->

**The ancient tier is invisible from the bottom of the world.** A disciple at a small house
does not encounter ancient arts, meets nobody practising one, and has no reason to believe
the category exists. It becomes visible as they rise: first a rumour, then something an elder
mentions without explaining, then a thing they can watch somebody do.

That is [`discovery.md`](discovery.md) applied to objects rather than institutions, and its
ladder - `unaware → whisper → named → placed → encountered → known` - is the right shape for
how a player should learn that any of this exists.

So, when placing:

- **Concentrate it in the top sects' archives.** Not scattered. The houses holding copies
  should be the oldest and highest, which is also what makes *their stock is spent* a
  statement about the late age rather than about one house's bad luck.
- **The exception is luck, and it must stay exceptional.** A ruin, a portal, an environmental
  event, a stocked inheritance. Somebody who got lucky is a *story*, and stories are rare by
  definition. If low-realm cultivators routinely turn up ancient arts, the tier stops meaning
  anything and the top sects stop being distinctive.
- **The knowledge gate does the work for free.** The narrator may not name what the player has
  not heard of, so placing these things high and rarely is sufficient. No rule has to hide
  them.

Lower down, somebody practising an ancient art would not be judged - **they would not be
understood at all**, which is a different scene and an equally usable one.

---

## What this is for, in play

| Tier | What it puts in front of a player |
|---|---|
| **abandoned** | a choice, with a social cost. The road is open, it works, and taking it marks you. |
| **lost** | a reason sects send people out. You know what you need and where it isn't. |
| **no surviving copy** | a thing the world can name and nobody will ever hold. |
| **the medicine** | the one object that buys the only thing scarce at the top of the world. |

Together they are the answer to *why enter a ruin*. Not treasure in general - treasure is
a number, and numbers are available from bandits. **The specific thing that cannot be
manufactured, sitting in a place nobody has opened, usually because whoever had it died
before they could use it.**

---

## The rule that keeps this honest

Per [`../../AGENTS.md`](../../AGENTS.md): **no arithmetic in a lore file.** An object made in
a richer age is an ordinary row with an ordinary `power`, ordered against everything else by
the same resolver. What makes it remarkable is that nothing can produce another.

This document describes what the generic systems produce. It adds no rules. If you find
yourself writing a mechanic that applies only to ancient things, stop - the thing you want is
an item, a set membership, or an empty jar.

Take the object away and nothing should be left over.

---

## The test

For any ancient thing you are about to add, answer both:

> **Name what this could do that no amount of tuning a modern art up to the top of the
> ladder would ever produce.**
>
> **Name a situation where the ordinary thing at the same rung is plainly what you would
> rather be holding.**

And say which of the three tiers it belongs to, and why.

If the first is hard, it is a modern thing with a bigger number. If the second is hard, it is
a strict upgrade and it breaks the abandonment. If the tier is hard, nobody has decided
whether the world chose this or lost it, and that is the most interesting question about it.

If any of them is hard, the thing is not finished.

## Related

- [`the-late-age.md`](the-late-age.md) - why the world is poorer than it was, and what a sealed ruin is
- [`making-places-different.md`](making-places-different.md) - the same argument, applied to regions
- [`discovery.md`](discovery.md) - the awareness ladder that keeps this tier out of sight from below
- [`escapes.md`](escapes.md) - the routes past a manual's ceiling; an abandoned road is one of them
- [`immortals.md`](immortals.md) - what crosses the Lid, and what it turns out depended on the ground
- [`../../src/data/cultivation/lost-ages.ts`](../../src/data/cultivation/lost-ages.ts) - the catalog side of everything here
