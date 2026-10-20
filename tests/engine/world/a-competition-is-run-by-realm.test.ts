/**
 * A sect competition has a winner per realm, and a placing is a ranking.
 *
 * The design owner: *"remember those competitions are by realm too, so you can
 * have a qi condensation winner, a foundation establishment winner, and so on."*
 *
 * Which is how the genre works and also the only way a board means anything:
 * ranking a Qi Condensation disciple against a Core Formation one measures which
 * of them is further along, and everybody in the room already knew that.
 *
 * TWO DEFECTS THIS ALSO CLOSES, both measured before the change.
 *
 * A CHALLENGE PLACING WAS BOUT ORDER, not merit. `place` was
 * `placings.length + 1`, so place 3 was the winner of the second drawn bout,
 * and the fact's `beneficiaries` - which reads `place === 1` - named whoever
 * happened to be drawn first.
 *
 * AND THE SCORE WAS THE WRONG PERSON'S 18% of the time. `result.aggressor` is
 * side A of an exchange, not whoever won it, so a bout B took recorded the
 * LOSER's power as the winner's score. 30 of 167 replayed bouts, against only 5
 * genuine upsets - so the 30 were the swap, not the world.
 *
 * Calendar boards now replace random inter-house competitions on sect grounds.
 * These assertions follow the live public board; gathering challenge coverage
 * remains in gatherings.test.ts. No cultivation soak is needed to arrange realms.
 * A rebased century held no feeder transfers while ordinary intake filled every
 * opening. A patron now leaves its last novice place for the board; the winner
 * consumes that real vacancy, and a full roll still takes nobody.
 * The first selection returned the winner's consignment on the board day,
 * although its carrier stood in the capital. It now reaches the old house
 * only with a person who actually travels there.
 */

