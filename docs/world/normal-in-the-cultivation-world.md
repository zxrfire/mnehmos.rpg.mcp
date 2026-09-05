<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# Normal in the cultivation world

A working list of acts that are unremarkable in this genre and monstrous outside it,
from the design owner. Companion to
[`what-the-genre-does-and-whether-we-model-it.md`](what-the-genre-does-and-whether-we-model-it.md),
which holds the rulings; this holds the material.

The organising idea, and the reason this is a design document rather than a wish list:

> The same action can be virtuous, pragmatic, or catastrophically stupid depending on
> hidden consequences.

That is 天道无情 as a game mechanic rather than a slogan. The engine does not grade, so
"protect the junior" and "abandon the junior" are both acts with effects, and the player
finds out which they took by living in the world afterwards.

---

## Evil that sounds benevolent

The best category for this engine, because the player decides what the act was and the
engine only records what happened.

- **"Protect the junior."** They get the credit; you get their enemies.
- **"Give the junior guidance."** Teach them - or teach them exactly enough to be useful
  to you.
- **"Help this senior brother recover."** Spend the pill, or keep it.
- **"Escort the mortal village."** Protect them, abandon them, or charge people who have
  nothing.
- **"Accept this disciple."** You gain an apprentice, and their enemies.
- **"A righteous cultivator should avenge the dead."** The dead cultivator left a map.
- **"Save this dying cultivator."** A lifelong ally - or a pouch worth more than the pill
  you would have spent.
- **"Help your junior through his tribulation."** The wholesome one. **Except heaven
  remembers who interfered, and your next tribulation sends one extra bolt.**

That last line is the whole design in one sentence and it is not a punishment for
kindness. It is a cost, the ruthless path has different costs, and neither is the safe
one.

## Technically legal

- **Seize the opportunity** - "you are too weak to protect this; hand it over."
- **Rob the corpse** - mourn them, or empty their pouch.
- **Kill the witness** - somebody saw you find it.
- **Pluck the herb early** - a mediocre benefit now against three hundred years.
- **Take the cave abode** - a good residence comes free the moment its owner dies.
- **Take credit for a junior's discovery** - "I merely supervised."
- **Borrow without returning** - and the longer it is held the harder returning becomes.
- **Cultivation tax** - an elder reallocates your resources to a more promising disciple.

## Senior, surely you jest

- **Tempering the junior's dao heart** by sending them somewhere suicidal.
- **The fake opportunity** - tell a rival where the treasure is. There is none.
- **Advice that is technically correct** and disastrous for their method.
- **Swapped pills**, and the wrong volume of the manual.
- **A karmic debt claimed** twenty years on, with interest, for one spirit stone.
- **The forced duel** you cannot refuse without losing more than you would by fighting.
- **The face-saving duel** - lose on purpose so they owe you.

## Sects are corporations from hell

- **Mission completion fraud** - send ten into a forbidden zone, reward the two who come
  back with the points of the eight who did not.
- **Contribution-point inflation** - the rate changes after you have saved.
- **A hundred years of closed-door** on the best vein, by one elder.
- **Resource allocation** - one pill, three geniuses.
- **Faction recruitment**, and **faction purge**: your method is forbidden the day your
  faction loses.
- **The ancestor's decree** nobody may question and nobody remembers the reason for.
- **The marriage alliance** for somebody else's spiritual root.
- **Disowning** a disciple whose cultivation was crippled.

## Truly xianxia-tier

- **Spirit root theft** and **bloodline harvesting** - your ancestry in a vial.
- **Possession**: a remnant soul hidden in a junior. **夺舍 body snatching**, and its
  counterplay - the helpless old soul was planning this.
- **Soul-searching** because "if you are innocent you have nothing to fear."
- **Karmic substitution** - redirect your tribulation onto somebody else.
- **Tribulation sabotage** - interfere while they are crossing.
- **Provoking a tribulation** while standing next to your enemy.
- **Dao heart demon** - work on somebody's attachments so their next breakthrough is
  harder.

## Constitutions, and what having one costs you

Pure Yin, Nine Yin Profound Body, Heavenly Yin, Innate Dao Body, Nine Yang Divine Body,
Void Physique, Primordial Chaos Body, Heavenly Demon Body, Sacred Bone, Immortal Bone,
Sword Bone, Dao Bone.

