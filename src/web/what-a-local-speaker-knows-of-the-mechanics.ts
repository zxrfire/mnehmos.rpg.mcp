/** Local accounts, public work rates and the terms of a beast contract. */

import { BEAST_CHANGE_ORDINAL, THE_CONTRACT } from '../data/cultivation/beasts.js';
import { TRADITION_WAR } from '../data/cultivation/traditions.js';
import { monthsOfWorkToAfford } from '../data/cultivation/cultivators-the-road-finished.js';
import { PRICES } from '../data/cultivation/mortal-world.js';
import { whatACultivatorCanEarnAt } from '../data/cultivation/what-a-cultivator-can-earn.js';
import { arterialsOf, provinceForRegion } from '../data/cultivation/regions/provinces.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import { theWeakerOf, told, inferred } from '../engine/social/how-an-answer-is-known.js';
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
    const question = topic.toLowerCase();
    if (/\b(?:afford|months? of work|earnings|wages)\b/i.test(topic)) {
        const price = PRICES.find(row => question.includes(row.name.toLowerCase()));
        const term = whatACultivatorCanEarnAt(speaker.realmOrdinal).find(row =>
            row.paidAs !== 'a mission' && question.includes(row.name.toLowerCase()));
        if (price && term) {
            const months = monthsOfWorkToAfford(price.id, term.id);
            if (months !== undefined) {
                const cost = told(price.cash, `Price quoted by ${speaker.name}.`);
                const pay = told(term.cashPerMonth, `Pay quoted by ${speaker.name}.`);
                const calculation = inferred(months, 'Price divided by gross monthly pay.');
                return {
                    kind: 'lore', id: `earnings:${price.id}:${term.id}`, name: price.name,
                    facts: [`${price.name} costs ${cost.value} cash. ${term.name} pays `
                        + `${pay.value} cash per month. Buying it takes ${calculation.value} `
                        + 'months of gross earnings, before food and lodging.'],
                    structure: [`Known by being ${theWeakerOf(calculation.known,
                        theWeakerOf(cost.known, pay.known))}: ${cost.because} ${pay.because}`]
                };
            }
        }
    }
    if (/\bbeast\s+contracts?\b/i.test(topic)) {
        return {
            kind: 'lore', id: 'beast-contract', name: 'a beast contract',
            facts: [THE_CONTRACT.witnessing, ...THE_CONTRACT.whatTheBeastWants,
                ...THE_CONTRACT.whatTheCultivatorGives],
            structure: [`The subject starts at ordinal ${BEAST_CHANGE_ORDINAL}.`]
        };
    }
    const province = world ? regionOf(world, worldLocationFor(world, speaker.location ?? null)?.id ?? null) : null;
    const regionId = world
        ? world.locations.find(row => row.id === province)?.data.catalogRegionId ?? null
        : regionIdOfPlace(speaker.location ?? null) ?? null;
    if (/\b(?:arterials?|arterial system)\b/i.test(topic)) {
        const local = typeof regionId === 'string' ? provinceForRegion(regionId) : undefined;
        if (!local || speaker.realmOrdinal + WORKING_KNOWLEDGE_MARGIN < FOUNDATION_ORDINAL) return null;
        const arteries = arterialsOf(local.id);
        if (arteries.length === 0) return null;
        return {
            kind: 'lore', id: `arterials:${local.id}`, name: `${local.name}'s arterials`,
            facts: arteries.map(row => `${row.name} is an arterial under ${local.name}.`),
            structure: ['The local survey names, supplied by this speaker.']
        };
    }
    if (!/\b(?:tradition war|war between (?:the )?(?:two )?traditions)\b/i.test(topic)) return null;
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
