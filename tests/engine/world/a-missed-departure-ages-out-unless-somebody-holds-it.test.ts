/**
 * The owner amended missed departures to routine information: the person can
 * discuss the event for a year, then the yearly sweep removes it unless an
 * actual obligation or grievance still holds its evidence. A living witness
 * or the player's ordinary career list alone is not that hold. A settled
 * grievance stops holding this routine event; consequential evidence keeps
 * the existing retention rules.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { createObligation, settleObligation } from '../../../src/engine/social/grudges.js';
import { witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';

function missed(player = false) {
    const state = createWorld({ seed: 'routine-missed-departure', regionCount: 0, skipPriorAges: true });
    state.currentDay = 0; state.currentHour = 0;
    const person = createNpc(state.seed, { id: 'holder', bornOnDay: -7300, onDay: 0,
        tags: player ? [PLAYER_ROW_TAG] : [] });
    state.npcs.push(person);
    const fact = appendWorldFact(state, makeFact({ day: 0, kind: 'object_destroyed',
        visibility: 'secret', summary: 'The passage tally for Reed Station to Stone Station went to dust.',
        actors: [{ id: person.id, name: person.name, role: 'missed passenger' }], witnessIds: [person.id],
        data: { missedDeparture: true, madeTokenDust: true, tokenId: 'unused-tally',
            service: 'carriage', vesselId: 'carriage', fromLocationId: 'reed', toLocationId: 'stone',
            departureDay: 0, leftOnDay: 0, fareStones: 3, costStones: 3, carriedById: person.id } }),
        { bystanders: false, recur: false });
    return { state, person, fact };
}

describe('a missed departure is routine knowledge for a year', () => {
    it('an unused extra seat also ages out when its holder did take the trip', () => {
        const h = missed(true);
        h.fact.data.unusedPassageTally = true;
        h.fact.data.missedDeparture = false;
        h.fact.actors[0]!.role = 'unused tally holder';
        h.state.currentDay = 365;
        keepTheBusinessStillOnTheBooks(h.state);
        expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(false);
        expect(h.state.npcs[0]!.historyFactIds).not.toContain(h.fact.id);
    });
    for (const player of [false, true]) {
        it(player ? 'lets the player account age out without a real hold' : 'lets a living world person forget it', () => {
            const h = missed(player);
            h.state.currentDay = 364;
            keepTheBusinessStillOnTheBooks(h.state);
            expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(true);
            h.state.currentDay = 365;
            keepTheBusinessStillOnTheBooks(h.state);
            expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(false);
            expect(h.state.npcs[0]!.historyFactIds).not.toContain(h.fact.id);
        });
    }

    it('keeps it while an actual grievance still holds the event', () => {
        const h = missed(true);
        h.state.obligations.push(createObligation({ kind: 'grudge', holderId: h.person.id,
            subjectId: 'the-one-who-delayed-them', cause: 'broken_oath', severity: 'slight',
            onDay: 0, triggeringEventId: h.fact.id, description: 'They broke their promised escort to the departure.' }));
        h.state.currentDay = 365;
        keepTheBusinessStillOnTheBooks(h.state);
        expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(true);
    });

    it('lets it go on the next yearly sweep after the grievance is settled', () => {
        const h = missed(true);
        const grudge = createObligation({ kind: 'grudge', holderId: h.person.id,
            subjectId: 'the-one-who-delayed-them', cause: 'broken_oath', severity: 'slight',
            onDay: 0, triggeringEventId: h.fact.id, description: 'They broke their promised escort to the departure.' });
        h.state.obligations.push(grudge);
        h.state.currentDay = 365;
        keepTheBusinessStillOnTheBooks(h.state);
        expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(true);
        h.state.obligations[0] = settleObligation(grudge, { onDay: 366,
            resolution: 'repaid', byId: grudge.subjectId!, note: 'The lost fare was repaid.' });
        h.state.currentDay = 730;
        keepTheBusinessStillOnTheBooks(h.state);
        expect(witnessIndexFor(h.state).byId.has(h.fact.id)).toBe(false);
    });
});
