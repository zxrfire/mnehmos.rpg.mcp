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
 * So the two assertions that matter are opposites of each other: an immortal
 * pill must do the same thing every time, and a chaos pill must not.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { addToPouch, ensureCultivationDb, readFlag } from '../../src/server/consolidated/cultivation-support.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { isSettledOnUse } from '../../src/engine/cultivation/grade-spread.js';

const ctx = { sessionId: 'chaos-pill-test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: any) => payload(await handleAlchemyManage(args, ctx) as any);
const cultivation = async (args: any) => payload(await handleCultivationManage(args, ctx) as any);

/** The dearest chaos pill in the catalog, and one immortal pill to contrast it. */
const CHAOS_PILL = PILLS.find(p => p.grade === 'chaos')!;
const IMMORTAL_PILL = PILLS.find(p => p.grade === 'immortal')!;

beforeEach(() => {
    closeDb();
    getDb(':memory:');
});

afterEach(() => {
    closeDb();
});

async function aLifeHolding(pillId: string, quantity: number, seed: string) {
    const created = await cultivation({
        action: 'create_cultivator',
        name: 'Shen Yue',
        seed,
        location: 'Sweptground'
    });
    expect(created.error).toBeUndefined();
    const repos = ensureCultivationDb();
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
            // What it says on the tin is what arrived, to the number.
            expect(taken.turnedOutTo.arrived ?? taken.turnedOutTo.dose.arrived)
                .toBe(IMMORTAL_PILL.potency);
            expect(taken.turnedOutTo.settledOnUse).toBe(false);
            closeDb();
            getDb(':memory:');
        }
        expect([...seen]).toEqual(['as_promised']);
    });

    it('the chaos pill reaches both sides of the spread over one life', async () => {
        // Forty doses out of one pouch, so the transcript below is a real
        // sequence of turns in one run rather than forty separate worlds.
        const id = await aLifeHolding(CHAOS_PILL.id, 40, 'a-spread-worth-seeing');
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
        expect(transcript.length).toBeGreaterThan(0);
        expect(id).toBeTruthy();
    });

    it('a redrawn root really takes the accumulation, and is written to the row', async () => {
        // Not softened, and not a display-only change: the stored cultivator is
        // what the test reads.
        const id = await aLifeHolding(CHAOS_PILL.id, 60, 'root-redraw-hunt');
        const repos = ensureCultivationDb();
        const cultivators = new CultivatorRepository(repos.db);
        const rootAtStart = cultivators.getById(id)!.spiritRoot;

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
        expect(rootAtStart).toBeTruthy();
    });

    it('an overdraw leaves a rung standing on nothing and a body that paid for it', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 80, 'overdraw-hunt');
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
            // The rung is real and kept.
            expect(after.realmOrdinal).toBe(before.realmOrdinal + 1);
            // The window is on the record, so a surface can say they are in it.
            expect(readFlag(repos.db, id, 'overdrawn_until_day')).toBeTruthy();
            expect(readFlag(repos.db, id, 'overdrawn_rungs')).toBeTruthy();
            // And the structure under it was never formed.
            expect(after.foundationQuality).toBe('incomplete');
            break;
        }
        expect(sawOverdraw, 'eighty doses should turn up an overdraw').toBe(true);
    });

    it('a detonation ends the run, and nothing quietly protects the player from it', async () => {
        const id = await aLifeHolding(CHAOS_PILL.id, 120, 'detonation-hunt');
        const repos = ensureCultivationDb();
        const cultivators = new CultivatorRepository(repos.db);

        let blast: any = null;
        for (let i = 0; i < 120; i++) {
            const taken = await alchemy({ action: 'consume_pill', pillId: CHAOS_PILL.id });
            if (taken.error) break;
            if (taken.turnedOutTo.outcome === 'it_goes_off') { blast = taken; break; }
            if (taken.died) break;
        }

        expect(blast, 'the tail has to be reachable or it is decoration').toBeTruthy();
        expect(blast.died).toBe(true);
        expect(cultivators.getById(id)!.alive).toBe(false);
        // Priced off the OBJECT. That is what makes it empowered rather than
        // whatever this particular nobody could have managed on their own.
        expect(blast.turnedOutTo.detonation.poweredFromOrdinal).toBeGreaterThan(0);
        expect(blast.turnedOutTo.detonation.takesFromSomebodyAt.length).toBeGreaterThan(0);
    });

    it('the pouch says what is known about it, and never how much is not', async () => {
        await aLifeHolding(CHAOS_PILL.id, 1, 'pouch-reading');
        const pouch = await alchemy({ action: 'inventory' });
        const held = pouch.pills.find((p: any) => p.id === CHAOS_PILL.id);
        expect(held.whatIsKnown.settledWhenMade).toBe(false);
        expect(held.whatIsKnown.accounts.length).toBeGreaterThan(0);
        expect(held.whatIsKnown.caveat).toMatch(/nobody has ever seen the whole/i);
        // No denominator anywhere: the outcome set is open, so "2 of 9" would
        // be a lie the data cannot support.
        expect(JSON.stringify(held.whatIsKnown)).not.toMatch(/"total"|outcomesEverRecorded/);
    });
});
