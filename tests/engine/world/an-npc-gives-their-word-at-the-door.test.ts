/**
 * An NPC's word, which the world had nowhere to keep.
 *
 * `the-oath-a-house-offers-at-its-door.ts` has built the departure oath since it
 * was written and only the played layer ever called it: the ledger is a SQL
 * table `encounters.ts` writes, and an `ObligationRecord` produced inside a
 * world pass was dropped where it stood. So every NPC who walked out of a house
 * had sworn nothing, and an NPC teaching that house's art broke nothing.
 *
 * THE STORE, AND WHY IT IS A STORE. `WorldState.obligations`, the ledger's own
 * record type, written by its own makers and closed by `settleObligation`. The
 * alternative was the relationship ledger NPCs already have, and a tie holds a
 * kind, a standing and a note - no status, no settlement, no beneficiary - so
 * *"breaking one resolves as broken and opens `broken_oath`"* could only have
 * been faked in a note. See `the-word-an-npc-gave.ts`.
 *
 * WHAT IS NOT YET REACHED. Measured on seed `oath-a`: over two hundred years of
 * passes, not one NPC walked out of a house, so the world pass writes no oaths
 * at all - and it is not for want of anywhere to go (171 of 202 house members
 * have a road worth walking to). It is `whatLeavingTheirHouseCosts` swallowing
 * every reason. The wiring here is exercised directly until that is rebalanced.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
    theOathOnTheWayOut,
    theWordTheyGave,
    theyBrokeTheirWordTo,
    theyTaughtWhatTheySworeNotTo,
    whetherTheySwear
} from '../../../src/engine/world/the-word-an-npc-gave.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type FactionRecord, type WorldState } from '../../../src/engine/world/world-state.js';
import { assessPromotions, meritNeededFor, ordinalExpectedAt } from '../../../src/engine/world/promotion-inside-a-house.js';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';

const HOUSE = 'house-that-asks-for-silence';

function aWorld(): WorldState {
    const state = createWorld({ seed: 'a-word-given', skipPriorAges: true, regionCount: 0 });
    state.factions.push(makeFaction({
        id: HOUSE, name: 'Cold Spring Hall', ranks: ['Outer', 'Inner', 'Elder']
    }));
    return state;
}

function somebody(id: string, name = 'Somebody'): NpcRecord {
    const npc = createNpc('a-word-given', { id, name, bornOnDay: 0, onDay: 0 });
    return { ...npc, factionId: HOUSE, factionRankIndex: 1 };
}

describe('the oath a house asks for on the way out', () => {
    it('writes what was said onto the world\'s own ledger', () => {
        const state = aWorld();
        const house = state.factions[0]!;
        const leaver = somebody('npc-leaver', 'Yun Qiao');
        const { answer, record } = theOathOnTheWayOut(state, leaver, house, 400);

        expect(state.obligations).toHaveLength(1);
        expect(state.obligations[0]).toBe(record);
        if (answer === 'swear') {
            expect(record.kind).toBe('oath');
            expect(record.cause).toBe('silence');
            expect(record.holderId).toBe(leaver.id);
            expect(record.subjectId).toBe(house.id);
            expect(record.terms, 'the terms say what was sworn').toContain('transmit');
        } else {
            expect(record.kind).toBe('grudge');
            expect(record.holderId, 'a refusal is the house\'s to hold').toBe(house.id);
            expect(record.subjectId).toBe(leaver.id);
        }
        expect(record.incurredOnDay).toBe(400);
    });

    it('is the same answer from the same person, and most people swear', () => {
        const house = makeFaction({ id: HOUSE, name: 'Cold Spring Hall', ranks: ['Outer'] });
        let refused = 0;
        for (let i = 0; i < 300; i++) {
            const npc = { id: `npc-${i}` };
            const once = whetherTheySwear('a-word-given', npc, house);
            expect(whetherTheySwear('a-word-given', npc, house)).toBe(once);
            if (once === 'refuse') refused++;
        }
        expect(refused / 300, 'nobody refuses, so the refusal branch is dead')
            .toBeGreaterThan(0.02);
        expect(refused / 300, 'a house that loses its arts on most departures')
            .toBeLessThan(0.45);
    });

    it('does not write the same word down twice', () => {
        const state = aWorld();
        const house = state.factions[0]!;
        const leaver = somebody('npc-twice');
        theOathOnTheWayOut(state, leaver, house, 400);
        theOathOnTheWayOut(state, leaver, house, 400);
        expect(state.obligations).toHaveLength(1);
    });
});

describe('teaching what you swore not to', () => {
    /** A world where this person definitely swore. */
    function whoSwore(): { state: WorldState; house: FactionRecord; leaver: NpcRecord } {
        const state = aWorld();
        const house = state.factions[0]!;
        for (let i = 0; i < 50; i++) {
            const leaver = somebody(`npc-swearer-${i}`, 'Yun Qiao');
            if (whetherTheySwear(state.seed, leaver, house) !== 'swear') continue;
            theOathOnTheWayOut(state, leaver, house, 400);
            return { state, house, leaver };
        }
        throw new Error('nobody in fifty people swore anything');
    }

    it('settles the word as broken and opens a broken_oath for the house', () => {
        const { state, house, leaver } = whoSwore();
        expect(theWordTheyGave(state, leaver.id, house.id), 'the oath is not on the ledger')
            .not.toBeNull();

        const broke = theyTaughtWhatTheySworeNotTo(
            state, leaver, house.id, house.name, 900, 'Cold Spring Breathing'
        );
        expect(broke, 'nothing happened when the word was broken').not.toBeNull();
        expect(broke!.settled.status).toBe('settled');
        expect(broke!.settled.settlement?.resolution).toBe('broken');
        expect(broke!.settled.settlement?.onDay).toBe(900);
        expect(broke!.opened.kind).toBe('grudge');
        expect(broke!.opened.cause).toBe('broken_oath');
        expect(broke!.opened.holderId, 'the house is the party that was owed it').toBe(house.id);
        expect(broke!.opened.subjectId).toBe(leaver.id);
        expect(broke!.opened.severity, 'a grave word broken is not a slight')
            .toBe(broke!.settled.severity);

        // And the ledger holds both, with nothing open under the oath any more.
        expect(theWordTheyGave(state, leaver.id, house.id)).toBeNull();
        expect(theyBrokeTheirWordTo(state, leaver.id, house.id)).toBe(true);
        expect(state.obligations.filter(o => o.status === 'open')).toHaveLength(1);
    });

    it('is nothing at all for somebody who never swore', () => {
        const state = aWorld();
        const house = state.factions[0]!;
        const stranger = somebody('npc-never-swore');
        expect(theyTaughtWhatTheySworeNotTo(
            state, stranger, house.id, house.name, 900, 'Cold Spring Breathing'
        )).toBeNull();
        expect(state.obligations).toHaveLength(0);
        expect(theyBrokeTheirWordTo(state, stranger.id, house.id)).toBe(false);
    });
});

