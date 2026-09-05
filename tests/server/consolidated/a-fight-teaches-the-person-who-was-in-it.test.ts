/**
 * A fight teaches the person who was in it - through the tool, into the row.
 *
 * The engine half is pinned in `tests/engine/cultivation/what-a-fight-teaches.test.ts`.
 * This is the other half, and it is the one AGENTS.md keeps saying is the one
 * that goes missing: **a module nothing calls is not a feature.** So what is
 * under test here is not the arithmetic, it is that
 *
 *   - `combat_manage.resolve` reads the lesson and WRITES it,
 *   - the write lands on the cultivator row and survives a re-read,
 *   - beating somebody far below writes nothing, and says so,
 *   - and the lesson is seeded, so a replayed run produces the same one.
 *
 * Plus the two other rulings that reach the database through this tool:
 * `goal: 'coerce'` reaching `submission` and leaving a person standing, and
 * somebody who would rather die doing so.
 */

import {
    handleCombatManage
} from '../../../src/server/consolidated/combat-manage.js';
import { handleCultivationManage } from '../../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../../src/storage/index.js';
import { CultivatorRepository } from '../../../src/storage/repos/cultivator.repo.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { isTraceable } from '../../../src/engine/cultivation/understanding.js';
import { FIGHT_CARRIES_AT_MOST } from '../../../src/engine/cultivation/what-a-fight-teaches.js';
import { progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';

const ctx = { sessionId: 'fight-teaches-test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(text);
}

const combat = async (args: Record<string, unknown>) => payload(await handleCombatManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

function realmStart(key: string): number {
    return REALM_TIERS.find(t => t.key === key)!.ordinalStart;
}

async function newCultivator(name = 'Shen Yue', seed = 'teach-seed') {
    const created = await cultivation({ action: 'create_cultivator', name, seed, location: 'Burnt Earth' });
    expect(created.error).toBeUndefined();
    return created;
}

function setRank(
    db: ReturnType<typeof getDb>,
    id: string,
    ordinal: number,
    extra: Record<string, unknown> = {}
) {
    const repo = new CultivatorRepository(db);
    repo.update(id, {
        realmOrdinal: ordinal, hp: 400, maxHp: 400, qi: 400, maxQi: 400, ...extra
    } as never);
    return repo.getById(id)!;
}

describe('a fight teaches the person who was in it', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
    });

    it('writes what the fight was worth in accumulation onto the row', async () => {
        const created = await newCultivator();
        const id = created.cultivator.id;
        const ordinal = realmStart('core_formation');
        const before = setRank(db, id, ordinal, { cultivationProgress: 0 });
        expect(before.cultivationProgress).toBe(0);

        const result = await combat({
            action: 'resolve',
            goal: 'drive_off',
            opponent: { name: 'a rival', realmOrdinal: ordinal, maxHp: 400 }
        });

        expect(result.error).toBeUndefined();
        expect(result.taught.band).toBe('matched');
        expect(result.taught.progress).toBeGreaterThan(0);

        const after = new CultivatorRepository(db).getById(id)!;
        expect(after.cultivationProgress).toBeCloseTo(result.taught.progress, 1);
    });

    it('teaches nothing at all for beating somebody four rungs below, and says why', async () => {
        const created = await newCultivator();
        const id = created.cultivator.id;
        const ordinal = realmStart('core_formation');
        setRank(db, id, ordinal, { cultivationProgress: 0 });

        const result = await combat({
            action: 'resolve',
            goal: 'humiliate',
            opponent: { name: 'a nobody', realmOrdinal: ordinal - 4 }
        });

        expect(result.taught.band).toBe('assured');
        expect(result.taught.progress).toBe(0);
        expect(result.taught.comprehended).toBe(false);
        expect(result.taught.comprehensionChance).toBe(0);
        // Said out loud rather than left as a silent zero. A player who learned
        // nothing is owed the sentence, or the mechanic reads as absent.
        expect(result.taught.why).toMatch(/no resistance/);

        const after = new CultivatorRepository(db).getById(id)!;
        expect(after.cultivationProgress).toBe(0);
    });

    it('stops paying once the rung is past the ceiling, with nothing stored to say so', async () => {
        const created = await newCultivator();
        const id = created.cultivator.id;
        const ordinal = realmStart('core_formation');
        const required = progressRequiredForOrdinal(ordinal)!;
        setRank(db, id, ordinal, { cultivationProgress: required * FIGHT_CARRIES_AT_MOST });

        const result = await combat({
            action: 'resolve',
            goal: 'drive_off',
            opponent: { name: 'a rival', realmOrdinal: ordinal, maxHp: 400 }
        });

        expect(result.taught.band).toBe('matched');
        expect(result.taught.progress).toBe(0);
        expect(result.taught.why).toMatch(/carries nobody further/);
    });

    it('reports the comprehension chance even in the ordinary case where nothing lands', async () => {
        const created = await newCultivator();
        const id = created.cultivator.id;
        const ordinal = realmStart('core_formation');
        setRank(db, id, ordinal);

        const bare = await combat({
            action: 'resolve',
            goal: 'drive_off',
            opponent: { name: 'a rival', realmOrdinal: ordinal, maxHp: 400 }
        });

        // Fought with no art named, so there is no art in it to comprehend -
        // and the body still learned something, which is the accumulation half.
        expect(bare.taught.comprehensionChance).toBe(0);
        expect(bare.taught.progress).toBeGreaterThan(0);
        const after = new CultivatorRepository(db).getById(id)!;
        expect(after.insights).toHaveLength(0);
        expect(isTraceable(after.insights)).toBe(true);
    });

    it('gives the same lesson on a replay of the same run', async () => {
        const readings: unknown[] = [];
        for (const _ of [0, 1]) {
            closeDb();
            db = getDb(':memory:');
            const created = await newCultivator('Shen Yue', 'replay-seed');
            const ordinal = realmStart('core_formation');
            setRank(db, created.cultivator.id, ordinal, { cultivationProgress: 0 });
            const result = await combat({
                action: 'resolve',
                goal: 'drive_off',
                opponent: { name: 'a rival', realmOrdinal: ordinal, maxHp: 400 }
            });
            readings.push(result.taught);
        }
        expect(readings[0]).toEqual(readings[1]);
    });
});

