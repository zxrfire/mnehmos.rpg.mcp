/**
 * What the player is carrying is priced in the fight, and the fight can end it.
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────
 *
 * `carriedArtifact` reads the best rated object out of `cultivator_pouch` and
 * returns exactly the shape `CombatantInput.weapon` takes. It had no caller.
 * `combatantFromCultivator` - the one place the played game prices the player
 * for a fight - built a combatant with no weapon at all, so an object really in
 * the pouch, really readable back, and really named by ADMIN's own response was
 * worth nothing the moment anybody swung it. A module nothing calls is not a
 * feature.
 *
 * ── AND THE THING THAT IS NOT A DEFECT ───────────────────────────────────
 *
 * A pouch row is not a claim on the world's register. `docs/world/things/items.md`:
 * holding a thing and owning it are two facts, and the world going on saying a
 * house owns something the player is carrying is what a stolen artifact IS.
 * Nothing here writes ownership, and the last case checks it stays that way.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import {
    carriedArtifact,
    ensureCultivationDb
} from '../../src/server/consolidated/cultivation-support.js';
import { combatantFromCultivator } from '../../src/server/consolidated/combat-manage.js';
import { assessPower, resolveExchange } from '../../src/engine/cultivation/combat.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { getArtifact } from '../../src/data/cultivation/artifacts.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';

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

async function armed(seed: string, itemId: string): Promise<Harness> {
    const harness = await makeGameInWorld({ seed, worldSeed: 'carried-weapon-world', adminMode: true });
    await harness.game.newRun('Shen Yue');
    await harness.game.act(`ADMIN grant_item itemId=${itemId}`);
    return harness;
}

/** The player, priced exactly as the played fight prices them. */
function playerNow(harness: Harness) {
    const repos = ensureCultivationDb();
    const row = repos.cultivators.getById(harness.game.state().cultivator.id)!;
    return combatantFromCultivator(row, repos);
}

describe('what the player carries reaches the fight', () => {
    it('prices a granted object through the same field an NPC\'s blade arrives in', async () => {
        await withAdmin(async () => {
            // Held by nobody in the world, so the player comes to hold it
            // without a house quietly losing property. The two rows the seeder
            // leaves unpossessed are the only artifacts with a world row for
            // which that is true.
            const harness = await armed('carried-priced', 'artifact-the-severed-ledger-blade');
            const id = harness.game.state().cultivator.id;

            const carried = carriedArtifact(harness.db, id);
            expect(carried).not.toBeNull();
            expect(carried!.power).toBe(getArtifact('artifact-the-severed-ledger-blade')!.power);

            const self = playerNow(harness);
            expect(self.weapon).toEqual(carried);

            // The same person with empty hands, priced by the same call. The
            // whole of the difference is the object.
            const bare = assessPower({ ...self, weapon: null }, { ambient: 'normal' });
            const holding = assessPower(self, { ambient: 'normal' });
            expect(holding.total).toBeGreaterThan(bare.total);
        });
    });

    it('lets the fight break it, by the ordinary rule and not one written for a granted thing', async () => {
        await withAdmin(async () => {
            // A notched sabre off a dead bandit, rated four, swung into
            // something several realms above it. `whether-a-weapon-survives-
            // being-used.ts`: past two realms it is not a chance.
            const harness = await armed('carried-broken', 'artifact-notched-sabre');
            const self = playerNow(harness);
            expect(self.weapon!.power).toBe(4);

            const wall = assessPower(
                { ...self, id: 'wall', name: 'Something Far Above', realmOrdinal: 30, weapon: null },
                { ambient: 'normal' }
            );
            const swinging = assessPower(self, { ambient: 'normal' });

            const exchange = resolveExchange(swinging, wall, 100, {
                rng: forStream('carried-broken', 'exchange', 'sabre')
            });
            expect(exchange.weapon).not.toBeNull();
            expect(exchange.weapon!.objectId).toBe('artifact-notched-sabre');
            expect(exchange.weapon!.broke).toBe(true);
        });
    });

    it('does not touch the world register, because carrying is not owning', async () => {
        await withAdmin(async () => {
            const harness = await armed('carried-ownership', 'artifact-the-severed-ledger-blade');
            const world = await activeWorld();
            const row = world.state.objects.find(o => o.id === 'artifact-the-severed-ledger-blade');
            expect(row).toBeDefined();
            // The Severed still own it. That the player is carrying it and the
            // register says otherwise is the state, not the bug.
            expect(row!.ownerId).toBe('sect-the-severed');
        });
    });
});
