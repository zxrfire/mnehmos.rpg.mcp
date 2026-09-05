/**
 * Swallowing a chaos-grade pill, through the surface a player actually reaches.
 *
 * `GameService.consumePill` delegates to `handleConsumePill`, so this drives the
 * one resolver both the played game and the MCP tool go through - which is the
 * point of testing it here rather than against the engine module next door.
 * `grade-spread.test.ts` pins the derivation; this pins that the WORLD changes.
 *
 * The design, in the owner's words:
 *
 *   > chaos grade is equal to immortal grade but it's got random effects which
 *   > may be bad (whereas immortal ones are uniformly positive)
 *
 *   > anyone lesser taking a chaos pill is again very risky (and they increase
 *   > the odds of self detonation)
 *
 * So there are two lives in here and they play completely differently. Somebody
 * standing at the rung the thing is pitched at is taking a gamble across the
 * whole spread. Somebody far under it is mostly holding a bomb - and that is
 * one mechanism rather than two, because the pill holds a fixed quantity and a
 * body too small to hold it is the danger.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { addToPouch, ensureCultivationDb, readFlag } from '../../src/server/consolidated/cultivation-support.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { isSettledOnUse } from '../../src/engine/cultivation/grade-spread.js';
import { pillBandOrdinal } from '../../src/engine/cultivation/breakthrough.js';

const ctx = { sessionId: 'chaos-pill-test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: any) => payload(await handleAlchemyManage(args, ctx) as any);
const cultivation = async (args: any) => payload(await handleCultivationManage(args, ctx) as any);

const CHAOS_PILL = PILLS.find(p => p.grade === 'chaos')!;
const IMMORTAL_PILL = PILLS.find(p => p.grade === 'immortal')!;
/** The rung both top grades are pitched at, read off the catalog. */
const PITCH = pillBandOrdinal('chaos');

beforeEach(() => {
    closeDb();
    getDb(':memory:');
});

afterEach(() => {
    closeDb();
});

/**
 * A life holding some pills, optionally standing where the thing is pitched.
 *
 * ARRANGING A PRECONDITION, not asserting a result. A cultivator who can
 * actually carry one of these is rare enough that a seeded run will not hand us
 * one, and the whole spread is unreachable from the bottom of the ladder.
 */
async function aLifeHolding(
    pillId: string,
    quantity: number,
    seed: string,
    opts: { atOrdinal?: number } = {}
) {
    const created = await cultivation({
        action: 'create_cultivator',
        name: 'Shen Yue',
        seed,
        location: 'Burnt Earth'
    });
    expect(created.error).toBeUndefined();
    const repos = ensureCultivationDb();
    if (opts.atOrdinal) {
        repos.cultivators.advanceRealm(created.cultivator.id, opts.atOrdinal);
    }
    addToPouch(repos.db, created.cultivator.id, pillId, 'pill', quantity);
    return created.cultivator.id;
}

