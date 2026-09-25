/**
 * Why one cultivator kills another, in a year the world passes over.
 *
 * The killing template drew any living person as a killer and any victim within
 * three rungs above, so the First Seat killed Lu Sheng for no reason at all. The
 * owner: *"the target for time-based killings should not be random"*, and the
 * formula for the background tick:
 *
 *     sect relation  x  things they fight over  x  odds of fighting  x  odds of dying
 *
 * Four named factors, and each one reads the world as it already is:
 *
 *   {@link howTheyStandToEachOther}   the relation. House standing and war, a
 *                                     personal grievance, rival lineages under one
 *                                     roof, and nobody behind them at all. "If
 *                                     your sect and their sect are neutral, people
 *                                     don't draw swords": neutral is almost zero.
 *   {@link whatTheyWouldFightOver}    the stakes. What one holds and the other
 *                                     knows about and wants, a grudge's weight,
 *                                     a place they are both standing in, a seat.
 *                                     No stakes, no fight - and somebody a
 *                                     catalog states ordinary goods register as
 *                                     nothing to has no greed among them at all
 *                                     (`theCatalogStatesGoodsDoNotRegister`).
 *   {@link whetherItComesToBlows}     odds of fighting this year, given the two
 *                                     above: meeting, disposition, conscience, the
 *                                     strength gap and their numbers, and what the
 *                                     victim is worth to whoever stands behind them.
 *   {@link whatTheFightComesTo}       odds of dying, as the whole outcome mix of a
 *                                     fight: a kill (open or hidden), a shakedown,
 *                                     both wounded, the target fled, broke off, or
 *                                     a public brawl.
 *
 * The year is collapsed into those probabilities and drawn once; the scene a
 * player walks into - told to get out of a ruin, answering yes or no, and the
 * fight - is played through verbs and is not this file. `whatTheFightComesTo`
 * is the seam it would share.
 *
 * ── WHAT IT PRODUCES, ON `afford-a` ──────────────────────────────────────
 *
 * Killings a century, by the motive that moved them:
 *
 *                        at 2,500 years   at 5,000 years
 *   a grudge                   24.2             32
 *   greed                       6.0              8.4
 *   a place                     0                0
 *   a seat                      0.5              0.4
 *
 * A PLACE WAS 298 A CENTURY before `WHAT_BEING_FIRST_ON_A_PIECE_OF_GROUND_IS_WORTH`
 * came down to 0.06, before `groundWorthBeingFirstOn` replaced "anywhere away
 * from everybody", and before one quarrel a year per piece of ground: turf was
 * the commonest reason to kill anybody in the world, and the ruins ate the
 * rogues the seeding had just put in them. The two other reasons the world kills
 * - a bout somebody won against the odds, and a war - are not this file's and
 * ran 23 to 37 a century over the same spans.
 *
 * ── CONSCIENCE ───────────────────────────────────────────────────────────
 *
 * There is no alignment on a person's row, and none is added. What a person is
 * like falls out of the house they are in and of the dispositions that already
 * derive from them (`openHandednessOf`, `whatSomebodyIsLike`). Killing a
 * stranger for what they carry, or a housemate for their seat, is an evil deed:
 * {@link WHAT_A_HOUSE_WILL_STOMACH} weighs it, overwhelmingly the act of people in
 * a demonic house, rare in a neutral one and almost never in a righteous one -
 * never a switch.
 */

import { FOUNDATION_ORDINAL, realmForOrdinal, REALM_TIERS } from '../cultivation/realms.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { PROTECTOR_HELPLESS_REALM_GAP } from '../cultivation/standing-guard-over-somebody-elses-crossing.js';
import { A_PUBLIC_WIN, faceOf } from './what-a-face-is-worth.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { isBelowTheLid } from './layers.js';
import { DAO_GROUND_TAG } from './how-a-cultivator-comes-by-a-road.js';
import type { LocationRecord } from './locations.js';
import {
    isTheWorldsToMove,
    whatStandsBetween,
    theCatalogStatesGoodsDoNotRegister,
    theWorldMayEnd,
    type NpcRecord
} from './npc-state.js';
import { areAtWarWithEachOther } from './war-melee.js';
import { standingBetweenRows } from './what-a-house-answers-to.js';
import { insideSomebodysWalls } from './who-goes-out-for-a-house-and-what-comes-back.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// 1. THE RELATION
// ─────────────────────────────────────────────────────────────────────────

/** Two houses at peace with each other that are neither friends nor enemies. Almost nothing. */
export const NEUTRAL_HOUSES_DRAW_SWORDS = 0.02;
/**
 * Somebody with nobody behind them: a rogue, or a stranger from a house too far
 * to matter. Low, and it is the difference between a world with rogues in it and
 * a world that eats them: at 0.35, of eighty-one rogues seeded on `afford-a`
 * eleven were still standing at a hundred and fifty years and half the rest had
 * been killed for what they carried or for being on the wrong piece of ground.
 */
