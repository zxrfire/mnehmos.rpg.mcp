/**
 * A deed enters the world as a fact.
 *
 * The contract, stated as tests:
 *
 *   - it goes through the world's own write path, so the fact lands on the
 *     record of everybody it names and the people standing there are drawn
 *     from the place
 *   - a caller that already decided the weight has it carried through
 *     untouched; nothing is re-priced
 *   - a caller that has NOT decided is priced by `whatADeedLeaves`, in both
 *     directions, off cost against what the payer had
 *   - the weight reaches `magnitude`, which is the field the digest filters on
 *     and the first term in what gets repeated
 *   - a deed nobody worked out is written `secret`, which is the one state
 *     `circulating` excludes outright
 *   - nothing branches on the deed's name
 *   - two deeds are two rows, whatever their summaries have in common
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { circulating } from '../../../src/engine/world/what-people-are-saying.js';
import {
    aDeedEntersTheWorld,
    type ADeedTheWorldShouldHold
} from '../../../src/engine/world/a-deed-enters-the-world-as-a-fact.js';
import type { Party } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';

const DAY = 400_000;

function build(): WorldState {
    const state = createWorld({ seed: 'deed-world', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-square', name: 'The Square', kind: 'settlement', qiDensity: 0.4
    }));
    for (let n = 0; n < 12; n++) {
        state.npcs.push(createNpc(state.seed, {
            id: `npc-${n}`,
            name: `Bystander ${n}`,
            bornOnDay: DAY - 40 * 365,
            onDay: DAY,
            locationId: 'loc-square',
            cultivation: { realmOrdinal: 5 }
        }));
    }
    state.npcs.push(createNpc(state.seed, {
        id: 'the-player',
        name: 'Duellist',
        bornOnDay: DAY - 20 * 365,
        onDay: DAY,
        locationId: null,
        cultivation: { realmOrdinal: 5 }
    }));
    return state;
}

const AT_HAND: Omit<ADeedTheWorldShouldHold, 'weight' | 'price'> = {
    kind: 'betrayal',
    day: DAY,
    locationId: 'loc-square',
    actors: [{ id: 'the-player', name: 'Duellist', role: 'did it' }],
    summary: 'Duellist did a thing at The Square.',
    unattributed: 'Something happened in the square and nobody will say what.'
};

function party(over: Partial<Party> = {}): Party {
    return {
        id: 'somebody',
        name: 'Somebody',
        houseId: null,
        houseName: null,
        alignment: null,
        ranked: false,
        ...over
    };
}

describe('it goes through the world\'s own write path', () => {
    it('lands the fact on the record of everybody it names', () => {
        const state = build();
        const { fact } = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'serious' });

        const player = state.npcs.find(n => n.id === 'the-player')!;
        expect(player.historyFactIds).toContain(fact.id);
        // And it is in the ledger, which is the table every propagation system
        // in the repository reads and nothing a player did used to write to.
        expect(state.history.facts.map(f => f.id)).toContain(fact.id);
    });

    it('draws the people who were standing there from the place', () => {
        const state = build();
        const { fact } = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'serious' });

        expect(fact.witnessIds.length).toBeGreaterThan(1);
        expect(fact.witnessIds).toContain('the-player');
        for (const id of fact.witnessIds) {
            expect(state.npcs.some(n => n.id === id), id).toBe(true);
        }
    });

    it('names nobody where the world does not model the place', () => {
        const state = build();
        const { fact } = aDeedEntersTheWorld(state, {
            ...AT_HAND, weight: 'serious', locationId: null
        });
        expect(fact.witnessIds).toEqual(['the-player']);
    });

    it('writes two rows for two deeds that read the same', () => {
        const state = build();
        const one = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'grave' });
        const two = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'grave' });
        expect(one.fact.id).not.toBe(two.fact.id);
    });
});

describe('the weight is decided exactly once', () => {
    it('carries a decided weight through untouched', () => {
        const state = build();
        for (const weight of ['slight', 'serious', 'grave', 'unforgivable'] as const) {
            const written = aDeedEntersTheWorld(state, { ...AT_HAND, weight });
            expect(written.weight).toBe(weight);
            expect(written.leaves, 'nothing was priced here').toBeNull();
        }
    });

    it('prices a deed nobody decided, off cost against what the payer had', () => {
        const state = build();
        const cheap = aDeedEntersTheWorld(state, {
            ...AT_HAND,
            kind: 'debt_incurred',
            price: {
                deed: {
                    cause: 'gifted_resource', paidBy: 'actor', cost: 0.05, onDay: DAY,
                    description: 'A little.', witnesses: 1
                },
                actor: party({ id: 'the-player', name: 'Duellist' }),
                subject: party({ id: 'house', name: 'A House' })
            }
        });
        const dear = aDeedEntersTheWorld(state, {
            ...AT_HAND,
            kind: 'debt_incurred',
            price: {
                deed: {
                    cause: 'gifted_resource', paidBy: 'actor', cost: 0.9, onDay: DAY,
                    description: 'Most of what they had.', witnesses: 1, irreversible: true
                },
                actor: party({ id: 'the-player', name: 'Duellist' }),
                subject: party({ id: 'house', name: 'A House' })
            }
        });

        expect(cheap.leaves, 'the deed module answered').not.toBeNull();
        expect(dear.fact.magnitude).toBeGreaterThan(cheap.fact.magnitude);
    });

    /**
     * The same sum is a different deed depending on who paid it, which is the
     * whole argument of `what-a-deed-leaves.ts` and is unreachable from the
     * amount alone.
     */
    it('prices the same transfer differently for a rich payer and a poor one', () => {
        const state = build();
        const priced = (cost: number): number => aDeedEntersTheWorld(state, {
            ...AT_HAND,
            kind: 'debt_incurred',
            price: {
                deed: {
                    cause: 'gifted_resource', paidBy: 'actor', cost, onDay: DAY,
                    description: '100 stones.', witnesses: 1
                },
                actor: party({ id: 'the-player', name: 'Duellist' }),
                subject: party({ id: 'house', name: 'A House' })
            }
        }).fact.magnitude;

        // 100 stones off somebody carrying 110, against 100 off somebody
        // carrying 10,000.
        expect(priced(0.91)).toBeGreaterThan(priced(0.01));
    });
});

