/**
 * What a disaster can end, and who pays for it.
 *
 * This continues the sealed-ancestor material in `sects.ts` rather than
 * standing on its own. That file establishes what a house keeps asleep against
 * its worst day, what waking one costs, and the band a seal can hold. This one
 * is the other pole of the same economy: what the top of the world does about
 * the fact that those things exist, which turns out to be the reason every apex
 * head in the region is pinned in place.
 *
 * THE PINNING IS NOT A CHOICE OF LIFESTYLE
 * `APEX_INSTITUTIONS` records one person at the last realm per house, and every
 * one of them is `pinned`. The Deep Survey's sits under the datum vault "on top
 * of what the founder sent down". The Long Cut's is the one who could settle
 * anything permanently and is sitting on it instead. The Azure Cloud's is Ru
 * Anwei, in the inner hall, three hundred and eighty years at the first rung of
 * the last realm and no further.
 *
 * They are pinned because the artifact is, and the artifact is what makes them
 * unassailable. Separate the two and both halves are ordinary: an immortal
 * object with nobody at the last realm standing over it is the most stealable
 * thing in the world, and somebody at the last realm without it is a very
 * strong person who can be found, reached and lied to. Together they are an
 * apex. So the head does not travel, does not answer summons, and does not
 * appear at anything - not out of arrogance, but because the arrangement only
 * works while both of them are in the same room.
 *
 * WHICH IS ALSO THE WHOLE DEFENCE, AND IT IS NOT PERFECT
 * Nobody is invincible, and the setting must never be written as though
 * anybody were. A catastrophe cannot reach them, which is a real protection and
 * a narrow one. Two peers of their own realm can. Woken ancestors can - six
 * houses in the region hold one, and the strongest of those outranks the
 * strongest apex head alive. What stops all of it is the object, the difficulty
 * of assembling anybody against it, and the fact that nobody has yet gone
 * first. Difficulty is not safety, and an apex that mistook one for the other
 * would be the last one to find out.
 */

import { COURTS } from './hierarchy.js';
import { SECTS } from './sects.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A DISASTER CAN END
// ─────────────────────────────────────────────────────────────────────────

/** How completely a body can be ended by something nobody aimed. */
export type CatastropheOutcome =
    /** Gone. The name survives only in somebody else's records. */
    | 'destroyed'
    /** The institution stops functioning; the people and the claim persist. */
    | 'broken'
    /** Holdings, halls and roster lost; the person at the top is not. */
    | 'reduced_to_its_head';

export interface CatastropheExposure {
    tier: 'sect' | 'court' | 'apex';
    worstCase: CatastropheOutcome;
    /** Why the tier survives what it survives, in one factual line. */
    reason: string;
}

/**
 * The ordinal above which nothing unaimed is dangerous.
 *
 * Not a rule about disasters; a rule about people. A cultivator at Grand
 * Ascension reads and handles the Lid itself, and a landslide is several
 * categories below the thing they spend their attention on. The figure is the
 * floor of Grand Ascension because that is where the realm ladder says a body
 * stops having a seam for the world to get into.
 */
export const UNTOUCHED_BY_DISASTER_ORDINAL = 37;

export const CATASTROPHE_EXPOSURE: readonly CatastropheExposure[] = [
    {
        tier: 'sect',
        worstCase: 'destroyed',
        reason:
            'A sect is its ground, its hall and forty to two hundred people, most of them under Core Formation. A bad enough season takes all three at once and leaves a name in a neighbour\'s tally book. This is the ordinary outcome and the region has done it before.'
    },
    {
        tier: 'court',
        worstCase: 'destroyed',
        reason:
            'A court is an administration sitting on one specific arterial, and the arterial is the thing that moves. Its power ordinal is high enough that its seniors walk out, and that does not save the institution: a court with no vein to administer is a set of titles about a place that is not there any more. It can be wiped out, and the apex above it will simply appoint over the gap.'
    },
    {
        tier: 'apex',
        worstCase: 'reduced_to_its_head',
        reason:
            'Everything an apex owns can be taken by a catastrophe except the one thing that matters. Nothing unaimed reaches somebody past Grand Ascension, so the person at the top walks out of it - and an apex reduced to one person at forty-one and above is not destroyed, it is inconvenienced for a century. They rebuild, because a house at that rung is a person and a reputation before it is a set of buildings.'
    }
];

export function exposureOf(tier: CatastropheExposure['tier']): CatastropheExposure {
    return CATASTROPHE_EXPOSURE.find(e => e.tier === tier)!;
}