export const NOBODY_STANDS_BEHIND_THEM = 0.12;
/** Two lineages under one roof whose masters are at odds. */
export const RIVAL_LINEAGES_UNDER_ONE_ROOF = 0.5;
/** The standing at which a house counts another as hostile, `rivalsOf`'s line. */
export const HOSTILE_STANDING = -0.3;
/** The standing at which a personal tie is a grievance, `GRUDGE_STANDING`'s line. */
export const A_GRIEVANCE = -0.4;
/** The standing at which a personal tie is warm enough that neither draws on the other, whatever their houses. */
export const A_FRIEND = 0.4;
/**
 * How much of their houses' quarrel the lowest rung carries. The owner: at a low
 * rank *"the sect politics thing is beyond them"* - the 1914 Christmas truce -
 * and yet they *"still might do it over politics"*. One smooth weighting from
 * this at the bottom rung to all of it at the top.
 */
export const THE_BOTTOM_RUNG_CARRIES_OF_ITS_HOUSES_QUARREL = 0.25;

/** How much of their houses' quarrel somebody carries, by where they stand on their ladder. */
export function howMuchOfTheirHousesQuarrelTheyCarry(npc: NpcRecord, houses: ReadonlyMap<string, FactionRecord>): number {
    if (npc.factionId === null) return 1;
    const top = Math.max(1, (houses.get(npc.factionId)?.ranks.length ?? 1) - 1);
    const share = Math.max(0, Math.min(1, npc.factionRankIndex / top));
    return THE_BOTTOM_RUNG_CARRIES_OF_ITS_HOUSES_QUARREL + (1 - THE_BOTTOM_RUNG_CARRIES_OF_ITS_HOUSES_QUARREL) * share;
}

export interface TheRelation {
    value: number;
    why: 'at war' | 'hostile houses' | 'neutral houses' | 'allied houses' | 'nobody behind them'
        | 'rival lineages' | 'one house' | 'a grievance' | 'friends';
}

/** Everybody this person answers to as a master. Several is ordinary. */
function mastersOf(npc: NpcRecord): string[] {
    return [...new Set(npc.relationships.filter(r => r.kind === 'master').map(r => r.targetId))];
}

/**
 * How these two stand to each other, 0..1. The larger of what is personal and
 * what is between their houses: a grievance between two people in allied houses
 * is still a grievance.
 */