describe('what the weight reaches', () => {
    it('puts the weight on magnitude, monotonically', () => {
        const state = build();
        const magnitudes = (['slight', 'serious', 'grave', 'unforgivable'] as const)
            .map(weight => aDeedEntersTheWorld(state, { ...AT_HAND, weight }).fact.magnitude);
        for (let n = 1; n < magnitudes.length; n++) {
            expect(magnitudes[n]).toBeGreaterThan(magnitudes[n - 1]);
        }
    });

    /**
     * The point of the field. A heavier deed outranks a lighter one in what a
     * market repeats, because `airtimeOf`'s first term is the magnitude.
     */
    it('makes a heavier deed better gossip than a lighter one', () => {
        const state = build();
        const light = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'slight' }).fact;
        const heavy = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'unforgivable' }).fact;

        const pool = circulating(state, {
            id: 'npc-0', name: 'Bystander 0', realmOrdinal: 5,
            regionId: null, factionId: null
        }, DAY, 5000);
        const ids = pool.map(f => f.id);
        expect(ids).toContain(heavy.id);
        expect(ids.indexOf(heavy.id)).toBeLessThan(ids.indexOf(light.id));
    });
});

describe('a deed nobody worked out', () => {
    it('is in the world and is not repeated', () => {
        const state = build();
        const { fact } = aDeedEntersTheWorld(state, {
            ...AT_HAND, weight: 'grave', workedOut: false
        });

        expect(fact.visibility).toBe('secret');
        // It happened. The world holds it, and somebody working it out later is
        // a dated event with its own consequences.
        expect(state.history.facts.map(f => f.id)).toContain(fact.id);
        // And nobody is repeating it, because `circulating` excludes `secret`.
        const pool = circulating(state, {
            id: 'npc-0', name: 'Bystander 0', realmOrdinal: 5,
            regionId: null, factionId: null
        }, DAY, 5000);
        expect(pool.map(f => f.id)).not.toContain(fact.id);
    });

    /**
     * `Deed.knownTo` is the deed module's own answer to the same question, so
     * where it priced the deed its answer is the one that stands and the caller
     * does not say it twice.
     */
    it('takes the deed module\'s answer where the deed module priced it', () => {
        const state = build();
        const { fact, leaves } = aDeedEntersTheWorld(state, {
            ...AT_HAND,
            price: {
                deed: {
                    cause: 'harvested', paidBy: 'subject', cost: 0.9, onDay: DAY,
                    description: 'Nobody has any idea.', irreversible: true,
                    // Nobody who could open an account knows there was a deed.
                    knownTo: []
                },
                actor: party({ id: 'the-player', name: 'Duellist' }),
                subject: party({ id: 'victim', name: 'Victim' })
            },
            // Deliberately contradicted, and deliberately ignored.
            workedOut: true
        });

        expect(leaves!.reached).toBe('nobody has worked it out');
        expect(fact.visibility).toBe('secret');
        expect(fact.causeKnown).toBe(false);
    });
});

describe('nothing branches on what the deed was', () => {
    it('has no switch on the ledger kind', () => {
        // Comments stripped first, and the reason is worth keeping: the
        // module's own header PROMISES there is no switch on the kind, in
        // those words, so a naive read of the file finds the promise and
        // reports it as the violation.
        const code = readFileSync('src/engine/world/a-deed-enters-the-world-as-a-fact.ts', 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        expect(/switch\s*\(\s*(?:input\.)?kind\s*\)/.test(code)).toBe(false);
        expect(/switch\s*\(\s*(?:input\.)?(?:deed\.)?cause\s*\)/.test(code)).toBe(false);
        // And it does not read the cause at all, in any form.
        expect(/\bcause\b/.test(code)).toBe(false);
    });

    it('writes the same row for two kinds that differ only in the word', () => {
        const state = build();
        const one = aDeedEntersTheWorld(state, { ...AT_HAND, kind: 'betrayal', weight: 'grave' });
        const two = aDeedEntersTheWorld(state, {
            ...AT_HAND, kind: 'resource_contested', weight: 'grave'
        });
        expect(two.fact.magnitude).toBe(one.fact.magnitude);
        expect(two.fact.visibility).toBe(one.fact.visibility);
        expect(two.fact.scale).toBe(one.fact.scale);
    });
});

describe('the name-free line', () => {
    /**
     * `unattributedTextOf` falls back to a shrug for a kind it has not been
     * taught, so a fact written without one reaches every stranger in the
     * province saying nothing. It is required by the type; this checks it
     * actually lands on the row where the digest looks for it.
     */
    it('is on the row where the digest reads it', () => {
        const state = build();
        const { fact } = aDeedEntersTheWorld(state, { ...AT_HAND, weight: 'grave' });
        expect(fact.data.unattributed).toBe(AT_HAND.unattributed);
    });
});
