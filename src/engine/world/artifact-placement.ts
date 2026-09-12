/**
 * Putting the artifact catalog into the world.
 *
 * `artifacts.ts` has been a complete table of `ObjectRecord` rows since it was
 * written - every artifact in the world, ordered by `power` on the same ladder a
 * person stands on, each carrying its own owner and holder - and the seeder
 * never placed a single one. The immortal weapon a house's entire standing
 * rests on existed in a catalog nothing read.
 *
 * This file does one thing: it takes those rows and seats them.
 *
 * -- EXCEPT THE ROWS THAT ARE KINDS ---------------------------------------
 *
 * Three rows at the bottom of the catalog are not one object. A notched sabre,
 * a wanderer's bell and the Severed's cutting knife each stand in for several
 * hundred of the thing, which their own descriptions say and which
 * `significance: 'mundane'` records - `possessions.ts` documents that value as
 * the marker for a thing that gets no provenance at all.
 *
 * Seating one of those minted a row with no owner, no holder and no location,
 * which every filter in `queryObjects` misses and which nothing in the world
 * has ever read. That is `docs/world/things/items.md`'s counted thing wearing
 * an id: ledger rubble that costs storage and answers no question. The catalog
 * keeps all of them, because the ordering top to bottom is the argument; the
 * world seats the individuals.
 *
 * -- AND A HOLDER IS A PERSON, UNDER THE ID THE WORLD KNOWS THEM BY --------
 *
 * A catalog row names its holder with the catalog's own id for them, and the
 * seeder instantiates a catalog person as `npc-` plus that id
 * (`a-catalog-person-and-their-world-row.ts`). Until those two were joined,
 * every artifact a PERSON holds was seated under a key no world row answers to,
 * and `bestObjectHeldBy` in `gatherings.ts` - which compares `possessorId`
 * against `npc.id` - returned null for everybody in the world. Measured at
 * seeding, identical across seeds: of eighteen rated objects, zero were
 * possessed by an `NpcRecord`, so the weapon slot in every fight the world
 * simulation runs was empty and always had been.
 *
 * Which holders are people is the catalog's statement, not this file's. What
 * this does is translate the ones that are, and leave everything else exactly
 * where the catalog put it - so a house's vault stays a vault, an object lying
 * in a ruin stays there, and the three rows held above the Lid keep a possessor
 * nobody down here can reach, which is what
 * `NOTHING_AT_FORTY_SIX_IS_EVER_LEFT` requires. Those three are named in
 * `named-figures.ts` rather than on anybody's roll, so they are not catalog
 * people by this test and the rule excludes them without naming them.
 */

import type { WorldState } from './world-state.js';
import type { ObjectRecord } from './possessions.js';
import { ARTIFACTS } from '../../data/cultivation/artifacts.js';
import { isCatalogPerson, worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import { idsForFaction } from '../../data/cultivation/governance-and-water-rights.js';

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
 *
 * A holder the world DOES contain is translated to the id it contains them
 * under. See the banner: that is a join, and the only one here.
 */
export function seedArtifacts(state: WorldState): ObjectRecord[] {
    const factions = new Set(state.factions.map(f => f.id));
    const seats = new Map(state.factions.map(f => [f.id, f.seatLocationId]));

    /**
     * The id this world files a body under, which is not always the id the
     * catalog names it by.
     *
     * A body with a row in `APEX_INSTITUTIONS` and a row in `SECTS` has two
     * ids, and `seedFactions` mints the faction under the sect one. Artifacts
     * owned by the two ancient apexes are entered against the apex id, so
     * without this join their treasuries resolved to no faction at all - the
     * Polestar Lamp sat in a vault the world did not believe anybody held,
     * outside the house-stores exclusion `war-melee.ts` reads and outside the
     * hold bucket. Same join as the person one below, one table over.
     */
    const asTheWorldFilesIt = (id: string): string => {
        if (factions.has(id)) return id;
        return idsForFaction(id).find(alias => factions.has(alias)) ?? id;
    };

    const out: ObjectRecord[] = [];

    for (const row of ARTIFACTS) {
        // A kind, not an object. See the banner.
        if (row.significance === 'mundane') continue;
        const ownerId = row.ownerId ? asTheWorldFilesIt(row.ownerId) : row.ownerId;
        // Seat it where its owner sits, when the owner is a house this world
        // has. Everything else keeps whatever the catalog said.
        const locationId = ownerId && factions.has(ownerId)
            ? seats.get(ownerId) ?? row.locationId
            : row.locationId;
        // Ownership is not touched. Holding a thing and owning it are two
        // facts (`docs/world/things/items.md`), and only the holder is a body
        // that has to be findable in `state.npcs`.
        const possessorId = row.possessorId === null
            ? null
            : isCatalogPerson(row.possessorId)
                ? worldIdForCatalogPerson(row.possessorId)
                : asTheWorldFilesIt(row.possessorId);
        out.push({ ...row, ownerId, possessorId, locationId, tags: [...row.tags, 'seeded'] });
    }
    return out;
}

