<!-- tier: 2 trigger="a house's offices, its elders, or who succeeds to what is in play" -->

# Offices and succession

There are fewer offices than people who could hold one. What that scarcity moves,
what removal costs, and why a personal disciple's place dies with their master's.

Part of [`sects.md`](./sects.md).

## A house has fewer offices than people who could hold one

<!-- tier: 2 -->

**An elder is somebody whose climb has stopped.** They take responsibility because they are
not going further - management is what you do when you have settled. A conclave disciple can
stand at the **same rung**, young, with a future, and is given no administration to carry. So
the title is the house's verdict on whether you are finished, and an elder may still advance
anyway, out of luck.

**What an elder holds is a room.** Not a word on a ladder - every house names its tiers in its
own idiom and none of those names is a domain. An office is a room somebody is in charge of:
the sealed ones, the archive and the treasury and the tribute room and the under hall, and
also the two that are offices without locks - the mission hall, which disciples walk into to
take work, and the life lamp hall, where the roll is kept and the Internal Affairs Elder
answers. `architecture.ts` carries `office` and `sealed` as two columns for exactly that
reason. Whoever holds a room answers first about anything inside it.

**An office is dealt in the round it was added, so adding one moves nobody.** The deal hands
rooms out round-robin among the people who decide (`whoIsInChargeOfWhat`), which used to sort
by depth alone - so a room inserted above the others shifted every holder, and the first
attempt at making the ancestral hall an office moved discipline permanently out of the reach
of the rung that held it. Offices now carry the round they were added in
(`officeAddedInRound`), every earlier round is dealt before any later one, and the Internal
Affairs office was added in the second round.

**A room dealt a second time round is COVERED, not held.** A house seats one elder with an
office per office, so where there are more rooms than people who decide, somebody who already
runs one answers for another: the portfolio says who (`APortfolio.actingId`), which is the
middle step of the vacancy this document describes - the holder dies, somebody senior covers
visibly, and the ordinary promotion fills the chair. Where nobody inside clears the bar, the
chair is filled from outside instead, at the higher bar an outsider owes
(`a-house-takes-in-an-elder-from-outside.ts`), and the treasury pays for it.

**Which of the people who clear it gets the chair** is settled in one place and not restated
here: realm first, and a whole realm up wins over everything else; then merit; then loyalty;
then the rung they already stand at. The house is not choosing the most deserving, it is
choosing the strongest of those who qualify, and the loyalty term never lifts anybody over a
whole realm. The order, the minimums and how much further past the bar an outsider has to
stand are all in `src/engine/world/promotion-inside-a-house.ts`. An outside elder and an elder
with no office are the same offer read twice - a seat with no room attached - which is why the
bar is the thing that differs and not the offer.

**And there are not enough of them.** Measured across the catalog: **2.06 sealed rooms per
house against 2.3 deciders.** Slightly more people who could hold an office than offices to
hold, in every house, permanently. That gap is not an accident of counting - **it is the
pressure that moves people.**

**So the ordinary reason somebody leaves a house is not failure.** It is that they have
settled, they are worth a room, every room is taken, and whoever holds the one they want is
not dying soon. They wait, or they build a following instead, or they take somebody's office,
or they go. `leadership.ts` has always said elders who leave take their followings with them;
office scarcity is what drives it.

**An elder with no office is rare and earned**, because a house carrying a title and a stipend
with no room attached is carrying bloat and will not do it for somebody it is lukewarm about.
They keep elder standing and may take disciples - and since a following is what weighs a voice
in the room, somebody with no office and many disciples can outweigh somebody with a sealed
room and none. It is strictly the worse seat, since an office-holder takes disciples too, and
it is still enough to matter.

**A head can force an elder out of their room, and it costs him.** Not a veto he needs
permission for - he can simply do it, and doing it spends his standing in the house the way
overruling the room does. That is what stops offices being reshuffled at whim: removal is
available, expensive, and visible. `spendStanding`, `backlashLevel`, `obstructionChance` and
`departuresAt` are already the machinery for what a leadership act costs and what it provokes;
turning somebody out of their office is one.

**And removal has two degrees.** He can take the room away, leaving an office-less elder -
the rare, earned, strictly-worse seat, reached this time by being pushed rather than carried.
Or he can **expel them from the house entirely.** Both cost him; the second costs more, and it
buys something worse than resentment. An expelled elder walks out with **elder standing, their
arts, and whatever following went with them** - a person with a grudge, resources and nothing
left to lose inside the house that made them. Turning somebody out of a room leaves an enemy
you still have to sit with. Turning them out of the house leaves one you cannot see.

**The elders have no formal protection and a real one.** Nothing in the rules stops a head
removing them. What stops him is that each removal buys resentment he has to keep paying for,
and a head who has spent enough of it is a head the room can overrule - which is the tier that
already exists, arriving as a consequence rather than as a rule about offices.

**And a scarce office is a motive.** A room somebody else holds, who is not dying soon, is a
problem with an obvious and terrible solution. Arranging that a seat comes open is a thing
people in this world do, and demonic houses do it more readily because they have fewer
inhibitions about who they are willing to hurt.

