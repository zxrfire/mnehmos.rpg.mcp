/**
 * A recurring fact is one row, and folding it must not lose anybody.
 *
 * The ledger is load-bearing for the person-to-fact back-links, so the two
 * things that would make this change dangerous are tested first and hardest:
 * a fold must not drop a witness, and nothing anywhere may end up pointing at a
 * row that stopped existing.
 */

import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { makeFact, yearOfDay, type PendingFact } from '../../../src/engine/world/history.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {
    describeWithRecurrence,
    lastOccurrenceOf,
    occurrencesOf,
    recurrenceKeyOf
} from '../../../src/engine/world/a-fact-that-keeps-happening-is-one-row.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

function world(): WorldState {
    return createWorld({ seed: 'recur', presentYear: 1000, regionCount: 0, skipPriorAges: true });
}

const renewal = (day: number, over: Partial<PendingFact> = {}): PendingFact => makeFact({
    day,
    kind: 'assessment',
    scale: 'local',
    summary: "The Ashen Forge Clan's grant on its vein comes up for renewal.",
    factionIds: ['ashen-forge'],
    visibility: 'faction',
    magnitude: 0.4,
    data: { kind: 'grant_renewal' },
    ...over
});

function advanced(years = 300): WorldState {
    const seeded = seedWorld({ seed: 'recur-world', catalog: fixtureCatalog(), presentYear: 1000, population: 250 });
    return advanceWorldYears(seeded.state, years, { pressure: { eventsPerYear: 2 } }).state;
}

describe('what counts as the same fact', () => {
    it('separates two statements that differ anywhere that matters', () => {
        const base = renewal(400_000);
        expect(recurrenceKeyOf(base)).toBe(recurrenceKeyOf(renewal(999_999)));
        // The day is the ONLY thing allowed to differ.
        expect(recurrenceKeyOf(base)).not.toBe(recurrenceKeyOf(renewal(400_000, { summary: 'Something else.' })));
        expect(recurrenceKeyOf(base)).not.toBe(recurrenceKeyOf(renewal(400_000, { factionIds: ['other'] })));
        expect(recurrenceKeyOf(base)).not.toBe(recurrenceKeyOf(renewal(400_000, { magnitude: 0.9 })));
        expect(recurrenceKeyOf(base)).not.toBe(recurrenceKeyOf(renewal(400_000, { locationId: 'loc-1' })));
        expect(recurrenceKeyOf(base)).not.toBe(recurrenceKeyOf(renewal(400_000, { data: { kind: 'other' } })));
    });

    it('keeps two deaths apart even when the words are identical', () => {
        // Names repeat over a long run - the pool is finite - so two people can
        // die with the same sentence written about them. The actors are what
        // stop the rows merging, which is the whole reason they are in the key.
        const one = makeFact({
            day: 400_000, kind: 'death', scale: 'personal',
            summary: 'Wei Rongya, Qi Condensation Layer 3, reached the end of their lifespan and died.',
            actors: [{ id: 'npc-1', name: 'Wei Rongya', role: 'deceased' }]
        });
        const two = { ...one, actors: [{ id: 'npc-2', name: 'Wei Rongya', role: 'deceased' }] };
        expect(recurrenceKeyOf(one)).not.toBe(recurrenceKeyOf(two));
    });
});