The design owner's point is not the list. It is the sentence that follows it:

> The sect is not recruiting her because she is talented. They are recruiting her because
> she has a Pure Yin Physique.

And therefore: **"Junior brother, whatever you do, do not reveal your constitution."**
Because everyone knows the chain - auction, kidnapping, furnace cultivation, bloodline
extraction, forced marriage, sect war. That chain is what makes a physique a mechanic
rather than a stat block, and it is why the knowledge gate on it matters more than the
modifier does.

## 邪功 / 魔功 - the forbidden arts

Heaven Devouring Art (consume cultivation), Blood Demon Scripture (blood essence), Soul
Devouring Scripture, Heavenly Demon Disintegration (spend your own body for temporary
power), Five Ghosts Carrying Fortune, Luck Devouring Technique, Heaven Stealing Secret
Art, Myriad Souls Banner, Corpse Refinement, Blood Corpse, Ghost Cultivation.

## Fortune is already a stat, and stealing it is the most xianxia thing available

`Fortune` is one of the four attributes this engine already rolls and already prints on
the state summary - and **measured, it is not decorative**:

| reader | what it decides |
|---|---|
| `engine/encounters/window.ts:271` | `fortuneOf(cultivator.fortune)` - **which encounters the world puts in front of you** |
| `engine/cultivation/price-of-advancement.ts:448` | `-fortune * TOLL_FORTUNE_RELIEF` - what advancing costs |
| `engine/cultivation/spirit-roots.ts:376` | rolled and clamped to 0-3, so one point is a quarter of the range |

So the villain's technique does not have to steal the treasure:

> They steal the protagonist's plot armour.

An art that moves Fortune from one person to another needs no new resource, no new
catalog and no new subsystem - the number exists, it is already read, and it is already
the thing that decides who finds what. Stealing it is not a metaphor for taking somebody's
plot armour; it goes through the function that chooses what they run into.

**Design, when the tree is quiet enough to build it.** A taking, so it goes through the
paths a taking already has - the deed, the grudge, the reprisal, the house's response -
and NOT through a second consequence system. One point moves, clamped at both ends, so
the thief cannot exceed the range a roll could have given them and the victim cannot fall
below what an unlucky roll would. It is an ART, which means it has to be learned before it
can be used, and that is the gate rather than a rung requirement.

The reason it must not be a bespoke rule: take the art away and both people price out as
ordinary cultivators at their own Fortune, with no residue anywhere. If anything in the
engine has to know that a Fortune was stolen rather than rolled, the design is wrong -
`window.ts` should read the number and never its history.


---

## What a cultivator can carry, which is currently everything

**Measured: there is no carrying limit anywhere in this engine.** Every `capacity` field
in the tree is about how many PEOPLE a place holds (`places.ts`, `architecture.ts`);
`cultivator_pouch` has rows and no ceiling, and `listPouch` just lists them.

The design owner's progression:

- **You start with a bag.** Modest, ordinary, and everybody has one.
- **Nobody starts with a storage ring.** It is acquired, and having one says something
  about you before you have said anything.
- **A storage ring lets you hold more.**

None of that means anything while carrying is unlimited, so **the limit is the feature
and the ring is the modifier**. Built the other way round - a ring that grants capacity
in a world with no capacity - it is an item that does nothing.

It is non-bespoke in the way AGENTS.md asks for: capacity is a property of the container
somebody holds, the container is an ordinary object with a power, and taking the ring away
must leave a cultivator with a bag and no residue. No ring table, no ring rule.

**What it makes true elsewhere**, which is the argument for doing it at all:

- Robbing a corpse becomes a CHOICE about what to take rather than a sweep. Right now
  "empty their pouch" costs nothing and fits.
- Hoarding herbs against a three-hundred-year wait stops being free.
- Provisioning for a long seclusion becomes a real span to plan for.
- A ring becomes worth stealing, which is the genre's own reason rings exist.

Note what already handles the other end: `estate-settlement.ts` takes everything off a
corpse and states that a corpse holds nothing, so the taking side is built. It is the
holding side that has no ceiling.