**But a demonic house punishes you for it anyway, and possibly harder.** Not despite being
demonic - **because you did it to one of their own.** Demonic is a position about who a house
is willing to hurt *outside* itself. It has never meant a house is lawless *inside* itself: a
member who kills another member has attacked the body they belong to, and every house alive
punishes that. `ifCaughtPractising`'s alignment switch is the shape - a demonic house
returning `killed` where a righteous one returns `questioned` is that switch answering the
same question about a different house, and the demonic answer is the harsher one.

**"If they find out" is the whole of it.** The crime is not automatically detected. A wrong
nobody can attribute opens an account with no name on it; a wrong with a witness opens one with
a name. So the risk is not a die roll on punishment - it is whether what you did reaches the
people who would act on it, which is the same knowledge layer everything else in this world
runs through.

**The narrowing runs the whole way up, and the top of it is a person rather than a rung.**
Five inner disciples worth watching; three of them reach conclave; and of those, **one - or all
three, depending on the patriarch - become personal disciples.** How many is the head's choice
and is a fact about that head rather than about the house.

**A personal disciple is the patriarch's own.** The head may teach others, and often does, but
a personal disciple **gets the bulk of it** - and they are not the house's disciples, they are
*theirs*. That is the difference between being taught in a house and being somebody's student,
and it is the route by which anything the head personally holds reaches anybody at all.

**The room may argue about it and the head decides.** Elders can have opinions about who is
taken, and they have them - but this is the head's personal matter and the final say is theirs.
It is the one choice in a house that is not the room's to settle.

**There is one rank between an elder and the head: the GRAND ELDER.** First among equals of
the elders, **one spot only**, second to the patriarch and below him. **It is where a head
retires to.** A patriarch who steps down because he is old goes into that seat rather than out
of the house - he stops leading and does not stop being the deepest person in it.

**And a personal disciple's PLACE dies with their master's seat. The relationship does not.**
When a head dies, or retires into being grand elder, their personal disciples lose **the
position**, and the next head takes their own. But **a master is a master until he dies.** A
retired head is still teaching, and the people he taught are still his - they simply are not
with him every day any more.

So what somebody drops into is not *nobody*. It is **a disciple with a master**, which is the
ordinary condition of most conclave disciples and a good many inner ones. The rare thing was
being the head's *personal* student; having a master is normal, and it survives everything
except death.

**They are demoted to wherever their skill puts them against the pool as it stands today** -
which is usually conclave, since somebody the head was teaching is generally at least the equal
of the conclave disciples. Not back to where they started, and not to a rank the position
reserved for them. **This is the same instrument the house uses to place an outsider**: compare
them to the people already there and put them where they actually stand. A member who has lost
a position and a stranger at the gate are the same question asked twice, and the arts the head
taught them are theirs and do not unhappen.

**And nobody is treated badly for it.** A house does not turn on its former personal disciples.
They were chosen, they were taught, their master's seat ended - and they are placed where they
now stand, which is usually near the top of what is left.

**The same comparison runs downward, and it runs all the time.** Conclave is held **against the
pool**, not awarded once: when enough inner disciples are plainly better, the elders ask
somebody to step aside and go back to inner. That is not a punishment and it is not a
disgrace - it is the count. Five worth watching, three places, and the three are not the same
three forever.

**And it is settled with a tournament, on the house's own cycle.** The design owner:
*"the thing that rotates is the conclave. They settle it with a tournament on a fixed
schedule, different per sect, depending on the cultivation level of their conclave
disciples."* So the comparison above is not a meeting that reaches a view - the house puts
the holders and everybody at the rung below who can stand on the board into one field, ranks
it the way it ranks every other field (`rankAField`, the same ranking a gathering and a door
conclave use), and the top of the board takes the places. A holder who is beaten goes back to
inner, which is the count and not a disgrace, and the board pays everybody who stood on it
what standing on it taught them.

