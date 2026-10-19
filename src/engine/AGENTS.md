# Engine instructions

Read [README.md](README.md) and each affected subsystem's README. For simulation or
seeding/advancement work also load [world/AGENTS.md](world/AGENTS.md).

## Traits and actors

Objects have no preferences. Put decisions on people, except explicitly built actors
such as an automaton or remotely wielded sword. Reuse existing approval/possession
paths; a war changes what elders will part with, not a treasury's policy table.
Traits are stable readings of a person's ID on separate streams (`openHandednessOf`,
`reticenceOf`, `faceOf`). Each colours all relevant facts, never one bespoke situation.
Read new facts through existing traits and ask what else a new trait reads.
Traits weight odds rather than impose categorical outcomes; pride may reduce reporting,
never make it impossible. Model tendencies, not "typically" as "never".

## Nothing in this world is invincible

The root rule applies at every rung. A defence reduces rather than zeroes harm;
full adaptation still leaves harm from every blow. Name its window, cost or condition. Surviving many weaker attackers is not universal
immunity: a different attack, preparation or exposure can still end the target.
Realm grants must be consulted where outcomes change, and broken crossings must deny
the actual ability rather than only change description.

## A fight is played, not reported

Combat spans turns with real choices: whether to flee, how and where; which art; which
item. Show state needed to decide before resolving the choice. Fleeing works sometimes
at a real price, with actual destinations, surroundings and possible help.
Use the same resolver as NPC fights, with the player entering at another boundary.
An agreed friendly bout changes intent and social consequences, never damage truth.
Round budgets and clearing weaker bodies can buy time without buying force; do not
mistake an unfinished fight for proof of superiority. Whether opponents unable to harm
a body should nevertheless wear it down is an owner design question, not a tuning constant.

## A wound has a cause you can point at

Injury follows an authored event, never a roll against calendar time. The author may
be the player's act or another actor: idling supplies no motive but is no shield.
Conditions (untreated channels, conflicting root, blocked qi) raise an act's cost;
they do not independently fire wounds while somebody sits still.
Scenery cannot injure: a trap, formation or automaton has a rung and attacks through
ordinary exchange. A skip digest names what actually arrived and caused the harm.
Distinguish `simulateTimeSkip`'s `major_encounter` interrupt (materialising nobody)
from `encounters.ts`'s actual occurrences, deltas, knowledge and relationships;
`randomEvents: true` alone does not wire the latter. Harm to the player leaves the
ordinary account, grudge and possible reprisal, just as harm to an NPC does.

## Agency and madness

A lucid dilemma remains the player's choice; never narrate a choice and silently settle it.
A mad character's acts instead arrive as engine-resolved events the player cannot veto.
Outcomes can help or hurt; madness is uncertain, not a narrated debuff. The player still
chooses whether to risk its cause and what to do about it. Entry with no prior decision
that led there is random punishment, outside this exception. The test is whether the
character could choose, not whether the human did.

## What NPCs do is emergent. Never enumerate it

Model wants, not a list of behaviours; a new motive should require no new branch.
For tracked objects, a present personal need is a refusal; a reserved future need is
a price unmet, movable by a trade better serving it. Above the cash tier, favours or
another singular thing move the holder. Do not apply personal bargaining to mundane goods.
The three storage/movement tiers are in [items](../../docs/world/things/items.md):
mundane = price/availability, no row (events move it); counted = amounts on holder/place
(taking moves it); tracked = an individual with provenance (a decision moves it).
Counted stock is recorded and ground stock decreases when taken; it lacks identity/history,
not accounting. Do not rely on internal tier names to explain this to a player.
Tier and grade are fixed at creation; crafting creates, never promotes. Only downward
movement exists (`shardPower`, one rung below the whole).
Rarity is the cohort fraction ever treated/served, not price. Counts need a physical
cause, such as the only capable copyist's time, rather than a rarity label.

## A fact reaches a person, and reaching them is an event

Where knowledge is modelled, consequence fires on learning, with a teller and date,
not merely on the deed. Carrying news has consequences for the carrier; partial or
misattributed news can open an account against the wrong person with full conviction.
Keep three states: nothing known/no account; something wrong/unattributed account;
attributed account. An account can have a null subject and motivate inquiry.
Absence or other observable evidence can reveal harm without a witness. Silencing a
witness buys delay or misattribution, not guaranteed escape. The chain can be unknown,
suspected, named; apply anonymity wherever harm is perceptible without its author
(a theft can be anonymous; betrayal identifies its subject).

## Not knowing is itself something you know

Recognition uses capability (realm) and reference (worldview); lower confidence does
not make their failures equivalent. No reference is blank. An overwhelming realm gap
gives an unhedged "beyond me" warning, without name, house or provenance. Apply this
upstream to arts as well as artifacts. Distinguish "nobody holds this ground" from
"somebody holds it but you cannot know who". Read the actual apex -> court -> local
authority chain; low standing may hide a name but not the warning that it is held.

## A house has no opinions of its own

Institutional preferences derive from actual deciders. Family and sect use the same
faction/rank shape (adoption is family intake), not bespoke flags or faction-pair tables.
Count whether seniors actually carry any field being aggregated; an empty input can
silently make every house identical. Prefer ID-derived traits and existing following
weights (`distributeFollowing`, `(rankIndex+1)^2`) over new scales. Check whether the
consumer uses catalog seniors or the live world roll; they are different populations.