**Craftable, and the machinery is already there.** `craft` landed today with
`planTheBuild` / `landTheBuild` / `mintCraft` behind it - a bill of materials, work over
days, a seeded outcome, and a minted tracked object. A ring is that shape: a bill, and a
thing at the end. What the bill is made OF is open, and the honest way to settle it is to
look at what the world already produces rather than inventing a material to suit the
recipe. If nothing in the catalog reads as spatial, say so - a new material invented for
one item is the bespoke failure, and "there is no bill for this yet" is a finding worth
reporting rather than papering over. That is exactly the call the crafting pass already
made about forging a sword.


---

## A lie the engine holds, and the reason it is hard

The design owner's example, and it is the best test case the deception system will get:

> An ancient remnant soul offers to become your master. This is either the greatest
> opportunity of your life or an extremely elaborate body-snatching scheme.

The player must not be able to tell. That is not a matter of writing it ambiguously - it
is an architectural constraint, and it falls on the FACT CHANNEL rather than on the prose:

**The engine must hand phase 3 the same facts in both cases.** If the honest offer and the
夺舍 attempt produce even slightly different lines - a different verb, an extra clause, one
fact present in one and absent in the other - a model will write them differently, and the
player will learn to read the tell. The lie leaks through the narration without anybody
lying, because the engine described two different situations.

So it is testable, and the test is the feature: **run both, diff the facts, and they must
be identical.** Whatever distinguishes them lives in the world and in the player's
evidence, never in what the turn says.

Everything needed is already here. `interact` has a `deceive` intent. `knowledge.ts` keeps
what somebody has heard of separate from what is true. `secrets.ts` is written and unwired.
The discovery rule already forbids the narrator naming what the player has not earned.
What is missing is the join: **a thing that is true in the world, believed or not by the
player, with the belief and the truth stored separately and never compared in the prose.**

The genre runs on this. The helpless remnant soul planning to take your body is the
counterplay to 夺舍 that the design owner listed, and it only works if the offer and the
trap are indistinguishable at the moment of offering.


---

## The tomb opens, and everybody goes

The design owner's account of how this world reacts to an ancient tomb, which is not how a
Western fantasy setting reacts:

> "AN ANCIENT EMPEROR'S TOMB JUST OPENED." "Where?" "3,000 li east." "FUCKING GO."

Nobody evacuates. The nearby cities get **busier**: inns triple, passage counters fill,
black-market maps appear within hours, every sect sends people, loose cultivators form
temporary alliances, and old monsters come out of seclusion. That a tomb might kill almost
everybody who enters is not a reason to stay away - it is the reason the good things are
still in there. *Of course it is dangerous. That is where the good stuff is.*

The important half is that **information is the opportunity**. Hearing it three days before
your rivals is worth more than a technique, which makes the awareness and rumour layer the
game's real economy rather than a politeness system.

### Almost all of this is already written and unreachable

| module | state |
|---|---|
| `engine/world/convergence.ts` | written. Its own header: *"`OpeningCycle` has been on `LocationRecord` since the location layer was written - `periodDays`, `openDays`, `phaseDay`, `isOpenOn` - and nothing in play has ever consumed it."* |
| `engine/world/gatherings.ts` | written, unwired, and it already calls convergence |
| `engine/world/arrivals.ts` | written, unwired |
| `engine/world/the-world-changing-on-its-own.ts` | written, unwired |
| the rumour / hearsay pipeline | **wired** |
| `market-prices.ts` | **wired** |
| `fold` (`how-far-somebody-can-fold-space-and-what-it-costs.ts`) | **wired** - `foldRangeInWalkingDays`, `priceFold`, `landsShortByDays`, `settlingDaysFor` |

So the tomb rush is a JOIN, not a build. It is also an entire loop rather than one
mechanic, which makes it the largest cheap win found so far.

### One correction to what convergence.ts assumes

That module states as a design result that **nobody ever clears a ruin** - the far rooms
are out of reach of anybody who also intends to leave. The design owner's ruling is that
this is wrong as stated, because it makes the deep content permanently unreachable:

> That would make content impossible. This requires a Void Refinement cultivator to
> teleport you out, which is already coded. And it ought to have good stuff.

So the rule is **out of reach of anybody who intends to WALK out**. Somebody who can fold
space, or who brought somebody who can, reaches the far rooms. That changes the gate from a
wall into a **social and financial one**, which is the better version and the more xianxia
one: the deepest inheritance is reachable by whoever can secure a high-realm ally, pay one,
or become one.