import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { realmForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { enterAnOpenCompetition, settleOpenCompetitions } from '../../../src/engine/world/entering-an-open-competition.js';
import { whoAnswersTo } from '../../../src/engine/world/what-a-house-answers-to.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { theHousesTakeInTheirOwn, vacanciesOnTheRolls } from '../../../src/engine/world/a-house-takes-in-one-of-its-own.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';

function board() {
    const state = createWorld({ seed: 'realm-boards', skipPriorAges: true, regionCount: 0 });
    const host = makeFaction({ id: 'host', name: 'House', seatLocationId: 'grounds' });
    state.factions.push(host);
    state.locations.push(makeLocation({ id: 'capital', name: 'Capital', kind: 'settlement', tags: ['city'] }));
    for (const [i, ordinal] of [1, 2, 8, 9, 14, 15].entries()) {
        const npc = { ...setRealm(createNpc(state.seed, { id: `entrant-${i}`, name: `Entrant ${i}`,
            locationId: 'capital', bornOnDay: -30 * 365, onDay: 0 }), ordinal, 0), factionId: i % 2 ? host.id : null };
        state.npcs.push(npc);
        expect(enterAnOpenCompetition(state, host, npc, 7, 0, 'capital')).not.toBeNull();
    }
    return { state, results: settleOpenCompetitions(state, 7, 7).filter(f => typeof f.data.place === 'number') };
}

describe('the live capital competition ranks by realm', () => {
    it('places every present entrant exactly once, including the unaffiliated', () => {
        const { state, results } = board();
        expect(results).toHaveLength(state.npcs.length);
        expect(new Set(results.map(f => f.actors[0]!.id)).size).toBe(state.npcs.length);
        for (const fact of results) {
            const npc = state.npcs.find(n => n.id === fact.actors[0]!.id)!;
            expect(fact.data.bracket).toBe(realmForOrdinal(npc.cultivation.realmOrdinal).key);
            expect(fact.summary).toContain(realmForOrdinal(npc.cultivation.realmOrdinal).name);
        }
    });
    it('has one winner per realm and no gaps within a board', () => {
        const { results } = board();
        const brackets = new Set(results.map(f => f.data.bracket));
        expect(brackets.size).toBeGreaterThan(1);
        expect(results.filter(f => f.data.place === 1)).toHaveLength(brackets.size);
        for (const bracket of brackets) {
            const places = results.filter(f => f.data.bracket === bracket).map(f => Number(f.data.place)).sort((a,b) => a-b);
            expect(places).toEqual(places.map((_,i) => i+1));
        }
    });
});

/** The retired gathering was the only writer that selected a disciple upward. */
function feederBoard() {
    const receiver = SECTS.find(h => h.recruits && SECTS.some(child => whoAnswersTo(h.id).includes(child.id)
        && h.powerOrdinal > child.powerOrdinal))!;
    const sender = SECTS.find(h => whoAnswersTo(receiver.id).includes(h.id)
        && receiver.powerOrdinal > h.powerOrdinal)!;
    const state = createWorld({ seed: 'feeder-board', skipPriorAges: true, regionCount: 0 });
    const capital = makeLocation({ id: 'capital', name: 'Capital', kind: 'settlement', tags: ['city'] });
    const receiving = makeLocation({ id: 'receiving-seat', name: 'Receiving Grounds', kind: 'sect_seat' });
    const sending = makeLocation({ id: 'sending-seat', name: 'Sending Grounds', kind: 'sect_seat' });
    linkLocations(capital, receiving, 'road', 3);
    linkLocations(capital, sending, 'road', 3);
    state.locations.push(capital, receiving, sending);
    const host = makeFaction({ id: receiver.id, name: receiver.name, seatLocationId: 'receiving-seat',
        ranks: ['outer', 'inner'], tags: ['recruits'], resources: { power_ordinal: receiver.powerOrdinal } });
    const home = makeFaction({ id: sender.id, name: sender.name, seatLocationId: 'sending-seat',
        ranks: ['outer', 'inner', 'senior'], resources: { power_ordinal: sender.powerOrdinal } });
    state.factions.push(host, home);
    const champion = { ...setRealm(createNpc(state.seed, { id: 'champion', name: 'Champion',
        locationId: 'capital', bornOnDay: -30 * 365, onDay: 0 }), 12, 0),
        factionId: home.id, factionRankIndex: 2, tags: ['chosen'],
        activity: { kind: 'out_with_a_party' as const, note: 'At the competition.',
            withIds: [], sinceDay: 0, untilDay: 28, fromLocationId: home.seatLocationId,
            returnTo: home.seatLocationId } };
    const rival = { ...setRealm(createNpc(state.seed, { id: 'rival', name: 'Rival',
        locationId: 'capital', bornOnDay: -30 * 365, onDay: 0 }), 0, 0),
        factionId: host.id, factionRankIndex: 1 };
    state.npcs.push(champion, rival);
    state.objects.push(makeObject({ id: 'house-consignment', name: 'Marked Bundle', kind: 'material',
        ownerId: home.id, ownerName: home.name, possessorId: champion.id,
        locationId: 'capital', tags: ['exchange'] }));
    enterAnOpenCompetition(state, host, champion, 7, 0, 'capital');
    enterAnOpenCompetition(state, host, rival, 7, 0, 'capital');
    state.currentDay = 7;
    return { state, host, home, champion };
}

describe('a capital board selects a feeder disciple', () => {
    it('writes the transfer once and carries the old house goods home before the new seat', () => {
        const { state, host, home, champion } = feederBoard();
        const settled = settleOpenCompetitions(state, 7, 7);
        const selection = settled.find(f => f.data.feederSelection === true)!;
        expect(selection).toBeTruthy();
        expect(selection.data).toMatchObject({ fromHouseId: home.id, toHouseId: host.id });
        const member = state.npcs.find(n => n.id === champion.id)!;
        expect(member.factionId).toBe(host.id);
        expect(member.factionRankIndex).toBe(0);
        expect(member.tags).not.toContain('chosen');
        expect(member.activity?.returnTo).toBe(home.seatLocationId);
        const consignment = state.objects.find(o => o.id === 'house-consignment')!;
        expect(consignment.ownerId).toBe(home.id);
        expect(consignment.possessorId).toBe(champion.id);
        expect(locationOnNpcJourney(state.locations, member, 7)).toBe('capital');
        expect(settleOpenCompetitions(state, 7, 7).filter(f => f.data.feederSelection)).toHaveLength(0);
        // Departure ended the old appointment. Cargo now follows its actual
        // newly accepted homeward leg, rather than that appointment's old term.
        advanceWorldForPlay(state, { days: member.activity!.untilDay! - state.currentDay,
            preciseDays: true, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(state.objects.find(o => o.id === 'house-consignment')!.possessorId).toBeNull();
        expect(state.objects.find(o => o.id === 'house-consignment')!.locationId).toBe(home.seatLocationId);
        expect(state.npcs.find(n => n.id === champion.id)!.activity?.returnTo).toBe(host.seatLocationId);
        const next = state.npcs.find(n => n.id === champion.id)!.activity!;
        advanceWorldForPlay(state, { days: next.untilDay! - state.currentDay,
            preciseDays: true, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(state.npcs.find(n => n.id === champion.id)!.locationId).toBe(host.seatLocationId);
    });

    it('hands the consignment to an old-house factor who is actually at the board', () => {
        const { state, host, home, champion } = feederBoard();
        const factor = { ...setRealm(createNpc(state.seed, { id: 'factor', name: 'Factor',
            locationId: 'capital', bornOnDay: -50 * 365, onDay: 0 }), 30, 0),
            factionId: home.id, factionRankIndex: 1,
            activity: { kind: 'out_with_a_party' as const, note: 'At the exchange.',
                withIds: [], sinceDay: 0, untilDay: 35,
                fromLocationId: home.seatLocationId, returnTo: home.seatLocationId } };
        state.npcs.push(factor);
        const originalPurse = state.npcs.find(n => n.id === champion.id)!.spiritStones;
        state.npcs.find(n => n.id === champion.id)!.spiritStones += 50;
        appendWorldFact(state, makeFact({ day: 5, kind: 'gathering', locationId: 'capital',
            summary: 'The first factor sold a house lot.', actors: [{ id: champion.id, name: champion.name, role: 'seller' }],
            data: { exchangeSale: true, sellerId: champion.id, houseId: home.id,
                stintDay: 0, stones: 50 } }), { recur: false });
        const selection = settleOpenCompetitions(state, 7, 7).find(f => f.data.feederSelection === true)!;
        expect(selection.actors[0]?.id).toBe(champion.id);
        expect(selection.data.cargoReturnViaHome).toBe(false);
        expect(state.objects.find(o => o.id === 'house-consignment')!.possessorId).toBe(factor.id);
        expect(state.objects.find(o => o.id === 'house-consignment')!.ownerId).toBe(home.id);
        expect(state.npcs.find(n => n.id === champion.id)!.spiritStones).toBe(originalPurse);
        expect(state.history.facts.find(f => f.data.exchangeHandover === true)?.data.stones).toBe(50);
        expect(state.npcs.find(n => n.id === champion.id)!.activity?.returnTo).toBe(host.seatLocationId);
        advanceWorldForPlay(state, { days: 28, pressure: { intensity: 0 }, stopOnInterrupt: false });
        expect(state.objects.find(o => o.id === 'house-consignment')!.possessorId).toBeNull();
        expect(state.objects.find(o => o.id === 'house-consignment')!.locationId).toBe(home.seatLocationId);
        expect(state.history.facts.find(f => f.data.exchangeReturn === true && f.data.sellerId === factor.id)?.data.stones).toBe(50);
    });

    it('keeps the patron\'s last roll opening for the feeder winner', () => {
        const { state, host, champion } = feederBoard();
        state.locations.push(makeLocation({ id: 'receiving-quarters', name: 'The Quarters', kind: 'hall',
            parentId: host.seatLocationId, data: { factionId: host.id, purpose: 'dormitory', capacity: 100 } }));
        const openings = vacanciesOnTheRolls(state, 7).get(host.id)!;
        expect(openings).toBeGreaterThan(1);
        for (let i = 1; i < openings; i++) {
            state.npcs.push({ ...setRealm(createNpc(state.seed, { id: `host-member-${i}`,
                locationId: host.seatLocationId, bornOnDay: -45 * 365, onDay: 7 }), 30, 7),
                factionId: host.id, factionRankIndex: 0 });
        }
        expect(vacanciesOnTheRolls(state, 7).get(host.id)).toBe(1);
        expect(theHousesTakeInTheirOwn(state, 0, 7)).toBe(0);
        expect(settleOpenCompetitions(state, 7, 7).some(f => f.data.feederSelection === true
            && f.actors.some(a => a.id === champion.id))).toBe(true);
        expect(vacanciesOnTheRolls(state, 7).get(host.id)).toBe(0);
    });

    it('leaves a post, an unopposed board, and a weaker receiver without a feeder transfer', () => {
        for (const reason of ['posted', 'unopposed', 'weaker', 'full'] as const) {
            const { state, host, champion } = feederBoard();
            if (reason === 'posted') state.npcs[0]!.activity = {
                kind: 'stationed', note: 'At the counter.', withIds: [], sinceDay: 0,
                untilDay: 90, returnTo: 'sending-seat' };
            if (reason === 'unopposed') {
                state.npcs[1]!.locationId = 'receiving-seat';
            }
            if (reason === 'weaker') host.resources.power_ordinal = 0;
            if (reason === 'full') host.tags = [];
            expect(settleOpenCompetitions(state, 7, 7).filter(f => f.data.feederSelection), reason).toHaveLength(0);
            expect(state.npcs.find(n => n.id === champion.id)!.factionId).toBe(champion.factionId);
        }
    });
});
