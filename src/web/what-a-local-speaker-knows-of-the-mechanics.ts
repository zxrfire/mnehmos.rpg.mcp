/** Local accounts of a tradition war and the terms of a beast contract. */

import { BEAST_CHANGE_ORDINAL, THE_CONTRACT } from '../data/cultivation/beasts.js';
import { TRADITION_WAR } from '../data/cultivation/traditions.js';
import { WORKING_KNOWLEDGE_MARGIN } from './hearsay.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ResolvedEntity } from './entities.js';
import { worldLocationFor } from './entities.js';
import { regionIdOfPlace } from '../data/cultivation/regions.js';
import { regionOf } from '../engine/world/what-people-are-saying.js';
import type { WorldState } from '../engine/world/world-state.js';

/** These are things a speaker can be asked about, never outcomes of an agreement. */
export function aLocalMechanicsQuestion(
    topic: string,
    speaker: RosterEntry,
    world: WorldState | null
): ResolvedEntity | null {
    if (/\bbeast\s+contracts?\b/i.test(topic)) {
        return {
            kind: 'lore', id: 'beast-contract', name: 'a beast contract',
            facts: [THE_CONTRACT.witnessing, ...THE_CONTRACT.whatTheBeastWants,
                ...THE_CONTRACT.whatTheCultivatorGives],
            structure: [`The subject starts at ordinal ${BEAST_CHANGE_ORDINAL}.`]
        };
    }
    if (!/\b(?:tradition war|war between (?:the )?(?:two )?traditions)\b/i.test(topic)) return null;
    const province = world ? regionOf(world, worldLocationFor(world, speaker.location ?? null)?.id ?? null) : null;
    const regionId = world
        ? world.locations.find(row => row.id === province)?.data.catalogRegionId ?? null
        : regionIdOfPlace(speaker.location ?? null) ?? null;
    const account = regionId === 'region-low-fall' ? TRADITION_WAR.lowFallAccount
        : regionId === 'region-quiet-marches' ? TRADITION_WAR.marchesAccount
        : speaker.realmOrdinal + WORKING_KNOWLEDGE_MARGIN >= BEAST_CHANGE_ORDINAL
            ? TRADITION_WAR.whatTheGeographyRecords : null;
    if (account === null) return null;
    return {
        kind: 'lore', id: 'tradition-war', name: 'the war between the traditions',
        facts: [account],
        structure: ['A regional account, told by this speaker; the unpublished treaty is withheld.']
    };
}
