/**
 * A search that came home, and the two things it can be worth.
 */
import { describe, expect, it } from 'vitest';

import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { faceOf } from '../../../src/engine/world/what-a-face-is-worth.js';
import {
    whatASearchBroughtBack,
    whatTheBodySaysAbout
} from '../../../src/engine/world/what-a-search-brings-back.js';

const DAY = 1_000;

const person = (id: string, name: string, factionId: string | null): NpcRecord => ({
    ...createNpc('search-a', { id, name, bornOnDay: 0, onDay: 0 }),
    name,
    factionId,
    factionRankIndex: factionId === null ? -1 : 0
});

function aWorldWith(killer: { id: string; name: string } | null | 'none') {
    const state = createWorld({ seed: 'search-a', skipPriorAges: true, regionCount: 1, presentYear: 0 });
    state.npcs = [
        person('npc-dead', 'Mo Qingzhi', 'house-a'),
        person('npc-head', 'Elder Ru', 'house-a'),
        person('npc-hand', 'Shen Li', 'house-a'),
        person('npc-other', 'A Stranger', 'house-b')
    ];
    if (killer !== 'none') {
        appendWorldFact(state, makeFact({
            day: 900,
            kind: 'death',
            scale: 'personal',
            actors: [
                ...(killer ? [{ id: killer.id, name: killer.name, role: 'killer' }] : []),
                { id: 'npc-dead', name: 'Mo Qingzhi', role: 'victim' }
            ],
            summary: 'Mo Qingzhi was killed.'
        }), {});
    }
    return state;
}

describe('what a search brings back', () => {
    it('reads a death nobody recorded as a killing as an accident', () => {
        const state = aWorldWith('none');
        expect(whatTheBodySaysAbout(state, 'npc-dead')).toEqual({ it: 'an accident' });
    });

    it('pays an accident in face, across the whole house and not the searcher', () => {
        const state = aWorldWith('none');
        const before = state.npcs.map((n: NpcRecord) => faceOf(n));
        const out = whatASearchBroughtBack(state, {
            deadId: 'npc-dead', houseId: 'house-a', holderId: 'npc-head',
            day: DAY, deadName: 'Mo Qingzhi'
        });

        expect(out.account).toBe('none');
        // Everybody of the house, including the dead person's own row and the
        // one who went - and nobody of another house.
        expect(out.faceMoved).toBe(3);
        const other = state.npcs.find((n: NpcRecord) => n.id === 'npc-other')!;
        expect(faceOf(other)).toBe(before[3]);
        const hand = state.npcs.find((n: NpcRecord) => n.id === 'npc-hand')!;
        expect(faceOf(hand)).toBeGreaterThan(before[2]!);
        expect(state.obligations).toHaveLength(0);
    });

    it('opens a named account when the world knows who did it', () => {
        const state = aWorldWith({ id: 'npc-other', name: 'A Stranger' });
        const out = whatASearchBroughtBack(state, {
            deadId: 'npc-dead', houseId: 'house-a', holderId: 'npc-head',
            day: DAY, deadName: 'Mo Qingzhi'
        });

        expect(out.account).toBe('named');
        expect(out.faceMoved).toBe(0);
        expect(state.obligations).toHaveLength(1);
        expect(state.obligations[0]!.subjectId).toBe('npc-other');
        expect(state.obligations[0]!.holderId).toBe('npc-head');
    });

    it('opens an account with no name on it when it does not', () => {
        const state = aWorldWith(null);
        const out = whatASearchBroughtBack(state, {
            deadId: 'npc-dead', houseId: 'house-a', holderId: 'npc-head',
            day: DAY, deadName: 'Mo Qingzhi'
        });

        expect(out.account).toBe('no name on it');
        expect(state.obligations).toHaveLength(1);
        expect(state.obligations[0]!.subjectId).toBeNull();
    });
});
