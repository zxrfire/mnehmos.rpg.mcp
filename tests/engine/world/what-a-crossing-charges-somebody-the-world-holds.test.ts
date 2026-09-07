/**
 * The Price of Advancement bound the player and nobody else.
 *
 * `attemptBreakthrough` states what a caller that hands over nothing gets:
 * *"Omitting this does not skip the toll ... it charges with no candidates,
 * which surfaces as `nothing_left`. A caller that owns bonds, memories and
 * techniques must supply them here."*
 *
 * Every player route supplied it, through `tollConditionsFor`. `strikeAtTheWall`
 * passed `rng`, `ambient`, `turn` and an optional watch, and no `toll` at all,
 * while the world owned every input kind it asks for: `relationships` on the
 * record, `techniqueIds` beside them, and a memory store the caller can read.
 *
 * So every cultivator in every world crossed every realm boundary free, and
 * only the player lost a bond, an art or their name. That is the largest
 * permanent cost in the game, charged to one person in the world.
 *
 * This is the sibling of `npc-crossing-toll.test.ts`, which pins the OTHER
 * toll: `bodyCost`, the share of the pool, which was fixed for the same reason
 * and quotes the same AGENTS.md rule. *"Any capability the world gives a
 * non-player is a capability the player has, through the same code"*, and a
 * rule that binds the player and not an NPC is that failure with the sign
 * flipped.
 *
 *  * MEASURED, before and after, at the ordinal-16 boundary in thin qi over 3,000
 * seeds, for somebody holding four ties and four arts. The same 76 crossings
 * are charged either way, and the same 34 of them fail the roll:
 *
 *     before   clean 42, nothing_left 34, took something 0
 *     after    clean 42, taken        34, took something 34
 *
 * So the charge was always landing. It simply had nothing in front of it, and
 * booked the outcome that means "there was nothing worth taking" about people
 * holding four ties and four arts.
 *
 * What is asserted is not a rate. It is that the world's crossing has
 * something to charge, that what it charges comes off the record, and that
 * somebody who genuinely holds nothing still reads `nothing_left` rather than
 * being spared by an empty list nobody filled in.
 */

import { describe, expect, it } from 'vitest';

import { createNpc } from '../../../src/engine/world/npc-state';
import {
    strikeAtTheWall,
    whatACrossingCouldTakeFrom
} from '../../../src/engine/world/an-npc-striking-at-the-next-wall';
import { CultivationRNG } from '../../../src/engine/cultivation/rng';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation';
import { TOLL_BOUNDARY_ORDINALS } from '../../../src/engine/cultivation/price-of-advancement';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques';

/**
 * A real boundary the world's own crossing can actually reach.
 *
 * Not the highest one, because a subject built here in isolation holds only the
 * PRACTICE channel and that channel is thin: 22 of 155 catalog arts teach a
 * road, so six arts usually teach none, and `canAttemptBreakthrough` then
 * refuses at ordinal 20 and above with `insufficient_dao`.
 *
 * THAT IS A FACT ABOUT THIS FIXTURE AND NOT ABOUT THE WORLD, and an earlier
 * draft of this header got it wrong. The world supplies a second channel:
 * `the-world-changing-on-its-own.ts` hands `roadsInReachOf(state, npc)` to
 * `strikeAtTheWall`, and `probe-can-the-world-feed-the-dao-gate.ts` measures
 * what that is worth over 600 years on two seeds:
 *
 *     band            people   roads: practice / ground   would pass
 *     Nascent 21-24       55           1.13 / 1.24          35 / 55
 *     Deity 25-28         33           1.18 / 1.79          16 / 33
 *     Void 29-32          17           1.94 / 2.82          12 / 17
 *
 * So the world does cross above Core Formation, on ground rather than on
 * practice. What an NPC still never gets is an insight formed by an EVENT, the
 * way a player does from a tribulation survived or a rare meditative state,
 * and that asymmetry is its own piece of work.
 *
 * What matters for this file is only that the boundary chosen is one this
 * fixture reaches without having to build a world, so the test stays a unit.
 */
const AT_A_BOUNDARY = TOLL_BOUNDARY_ORDINALS[1]!;
const DAY = 400 * DAYS_PER_YEAR;

/** Two arts anybody at this rung could be holding, read out of the catalog. */
const ARTS = TECHNIQUES.filter(t => t.requiredOrdinal <= AT_A_BOUNDARY).slice(0, 4).map(t => t.id);

const READY = { yearsNeeded: 1, yearsAccumulated: 1, yearsStood: 1, ready: true, settled: false };

function somebody(seed: string, ties: number, arts: readonly string[]) {
    const npc = createNpc(seed, {
        id: `crosser-${seed}`,
        name: 'A Crosser',
        bornOnDay: 0,
        onDay: DAY,
        cultivation: { realmOrdinal: AT_A_BOUNDARY, techniqueIds: [...arts] }
    });
    return {
        ...npc,
        cultivation: { ...npc.cultivation, accumulatingSinceDay: 0 },
        relationships: Array.from({ length: ties }, (_, i) => ({
            targetId: `tied-${i}`,
            targetName: `Somebody ${i}`,
            kind: 'kin' as const,
            standing: 0.6,
            note: 'a tie',
            sinceDay: 0,
            lastChangedDay: 0,
            factIds: [],
            inheritedFromId: null
        }))
    };
}

