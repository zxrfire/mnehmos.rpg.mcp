/**
 * What goes wrong with a place, why, and what makes it stop.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { HistoricalEventKind } from './history.js';
import type { LocationRecord } from './locations.js';
import { STOPS_PASSAGE, type StatusCause } from './what-is-true-of-a-place-right-now.js';
import {
    REGROWTH_YEARS_BY_GRADE,
    standingStock,
    theOrdinaryAnimalsAreGone
} from './what-a-place-still-has-in-the-ground.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE WORLD PROPOSES
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing the world says is true of a place today.
 */
export interface StatusCandidate {
    areaId: string;
    kind: string;
    /**
     * The ledger's row for the cause. Data, copied onto the fact and never
     * read - the same arrangement `SendingReason.factKind` makes, so that a
     * new opener picks the closest existing kind and nothing acquires a
     * branch on which opener it came from.
     */
    factKind: HistoricalEventKind;
    statement: string;
    cause: StatusCause;
    /**
     * What anybody standing here observes, understanding nothing.
     */
    signs: readonly string[];
    causeKnownLocally: boolean;
    stops: readonly string[];
    priceMultiplier: number;
    dangerDelta: number;
    reviewInDays: number;
    /**
     * The longest this may go on, however true its cause stays.
     */
    mayRunForDays: number;
    /**
     * How long after this ends before the world may say it again.
     */
    quietForDaysAfter: number;
}

/** One status of a kind per area, and this is the identity that says so. */
export function statusKey(areaId: string, kind: string): string {
    return `${kind}@${areaId}`;
}

/** What a house that holds ground stops when it stops it. */
export const STOPS_GATHERING = 'gathering';

/** What a failed harvest stops, which is the whole of the mundane tier. */
export const STOPS_FOOD = 'food';

/**
 * How much a place holds, as far as this file is concerned.
 */
export interface GroundAsItStands {
    place: LocationRecord;
    /** Living people standing on this exact row. Nobody means nobody works it. */
    peopleHere: number;
    /** The house that holds it, or null. Never derived here. */
    holder: { id: string; name: string } | null;
    /** True where the holder is fighting somebody right now. */
    holderIsAtWar: boolean;
    /** Who the holder is fighting, for the statement. Empty when nobody. */
    holderFightingNames: readonly string[];
    /**
     * Whether this is the ground the holder actually sits on.
     */
    isTheHoldersSeat: boolean;
}

// THE OPENERS

/**
 * A house shuts a district it has finished.
 */
export function districtsTheirHolderHasShut(
    ground: readonly GroundAsItStands[],
    onDay: number
): StatusCandidate[] {
    const out: StatusCandidate[] = [];
    for (const { place, holder } of ground) {
        if (!holder) continue;
        const herbs = standingStock(place, 'herb', 'mortal', onDay);
        const game = standingStock(place, 'beast_material', 'mortal', onDay);
        if (herbs.capacity <= 0 || game.capacity <= 0) continue;
        if (herbs.reading !== 'worked_out' || game.reading !== 'worked_out') continue;
        out.push({
            areaId: place.id,
            kind: 'closed_to_gathering',
            factKind: 'resource_contested',
            statement:
                `${holder.name} has closed the ground around ${place.name}. Nobody gathers here `
                + 'and nobody hunts here, and the people who did are being turned back at the '
                + 'edge of it.',
            cause: {
                what:
                    `${place.name} was worked out - the beds and the game both - and ${holder.name} `
                    + 'shut it rather than watch the last of it go.',
                decidedById: holder.id,
                factId: null
            },
            signs: [
                'There are people on the paths who are not from here, and they are turning '
                + 'other people around.',
                'The stalls that used to buy raw material are buying it from further away, '
                + 'and paying for the distance.'
            ],
            // A house that closes ground says so out loud. That is the point of
            // closing it, and it is why this is the one opener whose cause is
            // known locally without anybody having to survey anything.
            causeKnownLocally: true,
            stops: [STOPS_GATHERING],
            // Everything that came off this ground now comes from further out.
            priceMultiplier: 1.5,
            dangerDelta: 0,
            // Looked at again when the band it was shut over could plausibly
            // have come back. Not a promise: the review asks the ground.
            reviewInDays: Math.round(REGROWTH_YEARS_BY_GRADE.mortal * DAYS_PER_YEAR),
            // A house that shuts ground for two generations has not shut it,
            // it has given it up, and giving it up is a different record.
            mayRunForDays: Math.round(40 * DAYS_PER_YEAR),
            quietForDaysAfter: Math.round(10 * DAYS_PER_YEAR)
        });
    }
    return out;
}

/**
 * The ordinary animals are gone, so what is left is what was eating them.
 */