describe('folding an occurrence', () => {
    it('writes one row and counts the rest', () => {
        const state = world();
        const first = appendWorldFact(state, renewal(400_000));
        for (let i = 1; i < 12; i++) appendWorldFact(state, renewal(400_000 + i * 4380));

        expect(state.history.facts).toHaveLength(1);
        expect(occurrencesOf(state.history.facts[0])).toBe(12);
        expect(state.history.facts[0].id).toBe(first.id);
        // The row never moves off the day it opened.
        expect(state.history.facts[0].day).toBe(400_000);
        expect(lastOccurrenceOf(state.history.facts[0])).toBe(400_000 + 11 * 4380);
    });

    it('says the recurrence out loud without touching the summary', () => {
        const state = world();
        appendWorldFact(state, renewal(400_000));
        appendWorldFact(state, renewal(800_000));
        const row = state.history.facts[0];
        // The summary is part of the key. Rewriting it would make the row stop
        // absorbing its own further occurrences.
        expect(row.summary).toBe("The Ashen Forge Clan's grant on its vein comes up for renewal.");
        expect(describeWithRecurrence(row, yearOfDay)).toContain('2 times, years');
    });

    it('loses nobody who was there on any occasion', () => {
        const state = world();
        appendWorldFact(state, renewal(400_000, { witnessIds: ['a', 'b'] }));
        appendWorldFact(state, renewal(500_000, { witnessIds: ['b', 'c'] }));
        appendWorldFact(state, renewal(600_000, { witnessIds: ['d'] }));
        expect(state.history.facts).toHaveLength(1);
        expect([...state.history.facts[0].witnessIds].sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('keeps every occurrence\'s physical change and cause', () => {
        const state = world();
        appendWorldFact(state, renewal(400_000, { locationChangeIds: ['ch-1'], causes: ['f1'] }));
        appendWorldFact(state, renewal(500_000, { locationChangeIds: ['ch-2'], causes: ['f2'] }));
        const row = state.history.facts[0];
        expect(row.locationChangeIds).toEqual(['ch-1', 'ch-2']);
        expect(row.causes).toEqual(['f1', 'f2']);
    });

    it('can be opted out of', () => {
        const state = world();
        appendWorldFact(state, renewal(400_000), { recur: false });
        appendWorldFact(state, renewal(500_000), { recur: false });
        expect(state.history.facts).toHaveLength(2);
    });
});

describe('the ledger stays walkable', () => {
    it('leaves no back-link pointing at a row that is not there', () => {
        const state = advanced();
        const ids = new Set(state.history.facts.map(f => f.id));
        const dangling: string[] = [];
        for (const npc of state.npcs) {
            for (const id of npc.historyFactIds) {
                if (!ids.has(id)) dangling.push(`${npc.name} -> ${id}`);
            }
        }
        expect(dangling.slice(0, 5)).toEqual([]);
    });

    it('never writes the same fact id onto one person twice', () => {
        const state = advanced();
        const doubled: string[] = [];
        for (const npc of state.npcs) {
            if (new Set(npc.historyFactIds).size !== npc.historyFactIds.length) {
                doubled.push(npc.name);
            }
        }
        expect(doubled.slice(0, 5)).toEqual([]);
    });

    it('confirms somebody alive on the day it happened, not the day the row opened', () => {
        // The link is written once and the confirmation day still moves, which
        // is the part a fold could silently lose: the row is dated year 1004
        // and the person was demonstrably standing there in year 2465.
        const state = world();
        state.npcs.push({
            ...JSON.parse(JSON.stringify({})),
            id: 'npc-w', name: 'Watcher', historyFactIds: [], lastConfirmedOnDay: 0,
            relationships: [], cultivation: {}, identity: {}, goals: []
        } as never);
        const named = { actors: [{ id: 'npc-w', name: 'Watcher', role: 'involved' }] };
        appendWorldFact(state, renewal(400_000, named));
        appendWorldFact(state, renewal(900_000, named));
        const watcher = state.npcs.find(n => n.id === 'npc-w')!;
        expect(state.history.facts).toHaveLength(1);
        expect(watcher.historyFactIds).toHaveLength(1);
        expect(watcher.lastConfirmedOnDay).toBe(900_000);
    });

    it('does not put a bystander on the record of what they merely saw', () => {
        const state = world();
        state.npcs.push({
            ...JSON.parse(JSON.stringify({})),
            id: 'npc-b', name: 'Bystander', historyFactIds: [], lastConfirmedOnDay: 0,
            relationships: [], cultivation: {}, identity: {}, goals: []
        } as never);
        const fact = appendWorldFact(state, renewal(400_000, { witnessIds: ['npc-b'] }));
        // Present on the fact, absent from the life. Two different questions.
        expect(fact.witnessIds).toContain('npc-b');
        expect(state.npcs.find(n => n.id === 'npc-b')!.historyFactIds).toEqual([]);
    });

    it('still holds a row for every distinct thing that happened', () => {
        // The saving must come from repetition and from nothing else. Distinct
        // statements are the count that must NOT fall.
        const state = advanced();
        const distinct = new Set(state.history.facts.map(f => recurrenceKeyOf(f)));
        expect(distinct.size).toBe(state.history.facts.length);
    });

    it('accounts for every occurrence it folded away', () => {
        const state = advanced();
        const occurrences = state.history.facts.reduce((sum, f) => sum + occurrencesOf(f), 0);
        expect(occurrences).toBeGreaterThan(state.history.facts.length);
    });
});