describe('a chaos pill is not the same twice, and an immortal one is', () => {
    it('the immortal pill does the same thing on every seed', async () => {
        expect(isSettledOnUse('immortal')).toBe(false);
        const seen = new Set<string>();
        for (const seed of ['alpha', 'beta', 'gamma', 'delta']) {
            await aLifeHolding(IMMORTAL_PILL.id, 1, seed);
            const taken = await alchemy({ action: 'consume_pill', pillId: IMMORTAL_PILL.id });
            expect(taken.consumed).toBe(true);
            seen.add(taken.turnedOutTo.outcome);
            expect(taken.turnedOutTo.dose.arrived).toBe(IMMORTAL_PILL.potency);
            expect(taken.turnedOutTo.settledOnUse).toBe(false);
            closeDb();
            getDb(':memory:');
        }
        expect([...seen]).toEqual(['as_promised']);
    });

    it('an immortal pill taken from far below the pitch still simply works', async () => {
        // WORTH PINNING BECAUSE IT IS THE CONTRAST THAT MAKES THE RISK LEGIBLE.
        // The gap between a body and what it swallowed is a real input, and it
        // moves exactly one row of exactly one spread. A reliable grade has no
        // row to move, so a medicine pitched at Void Refinement taken by a
        // nobody does what it says, in full, at no extra cost.
        //
        // The catalog already agreed and it is worth saying which way round:
        // `pillBandDecay` only ever takes potency away ABOVE a pill's band, so
        // there was never a below-the-band penalty to find. A pill is beneath
        // you eventually; it is never too big for you. That is what "uniformly
        // positive" means when it is written as arithmetic.
        await aLifeHolding(IMMORTAL_PILL.id, 1, 'immortal-from-the-bottom');
        const taken = await alchemy({ action: 'consume_pill', pillId: IMMORTAL_PILL.id });
        expect(taken.turnedOutTo.underThePitch.rungsUnder).toBeGreaterThan(20);
        expect(taken.turnedOutTo.underThePitch.weightedTowardDetonation).toBe(true);
        // ...and none of that reached the outcome, because there was nothing
        // in this spread for it to weight.
        expect(taken.turnedOutTo.outcome).toBe('as_promised');
        expect(taken.turnedOutTo.dose.arrived).toBe(IMMORTAL_PILL.potency);
        expect(taken.died).toBe(false);
    });

    it('a nobody who swallows one is mostly holding a bomb', async () => {
        // The owner's case, played. A body at the bottom of the ladder cannot
        // hold what a Void Refinement body holds, and the thing lets go.
        let blasts = 0;
        const lives = 12;
        for (let i = 0; i < lives; i++) {
            await aLifeHolding(CHAOS_PILL.id, 1, `nobody-${i}`);
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            expect(taken.turnedOutTo.underThePitch.rungsUnder).toBe(PITCH);
            if (taken.turnedOutTo.outcome === 'it_goes_off') blasts++;
            closeDb();
            getDb(':memory:');
        }
        expect(blasts / lives).toBeGreaterThan(0.4);
    });

    it('somebody standing at the pitch is taking a gamble, not lighting a fuse', async () => {
        let blasts = 0;
        const lives = 12;
        for (let i = 0; i < lives; i++) {
            await aLifeHolding(CHAOS_PILL.id, 1, `peer-${i}`, { atOrdinal: PITCH });
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            expect(taken.turnedOutTo.underThePitch.rungsUnder).toBe(0);
            if (taken.turnedOutTo.outcome === 'it_goes_off') blasts++;
            closeDb();
            getDb(':memory:');
        }
        // The same object, the same table, a different body carrying it.
        expect(blasts / lives).toBeLessThan(0.25);
    });

    it('the chaos pill reaches both sides of the spread over one life', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 40, 'a-spread-worth-seeing', {
            atOrdinal: PITCH
        });
        const transcript: string[] = [];
        const outcomes = new Set<string>();

        for (let i = 0; i < 40; i++) {
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            if (taken.error) break;
            outcomes.add(taken.turnedOutTo.outcome);
            transcript.push(
                `${String(i).padStart(2, '0')}  ${taken.turnedOutTo.outcome.padEnd(24)} `
                + `${taken.turnedOutTo.line}`
            );
            if (taken.turnedOutTo.theMonth) {
                for (const deed of taken.turnedOutTo.theMonth.deeds) {
                    transcript.push(`      · ${deed.line}`);
                }
            }
            if (taken.died) {
                transcript.push(`      DEAD: ${taken.death.cause} - ${taken.death.description}`);
                break;
            }
        }

        // Printed on purpose. A spread nobody has read is a table, and the
        // thing being claimed here is that it plays.
        // eslint-disable-next-line no-console
        console.log('\n' + transcript.join('\n') + '\n');

        expect(outcomes.size, 'one life should not see only one outcome').toBeGreaterThan(2);
        expect(id).toBeTruthy();
    });

    it('a redrawn root really takes the accumulation, and is written to the row', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 60, 'root-redraw-hunt', { atOrdinal: PITCH });
        const repos = ensureCultivationDb();
        const cultivators = new CultivatorRepository(repos.db);

        let sawRedraw = false;
        for (let i = 0; i < 60; i++) {
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            if (taken.error || taken.died) break;
            if (taken.turnedOutTo.outcome !== 'root_redrawn') continue;
            sawRedraw = true;
            const stored = cultivators.getById(id)!;
            expect(stored.spiritRoot).toBe(taken.turnedOutTo.rootRedrawnTo);
            expect(stored.cultivationProgress).toBe(0);
            break;
        }
        expect(sawRedraw, 'sixty doses should turn up a redraw').toBe(true);
    });

    it('the overdraw is a month they did not steer, and it is spent on real things', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 80, 'overdraw-hunt', { atOrdinal: PITCH });
        const repos = ensureCultivationDb();
        const cultivators = new CultivatorRepository(repos.db);

        let sawOverdraw = false;
        for (let i = 0; i < 80; i++) {
            const before = cultivators.getById(id)!;
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            if (taken.error || taken.died) break;
            if (taken.turnedOutTo.outcome !== 'overdrawn_and_half_mad') continue;
            sawOverdraw = true;
            const after = cultivators.getById(id)!;

            // The lift is read off the object, and at the pitch it is a
            // doubling - one realm, a few rungs.
            const od = taken.turnedOutTo.overdraw;
            expect(od.pitchOrdinal).toBe(PITCH);
            expect(od.bodyMultiplier).toBeCloseTo(2, 1);
            expect(od.standsAtRung).toBeGreaterThan(before.realmOrdinal);

            // THE MONTH HAPPENED, and the player is told what it was spent on.
            expect(taken.turnedOutTo.theMonth.deeds.length).toBeGreaterThan(0);
            for (const deed of taken.turnedOutTo.theMonth.deeds) {
                expect(deed.line.length).toBeGreaterThan(20);
            }

            // The rung is real and kept, the structure under it never formed.
            expect(after.realmOrdinal).toBe(before.realmOrdinal + od.residueRungs);
            expect(after.foundationQuality).toBe('incomplete');
            expect(readFlag(repos.db, id, 'overdrawn_until_day')).toBeTruthy();
            break;
        }
        expect(sawOverdraw, 'eighty doses should turn up an overdraw').toBe(true);
    });

    it('a detonation ends the run, and nothing quietly protects the player from it', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 1, 'detonation-hunt');
        let blast: any = null;
        for (let i = 0; i < 40 && !blast; i++) {
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            if (taken.error) break;
            if (taken.turnedOutTo.outcome === 'it_goes_off') blast = taken;
            if (taken.died) break;
        }
        // A nobody drinking one goes off most of the time, so one dose is
        // usually enough and the loop is a formality.
        expect(blast, 'the tail has to be reachable or it is decoration').toBeTruthy();
        expect(blast.died).toBe(true);

        const repos = ensureCultivationDb();
        expect(new CultivatorRepository(repos.db).getById(id)!.alive).toBe(false);
        // Priced off the OBJECT, which is what makes it empowered - and the
        // weakest holder makes the biggest crater, because the blast is the
        // same stored energy the overdraw would have been.
        expect(blast.turnedOutTo.detonation.poweredFromOrdinal).toBe(PITCH);
        expect(blast.turnedOutTo.detonation.takesFromSomebodyAt.length).toBeGreaterThan(0);
    });

    it('the pouch says what is known about it, and never how much is not', async () => {
        await aLifeHolding(CHAOS_PILL.id, 1, 'pouch-reading');
        const pouch = await alchemy({ action: 'inventory' });
        const held = pouch.pills.find((p: any) => p.id === CHAOS_PILL.id);
        expect(held.whatIsKnown.settledWhenMade).toBe(false);
        expect(held.whatIsKnown.accounts.length).toBeGreaterThan(0);
        expect(held.whatIsKnown.caveat).toMatch(/nobody has ever seen the whole/i);
        expect(JSON.stringify(held.whatIsKnown)).not.toMatch(/"total"|outcomesEverRecorded/);
    });
});
