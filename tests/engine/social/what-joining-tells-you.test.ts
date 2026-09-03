/**
 * What being enrolled tells a member, and the three edges of it.
 *
 * The owner's ruling: being enrolled means being TOLD - what the ranks are, who
 * leads, who you answer to - and that is true of the newest servant on their
 * first day. With three qualifications, and only one of them is a gate:
 *
 *   "you probably don't know if your sect has a protector and who it is"
 *   "you're only told who is ON THE LADDER"
 *   "you also wouldn't know or care to know the names of all the guest
 *    disciples and servants"
 *
 * The third is not a gate and is not built as one: nobody withholds a herb boy's
 * name, it simply was not part of what anybody recited to you. Which is why the
 * grant reaches the TOP of the ladder rather than filtering the bottom out of a
 * roster dump.
 */

import {
    RUNGS_A_NEW_MEMBER_IS_TOLD,
    howBeingToldPutIt,
    whatJoiningTellsYou,
    type SomebodyOnTheLadder
} from '../../../src/engine/social/what-joining-tells-you';

const RANKS = ['Sword Servant', 'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Sword Elder', 'Pavilion Master'];

function member(rankIndex: number, id: string, realmOrdinal = 10): SomebodyOnTheLadder {
    return { id, name: `Person ${id}`, rankIndex, realmOrdinal };
}

const HOUSE: SomebodyOnTheLadder[] = [
    member(0, 'servant'), member(1, 'outer'), member(2, 'inner'),
    member(3, 'core'), member(4, 'elder-a'), member(4, 'elder-b'), member(5, 'head')
];

describe('what joining tells you', () => {
    it('names the head and the seniors, and nobody below them', () => {
        const told = whatJoiningTellsYou(HOUSE, RANKS).map(p => p.id);
        expect(told).toContain('head');
        expect(told).toContain('elder-a');
        expect(told).toContain('elder-b');
        expect(told).not.toContain('core');
        expect(told).not.toContain('servant');
    });

    it('marks the one at the top as leading it', () => {
        const told = whatJoiningTellsYou(HOUSE, RANKS);
        expect(told.find(p => p.leadsTheHouse)?.id).toBe('head');
        expect(told.filter(p => p.leadsTheHouse)).toHaveLength(1);
    });

    it('takes the title off the house\'s own ranks rather than composing one', () => {
        const told = whatJoiningTellsYou(HOUSE, RANKS);
        expect(told.find(p => p.id === 'head')?.title).toBe('Pavilion Master');
        expect(told.find(p => p.id === 'elder-a')?.title).toBe('Sword Elder');
    });

    /**
     * OCCUPIED rungs, and this is the case that made it so. The Pavilion's
     * ladder grew from six rungs to seven while this was being written - a
     * `Grand Sword Elder` inserted below `Pavilion Master` - and counting down
     * from the array stopped covering the Sword Elders that "the head and the
     * seniors" plainly means. A grant that changes who it names because
     * somebody added a rank title is measuring the array.
     */
    it('does not change who it names when a rank title is inserted above', () => {
        const grown = [...RANKS.slice(0, 5), 'Grand Sword Elder', 'Pavilion Master'];
        const before = whatJoiningTellsYou(HOUSE, RANKS).map(p => p.id).sort();
        const after = whatJoiningTellsYou(HOUSE, grown).map(p => p.id).sort();
        expect(after).toEqual(before);
    });

    /** A vacant office is led by whoever is actually at the top of the ladder. */
    it('names the real top when the highest office is empty', () => {
        const headless = HOUSE.filter(p => p.id !== 'head');
        const told = whatJoiningTellsYou(headless, RANKS);
        expect(told.find(p => p.leadsTheHouse)?.rankIndex).toBe(4);
        // And the rung below is still the seniors, rather than being eaten by
        // an empty title.
        expect(told.map(p => p.id)).toContain('core');
    });

    it('reaches exactly the stated number of occupied rungs', () => {
        const rungs = new Set(whatJoiningTellsYou(HOUSE, RANKS).map(p => p.rankIndex));
        expect(rungs.size).toBe(RUNGS_A_NEW_MEMBER_IS_TOLD);
    });

    /** Two of the catalog's houses have no members at all. */
    it('tells a member of an empty house nobody', () => {
        expect(whatJoiningTellsYou([], RANKS)).toEqual([]);
        expect(whatJoiningTellsYou(HOUSE, [])).toEqual([]);
    });

    it('is deterministic in the roster order it was handed', () => {
        const a = whatJoiningTellsYou(HOUSE, RANKS).map(p => p.id);
        const b = whatJoiningTellsYou([...HOUSE].reverse(), RANKS).map(p => p.id);
        expect(b).toEqual(a);
    });

    it('says the row as somebody who was told would say it', () => {
        const told = whatJoiningTellsYou(HOUSE, RANKS);
        const said = howBeingToldPutIt('Azure Cloud Pavilion', told.find(p => p.leadsTheHouse)!);
        expect(said).toContain('leads it');
        expect(said).toContain('you have not met them');
    });
});
