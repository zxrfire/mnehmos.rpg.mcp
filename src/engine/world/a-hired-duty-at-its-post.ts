/** A hired duty is served by its actual holder at the agreed post for the agreed term. */
import type { ObligationRecord } from '../social/grudges.js';
import type { NpcRecord } from './npc-state.js';

export function heldThisHiredPost(worker: NpcRecord | undefined, term: ObligationRecord): boolean {
    const doing = worker?.activity;
    const place = term.tags.find(tag => tag.startsWith('post-at:'))?.slice('post-at:'.length);
    return term.tags.includes('hired-duty') && worker?.id === term.holderId
        && worker.locationId === place && doing?.kind === 'stationed'
        && doing.sinceDay === term.incurredOnDay && doing.untilDay === term.dueOnDay;
}

/** Current work also requires the person to be alive; past checks retain their real dates. */
export function servesThisHiredDuty(worker: NpcRecord | undefined, term: ObligationRecord): boolean {
    return worker?.status === 'alive' && heldThisHiredPost(worker, term);
}
