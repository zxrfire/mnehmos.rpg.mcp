/**
 * What a house's things do when its war ends.
 *
 * The design owner: single-use materials are *typically left as spoils of war*,
 * and a losing side may instead *grab their vault and run and disband*. So the
 * load-bearing assertion here is that a settlement MOVES things rather than
 * destroying them - which is what stops five thousand years of wars from
 * emptying the world of the scarcest objects in it.
 */
import { describe, it, expect } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    carriedOff,
    holdsTogetherAsFarAsAnybodyKnows,
    settleTheSpoils,
    takenAsSpoils,
    whatABreachedVaultTakesWithIt,
    whatIsLeftInTheHold,
    whoLost
} from '../../../src/engine/world/war-spoils.js';
import { isRuined, makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { isInert } from '../../../src/engine/world/object-damage.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

// A world small enough to reason about: two houses, one hold, some people.
function twoHouses(opts: { loserHasPeople?: boolean } = {}): WorldState {
    const state = {
        factions: [
            { id: 'loser', name: 'Kiln Clan', seatLocationId: 'loc-kiln', dissolvedOnDay: null, tags: [], standing: {}, resources: {}, alignment: 'neutral' },
            { id: 'winner', name: 'Storm Court', seatLocationId: 'loc-storm', dissolvedOnDay: null, tags: [], standing: {}, resources: {}, alignment: 'neutral' }
        ],
        npcs: [
            { id: 'npc-w', name: 'The Storm Tyrant', status: 'alive', factionId: 'winner', cultivation: { realmOrdinal: 38 } },
            ...(opts.loserHasPeople === false ? [] : [
                { id: 'npc-l1', name: 'Kiln Elder', status: 'alive', factionId: 'loser', cultivation: { realmOrdinal: 22 } },
                { id: 'npc-l2', name: 'Kiln Junior', status: 'alive', factionId: 'loser', cultivation: { realmOrdinal: 8 } }
            ])
        ],
        objects: [
            makeObject({
                id: 'obj-relic', name: 'a nascent echo', kind: 'material',
                significance: 'significant', power: 28,
                ownerId: 'loser', ownerName: 'Kiln Clan', possessorId: 'loser',
                locationId: 'loc-kiln'
            }),
            makeObject({
                id: 'obj-cinder', name: 'a banked cinder', kind: 'material',
                significance: 'notable', power: 16,
                ownerId: 'loser', ownerName: 'Kiln Clan', possessorId: 'loser',
                locationId: 'loc-kiln'
            }),
            // Carried out of the gate by a person: not in the hold.
            makeObject({
                id: 'obj-blade', name: 'an elder\'s blade', kind: 'artifact',
                significance: 'significant', power: 22,
                ownerId: 'loser', ownerName: 'Kiln Clan', possessorId: 'npc-l1'
            })
        ],
        history: { facts: [], nextFactSeq: 1 }
    } as unknown as WorldState;
    return state;
}

const rng = () => forStream('spoils', 'test');

describe('what a settlement can move is the complement of what the fighting reached', () => {
    it('the hold is what stayed in; what somebody carried out is not in it', () => {
        const state = twoHouses();
        const ids = whatIsLeftInTheHold(state, 'loser').map(o => o.id);
        expect(ids).toEqual(['obj-relic', 'obj-cinder']);
        expect(ids).not.toContain('obj-blade');
    });

    it('anything already ended or emptied is not there to move', () => {
        const state = twoHouses();
        state.objects[0] = { ...state.objects[0], tags: ['ruined'] };
        state.objects[1] = { ...state.objects[1], tags: ['inert'] };
        expect(whatIsLeftInTheHold(state, 'loser')).toHaveLength(0);
    });
});

describe('the ordinary ending is that somebody else has it', () => {
    it('a settlement moves the hold and destroys nothing', () => {
        const state = twoHouses();
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1],
            war: 'the war',
            onDay: 500
        }, rng());

        expect(moved).toHaveLength(2);
        expect(moved.every(m => m.fate === 'taken')).toBe(true);
        // NOTHING was destroyed. This is the whole point of the file.
        for (const o of state.objects) {
            expect(isRuined(o)).toBe(false);
            expect(isInert(o)).toBe(false);
        }
        // And nothing lost a rung. Capture is not damage.
        expect(state.objects.find(o => o.id === 'obj-relic')!.power).toBe(28);
    });

    it('ownership moves with possession, and the chain names the war', () => {
        const state = twoHouses();
        settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1],
            war: 'the war between the Kiln Clan and the Storm Court',
            onDay: 500
        }, rng());

        const relic = state.objects.find(o => o.id === 'obj-relic')!;
        expect(relic.ownerId).toBe('winner');
        expect(relic.possessorId).toBe('winner');
        const link = relic.provenance.at(-1)!;
        expect(link.how).toBe('looted');
        expect(link.onDay).toBe(500);
        expect(link.source).toMatch(/war between the Kiln Clan/);
        expect(link.previousHolderId).toBe('loser');
    });

    it('a taken thing is in the winner\'s hold, so it can be taken again', () => {
        const state = twoHouses();
        settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1], war: 'a war', onDay: 500
        }, rng());
        expect(whatIsLeftInTheHold(state, 'winner').map(o => o.id))
            .toEqual(['obj-relic', 'obj-cinder']);
    });

    it('the loser is still there. Losing a hold is not being ended', () => {
        const state = twoHouses();
        settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1], war: 'a war', onDay: 500
        }, rng());
        expect(state.factions[0].dissolvedOnDay).toBeNull();
        expect(state.npcs.filter(n => n.factionId === 'loser')).toHaveLength(2);
    });
});