describe('what a broken word costs inside a house', () => {
    const RANKS = ['Outer', 'Inner', 'Core', 'True', 'Elder'];
    const SEAT = 'house-with-a-seat';

    it('leaves somebody who broke their word behind an equal who did not', () => {
        const state = createWorld({ seed: 'a-word-and-a-seat', skipPriorAges: true, regionCount: 0 });
        const house = makeFaction({
            id: SEAT, name: 'The Hall', ranks: RANKS,
            resources: { admission_ordinal: 2, power_ordinal: 30 }
        });
        state.factions.push(house);
        const bar = ordinalExpectedAt(1, RANKS.length, 2, 30);
        const needed = meritNeededFor(1);
        const member = (id: string): NpcRecord => {
            const npc = createNpc('a-word-and-a-seat', {
                id, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: Math.max(bar, 12) }
            });
            return {
                ...npc, factionId: SEAT, factionRankIndex: 0,
                merit: { houseId: SEAT, points: needed }
            };
        };
        // The one who broke their word sorts FIRST by id, so a seat decided any
        // other way goes to them and this test says nothing.
        const broke = member('npc-a-broke-it');
        const kept = member('npc-z-kept-it');
        state.npcs.push(broke, kept);
        state.obligations.push({
            id: 'obl-broken', kind: 'oath', holderId: broke.id, subjectId: SEAT,
            cause: 'silence', severity: 'grave', incurredOnDay: 10, triggeringEventId: null,
            description: 'Swore silence and did not keep it.', participants: [], tags: [],
            terms: null, dueOnDay: null, status: 'settled',
            settlement: { resolution: 'broken', onDay: 20, note: 'Taught it anyway.' },
            inheritance: [], generation: 0, originHolderId: broke.id, fromBelief: false,
            recordedOnDay: 20
        });

        const { promotions } = assessPromotions(state);
        const raised = promotions.find(p => p.toRank === 1);
        expect(raised?.npcId, 'the seat went to the one who broke their word').toBe(kept.id);
        expect(raised?.decidedBy).toBe('loyalty');
    });
});

describe('the world\'s ledger survives a save', () => {
    it('comes back exactly as it went down', () => {
        const db = new Database(':memory:');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const state = aWorld();
        const house = state.factions[0]!;
        const leaver = somebody('npc-saved', 'Yun Qiao');
        state.npcs.push(leaver);
        theOathOnTheWayOut(state, leaver, house, 400);
        theyTaughtWhatTheySworeNotTo(state, leaver, house.id, house.name, 900, 'Cold Spring Breathing');

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        expect(loaded.obligations).toEqual(state.obligations);
        expect(loaded).toEqual(state);
        db.close();
    });
});
