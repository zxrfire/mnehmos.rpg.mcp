/**
 * What goes wrong with a place, why, and what makes it stop.
 *
 * `what-is-true-of-a-place-right-now.ts` is the layer: the record, the clock,
 * the join and what a status DOES. It has always been complete and it has never
 * had a writer. Measured before this file existed: a thousand world-years,
 * **zero rows**, with `whatIsGoingOnHere` wired into the played `investigate`
 * verb over a permanently empty column - which is the shape AGENTS.md calls the
 * worse defect, because an empty column is not inert. It reads as a value, and
 * every reader goes on answering with total confidence that nothing is wrong
 * anywhere.
 *
 * This file is the other half. It says what the world proposes about a place
 * today; `applyAreaStatuses` in `the-world-changing-on-its-own.ts` is its one
 * caller and does the writing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY STATUS HAS A CAUSE, AND THE CAUSE IS SOMETHING ELSE THAT HAPPENED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `BEAST_TIDES` in `beasts.ts` is emphatic that a tide is a SYMPTOM of
 * something that changed on the ground, and that the houses which treat one as
 * a monster problem rather than a survey problem are the ones it happens to
 * twice. A status invented out of a weighted table would undo that, so every
 * opener below binds to state something else already wrote:
 *
 *   closed to gathering  a district its holder has worked out. The count is
 *                        `what-a-place-still-has-in-the-ground.ts`'s, and this
 *                        is the DECISION taken in consequence - which is
 *                        exactly the seam that file draws, because a decision
 *                        is not recoverable from a number and a status that
 *                        restated the number would be a second authority on it.
 *   a beast tide         the ordinary animals are gone from this ground, which
 *                        is `theOrdinaryAnimalsAreGone` and is the tell every
 *                        gatherer knows. What is left out there is what was
 *                        eating them, and it is still eating.
 *   a war               two houses that are actually fighting, on ground one of
 *                        them actually holds. `decidedById` carries whose war.
 *   a famine            a harvest that failed. The one drawn opener, on its own
 *                        seeded stream, and the only one with nobody to blame.
 *
 * ── The two kinds of cause, without a branch ─────────────────────────────
 *
 * `StatusCause.decidedById` is a value and nothing in the status layer reads
 * it. A war has one, a famine does not, and that is the whole difference
 * between them in the record.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT LIFTS ONE IS THE SAME QUESTION THAT OPENED IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A famine that never lifts is a worse bug than no famine, and a review pass
 * that branches on `kind` would make the free-form `kind` field a lie - the
 * eleventh kind is supposed to cost a row and no branch.
 *
 * So there is no reviewer here. `whatIsWrongWithPlacesToday` answers what the
 * world would propose RIGHT NOW, and the caller compares that against what is
 * already running: a status still proposed is extended, a status no longer
 * proposed is lifted. One rule, no table, and a kind added tomorrow reviews
 * itself for free.
 *
 * That gives each opener the right ending without anybody writing one. A
 * district closes while its holder has nothing to gather and opens when the
 * ground comes back. A tide runs while the ground is empty. A war ends when the
 * fighting does. A famine is proposed on the year it is drawn and not on the
 * next one, so it lifts - unless the draw comes up again, which is a second bad
 * year and reads correctly as one.
 *
 * ── One status of a kind per area ────────────────────────────────────────
 *
 * Two famines in one province is one famine. Candidates are keyed on
 * {@link statusKey}, and the caller matches running rows on the same key.
 *
 * ── The draw ─────────────────────────────────────────────────────────────
 *
 * Exactly one opener takes a stream and it is the caller's, keyed off a name no
 * other pass uses. Nothing else here is stochastic, so a world with no failed
 * harvest draws precisely what it drew before this file existed.
 *
 * Pure. State in, candidates out, no mutation and no I/O.
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
 *
 * Everything `makeAreaStatus` needs except the id and the dates, which belong
 * to whoever is writing rather than to whoever noticed. `reviewInDays` is how
 * long before the world looks again, and it is a property of the cause: a
 * failed harvest is answered by the next harvest, and a district that has been
 * stripped is answered by the regrowth clock of the band that was stripped.
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
    signs: readonly string[];
    causeKnownLocally: boolean;
    stops: readonly string[];
    priceMultiplier: number;
    dangerDelta: number;
    reviewInDays: number;
    /**
     * The longest this may go on, however true its cause stays.
     *
     * THE LAYER'S OWN CONTRACT, ENFORCED RATHER THAN HOPED FOR. A status is
     * what is true of a place FOR A WHILE; what a place permanently BECAME is
     * `LocationChange` and belongs in another table. Without this the review
     * below happily extends a status for as long as its cause holds, and a
     * cause that does not go away produces one that does not either -
     * measured, a beast tide that had been running for 182,135 days, which is
     * a `LocationChange` wearing a status as a costume.
     *
     * Per candidate rather than per kind, so it is data like everything else
     * here and the review stays one rule.
     */
    mayRunForDays: number;
    /**
     * How long after this ends before the world may say it again.
     *
     * The other half of the cap, and it is what stops a capped status from
     * simply reopening the following year and running forever in instalments.
     * A tide on ground that stays empty is a thing that happens to that ground
     * about once a generation, not a thing that is permanently happening.
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
 *
 * Declared structurally rather than as `WorldState` so the openers can be
 * driven from a test without a seeded world, and so nothing here reaches for
 * anything the caller did not hand over.
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
     *
     * A war is a status on the seat and not on every holding in the ledger.
     * Without this a house with forty veins put forty rows in the table for one
     * war, and the layer's own claim - a handful per world, not a row per
     * object - stops being true the first time anybody fights.
     */
    isTheHoldersSeat: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// THE OPENERS
