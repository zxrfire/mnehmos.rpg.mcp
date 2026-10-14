/**
 * An elder's own pupil is a real beneficiary of a favour. The ordinary request
 * odds, ties and personality decide the answer; the actual teaching activity
 * gives guidance and costs the helper practice. Asking spends private face,
 * the helper holds what is owed, and private teaching earns no house merit.
 * A small camp fixture keeps all three actual bodies together on ruin ground;
 * 32 pinned worlds prove both acceptance and refusal without arranging a roll.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship, setRealm, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { askSomebodyForHelp } from '../../../src/engine/world/somebody-calls-on-another-for-help.js';
import { giveThisYearsAttention } from '../../../src/engine/world/who-is-given-attention-this-year.js';
import { guidanceFor } from '../../../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { faceOf } from '../../../src/engine/world/what-a-face-is-worth.js';

function camp(seed: string) {
    const state = createWorld({ seed, presentYear: 0, regionCount: 0, skipPriorAges: true });
    state.currentDay = 97; state.currentHour = 12;
    state.locations = [makeLocation({ id: 'camp', name: 'The ruin camp', kind: 'ruin' })];
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'camp',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Grand Elder', 'Head'] });
    state.factions = [house];
    state.npcs = ['master', 'helper', 'junior'].map((id, i) => setRealm(createNpc(seed, {
        id, name: id === 'master' ? 'Master Shen' : id === 'helper' ? 'Elder Wen' : 'Disciple Lin',
        factionId: house.id, factionRankIndex: i === 2 ? 0 : 2, locationId: 'camp',
        onDay: 97, bornOnDay: -20 * 365 }), i === 0 ? 17 : i === 1 ? 25 : 16, 97));
    const [master, helper, junior] = state.npcs;
    state.npcs[0] = upsertRelationship(master!, { targetId: junior!.id, targetName: junior!.name, kind: 'disciple', standing: .8 }, 90);
    state.npcs[1] = upsertRelationship(helper!, { targetId: master!.id, targetName: master!.name, kind: 'ally', standing: .8 }, 90);
    state.npcs[2] = upsertRelationship(junior!, { targetId: master!.id, targetName: master!.name, kind: 'master', standing: .8 }, 90);
    return state;
}

it('gives a reached elder a real choice and keeps what is owed on the asker', () => {
    let accepted = 0, refused = 0;
    for (let i = 0; i < 32; i++) {
        const state = camp(`elders-help-${i}`);
        let work = 0;
        const result = askSomebodyForHelp(state, { askerId: 'master', beneficiaryId: 'junior', day: 97.5, work: 'give a lesson',
            ability: person => person.id === 'helper' ? 1 : 0,
            perform: (helper, junior) => {
                work++;
                helper.activity = { kind: 'teaching', withIds: [junior.id], note: 'Giving a lesson.', sinceDay: 97.5, untilDay: 100.5 };
                return true;
            } });
        const favour = state.obligations.find(word => word.tags.includes('personal-help'));
        if (!state.history.facts.some(fact => fact.data.personalHelpRequest)) {
            // The real area reader can put somebody elsewhere in the camp.
            expect(work).toBe(0); expect(favour).toBeUndefined();
            expect(faceOf(state.npcs[0]!)).toBe(0); continue;
        }
        expect(faceOf(state.npcs[0]!)).toBeLessThan(0);
        if (result) {
            accepted++;
            expect(work).toBe(1);
            expect(favour?.holderId).toBe('helper');
            expect(favour?.subjectId).toBe('master');
            expect(favour?.tags).toContain('beneficiary:junior');
            expect(state.npcs[1]!.activity?.withIds).toContain('junior');
        } else { refused++; expect(work).toBe(0); expect(favour).toBeUndefined(); }
        const before = state.history.facts.length;
        askSomebodyForHelp(state, { askerId: 'master', beneficiaryId: 'junior', day: 97.5, work: 'give a lesson',
            ability: () => 1, perform: () => { throw new Error('A repeated ask started work twice.'); } });
        expect(state.history.facts.length).toBe(before);
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
});

it("lets the ordinary yearly attention path ask on a disciple's behalf and start real guidance", () => {
    let helped = 0;
    for (let i = 0; i < 32; i++) {
        const state = camp(`elder-actual-attention-${i}`);
        const initial = state.npcs[1]!.merit;
        giveThisYearsAttention(state, 0, 97.5);
        if (!state.obligations.some(word => word.tags.includes('personal-help'))) continue;
        helped++;
        const helper = state.npcs.find(person => person.id === 'helper')!;
        expect(helper.activity?.kind).toBe('teaching');
        expect(helper.activity?.withIds).toContain('junior');
        expect(helper.merit).toEqual(initial);
        expect(guidanceFor(state.npcs.find(person => person.id === 'junior')!, new Map(state.npcs.map(person => [person.id, person])), 98)?.ordinal).toBe(helper.cultivation.realmOrdinal);
    }
    expect(helped).toBeGreaterThan(0);
});

it('cannot reach an absent helper or choose for a player helper', () => {
    for (const blocked of ['absent', 'player']) {
        const state = camp(`elder-help-${blocked}`);
        if (blocked === 'absent') { state.npcs[1]!.locationId = 'elsewhere'; }
        if (blocked === 'player') state.npcs[1]!.tags.push(PLAYER_ROW_TAG);
        const before = state.history.facts.length;
        expect(askSomebodyForHelp(state, { askerId: 'master', beneficiaryId: 'junior', day: 97.5, work: 'give a lesson',
            ability: person => person.id === 'helper' ? 1 : 0, perform: () => { throw new Error('Unavailable help was invented.'); } })).toBeNull();
        expect(state.history.facts.length).toBe(before);
        expect(state.obligations).toHaveLength(0);
        expect(faceOf(state.npcs[0]!)).toBe(0);
    }
});

it('keeps a remote beneficiary out of the private witnesses and grants no favour for work that cannot start', () => {
    let actualRequests = 0, agreed = 0;
    for (let i = 0; i < 32; i++) {
        const state = camp(`elder-help-cannot-start-${i}`);
        state.npcs.find(person => person.id === 'junior')!.locationId = 'elsewhere';
        expect(askSomebodyForHelp(state, { askerId: 'master', beneficiaryId: 'junior', day: 97.5, work: 'give a lesson',
            ability: person => person.id === 'helper' ? 1 : 0, perform: () => false })).toBeNull();
        const request = state.history.facts.find(fact => fact.data.personalHelpRequest);
        if (!request) continue;
        actualRequests++;
        if (request.data.accepted) agreed++;
        expect(request.data.beganWork).toBe(false);
        expect(request.data.beneficiaryId).toBe('junior');
        expect(request.witnessIds).not.toContain('junior');
        expect(request.actors.some(actor => actor.id === 'junior')).toBe(false);
        expect(state.obligations.some(word => word.tags.includes('personal-help'))).toBe(false);
    }
    expect(actualRequests).toBeGreaterThan(0);
    expect(agreed).toBeGreaterThan(0);
});

it('can call on another elder for their own lesson too', () => {
    let helped = 0;
    for (let i = 0; i < 32; i++) {
        const state = camp(`elder-own-help-${i}`);
        const result = askSomebodyForHelp(state, { askerId: 'master', day: 97.5, work: 'give a lesson',
            ability: person => person.id === 'helper' ? 1 : 0,
            perform: (helper, beneficiary) => {
                helper.activity = { kind: 'teaching', withIds: [beneficiary.id], note: 'Giving a lesson.', sinceDay: 97.5, untilDay: 100.5 };
                return true;
            } });
        if (!result) continue;
        helped++;
        expect(result.activity?.withIds).toContain('master');
        const favour = state.obligations.find(word => word.tags.includes('personal-help'))!;
        expect(favour.holderId).toBe('helper');
        expect(favour.subjectId).toBe('master');
        expect(guidanceFor(state.npcs[0]!, new Map(state.npcs.map(person => [person.id, person])), 98)?.ordinal).toBe(25);
    }
    expect(helped).toBeGreaterThan(0);
});
