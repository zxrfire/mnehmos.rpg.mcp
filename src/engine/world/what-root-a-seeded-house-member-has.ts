/**
 * The spirit root of somebody the world was created already standing in a house.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE SAME DEFECT AS THE BIRTH LOTTERY, ONE FIELD OVER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `where-the-seeded-population-was-born.ts` fixed a seeded person's ORIGIN
 * being drawn from the birth lottery when the seat they were placed into
 * implied a different distribution. This is that bug again in the root: the
 * seeder rolls a spirit root from `SPIRIT_ROOTS` independently of the road the
 * house teaches, so the Azure Cloud Pavilion's own Sword Elder is refused its
 * own sword road about half the time, on every seed.
 *
 * The conflict rule makes it structural rather than occasional.
 * `conflictsWithRoot` refuses an element whenever the root carries what that
 * element OVERCOMES, and the share of the world's births each road is open to
 * is not close to everybody:
 *
 *     fire 37.8%   metal 46.8%   wood 46.8%   earth 56.8%   water 68.5%
 *
 * So an independent roll does not produce the occasional awkward pairing. It
 * produces a house whose own seniors structurally cannot practise its own book,
 * at every house with an element, forever. Measured before this module: root
 * fit with the house road was 58-65% at EVERY rung, flat, with no improvement
 * whatsoever from bottom to top - and 53.3% at ordinal 37 and above, the worst
 * band in the world.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * PEOPLE SELF-SELECT, AND HOUSES SELECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The world's answer needs no rule written for it. Nobody spends a life on a
 * road their root refuses, and no house raises somebody to Sword Elder who
 * cannot practise the sword. The mismatch is not forbidden - it is what does
 * not survive to the top.
 *
 * This module is one half of that. The other half is in the seeder, where a
 * derived provincial's root is NOT conditioned on anything: instead the house
 * that offers them a place is chosen to suit the root they already rolled.
 * Both express the same sentence from opposite ends, and neither inverts the
 * causality - which is the trap the origin fix had to avoid too.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * FOUR REGIMES, READ OFF THE CATALOG AND NEVER TAGGED BY HAND
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A soft reweight everywhere is not enough, because some houses are a HARD
 * filter: the one road is the only thing they have to give, and to somebody
 * whose root refuses it, it is worth nothing. Such a house does not admit that
 * person as a cultivator at all.
 *
 *   STATED_ROOTS   The house names the roots it takes. Eleven do, in
 *                  `SECT_ADMISSION.preferredRoots`, and this is AUTHORED
 *                  content rather than anything inferred here. Above the bottom
 *                  rung the cultivating body is exactly those roots.
 *
 *   SINGLE_ROAD    One distinct element across everything it teaches, and no
 *                  stated roots. Above the bottom rung, roots the road refuses
 *                  are not there - they had nothing to climb.
 *
 *   SEVERAL_ROADS  More than one element, so there is somewhere for most people
 *                  to go. The soft form: a root refused by EVERY road it
 *                  teaches decays with the rung, and one that suits any road is
 *                  untouched.
 *
 *   NO_ROAD        Eleven houses teach nothing elemental. The lottery, exactly
 *                  as it stands, and this is most of why elementless houses
 *                  exist.
 *
 * Derived at runtime from `preferredRoots` and `teachesElements`, so a sect
 * added later lands in the right regime with nobody editing a list, and so the
 * agent currently adding arts to `techniques.ts` cannot silently invalidate it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE BOTTOM RUNG IS WHERE THE MISMATCH LIVES, AND IT IS A FEATURE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * NOTHING here conditions rung zero, in any regime. Two different facts about
 * the world turn out to be the same rule:
 *
 *   - An outer disciple among hundreds may be anything, because nothing has
 *     filtered them yet.
 *   - `Dew Servant`, `Sword Servant`, `Herb Boy`, `Stone Bearer`, `Coal Hand` -
 *     more than half the ladders in the catalog open with a rung that is not a
 *     cultivating rung at all. That rung has always been there and now it has a
 *     population and a reason: somebody in the house, of the house, possibly
 *     born to it, who will never climb it, because the one road it teaches is
 *     not a road their root can walk.
 *
 * So the mismatched people are still there. They are at the bottom, they are
 * numerous, and they are exactly the person who leaves, resents, or takes an
 * offer from a rival - all of which the world already has machinery for. A
 * single-root cultivating body over a servant rung holding every other root is
 * a truer institution than one where everybody matches, and it costs one
 * `rankIndex <= 0` check to get.
 *
 * Pure. Deterministic. No I/O, no database, no LLM.
 */

