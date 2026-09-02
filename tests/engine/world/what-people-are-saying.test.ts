/**
 * Gossip: what the world's own ledger sounds like coming out of a stranger.
 *
 * The contract, stated as tests rather than as prose:
 *
 *   - the market talks about people it will never meet, not about itself
 *   - truth is a spectrum and there is no boolean anywhere in it
 *   - one teller always tells you the same version, which is what makes a
 *     rumour checkable rather than a lottery
 *   - a better-placed teller gives a better version of the SAME event
 *   - a distortion swaps a real field for another real field and never invents
 *     a name
 *   - the sentence never says which part came off
 *   - secrets are not gossip
 */

import { describe, it, expect } from 'vitest';

import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact, type HistoricalFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {
    HAND_DECAY,
    circulating,
    fidelityAfter,
    handsItPassedThrough,
    retell,
    whatTheySay,
    type TellerStanding
} from '../../../src/engine/world/what-people-are-saying.js';

const DAY = 365 * 1_000;

// ─────────────────────────────────────────────────────────────────────────
// A WORLD SMALL ENOUGH TO REASON ABOUT
//
// Built by hand for the reason `gatherings.test.ts` states: this suite is
// testing the mechanism, and a seeded world's ledger is content somebody else
// may legitimately change this afternoon.
// ─────────────────────────────────────────────────────────────────────────

