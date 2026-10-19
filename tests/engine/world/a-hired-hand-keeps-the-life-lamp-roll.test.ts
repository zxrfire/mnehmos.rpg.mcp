/** A member can pay a person off the roll to serve their hall duty. The real
 * hand counts as staff and makes the same daily check; leaving or dying cannot
 * erase what their completed checks already told the house. No day is ticked.
 * The aged first-look profile also showed repeated lamp/object/posting reads.
 * Sharing physical inputs within a hall read must still see new inquiry facts
 * and a subsequent read must see a clerk who has left their post. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, markDead } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { createObligation } from '../../../src/engine/social/grudges';
import { settleHiredDuties } from '../../../src/engine/world/a-hired-duty-is-served';
import { readTheHallLampsTogether, whenTheHallKnowsTheirLampIsGone } from '../../../src/engine/world/what-the-roll-and-the-lamps-say';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened';
import { makeFact } from '../../../src/engine/world/history';
import { theHallStaff } from '../../../src/engine/world/the-people-posted-to-a-houses-halls';

function arrangement() {
    const state = createWorld({ seed: 'hired-lamp-hand', skipPriorAges: true, regionCount: 0, presentYear: 0 });
    state.currentDay = 15; state.currentHour = 10;
    state.factions = [makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat', ranks: ['Disciple', 'Elder', 'Head'] })];
    state.locations = [makeLocation({ id: 'seat', kind: 'sect_seat', name: 'Reed House', data: { factionId: 'house' } }),
        makeLocation({ id: 'lamps', kind: 'hall', name: 'Life Lamp Hall', parentId: 'seat', data: { factionId: 'house', purpose: 'life_lamp_hall' } })];
    const worker = createNpc(state.seed, { id: 'worker', locationId: 'lamps', bornOnDay: -7300, onDay: 5 });
    worker.activity = { kind: 'stationed', note: 'Serving the member\'s hall duty.', withIds: [], sinceDay: 5, untilDay: 25,
        houseWorkSchedule: { periodDays: 1, offset: 0, shift: 'day', rota: false } };
    const member = createNpc(state.seed, { id: 'departed-member', name: 'A Departed Member', bornOnDay: -7300, onDay: 5 });
    member.factionId = 'house'; member.factionRankIndex = 1;
    state.npcs = [worker, markDead(member, 12, 'Died before the next roll check.')];
    state.obligations = [createObligation({ kind: 'oath', holderId: worker.id, subjectId: 'paying-member',
        cause: 'service_term', severity: 'serious', onDay: 5, dueOnDay: 25, description: 'Serve the hall duty.',
        tags: ['hired-duty', 'hall-duty', 'post-at:lamps'] })];
    return { state, member: state.npcs[1]!, worker };
}

it('counts the actual hired hand and derives the next check day without adding daily facts', () => {
    const h = arrangement();
    expect(theHallStaff(h.state, 'house', 15).some(post => post.personId === h.worker.id)).toBe(true);
    const facts = h.state.history.facts.length;
    expect(whenTheHallKnowsTheirLampIsGone(h.state, 'house', h.member, 15)).toBe(13);
    expect(h.state.history.facts.length).toBe(facts);
});

it('reads newly recorded knowledge and releases physical inputs after the hall query', () => {
    const h = arrangement();
    const read = readTheHallLampsTogether(h.state, 'house');
    expect(read(h.member, 15)).toBe(13);
    appendWorldFact(h.state, makeFact({ day: 12.5, kind: 'said_in_public', summary: 'The earlier actual inquiry.',
        factionIds: ['house'], data: { lampInquiry: h.member.id } }), { bystanders: false });
    expect(read(h.member, 15)).toBe(12.5);
    h.worker.activity = null;
    // The earlier inquiry still reaches this member, but a new dead member has
    // neither a clerk nor testimony after the first physical read is over.
    const other = markDead(createNpc(h.state.seed, { id: 'other', bornOnDay: -7300, onDay: 0,
        factionId: 'house', factionRankIndex: 1 }), 14, 'Died away from the hall.');
    h.state.npcs.push(other);
    expect(readTheHallLampsTogether(h.state, 'house')(other, 20)).toBeNull();
});

it.each(['term ends', 'worker dies'] as const)('keeps the completed check after %s', ending => {
    const h = arrangement();
    if (ending === 'worker dies') h.state.npcs[0] = markDead(h.worker, 14, 'Died after making the daily check.');
    settleHiredDuties(h.state, ending === 'term ends' ? 25 : 14);
    expect(h.state.npcs[0]!.activity).toBeNull();
    expect(whenTheHallKnowsTheirLampIsGone(h.state, 'house', h.member, 30)).toBe(13);
    expect(h.state.history.facts.some(fact => fact.data.lampRollCheck && fact.day === 13
        && fact.actors.some(actor => actor.id === h.worker.id))).toBe(true);
});
