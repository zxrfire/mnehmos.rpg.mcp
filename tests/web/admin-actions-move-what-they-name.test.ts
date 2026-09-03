/**
 * Every ADMIN action, typed at the game, moves the thing it names.
 *
 * `admin-surface.test.ts` covers the grammar and the routing - that the prefix
 * matches, that a value runs to the next key, that a model never reads the
 * line. What nothing covered was the other end: that a typed
 * `ADMIN <action> ...` reaches `admin_manage` and that the world afterwards is
 * actually different in the way the receipt says it is.
 *
 * That gap matters more than its size. The operator surface is the instrument
 * this project measures with - it is how a world is stood in a state ordinary
 * play would take four hundred years to reach - so a regression here would be
 * silent and would poison every measurement taken afterwards. A receipt that
 * says RUNG SET over a cultivator still standing at zero is worse than a
 * refusal, because the operator believes the world moved and then measures
 * something else.
 *
 * So each case below asserts on STATE rather than on prose: the sheet, the run
 * clock, the pouch, the knowledge rows, the alias table. The receipt is checked
 * too, but only as a second witness - the state is the claim.
 *
 * The world is on (`makeGameInWorld`) and pinned. Several of these actions read
 * the world's own registers - `set_location` checks it, `grant_knowledge` reads
 * its locations - and a harness with the world off is a configuration where
 * those guards are skipped by design.
 */

import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { activeAmbientAlias, effectiveLocationId } from '../../src/server/consolidated/cultivation-support';
import { KnowledgeGate, type KnownEntityKind } from '../../src/web/knowledge';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdmin<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = on ? 'true' : 'false';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/** A pinned world with a live run in it, admin mode already on. */
async function operating(seed: string): Promise<Harness> {
    const harness = await makeGameInWorld({ seed, worldSeed: 'admin-actions-world' });
    await harness.game.newRun('Op');
    return harness;
}

/**
 * How many things of one kind this holder can name.
 *
 * Through the gate's own reader rather than a `COUNT(*)`, because the claim
 * being made is "the awareness gate was lifted" and `awareness` is the
 * predicate every gated read in the game actually asks.
 */
function canName(db: Database.Database, holderId: string, kind: KnownEntityKind): number {
    return new KnowledgeGate(db).awareness(holderId, kind).length;
}

describe('a typed ADMIN action moves the thing it names', () => {
    it('set_realm puts the cultivator on the rung it was given', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-set-realm');
            expect(game.state().cultivator.realmOrdinal).toBe(0);

            const result = await game.act('ADMIN set_realm ordinal=20');

            expect(game.state().cultivator.realmOrdinal).toBe(20);
            expect(result.narration).toMatch(/RUNG SET/i);
        });
    });

    it('set_age moves the age, and refuses a span the rung does not carry', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-set-age');
            expect(game.state().cultivator.age).toBe(16);

            const result = await game.act('ADMIN set_age 60');
            expect(game.state().cultivator.age).toBe(60);
            expect(result.narration).toMatch(/AGE SET/i);

            // And the refusal is a fact about the world rather than a parse
            // failure: Qi Condensation carries a hundred years, so 250 is a
            // death by old age nobody asked about. The sheet does not move.
            const refused = await game.act('ADMIN set_age 250');
            expect(game.state().cultivator.age).toBe(60);
            expect(refused.narration).toMatch(/REFUSED/i);
            expect(refused.narration).toMatch(/set_realm/);
        });
    });

    it('advance_days really spends the days on the run clock', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-advance-days');
            expect(game.state().run.elapsedDays).toBe(0);

            const result = await game.act('ADMIN advance_days days=30');

            expect(game.state().run.elapsedDays).toBe(30);
            // Real aging, not a clock nudged on its own.
            expect(game.state().cultivator.age).toBeGreaterThan(16);
            expect(result.narration).toMatch(/TIME ADVANCED/i);
        });
    });

    it('grant_progress fills the accumulator the engine already reads', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-grant-progress');
            expect(game.state().cultivator.cultivationProgress).toBe(0);

            const result = await game.act('ADMIN grant_progress fill=true');

            expect(game.state().cultivator.cultivationProgress).toBeGreaterThan(0);
            // Nothing else moved - a filled accumulator is not a crossing.
            expect(game.state().cultivator.realmOrdinal).toBe(0);
            expect(result.narration).toMatch(/PROGRESS GRANTED/i);
        });
    });

    it('grant_knowledge writes real knowledge rows, not a bypass flag', async () => {
        await withAdmin(true, async () => {
            const { game, db } = await operating('admin-grant-knowledge');
            const me = game.state().cultivator.id;
            const before = canName(db, me, 'place');

            const result = await game.act('ADMIN grant_knowledge kind=place');

            expect(canName(db, me, 'place')).toBeGreaterThan(before + 100);
            expect(result.narration).toMatch(/NAMES LEARNED/i);
        });
    });

    it('set_ambient writes an alias the cultivation path really breathes', async () => {
        await withAdmin(true, async () => {
            const { game, db } = await operating('admin-set-ambient');
            const state = game.state();
            const here = state.cultivator.location!;
            const day = Math.floor(state.run.elapsedDays);
            expect(activeAmbientAlias(db, state.run.id, here, day)).toBeNull();

            const result = await game.act('ADMIN set_ambient band=dense');

            const alias = activeAmbientAlias(db, game.state().run.id, here, day);
            expect(alias?.band).toBe('dense');
            // The gate lifted is "you must happen to be somewhere with this
            // band", and the honest way to lift it is to stand somewhere the
            // engine really does derive it for. So the aliased place is a
            // different place, and it is what the cultivation call is handed.
            expect(alias!.alias).not.toBe(here);
            expect(effectiveLocationId(db, game.state().run.id, here, day)).toBe(alias!.alias);
            expect(result.narration).toMatch(/AMBIENT SET/i);
        });
    });

    it('set_location stands the cultivator somewhere else on the map', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-set-location');
            const from = game.state().cultivator.location;
            expect(from).not.toBe('The Dead Verge');

            const result = await game.act('ADMIN set_location location=The Dead Verge');

            expect(game.state().cultivator.location).toBe('The Dead Verge');
            expect(result.narration).toMatch(/MOVED/i);
            // A placement, not a journey. No road time was charged.
            expect(game.state().run.elapsedDays).toBe(0);
        });
    });

    it('spawn_encounter stands up a real persisted opponent', async () => {
        await withAdmin(true, async () => {
            const { game, db, repos } = await operating('admin-spawn-encounter');
            const me = game.state().cultivator.id;

            const result = await game.act('ADMIN spawn_encounter ordinal=10');

            const row = db
                .prepare("SELECT contents FROM cultivation_sites WHERE kind = 'encounter' AND admin_spawned = 1")
                .get() as { contents: string } | undefined;
            expect(row, 'an encounter row was written').toBeTruthy();

            const opponentId = JSON.parse(row!.contents).opponentCultivatorId as string;
            const opponent = repos.cultivators.getById(opponentId);
            // A real cultivator row with the rung it was asked for, not a
            // description of one.
            expect(opponent?.realmOrdinal).toBe(10);
            // And the awareness gate is lifted the same way a site's is, so the
            // player has a name to point at rather than a stranger in a crowd.
            expect(canName(db, me, 'cultivator')).toBeGreaterThan(0);
            expect(result.narration).toMatch(/ENCOUNTER/i);
        });
    });

    it('spawn_site makes a real catalogued site nameable', async () => {
        await withAdmin(true, async () => {
            const { game, db } = await operating('admin-spawn-site');
            const me = game.state().cultivator.id;
            const before = canName(db, me, 'place');

            const result = await game.act('ADMIN spawn_site ordinal=41 kind=grave');

            expect(canName(db, me, 'place')).toBeGreaterThan(before);
            expect(result.narration).toMatch(/SITE REVEALED/i);
            // ADMIN lifts awareness and nothing else; the bars inside stand.
            expect(result.narration).toMatch(/every gate inside this site still stands/i);
        });
    });

    it('grant_item puts a real catalog item in the real pouch', async () => {
        await withAdmin(true, async () => {
            const { game, db } = await operating('admin-grant-item');
            const me = game.state().cultivator.id;

            const result = await game.act('ADMIN grant_item itemId=pill-minor-healing');

            const row = db
                .prepare('SELECT quantity FROM cultivator_pouch WHERE cultivator_id = ? AND item_id = ?')
                .get(me, 'pill-minor-healing') as { quantity: number } | undefined;
            expect(row?.quantity).toBeGreaterThan(0);
            expect(result.narration).toMatch(/GRANTED/i);

            // And a name that is not in the catalog is refused with the near
            // misses rather than invented. ADMIN lifts gates on things that
            // exist; it does not author.
            const refused = await game.act('ADMIN grant_item kind=pill');
            expect(refused.narration).toMatch(/REFUSED/i);
            expect(refused.narration).toMatch(/itemId=/);
        });
    });
});

