/**
 * The things in the world that are not books.
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
import { forStream } from '../cultivation/rng.js';
import { ARTIFACTS } from '../../data/cultivation/artifacts.js';

/**
 * Put the artifact catalog into the world.
 *
 * The rows already say who owns and who holds each one, and those ids are the
 * catalog's own - so anything naming a party this world does not contain is
 * left where the catalog put it rather than being reassigned to somebody
 * convenient. A weapon whose holder is a figure above the Lid stays with them,
 * which is the correct answer and not a gap: `NOTHING_AT_FORTY_SIX_IS_EVER_LEFT`
 * is a rule about the world, and quietly handing those three rows to a sect
 * because their owner is unreachable would break it.
 */
export function seedArtifacts(state: WorldState): ObjectRecord[] {
    const factions = new Set(state.factions.map(f => f.id));
    const seats = new Map(state.factions.map(f => [f.id, f.seatLocationId]));
    const out: ObjectRecord[] = [];

    for (const row of ARTIFACTS) {
        // Seat it where its owner sits, when the owner is a house this world
        // has. Everything else keeps whatever the catalog said.
        const locationId = row.ownerId && factions.has(row.ownerId)
            ? seats.get(row.ownerId) ?? row.locationId
            : row.locationId;
        out.push({ ...row, locationId, tags: [...row.tags, 'seeded'] });
    }
    return out;
}

/** How a comprehension material came to exist, which decides whether more can. */
export type MaterialSource = 'made_above' | 'found_below';

export interface ComprehensionMaterial {
    id: string;
    name: string;
    /** The height it is any use to. Below it the reader takes nothing from it. */
    forOrdinal: number;
    source: MaterialSource;
}

/**
 * What a material is worth is what it lets somebody understand, so it is priced
 * on the ladder like everything else.
 *
 * Deliberately sparse at the top. There should be a small number of these in
 * the world at the heights that matter, because their scarcity IS the reason
 * the upper ladder is thin - and a generous table here would quietly undo the
 * production ceiling it exists to explain.
 */
const MATERIAL_BANDS: readonly { forOrdinal: number; inTheWorld: number; name: string }[] = [
    { forOrdinal: 16, inTheWorld: 14, name: 'a clouded resonance stone' },
    { forOrdinal: 20, inTheWorld: 9, name: 'a settled-heart lamp' },
    { forOrdinal: 24, inTheWorld: 6, name: 'a nascent echo' },
    { forOrdinal: 28, inTheWorld: 4, name: 'a transformation seed' },
    { forOrdinal: 32, inTheWorld: 3, name: 'a void-tempered mote' },
    { forOrdinal: 36, inTheWorld: 2, name: 'an integration relic' },
    { forOrdinal: 40, inTheWorld: 1, name: 'an ascension fragment' }
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
                power: band.forOrdinal,
                description: source === 'made_above'
                    ? `Made above the Lid and sent down. Understanding it carries somebody to ordinal `
                      + `${band.forOrdinal}, once, after which there is one fewer in the world.`
                    : `Out of a hole, made in an age that could make them and by nobody since. `
                      + `Understanding it carries somebody to ordinal ${band.forOrdinal}, once.`,
                possessorId: holder?.id ?? null,
                ownerId: holder?.id ?? null,
                ownerName: holder?.name ?? '',
                locationId: site?.id ?? (holder ? holder.seatLocationId : null),
                tags: ['comprehension', 'single-use', source,
                    ...(site ? ['unrecovered'] : [])],
                data: { forOrdinal: band.forOrdinal, source, spent: false }
            }));
        }
    }
    return out;
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