describe('forcing somebody to submit, through the tool', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
    });

    it('reaches submission and leaves them standing', async () => {
        const created = await newCultivator('Shen Yue', 'coerce-seed');
        setRank(db, created.cultivator.id, realmStart('core_formation'));

        const result = await combat({
            action: 'resolve',
            goal: 'coerce',
            opponent: { name: 'a courier', realmOrdinal: realmStart('core_formation') - 2 }
        });

        expect(result.error).toBeUndefined();
        expect(result.outcome).toBe('submission');
        expect(result.verdict).toBe('Beaten, alive, and yielding.');
        expect(result.died).toBe(false);
        expect(result.opponentDied).toBe(false);
        expect(result.finished).toBe(false);
        // The half that makes it worth having: a live relationship rather than
        // an empty road.
        expect(result.obligations).toHaveLength(1);
        expect(result.obligations[0].description).toMatch(/yielded rather than be finished/);
    });

    it('kills the one who would rather die, and the caller gets a body they did not want', async () => {
        const created = await newCultivator('Shen Yue', 'coerce-seed-2');
        setRank(db, created.cultivator.id, realmStart('core_formation'));

        const result = await combat({
            action: 'resolve',
            goal: 'coerce',
            opponent: { name: 'a courier', realmOrdinal: realmStart('core_formation') - 2 },
            submission: {
                yields: false,
                because: 'the want this forecloses is the whole of why they are standing here'
            }
        });

        expect(result.outcome).not.toBe('submission');
        expect(['lethal', 'body_destroyed']).toContain(result.outcome);
    });

    it('does not need a will-to-submit field to be told they would not yield', async () => {
        // The reading is a boolean and a stated reason, not a stat. This asserts
        // the tool surface has nowhere for a compliance number to be passed.
        const created = await newCultivator('Shen Yue', 'coerce-seed-3');
        setRank(db, created.cultivator.id, realmStart('core_formation'));

        const bad = await combat({
            action: 'resolve',
            goal: 'coerce',
            opponent: { name: 'a courier', realmOrdinal: 4 },
            submission: { yields: false }
        });
        expect(bad.error).toBeDefined();
    });
});

describe('opening from concealment, through the tool', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
    });

    it('hits harder on the opening exchange than squaring up does', async () => {
        const reading = async (opening: string | undefined) => {
            closeDb();
            db = getDb(':memory:');
            const created = await newCultivator('Shen Yue', 'ambush-seed');
            setRank(db, created.cultivator.id, realmStart('core_formation'));
            return combat({
                action: 'resolve',
                goal: 'kill',
                fightToTheEnd: true,
                opponent: { name: 'a rival', realmOrdinal: realmStart('core_formation'), maxHp: 400 },
                ...(opening ? { opening } : {})
            });
        };

        const open = await reading(undefined);
        const hidden = await reading('from_concealment');
        expect(hidden.exchanges[0].advantage).toBeGreaterThan(open.exchanges[0].advantage);
        expect(hidden.exchanges[0].damage).toBeGreaterThan(open.exchanges[0].damage);
        // And the target does not answer in the round they did not know about.
        expect(open.exchanges[1].attackerId).not.toBe(open.exchanges[0].attackerId);
        expect(hidden.exchanges[1].attackerId).toBe(hidden.exchanges[0].attackerId);
    });

    it('is byte-identical to an open fight when the field is absent or open', async () => {
        const reading = async (opening: string | undefined) => {
            closeDb();
            db = getDb(':memory:');
            const created = await newCultivator('Shen Yue', 'identity-seed');
            setRank(db, created.cultivator.id, realmStart('core_formation'));
            const result = await combat({
                action: 'resolve',
                goal: 'kill',
                fightToTheEnd: true,
                opponent: { name: 'a rival', realmOrdinal: realmStart('core_formation'), maxHp: 400 },
                ...(opening ? { opening } : {})
            });
            // The cultivator's row id is a `randomUUID()` minted at creation
            // and is not seeded, so it is normalised out. Everything the seed
            // decides stays in - and that is the whole content of the claim.
            return JSON.stringify({
                outcome: result.outcome, exchanges: result.exchanges, injuries: result.injuries,
                taught: result.taught
            }).replaceAll(created.cultivator.id, 'PLAYER');
        };
        expect(await reading('open')).toBe(await reading(undefined));
    });
});
