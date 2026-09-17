/**
 * Somebody making a thing can be seen to be making it, and attention given is
 * remembered on the tie it passed along.
 *
 * TWO GAPS, BOTH REPORTED FROM THE PLAYER'S SIDE. A master writing out a copy of
 * an art showed no activity at all - the copying pass was a yearly roll that
 * wrote a book and nothing about the person - so nobody could be seen or asked
 * about as busy with it. And attention was an activity that ended and left no
 * trace, so "they gave you time recently" could not be read by anything.
 *
 * WHAT THESE ASSERTIONS ENCODE:
 *
 *   the desk     a copy that takes more than the year it was started in is the
 *                master's activity, naming the art in `thingId` and in the note,
 *                with `untilDay` the day it will be done. It lands as that book
 *                on that day, and until then the master is not free to teach.
 *   the record   when a set of attention has run its term, the ties it ran along
 *                are stamped on both ends with the day it ended, and
 *                `gaveAttentionRecently` reads that against
 *                `ATTENTION_IS_RECENT_FOR_DAYS`. A person with no tie gets
 *                nothing written.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applyManualCopying, yearsToWriteOutACopy } from '../../../src/engine/world/manuals.js';
import { createNpc, type NpcRecord, type NpcRelationship } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import {
    ATTENTION_IS_RECENT_FOR_DAYS,
    gaveAttentionRecently,
    giveThisYearsAttention,
    withAttentionRecorded
} from '../../../src/engine/world/who-is-given-attention-this-year.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';

const YEAR = 365;
const HOUSE = 'house-with-a-desk';
/** The deepest-reaching art nobody has to be special to hold, so the copy takes years. */
const DEEP = TECHNIQUES
    .filter(t => t.cap != null && t.element == null)
    .sort((a, b) => Number(b.cap) - Number(a.cap))[0]!;

function tie(targetId: string, kind: NpcRelationship['kind']): NpcRelationship {
    return {
        targetId, targetName: targetId, kind, standing: 0.6, note: '',
        sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
    };
}

function houseWithAMaster(seed: string): { state: WorldState; master: NpcRecord } {
    const state = createWorld({ seed, presentYear: 1000, regionCount: 1 });
    const here = state.locations[0]!.id;
    state.factions.push(makeFaction({ id: HOUSE, name: 'The Desk Hall', ranks: ['Outer', 'Inner', 'Elder', 'Head'] }));
    const master = {
        ...createNpc(seed, { id: 'master', bornOnDay: state.currentDay - 900 * YEAR, onDay: state.currentDay, locationId: here,
            cultivation: { realmOrdinal: Number(DEEP.cap) } }),
        factionId: HOUSE, factionRankIndex: 3, activity: null
    };
    master.cultivation = { ...master.cultivation, realmOrdinal: Number(DEEP.cap), techniqueIds: [DEEP.id] };
    const waiting = {
        ...createNpc(seed, { id: 'waiting', bornOnDay: state.currentDay - 30 * YEAR, onDay: state.currentDay, locationId: here }),
        factionId: HOUSE, factionRankIndex: 0, activity: null
    };
    state.npcs.push(master, waiting);
    return { state, master };
}