import {
    SPIRIT_ROOTS,
    conflictsWithRoot,
    type SpiritRoot,
    type SpiritRootKey
} from '../cultivation/spirit-roots.js';
import { CONFLICTING_TECHNIQUE_RISK } from '../cultivation/deviation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT KIND OF ROAD A HOUSE HAS
// ─────────────────────────────────────────────────────────────────────────

export type RoadRegime = 'stated_roots' | 'single_road' | 'several_roads' | 'no_road';

export interface HouseRoad {
    regime: RoadRegime;
    /** Roots the house says it takes. Non-empty only for `stated_roots`. */
    statedRoots: readonly SpiritRootKey[];
    /** Distinct non-null elements across everything it teaches. */
    elements: readonly string[];
    /**
     * The highest rung each element carries somebody to inside this house.
     *
     * A HOUSE IS A SHELF, NOT AN ART. A primary road carries high and a
     * secondary road stops lower, and that ceiling is the whole of what decides
     * how far somebody who can only walk the secondary road gets to rise. A
     * wood-rooted member of a water house that also teaches wood to Elder is
     * neither excluded nor equal: they have a real career with a real ceiling,
     * and it is their root that put it there.
     */
    capByElement: ReadonlyMap<string, number>;
}

/** The shape this module needs off a catalog faction, and nothing more. */
export interface RoadSource {
    preferredRoots: readonly string[];
    teachesElements: readonly (string | null)[];
    /** Optional; falls back to `teachesElements` with no ceilings known. */
    teachesRoads?: readonly { element: string | null; cap: number }[];
    /**
     * Read as an INPUT, never as a rule written per house.
     *
     * A righteous or neutral house narrows toward what it developed: the road
     * is a lineage, it is taught by people who walked it, and its seniors came
     * up it. A demonic house's shelf is a trophy cabinet - roads taken off
     * people they killed, unrelated to each other, held together by nothing but
     * who won. So it does not narrow, its seniors may each have come up a
     * different road, and a demonic house whose seniors all shared a root would
     * read as a lineage, which is exactly what it is not.
     */
    alignment?: string;
}

const ROOT_KEYS = new Set<string>(SPIRIT_ROOTS.map(r => r.key));

/**
 * Which regime a house is in, from its own catalog entry.
 *
 * `preferredRoots` wins over the element count where both are present, and the
 * reason is a real finding rather than a preference: the Frostmirror Court
 * takes `mutated_ice` and nothing else, and ICE REFUSES NOBODY - `OVERCOMES`
 * maps lightning and ice to null, so `conflictsWithRoot` says an ice road is
 * open to 100% of births. The narrowness of that house is not in the conflict
 * rule at all and reading only the element would miss it entirely. The same
 * goes for the Storm Tyrant Court and lightning.
 */
