/** A private hire spends the contractor's days. The member's word stays with the house. */
import { createObligation, settleObligation } from '../social/grudges.js';
import type { WorldState } from './world-state.js';

/** Close private hires when the work ends or the contractor ceases doing it. */
export function settleHiredDuties(state: WorldState, day: number): void {
    for (let at = 0; at < state.obligations.length; at++) {
        const term = state.obligations[at]!;
        if (term.status !== 'open' || !term.tags.includes('hired-duty')) continue;
        const workerAt = state.npcs.findIndex(n => n.id === term.holderId);
        const worker = state.npcs[workerAt];
        const doing = worker?.activity;
        const place = term.tags.find(t => t.startsWith('post-at:'))?.slice('post-at:'.length);
        const working = worker?.status === 'alive' && worker.locationId === place
            && doing?.kind === 'stationed'
            && doing.sinceDay === term.incurredOnDay && doing.untilDay === term.dueOnDay;
        if (working && day < (term.dueOnDay ?? Infinity)) continue;
        state.obligations[at] = settleObligation(term, {
            resolution: working ? 'oath_fulfilled' : 'broken', onDay: day,
            byId: term.holderId,
            note: working ? 'The hired term was served.' : 'The contractor ceased serving the hired term.'
        });
        if (!working && term.subjectId !== null) state.obligations.push(createObligation({
            kind: 'grudge', holderId: term.subjectId, subjectId: term.holderId,
            cause: 'broken_oath', severity: term.severity, onDay: day,
            description: 'The paid contractor did not serve the hired term.', tags: ['hired-duty-failed', term.id]
        }));
        if (worker && doing?.sinceDay === term.incurredOnDay
            && doing.untilDay === term.dueOnDay) {
            state.npcs[workerAt] = { ...worker, activity: null };
        }
    }
}
