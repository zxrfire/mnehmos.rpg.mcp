/**
 * Sealed ancestors: sealed and dormant high-realm beings, held and unheld.
 *
 * The Hollow Court description says the quiet part outright - everyone else at
 * that ordinal is sealed under a mountain - and this file is what that
 * sentence commits the world to. There are more of them than any institution
 * has counted, they are not all owned, and the ones that are owned are the
 * reason the map is stable.
 *
 * TWO KINDS, AND THEY BEHAVE NOTHING ALIKE
 * ----------------------------------------
 *   held instruments  a sealed ancestor an institution owns, with a wake condition and
 *                     a cost. One-shot, ends the sealed ancestor, and therefore the
 *                     single most consequential decision that institution will
 *                     ever make. Every one of them has a published condition
 *                     and a private contingency, and the two are never the
 *                     same thing.
 *
 *   unowned sealed ancestors  sealed beings nobody holds. Not instruments: hazards and
 *                     opportunities. Nobody to bargain with, nobody to wake
 *                     them deliberately, and no institution takes
 *                     responsibility if one comes up. Some were sealed BY
 *                     something rather than FOR something, and at least one
 *                     was sealed by a party that no longer exists, so the seal
 *                     is unmaintained and nobody has checked it in centuries.
 *
 * THE COLD-WAR LOGIC, STATED PLAINLY
 * ----------------------------------
 * The real balance of power in this age is held by instruments nobody can
 * afford to spend. Everyone holding one is stronger than they look, and
 * weaker than they appear the moment they use it - because using it converts a
 * permanent deterrent into a single act and leaves them holding nothing.
 *
 * The reason none of them can be spent profitably on offence is
 * `THE_ASYMMETRY` below: the side that must convert loses and the side that
 * must merely obstruct wins, so an offensive waking is only ever worth it
 * against something unattended - and even then it can be answered by a
 * defensive waking that has to do nothing but be in the way.
 *
 * That, and not treaty or goodwill, is why the map is stable despite the
 * scarcity. It is also why the holders lie about what they have in both
 * directions, why nobody can price anybody, and why the one recorded case of a
 * sealed ancestor actually being spent is the precedent every current holder reasons
 * from - and what it taught them was not that it works.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// THE ASYMMETRY
// The general law. Stated once, here, so the rest of the catalog inherits it
// rather than re-deriving it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The side that must CONVERT loses. The side that must merely OBSTRUCT wins.
 *
 * A one-shot instrument is weak when it needs a decisive result inside a
 * window, and strong when it only needs to make somebody else's window
 * insufficient. Which side of that a sealed ancestor is on is decided by what it is
 * asked to do, not by what it is.
 *
 * This is a law of the world and not an observation about any particular
 * vault. Every consequence below follows from it, and no entry anywhere in
 * the catalog should re-argue it or contradict it.
 */
