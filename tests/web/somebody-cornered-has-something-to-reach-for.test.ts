/**
 * Somebody cornered reaches for who stands behind them and what they have on them.
 *
 * The genre's commonest beat when a stronger cultivator has somebody at their mercy - a bargain
 * made with a purse, a father named, a house invoked - has to fall out of facts the narrator is
 * handed, never out of lines it was given to say. These pin the facts: the tie, by title and never
 * by name, and what is actually on them.
 */
import { describe, expect, it } from 'vitest';

import { whatTheyHaveToReachFor } from '../../src/web/the-narrator-plays-the-world';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import { SECTS } from '../../src/data/cultivation/index';

const HOUSE = SECTS.find(sect => sect.ranks.length >= 3)!;

function person(id: string, over: Partial<NpcRecord>): NpcRecord {
    return {
        id,
        name: `Name ${id}`,
        identity: { sex: 'male' },
        factionId: HOUSE.id,
        factionRankIndex: 0,
        spiritStones: 0,
        relationships: [],
        status: 'alive',
        ...over
    } as unknown as NpcRecord;
}

function tie(targetId: string, kind: string) {
    return { targetId, targetName: `Name ${targetId}`, kind, standing: 0, note: '', sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null };
}

describe('somebody cornered', () => {
    it('names their father by his place in the house, and never by his name', () => {
        const head = person('head', { factionRankIndex: HOUSE.ranks.length - 1 });
        const junior = person('junior', { relationships: [tie('head', 'parent')] as never, spiritStones: 12 });
        const reach = whatTheyHaveToReachFor(junior, new Map([['head', head], ['junior', junior]]), []);

        expect(reach.standsBehind).toHaveLength(1);
        expect(reach.standsBehind[0]).toContain('their father');
        expect(reach.standsBehind[0]).toContain(HOUSE.ranks[HOUSE.ranks.length - 1]!);
        expect(reach.standsBehind[0]).toContain('the head of it');
        expect(reach.standsBehind[0]).not.toContain('Name head');
    });

    it('carries what is actually on them, and a stripped person carries nothing', () => {
        const robbed = person('robbed', { spiritStones: 0 });
        expect(whatTheyHaveToReachFor(robbed, new Map(), []).carries).toBe('0 spirit stones');

        const rich = person('rich', { spiritStones: 40 });
        const reach = whatTheyHaveToReachFor(rich, new Map(), [
            { name: 'a jade slip', possessorId: 'rich' },
            { name: 'somebody else\'s sword', possessorId: 'other' }
        ]);
        expect(reach.carries).toBe('40 spirit stones, a jade slip');
    });

    it('does not reach for the dead', () => {
        const gone = person('gone', { status: 'physically_dead' as never });
        const junior = person('junior', { relationships: [tie('gone', 'master')] as never });
        expect(whatTheyHaveToReachFor(junior, new Map([['gone', gone]]), []).standsBehind).toEqual([]);
    });
});
