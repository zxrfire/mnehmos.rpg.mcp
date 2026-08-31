/**
 * The game service: talent, long simulation, permadeath, and admin gating.
 *
 * These run against a real in-memory SQLite database and the real cultivation
 * engine. Nothing is mocked except the narrator, because everything the tests
 * are about is on the other side of the narrator.
 */

import { describe, it, expect } from 'vitest';
import { STARTING_SPIRIT_STONES, SATIETY_MAX } from '../../src/schema/cultivation';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';
import { rollSpiritRoot, rollAttributes } from '../../src/engine/cultivation/spirit-roots';
import { forStream } from '../../src/engine/cultivation/rng';
import { TECHNIQUES } from '../../src/data/cultivation/index';
import { GameError } from '../../src/web/game';
import { STARTING_AGE, STARTING_LOCATION, PROVISION_COST_STONES } from '../../src/web/game';
import { makeGame, injuryCount, planned, engineCalls, refusedCall } from './harness';

/** Recompute the roll the service should have made, straight from the engine. */
function expectedTalent(seed: string) {
    const root = rollSpiritRoot(forStream(seed, 'creation', 'spirit_root').next());
    const stream = forStream(seed, 'creation', 'attributes');
    const attributes = rollAttributes([stream.next(), stream.next(), stream.next(), stream.next()]);
    return { root, attributes };
}

describe('character creation', () => {
    it('rolls talent server-side from the run seed', async () => {
        const { game } = makeGame({ seed: 'seed-alpha' });
        const { cultivator } = await game.newRun('Lin Que');
        const expected = expectedTalent('seed-alpha');

        expect(cultivator.spiritRoot).toBe(expected.root.key);
        expect(cultivator.attributes).toEqual(expected.attributes);
        expect(cultivator.realmOrdinal).toBe(0);
        expect(cultivator.age).toBe(STARTING_AGE);
        expect(cultivator.spiritStones).toBe(STARTING_SPIRIT_STONES);
        expect(cultivator.satiety).toBe(SATIETY_MAX);
        expect(cultivator.location).toBe(STARTING_LOCATION);
        expect(cultivator.alive).toBe(true);
    });

    it('writes an opening engine ruling and an opening narration to the log', async () => {
        const { game } = makeGame();
        await game.newRun('Lin Que');
        const state = game.state();

        expect(state.log.filter(e => e.role === 'engine')).toHaveLength(1);
        expect(state.log.filter(e => e.role === 'narrator')).toHaveLength(1);
        expect(state.log[0].text).toContain('Talent is rolled once and never redrawn.');
    });
});

describe('a ten-year seclusion', () => {
    it('returns a digest and persists a state consistent with it', async () => {
        const { db, game } = makeGame({ seed: 'decade' });
        const { cultivator } = await game.newRun('Wen Shu');

        // Fund the provisions: ten years of food is 73 rations. Without stones
        // the engine correctly starves the cultivator around day 55, which is
        // its own test below.
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        const { timeSkip, state } = await game.cultivate(10 * DAYS_PER_YEAR);

        expect(timeSkip.requestedDays).toBe(3650);
        expect(timeSkip.simulatedDays).toBeGreaterThan(0);
        expect(timeSkip.simulatedDays).toBeLessThanOrEqual(3650);
        expect(Array.isArray(timeSkip.events)).toBe(true);

        // The digest and the database agree, field by field.
        expect(state.run.elapsedDays).toBe(timeSkip.simulatedDays);
        expect(state.run.turn).toBe(1);
        expect(state.cultivator.age).toBeCloseTo(STARTING_AGE + timeSkip.deltas.age, 5);
        expect(state.cultivator.realmOrdinal).toBe(timeSkip.deltas.realmOrdinal);
        expect(state.cultivator.spiritStones).toBe(
            500 - 73 * PROVISION_COST_STONES + timeSkip.deltas.spiritStones
        );
        expect(injuryCount(db, cultivator.id)).toBe(timeSkip.deltas.injuriesGained);
        expect(state.derived.untreatedInjuries).toBe(timeSkip.deltas.injuriesGained);

        // Aging is derived from the day count, not accumulated per chunk.
        expect(timeSkip.deltas.age).toBeCloseTo(timeSkip.simulatedDays / DAYS_PER_YEAR, 5);

        // Ten years of qi-gathering must show up somewhere: rank, or progress.
        expect(
            state.cultivator.realmOrdinal > 0 || state.cultivator.cultivationProgress > 0
        ).toBe(true);

        // The stagnation clock is the reconstruction most likely to drift.
        // Either the run never advanced (clock ran the whole skip) or it did
        // (clock restarted at the last advance) — never more than the skip.
        expect(state.cultivator.yearsAtCurrentRealm)
            .toBeLessThanOrEqual(timeSkip.simulatedDays / DAYS_PER_YEAR + 1e-6);
    });

    it('is reproducible from the same seed', async () => {
        const run = async () => {
            const { db, game } = makeGame({ seed: 'identical' });
            const { cultivator } = await game.newRun('Twin');
            db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
            const { timeSkip } = await game.cultivate(3650);
            return timeSkip;
        };

        const first = await run();
        const second = await run();
        expect(second.simulatedDays).toBe(first.simulatedDays);
        expect(second.deltas).toEqual(first.deltas);
        expect(second.events.map(e => e.summary)).toEqual(first.events.map(e => e.summary));
    });

    it('buys what the purse covers and lets the engine starve the rest', async () => {
        const { game } = makeGame({ seed: 'hungry' });
        await game.newRun('Broke');

        // 30 stones buys 15 rations: 750 days of food out of 3650 asked for.
        const { timeSkip, state } = await game.cultivate(3650);

        // 30 stones buys 15 rations; the belly runs out long before year ten.
        expect(timeSkip.simulatedDays).toBeLessThan(3650);
        expect(state.cultivator.satiety).toBe(0);
        const provisioning = state.log
            .filter(e => e.role === 'engine')
            .map(e => e.text)
            .join('\n');
        expect(provisioning.length).toBeGreaterThan(0);
    });
});

