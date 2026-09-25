/**
 * `coerce/furnace` played through: a fight to submission, then the rite.
 *
 * It used to end as an ordinary submission with "furnace" printed beside it.
 * These go through to the world: the player's progress moves, the subject's
 * clock moves, the ledger opens, and somebody under age is refused before any
 * fight opens.
 */

import { describe, expect, it } from 'vitest';

import { engineCalls, makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import { getTechnique } from '../../src/data/cultivation/index.js';
import { FURNACE_MIN_AGE } from '../../src/engine/social-leverage/an-art-that-needs-two-people.js';

const WORLD = 'world-furnace-rite';

interface ProbeNpc {
    id: string;
    name: string;
    status: string;
    identity: { sex: 'male' | 'female'; bornOnDay: number; physique: string | null };
    cultivation: { techniqueIds: string[]; accumulatingSinceDay: number; lastAdvancedOnDay: number };
}
interface OpenWorld {
    atHand: {
        currentDay: number;
        npcs: ProbeNpc[];
        history: { facts: { kind: string; data?: Record<string, unknown> }[] };
    } | null;
}
interface AsksItsOwnRoster { present: (c: unknown) => { id: string; name: string }[] }

/**
 * A player strong enough to end it in one sentence, holding the drawing half,
 * standing in front of somebody holding the drawn half.
 */
async function standingInFrontOfAFurnace(seed: string, ageYears: number) {
    const { db, game, repos } = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
    const { cultivator } = await game.newRun('Lin Zhaoyi');
    db.prepare(
        'UPDATE cultivators SET realm_ordinal = 29, hp = 9000, max_hp = 9000 WHERE id = ?'
    ).run(cultivator.id);
    repos.techniques.upsert(getTechnique('lotus-plucking-rite')!);
    repos.techniques.learn(cultivator.id, 'lotus-plucking-rite', 0.5);
    await game.act('I look around');

    const world = (game as unknown as OpenWorld).atHand!;
    const here = (game as unknown as AsksItsOwnRoster).present(cultivator);
    const mark = here
        .map(row => world.npcs.find(npc => npc.id === row.id))
        .find((npc): npc is ProbeNpc => npc !== undefined)!;
    expect(mark, `nobody with a world row was standing here on ${seed}`).toBeDefined();

    const today = Math.floor(world.currentDay);
    const player = db.prepare('SELECT sex FROM cultivators WHERE id = ?')
        .get(cultivator.id) as { sex: 'male' | 'female' };
    mark.identity.sex = player.sex === 'male' ? 'female' : 'male';
    mark.identity.bornOnDay = today - ageYears * 365 - 30;
    mark.cultivation.techniqueIds = [...mark.cultivation.techniqueIds, 'lotus-nurturing-canon'];
    mark.cultivation.accumulatingSinceDay = today - 2000;

    const progress = () => (db.prepare(
        'SELECT cultivation_progress AS p FROM cultivators WHERE id = ?'
    ).get(cultivator.id) as { p: number }).p;
    const live = () => world.npcs.find(npc => npc.id === mark.id)!;
    const grudges = () => db.prepare(
        "SELECT cause, severity, holder_id FROM obligations WHERE subject_id = ? AND cause = 'violated'"
    ).all(cultivator.id) as { cause: string; severity: string; holder_id: string }[];

    return { db, game, world, mark, playerId: cultivator.id, progress, live, grudges, today };
}

describe('the sentence reaches the rite', () => {
    it.each([
        ['I make him my furnace', 'him'],
        ['I make Qiu Wanbo my furnace', 'Qiu Wanbo'],
        ['I make her my cauldron', 'her'],
        ['I take her as my furnace', 'her'],
        ['I use him as a cauldron', 'him']
    ])('%s reaches coerce/furnace', (said, who) => {
        expect(parseIntent(said), said).toMatchObject({
            action: 'coerce', intent: 'furnace', target: who
        });
    });

    it('leaves making a vessel alone', () => {
        expect(parseIntent('I make a cauldron').action).not.toBe('coerce');
        expect(parseIntent('I make him a cauldron').action).not.toBe('coerce');
    });
});

describe('the rite on somebody who has yielded', () => {
    it('draws cultivation into the player and off the subject, and opens the account', async () => {
        const at = await standingInFrontOfAFurnace('furnace-rite-drawn', 30);
        const before = at.progress();
        const sinceBefore = at.live().cultivation.accumulatingSinceDay;

        const acted = await at.game.act(`I make ${at.mark.name} my furnace`);

        expect(engineCalls(acted).some(c => c.name === 'furnace.useFurnaceTechnique'),
            acted.narration).toBe(true);
        expect(acted.narration).toMatch(/draw off \d+ days of cultivation/);
        expect(at.progress()).toBeGreaterThan(before);
        expect(at.live().cultivation.accumulatingSinceDay).toBeGreaterThan(sinceBefore);

        const row = at.grudges().find(r => r.holder_id === at.mark.id);
        expect(row, 'nothing on the ledger about it').toBeDefined();
        expect(row!.severity).toBe('unforgivable');

        // The fact the rumour pipeline reads names the people who watched, not
        // only the two parties: a coerced use is `secret`, which alone names nobody.
        const fact = (at.world.history.facts as unknown as {
            data?: Record<string, unknown>; witnessIds: string[];
        }[]).find(f => f.data?.furnace === true);
        expect(fact, 'no world fact for the rite').toBeDefined();
        expect(fact!.witnessIds.length).toBeGreaterThan(2);
    }, 200_000);

    /**
     * A coerced draw kills one time in ten. The seed is pinned to one that does,
     * against a pinned world, so the death goes through the fight's own killing
     * path: the row is marked dead and the chronicle gets a death fact.
     */
    it('kills through the ordinary killing path when the draw kills', async () => {
        const at = await standingInFrontOfAFurnace('furnace-rite-14', 30);
        const before = at.progress();

        const acted = await at.game.act(`I make ${at.mark.name} my furnace`);

        expect(acted.narration).toMatch(/does not survive it/);
        expect(at.live().status).not.toBe('alive');
        expect(at.progress()).toBeGreaterThan(before);
        const death = (at.world.history.facts as unknown as {
            kind: string; actors: { id: string; role: string }[];
        }[]).find(f => f.kind === 'death' && f.actors.some(a => a.id === at.mark.id));
        expect(death, 'no death fact for the subject').toBeDefined();
        expect(death!.actors.find(a => a.role === 'killer')?.id).toBe(at.playerId);
        expect(at.grudges().some(r => r.holder_id === at.mark.id)).toBe(true);
    }, 200_000);

    it(`refuses somebody under ${FURNACE_MIN_AGE} before any fight opens`, async () => {
        const at = await standingInFrontOfAFurnace('furnace-rite-under-age', FURNACE_MIN_AGE - 3);
        const before = at.progress();
        const sinceBefore = at.live().cultivation.accumulatingSinceDay;

        const acted = await at.game.act(`I make ${at.mark.name} my furnace`);

        expect(acted.narration).toMatch(
            new RegExp(`is ${FURNACE_MIN_AGE - 3}[.] The rite is not worked on anybody under ${FURNACE_MIN_AGE}`)
        );
        expect(engineCalls(acted).some(c => c.name === 'furnace.useFurnaceTechnique')).toBe(false);
        expect(engineCalls(acted).some(c => c.name === 'combat_manage.resolve')).toBe(false);
        expect(at.progress()).toBe(before);
        expect(at.live().cultivation.accumulatingSinceDay).toBe(sinceBefore);
        expect(at.live().status).toBe('alive');
        expect(at.grudges()).toHaveLength(0);
    }, 200_000);
});