It also makes `fold` load-bearing for the first time. It is wired, priced, and currently
has little to do; this gives it the job the genre gives it.

And the far rooms must be worth the trip. A deep room that pays what a shallow one pays
turns the whole clock into a formality.


---

## Talismans, and why the fold answer needed them

An earlier draft of the convergence note said the deep rooms are reached by bringing a Void
Refinement ally. The design owner killed it:

> Why would you come with a void dude when they can just get it themselves? You have to go
> in first and burn a talisman to summon him.

That is right, and the escort version was never coherent. The obvious objection is that
somebody who can fold into the far rooms would go alone and take everything - but the
design owner's reason is better and it is the one that needs no rule to enforce it:

> Void refinement cultivators have better to do.

The ladder is steep enough that they are not competing with you. A tomb that would change a
Qi Condensation disciple's life entirely is beneath the notice of somebody with their own
crossings to make and centuries to spend on them. The engine already holds this as the
categorical gap - a contest across four realms is a no-contest, and
`PROTECTOR_HELPLESS_REALM_GAP` says the same from the other side.

Nothing in the engine should have to say "a Void Refinement cultivator will not escort you".
It should fall out of what their time is worth.

### TWO DIFFERENT ITEMS, AND CONFLATING THEM GETS THE ECONOMY WRONG

An earlier draft of this section had the high cultivator SELLING extraction talismans as a
safe trade. The design owner's correction:

> That's an attack. The void teleportation is not an attack. It brings them there to get you
> out. So you can imagine they wouldn't sell it - they only give it to their juniors.

Two item classes that look alike and behave nothing alike:

| | **attack talisman** | **extraction talisman** |
|---|---|---|
| what it holds | stored power, one use at a grade | a claim on a specific person's time |
| who can use it | anybody - fungible | anybody, but it calls ONE named cultivator |
| what it costs the maker | materials and a day | **their personal attendance, later, at a moment somebody else picks** |
| can it be sold | yes - it is a commodity | **no** |

Selling an extraction talisman means promising a stranger you will drop what you are doing
and fold across the world when they burn it. Nobody sells that at any price, which is why
in the genre they are **given, and only to your own**.

**So the deepest content is gated by WHO YOU BELONG TO, not by what you can pay.** A rogue
cultivator with a fortune cannot buy one. A disciple of a house that values them has one in
their sleeve. That is why loose cultivators die in tombs and sect disciples come back, and
it is a far better gate than money because it makes the social systems this engine already
has - patronage, master and disciple, membership, standing - into the thing that opens the
deep rooms.

It also gives **taking a disciple** a real price and a real return: your juniors carry your
talismans, which is a claim on you, and it is part of why they follow you rather than
somebody else.

And it opens the cleanest betrayal in the game. A master hands you a talisman. You burn it
in the far rooms. **Nobody comes.**

### The mechanic, in the design owner's words### The mechanic, in the design owner's words

> Talismans should exist with grades too, that give an attack at that grade. One attack.
> That gives at that tier.

**One use of power at a stated tier, by anybody.** A Qi Condensation cultivator holding a
Core Formation talisman throws one Core Formation attack. That is the genre's equaliser and
the reason an ambush by somebody weaker is worth fearing.

Non-bespoke, and this is why it is cheap: a grade is a realm ordinal, which the engine
already has; the attack resolves through the confrontation resolver that already exists,
at that ordinal, once. **No new combat rule** - the talisman supplies the number, not a
second physics. Take the talisman away and the holder prices out at their own rung with no
residue.

The escape or summon talisman is the SAME item class with a different effect, which is what
makes the convergence answer work without inventing anything.

### Its design is already written, at the top of the ladder only

`immortal-items.ts` has `ImmortalItemFormSchema = z.enum(['golden_pill', 'talisman'])` and
describes them as *"fungible, **usable by anybody**, and impossible to trace once out of the
hand."* That IS the mechanic - power without a realm requirement, one use, and it changes
hands cleanly. `beasts.ts` already carries the raw material: feathers *"swept off a roost
floor by the sackful. Holds qi briefly and badly, which is exactly what a cheap talisman
needs."*

So the world already has the top rung and the raw material and **no rungs in between**.
What is missing is `talismans.ts` - the ordinary ones, graded, with the immortal tier
sitting on top of the same ladder rather than beside it.

