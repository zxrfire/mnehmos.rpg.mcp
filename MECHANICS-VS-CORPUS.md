# Each mechanic, read against the corpus

Method: sample the reference material for how the genre actually renders a mechanic,
then play the same mechanic in the engine and compare. Counting alone is not enough —
read the passages. Findings are listed worst-first within each mechanic.

## Breakthrough

**Corpus.** A breakthrough is NEWS, and the scene is other people reacting to it.
"Prince, you broke through to the Primal Chaos Realm?" — shocked. "Mid-Deva Realm.
Dammit, he really did have a breakthrough!!" The boast is SPEED: "that disciple who
broke through to the Unity realm in just 8,000 years after birth". It is dangerous —
sects forbid internal fighting during Foundation Establishment breakthroughs, because
that is when somebody is open — and it draws tribulation.

**Ours.** `aDeedEntersTheWorld` is called from `combat-verbs.ts` and `site-verbs.ts`.
It is NOT called from the breakthrough path. So the player crosses a realm and nobody
in the world hears about it, ever. The single most consequential event in the genre is
a private stat change.

**Fix shape.** File the deed; let the existing gossip layer carry it. Scale the reach
the way destruction now does — a rung most people never see should travel further than
a first-rung step.

## Seclusion

**Corpus.** Seclusion is a PLACE ("his secluded meditation facilities", "his immortal's
cave"), the world keeps moving while you are in it, and THINGS ARRIVE AT THE DOOR: "a
jade slip that had arrived half a year ago, informing him that...", "Someone had just
flown up to the entrance... holding aloft a medicinal pill bottle." Coming out is an
event. The price of a long one is named outright: "He sat in secluded meditation,
forgotten by the world."

**Ours.** The mechanics are good and honest — provisions run down, the sitting ends
early, the accounting says exactly what was spent and what was not. But a year passed
and NOTHING REACHED THE PLAYER. No message, no caller, no news. Dead world-time.

**Fix shape.** Check whether the world driver already produces events for that span and
they are simply not surfaced on emerging. Suspect it does.

## A group of people

**Corpus.** Named-plus-collective is the workhorse: "Patriarch Violet Sieve and the
others", "the Sect Leader, Jin Yunshan, and all the others". A group is a SUBJECT WITH A
VERB — "The others were appalled as they looked onto the chase below" — not a tally. A
voice comes out of it: "a cold voice echoed out from the crowd." Frequencies over 7,789
paragraphs: everyone 6744, the others 2461, the surrounding 1927, the people 1283, the
group 1093, the crowd 960. Numbers appear for RECORDS somebody would cite ("a total of
39 human sects... were exterminated"), never for bystanders.

**Ours.** Engine strings count them and report observation: "6 other people are here. No
part of this was theirs. They saw it. None of them says anything." This reaches the
player directly in Local Mode AND is fed to the narrator model — while the narrator
prompt forbids exactly this shape.

**Fix shape.** Exact count to `facts.structure`; prose channels get name-plus-collective
and a verb. In flight.

## Buying

**Corpus.** A price provokes the buyer, out loud and in the body: *"That's... that's way too
expensive!"*, *"I don't want to waste so many spirit stones either," he grumbled. "It hurts
me too!"*, *"he shook off the urge to mourn his spirit stones"*. Haggling is a tactic with a
story — *"he wanted to delay and lower the price"* — and the genre's own maxim is *"Haggle,
only the results matter."*

**Ours.** `15 spirit stones of the 30 you had, and the copy is yours. 15 left.` A correct
receipt, and decent raw material: it gives the PROPORTION, which is what makes a purchase
hurt. Engine layer is fine; this one lands or fails at the prose layer.

**Gap.** No haggling mechanic. `haggle` routes to the market read and prices are fixed. A
whole class of interaction the genre uses constantly is absent. Design question, not a bug.

## Fighting

**Corpus.** The most fixed vocabulary in the genre. Counted: *killing intent* 2058,
*trembled* 2452, *mouthful of blood* 482, *coughed up blood* 200, *cold snort* /
*snorted coldly* 657, *eyes flickered* 856, *face fell* 473, *sent flying/tumbling* 177,
*laughed bitterly* 63. **Killing intent is a THING others sense across a square**, not a
mood — *"once he realized who that killing intent belonged to"* — which is why using it does
not break the no-feelings-assigned rule.

**Ours.** The lexicon in `tone.md` had NO violence section at all. Added, with the counts.

## Tribulation

**Corpus.** A public, graded, witnessed spectacle. Onlookers are in an uproar and some flee.
The bolts are counted and coloured — *"eighteen red lightning bolts"*, *"Seven-Colored
Tribulation Lightning"* — and the grade is how others judge you: *"how could it be
three-colored? Just what did this guy do to offend the Heavens?"* It wrecks the surroundings
and endangers bystanders.

**Ours.** `tribulationStrikeCount(ordinal)` exists, so the counted strikes are there. It is
not witnessed, it files no deed, it damages nothing around it, and it does not touch what the
cultivator carries — **though the catalog asserts in prose that it destroys nearly everything
they carried, and calls that "the rule this catalog is built on".** See OPEN-QUESTIONS 2b.

## Good fortune (机缘)

**Corpus.** The genre's main engine of change — the thing that turns a nobody into somebody.
It is a NAMED category people discuss (*"What is this good fortune that the Captain
mentioned?"*), it defines standing and draws envy (*"good fortune like that was something
only Yan'er could acquire"*), it can be GIVEN (*"the time has come for me to give you my
last gift of good fortune"*), and it is not always wanted (*"Fan Dong'er did not wish to have
good fortune like this"*).

**Ours.** Opportunities exist as encounters — inheritance trials, secret realms, an untouched
herb patch, a dead cultivator with an intact pouch. Whether they FIRE often enough, and
whether they change a trajectory when they do, is exactly the "enough to do" measurement.