export function howTheyStandToEachOther(
    state: WorldState,
    killer: NpcRecord,
    victim: NpcRecord,
    houses: ReadonlyMap<string, FactionRecord>,
    byId?: ReadonlyMap<string, NpcRecord>
): TheRelation {
    // EVERYTHING STANDING BETWEEN THEM, not one row of it. Two people can hold
    // several kinds at once - an uncle who is also a rival - so the warm read
    // takes the warmest and the grievance read the coldest, and a single `find`
    // deciding which one answered would have made this turn on row order.
    const between2 = whatStandsBetween(killer, victim.id);
    const warmest = between2.reduce<number | null>(
        (top, row) => top === null || row.standing > top ? row.standing : top, null);
    const coldest = between2.reduce<number | null>(
        (low, row) => low === null || row.standing < low ? row.standing : low, null);
    // A WARM TIE OUTLASTS THE HOUSES. Kin, a childhood friend, somebody met on
    // the road: whatever their houses are to each other, these two do not draw
    // on each other. A grievance standing beside it is read first, because
    // somebody with a reason is somebody with a reason.
    if (coldest !== null && coldest <= A_GRIEVANCE) {
        // falls through to the personal term below
    } else if (warmest !== null && warmest >= A_FRIEND) {
        return { value: 0, why: 'friends' };
    }
    const personal: TheRelation | null = coldest !== null && coldest <= A_GRIEVANCE
        ? { value: Math.min(1, -coldest), why: 'a grievance' } : null;

    let between: TheRelation;
    const kh = killer.factionId === null ? null : houses.get(killer.factionId) ?? null;
    const vh = victim.factionId === null ? null : houses.get(victim.factionId) ?? null;
    if (kh === null || vh === null) {
        between = { value: NOBODY_STANDS_BEHIND_THEM, why: 'nobody behind them' };
    } else if (kh.id === vh.id) {
        const km = mastersOf(killer), vm = mastersOf(victim);
        // Any master of one at odds with any master of the other. With several
        // masters ordinary, the question is whether the lineages are at odds and
        // not whether two particular people are.
        const mastersAtOdds = km.some(one => vm.some(other => one !== other && (() => {
            const a = byId?.get(one) ?? state.npcs.find(n => n.id === one);
            if (!a) return false;
            return whatStandsBetween(a, other).some(t =>
                t.kind === 'rival' || t.kind === 'enemy' || t.standing <= HOSTILE_STANDING);
        })()));
        between = mastersAtOdds
            ? { value: RIVAL_LINEAGES_UNDER_ONE_ROOF, why: 'rival lineages' }
            : { value: 0, why: 'one house' };
    } else {
        // Their houses' quarrel, carried as far as their rung carries it.
        const carried = howMuchOfTheirHousesQuarrelTheyCarry(killer, houses);
        if (areAtWarWithEachOther(state, kh.id, vh.id)) {
            between = { value: carried, why: 'at war' };
        } else {
            const standing = standingBetweenRows(kh, vh);
            between = standing <= HOSTILE_STANDING
                ? { value: carried * Math.min(1, 0.3 + (-standing - 0.3)), why: 'hostile houses' }
                : standing >= -HOSTILE_STANDING
                    ? { value: 0, why: 'allied houses' }
                    : { value: NEUTRAL_HOUSES_DRAW_SWORDS, why: 'neutral houses' };
        }
    }
    return personal !== null && personal.value > between.value ? personal : between;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. THE STAKES
// ─────────────────────────────────────────────────────────────────────────

export type Motive = 'greed' | 'a grudge' | 'a place' | 'a seat';

export interface TheStakes {
    motive: Motive;
    /** 0..1. */
    weight: number;
    /** An evil deed if it ends in a killing: taking from somebody who did them no wrong, or a seat. */
    evil: boolean;
    /** What they would carry off, for greed. */
    objectIds: readonly string[];
    /** The paper a house put up on the victim, where that is what the greed is for. */
    priceFactId?: string;
}

/** A purse worth stopping somebody for, in stones. */
export const A_PURSE_WORTH_TAKING = 200;

/** The most a purse weighs as a reason, carried or posted. */
export const A_PURSE_AT_MOST = 0.6;

/**
 * What a price a house posted on somebody is worth as a reason to go after
 * them, on the same scale as a purse they carry. Nothing to somebody already
 * holding more than it: a price moves the people it would change something for.
 */
export function whatAPriceIsWorthTo(taker: Pick<NpcRecord, 'spiritStones'>, purseStones: number): number {
    if (purseStones <= Number(taker.spiritStones ?? 0)) return 0;
    return Math.min(A_PURSE_AT_MOST, purseStones / (10 * A_PURSE_WORTH_TAKING));
}

/**
 * A price standing on somebody, as the yearly pass needs it. Built by the caller
 * off `a-house-puts-a-price-on-somebody.ts`, which owns the papers.
 */
export interface APriceOnThem {
    factId: string;
    purseStones: number;
    posterFactionId: string | null;
    /** Whether the paper is on a wall at this place. */
    hangsAt(placeName: string | null): boolean;
}

/**
 * What a stake has to be worth before somebody a realm further up has any
 * reason to look at it at all.
 *
 * MOTIVE FIRST, COST SECOND. The design owner, asked why a Tribulation
 * Transcender does not go about killing people: *"and again why would they?"*
 * The first question is not what acting would cost them, it is whether there is
 * anything there. What occupies somebody at that height is other cultivators
 * near it, a thing that could carry them past their own wall, their own
 * tribulation, their house, and the handful of people they actually care about.
 * A disciple three realms down who annoyed somebody is not in that world.
 *
 * So a stake is read against the distance it is being reached across: the bar
 * rises one of these per realm, and past two realms nothing ordinary clears it.
 * A ruin (0.06) and a purse worth taking (up to 0.6) both fall out at the first
 * realm; a grievance has to be near total to cross one; nothing at all crosses
 * three. What survives is the rare pairing the genre is made of, and the face
 * cost below is charged on that.
 *
 * A SEAT IS EXEMPT, because it is not reached across anything: it is the rung
 * directly above somebody in their own house, which is as close as two people
 * in this world stand.
 */
export const WHAT_IT_TAKES_TO_INTEREST_SOMEBODY_A_REALM_UP = 0.5;

/** What being first on a piece of open ground is worth fighting over. */
export const WHAT_BEING_FIRST_ON_A_PIECE_OF_GROUND_IS_WORTH = 0.06;

/** How many of the last rows written about somebody another person might have heard. */
export const WHAT_IS_STILL_KNOWN_ABOUT_SOMEBODY = 8;

/** What a thing on somebody is worth to somebody who would kill for it, by how much it matters. */
export const WHAT_A_THING_IS_WORTH_KILLING_FOR: Readonly<Record<string, number>> = {
    mundane: 0,
    notable: 0.15,
    significant: 0.6,
    legendary: 1
};

/** Ground where a find is carried out in plain sight, and where nobody is watching. */
export function isGroundAwayFromEverybody(place: LocationRecord | null): boolean {
    if (place === null) return false;
    return place.kind === 'ruin' || place.kind === 'wilds' || place.kind === 'cave'
        || place.kind === 'secret_realm' || place.kind === 'forbidden_zone' || place.kind === 'scar'
        || place.kind === 'grave';
}

/**
 * Ground worth being first on: what a group would tell somebody to get off.
 *
 * A ruin, a vein, a cave, a grave, a sealed pocket, the edge of forbidden
 * ground, or a dao ground that teaches a road by being stood on - something
 * being WORKED. Never a town, a seat or a stretch of open country: the player
 * agent's report, of being told to clear off the square they opened the game
 * standing in, is what a mastery threshold alone lets through. No holder is
 * needed - the owner: *"I mean even an unowned ruin"* - because the claim is
 * being there first and working it, not title.
 */
export function groundWorthBeingFirstOn(place: LocationRecord | null): boolean {
    if (place === null) return false;
    if (place.tags.includes(DAO_GROUND_TAG)) return true;
    return place.kind === 'ruin' || place.kind === 'secret_realm' || place.kind === 'cave'
        || place.kind === 'grave' || place.kind === 'forbidden_zone' || place.kind === 'vein'
        || place.kind === 'sealed_domain';
}

/** Somebody the house has put where they are is on its seat, or inside its walls. */
export function isInsideACompound(place: LocationRecord | null): boolean {
    return place !== null && (place.kind === 'sect_seat' || insideSomebodysWalls(place));
}

/**
 * What these two would fight over, the heaviest of it, or null for nothing.
 *
 * Greed needs the killer to KNOW: they are standing on ground where a find is
 * carried out in the open, or they hold a fact naming the victim with the thing.
 */
export function whatTheyWouldFightOver(input: {
    state: WorldState;
    killer: NpcRecord;
    victim: NpcRecord;
    place: LocationRecord | null;
    carried: readonly { id: string; significance: string }[];
    /** Somebody the killer could take a seat off: blocked, and this person holds the rung. */
    standsInTheirSeat: boolean;
    /** The facts the killer carries, for whether they know what the victim has. */
    killerKnows?: ReadonlySet<string>;
    /**
     * A price a house has put on the victim, on a wall the killer is standing
     * by. See `a-house-puts-a-price-on-somebody.ts`.
     */
    priceOnThem?: { factId: string; purseStones: number } | null;
}): TheStakes | null {
    const { killer, victim, place } = input;
    const options: TheStakes[] = [];

    // The coldest thing standing between them, of however many kinds do.
    const worst = whatStandsBetween(killer, victim.id)
        .reduce<number | null>((low, row) => low === null || row.standing < low ? row.standing : low, null);
    if (worst !== null && worst <= A_GRIEVANCE) {
        options.push({ motive: 'a grudge', weight: Math.min(1, -worst), evil: false, objectIds: [] });
    }

    // AND NOT SOMEBODY GOODS DO NOT REGISTER FOR. What a person below them
    // carries is worth nothing to them, so there is nothing here to want. See
    // `theCatalogStatesGoodsDoNotRegister`.
    const knows = theCatalogStatesGoodsDoNotRegister(killer)
        ? null
        : input.killerKnows ?? new Set(killer.historyFactIds);
    // Standing where a find is carried out in the open, or holding one of the
    // last few rows written about them - which is where "seen carrying a heaven
    // thing out of a ruin" lives. The tail rather than the whole trajectory: a
    // six-hundred-year record is not what somebody knows about you today.
    const lately = victim.historyFactIds.slice(-WHAT_IS_STILL_KNOWN_ABOUT_SOMEBODY);
    const seen = knows !== null && input.carried.length > 0 && (isGroundAwayFromEverybody(place)
        || lately.some(id => knows.has(id)));
    if (seen) {
        let worth = 0;
        const taken: string[] = [];
        for (const thing of input.carried) {
            const w = WHAT_A_THING_IS_WORTH_KILLING_FOR[thing.significance] ?? 0;
            if (w <= 0) continue;
            worth = Math.max(worth, w);
            taken.push(thing.id);
        }
        // AND WHAT THEY ARE CARRYING IN STONES, which is most of what most
        // people have worth taking. Against the killer's own purse, because a
        // hundred stones is a fortune to somebody with none and nothing to
        // somebody with a thousand.
        const purse = Number(victim.spiritStones ?? 0);
        if (knows !== null && purse > A_PURSE_WORTH_TAKING && purse > 2 * Number(killer.spiritStones ?? 0)) {
            worth = Math.max(worth, Math.min(A_PURSE_AT_MOST, purse / (10 * A_PURSE_WORTH_TAKING)));
        }
        if (worth > 0) {
            const wronged = worst !== null && worst <= A_GRIEVANCE;
            options.push({ motive: 'greed', weight: worth, evil: !wronged, objectIds: taken });
        }
    }

    // AND ONLY BETWEEN PEOPLE WHO COULD WORK IT, on ground that still holds
    // something. Everybody standing in a province's ruins was in it before,
    // mortals included, and turf was the world's commonest reason to kill
    // somebody at 298 a century.
    if (groundWorthBeingFirstOn(place) && place !== null && !place.tags.includes('emptied')
        && killer.cultivation.realmOrdinal >= FOUNDATION_ORDINAL
        && victim.cultivation.realmOrdinal >= FOUNDATION_ORDINAL) {
        // First there, and what is in it. No holder is needed - and mostly it is
        // a demand to leave rather than a fight, which is what the weight says:
        // at 0.25 a place was the world's commonest reason to kill somebody, at
        // 168 killings a century against greed's 7.
        options.push({ motive: 'a place', weight: WHAT_BEING_FIRST_ON_A_PIECE_OF_GROUND_IS_WORTH, evil: false, objectIds: [] });
    }

    if (input.standsInTheirSeat) {
        options.push({ motive: 'a seat', weight: 0.6, evil: true, objectIds: [] });
    }

    // A PURSE A HOUSE HAS PUT ON THEM, which is greed and not an evil one: the
    // house posted it in public and anybody may take it up.
    if (input.priceOnThem) {
        const worth = whatAPriceIsWorthTo(killer, input.priceOnThem.purseStones);
        if (worth > 0) {
            options.push({ motive: 'greed', weight: worth, evil: false, objectIds: [], priceFactId: input.priceOnThem.factId });
        }
    }

    // AND IS ANY OF IT WORTH THEIR WHILE. Reaching down costs nothing to
    // consider today: a Seat could hold a full-weight motive over a mortal's
    // purse. The bar rises with every realm between them, and a seat is the one
    // stake that is not reached across a gap at all.
    const reach = Math.max(0, realmsApart(killer.cultivation.realmOrdinal, victim.cultivation.realmOrdinal));
    const worthTheirWhile = options.filter(o =>
        o.motive === 'a seat'
        || o.weight >= WHAT_IT_TAKES_TO_INTEREST_SOMEBODY_A_REALM_UP * reach);

    if (worthTheirWhile.length === 0) return null;
    return worthTheirWhile.sort((a, b) => b.weight - a.weight)[0]!;
}

/**
 * What killing somebody beneath you costs in face, in public wins.
 *
 * The owner: somebody at that height killing a nobody LOSES face - it is
 * beneath them, it says they were threatened by somebody who could not threaten
 * them, and the whole world hears about it. The unit is `A_PUBLIC_WIN`, the
 * same one `what-a-face-is-worth.ts` prices a win over an equal in, and the
 * shape is that file's own: realms, not rungs.
 *
 * Nought where they are level or below - killing upward is not shameful, it is
 * the story - and nought for a killing nobody works out, which is one more
 * reason the genre hides them.
 */
export function whatPunchingDownCostsInFace(killerOrdinal: number, victimOrdinal: number): number {
    const reach = realmsApart(killerOrdinal, victimOrdinal);
    return reach <= 0 ? 0 : Number((A_PUBLIC_WIN * reach).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────
// 3. WHETHER IT COMES TO BLOWS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a house's people will go for a deed that is evil, and for one that is
 * not. Demonic houses hold the most people who would; righteous the fewest, and
 * never none.
 */
export const WHAT_A_HOUSE_WILL_STOMACH: Readonly<Record<string, { evil: number; ordinary: number }>> = {
    demonic: { evil: 1, ordinary: 1 },
    neutral: { evil: 0.08, ordinary: 0.6 },
    righteous: { evil: 0.01, ordinary: 0.35 },
    // Somebody on no roll answers to nobody and to their own nature.
    none: { evil: 0.25, ordinary: 0.8 }
};

/**
 * The chance, in a year, that relation 1 and stakes 1 between two people who meet
 * comes to blows.
 *
 * THE CLOCK IS A CALENDAR YEAR AND NOT A SHARE OF A LIFE, which is the opposite
 * of how a departure is read (`WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR` is stated in
 * a mortal's hundred and divided by the span the person has). It is deliberate:
 * somebody who has been robbed does not wait a century to answer it because they
 * have a century, and a party standing on a ruin's step decides that week. What
 * it means is that a long-lived person accumulates far more chances to be in one
 * of these than a mortal does - which is the world's own arithmetic, and it is
 * why the rung weighting in `howMuchOfTheirHousesQuarrelTheyCarry` and the
 * worth-to-their-patron term carry as much of the shape as the base rate does.
 */
export const A_YEAR_AT_THE_WORST = 0.5;

/**
 * Below this a year's chance is not worth drawing on, and the pair is dropped.
 * Two strangers who happen to stand in the same town all year are most pairs in
 * the world, and a draw on each of them is the whole cost of this pass.
 */
export const WORTH_A_DRAW = 0.002;

/** How much of a year two people standing on the same ground spend where the other is. */
export const TWO_PEOPLE_ON_ONE_PIECE_OF_GROUND_MEET = 1;
/** And inside a compound, where the thing is seen. */
export const INSIDE_A_COMPOUND_IT_IS_SEEN = 0.15;

/** How many realms apart two people are. */
export function realmsApart(a: number, b: number): number {
    return REALM_TIERS.indexOf(realmForOrdinal(a)) - REALM_TIERS.indexOf(realmForOrdinal(b));
}

/** What the victim is worth to whoever stands behind them, 0..1: a junior disciple is little and an elder a great deal. */
export function whatTheyAreWorthToTheirPatron(victim: NpcRecord, houses: ReadonlyMap<string, FactionRecord>): number {
    if (victim.factionId === null) return 0;
    const house = houses.get(victim.factionId);
    const top = Math.max(1, (house?.ranks.length ?? 1) - 1);
    return Math.max(0, Math.min(1, victim.factionRankIndex / top));
}

/** The attackers' effective height: their strongest, plus what numbers are worth. */
export function theirHeight(attackers: readonly { cultivation: { realmOrdinal: number } }[]): number {
    const best = attackers.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
    return best + 2 * Math.log2(Math.max(1, attackers.length));
}

export function whetherItComesToBlows(input: {
    relation: TheRelation;
    stakes: TheStakes;
    killer: NpcRecord;
    killersHouse: FactionRecord | null;
    attackers: readonly NpcRecord[];
    victim: NpcRecord;
    victimWorth: number;
    place: LocationRecord | null;
}): number {
    const { relation, stakes, killer, victim, place } = input;
    if (relation.value <= 0 || stakes.weight <= 0) return 0;
    // A contest across realms is a no-contest: nobody sets out to kill somebody
    // who cannot be reached, and a disciple does not simply kill an elder.
    const gap = theirHeight(input.attackers) - victim.cultivation.realmOrdinal;
    if (realmsApart(victim.cultivation.realmOrdinal, killer.cultivation.realmOrdinal) >= PROTECTOR_HELPLESS_REALM_GAP) return 0;
    if (gap < -3) return 0;

    const alignment = input.killersHouse?.alignment ?? 'none';
    const stomach = WHAT_A_HOUSE_WILL_STOMACH[alignment] ?? WHAT_A_HOUSE_WILL_STOMACH.none!;
    const conscience = stakes.evil ? stomach.evil : stomach.ordinary;
    // Greed moves the grasping; the open-handed barely.
    const disposition = stakes.motive === 'greed' ? Math.max(0.1, (1 - openHandednessOf(killer.id)) / 2) : 1;
    // Small stakes to the patron is small risk to the killer.
    const risk = 1 - 0.85 * input.victimWorth;
    // Somebody who thinks they will lose mostly does not start.
    const confidence = 1 / (1 + Math.exp(-(gap + 1) / 1.5));
    const meet = isInsideACompound(place) ? INSIDE_A_COMPOUND_IT_IS_SEEN : TWO_PEOPLE_ON_ONE_PIECE_OF_GROUND_MEET;
    // AND WHAT IT WOULD COST THEM TO BE SEEN DOING IT, which is the second
    // filter and not the first: the stake read has already returned nothing for
    // most of these pairings. Somebody with face to lose is held back hardest,
    // because face is what is being spent.
    const cost = whatPunchingDownCostsInFace(killer.cultivation.realmOrdinal, victim.cultivation.realmOrdinal);
    const beneathThem = 1 / (1 + cost * (1 + Math.max(0, faceOf(killer))));
    return Math.max(0, Math.min(1,
        A_YEAR_AT_THE_WORST * relation.value * stakes.weight * conscience * disposition * risk
        * confidence * meet * beneathThem));
}

// ─────────────────────────────────────────────────────────────────────────
// 4. WHAT THE FIGHT COMES TO
// ─────────────────────────────────────────────────────────────────────────

export interface WhatAFightComesTo {
    killed: number;
    /** Killed, and made to look like something else. Part of `killed`, not added to it. */
    hidden: number;
    shakedown: number;
    bothWounded: number;
    fled: number;
    brokeOff: number;
    /** The target ran somewhere with people in it and it became everybody's fight. */
    publicBrawl: number;
}

/** How much quicker numbers and a real gap make it. */
function howQuick(gap: number): number {
    return 1 / (1 + Math.exp(-(gap - 3) / 1.5));
}

/**
 * The outcome mix of one fight. Between near-equals most fights are long and
 * end without a death; a real gap or numbers make it quick, and a quick fight
 * away from everybody is one that can be made to look like something else.
 */
export function whatTheFightComesTo(input: {
    gap: number;
    attackers: number;
    place: LocationRecord | null;
    /** Somewhere with people near enough to run to. */
    peopleNearby: boolean;
    stakes: TheStakes;
    killersHouse: FactionRecord | null;
}): WhatAFightComesTo {
    const quick = howQuick(input.gap);
    const away = isGroundAwayFromEverybody(input.place);
    let killed = quick * 0.85 + (1 - quick) * 0.2;
    const fled = (1 - quick) * 0.3;
    const bothWounded = (1 - quick) * 0.3;
    let publicBrawl = input.peopleNearby ? fled * 0.4 : 0;
    const fledQuietly = fled - publicBrawl;
    // A group that has somebody at its mercy may take what they carry and let
    // them walk, which is small stakes and invites nobody; demonic houses mostly
    // do not bother.
    let shakedown = 0;
    if (input.attackers >= 2 && input.gap >= 3 && input.stakes.motive !== 'a grudge' && input.stakes.motive !== 'a seat') {
        const lean = input.killersHouse?.alignment === 'demonic' ? 0.25 : 0.7;
        shakedown = killed * lean;
        killed -= shakedown;
    }
    const hidden = killed * (away ? (0.3 + 0.6 * quick) : 0.05);
    const brokeOff = Math.max(0, 1 - killed - shakedown - bothWounded - fledQuietly - publicBrawl);
    publicBrawl = Math.max(0, publicBrawl);
    return { killed, hidden, shakedown, bothWounded, fled: fledQuietly, brokeOff, publicBrawl };
}

/** One draw from the mix. */
export function drawTheOutcome(mix: WhatAFightComesTo, sample: number): keyof Omit<WhatAFightComesTo, 'hidden'> | 'hidden' {
    let left = sample;
    if ((left -= mix.hidden) < 0) return 'hidden';
    if ((left -= mix.killed - mix.hidden) < 0) return 'killed';
    if ((left -= mix.shakedown) < 0) return 'shakedown';
    if ((left -= mix.bothWounded) < 0) return 'bothWounded';
    if ((left -= mix.fled) < 0) return 'fled';
    if ((left -= mix.publicBrawl) < 0) return 'publicBrawl';
    return 'brokeOff';
}

// ─────────────────────────────────────────────────────────────────────────
// WHO COULD, THIS YEAR
// ─────────────────────────────────────────────────────────────────────────

/** Somebody the world may move to do this, and somebody the world may end. */
export function couldBeEither(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc) && theSpeciesItIs(npc) === null;
}

export interface AReasonThisYear {
    killer: NpcRecord;
    victim: NpcRecord;
    attackers: readonly NpcRecord[];
    relation: TheRelation;
    stakes: TheStakes;
    chance: number;
    place: LocationRecord | null;
}

/**
 * Every pair with a reason this year: people standing on the same ground, where
 * both factors are above nothing. No draw over the population picks anybody.
 */
export function everybodyWithAReasonThisYear(
    state: WorldState,
    seatsTheyWant: ReadonlyMap<string, ReadonlySet<string>>,
    /** The largest price standing on each person, keyed by who it names. */
    priced: ReadonlyMap<string, APriceOnThem> = new Map()
): AReasonThisYear[] {
    const houses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, f] as const));
    const places = new Map(state.locations.map(l => [l.id, l] as const));
    const byPlace = new Map<string, NpcRecord[]>();
    for (const n of state.npcs) {
        if (!couldBeEither(n) || n.locationId === null) continue;
        const list = byPlace.get(n.locationId) ?? [];
        list.push(n);
        byPlace.set(n.locationId, list);
    }
    const carriedBy = new Map<string, { id: string; significance: string }[]>();
    for (const o of state.objects) {
        if (o.possessorId === null || o.significance === 'mundane') continue;
        const list = carriedBy.get(o.possessorId) ?? [];
        list.push({ id: o.id, significance: o.significance });
        carriedBy.set(o.possessorId, list);
    }

    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const knows = new Map<string, Set<string>>();
    const out: AReasonThisYear[] = [];
    const already = new Set<string>();

    // MOTIVE FIRST, AND NEVER EVERY PAIR IN A TOWN. Walking the people standing
    // on each piece of ground against each other is a square in the size of a
    // market and most of it is strangers passing: measured at five hundred
    // years, that shape was the largest term in the advance. The pairs come off
    // the motives instead - who holds a grievance against whom, who is carrying
    // something where it would be seen, who is standing on ground worth being
    // first on, and who is held back from a seat somebody else has.
    // Who would stand with a killer where they are. It depends on the killer
    // alone, and was being filtered out of the whole square for every pair.
    const allies = new Map<string, NpcRecord[]>();
    const alliesHere = (killer: NpcRecord): NpcRecord[] => {
        let found = allies.get(killer.id);
        if (found === undefined) {
            found = (byPlace.get(killer.locationId!) ?? []).filter(n => n.id !== killer.id
                && n.factionId !== null && n.factionId === killer.factionId
                && killer.activity !== null && killer.activity.withIds.includes(n.id));
            allies.set(killer.id, found);
        }
        return found;
    };

    // `cameFor`: the killer read a paper and went to where the victim is, so
    // the two need not have been standing on the same ground.
    const consider = (killer: NpcRecord, victim: NpcRecord, cameFor = false): void => {
        if (killer.id === victim.id) return;
        // The cheap refusals first. Each reads only this year's fixed state, so
        // a pair they turn away would be turned away again, and skipping the
        // key for it changes nothing but the cost.
        if (killer.locationId === null || victim.locationId === null) return;
        if (!cameFor && killer.locationId !== victim.locationId) return;
        if (!isTheWorldsToMove(killer) || !theWorldMayEnd(victim)) return;
        const pair = `${killer.id}|${victim.id}`;
        if (already.has(pair)) return;
        already.add(pair);
        const place = places.get(victim.locationId) ?? null;
        const relation = howTheyStandToEachOther(state, killer, victim, houses, byId);
        if (relation.value <= 0) return;
        if (!knows.has(killer.id)) knows.set(killer.id, new Set(killer.historyFactIds));
        const paper = priced.get(victim.id);
        const stakes = whatTheyWouldFightOver({
            state, killer, victim, place,
            carried: carriedBy.get(victim.id) ?? [],
            standsInTheirSeat: seatsTheyWant.get(killer.id)?.has(victim.id) ?? false,
            killerKnows: knows.get(killer.id)!,
            priceOnThem: paper && killer.factionId !== paper.posterFactionId
                && paper.hangsAt(places.get(killer.locationId)?.name ?? null)
                ? { factId: paper.factId, purseStones: paper.purseStones }
                : null
        });
        if (stakes === null) return;
        const attackers = [killer, ...alliesHere(killer).filter(n => n.id !== victim.id)];
        const killersHouse = killer.factionId === null ? null : houses.get(killer.factionId) ?? null;
        const chance = whetherItComesToBlows({
            relation, stakes, killer, killersHouse, attackers, victim,
            victimWorth: whatTheyAreWorthToTheirPatron(victim, houses), place
        });
        if (chance < WORTH_A_DRAW) return;
        out.push({ killer, victim, attackers, relation, stakes, chance, place });
    };

    // A grievance, held by one person against another.
    for (const killer of state.npcs) {
        if (!couldBeEither(killer) || killer.locationId === null) continue;
        for (const tie of killer.relationships) {
            if (tie.standing > A_GRIEVANCE) continue;
            const victim = byId.get(tie.targetId);
            if (victim && couldBeEither(victim)) consider(killer, victim);
        }
    }
    // A PRICE ON SOMEBODY, read off a wall by anybody standing where the paper
    // hangs, who may go to where the person is. Before the going, 0 of 78 papers
    // on `price-probe` and `afford-a` over a century each were ever brought in:
    // the people a house puts paper up on are mostly home inside their own
    // house's walls among their own, and nobody beside them wants the purse.
    // After it, the same two centuries carry 56 papers, three to six standing
    // at once, and about three people a year with a reason at ~0.5% each - a
    // paper on another NPC is brought in roughly once in two centuries. That is
    // the world's arithmetic rather than a gate: the named are mostly strong,
    // and the few who could reach them already hold more than the purse.
    for (const [targetId, paper] of priced) {
        const victim = byId.get(targetId);
        if (!victim || !couldBeEither(victim) || victim.locationId === null) continue;
        for (const [placeId, standing] of byPlace) {
            if (!paper.hangsAt(places.get(placeId)?.name ?? null)) continue;
            for (const killer of standing) {
                if (killer.factionId !== null && killer.factionId === victim.factionId) continue;
                consider(killer, victim, true);
            }
        }
    }
    // A seat somebody else is standing in.
    for (const [killerId, holders] of seatsTheyWant) {
        const killer = byId.get(killerId);
        if (!killer || !couldBeEither(killer)) continue;
        for (const holderId of holders) {
            const victim = byId.get(holderId);
            if (victim && couldBeEither(victim)) consider(killer, victim);
        }
    }
    for (const [placeId, here] of byPlace) {
        if (here.length < 2) continue;
        const place = places.get(placeId) ?? null;
        const away = isGroundAwayFromEverybody(place);
        // Ground worth being first on: everybody standing on it is in it.
        if (away && place !== null && place.kind !== 'wilds') {
            const before = out.length;
            for (const killer of here) for (const victim of here) consider(killer, victim);
            // AND ONE PIECE OF GROUND IS ONE QUARREL A YEAR. Ten people at a
            // door is ninety pairs, and drawing on every one of them turned a
            // ruin into a battlefield every season.
            if (out.length - before > 1) {
                const mine = out.splice(before).sort((a, b) => b.chance - a.chance);
                out.push(mine[0]!);
            }
            continue;
        }
        // And what somebody is carrying, where it would be seen.
        const carriers = here.filter(n => (carriedBy.get(n.id)?.length ?? 0) > 0
            || Number(n.spiritStones ?? 0) > 200);
        if (carriers.length === 0) continue;
        for (const victim of carriers) for (const killer of here) consider(killer, victim);
    }
    return out;
}
