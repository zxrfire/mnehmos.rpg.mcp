/**
 * A witness is stored on the fact and could not be asked what they saw.
 *
 * `whoWasThere` writes `witnessIds` on every world fact, and the only read that
 * ever went back the other way was `trajectoryOf`, which is deliberately
 * ACTORS-ONLY: linking bystanders into `historyFactIds` once made the
 * most-documented person in a six-hundred-year world carry 131 rows of which
 * about a dozen were about them, and a life read as a police blotter for a
 * postcode. That ruling stands and the first test below pins it.
 *
 * What was missing is the read that was never built rather than the one that was
 * built wrong. Ask a person what happened TO them and the engine answers; ask a
 * person what they SAW and there was nothing to ask - which is most of what a
 * witness is for, since the whole value of having been there is being the one
 * who can tell somebody about it.
 *
 * And the second half was a comment that had come apart from its code.
 * `linkFactToWhoItNames` bumps `lastConfirmedOnDay` under the sentence
 * "somebody who was standing there was, demonstrably, still around" - which is
 * an argument about WITNESSES, applied to actors only. So a bystander drawn into
 * a fact in year 3000 kept whatever staleness they had before it, and the world
 * held proof they were alive that nothing read.
 */

import { describe, it, expect } from 'vitest';

import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import {
    appendWorldFact,
    trajectoryOf,
    whatTheySaw
} from '../../../src/engine/world/who-was-there-when-it-happened.js';

const DAY = 365 * 1_000;

function build(): WorldState {
    const state = createWorld({ seed: 'witness-test', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'town', name: 'The Town', kind: 'settlement', qiDensity: 0.4
    }));
    push(state, 'doer', 'The Doer', 8);
    push(state, 'onlooker', 'An Onlooker', 4);
    return state;
}

function push(state: WorldState, id: string, name: string, ordinal: number): void {
    let npc: NpcRecord = createNpc(state.seed, {
        id, name, bornOnDay: DAY - 365 * 300,
        onDay: DAY - 365 * 50, locationId: 'town', occupation: 'disciple'
    });
    npc = setRealm(npc, ordinal, DAY - 365 * 50);
    state.npcs.push(npc);
}

function aKilling(state: WorldState) {
    return appendWorldFact(state, makeFact({
        day: DAY,
        kind: 'death',
        scale: 'local',
        magnitude: 0.5,
        visibility: 'public',
        locationId: 'town',
        actors: [{ id: 'doer', name: 'The Doer', role: 'killer' }],
        summary: 'The Doer killed somebody in the street at The Town.'
    }), { recur: false });
}

function npc(state: WorldState, id: string): NpcRecord {
    const found = state.npcs.find(n => n.id === id);
    if (!found) throw new Error(`no such person: ${id}`);
    return found;
}

// ─────────────────────────────────────────────────────────────────────────

describe('a trajectory is what happened to you', () => {
    it('keeps somebody else\'s business off it', () => {
        const state = build();
        const fact = aKilling(state);
        expect(fact.witnessIds).toContain('onlooker');
        expect(npc(state, 'onlooker').historyFactIds).not.toContain(fact.id);
        expect(trajectoryOf(state, npc(state, 'onlooker')).map(f => f.id)).not.toContain(fact.id);
        // And the person it is about still has it.
        expect(trajectoryOf(state, npc(state, 'doer')).map(f => f.id)).toContain(fact.id);
    });
});

describe('and what you saw is a second thing you can be asked', () => {
    it('answers with everything this person was standing in front of', () => {
        const state = build();
        const fact = aKilling(state);
        expect(whatTheySaw(state, npc(state, 'onlooker')).map(f => f.id)).toContain(fact.id);
    });

    it('answers with nothing for somebody who was somewhere else', () => {
        const state = build();
        aKilling(state);
        push(state, 'elsewhere', 'Somebody Elsewhere', 4);
        const away = { ...npc(state, 'elsewhere'), locationId: 'nowhere-near' };
        expect(whatTheySaw(state, away)).toEqual([]);
    });

    it('is in the order it happened, like the trajectory beside it', () => {
        const state = build();
        const first = aKilling(state);
        const second = appendWorldFact(state, makeFact({
            day: DAY + 365, kind: 'war', scale: 'local', magnitude: 0.5,
            visibility: 'public', locationId: 'town',
            actors: [{ id: 'doer', name: 'The Doer', role: 'claimant' }],
            summary: 'The Doer went to war a year later.'
        }), { recur: false });
        expect(whatTheySaw(state, npc(state, 'onlooker')).map(f => f.id))
            .toEqual([first.id, second.id]);
    });
});

describe('and the world a seed builds is the world it built before', () => {
    /**
     * The control arm for the one change here that sits on the generation path.
     *
     * `linkFactToWhoItNames` is called by seeding, so widening the loop it runs
     * is a change to what every world comes out holding. Two things are checked
     * rather than a suite reading, because a stash-and-rerun is not an arm and
     * both of these run in one command:
     *
     *   the same seed builds the same world       nothing was added to an
     *                                             existing RNG stream, so no
     *                                             later draw moved off it
     *   the trajectory still holds actors only    the widened loop writes
     *                                             `historyFactIds` under exactly
     *                                             the condition it wrote it
     *                                             under before, so the only
     *                                             field that can have moved is
     *                                             `lastConfirmedOnDay`
     */
    const SEED = 'unchanged-world';

    it('builds byte-for-byte the same world twice from one seed', () => {
        const first = createWorld({ seed: SEED });
        const again = createWorld({ seed: SEED });
        expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    });

    it('writes a trajectory of exactly the facts that name somebody', () => {
        const state = createWorld({ seed: SEED });
        expect(state.history.facts.length).toBeGreaterThan(0);

        const named = new Map<string, string[]>();
        for (const fact of state.history.facts) {
            for (const actor of fact.actors) {
                if (!state.npcs.some(n => n.id === actor.id)) continue;
                const held = named.get(actor.id) ?? [];
                if (!held.includes(fact.id)) held.push(fact.id);
                named.set(actor.id, held);
            }
        }
        for (const npc of state.npcs) {
            expect(npc.historyFactIds.slice().sort())
                .toEqual((named.get(npc.id) ?? []).slice().sort());
        }
    });
});

describe('standing there is proof you were alive', () => {
    it('confirms a bystander on the day, not only the people it names', () => {
        const state = build();
        const before = npc(state, 'onlooker').lastConfirmedOnDay;
        expect(before).toBeLessThan(DAY);
        aKilling(state);
        expect(npc(state, 'onlooker').lastConfirmedOnDay).toBe(DAY);
        expect(npc(state, 'doer').lastConfirmedOnDay).toBe(DAY);
    });
});