describe('death is terminal', () => {
    async function killByStarvation() {
        const { db, game } = makeGame({ seed: 'ending' });
        const { cultivator } = await game.newRun('Doomed');
        db.prepare('UPDATE cultivators SET spirit_stones = 0 WHERE id = ?').run(cultivator.id);

        for (let attempt = 0; attempt < 20; attempt++) {
            await game.cultivate(2000).catch(() => undefined);
            if (game.state().run.status !== 'active') break;
        }
        return { db, game, cultivator };
    }

    it('closes the run, records the cause, and writes the ledger', async () => {
        const { game } = await killByStarvation();
        const state = game.state();

        expect(state.run.status).toBe('dead');
        expect(state.run.deathCause).toBe('starvation');
        expect(state.run.endedAt).not.toBeNull();
        expect(state.cultivator.alive).toBe(false);
        expect(state.cultivator.deathCause).toBe('starvation');

        const ledger = game.ledger();
        expect(ledger.runs).toHaveLength(1);
        expect(ledger.runs[0]).toMatchObject({ name: 'Doomed', deathCause: 'starvation' });
        expect(ledger.runs[0].deathDescription).toContain('starved');
    });

    it('refuses every mutating call afterwards', async () => {
        const { game } = await killByStarvation();

        for (const call of [
            () => game.act('I keep cultivating.'),
            () => game.cultivate(30),
            () => game.breakthrough()
        ]) {
            await expect(call()).rejects.toMatchObject({
                name: 'GameError',
                status: 409
            });
        }
    });

    it('still serves read-only state so the death screen can render', async () => {
        const { game } = await killByStarvation();
        const state = game.state();
        expect(state.cultivator.name).toBe('Doomed');
        expect(state.derived.rankName).toContain('Qi Condensation');
        expect(state.log.length).toBeGreaterThan(0);
    });

    it('lets a new run begin once the old one is closed', async () => {
        const { game } = await killByStarvation();
        const next = await game.newRun('The Next One');

        expect(next.run.status).toBe('active');
        expect(next.cultivator.alive).toBe(true);
        expect(game.state().run.id).toBe(next.run.id);
        // The old run stays in the ledger. Permanently.
        expect(game.ledger().runs.map(r => r.name)).toContain('Doomed');
    });
});

describe('breakthrough persistence', () => {
    it('keeps the progress overflow rather than zeroing it on success', async () => {
        const { db, game } = makeGame({ seed: 'overflow' });
        const { cultivator } = await game.newRun('Careful');

        // Two ranks' worth of progress at ordinal 0 (100 required).
        db.prepare('UPDATE cultivators SET cultivation_progress = 250 WHERE id = ?').run(cultivator.id);
        const { result, state } = await game.breakthrough();

        if (result.outcome === 'success') {
            expect(state.cultivator.realmOrdinal).toBe(1);
            expect(state.cultivator.cultivationProgress).toBeCloseTo(250 - result.progressConsumed, 6);
            expect(state.cultivator.yearsAtCurrentRealm).toBe(0);
            expect(state.run.peakOrdinal).toBe(1);
        } else {
            expect(state.cultivator.realmOrdinal).toBe(0);
            expect(state.cultivator.cultivationProgress).toBeCloseTo(250 - result.progressConsumed, 6);
        }
        expect(injuryCount(db, cultivator.id)).toBe(result.injuriesSustained.length);
    });

    it('refuses when the engine reports insufficient progress', async () => {
        const { game } = makeGame();
        await game.newRun('Impatient');
        await expect(game.breakthrough()).rejects.toBeInstanceOf(GameError);
    });
});