Two things that fall out and are worth keeping:

- **Traceability is a grade property.** The immortal ones are impossible to trace. A cheap
  one need not be, which makes a talisman used in a killing into evidence, and evidence is
  something the witness and rumour pipeline already knows how to carry.
- **Craftable**, through the bill machinery `craft` landed with, out of a material the
  catalog already produces. That is a rare case where the recipe does not have to be
  invented to suit the item.


---

## Every art has stages, and the furnace art is shaped to be forced

The design owner's rules, which settle both how arts work generally and why the furnace one
is the exception that proves it:

- **Every art has stages you cultivate to.**
- **Typically the stage of the art equals your own stage.** An art keeps pace with the
  person.
- **If you are higher, you can cultivate a lower art.** Height opens downward, never
  upward - which is how a strong cultivator sits a low-stage art with a weak partner at all.
- **The furnace art caps at 46 and gives absolutely zero combat power for the furnace half.**

That last pair is the design. The art runs the whole ladder, so nobody is too weak to hold
it - and it buys the holder nothing in a fight, so nobody would choose it. **It has no realm
gate because it grants no power.** Which is exactly why anyone can be made to cultivate it,
and why nobody ever does willingly.

### What follows, and it is all emergent

- **A furnace cannot be made in a sentence.** The art answers between two people who are
  both sitting it, so somebody who has never opened it is not half of anything. `I use him
  as a furnace` must fail, and the refusal is true rather than invented: *you cannot use him
  as a furnace, he has not cultivated the art.*
- **The road is making them cultivate it**, over years, which is the genuinely sinister
  version and is a campaign rather than a verb.
- **What a furnace is worth is their own stage**, not the user's. So a valuable furnace is
  one somebody has grown, and keeping one is a long investment in another person's ruin.
- A cultivator found to be holding the paired art at a high stage and nothing else is a
  person whose whole life has been spent as somebody's resource, and anybody who can read a
  technique list can see it.

`paired-breath-canon` already exists in `techniques.ts`. `KnownTechnique` does not carry a
stage yet - `techniques.ts` states that mastery is per-cultivator state and never catalog
state - so the depth term is written and waiting on the number.

### And the refusal may not be a blank face

The design owner, on the general failure and not only this one:

> The refusal cannot read as "he reads with an empty face". That's a bad response, and
> that's true for a lot of things.

A refusal that names nothing teaches nothing, and this repo already knows it - the
`unclear` branch names live options for exactly this reason. So a legitimate refusal says
which half is missing and what road that implies. "You cannot" is not an answer. "He has
not cultivated the art, and somebody made into a furnace was made into one over years" is.


---

## The rite is two halves, and `runsOn` already says which is which

The design owner's correction to a first attempt at the gate:

> The furnace technique is weird to do because it does two things at once - taking and
> giving - and you need to know who is who. Maybe split it into two techniques that happen
> to be linked.

The first attempt hardcoded one art id and asked both parties whether they held it, which
cannot tell a taker from a furnace. **The catalog already carries the distinction**, on
`TechniqueSchema.runsOn`:

| value | what it means | rows today |
|---|---|---|
| `self` | ordinary; runs on your own qi | the default |
| `everyone` | mutual - both sides give and get | `twin-lotus-cultivation-method` |
| **`the_others`** | **fuelled by another person** | `crimson-bound-union-rite` and two more |
| `own_lifespan` | the tithe arts; you spend your own years | 2, and **nothing reads this** |
| `the_dead` | corpse work | 1 |

So the taking half exists and is already marked. `crimson-bound-union-rite` is it, at
ordinal 15, `requiresPeople: 2`, and its own description says *"one is made to run the wrong
way... it does not ask whether the second channel was offered."*

**What is missing is the other half** - the art a furnace cultivates. Until that row exists
the rite cannot open on both sides, and `whatThisFurnaceIsWorth` reads zero for everybody.

Two rulings that shape it:

- **Neither half is a weapon.** Both carry `damage: null` already. The design owner: *"the
  taker also gets 0 combat power out of the technique itself - they also need to cultivate
  something else - but they do get qi."* So the taking half yields progress, never a blow,
  and a cultivator who has spent their life on it can be beaten by somebody who spent theirs
  on a sword.
