/**
 * Comprehension materials: the objects that are spent by being understood.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `scripts/audit-alive-world.ts` tests the claim that the world should be
 * physicalised - "items, manuals (for both cultivation techniques and daos),
 * all that should exist to make the world feel alive" - and it was the one
 * claim of five that did not hold:
 *
 *     objects in the world: 47
 *     by kind: manual 47
 *     DOES NOT HOLD - only manual exists
 *
 * `artifacts.ts` has held a complete table of every artifact in the world for a
 * long time - already `ObjectRecord` rows, already ordered by `power` on the
 * same ladder a person stands on, already carrying their owners and holders -
 * and the seeder never put a single one into the world. The immortal weapon a
 * sect's whole standing rests on existed in a catalog nothing read.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPREHENSION MATERIALS, AND WHY THEY ARE SPENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The second half is a kind of object that did not exist at all, and it is the
 * missing piece of the production ceiling. A house standing at 36 that can only
 * produce 28 is not failing to teach: it has the books and it has the master.
 * What it cannot get is the materials, and the sharpest of those are
 *
 *     SINGLE USE. ONCE IT GOES INTO YOUR HEAD, IT IS GONE.
 *
 * They are consumed by being understood, which is what separates them from
 * every other object in the game. A sword can be inherited for nine hundred
 * years; a comprehension material is used exactly once by exactly one person and
 * then there is one fewer in the world, forever. Nobody can lend one, nobody
 * can share one, and a house that spends one on the wrong disciple has spent it.
 *
 * They come from two places and the difference matters:
 *
 *   MADE ABOVE     an immortal made it and sent it down. Modern, and the
 *                  supply depends entirely on somebody up there still caring -
 *                  which is why a house with a recent ascendant is in a
 *                  completely different position from one whose ancestor
 *                  crossed nine centuries ago.
 *   FOUND BELOW    dug out of a ruin, made in an age that could make them and
 *                  by nobody since. Finite by definition and not replaceable at
 *                  any price, because the price is not the problem.
 *
 * That is the whole reason a house's ceiling can move in a single generation
 * when its access changes, and the reason expeditions are worth dying on.
 */

import type { WorldState } from './world-state.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { DaoGroundDomain } from '../../data/cultivation/places-that-teach-a-dao.js';

/** How a comprehension material came to exist, which decides whether more can. */
export type MaterialSource = 'made_above' | 'found_below';

export interface ComprehensionMaterial {
    id: string;
    name: string;
    /** The height it is any use to. Below it the reader takes nothing from it. */
    forOrdinal: number;
    source: MaterialSource;
    /** The road understanding it opens. See WHAT A MATERIAL ACTUALLY GIVES. */
    domain: DaoGroundDomain;
}

/**
 * What a material is worth is what it lets somebody understand, so it is priced
 * on the ladder like everything else.
 *
 * Deliberately sparse at the top. There should be a small number of these in
 * the world at the heights that matter, because their scarcity IS the reason
 * the upper ladder is thin - and a generous table here would quietly undo the
 * production ceiling it exists to explain.
 *
 * Exported so the standing register can report how many of these the world
 * starts with rather than restating the figures beside them. Nothing outside
 * this module may seed from it; the seeder is {@link seedComprehensionMaterials}.
 *
 * ── WHAT A MATERIAL ACTUALLY GIVES ───────────────────────────────────────
 *
 * A ROAD. One `InsightDomain` besides the reader's own, which is the currency
 * the dao gate in `breakthrough.ts` is denominated in, and which nothing in the
 * world could supply to an NPC before these carried a domain.
 *
 * The band a material sits in decides which road, and the pairing is read off
 * the realm the band is named for rather than assigned: the Body Integration
 * band teaches the body, the Tribulation band teaches the void, the commonest
 * and lowest band teaches ALCHEMY - which is the one road no technique in the
 * catalog teaches at all, and therefore the one a cultivator's practice can
 * never supply. That the world's most numerous single-use object is the only
 * source of its scarcest road is the reason houses hoard the cheap ones.
 *
 * `weapon` has no material and that is deliberate rather than an omission: it
 * is the best-supplied road in the world - three grounds and an armful of arts
 * teach it - and a material for it would be the one nobody needed.
 *
 * The domain does NOT vary by instance. Two settled-heart lamps are the same
 * object, and a house that holds one holds a known thing rather than a lottery
 * ticket, which is what makes `whyNotSold` below a decision instead of a guess.
 */