export function tidesWhereTheGameWent(
    ground: readonly GroundAsItStands[],
    onDay: number
): StatusCandidate[] {
    const out: StatusCandidate[] = [];
    for (const { place, peopleHere } of ground) {
        // Nobody standing on it means nobody hunted it out, and a status on
        // ground nobody has ever walked is a status about nothing.
        if (peopleHere <= 0) continue;
        if (!theOrdinaryAnimalsAreGone(place, onDay)) continue;
        out.push({
            areaId: place.id,
            kind: 'beast_tide',
            factKind: 'catastrophe',
            statement:
                `Something is running at ${place.name}. What is out there now is not what used `
                + 'to be out there, and it is moving in.',
            cause: {
                what:
                    `The bottom of the ground around ${place.name} was taken out of it. What was `
                    + 'eating that is still here and is still eating, and it has come down to '
                    + 'where the people are.',
                decidedById: null,
                factId: null
            },
            signs: [
                'The ordinary animals went first and went far, which is the tell every gatherer '
                + 'knows and no house records.',
                'Herds that do not share ground have been seen sharing it, moving one way, '
                + 'unbothered by people.',
                'Two culling contracts in adjacent districts were filled in a week and then '
                + 'could not be filled at all.'
            ],
            causeKnownLocally: false,
            stops: [],
            priceMultiplier: 1.2,
            dangerDelta: 0.35,
            reviewInDays: Math.round(REGROWTH_YEARS_BY_GRADE.mortal * DAYS_PER_YEAR),
            // A tide is a season, not a climate. Ground that stays empty gets
            // another one in a generation, which is what the catalog's own
            // aftermath says happens - *the same tide is expected again and no
            // date is offered.*
            mayRunForDays: Math.round(3 * DAYS_PER_YEAR),
            quietForDaysAfter: Math.round(20 * DAYS_PER_YEAR)
        });
    }
    return out;
}

/**
 * Ground held by somebody who is fighting.
 */
export function groundUnderAWar(ground: readonly GroundAsItStands[]): StatusCandidate[] {
    const out: StatusCandidate[] = [];
    for (const { place, holder, holderIsAtWar, holderFightingNames, isTheHoldersSeat } of ground) {
        if (!holder || !holderIsAtWar || !isTheHoldersSeat) continue;
        const against = holderFightingNames.length > 0
            ? holderFightingNames.join(' and ')
            : 'somebody they will not name';
        out.push({
            areaId: place.id,
            kind: 'war',
            factKind: 'war',
            statement:
                `${holder.name} is fighting ${against}, and ${place.name} is ground they hold. `
                + 'Nothing goes through it that is not theirs.',
            cause: {
                what: `${holder.name} and ${against} are openly fighting.`,
                decidedById: holder.id,
                factId: null
            },
            signs: [
                'The caravans have stopped and the road east is not being used.',
                'There are more people sleeping outside the walls than there were.',
                'Everybody who can fight has been recalled, and everybody who can heal is being '
                + 'paid too much.'
            ],
            causeKnownLocally: true,
            stops: [STOPS_PASSAGE],
            priceMultiplier: 2,
            dangerDelta: 0.5,
            // A year. A war does not have an expected end and gets a review
            // date like everything else - open-ended is deliberately not
            // representable, because it is the shape the never-lifting bug
            // arrives in.
            reviewInDays: DAYS_PER_YEAR,
            // Longer than any war the schedule opens, which runs two to
            // twenty-five years. The cap is the backstop for a war nothing
            // ever settled, not a term anybody is fighting to.
            mayRunForDays: Math.round(60 * DAYS_PER_YEAR),
            quietForDaysAfter: DAYS_PER_YEAR
        });
    }
    return out;
}

/**
 * How often a province's harvest fails outright.
 */
export const A_HARVEST_FAILS = 0.04;

/**
 * A harvest that failed, on a province.
 */
export function harvestsThatFailed(
    regions: readonly LocationRecord[],
    rng: CultivationRNG
): StatusCandidate[] {
    const out: StatusCandidate[] = [];
    for (const region of regions) {
        if (!rng.chance(A_HARVEST_FAILS)) continue;
        out.push({
            areaId: region.id,
            kind: 'famine',
            factKind: 'catastrophe',
            statement:
                `The harvest failed across ${region.name}. There is food, and it is not for sale `
                + 'at any price a person who works for a living can meet.',
            cause: {
                what:
                    `The grain in ${region.name} did not come in. Nobody arranged it and nobody `
                    + 'can be asked about it.',
                decidedById: null,
                factId: null
            },
            signs: [
                'The stalls that sell cooked food have shut, and the ones that have not are '
                + 'selling something else.',
                'There are more people on the road than there is reason for, all going one way.',
                'The granaries are being guarded by people who did not use to guard them.'
            ],
            // Everybody local knows the harvest failed. Standing in a famine is
            // not a mystery; what is going to be done about it is.
            causeKnownLocally: true,
            stops: [STOPS_FOOD],
            priceMultiplier: 4,
            dangerDelta: 0.2,
            // Answered by the next harvest, which is the only thing that ever
            // answers one.
            reviewInDays: DAYS_PER_YEAR,
            mayRunForDays: Math.round(3 * DAYS_PER_YEAR),
            quietForDaysAfter: Math.round(5 * DAYS_PER_YEAR)
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// ALL OF THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything the world says is wrong today, keyed so the caller can compare it
 * against what is already running.
 */
export function whatIsWrongWithPlacesToday(input: {
    ground: readonly GroundAsItStands[];
    regions: readonly LocationRecord[];
    onDay: number;
    rng: CultivationRNG;
}): Map<string, StatusCandidate> {
    const proposed = new Map<string, StatusCandidate>();
    const all = [
        ...districtsTheirHolderHasShut(input.ground, input.onDay),
        ...tidesWhereTheGameWent(input.ground, input.onDay),
        ...groundUnderAWar(input.ground),
        ...harvestsThatFailed(input.regions, input.rng)
    ];
    for (const candidate of all) {
        const key = statusKey(candidate.areaId, candidate.kind);
        if (!proposed.has(key)) proposed.set(key, candidate);
    }
    return proposed;
}