function build(): { state: WorldState } {
    const state = createWorld({ seed: 'rumour-test', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;

    for (const [id, name] of [['loc-here', 'The Near Province'], ['loc-away', 'The Far Province']]) {
        state.locations.push(makeLocation({ id, name, kind: 'region', qiDensity: 0.4 }));
    }
    state.locations.push(makeLocation({
        id: 'hall-near', name: 'The Near Hall', kind: 'sect_seat',
        parentId: 'loc-here', qiDensity: 0.4
    }));
    state.locations.push(makeLocation({
        id: 'hall-far', name: 'The Far Hall', kind: 'sect_seat',
        parentId: 'loc-away', qiDensity: 0.4
    }));

    state.factions.push(makeFaction({
        id: 'house-high', name: 'The High House', seatLocationId: 'hall-far',
        resources: { power_ordinal: 42 }
    }));

    push(state, 'apex-a', 'Apex A', 42, 'hall-far');
    push(state, 'apex-b', 'Apex B', 41, 'hall-far');
    push(state, 'neighbour', 'A Neighbour', 3, 'hall-near');
    push(state, 'bystander', 'A Bystander', 40, 'hall-far');

    return { state };
}

function push(state: WorldState, id: string, name: string, ordinal: number, at: string): void {
    let npc: NpcRecord = createNpc(state.seed, {
        id, name, bornOnDay: state.currentDay - 365 * 200,
        onDay: state.currentDay, locationId: at, occupation: 'disciple'
    });
    npc = setRealm(npc, ordinal, state.currentDay);
    state.npcs.push(npc);
}

/** The one the design owner asked for: two of the world's tallest fell out. */
function theDuel(state: WorldState, opts: Partial<HistoricalFact> = {}): HistoricalFact {
    return appendWorldFact(state, makeFact({
        day: DAY - 365 * 5,
        kind: 'grudge_opened',
        scale: 'continental',
        magnitude: 0.9,
        visibility: 'public',
        locationId: 'hall-far',
        factionIds: ['house-high'],
        actors: [
            { id: 'apex-a', name: 'Apex A', role: 'claimant' },
            { id: 'apex-b', name: 'Apex B', role: 'refuser' }
        ],
        summary: 'Apex A asked the High House for a thing and Apex B refused in front of witnesses.',
        ...opts
    }));
}

/** Somebody nowhere near any of it, which is who gossip is for. */
const villager: TellerStanding = {
    id: 'neighbour', name: 'A Neighbour', realmOrdinal: 3,
    regionId: 'loc-here', factionId: null
};

/** Somebody who was standing there. */
const insider: TellerStanding = {
    id: 'bystander', name: 'A Bystander', realmOrdinal: 40,
    regionId: 'loc-away', factionId: 'house-high'
};

// ─────────────────────────────────────────────────────────────────────────

describe('what gets repeated', () => {
    it('ranks a thing far above the teller over a thing next door', () => {
        const { state } = build();
        theDuel(state);
        const local = appendWorldFact(state, makeFact({
            day: DAY - 365,
            kind: 'death',
            scale: 'local',
            magnitude: 0.2,
            visibility: 'public',
            locationId: 'hall-near',
            actors: [{ id: 'neighbour', name: 'A Neighbour', role: 'witness' }],
            summary: 'Somebody in the next street died.'
        }));

        const order = circulating(state, villager, DAY).map(f => f.id);
        expect(order[0]).not.toBe(local.id);
        expect(order).toContain(local.id);
    });

    it('does not repeat a secret, because a repeated secret is not one', () => {
        const { state } = build();
        const kept = theDuel(state, { visibility: 'secret' });
        expect(circulating(state, villager, DAY).map(f => f.id)).not.toContain(kept.id);
    });

    it('does not repeat something that has not happened yet', () => {
        const { state } = build();
        const later = theDuel(state, { day: DAY + 365 });
        expect(circulating(state, villager, DAY).map(f => f.id)).not.toContain(later.id);
    });
});

describe('how far it came', () => {
    it('is one hand for somebody who was there, whatever else is true of them', () => {
        const { state } = build();
        const fact = theDuel(state);
        const there: TellerStanding = { ...villager, id: 'apex-a' };
        expect(handsItPassedThrough(state, fact, there, DAY)).toBe(1);
        expect(fidelityAfter(1)).toBe(1);
    });

    it('costs a hand for every distance the world already stores', () => {
        const { state } = build();
        const fact = theDuel(state);
        const near = handsItPassedThrough(state, fact, insider, DAY);
        const far = handsItPassedThrough(state, fact, villager, DAY);
        // Different province, nine realms below, and not in the house: three
        // separate distances, all of them real rows.
        expect(far).toBeGreaterThan(near);
        expect(fidelityAfter(far)).toBeLessThan(fidelityAfter(near));
    });

    it('decays on the stated curve and never below zero', () => {
        expect(fidelityAfter(2)).toBeCloseTo(1 / (1 + HAND_DECAY), 10);
        expect(fidelityAfter(50)).toBeGreaterThan(0);
        expect(fidelityAfter(50)).toBeLessThan(0.1);
    });
});

describe('one teller, one version', () => {
    it('says the same thing however many times you ask', () => {
        const { state } = build();
        const fact = theDuel(state);
        const first = retell(state, fact, villager, DAY);
        const again = retell(state, fact, villager, DAY);
        expect(again.text).toBe(first.text);
        expect(again.distortion).toBe(first.distortion);
    });

    it('is not the same version somebody else gives you', () => {
        const { state } = build();
        const fact = theDuel(state);
        // Not an assertion that the TEXT differs - two tellers may both have it
        // right - but that the two are drawn independently, which is what makes
        // asking a second person worth doing.
        const one = retell(state, fact, villager, DAY);
        const other = retell(state, fact, insider, DAY);
        expect(other.hands).toBeLessThan(one.hands);
        expect(other.fidelity).toBeGreaterThan(one.fidelity);
    });

    it('gives a better-placed teller a better version of the SAME event', () => {
        const { state } = build();
        const fact = theDuel(state);
        const witness: TellerStanding = { ...insider, id: 'apex-b' };
        const close = retell(state, fact, witness, DAY);
        expect(close.distortion).toBe('intact');
        expect(close.factId).toBe(fact.id);
    });
});

describe('truth is a spectrum', () => {
    it('carries no boolean saying whether it is true', () => {
        const { state } = build();
        const rumour = retell(state, theDuel(state), villager, DAY);
        expect(Object.keys(rumour)).not.toContain('true');
        expect(Object.keys(rumour)).not.toContain('isTrue');
        expect(rumour.fidelity).toBeGreaterThan(0);
        expect(rumour.fidelity).toBeLessThanOrEqual(1);
    });

    it('never names anybody the world does not hold', () => {
        const { state } = build();
        const known = new Set([
            ...state.npcs.map(n => n.id),
            ...state.factions.map(f => f.id),
            ...state.locations.map(l => l.id)
        ]);
        theDuel(state);
        for (let seat = 0; seat < 40; seat++) {
            const teller: TellerStanding = { ...villager, id: `teller-${seat}` };
            for (const rumour of whatTheySay(state, teller, DAY)) {
                for (const named of rumour.named) expect(known.has(named.id)).toBe(true);
            }
        }
    });

    it('never tells the listener which part came off', () => {
        const { state } = build();
        theDuel(state);
        for (let seat = 0; seat < 40; seat++) {
            const teller: TellerStanding = { ...villager, id: `teller-${seat}` };
            for (const rumour of whatTheySay(state, teller, DAY)) {
                const text = rumour.text.toLowerCase();
                for (const tell of ['rumour', 'rumor', 'false', 'untrue', 'actually',
                    'in fact', 'wrongly', 'mistaken', 'distort']) {
                    expect(text).not.toContain(tell);
                }
            }
        }
    });

    it('produces more than one kind of wrongness across a population of tellers', () => {
        const { state } = build();
        theDuel(state);
        // Pooled across seats rather than asserted on one teller: a single
        // draw proves nothing about a distribution, and widening the bar on a
        // rare outcome is how a guard becomes decoration.
        const seen = new Set<string>();
        for (let seat = 0; seat < 200; seat++) {
            const teller: TellerStanding = { ...villager, id: `teller-${seat}` };
            for (const rumour of whatTheySay(state, teller, DAY)) seen.add(rumour.distortion);
        }
        expect(seen.has('intact')).toBe(true);
        expect(seen.size).toBeGreaterThanOrEqual(3);
    });

    it('makes every distortion visible in the sentence, or it did nothing', () => {
        // The regression this pins: `misattributed` swapped the actor list on a
        // fact whose sentence names the HOUSE, so the distorted telling and the
        // true one came out byte-identical. A distortion that moves a field the
        // rendering never reads is not a distortion.
        const { state } = build();
        // Old enough that every band is on the table, including the when.
        const fact = theDuel(state, { day: DAY - 365 * 200 });
        const straight = new Set<string>();
        const bent = new Map<string, string>();
        for (let seat = 0; seat < 300; seat++) {
            const teller: TellerStanding = { ...villager, id: `teller-${seat}` };
            const rumour = retell(state, fact, teller, DAY);
            if (rumour.distortion === 'intact') straight.add(rumour.text);
            else bent.set(rumour.distortion, rumour.text);
        }
        expect(straight.size).toBe(1);
        expect(bent.size).toBeGreaterThanOrEqual(3);
        for (const [distortion, text] of bent) {
            expect(`${distortion}: ${text}`).not.toBe(`${distortion}: ${[...straight][0]}`);
        }
    });

    it('drops the fact id only when the event itself did not happen', () => {
        const { state } = build();
        const fact = theDuel(state);
        for (let seat = 0; seat < 200; seat++) {
            const teller: TellerStanding = { ...villager, id: `teller-${seat}` };
            const rumour = retell(state, fact, teller, DAY);
            if (rumour.distortion === 'invented') expect(rumour.factId).toBeNull();
            else expect(rumour.factId).toBe(fact.id);
        }
    });
});

describe('what a market holds', () => {
    it('answers with a handful and never with a briefing', () => {
        const { state } = build();
        for (let i = 0; i < 30; i++) theDuel(state, { day: DAY - 365 * (i + 1) });
        expect(whatTheySay(state, villager, DAY).length).toBeLessThanOrEqual(3);
    });

    it('is empty in a world nothing has happened in', () => {
        const { state } = build();
        expect(whatTheySay(state, villager, DAY)).toEqual([]);
    });
});