export const MATERIAL_BANDS: readonly {
    forOrdinal: number;
    inTheWorld: number;
    name: string;
    domain: DaoGroundDomain;
}[] = [
    { forOrdinal: 16, inTheWorld: 14, name: 'a banked cinder', domain: 'alchemy' },
    { forOrdinal: 20, inTheWorld: 9, name: 'a clouded resonance stone', domain: 'formation' },
    { forOrdinal: 24, inTheWorld: 6, name: 'a settled-heart lamp', domain: 'karma' },
    { forOrdinal: 28, inTheWorld: 4, name: 'a nascent echo', domain: 'life_death' },
    { forOrdinal: 32, inTheWorld: 3, name: 'an integration relic', domain: 'body' },
    { forOrdinal: 36, inTheWorld: 2, name: 'a held hour', domain: 'time' },
    { forOrdinal: 40, inTheWorld: 1, name: 'a void-tempered mote', domain: 'void' }
];

/**
 * Scatter the comprehension materials.
 *
 * Held by houses that could plausibly have got hold of one, which means the
 * ones whose reliable production is already near the material's band - a house
 * that cannot make a 28 has no route to the thing that makes a 32, and that
 * asymmetry is the point rather than an unfairness to be smoothed out. It is
 * also self-reinforcing in exactly the way the setting claims: access buys
 * height, height buys access, and the houses without either stay where they are
 * until somebody digs something up.
 *
 * A few are left unheld, sitting in ruins. Those are the ones worth an
 * expedition.
 */
export function seedComprehensionMaterials(state: WorldState): ObjectRecord[] {
    const rng = forStream(state.seed, 'comprehension-materials');
    const houses = state.factions.filter(f => f.dissolvedOnDay === null);
    const ruins = state.locations.filter(l => l.kind === 'ruin');
    const out: ObjectRecord[] = [];

    for (const band of MATERIAL_BANDS) {
        // Who could have got one: a house already working near this height.
        const plausible = houses.filter(f =>
            Number(f.resources.reliable_ordinal ?? f.resources.power_ordinal ?? 0) >= band.forOrdinal - 8
        );
        for (let i = 0; i < band.inTheWorld; i++) {
            const inARuin = ruins.length > 0 && rng.chance(0.3);
            const holder = !inARuin && plausible.length > 0
                ? plausible[rng.int(0, plausible.length - 1)]
                : null;
            const site = inARuin ? ruins[rng.int(0, ruins.length - 1)] : null;
            const source: MaterialSource = rng.chance(0.35) ? 'made_above' : 'found_below';

            out.push(makeObject({
                id: `material-${band.forOrdinal}-${i}`,
                name: band.name,
                kind: 'material',
                // Never mundane. Provenance is only kept above that band, and
                // where a single-use object came from is most of what it is.
                significance: band.forOrdinal >= 32 ? 'legendary'
                    : band.forOrdinal >= 24 ? 'significant' : 'notable',
                // ── NULL. THE RUNG IS `data.forOrdinal`, NOT `power` ────────
                //
                // `power` is what a thing contributes to force, and a material
                // contributes none: it is understood once, in a vault, by
                // somebody sitting still. The owner's ruling is that only
                // weapons and spirit boats have any, and that these "should
                // probably be worth nothing in a fight" - which is also why
                // they are typically left as spoils rather than carried into
                // one. `band.forOrdinal` is the rung it is PITCHED at, a
                // different quantity entirely, and it is already written onto
                // `data` below where every reader of it looks.
                power: null,
                description: source === 'made_above'
                    ? `Made above the Lid and sent down. Understanding it opens the road of `
                      + `${band.domain.replace(/_/g, ' and ')} to somebody standing at ordinal `
                      + `${band.forOrdinal}, once, after which there is one fewer in the world.`
                    : `Out of a hole, made in an age that could make them and by nobody since. `
                      + `Understanding it opens the road of ${band.domain.replace(/_/g, ' and ')} `
                      + `to somebody standing at ordinal ${band.forOrdinal}, once.`,
                possessorId: holder?.id ?? null,
                ownerId: holder?.id ?? null,
                ownerName: holder?.name ?? '',
                locationId: site?.id ?? (holder ? holder.seatLocationId : null),
                tags: ['comprehension', 'single-use', source, `road:${band.domain}`,
                    ...(site ? ['unrecovered'] : [])],
                data: {
                    forOrdinal: band.forOrdinal, source, spent: false,
                    // THE ROAD, on the row. Read by `how-a-cultivator-comes-by-a-road.ts`
                    // off the spent object rather than off the band table, so a
                    // material dug out of a ruin two centuries from now still
                    // says what it teaches without anybody having to look it up.
                    domain: band.domain,
                    whyNotSold: holder ? whyNotSold(state, holder.id, band.forOrdinal, rng) : null
                }
            }));
        }
    }
    return out;
}

