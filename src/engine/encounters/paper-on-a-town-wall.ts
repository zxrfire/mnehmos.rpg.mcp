/**
 * Contracts, as paper on the wall of the place somebody is standing in.
 *
 * A contract goes up wherever its row says paper for it goes up, and anybody
 * standing there may take it down: a rogue for the money, a disciple on their
 * own time. It is priced by `dutyTermsAtAMonthlyRate` and served through the one
 * duty lifecycle every board line uses, so there is no second way to be paid.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type { Settlement } from '../../data/cultivation/mortal-world.js';
import { CONTRACTS, getContract, type Contract } from '../../data/cultivation/rogues.js';
import { MAX_ORDINAL, clampOrdinal } from '../cultivation/realms.js';
import { aTaskAsPosted } from './how-a-task-is-worded.js';

/** The contracts up on a wall in a place of this kind. None off a settlement. */
export function contractsPostedAt(settlementKind: Settlement['kind'] | null | undefined): readonly Contract[] {
    if (!settlementKind) return [];
    return CONTRACTS.filter(contract => contract.settlements.includes(settlementKind));
}

/**
 * A contract as a line on the wall, pitched at its own rung. Its id is the
 * contract's, so the same paper in two towns is the same paper, and a term
 * broken off in one is taken up again in the other. Worded with the town the
 * wall is in, where the caller knows it.
 */
export function aContractAsAnOffer(contract: Contract, placeName: string | null = null): EncounterEntry {
    return {
        id: contract.id,
        name: aTaskAsPosted(contract.task, { place: placeName }, contract.days),
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 1,
        minOrdinal: 0,
        maxOrdinal: MAX_ORDINAL,
        interrupts: false,
        threatOrdinal: clampOrdinal(contract.minOrdinal),
        summaryTemplate: contract.note,
        tokens: [],
        tags: ['contract']
    };
}

/** The contract a board line was made from, or null. */
export function theContractBehind(entryId: string): Contract | null {
    return getContract(entryId) ?? null;
}