export function houseRoadOf(source: RoadSource): HouseRoad {
    // Defensive on every field. A faction assembled by hand - which is how most
    // of the test suite builds one, and how an older saved world deserialises -
    // carries none of these, and a house we know nothing about must come back
    // as a house with no road rather than throwing inside the seeder.
    const taught = source?.teachesElements ?? [];
    const preferred = source?.preferredRoots ?? [];
    const elements = [...new Set(taught.filter((e): e is string => !!e))];
    const stated = preferred.filter((r): r is SpiritRootKey => ROOT_KEYS.has(r));

    // Highest rung each road carries to, across the whole shelf. An element
    // taught twice keeps the deeper book, which is what a shelf means.
    const capByElement = new Map<string, number>();
    for (const road of source.teachesRoads ?? []) {
        const key = road.element ?? ELEMENTLESS;
        capByElement.set(key, Math.max(capByElement.get(key) ?? 0, road.cap));
    }

    let regime: RoadRegime =
        stated.length > 0 ? 'stated_roots'
            : elements.length === 0 ? 'no_road'
                : elements.length === 1 ? 'single_road'
                    : 'several_roads';

    // A TROPHY CABINET IS NOT A LINEAGE, AND NEVER HARD-FILTERS.
    //
    // Whatever a demonic house's shelf happens to hold, it did not develop it
    // and there is nobody whose lineage it is - so it has no reason to refuse a
    // root, and every reason to take somebody a righteous house would only have
    // as a servant. That interaction is the point rather than a side effect: it
    // gives the mismatched roots an OUTFLOW instead of a dead end at the bottom
    // of somewhere that will never promote them, and it is most of why anybody
    // joins one.
    //
    // The ceiling rule below still binds, because standing above the end of
    // every road you can walk is arithmetic rather than doctrine.
    const spreads = (source.alignment ?? '') === 'demonic';
    if (spreads && (regime === 'stated_roots' || regime === 'single_road')) {
        regime = 'several_roads';
    }
    return {
        regime,
        statedRoots: spreads ? [] : stated,
        elements,
        capByElement
    };
}

/** Key for the elementless part of a shelf, which suits everybody by definition. */
const ELEMENTLESS = '';

/**
 * The highest rung inside this house that this root can actually be carried to.
 *
 * The secondary-road ceiling, and the reason a mismatched member is not simply
 * excluded. Somebody who can only walk a road that stops at Elder has a real
 * career and a real end to it, and the rung they stall at is a fact about their
 * root rather than about anybody's opinion of them.
 *
 * `Infinity` when the shelf carries no ceilings - an older catalog, or a house
 * whose books have no cap recorded - so the caller falls back to the plain
 * refusal test rather than inventing a limit nobody wrote down.
 */
export function reachableCeiling(road: HouseRoad, root: SpiritRoot): number {
    if (road.capByElement.size === 0) return Infinity;
    let best = -1;
    for (const [key, cap] of road.capByElement) {
        const suits = key === ELEMENTLESS || !conflictsWithRoot(root, key as never);
        if (suits) best = Math.max(best, cap);
    }
    return best;
}

/** Whether this house's road refuses this root outright. */
export function roadRefuses(road: HouseRoad, root: SpiritRoot): boolean {
    if (road.regime === 'no_road') return false;
    if (road.regime === 'stated_roots') return !road.statedRoots.includes(root.key);
    // Refused only when EVERY road it teaches refuses them. With one road that
    // is the road; with several it is the honest reading of "nowhere to go".
    return road.elements.every(el => conflictsWithRoot(root, el as never));
}

// ─────────────────────────────────────────────────────────────────────────
// HOW FAST A MISMATCH STOPS BEING THERE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Odds a conflicted cultivator is still on this road after one more rung.
 *
 * DERIVED, not calibrated - which is the one way this differs from the origin
 * fix, and it is better. `deviation.ts` already prices cultivating against your
 * own root at `CONFLICTING_TECHNIQUE_RISK`, an added per-check probability of
 * qi deviation. Read as one road-ending event per rung at the conflict's own
 * risk, the chance of still being there is its complement.
 *
 * The gradient that falls out is the whole mechanic and nobody wrote it:
 *
 *     rung 0   1.000      rung 21   0.069
 *     rung 6   0.464      rung 30   0.021
 *     rung 13  0.190      rung 40   0.006
 *
 * Ordinary at the bottom, sharply selected at the top, with no table of rank
 * weights anywhere.
 */
export const STAYS_ON_A_REFUSING_ROAD_PER_RUNG = 1 - CONFLICTING_TECHNIQUE_RISK;

/**
 * The root table reweighted for somebody already standing at this rung here.
 *
 * Prior times likelihood. The prior is `SPIRIT_ROOTS` weight, untouched; the
 * likelihood is 1 for a root the road accepts and decays with the climb for one
 * it refuses. Returned in catalog order so it can be asserted position by
 * position against `SPIRIT_ROOTS`.
 */