- **Roles are read off the arts held, never off the call site.** That is what makes a person
  legible: a technique list showing the furnace half at a high stage is a life spent as
  somebody's resource, and anybody who can read one can see it.


### Three things that are not each other

The design owner's distinction, and the catalog currently blurs the middle one:

| | what it is | how it is told apart |
|---|---|---|
| **The two linked halves** | one draws, one is drawn. Different arts, asymmetric | `runsOn: 'the_others'` against `runsOn: 'own_lifespan'` |
| **A dual cultivation art** | **both parties cultivate the SAME art** and both gain | `runsOn: 'everyone'`, `requiresPeople: 2` |
| **Sharing a road with your dao partner** | you happen to cultivate the same art as somebody you are bonded to | no mechanic at all - it is a coincidence, and should stay one |

The first is `Lotus-Nurturing Canon` + `Lotus-Plucking Rite`. The second is
`twin-lotus-cultivation-method`. The third is not a thing the engine should model, and
`what-a-dao-partner-is-for.ts` is right not to.

**And a dual cultivation art should open things a cultivator cannot do alone.**
`requiresPeople: 2` already sits on the row and nothing reads it - so the field says a rite
needs two people and the game has never once asked whether a second was there. That is the
combination half of the mechanic, and it is the reason the mutual art is worth cultivating
at all rather than being a slower way to do what you could do by yourself.

---

## A party

The design owner: **you should be able to join one and lead one**, and it should fall out of
the sect mechanic or of marriage rather than being a fourth kind of grouping. You go to
ruins, or elsewhere, together.

**A party has no required size.** The design owner: *"the party mechanic doesn't REQUIRE 2,
you can have a bunch of single dudes."* It is not the paired-art mechanic with a different
name - `requiresPeople: 2` says a particular RITE needs a partner, and a party is just who is
travelling with you: one person, or six unattached ones, or a married pair and four
strangers. Do not put a floor on it and do not derive it from a bond.

What it would reuse: membership and rank already say who answers to whom; `convergence.ts`
already makes a ruin periodically reachable with far rooms out of reach of anybody who
intends to walk out, which is the clearest reason in the setting to bring somebody at all.

The thing to avoid is a party being a new noun with its own rules. A party is **who is
travelling with you**, and what it changes is what the ground does to a group rather than to
one person.

### And what a party is for that one person is not

The design owner, on the arrangement everybody in this genre knows: **forcing lesser
cultivators to go first in a ruin so they die and eat the traps**.

It is a good test of whether the party is a real mechanic or a list of names, because it needs
nothing new. Going into a site is already a read against a **claimant** -
`readAdmission` says what the ground does to a body of that size and `readGates` says whether
that person satisfies the locks somebody built, both of them pure, both of them keyed on who
is being measured. Sending somebody else through the door first is the same two reads run
against a different claimant, with what comes back landing on them.

So the parts are: a party (who is with you), `coerce` (already the route for making somebody
do a thing they would not choose), and the site reads (already pure and already per-person).
Nothing about the trope should be written as its own case, and if it needs one, the party is
the thing that is wrong.

What it must **not** become is a "fodder" flag on a person, or a site option called
*send someone in*. The player says who goes in. Whether that person goes is `coerce`'s
question and turns on what it costs them to refuse; what happens to them in there is the
site's question and turns on their own rung. A disciple who outranks the trap walks back out,
and that is the same rule as the one that kills the mortal.

## Somebody dying says something

The design owner: **the dude should die with a message (unless you're so strong you just one
shot them). some sorta dying breath or before that** - and, on where it comes from, *that
falls out of npc's talking*.

It does, and it did not: `scene-person-readings.ts` priced the dead INTO the scene - a killing
is the loudest thing that can happen to the people who merely watched it - and then gave them
no line of their own. So the person a killing happened to was the one person in the room with
nothing to say about it.

The exception is the design owner's and it needs no number of its own.
`HELPLESS_REALM_GAP` is the combat module's existing statement of when a confrontation stopped
being one: at two major realms it resolves in a single action with nothing contested and no
exchange rolled. Somebody who never got an exchange never got a moment to speak in either.
Below it there were rounds, and a person with rounds in them has a last thing to say - whether
they say it is the ordinary cost question every other person in the scene is put through.