describe('what a crossing could take from somebody the world holds', () => {
    it('offers the ties and the arts that are on the record', () => {
        const at_stake = whatACrossingCouldTakeFrom(somebody('offer', 4, ARTS));
        expect(at_stake.filter(c => c.kind === 'bond')).toHaveLength(4);
        expect(at_stake.filter(c => c.kind === 'technique')).toHaveLength(ARTS.length);
        // Every candidate is a row the severance could actually delete.
        for (const c of at_stake) {
            expect(c.id.length).toBeGreaterThan(0);
            expect(c.label.length).toBeGreaterThan(0);
        }
    });

    it('offers nothing for somebody who holds nothing, which is a real answer', () => {
        expect(whatACrossingCouldTakeFrom(somebody('empty', 0, []))).toEqual([]);
    });

    /**
     * THE REGRESSION, AND IT IS ABOUT WHAT IS TAKEN RATHER THAN HOW OFTEN.
     *
     * Before the wiring the crossing ran with an empty candidate list, so the
     * only outcome it could ever book was `nothing_left`. What proves the fix
     * is not a rate: it is that when the charge lands, the thing it takes is a
     * row that was on this person's record.
     *
     * Thin qi raises the toll risk, which is what makes a taking observable in
     * a bounded sweep rather than needing tens of thousands of seeds. It
     * changes which outcomes appear and nothing about where a candidate came
     * from.
     */
    it('takes something that was actually on the record', () => {
        const outcomes = new Map<string, number>();
        let charged = 0;
        let takings = 0;

        for (let seed = 0; seed < 3000; seed++) {
            const who = somebody(`charge-${seed}`, 4, ARTS);
            const offered = new Set(whatACrossingCouldTakeFrom(who).map(c => c.id));
            const out = strikeAtTheWall(
                who,
                DAY,
                READY,
                new CultivationRNG(`charge-strike-${seed}`),
                'thin'
            );
            if (out === null || out.result.toll === null) continue;
            charged++;
            outcomes.set(out.result.toll.outcome, (outcomes.get(out.result.toll.outcome) ?? 0) + 1);

            for (const taken of out.result.toll.takenAll) {
                takings++;
                // The whole point. A crossing cannot take what the person did
                // not have, and before this it could not take anything at all.
                expect(offered.has(taken.id), `took ${taken.id}, which was never offered`).toBe(true);
            }
        }

        // eslint-disable-next-line no-console
        console.log(
            `  ${charged} crossings charged over 3000 seeds, ${takings} took something:`,
            JSON.stringify(Object.fromEntries(outcomes))
        );

        expect(charged, 'no crossing charged a toll at all').toBeGreaterThan(0);
        expect(takings, 'the toll never took anything, so the candidates are not reaching it')
            .toBeGreaterThan(0);
        // And it is never the empty-list answer, because the list is not empty.
        expect(outcomes.get('nothing_left') ?? 0).toBe(0);
    });

    /**
     * CHARGED IS NOT COLLECTED, AND THE FIRST CUT OF THIS ONLY CHARGED.
     *
     * A ledger that says a bond was severed while the bond is still on the row
     * is worse than never charging: every later read disagrees with the account
     * of the crossing, and the disagreement is invisible because both halves
     * look right on their own. The player's side has collected since it was
     * written; this asserts the world's does too.
     */
    it('removes what it took from the record', () => {
        let checked = 0;
        for (let seed = 0; seed < 3000 && checked < 12; seed++) {
            const before = somebody(`collect-${seed}`, 4, ARTS);
            const out = strikeAtTheWall(
                before,
                DAY,
                READY,
                new CultivationRNG(`charge-strike-${seed}`),
                'thin'
            );
            const taken = out?.result.toll?.takenAll ?? [];
            if (taken.length === 0) continue;
            checked++;

            const ties = new Set(out!.npc.relationships.map(t => `tie:${before.id}:${t.targetId}`));
            const arts = new Set(out!.npc.cultivation.techniqueIds);
            for (const one of taken) {
                if (one.id === null) continue;
                if (one.kind === 'bond') {
                    expect(ties.has(one.id), `bond ${one.id} was taken and is still held`).toBe(false);
                }
                if (one.kind === 'technique') {
                    expect(arts.has(one.id), `art ${one.id} was taken and is still held`).toBe(false);
                }
            }
            // And it took exactly what it said: nothing else left the record.
            expect(out!.npc.relationships.length + out!.npc.cultivation.techniqueIds.length)
                .toBe(before.relationships.length + before.cultivation.techniqueIds.length - taken.length);
        }
        expect(checked, 'no crossing took anything, so collection was never exercised')
            .toBeGreaterThan(0);
    });

    /** And somebody genuinely empty-handed still reads as empty-handed. */
    it('still books nothing_left for somebody who truly holds nothing', () => {
        let sawNothingLeft = false;
        for (let seed = 0; seed < 200 && !sawNothingLeft; seed++) {
            const out = strikeAtTheWall(
                somebody(`bare-${seed}`, 0, []),
                DAY,
                READY,
                new CultivationRNG(`bare-strike-${seed}`),
                'normal'
            );
            if (out?.result.toll?.outcome === 'nothing_left') sawNothingLeft = true;
        }
        expect(sawNothingLeft).toBe(true);
    });
});