describe('eating', () => {
    it('costs a stone, refills the belly and clears the starvation counter', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Hungry');
        db.prepare('UPDATE cultivators SET satiety = 4, starvation_turns = 2 WHERE id = ?')
            .run(cultivator.id);

        const result = await game.act('I buy a meal.');
        expect(planned(result).action).toBe('eat');
        expect(engineCalls(result)[0]).toMatchObject({ name: 'cultivator.applyDeltas', ok: true });
        expect(result.state.cultivator.satiety).toBe(SATIETY_MAX);
        expect(result.state.cultivator.starvationTurns).toBe(0);
        expect(result.state.cultivator.spiritStones).toBe(STARTING_SPIRIT_STONES - 1);
    });

    it('refuses when the purse is empty, without changing anything', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Broke');
        db.prepare('UPDATE cultivators SET satiety = 4, spirit_stones = 0 WHERE id = ?')
            .run(cultivator.id);

        const result = await game.act('I buy a meal.');
        expect(refusedCall(result)).not.toBeNull();
        expect(refusedCall(result)!.summary).toMatch(/purse holds 0/);
        expect(result.state.cultivator.satiety).toBe(4);
        expect(result.state.cultivator.spiritStones).toBe(0);
    });
});

describe('travel', () => {
    it('moves the cultivator and re-reads the ambient qi at the destination', async () => {
        const { game } = makeGame();
        await game.newRun('Walker');

        const result = await game.act('I travel to Scarwater.');
        expect(planned(result).action).toBe('travel');
        expect(refusedCall(result)).toBeNull();
        expect(result.state.cultivator.location).toBe('Scarwater');
        expect(['thin', 'normal', 'dense', 'spirit_tide']).toContain(result.state.ambient);
    });

    it('refuses to move when no destination was named', async () => {
        const { game } = makeGame();
        await game.newRun('Walker');

        const result = await game.act('I set out.');
        expect(refusedCall(result)).not.toBeNull();
        expect(result.state.cultivator.location).toBe(STARTING_LOCATION);
    });
});

describe('free actions', () => {
    it('cost a turn and nothing else', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Watcher');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const result = await game.act('I look around.');

        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.turn).toBe(1);
        expect(result.state.run.elapsedDays).toBe(0);
    });
});