export const THE_ASYMMETRY = {
    law:
        'The side that must convert loses. The side that must merely obstruct wins. An instrument sent to achieve something has a window, burns its own seat in the waking, and must produce a decisive result before the window closes. A defender is not spending anything and does not have to win, prevail or achieve: they have to still be in the way when the attacker runs out of time.',
    theNumber:
        'About one in a hundred for an instrument that must convert against somebody present, and the one is the defender making a catastrophic error rather than the attacker performing well. It is a real one rather than a zero, which matters: somebody desperate enough will eventually take that bet, and being right that they were desperate is the only warning anybody gets.',
    consequences: [
        'A sealed ancestor is weak on offence against anything attended and devastating against anything unattended - so every held sealed ancestor aimed at a prize is aimed at an absence.',
        'A sealed ancestor woken DEFENSIVELY inherits the good side of the asymmetry. It does not have to beat the attacker or survive the encounter meaningfully; it has to still be in the way when the attacker\'s window closes, which is a far easier thing to be asked for and is why a weaker sealed ancestor reliably ruins a stronger one.',
        'Presence is the strongest defence in the setting. It costs the defender nothing per day and everything the moment they stand up, which is cheap to hold and ruinous to interrupt.',
        'Apexes are immobile, arbitration happens by letter, and anybody who turns up in person is making a statement about how safe they are.',
        'The map is stable because the deterrents cannot be spent profitably on offence, not because anybody agreed to anything. Every holder is stronger than they look and finished the moment they use what they hold.'
    ],
    theStall:
        'Which produces the move that makes offensive wakings nearly unthinkable. A raid by a woken ancestor can be answered by allied ancestors woken to obstruct - not to win, and everybody involved knows they cannot win. A subsidiary sealed ancestor who could never take the Mirror can absolutely make the objective unmanageable inside the time the Mirror has, and that is the whole of what is required. Note what the obstruction is actually doing: it is not outlasting her, it is showing her a sum that no longer works, and she is the one doing the sum. She will accept that conclusion coldly and early. So the raid does not fail because it was beaten - it fails because she looked at the remaining time, priced the objective again, and reallocated. See `WHEN_ONE_WAKES`.',
    howToApplyIt:
        'Where an entry implies this, it should read as the conclusion of the arithmetic rather than as a separate fact. An entry that has a sealed ancestor attacking a seated party is wrong. An entry that has a sealed ancestor woken to obstruct one is correct and is the strongest thing such a party can do.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/** How anybody knows a sealed ancestor is there at all. */
export const SealedAncestorAwarenessSchema = z.enum([
    'published',          // the holder says so on purpose, as a deterrent
    'rumoured',           // circulating, unverified, and mostly right
    'holder_only',        // the holder knows and nobody else does
    'unknown_to_holder',  // it is under somebody who does not know
    'forgotten'           // nobody living knows, and the record is gone
]);
export type SealedAncestorAwareness = z.infer<typeof SealedAncestorAwarenessSchema>;

/**
 * What state the sealed ancestor is actually in, as opposed to what the holder
 * believes. For the oldest of them these two fields disagree, and the holder
 * is the last party who would find out.
 */
export const SealedAncestorConditionSchema = z.enum(['live', 'degraded', 'dead']);
export type SealedAncestorCondition = z.infer<typeof SealedAncestorConditionSchema>;

export const HeldInstrumentSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    holderFactionId: z.string(),
    whoTheyWere: z.string().min(60),
    dormantYears: z.number().int().min(100),
    restingPlace: z.string().min(40),
    /** What the holder says publicly, where it says anything. */
    publishedCondition: z.string().min(60).nullable(),
    /**
     * What they are actually saving it against, which is never the published
     * condition and is frequently not written down anywhere.
     */
    privateContingency: z.string().min(200),
    /** Publication as deterrence, or silence as ambiguity. Not both. */
    strategy: z.enum(['deterrent_by_publication', 'silence']),
    strategyNote: z.string().min(150),
    wakeCost: z.string().min(120),
    awareness: SealedAncestorAwarenessSchema,
    /** The truth. */
    condition: SealedAncestorConditionSchema,
    /** What the holder believes the condition is. */
    holderBelieves: SealedAncestorConditionSchema,
    conditionNote: z.string().min(150)
});
export type HeldInstrument = z.infer<typeof HeldInstrumentSchema>;

export const UnownedAncestorSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    whereItIs: z.string().min(60),
    /** Sealed FOR a purpose, or sealed BY something that happened. */
    sealedBy: z.string().min(60),
    sealedFor: z.string().min(80).nullable(),
    /** Null where the sealing party no longer exists. */
    sealerFactionId: z.string().nullable(),
    sealMaintained: z.boolean(),
    lastChecked: z.string().min(60),
    awareness: SealedAncestorAwarenessSchema,
    whoKnows: z.string().min(100),
    /** Nobody owns this. That is the point of the category. */
    hazard: z.string().min(150),
    opportunity: z.string().min(120),
    nobodyIsResponsible: z.string().min(120)
});
export type UnownedAncestor = z.infer<typeof UnownedAncestorSchema>;

// ─────────────────────────────────────────────────────────────────────────
// WHEN ONE WAKES
// She is not a released monster. She is lucid, loyal and economical, she
// knows the size of her own window to the hour, and she spends it the way
// somebody spends the last of something.
// ─────────────────────────────────────────────────────────────────────────