/**
 * Why a house sits on something nobody in it can use.
 *
 * The obvious move is to sell it. A material calibrated to a height your best
 * disciple will never see is dead capital, somebody two provinces over would
 * pay enormously, and yet houses hold these for centuries. The reasons are not
 * sentiment, and each one produces a different institution:
 *
 *   AFRAID_TO_SELL   Putting it on a market announces that you have it, and
 *                    announces the day it leaves your walls with a small escort.
 *                    A house that cannot defend a sale cannot make one, and a
 *                    weak house holding a valuable thing is not rich, it is
 *                    quiet. The fear is specific: not of being robbed, but of
 *                    the bloodbath that starts when three parties who all want
 *                    it learn about each other.
 *   RAINY_DAY        Held deliberately against a future they can name - a
 *                    succession, a war they expect, a disciple who is eleven.
 *                    This house has a plan and the material is in it.
 *   TRIBUTE          Owed upward. A subsidiary holding something its backer
 *                    would want does not own it in any sense that matters; it
 *                    is holding it until asked, and the asking is a matter of
 *                    time. See the feeder relationship in `docs/world/houses/sects.md`.
 *   A_FAVOUR_OWED    The most interesting one. Given to somebody far stronger,
 *                    a material buys not money but an obligation - and an
 *                    obligation from somebody at a height your house cannot
 *                    reach is worth more than any price, exactly once. Houses
 *                    hold these waiting for the right person to need one.
 *
 * A holder that could actually USE the thing has no reason here and carries
 * none: the field is only meaningful where the object is beyond its holder.
 */
export type WhyNotSold = 'afraid_to_sell' | 'rainy_day' | 'tribute' | 'a_favour_owed';

/**
 * Which reason a house holds an unusable material for.
 *
 * Read off the house rather than rolled freely, so the answer is a fact about
 * the institution and stays the same whenever anybody asks. A house that owes
 * tribute upward is holding it for its backer; a house too weak to defend a
 * sale is afraid of one; the rest are the houses with room to be strategic.
 */
export function whyNotSold(
    state: WorldState,
    holderId: string,
    forOrdinal: number,
    rng: CultivationRNG
): WhyNotSold | null {
    const house = state.factions.find(f => f.id === holderId);
    if (!house) return null;
    const reach = Number(house.resources.reliable_ordinal ?? house.resources.power_ordinal ?? 0);
    // They can use it. Nothing to explain.
    if (reach >= forOrdinal) return null;

    if (house.tags.includes('subsidiary') || Number(house.resources.tribute_per_year ?? 0) > 0) {
        return 'tribute';
    }
    // A house whose own strongest member is far below the thing it is holding
    // cannot protect a sale, and knows it.
    if (Number(house.resources.power_ordinal ?? 0) + 8 < forOrdinal) return 'afraid_to_sell';
    return rng.chance(0.5) ? 'rainy_day' : 'a_favour_owed';
}

/** A comprehension material that has not yet been understood by anybody. */
export function isUnspent(object: ObjectRecord): boolean {
    return object.kind === 'material'
        && object.tags.includes('single-use')
        && object.data?.spent !== true;
}

/**
 * Understanding one, which is the only thing you can do with it.
 *
 * There is no partial use and no returning it. The object stays in the world as
 * a spent row rather than being deleted, because the fact that this house once
 * held one and used it on that person is exactly the kind of thing somebody
 * should be able to find out two centuries later.
 */
export function spend(object: ObjectRecord, byId: string, onDay: number): ObjectRecord {
    return {
        ...object,
        possessorId: null,
        tags: [...object.tags.filter(t => t !== 'unrecovered'), 'spent'],
        data: { ...object.data, spent: true, spentBy: byId, spentOnDay: onDay }
    };
}

/**
 * How high the materials somebody can actually reach will carry them.
 *
 * Zero when they can reach none, and zero is not a rounding of "a little" - it
 * is the state of most cultivators in the world, and it is why the upper ladder
 * is thin regardless of how good anybody's book is.
 */
export function materialCeilingFor(
    state: WorldState,
    factionId: string | null
): number {
    if (!factionId) return 0;
    let best = 0;
    for (const o of state.objects) {
        if (!isUnspent(o) || o.ownerId !== factionId) continue;
        best = Math.max(best, Number(o.data?.forOrdinal ?? 0));
    }
    return best;
}