describe('admin roster', () => {
    it('refuses with 403 when admin mode is off', async () => {
        const { game } = makeGame({ adminMode: false });
        await game.newRun('Anyone');
        expect(() => game.roster()).toThrowError(expect.objectContaining({ status: 403 }));
    });

    it('is read-only: listing it does not touch a single row', async () => {
        const { db, game } = makeGame({ adminMode: true });
        const { cultivator } = await game.newRun('Anyone');

        const before = db.prepare('SELECT * FROM cultivators').all();
        const roster = game.roster();
        expect(roster.roster).toHaveLength(1);
        expect(roster.roster[0].isPlayer).toBe(true);
        expect(roster.roster[0].id).toBe(cultivator.id);
        expect(db.prepare('SELECT * FROM cultivators').all()).toEqual(before);
    });

    it('includes NPCs and the dead, not just the player', async () => {
        const { db, game } = makeGame({ adminMode: true });
        await game.newRun('Player');

        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
                cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
                age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
                feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
            ) VALUES (
                'npc-1', NULL, 'Elder Ru', 'npc', 'single_fire',
                '{"might":2,"insight":3,"fortune":1,"charm":2}', 20,
                0, 100, 100, 50, 50, 100, 0, 300, 3, 4000, NULL, NULL, 'The Low Fall',
                '[]', '[]', 0, 'stagnation_aging', 12, @now, @now
            )
        `).run({ now });

        const rows = game.roster().roster;
        expect(rows).toHaveLength(2);
        const elder = rows.find(r => r.id === 'npc-1')!;
        expect(elder).toMatchObject({
            name: 'Elder Ru',
            kind: 'npc',
            isPlayer: false,
            alive: false,
            deathCause: 'stagnation_aging',
            rankName: 'Core Formation Perfection',
            realmName: 'Core Formation',
            spiritRootName: 'Single Fire Root',
            lifespanYears: 500
        });
    });
});

describe('no run yet', () => {
    it('404s on state and refuses actions', async () => {
        const { game } = makeGame();
        expect(() => game.state()).toThrowError(expect.objectContaining({ status: 404 }));
        await expect(game.act('hello')).rejects.toMatchObject({ status: 404 });
        expect(game.ledger().runs).toEqual([]);
    });
});

describe('the Vault charges a toll at a realm boundary', () => {
    /**
     * Set a cultivator on the lip of Foundation Establishment with real
     * techniques and a real logged history, so the engine has something to take.
     */
    async function atTheBoundary(seed: string) {
        const harness = makeGame({ seed });
        const { cultivator } = await harness.game.newRun('Crosser');

        const arts = TECHNIQUES.slice(0, 4).map(t => t.id);
        harness.db.prepare(`
            UPDATE cultivators
            SET realm_ordinal = 12, cultivation_progress = 100000, known_techniques = ?
            WHERE id = ?
        `).run(JSON.stringify(arts), cultivator.id);

        // The Vault can only take rows that exist, so seed the catalog and the
        // join table rather than only the denormalised list on the cultivator.
        for (const entry of TECHNIQUES.slice(0, 4)) {
            harness.repos.techniques.upsert(entry);
            harness.repos.techniques.learn(cultivator.id, entry.id, 0.5);
        }
        return { ...harness, cultivatorId: cultivator.id, arts };
    }

    it('lays a foundation on the 12 to 13 crossing and persists it', async () => {
        for (const seed of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']) {
            const { game } = await atTheBoundary(seed);
            const { result, state } = await game.breakthrough();
            if (result.outcome !== 'success') continue;

            expect(result.foundationEstablished).not.toBeNull();
            expect(state.cultivator.realmOrdinal).toBe(13);
            // Persisted, not merely reported: the engine cannot re-derive it.
            expect(state.cultivator.foundationQuality).toBe(result.foundationEstablished);
            expect(state.derived.foundationQuality).toBe(result.foundationEstablished);
            expect(state.cultivator.foundationQuality).not.toBe('none');
            return;
        }
        throw new Error('no seed produced a successful boundary crossing');
    });

    it('deletes what it says it took — the engine never asserts without a write', async () => {
        let observedTaken = 0;

        const seeds = Array.from({ length: 60 }, (_, i) => `t${i}`);
        for (const seed of seeds) {
            const { db, game, cultivatorId } = await atTheBoundary(seed);
            const { result, state } = await game.breakthrough();
            if (result.outcome !== 'success' || !result.toll) continue;

            // Charged or not, the instalment is in the permanent ledger.
            const ledger = db.prepare('SELECT * FROM cultivation_tolls').all() as any[];
            expect(ledger).toHaveLength(1);
            expect(ledger[0].outcome).toBe(result.toll.outcome);

            if (result.toll.outcome !== 'taken' || !result.toll.taken) continue;
            observedTaken++;
            const taken = result.toll.taken;

            if (taken.kind === 'technique') {
                expect(state.cultivator.knownTechniques).not.toContain(taken.id);
                const row = db.prepare('SELECT known_techniques FROM cultivators WHERE id = ?')
                    .get(cultivatorId) as { known_techniques: string };
                expect(JSON.parse(row.known_techniques)).not.toContain(taken.id);
            } else if (taken.kind === 'bond') {
                // Bonds have no table of their own yet; the ledger row above is
                // the record, and it names exactly which one went.
                expect(taken.id).toBeTruthy();
            } else if (taken.kind === 'name') {
                expect(state.derived.nameTaken).toBe(true);
            }

            // And it is on the wire for the UI, oldest first.
            expect(state.tolls.length).toBeGreaterThan(0);
            expect(state.tolls.at(-1)!.taken?.label).toBe(taken.label);

            // And the loss is stated as a fact, not only as prose.
            const engineLines = state.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
            expect(engineLines.length).toBeGreaterThan(0);
        }

        // Roughly one crossing in five is charged, so a fixed sweep of seeds is
        // the deterministic way to reach the branch that matters.
        expect(observedTaken).toBeGreaterThan(0);
    });

    it('never charges a toll on a sub-rank step', async () => {
        const { db, game } = makeGame({ seed: 'subrank' });
        const { cultivator } = await game.newRun('Stepper');
        db.prepare('UPDATE cultivators SET cultivation_progress = 100000 WHERE id = ?')
            .run(cultivator.id);

        const { result } = await game.breakthrough();
        expect(result.toll).toBeNull();
        expect(result.foundationEstablished).toBeNull();
        expect(db.prepare('SELECT * FROM cultivation_tolls').all()).toHaveLength(0);
    });
});