describe('or the losing side grabs their vault and runs', () => {
    it('the things go out in members\' arms, and a person holds them', () => {
        const state = twoHouses();
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: false },
            winner: state.factions[1], war: 'a war', onDay: 500
        }, rng());

        expect(moved.every(m => m.fate === 'carried off')).toBe(true);
        for (const m of moved) expect(['npc-l1', 'npc-l2']).toContain(m.toId);
        const relic = state.objects.find(o => o.id === 'obj-relic')!;
        expect(['npc-l1', 'npc-l2']).toContain(relic.possessorId);
        expect(relic.ownerId).toBe(relic.possessorId);
        // A person is not on a roll anybody can read, which is the gap in the
        // chain that makes an object worth chasing.
        expect(relic.provenance.at(-1)!.note).toMatch(/a name and then nothing/);
    });

    it('disbanding is not being destroyed: the people scatter, alive', () => {
        const state = twoHouses();
        settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: false },
            winner: state.factions[1], war: 'a war', onDay: 500
        }, rng());

        expect(state.factions[0].dissolvedOnDay).toBe(500);
        // Nobody is deleted and nobody is dead. They are nobody's.
        expect(state.npcs.filter(n => n.status === 'alive')).toHaveLength(3);
        expect(state.npcs.filter(n => n.factionId === 'loser')).toHaveLength(0);
        expect(state.npcs.find(n => n.id === 'npc-l1')!.factionId).toBeNull();
    });

    it('a house with nobody left cannot carry anything anywhere', () => {
        const state = twoHouses({ loserHasPeople: false });
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: false },
            winner: state.factions[1], war: 'a war', onDay: 500
        }, rng());
        // Falls back to capture rather than to nothing: the things are still
        // there and somebody won.
        expect(moved.every(m => m.fate === 'taken')).toBe(true);
        expect(state.factions[0].dissolvedOnDay).toBeNull();
    });
});

describe('what is in a vault is behind the vault', () => {
    it('a force that cannot get through the vault reaches nothing in it', () => {
        const state = twoHouses();
        const vault = {
            id: 'v', name: 'the Kiln hold', power: 29,
            significance: 'significant' as const, tags: [], data: {}
        };
        const inside = whatIsLeftInTheHold(state, 'loser');
        const out = whatABreachedVaultTakesWithIt(vault, { ordinal: 22, byName: 'a raid' }, inside);
        expect(out.reached).toHaveLength(0);
        expect(out.kept).toHaveLength(2);
    });

    it('and a breached one exposes everything that was in it', () => {
        const state = twoHouses();
        const vault = {
            id: 'v', name: 'the Kiln hold', power: 29,
            significance: 'significant' as const, tags: [], data: {}
        };
        const inside = whatIsLeftInTheHold(state, 'loser');
        const out = whatABreachedVaultTakesWithIt(vault, { ordinal: 34, byName: 'a raid' }, inside);
        expect(out.reached).toHaveLength(2);
        expect(out.kept).toHaveLength(0);
    });
});

describe('which side lost', () => {
    it('is what each could put out - the strongest, never an average', () => {
        const state = twoHouses();
        const sides = whoLost(state, state.factions[0], state.factions[1]);
        expect(sides?.loser.id).toBe('loser');
        expect(sides?.winner.id).toBe('winner');
    });

    it('two houses that could put the same thing out have settled nothing', () => {
        const state = twoHouses();
        state.npcs[0] = { ...state.npcs[0], cultivation: { realmOrdinal: 22 } } as never;
        state.npcs.push({
            id: 'npc-w2', name: 'A second', status: 'alive', factionId: 'winner',
            cultivation: { realmOrdinal: 8 }
        } as never);
        expect(whoLost(state, state.factions[0], state.factions[1])).toBeNull();
    });

    it('a house with nobody alive in it does not hold together', () => {
        const state = twoHouses({ loserHasPeople: false });
        expect(holdsTogetherAsFarAsAnybodyKnows(state, 'loser')).toBe(false);
        expect(holdsTogetherAsFarAsAnybodyKnows(state, 'winner')).toBe(true);
    });
});

describe('the two transfer helpers write what they say they write', () => {
    it('taken moves ownership; carried off moves it to a person', () => {
        const row = makeObject({
            id: 'o', name: 'a thing', kind: 'artifact', power: 20,
            ownerId: 'loser', ownerName: 'Kiln Clan', possessorId: 'loser'
        }) as ObjectRecord;
        const took = takenAsSpoils(row, {
            by: { id: 'winner', name: 'Storm Court' }, from: { name: 'Kiln Clan' },
            war: 'a war', onDay: 9
        });
        expect(took.ownerId).toBe('winner');
        expect(took.power).toBe(20);

        const ran = carriedOff(row, {
            by: { id: 'npc-l1', name: 'Kiln Elder' }, from: { name: 'Kiln Clan' },
            war: 'a war', onDay: 9
        });
        expect(ran.ownerId).toBe('npc-l1');
        expect(ran.possessorId).toBe('npc-l1');
        expect(ran.power).toBe(20);
    });
});