export function rootWeightsForSomebodyAt(
    road: HouseRoad,
    realmOrdinal: number,
    rankIndex: number
): { root: SpiritRoot; weight: number }[] {
    // ONLY A TEACHING NARROWNESS IS HARD, AND THE DISTINCTION IS THE CATALOG'S.
    //
    // `preferredRoots` is documented as the roots a house actively RECRUITS -
    // a preference, and reading it as an exclusion was wrong and measurable:
    // the Azure Cloud Pavilion prefers two roots out of twelve, so treating
    // that as a bar turned four fifths of its people into servants and emptied
    // the middle of eleven houses.
    //
    // What is genuinely hard is a house that can only TEACH one road. It cannot
    // cultivate somebody that road refuses, because there is no second thing to
    // teach them - which is exactly the owner's "they can't teach any other".
    // A stated preference is strong and still a preference.
    const hard = road.regime === 'single_road';
    const conditioned = rankIndex > 0 && road.regime !== 'no_road';
    const decay = Math.pow(STAYS_ON_A_REFUSING_ROAD_PER_RUNG, Math.max(0, realmOrdinal));

    const rows = SPIRIT_ROOTS.map(root => {
        if (!conditioned) return { root, weight: root.weight };
        if (roadRefuses(road, root)) {
            // A house whose whole teaching is one road did not admit this
            // person as a cultivator, so there is no rung above the bottom for
            // them to be on. A house with somewhere else to put them merely
            // makes it unlikely.
            return { root, weight: hard ? 0 : root.weight * decay };
        }
        // THE SECONDARY ROAD'S CEILING. They are not refused - they are simply
        // past the end of the only road here they can walk, and every rung
        // beyond it is one nothing in this house could have carried them over.
        const ceiling = reachableCeiling(road, root);
        const over = realmOrdinal - ceiling;
        if (over > 0) {
            return {
                root,
                weight: root.weight * Math.pow(STAYS_ON_A_REFUSING_ROAD_PER_RUNG, over)
            };
        }
        return { root, weight: root.weight };
    });

    // A stated-roots house whose named roots are somehow all unknown would
    // otherwise have nobody at all. Fall back to the untouched table rather
    // than inventing an answer.
    return rows.some(r => r.weight > 0) ? rows : SPIRIT_ROOTS.map(r => ({ root: r, weight: r.weight }));
}

/**
 * Draw the root of somebody the world already contains, in the house they hold.
 *
 * Takes a uniform [0,1) sample rather than an RNG, matching `rollSpiritRoot`
 * and `drawOriginForSomebodyAlreadyAtOrdinal`: the caller owns seeding, always.
 *
 * NOT A REPLACEMENT FOR `rollSpiritRoot` AND MUST NEVER BECOME ONE. Anybody
 * being born, anybody with no house, anybody in a house that teaches nothing
 * elemental, and anybody on the bottom rung of any house draws from the root
 * table itself. This function answers a different question: not what root a
 * person is born with, but what root somebody who is ALREADY a house's Sword
 * Elder turns out to have had.
 */
export function drawRootForSomebodyAlreadyInAHouse(
    sample: number,
    road: HouseRoad,
    realmOrdinal: number,
    rankIndex: number
): SpiritRoot {
    const rows = rootWeightsForSomebodyAt(road, realmOrdinal, rankIndex);
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    if (!(total > 0)) return SPIRIT_ROOTS[0];

    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * total;
    for (const row of rows) {
        cursor -= row.weight;
        if (cursor < 0) return row.root;
    }
    return rows[rows.length - 1].root;
}

/** Share of people at this rung in this house holding each root, for reporting. */
export function rootSharesAt(
    road: HouseRoad,
    realmOrdinal: number,
    rankIndex: number
): Map<SpiritRootKey, number> {
    const rows = rootWeightsForSomebodyAt(road, realmOrdinal, rankIndex);
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    const out = new Map<SpiritRootKey, number>();
    for (const row of rows) out.set(row.root.key, total > 0 ? row.weight / total : 0);
    return out;
}
