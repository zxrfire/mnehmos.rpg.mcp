/**
 * Looking at a thing, and getting the answer you have earned.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `resolveAnything` walked self, cultivator, sect, place, technique, recipe,
 * pill and herb. **Objects were not in it at all**, so `I examine the Standing
 * Edge`, `I look at the sword in his hand` and `I examine my sword` all reached
 * the generic refusal with every ingredient of the answer sitting in the world.
 *
 * ── THE RULING BEING TESTED ──────────────────────────────────────────────
 *
 * *"if you inspect a counted but untracked artifact you get a generic
 * description. ownership of this IS tracked. a tracked one, and you are aware
 * of what it is, you get a damn good one. all dependent on your own cultivation
 * and awareness, ofc."*
 *
 * So the resolver is ungated, exactly as techniques and pills are, and the
 * grading does the work a gate would have done badly: the player never receives
 * the catalog entry, only the reading their own rung and reference support.
 * These cases are the same sentence typed by four different people.
 * An outsider may already know another house. The no-reference case selects
 * an owning house the opening knowledge actually leaves unknown.
 */

import { describe, it, expect } from 'vitest';
import { aRecruiterOfTheHouseIsHere, makeGameInWorld, type Harness } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';

async function aReaderAt(seed: string, ordinal: number, house?: string): Promise<Harness> {
    const harness = await makeGameInWorld({ seed, worldSeed: 'examining-a-thing', adminMode: true });
    await harness.game.newRun('Shen Yue');
    if (ordinal > 0) await harness.game.act(`ADMIN set_realm ordinal=${ordinal}`);
    if (house) {
        await aRecruiterOfTheHouseIsHere(harness.game, house);
        await harness.game.act(`ADMIN sect join ${house}`);
    }
    return harness;
}

async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

describe('examining a thing', () => {
    it('tells a nobody to back away from something they cannot name', async () => {
        await withAdmin(async () => {
            const { game } = await aReaderAt('examine-nobody', 0);
            const said = await game.act('I examine the Standing Edge');

            // The name is withheld, and that is the point rather than a
            // shortfall: the player typed it and does not get it confirmed.
            expect(said.narration).not.toContain('The Standing Edge.');
            expect(said.narration).toContain('Something you cannot place');
            // And the one thing they DO come away with, unhedged. The design
            // owner's correction to the realm axis: being unable to read
            // something is itself a sign.
            expect(said.narration).toMatch(/beyond you/i);
            expect(said.narration).toMatch(/would end you/i);
        });
    }, 60_000);

    it('gives the house that owns it the whole entry', async () => {
        await withAdmin(async () => {
            const { game } = await aReaderAt(
                'examine-member', 30, 'the Azure Cloud Pavilion'
            );
            const said = await game.act('I examine the Standing Edge');

            expect(said.narration).toContain('The Standing Edge');
            // The catalog's own account of what it does, which is what "a damn
            // good one" means.
            expect(said.narration).toMatch(/settles who somebody is/i);
            // And whose it is, which is the fact the reading exists to reach.
            expect(said.narration).toContain('The Azure Cloud Pavilion');
            expect(said.narration).toMatch(/where it belongs/i);
        });
    }, 60_000);

    it('gives the same person nothing about a thing whose house they do not know', async () => {
        await withAdmin(async () => {
            const { game } = await aReaderAt(
                'examine-outsider', 30, 'the Azure Cloud Pavilion'
            );
            const self = game.state().cultivator!;
            const thing = game.atHand!.objects.find(object => object.kind === 'artifact'
                && object.significance !== 'mundane'
                && object.ownerId !== null && object.ownerId !== self.sectId
                && object.power !== null && object.power < self.realmOrdinal
                && !object.knownOwnershipBy.includes(self.id)
                && !object.knownOwnershipBy.includes(self.sectId!)
                && parseIntent(`I examine ${object.name}`).action === 'investigate'
                && game.knowledge.stageOf(self.id, 'sect', object.ownerId) === 'unaware');
            expect(thing, 'no artifact belongs to a house this reader does not know').toBeDefined();
            const said = await game.act(`I examine ${thing!.name}`);

            expect(said.narration, `examining ${thing!.name}`).toContain('Something you cannot place');
            expect(said.narration).not.toContain(thing!.ownerName);
        });
    }, 60_000);

    it('does not resolve a counted kind, because the world seats no row for one', async () => {
        await withAdmin(async () => {
            // A notched sabre is a KIND standing in for several hundred and the
            // seeder places none of them. Resolving off the catalog would
            // confirm a specific one exists somewhere, which is exactly the lie
            // "resolve to the row, never the catalog" exists to prevent.
            const { game } = await aReaderAt('examine-counted', 30);
            const said = await game.act('I examine a Notched Sabre');
            expect(said.narration).toMatch(/nothing here answers to it|is nowhere/i);
        });
    }, 60_000);
});
