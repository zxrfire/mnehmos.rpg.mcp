/**
 * Twenty years later, somebody says who did it.
 */
import { describe, expect, it } from 'vitest';

import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createObligation } from '../../../src/engine/social/grudges.js';
import { withNoNameOnIt, hasANameOnIt } from '../../../src/engine/social/accounts-with-no-name.js';
import { somebodyPutsANameToIt } from '../../../src/engine/world/somebody-puts-a-name-to-it.js';
import { theHouseIsToldWhereToLook } from '../../../src/engine/world/a-house-sends-somebody-looking.js';

const LOST = 1_000;
const TOLD = LOST + 365 * 20;

function aHouseCarryingIt() {
    const state = createWorld({ seed: 'named', skipPriorAges: true, regionCount: 1, presentYear: 0 });
    const head: NpcRecord = {
        ...createNpc('named', { id: 'npc-head', name: 'Elder Ru', bornOnDay: 0, onDay: 0 }),
        name: 'Elder Ru',
        factionId: 'house-a'
    };
    state.npcs = [head];
    state.obligations.push(createObligation(withNoNameOnIt({
        kind: 'grudge',
        holderId: 'npc-head',
        subjectId: 'ignored-by-withNoNameOnIt',
        cause: 'killed_sectmate',
        severity: 'grave',
        onDay: LOST,
        description: 'Mo Qingzhi was killed. Nobody has put a name to it.'
    })));
    return state;
}

describe('somebody puts a name to it', () => {
    it('puts the name on an account that carried none for twenty years', () => {
        const state = aHouseCarryingIt();
        expect(hasANameOnIt(state.obligations[0]!)).toBe(false);

        const out = somebodyPutsANameToIt(state, {
            holderId: 'npc-head',
            subjectId: 'npc-killer',
            subjectName: 'Tang Cishi',
            toldById: 'npc-player',
            onDay: TOLD
        });

        expect(out.named).toBe(1);
        expect(hasANameOnIt(state.obligations[0]!)).toBe(true);
        expect(state.obligations[0]!.subjectId).toBe('npc-killer');
        // THE SAME ACCOUNT, at the same weight and from the same day. A name
        // arriving does not restart the clock on what was owed.
        expect(state.obligations[0]!.severity).toBe('grave');
        expect(state.obligations[0]!.incurredOnDay).toBe(LOST);
    });

    it('and the holder takes it personally', () => {
        const state = aHouseCarryingIt();
        somebodyPutsANameToIt(state, {
            holderId: 'npc-head', subjectId: 'npc-killer', subjectName: 'Tang Cishi',
            toldById: 'npc-player', onDay: TOLD
        });

        const tie = state.npcs[0]!.relationships.find(r => r.targetId === 'npc-killer');
        expect(tie).toBeDefined();
        expect(tie!.standing).toBeLessThan(0);
    });

    it('is not believed from somebody the house holds a grudge against', () => {
        const state = aHouseCarryingIt();
        state.npcs[0] = {
            ...state.npcs[0]!,
            relationships: [{
                targetId: 'npc-liar', targetName: 'A Known Liar', kind: 'enemy',
                standing: -0.8, note: '', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null
            }]
        };

        const out = somebodyPutsANameToIt(state, {
            holderId: 'npc-head', subjectId: 'npc-killer', subjectName: 'Tang Cishi',
            toldById: 'npc-liar', onDay: TOLD
        });

        expect(out.believed).toBe(false);
        expect(out.named).toBe(0);
        expect(hasANameOnIt(state.obligations[0]!)).toBe(false);
    });

    // BEING UNKNOWN IS NOT BEING DISTRUSTED. The whole story is somebody
    // walking in twenty years later, and they have no tie to this house.
    it('is believed from a stranger with no tie to the house', () => {
        const state = aHouseCarryingIt();
        const out = somebodyPutsANameToIt(state, {
            holderId: 'npc-head', subjectId: 'npc-killer', subjectName: 'Tang Cishi',
            toldById: 'npc-nobody-knows', onDay: TOLD
        });

        expect(out.believed).toBe(true);
        expect(out.named).toBe(1);
    });

    it('does nothing to an account that already has a name', () => {
        const state = aHouseCarryingIt();
        somebodyPutsANameToIt(state, {
            holderId: 'npc-head', subjectId: 'npc-killer', subjectName: 'Tang Cishi',
            toldById: null, onDay: TOLD
        });
        const again = somebodyPutsANameToIt(state, {
            holderId: 'npc-head', subjectId: 'npc-somebody-else', subjectName: 'Another',
            toldById: null, onDay: TOLD + 365
        });

        expect(again.named).toBe(0);
        expect(state.obligations[0]!.subjectId).toBe('npc-killer');
    });

    it('names nobody else\'s account', () => {
        const state = aHouseCarryingIt();
        const out = somebodyPutsANameToIt(state, {
            holderId: 'npc-someone-else', subjectId: 'npc-killer', subjectName: 'Tang Cishi',
            toldById: null, onDay: TOLD
        });

        expect(out.named).toBe(0);
        expect(hasANameOnIt(state.obligations[0]!)).toBe(false);
    });
});

describe('a house told where to look starts again', () => {
    it('clears the giving-up mark and the empty count', () => {
        const state = aHouseCarryingIt();
        state.factions.push({
            ...state.factions[0]!,
            id: 'house-a',
            tags: ['gave-up-looking-for|npc-lost', 'looked-and-found-nothing|npc-lost|3']
        });

        expect(theHouseIsToldWhereToLook(state, {
            houseId: 'house-a', personId: 'npc-lost', toldById: 'npc-stranger', onDay: TOLD
        })).toBe(true);

        const house = state.factions.find(f => f.id === 'house-a')!;
        expect(house.tags).not.toContain('gave-up-looking-for|npc-lost');
        // NOT THREE-QUARTERS OF THE WAY TO GIVING UP AGAIN. New word is a new
        // search, so the count of empty parties goes with the mark.
        expect(house.tags.some(t => t.startsWith('looked-and-found-nothing|npc-lost|'))).toBe(false);
    });

    it('does nothing where the house never gave up', () => {
        const state = aHouseCarryingIt();
        state.factions.push({ ...state.factions[0]!, id: 'house-a', tags: [] });
        expect(theHouseIsToldWhereToLook(state, {
            houseId: 'house-a', personId: 'npc-lost', toldById: null, onDay: TOLD
        })).toBe(false);
    });

    it('will not take the word of somebody every one of them holds a grudge against', () => {
        const state = aHouseCarryingIt();
        state.factions.push({
            ...state.factions[0]!, id: 'house-a', tags: ['gave-up-looking-for|npc-lost']
        });
        state.npcs[0] = {
            ...state.npcs[0]!,
            factionId: 'house-a',
            relationships: [{
                targetId: 'npc-liar', targetName: 'A Known Liar', kind: 'enemy',
                standing: -0.9, note: '', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null
            }]
        };

        expect(theHouseIsToldWhereToLook(state, {
            houseId: 'house-a', personId: 'npc-lost', toldById: 'npc-liar', onDay: TOLD
        })).toBe(false);
    });
});
