/**
 * A grade is what a material is. An ordinal is what a finished thing stands at.
 *
 * The rule is written above `ObjectKind` in `possessions.ts`, and this is the
 * ratchet on it. Everything here is a RATE over the whole object population of
 * several seeded worlds - no seed is pinned to a count, and no row is named,
 * because which artifacts a world happens to contain is the seeder's business
 * and the claim is about all of them.
 *
 * WHAT IT CAUGHT. 91 of 235 artifacts in a seeded world carried no ordinal, and
 * every one of them was a departure talisman: `cutATalisman` priced the way-out
 * slip at null on the reasoning that it is no use in a fight, which is a
 * different question from what rung the thing is. The 61% went red here.
 *
 * Confirmed to fail by putting the null back.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { isRuined, ruin, type ObjectRecord } from '../../../src/engine/world/possessions';
import { cutATalisman } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms';

/** Three worlds, so a rate is a rate about the engine and not about one seed. */
const SEEDS = ['a-finished-artifact-1', 'a-finished-artifact-2', 'a-finished-artifact-3'];

let worlds: ObjectRecord[][] | null = null;

async function everyWorldsObjects(): Promise<ObjectRecord[][]> {
    if (worlds === null) {
        const catalog = await loadCultivationCatalog();
        worlds = SEEDS.map(seed => seedWorld({ seed, catalog }).state.objects);
    }
    return worlds;
}

/** Rows the rule speaks about: a thing that still exists and has not been spent. */
function stillStanding(objects: readonly ObjectRecord[], kind: string): ObjectRecord[] {
    return objects.filter(o =>
        o.kind === kind && !isRuined(o) && o.data?.spent !== true
    );
}

function shareCarryingAnOrdinal(rows: readonly ObjectRecord[]): number {
    if (rows.length === 0) return 0;
    return rows.filter(o => o.power !== null).length / rows.length;
}

describe('every finished artifact in a seeded world stands somewhere', () => {
    it('all of them, in every world, and not most of them', async () => {
        for (const objects of await everyWorldsObjects()) {
            const artifacts = stillStanding(objects, 'artifact');
            expect(artifacts.length).toBeGreaterThan(0);
            expect(shareCarryingAnOrdinal(artifacts)).toBe(1);
        }
    });

    it('and a formation, which is a made thing that was never carried', async () => {
        for (const objects of await everyWorldsObjects()) {
            const formations = stillStanding(objects, 'formation');
            expect(formations.length).toBeGreaterThan(0);
            expect(shareCarryingAnOrdinal(formations)).toBe(1);
        }
    });

    it('on the same ladder people are measured on, which is what an ordinal is', async () => {
        for (const objects of await everyWorldsObjects()) {
            for (const artifact of stillStanding(objects, 'artifact')) {
                expect(artifact.power).toBeGreaterThanOrEqual(0);
                expect(artifact.power).toBeLessThanOrEqual(MAX_ORDINAL);
            }
        }
    });
});

describe('and a material does not, because nobody has worked it yet', () => {
    it('not one of them, in any world', async () => {
        for (const objects of await everyWorldsObjects()) {
            const materials = stillStanding(objects, 'material');
            expect(materials.length).toBeGreaterThan(0);
            expect(shareCarryingAnOrdinal(materials)).toBe(0);
        }
    });

    it('and neither does anything else that is not a finished artifact', async () => {
        for (const objects of await everyWorldsObjects()) {
            for (const kind of ['pill', 'manual', 'currency', 'token']) {
                const rows = stillStanding(objects, kind);
                expect(rows.length).toBeGreaterThan(0);
                expect(shareCarryingAnOrdinal(rows)).toBe(0);
            }
        }
    });
});

describe('what a slip stands at is the hand that cut it, not the act inside it', () => {
    /**
     * The defect in one assertion. Both slips were paid for by the same hand at
     * the same rung; only one of them is swung, and being swung is not what an
     * ordinal measures.
     */
    it('a strike slip and a way out cut by one hand stand at the same rung', () => {
        for (let crafterOrdinal = 0; crafterOrdinal <= MAX_ORDINAL; crafterOrdinal++) {
            const cut = (what: 'a_strike' | 'a_way_out') => cutATalisman({
                id: `slip-${what}-${crafterOrdinal}`,
                name: 'a slip',
                grade: 'earth',
                what,
                crafterId: null,
                crafterOrdinal,
                onDay: 0
            });
            expect(cut('a_way_out').power).toBe(cut('a_strike').power);
            expect(cut('a_way_out').power).not.toBeNull();
        }
    });
});

describe('the one thing that legitimately stands nowhere', () => {
    it('a ruined artifact, because it is a thing that used to exist', async () => {
        const [objects] = await everyWorldsObjects();
        const artifact = stillStanding(objects, 'artifact')[0];
        const wreck = ruin(artifact, { onDay: 1, source: 'a probe' });
        expect(wreck.power).toBeNull();
        expect(isRuined(wreck)).toBe(true);
    });
});
