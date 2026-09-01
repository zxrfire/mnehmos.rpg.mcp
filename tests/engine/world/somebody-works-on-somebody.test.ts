/**
 * The world's half of `engine/social-leverage/`, and the guard on the defect
 * that kept it at zero.
 *
 * This test exists because four separate gates each independently held the
 * world's rate at exactly zero and NOT ONE of them was caught by a unit test.
 * Every one passed a test asserting "the resolver returns a result": the
 * resolver was always fine. What was broken was the caller, and the only thing
 * that notices a caller which can never succeed is a measurement of the rate.
 *
 * The four, all found by `scripts/probe-does-anybody-actually-work-on-anybody.ts`:
 *
 *   1. the actor drawn uniformly from everybody alive, so no pair was ever
 *      revisited and every attachment in the world was somebody's first
 *   2. the transaction tie written symmetrically, so bought ties swamped the
 *      one-sided ones the discovery half looks for
 *   3. the discovery requiring an actor who, five centuries on, was dead
 *   4. worst, the ask read off faction hostility, so anybody with a house was
 *      opened at 0.5 of resistance against a base of 0.35 and floored at 2%
 *
 * So the assertions here are about RATES over a real span, not about one call.
 * They are deliberately loose - this is a floor against zero, not a pin on a
 * tuning table, and a test that pins the rate would go red every time somebody
 * touches an unrelated weight.
 */

import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { pressureTemplates } from '../../../src/engine/world/pressure.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function world(seed: string): WorldState {
    return seedWorld({
        seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
    }).state;
}

function runCenturies(seed: string, centuries: number) {
    const state = world(seed);
    const out = applyPressure(state, state.currentDay, state.currentDay + centuries * 100 * YEAR);
    const counts = new Map<string, number>();
    for (const event of out.events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    return { state, counts };
}

describe('the world runs manoeuvres on people, and not at zero', () => {
    it('has both templates in the table', () => {
        const kinds = pressureTemplates().map(t => t.kind);
        expect(kinds).toContain('leverage_applied');
        expect(kinds).toContain('leverage_understood');
    });

    it('fires them at a rate comparable to killings, not once a millennium', () => {
        const { counts } = runCenturies('lev-rate', 5);
        const applied = counts.get('leverage_applied') ?? 0;
        // Measured at 2.8-6.4 a century across three seeds. The bar is a floor
        // against the four zero-rate defects above, deliberately well under it.
        expect(applied).toBeGreaterThanOrEqual(5);
    });

    /**
     * Aggregated over seeds on purpose, and this is a finding rather than a
     * convenience: an attachment chain is rare enough that a single 500-year
     * world can contain none at all. `lev-rate` alone has zero. Three seeds
     * reliably have some.
     *
     * So the guard is against ZERO ACROSS THE BOARD, which is what all four
     * defects produced, and not against a particular seed being quiet - a
     * quiet seed is the world working. Whether roughly one chain per world per
     * few centuries is the right ambient rate is a tuning question for a
     * person, and it is deliberately not being answered by widening this bar.
     */
    it('lets attachments actually LAND, which for a long time none ever did', () => {
        let landed = 0;
        let strongest = 0;
        for (const seed of ['lev-rate', 'lev-b', 'lev-c']) {
            const { state } = runCenturies(seed, 5);
            const isLeverage = (id: string) =>
                state.history.facts.find(f => f.id === id)?.data?.pressure === 'leverage_applied';
            for (const npc of state.npcs) {
                for (const tie of npc.relationships) {
                    if (!tie.factIds.some(isLeverage)) continue;
                    if (tie.kind === 'ally') landed++;
                    strongest = Math.max(strongest, tie.standing);
                }
            }
        }
        expect(landed).toBeGreaterThan(0);
        // And they have to BUILD. A world where every one sits at its opening
        // 0.22 forever is the world before the campaign loop existed, and the
        // discovery half can never see one.
        expect(strongest).toBeGreaterThan(0.45);
    });

    it('produces one-sided ties - the shape the whole subsystem is about', () => {
        const { state } = runCenturies('lev-rate', 5);
        let oneWay = 0;
        for (const npc of state.npcs) {
            for (const tie of npc.relationships) {
                if (tie.standing < 0.45) continue;
                const other = state.npcs.find(n => n.id === tie.targetId);
                const back = other?.relationships.find(r => r.targetId === npc.id);
                if (!back || back.standing < 0.3) oneWay++;
            }
        }
        expect(oneWay).toBeGreaterThan(0);
    });

    it('is deterministic - same seed, same span, same events', () => {
        const a = runCenturies('lev-det', 3);
        const b = runCenturies('lev-det', 3);
        expect([...a.counts].sort()).toEqual([...b.counts].sort());
    });

    it('never names anybody in the line a stranger would hear', () => {
        const { state, counts } = runCenturies('lev-rate', 5);
        expect(counts.get('leverage_applied') ?? 0).toBeGreaterThan(0);
        const names = state.npcs.slice(0, 200).map(n => n.name)
            .concat(state.factions.map(f => f.name));
        for (const fact of state.history.facts) {
            const pressure = fact.data?.pressure;
            if (pressure !== 'leverage_applied' && pressure !== 'leverage_understood') continue;
            const unattributed = String(fact.data?.unattributed ?? '');
            expect(unattributed.length).toBeGreaterThan(10);
            for (const name of names) expect(unattributed).not.toContain(name);
        }
    });
});