**The schedule is the height it is held at, and that is why it differs per sect.** A contest
every few years means nothing where the people in it take two centuries to move, so the
interval is a quarter of the years the ladder credits at that rung before it reads somebody as
finished (`stagnationYearsForOrdinal` at the middle of the conclave rung's realm band) - four
contests inside a career at that height. On the shipped catalog that is **13 years** for the
thirty-odd houses whose conclave rung stands in Qi Condensation or Foundation, **25** for the
six in Core Formation, and **500** for the Hollow Court, whose Inner Disciples stand at Body
Integration and above. Each house's own year is drawn once off the seed, so a province does
not hold them all in one spring. Measured over 500 years on two seeds: 622 and
673 places won, 333 and 339 holders beaten for one, so a place changes hands
about nine times a house a century and the rest of the wins are places that were
standing empty. Built in
`src/engine/world/a-conclave-seat-is-won-in-a-tournament.ts`.

**Inner is where it stops. Once somebody is inner, they are in for life.** That is the tenure
line of a house, and it is what makes the ranks below it a filter and the ranks above it a
contest. Everything above inner can be lost by somebody else being better; inner itself cannot.
Nothing in the tournament may take anybody past it: a beaten conclave disciple lands at inner
and stops there.

**An office is held the same way: until somebody takes it away.** There is no term on one and
nothing falls due, so a holder keeps their chair until they die, leave, or are removed - and
removal is a thing somebody does, in the open, by putting what they know about the holder in
front of the room (`REMOVED_FROM_OFFICE` in
`src/engine/world/bringing-what-you-know-about-somebody-to-the-room.ts`, which is where that
act lives because the act is an expose rather than a rule of tenure).

**And what is taken is the room, not the rank.** The design owner, on what a righteous or
neutral house does to somebody it has ruled against: they are *"demoted, removed from office
(title kept) or expelled"*, and *"when i say demoted i mean removed from office."* So the
three outcomes are one ladder and the middle rung is exactly this: the house takes the seat
and the work back, and the person keeps the rank they climbed to and the title that goes with
it. Somebody who was an elder yesterday is an elder today with nothing to run - which is the
elder with no office of the section above, arrived at from the other direction.

**And what decides whether the room ever comes back is influence, not time.** The design
owner, asked whether a removal is permanent: *"depends on your influence so not permanent."*
A door closing is not a door bricked up. So the removal is a **weight against them in the
dealing** rather than a gate in front of it, and a weight can be outgrown while a gate cannot:
every year the house asks whether what this person is worth to it now outweighs what the
disgrace still costs it to keep them. The materials are the ones the house already reads -
face, contribution, the rung they stand on, and who on the roll would speak for them
(`theRoomWouldDealToThemAgain`, `whatTheyAreWorthToTheirHouseNow`).

It is meant to hurt. `WHAT_A_REMOVAL_WEIGHS` is four public wins' worth, so somebody disgraced
has to rebuild real standing before a room is dealt to them again, and the memory of it fades
on a cultivator's clock rather than a mortal one - `WHAT_A_ROOM_REMEMBERS_OF_A_LIFE`, a
fiftieth of their own span, which is a couple of hundred years for an elder of a great house.
An expose that cost a decade and nothing else would make the expose route worthless, and that
route is how a seat changes hands in a righteous or neutral house: 31 and 32 cases a century
against killing for a seat at 0.4.

**Unmeasured, and the number that will settle it:** over a long run, how many people who lost
an office ever hold one again, and how long it took them. If the answer is nobody, the weight
is a gate wearing different clothes. If it is most of them inside a century, it costs
nothing.

So the scarcity at the top is sharper than the scarcity at the elder rung, and it is the same
shape: **more people who could than places to be.** A conclave disciple passed over for
personal disciple has not failed at anything - somebody else was chosen, and there were only
ever one or three places.

**This is also where the world's existing rivalries come from.** The seeded `rival` tie whose
note reads *"Was the other candidate"* is exactly this: the person who did not get the office.

## The Protector

<!-- tier: 2 -->

**One office, and the bar is what moves.** A house's Protector stands for it when something
comes for it - that duty is the office, and it is what separates the post from an honorary
title. A guest owes nothing; a Protector owes defence.

**A lesser sect fills it.** With an ordinary strong person: a retired patriarch, a veteran who
does not travel, somebody whose whole function is to be in the compound when something
arrives. Filled, unremarkable, and **not a False Immortal**.

**A qualifying house reserves it**, will accept nobody who is not a False Immortal, and it is
therefore empty - and has been everywhere in the world for eight hundred years. **That is why
the emptiness means something: the strong people are right there.** They would fill the post at
a lesser house. The refusal is the house declining to pretend a strong person is the same
thing.

**Which houses may reserve it is two facts, not one.** The house produced a False Immortal -
somebody who **came back**, not somebody who **got through**, because a person who went all the
way left and there is nobody a chair could be for. **And the house knows it.** A crossing is
attempted where nobody is told, so not knowing is the ordinary outcome; a house that knows is
the exception, and the chair is the visible form of that. The reserved post is vacant and not
abolished - nobody struck it off a roll, and the tense matters.

**A house can be in neither state.** The Burnt Earth Temple has no Protector at all: their
abbot does not retire, so no retired head exists to fill it, and their only immortal succeeded
and left, so there is nothing to reserve one for.

**And a member is not told whether their house has one, or who.** You are told who is on the
ladder. The Protector sits beside it, and finding out is something a player does rather than
something joining gives them.

**Do not confuse it with a dao protector**, which is the act of standing guard over somebody's
crossing while they are helpless. Eight centuries of vacancy drifted the phrase, so a
cultivator today hears "dao protector" and understands the crossing guard, with no idea the
words also named a seat held for two thousand years at a stretch. The world's usage is
ambiguous; ours is not.

`src/data/cultivation/false-immortals.ts` carries the ruling in full - `THE_OFFICE`,
`theChairIsAPieceOfKnowledge`, `itIsVacantAndNotAbolished`.