export const WHEN_ONE_WAKES = {
    sheKnowsTheClock:
        'She wakes knowing how long she has, to the hour, without being told and without having to work it out. Everything she does afterwards is priced against that number, and anybody standing next to her is talking to somebody doing arithmetic continuously.',
    lucidNotFeral:
        'Fully herself, immediately. There is no confusion to exploit, no rage to redirect and no interval in which she is dangerous to her own side. What she is, is in a hurry - and being in a hurry makes her more careful rather than less.',
    economical:
        'She does nothing pointless. No massacre, no display, no burning a province on the way past - not out of gentleness, which does not enter into it, but because those things cost time and buy the sect nothing. Anybody expecting a rampage has misunderstood what was woken, and will be standing in the wrong place.',
    loyalToTheInstitution:
        'To the sect, and that is the frame for every decision she makes. Not to the person who woke her, not to the plan as it was written, and not to whoever is currently holding the seat: to the institution. So she will do the thing that serves it, and that is not automatically the thing she was woken for.',
    sheReassesses:
        'She makes her own assessment of the objective, on the way and again on arrival. If the sum has stopped working - the room is not empty, the window is shorter than the briefing said, somebody has arrived who should not be there - she can abort and reallocate the remainder. She would far rather spend the last of herself on something achievable than fail expensively at what she was asked for, and she has no stake in a sunk cost and no reason whatever to be brave.',
    theAvailableOutcome:
        'Which means a sect can wake one for a vault and have her come back having done something else entirely, correctly, and be unable to argue with the reasoning. That is a genuinely available outcome and should be treated as one rather than as a twist.',
    whyStallingWorks:
        'This is why a defensive waking works, and it is not "hold her off until she is spent". A sealed ancestor woken to obstruct does not have to survive her or beat her. It has to make the arithmetic visibly stop working - because she is the one doing the arithmetic, and she will accept the conclusion faster and more coldly than any living commander would. The defence succeeds by persuading, and the persuasion is arithmetic rather than words.',
    whatSheAsksFirst:
        'She has been out for two thousand years. The first minutes are hers: what the sect has become, what year it is, who is holding the seat, what happened to the people she left it to, and whether the parties in front of her are who they say they are. She knows exactly what those minutes cost and asks anyway, because going out on somebody else\'s summary of the world is how an instrument gets wasted. Somebody had better have prepared the briefing, and the quality of that briefing is the single largest thing the living can contribute.',
    whatSheThinksOfThem:
        'She is the first Sovereign and the people waking her are her successors at a distance she can measure in a glance. She may not be impressed. She has no time and no particular reason to be kind about it, and she will say what she thinks once, briefly, while deciding. Being judged by your own founder in the last hours of her existence, while asking her to go and rob somebody, is what a waking actually looks like from the inside.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// HELD INSTRUMENTS
// ─────────────────────────────────────────────────────────────────────────

export const HELD_INSTRUMENTS: readonly HeldInstrument[] = [
    {
        id: 'sealed-the-kindler',
        name: 'The Kindler',
        holderFactionId: 'sect-nine-abyss-flame-sect',
        whoTheyWere: 'The first Flame Sovereign, who took the caldera, signed the transformation contract in full, and went down into the vent rather than finish the terms above ground.',
        dormantYears: 1_200,
        restingPlace: 'The vent under the caldera floor, behind a seal the sect maintains and has never opened.',
        publishedCondition: null,
        privateContingency:
            'The contract coming due. The sect teaches that the transformation is a bargain with a knowable counterparty, its own recovered text names none, and the elders who have read the original are privately certain that something will eventually arrive to collect on nine centuries of terms. The Kindler is what they intend to set against that arrival. It is the only contingency they have ever discussed in a closed room, they have never written it down, and every Flame Sovereign is told about it on the day they are seated.',
        strategy: 'silence',
        strategyNote:
            'Nobody outside the caldera knows the Kindler is there, and the sect prefers it that way for a reason that is not modesty: a published sealed ancestor deters attacks, and the sect is not afraid of being attacked. It is afraid of a creditor, and a creditor cannot be deterred by a threat it has not been told about - which the elders know, and which means the silence is protecting the surprise rather than the sect.',
        wakeCost:
            'Whatever is left of the Kindler burns itself and the caldera together. The sect survives the waking as an institution and does not survive it as a place, and everybody in it has been told so.',
        awareness: 'holder_only',
        condition: 'live',
        holderBelieves: 'live',
        conditionNote:
            'Live, and the sect is right about it - the seal at the vent has been maintained continuously and the Kindler has been checked, in the only way anybody dares check such a thing, twice in the last four centuries. It is the healthiest sealed ancestor in the world and belongs to the institution least likely to be attacked, which is the sort of distribution the world keeps producing.'
    },
    {
        id: 'sealed-the-mirror',
        name: 'The Mirror',
        holderFactionId: 'sect-frostmirror-court',
        whoTheyWere: 'The first Sovereign, who dug the ice curriculum out of the glacier, taught it to nine people, and then lay down in the hall she had cleared.',
        dormantYears: 2_000,
        restingPlace: 'The cold hall itself, at the centre of the ice field, under a floor nobody sweeps.',
        publishedCondition: null,
        privateContingency:
            'An apex vault at the one moment nobody is sitting on it. The Court has worked out that the Deep Survey cannot leave its own seat, has told nobody in a hundred and ninety years, and keeps a permanent watcher at Low Fall against a trigger that has never once occurred. See `contingencies.ts` for the worked case: it is the clearest example in the world of what a private contingency actually looks like, and it is not what the Court has written down.',
        strategy: 'silence',
        strategyNote:
            'Silence, absolutely, and for the specific reason that the plan requires surprise and the observation underneath it is spent the moment a second party holds it. The Court fields a fraction of the defence its holdings warrant and has never lost the library, which reads externally as luck and is a deliberate refusal to advertise.',
        wakeCost:
            'She wakes cold and unhurried, and the hall does not survive it. The Court has written down that this is acceptable, which is the only part of the arrangement that is on paper.',
        awareness: 'holder_only',
        condition: 'live',
        holderBelieves: 'live',
        conditionNote:
            'Live. Two forced entries are recorded by outside parties and neither party is recorded as having left, which is the closest thing to a test any sealed ancestor in the catalog has had, and it is why the Court is confident where the Anchorhold is merely certain.'
    },
    {
        id: 'sealed-xu-ci',
        name: 'Xu Ci, the Second Standing Anchor',
        holderFactionId: 'house-anchorhold',
        whoTheyWere: 'The Anchor who drove the replacement eastern nail personally and then had herself entombed under the datum stone rather than retire, on the argument that a nail should stay where it is.',
        dormantYears: 700,
        restingPlace: 'Under the datum stone, in the chamber every measurement in the region is ultimately taken from.',
        publishedCondition: 'Two perimeters lost in a single season. One is a shortfall the house posts publicly; two is the condition, and it appears in the regional survey standard as a line item.',
        privateContingency:
            'The eastern nail specifically, and not perimeters in general. The published schedule is deliberately broader than the intention: the Wardens of the Survey have agreed among themselves that they would wake her for the eastern socket failing and would find a reason not to for anything else, because the eastern nail is the one the house broke to found itself and is the only failure it could not survive being blamed for. Nobody has written that down and every Warden of the Survey knows it.',
        strategy: 'deterrent_by_publication',
        strategyNote:
            'The only holder in the world that publishes. Putting the condition in the survey standard converts a sealed ancestor into a deterrent that works continuously and costs nothing, and the Anchorhold cannot pursue anybody, so a schedule is the only enforcement it has. It also means the house has bet everything on a claim anybody could test by taking two perimeters in one season, and nobody has.',
        wakeCost:
            'She rises, drives one nail, and does not come back up. The house has published that too, in detail, which is the part that makes the deterrent legible rather than boastful.',
        awareness: 'published',
        condition: 'dead',
        holderBelieves: 'live',
        conditionNote:
            'She is gone, and has been for something on the order of two centuries. Seven hundred years is a long time under a stone, the entombment was performed by a house that had never done one before and has never done another, and nothing about the chamber would tell anybody: it is sealed, it is quiet, and quiet is what it is supposed to be. So the Anchorhold has published a schedule it cannot execute, the entire strategic posture of a house that administers eleven perimeters rests on it, and the two perimeters currently maintained below standard are being watched by more people than the house employs. It is the most likely state for the oldest of these and it is the one nobody checks, because checking is indistinguishable from spending.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// UNOWNED SEALED ANCESTORS
// Nobody's to wake, nobody's to bargain with, nobody's to blame.
// ─────────────────────────────────────────────────────────────────────────

export const UNOWNED_ANCESTORS: readonly UnownedAncestor[] = [
    {
        id: 'sealed-meng-da',
        name: 'Patriarch Meng Da',
        whereItIs: 'Somewhere in the vein workings under the Nine Peaks, which have never been sealed and are entered by ascetics on ordinary business several times a year.',
        sealedBy: 'Nothing. He walked in eight hundred years ago to survey the workings and did not come out, and the Order has never closed the entrance.',
        sealedFor: null,
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Never. There is nothing to check, because the Order does not treat this as a thing that exists - it is a story ascetics tell each other and do not offer to outsiders.',
        awareness: 'unknown_to_holder',
        whoKnows:
            'The Order has surveyed the workings to the depth he is at and has never opened it or said why, which is as close to knowing as an institution gets without admitting anything. What it does not accept is the conclusion: the ascetics tell it as a story, and a story is not a thing an Order has to act on. The Peak Wardens want the workings surveyed and Meng Da resolved; the Mountain Elders hold that the workings are the vein and the vein is not to be entered, which is doctrine dressed as caution and is the only reason nobody has gone looking.',
        hazard:
            'The deepest vein in the province is being worked continuously by an institution that has an eight-hundred-year-old Patriarch somewhere underneath it and has decided the question is a matter of tradition. If he is down there and something reaches him - a collapse, a deep survey, a boundary dispute that goes to digging - it happens under the richest ground in the Low Fall, to a party nobody warned, with no wake condition, no cost accounting and nobody who could be said to have decided anything.',
        opportunity:
            'The only sealed ancestor in the world that is not behind a seal. Anybody willing to go into the workings could reach him, and reaching him is the single cheapest access to a high-realm being available anywhere - which is exactly why the Mountain Elders have made not entering into a principle.',
        nobodyIsResponsible:
            'The Order would deny he is there. If he came up, no institution would accept that it had been theirs to manage: the Order because it never sealed anything, the Sill because a vein grant is not a custodial obligation, and the Survey because its register has no entry for a person who is not dead and is not anywhere.'
    },
    {
        id: 'sealed-the-tally-seal',
        name: 'Whatever the Tally Court sealed at Sweptground',
        whereItIs: 'Under the burned seat at Sweptground, behind a seal that predates the Ninefold Ledger and was cut by the house the Ledger destroyed.',
        sealedBy: 'The Tally Court, twenty-three centuries ago, for a reason that was in the volumes the Ledger took and has never opened.',
        sealedFor: 'Unknown, and the distinction matters: nobody can say whether it was sealed to keep something in, to keep something preserved, or to keep something from being read. The three cases call for three completely different responses and there is no evidence that separates them.',
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Not in twenty-three centuries by anyone with standing to do it. The ground is where debts sworn do not settle and never have, which is treated locally as a curiosity of the site.',
        awareness: 'rumoured',
        whoKnows:
            'Sweptground Temple knows there is something under its ground and has never investigated, on the Abbot\'s stated reasoning that a thing sealed by people who are dead is not the Temple\'s business. The Ninefold Ledger almost certainly holds the answer in its nine sealed volumes, has never opened them, and has three internal factions arguing about it for reasons that have nothing to do with this.',
        hazard:
            'An unmaintained seal cut by a destroyed house, on ground that visibly does something to obligations sworn on it, under a temple that takes in anybody and has four monks. Nobody is maintaining it because the maintainers were dissolved twenty-three centuries ago, nobody has inspected it because inspecting it requires opening it, and the only party who could say what is behind it destroyed the party that put it there and then sealed the records.',
        opportunity:
            'The Ledger volumes and the seal are the same question from two ends. A player who opened either would be the first person in two millennia to know what the Tally Court was actually doing when it was ended, which is worth more than anything physical that might be behind the stone.',
        nobodyIsResponsible:
            'The Temple did not seal it, the Ledger did not seal it, and the party that did no longer exists. If it opens, the arbitration would be about who has to deal with it rather than who caused it, and the Ledger would be arbitrating a case in which it is the interested party.'
    },
    {
        id: 'sealed-the-sorting-yard',
        name: 'The sealed part of the sorting-yard ruin',
        whereItIs: 'Behind the front three chambers of the ruin the Gleaners\' Company works out of at Hollowmarket, in the Quiet Marches.',
        sealedBy: 'The catastrophe, most likely, rather than by anybody - the driving of the qi into the stone closed a great deal that nobody chose to close, and this is one of the places that shut.',
        sealedFor: null,
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Thirty years ago, by Deep Gleaner Xun, who went in on a wager and did not come back. The Company sealed it again and raised the wager, which is the whole of the region\'s risk assessment.',
        awareness: 'rumoured',
        whoKnows:
            'Every Gleaner, as a working fact rather than a secret: the Company lays out its sorting yard inside a building it has never fully entered, works three nodes at the front of it, and leaves the rest closed on the reasonable grounds that it was closed for a reason. Nobody outside the Marches has ever been told, because nobody outside the Marches asks the Gleaners anything.',
        hazard:
            'A crew of nine to fifteen people sorts salvage every working day against a wall that has taken one person in living memory. The Company has no idea what is behind it, has never seen the inscription its own vocabulary above Keystone was copied from, and the highest-ranking authority in the province is a bureau with eleven staff and no procedure for this.',
        opportunity:
            'The Marches vocabulary for the upper realms came off an inscription in there, which means somebody in that ruin knew what those states are - and the Long Cut, which administers the province and would very much like a working account of the upper realms, has never been told the sealed part exists.',
        nobodyIsResponsible:
            'The Company holds a salvage contract rather than a lease, and a contractor is not protected, arbitrated for, or spoken for. If it opened, the Weir Office would receipt the notification and the Ninth Face would answer it at the next revision, up to twenty years later.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE CLASS AS A WHOLE
// ─────────────────────────────────────────────────────────────────────────

export const SEALED_ANCESTOR_PATTERN = {
    theLaw:
        'See THE_ASYMMETRY above. The side that must convert loses and the side that must obstruct wins, so an offensive waking is pointed at an absence and a defensive one only has to be in the way. Everything below is that law with names attached.',
    coldWarLogic:
        'The balance of power in this age is held by instruments nobody can afford to spend. Every holder is stronger than they look, because an unspent sealed ancestor is a permanent deterrent that costs nothing to hold - and weaker than they appear the moment they use it, because using it converts that permanence into one act and leaves them holding nothing. That is why the map is stable despite the scarcity: not treaties, and not restraint. Unspendable deterrents, held by parties who all understand the arithmetic and none of whom can go first.',
    whyHoldersLieBothWays:
        'A holder with a live sealed ancestor may publish it, to deter, or conceal it, to preserve surprise. A holder with a dead one has every reason to keep publishing. So a claim is not evidence and an absence of claim is not evidence, and no institution in the world can price another one on this axis - which is a large part of why the powers are so careful with each other.',
    howAnybodyKnows: [
        'published: the Anchorhold puts its wake condition in the regional survey standard as a line item, because a deterrent that nobody has read does not deter.',
        'rumoured: the sorting-yard ruin and the Sweptground seal, known as working facts to the people standing next to them and to almost nobody else.',
        'holder only: the Kindler and the Mirror, both concealed deliberately and for opposite reasons - one to surprise a creditor, one to preserve a plan.',
        'unknown to the holder: Meng Da, under an institution that treats the question as folklore.',
        'forgotten: the category the world keeps producing and nobody can enumerate, since a seal whose record is gone is indistinguishable from a wall.'
    ],
    whatWakingLooksLikeFromOutside: [
        'The qi goes wrong first, over a region rather than a site: ambient readings that swing in a day, and cultivators reporting circulation that will not settle for reasons no physician can find.',
        'Formations fail in a pattern that runs outward from one place, and the failures are not damage - nodes simply stop resolving, in order, over hours.',
        'Animals leave. Spirit beasts move before anything else does, in numbers, in one direction, and nobody local misreads it because everybody local has heard what it means.',
        'The ground reports it. A sound below hearing that people describe as pressure rather than noise, and standing water going still in a way it does not otherwise do.',
        'Then the weather, which is the point at which it is too late to be anywhere near it: a season arriving in an afternoon over a province, at the wrong time of year, with no front behind it.'
    ],
    theOneCaseWhereItWasSpent: {
        yearsAgo: 1_100,
        who: 'A sect the Ledger records as the Verge Hall, which held a vein at the head of a valley two provinces east and does not exist now.',
        why: 'Its vein was taken by a larger neighbour in a lease dispute that the Hall lost on paper, correctly and unappealably, and it woke what it had under its mountain rather than accept the ruling.',
        whatItBought:
            'Everything it asked for, in one night. The neighbour ceased to exist as an institution - not defeated, ended - the lease was void because there was no counterparty, and the Verge Hall held its vein and the neighbour\'s with nobody in the province willing to raise the subject.',
        whatItCost:
            'The sealed ancestor, the mountain, and forty years later the Hall itself. Having spent the only thing that made anybody careful around it, it was an ordinary sect with two veins and a reputation for having no reserve left - and a third party that had watched the whole thing absorbed it inside two generations, without a fight, mostly by hiring its people.',
        theLessonEverybodyTook:
            'Not that it fails, because it did not fail: it worked completely. The lesson every current holder reasons from is that it works and then you are food. That is why the Anchorhold publishes rather than uses, why the Frostmirror Court will only spend the Mirror on something that leaves it the wealthiest institution in the world afterwards, and why the Nine Abyss Flame Sect is saving the Kindler for a creditor rather than for a rival.'
    },
    theOneThatWillNotWake:
        'At least one of them is already gone, and the holder is the last party who would find out. Xu Ci has been dead for perhaps two centuries under the Anchorhold datum stone, the house has published a schedule it cannot execute, and its entire strategic posture rests on it. This is the most likely state for the oldest of these, and nobody checks, because checking a sealed ancestor is indistinguishable from spending one.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const HELD_BY_ID: ReadonlyMap<string, HeldInstrument> = new Map(HELD_INSTRUMENTS.map(h => [h.id, h]));
const UNOWNED_BY_ID: ReadonlyMap<string, UnownedAncestor> = new Map(UNOWNED_ANCESTORS.map(u => [u.id, u]));

export function getHeldInstrument(id: string): HeldInstrument | undefined {
    return HELD_BY_ID.get(id);
}

export function getUnownedAncestor(id: string): UnownedAncestor | undefined {
    return UNOWNED_BY_ID.get(id);
}

/** What a faction is holding, which is at most one thing. */
export function instrumentHeldBy(factionId: string): HeldInstrument | undefined {
    return HELD_INSTRUMENTS.find(h => h.holderFactionId === factionId);
}

/**
 * Instruments whose holder is wrong about what they have. The engine should
 * never surface this to the holder, and the holder should keep acting on the
 * belief.
 */
export function bluffs(): HeldInstrument[] {
    return HELD_INSTRUMENTS.filter(h => h.condition !== h.holderBelieves);
}

/** Sealed ancestors nobody is maintaining, which is all of the unowned ones. */
export function unmaintainedSeals(): UnownedAncestor[] {
    return UNOWNED_ANCESTORS.filter(u => !u.sealMaintained);
}