/** Whether an unaimed catastrophe could kill somebody standing at this rung. */
export function couldDieToADisaster(ordinal: number): boolean {
    return ordinal < UNTOUCHED_BY_DISASTER_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// WAR, OR AID
// A neighbour's catastrophe is an opening and a bill at the same time, and
// which one it is depends on arrangements that already existed.
// ─────────────────────────────────────────────────────────────────────────

export type DisasterResponse = 'war' | 'aid' | 'watch';

export interface ResponsePosture {
    response: DisasterResponse;
    /** The circumstance that produces it. */
    when: string;
    /** What it costs the responder, because none of the three is free. */
    cost: string;
}

export const DISASTER_RESPONSES: readonly ResponsePosture[] = [
    {
        response: 'aid',
        when:
            'When the two are under the same apex, or bound by a grant with a term still running, or when the stricken house holds something the neighbour needs to keep existing. Aid is not sentiment: a court that lets a client sect die has to explain the gap in its own returns, and an apex that lets a court fall has told every other court what its patronage is worth.',
        cost:
            'Stones, people and the admission that you had them spare. A house that turns up with three hundred cultivators has told the region it could field three hundred cultivators, which is a thing several parties will now recalculate around.'
    },
    {
        response: 'war',
        when:
            'When the stricken house holds ground, a vein or an inheritance the neighbour has wanted and could not previously take, and when the arrangement above them is loose enough that nobody is obliged to intervene. The unbacked and the outside are the most exposed here, because there is no patron whose face is at stake.',
        cost:
            'Everything the survivors will remember, and the certainty that the same reasoning applies to you the next time a season goes badly. Houses that move on a disaster are catalogued as having done it, and the catalogue outlives the advantage.'
    },
    {
        response: 'watch',
        when:
            'The commonest answer, and it is a decision rather than an absence of one. A house with no claim on the ground and no obligation to the fallen sends a delegation, records what it sees, and files it - which is exactly how the apexes learn what everybody else is capable of in a bad year.',
        cost:
            'Nothing immediately, and standing with anybody who expected better. A house that watched is remembered for having watched by the people it watched.'
    }
];

/**
 * And what all of it does to the people underneath, which the arithmetic never
 * mentions and most characters would live.
 *
 * A sect at the bottom of this does not experience a succession crisis. It
 * experiences its patron ceasing to answer letters.
 */
export const WHAT_FALLS_ON_THOSE_BELOW = {
    theGrantsGoQuiet:
        'The first thing that happens to a client sect is administrative and worse than it sounds. Grants stop being honoured because nobody is certain who honours them. A vein allocation issued by a court that is now claiming to be an apex is worth what the next season decides it is worth, and a sect that budgeted a decade against that paper finds out the hard way. Houses do not fall because somebody attacked them. They fall because the letter stopped meaning anything and the pill supply was three months out.',
    andTheProtectionGoesWithIt:
        'The other half of a patron is deterrence, and it evaporates in an afternoon. A sect that has been safe for two centuries because of whose name stood above it is now a sect with ground, stores and no name above it, in a region where every neighbour has just learned that the arrangement everybody was afraid of can end. This is where the postures in `DISASTER_RESPONSES` stop being abstract: the ones who move first are the neighbours who already knew what they wanted.',
    andTheDisciplesPayForIt:
        'Which lands hardest on the people with the least. Disciples are the ones whose entire path was an arrangement - a resource allocation, a teacher\'s attention, a promised technique at the next rank, ten or thirty years already spent against a return that was going to arrive. When the house above them contracts, they are the first line cut, because they are the cheapest thing to stop paying for and the least able to argue. A generation gets told to be patient, then gets told nothing, then finds the hall closed.',
    andTheOnesWhoLeave:
        'So they scatter, and the scattering is the shape the world remembers the event by. Some go home, which for most means a life at a rung they were told they had already passed. Some walk to the next sect and learn that a disciple of a dead house is a person with a partial curriculum and no standing, taken in a grade below where they stood. Some do not stop walking, which is where rogue cultivators come from in numbers - not romance, but a cohort of Foundation and Core disciples with real training, no institution and nothing left to lose, in a decade when everybody is short of people. One house emptying is a labour supply, a bandit problem and a recruiting opportunity, and the region gets all three.',
    andTheSeniorsAreFine:
        'The asymmetry is the point and should be stated plainly, because it is what an ordinary player is standing in. The elders walk out. Anybody above Grand Ascension was never in danger from any of it and simply relocates, with their techniques, their standing and their name intact. The disciples are the ones who lose a life. When the top of the world moves, the top of the world survives it, and the bill goes down.'
} as const;

/** Every body a catastrophe could remove from the world outright. */
export function factionsADisasterCouldDestroy(): { id: string; name: string; tier: string }[] {
    return [
        ...COURTS.map(c => ({ id: c.id, name: c.name, tier: 'court' })),
        ...SECTS.map(s => ({ id: s.id, name: s.name, tier: 'sect' }))
    ];
}
