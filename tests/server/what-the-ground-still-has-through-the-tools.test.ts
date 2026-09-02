/**
 * The counted stock through the MCP surface, not only through the web one.
 *
 * There are two doors into foraging - `cultivation_manage.forage` and the web
 * layer's `gather` - and AGENTS.md's mirror-image defect is a rule that binds
 * one caller and not the other. Wiring only the door you noticed first leaves a
 * world where the ground runs out for a player and not for a tool caller.
 *
 * So: the same three claims, asked of the tool.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { adminResult } from '../../src/server/consolidated/admin-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));
const admin = async (args: Record<string, unknown>) => (await adminResult(args)) as any;

async function standingAt(ordinal: number, seed: string) {
    process.env.ADMIN_MODE = 'true';
    const created = await cultivation({
        action: 'create_cultivator', name: 'Forager', seed, location: 'Sweptground'
    });
    expect(created.error).toBeUndefined();
    if (ordinal > 0) {
        expect((await admin({ action: 'set_realm', ordinal })).error).toBeUndefined();
    }
    return created;
}

describe('what the ground still has, through the tools', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
        delete process.env.ADMIN_MODE;
    });

    afterEach(() => {
        delete process.env.ADMIN_MODE;
    });

    it('reports what the place still holds, with a real number behind it', async () => {
        await standingAt(0, 'tool-ground-a');
        const result = await cultivation({ action: 'forage' });

        expect(result.error).toBeUndefined();
        expect(result.ground, 'the tool surface never asked the world').not.toBeNull();
        expect(result.ground.place).toBe('Sweptground');
        expect(result.ground.capacity).toBeGreaterThan(0);
        expect(result.ground.remaining).toBeLessThanOrEqual(result.ground.capacity);
        // A player must be able to ask what a place still has and be answered
        // in a sentence rather than by inferring it from a falling yield.
        expect(result.ground.stillHas).toContain('ground around Sweptground');
    }, 180_000);

    it('is a ceiling on the haul and never a floor under it', async () => {
        // The band the ground can actually run out of. At the top of the ladder
        // a single pass takes a serious fraction of what a district holds of
        // the highest grades, which is the Late Age arriving as arithmetic.
        await standingAt(45, 'tool-ground-b');

        let sawTheGroundBind = false;
        let lastTaken = Number.POSITIVE_INFINITY;
        for (let pass = 0; pass < 12 && !sawTheGroundBind; pass++) {
            const result = await cultivation({ action: 'forage' });
            if (result.error || result.died) break;
            expect(result.quantityTaken).toBeLessThanOrEqual(result.quantityFound);
            if (result.ground && result.ground.shortfall > 0) {
                sawTheGroundBind = true;
                // Said out loud. A place that has been worked out must not
                // simply hand back less.
                expect(result.ground.says).toBeTruthy();
                expect(result.quantityTaken).toBeLessThan(result.quantityFound);
            }
            lastTaken = result.quantityTaken;
        }

        expect(
            sawTheGroundBind,
            `twelve passes at the top of the ladder never exhausted a band `
            + `(last take ${lastTaken}) - the ground is not binding on the tool surface`
        ).toBe(true);
    }, 180_000);
});