/**
 * The two laws in `docs/admin.md` that this whole surface rests on, checked at
 * the same place the actions are.
 *
 * They are asserted here rather than in the grammar file because they are
 * properties of a WHOLE typed turn - what ran, and what was asked of a model -
 * and there is no other test that drives one end to end.
 */
describe('an ADMIN line never reaches a model, and travels the ordinary road', () => {
    it('asks no model to read the line, whichever action it names', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-no-model');

            // The control, so this cannot quietly become an assertion about
            // nothing: an ORDINARY sentence records the routing step, whether a
            // model or the parser answered it. If that row ever stops being
            // written the loop below passes for the wrong reason.
            const typed = await game.act('I look around');
            expect(typed.toolCalls.map(call => call.name)).toContain('narrator.plan');

            for (const line of [
                'ADMIN set_realm ordinal=20',
                'ADMIN advance_days days=30',
                'ADMIN grant_progress fill=true',
                'ADMIN roster'
            ]) {
                const result = await game.act(line);
                // Phase 1 is the model reading the sentence. An admin line is
                // key=value and the operator named the action, so there is
                // nothing to read and nothing is asked.
                expect(
                    result.toolCalls.filter(call => call.name === 'narrator.plan'),
                    `${line} routed through a model`
                ).toEqual([]);
            }
        });
    });

    it('arranges, and is then followed by a look at what it arranged', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-then-look');

            // A call that CHANGED something narrates the post-state after the
            // receipt, so an operator can see the situation they arranged.
            const changed = await game.act('ADMIN set_realm ordinal=20');
            expect(changed.toolCalls.map(call => call.name)).toEqual(['narrator.narrate']);

            // A read changed nothing and gets nothing: describing an unchanged
            // room after printing a list is noise.
            const read = await game.act('ADMIN roster');
            expect(read.toolCalls).toEqual([]);
        });
    });

    it('is refused with the reason when the process did not enable it', async () => {
        await withAdmin(true, async () => {
            const { game } = await operating('admin-off-per-action');
            await withAdmin(false, async () => {
                for (const line of [
                    'ADMIN set_realm ordinal=20',
                    'ADMIN grant_item itemId=pill-minor-healing',
                    'ADMIN advance_days days=30'
                ]) {
                    await expect(game.act(line), line).rejects.toThrow(/ADMIN_MODE=true/);
                }
            });
        });
    });
});