//
// Each reads state something else wrote and proposes zero or more candidates.
// None of them writes, none of them decides a date, and adding a fifth costs a
// function and no edit anywhere else.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A house shuts a district it has finished.
 *
 * The consequence `what-a-place-still-has-in-the-ground.ts` names and refuses
 * to model itself: the COUNT is theirs, and what somebody decided in
 * consequence is not recoverable from it. A house that has worked its own
 * ground out stops other people working it, because what is left is what it
 * will be gathering next decade.
 *
 * Both bands have to be gone. A district with game left in it is a district
 * with a reason to let people onto it, and closing it over the herbs alone
 * would make this fire on nearly every holding in the world.
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
                'there are people on the paths who are not from here, and they are turning '
                + 'other people around',
                'the stalls that used to buy raw material are buying it from further away, '
                + 'and paying for the distance'
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
 *
 * `theOrdinaryAnimalsAreGone` has said this since it was written and closed
 * with an admission that the sentence was ahead of the mechanic. This is the
 * mechanic: the ground carries a status, the status carries the danger, and
 * anybody standing here is in it whether or not they have heard the word.
 *
 * The signs are the tell the catalog already records for a tide - the ordinary
 * animals went first and went far - and the cause is deliberately NOT known
 * locally. That is the survey problem stated as a ceiling: asking around gets
 * you the signs, and somebody who wants the reason has to go and read the
 * ground themselves.
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
                'the ordinary animals went first and went far, which is the tell every gatherer '
                + 'knows and no house records',
                'herds that do not share ground have been seen sharing it, moving one way, '
                + 'unbothered by people',
                'two culling contracts in adjacent districts were filled in a week and then '
                + 'could not be filled at all'
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
 *
 * The road is the first thing a war takes. `war_opened` already says so in the
 * fact it writes - *the trade road is unusable, the caravans have stopped* -
 * and until now that sentence was narration over a world in which passage was
 * never once stopped anywhere.
 *
 * ONE ROW PER FIGHTING HOUSE, ON ITS SEAT. Not one per holding: a house with
 * forty veins is in one war, and forty rows saying so would make the layer's
 * own claim about its size false. Measured before the seat filter went in: 440
 * live war statuses at year five hundred against 10 tides and 8 closures.
 *
 * It lifts on its own, because the proposal is the review: when the houses stop
 * being at war they stop being proposed, and the status ends.
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
                'the caravans have stopped and the road east is not being used',
                'there are more people sleeping outside the walls than there were',
                'everybody who can fight has been recalled, and everybody who can heal is being '
                + 'paid too much'
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
 *
 * The one number in this file that was chosen rather than read off something
 * else, so it is stated once and pinned by a test. A little under once a
 * generation per province: rare enough that a famine is a thing people
 * remember, common enough that a five-century world has had a run of them and
 * somebody's grandmother has a story.
 *
 * Consumption does not cause it and cannot. Mundane goods are never counted
 * anywhere - **a famine causes the meals to stop, and a thousand travellers
 * buying meals does not cause a famine** - which is the causation direction the
 * whole status layer exists to keep pointing the right way.
 */
export const A_HARVEST_FAILS = 0.04;

/**
 * A harvest that failed, on a province.
 *
 * The only drawn opener and the only one with nobody to blame. It is proposed
 * on the year it is drawn and not on the next one, so it lifts at its review -
 * unless the draw comes up again, which is a second bad year and reads as one.
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
                'the stalls that sell cooked food have shut, and the ones that have not are '
                + 'selling something else',
                'there are more people on the road than there is reason for, all going one way',
                'the granaries are being guarded by people who did not use to guard them'
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
 *
 * The caller extends what is still here and lifts what is not. That is the
 * whole review and it is why there is no reviewer.
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