describe('a master at a desk', () => {
    it('is at it, naming the art and the day it will be done, and it lands on that day', () => {
        expect(yearsToWriteOutACopy(DEEP.id)).toBeGreaterThan(1);
        // Seeds until one draws a copy longer than its first year, which is the
        // case being asked about. The draw is the world's; the search is ours.
        let found: { state: WorldState; year: number } | null = null;
        for (let n = 0; n < 40 && found === null; n++) {
            const { state } = houseWithAMaster(`desk-${n}`);
            const year = Math.floor(state.currentDay / YEAR);
            applyManualCopying(state, year, state.currentDay);
            const at = state.npcs.find(p => p.id === 'master')!.activity;
            if (at?.thingId === DEEP.id) found = { state, year };
        }
        expect(found, 'no seed in forty drew a copy that outlasts its first year').not.toBeNull();
        const { state, year } = found!;

        const at = state.npcs.find(p => p.id === 'master')!.activity!;
        expect(at.note).toContain(DEEP.name);
        expect(at.untilDay).toBeGreaterThan(state.currentDay);
        const books = () => state.objects.filter(o => o.data?.techniqueId === DEEP.id && o.possessorId === HOUSE).length;
        const before = books();

        // Every year before the day: still at it, nothing landed.
        const doneYear = Math.floor(at.untilDay! / YEAR);
        for (let y = year + 1; y < doneYear; y++) {
            applyManualCopying(state, y, y * YEAR);
            expect(state.npcs.find(p => p.id === 'master')!.activity?.thingId).toBe(DEEP.id);
            expect(books()).toBe(before);
        }
        applyManualCopying(state, doneYear, at.untilDay!);
        expect(books()).toBe(before + 1);
        expect(state.npcs.find(p => p.id === 'master')!.activity?.thingId ?? null).not.toBe(DEEP.id);
    });

    it('is not free to teach until the copy is done', () => {
        const { state } = houseWithAMaster('desk-busy');
        const here = state.locations[0]!.id;
        const day = state.currentDay;
        const at = state.npcs.findIndex(p => p.id === 'master');
        state.npcs[at] = {
            ...state.npcs[at]!,
            activity: { kind: 'the_work_of_their_rank', note: 'writing', withIds: [], sinceDay: day, untilDay: day + 3 * YEAR, thingId: DEEP.id }
        };
        const disciple = { ...createNpc('desk-busy', { id: 'disciple', bornOnDay: day - 20 * YEAR, onDay: day, locationId: here }),
            factionId: HOUSE, factionRankIndex: 0, activity: null, relationships: [tie('master', 'master')] };
        state.npcs.push(disciple);
        giveThisYearsAttention(state, Math.floor(day / YEAR), day);
        expect(state.npcs[at]!.activity?.kind).toBe('the_work_of_their_rank');
    });
});

describe('attention given is remembered on the tie', () => {
    it('stamps both ends when the set has run its term, and nobody without a tie', () => {
        const state = createWorld({ seed: 'remembered', presentYear: 1000, regionCount: 1 });
        const here = state.locations[0]!.id;
        const day = state.currentDay;
        const ended = day - 1;
        const master = { ...createNpc('r', { id: 'master', bornOnDay: day - 300 * YEAR, onDay: day, locationId: here }),
            relationships: [tie('disciple', 'disciple')],
            activity: { kind: 'teaching' as const, note: '', withIds: ['disciple', 'stranger'], sinceDay: ended - 200, untilDay: ended } };
        const disciple = { ...createNpc('r', { id: 'disciple', bornOnDay: day - 20 * YEAR, onDay: day, locationId: here }),
            relationships: [tie('master', 'master')] };
        const stranger = { ...createNpc('r', { id: 'stranger', bornOnDay: day - 20 * YEAR, onDay: day, locationId: here }) };
        state.npcs.push(master, disciple, stranger);

        giveThisYearsAttention(state, Math.floor(day / YEAR), day);

        const m = state.npcs.find(p => p.id === 'master')!;
        const d = state.npcs.find(p => p.id === 'disciple')!;
        expect(m.relationships.find(r => r.targetId === 'disciple')!.lastAttentionOnDay).toBe(ended);
        expect(d.relationships.find(r => r.targetId === 'master')!.lastAttentionOnDay).toBe(ended);
        expect(state.npcs.find(p => p.id === 'stranger')!.relationships).toEqual([]);
        expect(gaveAttentionRecently(d.relationships[0], day)).toBe(true);
        expect(gaveAttentionRecently(d.relationships[0], ended + ATTENTION_IS_RECENT_FOR_DAYS + 1)).toBe(false);
    });

    it('survives a save', () => {
        const db = new Database(':memory:');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const state = createWorld({ seed: 'remembered-save', presentYear: 1000, regionCount: 1 });
        const npc = withAttentionRecorded(
            { ...createNpc('s', { id: 'held', bornOnDay: 0, onDay: 0 }), relationships: [tie('other', 'master')] },
            'other', 1234);
        state.npcs.push(npc);
        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        expect(loaded.npcs.find(p => p.id === 'held')!.relationships[0]!.lastAttentionOnDay).toBe(1234);
        expect(loaded).toEqual(state);
        db.close();
    });
});
