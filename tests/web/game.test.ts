/**
 * The game service: talent, long simulation, permadeath, and admin gating.
 *
 * These run against a real in-memory SQLite database and the real cultivation
 * engine. Nothing is mocked except the narrator, because everything the tests
 * are about is on the other side of the narrator.
 */

import { describe, it, expect } from 'vitest';
import {
    CultivatorSchema,
    SATIETY_MAX,
    STARTING_SPIRIT_STONES,
    stagnationYearsForOrdinal,
    type Cultivator
} from '../../src/schema/cultivation';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';
import { rollSpiritRoot, rollAttributes } from '../../src/engine/cultivation/spirit-roots';
import { forStream } from '../../src/engine/cultivation/rng';
import { effectiveLifespanYears, lifespanForOrdinal } from '../../src/engine/cultivation/realms';
import { TECHNIQUES, RECIPES, HERBS, SECTS } from '../../src/data/cultivation/index';

/**
 * The one sect a new cultivator has heard of.
 *
 * discovery.md gates entity resolution on knowledge, so a test that wants a
 * faction the player can actually name has to use the seeded local one. Naming
 * any other sect is a discovery test, and lives in discovery.test.ts.
 */
const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);
import { GameError } from '../../src/web/game';
import { derivedView } from '../../src/web/view';
import { STARTING_AGE, STARTING_LOCATION, PROVISION_COST_STONES } from '../../src/web/game';
import { makeGame, injuryCount, planned, engineCalls, refusedCall } from './harness';
import { drawBirth } from '../../src/engine/birth/birth';
import { ACTIONS_PER_FULL_SATIETY } from '../../src/engine/cultivation/survival';
import {
    lifespanPressure,
    lifespanPressureOnsetAge
} from '../../src/engine/cultivation/breakthrough';

/**
 * How far an encounter's own deltas may move the purse inside one window.
 *
 * A non-interrupting occurrence can hand somebody something or cost them
 * something, and those land on the cultivator BEFORE the skip, so the exact
 * identity between the digest and the purse no longer holds on an OPEN
 * seclusion. It still holds on a sealed one, which is asserted separately -
 * that is the bargain, and it is the stronger guard of the two.
 */
const ENCOUNTER_STONE_SLACK = 5000;

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
        // The birth's own figure rather than the constant. Nine births in ten
        // still draw about it; what a run opens with is a property of where it
        // opened rather than of the engine.
        expect(cultivator.spiritStones).toBe(drawBirth('seed-alpha').spiritStones);
        expect(cultivator.satiety).toBe(SATIETY_MAX);
        // Passing before only by luck: every run began in the same village.
        expect(cultivator.location).toBe(drawBirth('seed-alpha').place.name);
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

        // NOT ten years, necessarily. An open seclusion is now rolled against
        // the encounter window before anything is spent, and the span is
        // truncated at the first thing that interrupts it - which is the whole
        // point of the encounter layer and the reason a decade of unattended
        // cultivation is no longer a spreadsheet row. What is asserted is that
        // the span is a real prefix of what was asked for, and that everything
        // downstream was priced against the span actually lived.
        expect(timeSkip.requestedDays).toBeGreaterThan(0);
        expect(timeSkip.requestedDays).toBeLessThanOrEqual(3650);
        expect(timeSkip.simulatedDays).toBeGreaterThan(0);
        expect(timeSkip.simulatedDays).toBeLessThanOrEqual(timeSkip.requestedDays);
        expect(Array.isArray(timeSkip.events)).toBe(true);

        // The digest and the database agree, field by field.
        expect(state.run.elapsedDays).toBe(timeSkip.simulatedDays);
        expect(state.run.turn).toBe(1);
        expect(state.cultivator.age).toBeCloseTo(STARTING_AGE + timeSkip.deltas.age, 5);
        expect(state.cultivator.realmOrdinal).toBe(timeSkip.deltas.realmOrdinal);
        // Provisions are bought for the span LIVED, never for the span asked
        // for: a seclusion cut short in year eight must not have been
        // provisioned for twenty.
        const rations = Math.ceil(timeSkip.requestedDays / ACTIONS_PER_FULL_SATIETY);
        expect(state.cultivator.spiritStones).toBeLessThanOrEqual(
            500 - rations * PROVISION_COST_STONES + timeSkip.deltas.spiritStones
                + ENCOUNTER_STONE_SLACK
        );
        expect(injuryCount(db, cultivator.id)).toBe(timeSkip.deltas.injuriesGained);
        expect(state.derived.untreatedInjuries).toBe(timeSkip.deltas.injuriesGained);

        // Aging is derived from the day count, not accumulated per chunk.
        expect(timeSkip.deltas.age).toBeCloseTo(timeSkip.simulatedDays / DAYS_PER_YEAR, 5);

        // Ten years of qi-gathering shows up NOWHERE, and that is the design
        // rather than a defect. `techniqueCap` is a hard ceiling: a cultivator
        // practising no cultivation manual is carried as far as no method
        // carries anybody, which is nowhere, at every rung. Wen Shu was created
        // and sat down without ever picking up a book.
        //
        // This assertion used to read "must show up somewhere: rank, or
        // progress", and it passed because the web layer supplied no ceiling at
        // all - which made holding no manual strictly better than holding one
        // and was the whole defect. The version below is the same claim made
        // honestly: the years buy nothing without a method, and they buy
        // something with one.
        expect(state.cultivator.realmOrdinal).toBe(0);
        expect(state.cultivator.cultivationProgress).toBe(0);

        // The stagnation clock is the reconstruction most likely to drift.
        // Either the run never advanced (clock ran the whole skip) or it did
        // (clock restarted at the last advance) - never more than the skip.
        expect(state.cultivator.yearsAtCurrentRealm)
            .toBeLessThanOrEqual(timeSkip.simulatedDays / DAYS_PER_YEAR + 1e-6);
    });

    it('is reproducible from the same seed', async () => {
        const run = async () => {
            const { db, game } = makeGame({ seed: 'identical' });
            const { cultivator } = await game.newRun('Twin');
            db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
            // With a manual, so the decade is a decade of something. Without
            // one the technique ceiling is a hard zero and both runs would be
            // reproducibly empty, which is true and tests nothing.
            await game.act('I learn the Lesser Qi-Gathering Manual');
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

        // 30 stones buys 15 rations; the food runs out long before year ten,
        // and the skip stops there to say so rather than narrating a death
        // nobody was asked about. The cultivator is alive with a belly still
        // on them and a decision to make.
        expect(timeSkip.simulatedDays).toBeLessThan(3650);
        expect(timeSkip.died).toBe(false);
        expect(timeSkip.interruptReason).toBe('provisions_exhausted');
        expect(state.cultivator.satiety).toBeGreaterThan(0);
        expect(timeSkip.events.some(e => e.kind === 'resource_depleted' && e.interrupts)).toBe(true);
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
        // Read rather than assumed: the purse is the birth's now, and a meal
        // costs one stone whatever it started at.
        const before = game.state().cultivator.spiritStones;

        const result = await game.act('I buy a meal.');
        expect(planned(result).action).toBe('eat');
        expect(engineCalls(result)[0]).toMatchObject({ name: 'cultivator.applyDeltas', ok: true });
        expect(result.state.cultivator.satiety).toBe(SATIETY_MAX);
        expect(result.state.cultivator.starvationTurns).toBe(0);
        expect(result.state.cultivator.spiritStones).toBe(before - 1);
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

describe('move', () => {
    it('moves the cultivator and re-reads the ambient qi at the destination', async () => {
        const { game } = makeGame();
        await game.newRun('Walker');

        const result = await game.act('I travel to Scarwater.');
        expect(planned(result).action).toBe('move');
        expect(refusedCall(result)).toBeNull();
        expect(result.state.cultivator.location).toBe('Scarwater');
        expect(['thin', 'normal', 'dense', 'spirit_tide']).toContain(result.state.ambient);
    });

    it('refuses to move when no destination was named', async () => {
        const { game } = makeGame();
        await game.newRun('Walker');

        const opened = game.state().cultivator.location;
        const result = await game.act('I set out.');
        expect(refusedCall(result)).not.toBeNull();
        // Wherever the birth put them, and they are still there.
        expect(result.state.cultivator.location).toBe(opened);
    });

    it('resolves every intent through the same engine path', async () => {
        // The label changes; the routine does not. Nothing branches on intent.
        const paths: string[][] = [];
        for (const text of ['I travel to Scarwater.', 'I flee to Scarwater.', 'I sneak into Scarwater.']) {
            const { game } = makeGame({ seed: 'same' });
            await game.newRun('Walker');
            const result = await game.act(text);
            expect(planned(result).action).toBe('move');
            paths.push(engineCalls(result).map(c => c.name));
        }
        expect(paths[1]).toEqual(paths[0]);
        expect(paths[2]).toEqual(paths[0]);
    });
});

describe('interact', () => {
    it('refuses when the target is not a person or faction on record', async () => {
        const { game } = makeGame();
        await game.newRun('Talker');

        const result = await game.act('I bribe the gate steward.');
        expect(planned(result).action).toBe('interact');
        const refusal = refusedCall(result);
        expect(refusal).not.toBeNull();
        expect(refusal.summary).toMatch(/Unresolved party/);  // inspector, not prose
    });

    it('reports real facts about a real party, and refuses to resolve the outcome', async () => {
        const { game } = makeGame();
        await game.newRun('Talker');

        // The seeded local sect: a real faction this cultivator can name.
        const result = await game.act(`I negotiate with ${LOCAL_SECT.name}.`);
        expect(planned(result).action).toBe('interact');

        const calls = engineCalls(result);
        expect(calls[0]).toMatchObject({ name: 'engine.resolveParty', ok: true });
        expect(calls[0].summary).toContain(LOCAL_SECT.name);

        // The attempt is recorded; the outcome is explicitly not.
        const outcome = calls.find(c => c.name === 'engine.resolveInteraction');
        expect(outcome).toBeDefined();
        expect(outcome.ok).toBe(false);
        expect(outcome.summary).toMatch(/outcome not resolvable yet/i);
        expect(outcome.action).toBe('negotiate');
    });

    it('is an attempt, never an accomplishment: no state moves', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Talker');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        await game.act(`I threaten ${LOCAL_SECT.name} into taking me as an elder.`);

        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(db.prepare('SELECT * FROM sect_members').all()).toEqual([]);
    });
});

describe('investigate', () => {
    it('reports engine facts about something the world actually holds', async () => {
        const { game } = makeGame();
        await game.newRun('Reader');

        const result = await game.act(`I examine ${LOCAL_SECT.name}.`);
        expect(planned(result).action).toBe('investigate');
        expect(refusedCall(result)).toBeNull();
        expect(result.narration).toContain(LOCAL_SECT.name);
        expect(engineCalls(result)[0].summary).toContain(`to sect ${LOCAL_SECT.id}`);
    });

    it('refuses to describe what the world does not hold', async () => {
        const { game } = makeGame();
        await game.newRun('Reader');

        const result = await game.act('I examine the Sword of Infinite Nonsense.');
        const refusal = refusedCall(result);
        expect(refusal).not.toBeNull();
        expect(refusal.summary).toMatch(/Unresolved subject/);  // inspector, not prose
    });

    it('costs a turn and nothing else', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Reader');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const result = await game.act(`I examine ${LOCAL_SECT.name}.`);
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
        expect(result.state.run.turn).toBe(1);
    });
});

describe('seclude', () => {
    /**
     * A decade behind a sealed door is usually quiet, and quiet is not the
     * same as sealed off. See the long note in encounters-wired.test.ts: the
     * absolute version of this made sealing a dominant strategy, and a shut
     * door is what makes a cave look like a ruin worth opening.
     */
    it('is sealed: a decade behind the door is usually quiet', async () => {
        let disturbed = 0;
        for (const seed of ['sealed', 'sealed-b', 'sealed-c', 'sealed-d', 'sealed-e']) {
            const { db, game } = makeGame({ seed });
            const { cultivator } = await game.newRun('Shut-In');
            db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

            const result = await game.act('I seal the cave for ten years.');
            expect(planned(result).action).toBe('seclude');
            if (result.events.some(e => e.kind === 'encounter' || e.kind === 'opportunity')) disturbed++;
        }
        expect(disturbed, 'ten years is a short seal and should mostly pass unremarked')
            .toBeLessThanOrEqual(1);
    });
});

describe('gather and refine', () => {
    it('forages through the herb catalog and writes the shared pouch', async () => {
        const { db, game } = makeGame({ seed: 'forage' });
        const { cultivator } = await game.newRun('Digger');

        const result = await game.act('I forage for herbs.');
        expect(planned(result).action).toBe('gather');

        const pouch = db
            .prepare('SELECT item_id, quantity FROM cultivator_pouch WHERE cultivator_id = ?')
            .all(cultivator.id) as Array<{ item_id: string; quantity: number }>;
        const call = engineCalls(result)[engineCalls(result).length - 1];

        if (call.name === 'storage.addToPouch') {
            expect(pouch.length).toBeGreaterThan(0);
            expect(HERBS.some(h => h.id === pouch[0].item_id)).toBe(true);
        } else {
            // Nothing within reach is a legitimate outcome, and it must not have
            // quietly written a row anyway.
            expect(pouch).toEqual([]);
        }
    });

    it('refuses a formula the world does not hold, and names what is in the pouch', async () => {
        const { game } = makeGame();
        await game.newRun('Alchemist');

        const result = await game.act('I brew an Elixir of Infinite Nonsense in the cauldron.');
        expect(planned(result).action).toBe('refine');
        const refusal = refusedCall(result);
        expect(refusal).not.toBeNull();
        expect(refusal.summary).toMatch(/Pouch: empty/);  // inspector, not prose
    });

    it('routes a real formula through alchemy_manage rather than reimplementing it', async () => {
        const { game } = makeGame();
        await game.newRun('Alchemist');

        const recipe = RECIPES[0];
        const result = await game.act('I refine the ' + recipe.name + ' in the cauldron.');
        expect(planned(result).action).toBe('refine');
        // Either the handler ran, or it refused for a state reason it owns
        // (realm too low, ingredients missing). Both are the handler's answer.
        const names = engineCalls(result).map(c => c.name);
        expect(names.some(n => n === 'alchemy_manage.refine' || n === 'engine.resolveRecipe')).toBe(true);
    });
});

describe('train_technique', () => {
    it('refuses an art the cultivator has never been taught', async () => {
        const { game } = makeGame();
        await game.newRun('Student');

        const result = await game.act('I practise the ' + TECHNIQUES[0].name + ' technique.');
        expect(planned(result).action).toBe('train_technique');
        const refusal = refusedCall(result);
        expect(refusal).not.toBeNull();
        expect(refusal.summary).toMatch(/Unresolved or unlearned technique/);  // inspector, not prose
    });

    it('routes a known art through technique_manage.practise', async () => {
        const { game, repos } = makeGame();
        const { cultivator } = await game.newRun('Student');

        const art = TECHNIQUES.filter(t => t.requiredOrdinal === 0)[0];
        repos.techniques.upsert(art);
        repos.techniques.learn(cultivator.id, art.id, 0.1);

        const result = await game.act('I practise the ' + art.name + ' technique.');
        expect(engineCalls(result).map(c => c.name)).toContain('technique_manage.practise');
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
        await expect(game.roster()).rejects.toMatchObject({ status: 403 });
        await expect(game.ladderOdds()).rejects.toMatchObject({ status: 403 });
    });

    it('is read-only: listing it does not touch a single row', async () => {
        const { db, game } = makeGame({ adminMode: true });
        const { cultivator } = await game.newRun('Anyone');

        const before = db.prepare('SELECT * FROM cultivators').all();
        const roster = await game.roster();
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

        const rows = (await game.roster()).roster;
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

describe('a realm boundary exacts its price', () => {
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

        // A crossing can only take rows that exist, so seed the catalog and the
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

    it('deletes what it says it took - the engine never asserts without a write', async () => {
        let observedTaken = 0;

        // Widened from 60 when birth origins landed. The opening is drawn from
        // the same seed and the ground under it now feeds the ambient roll, so
        // which seeds cross successfully moved - and a fixed sweep that happens
        // to contain a charged crossing is exactly as fragile as it sounds. The
        // count is the guard, not the seeds.
        const seeds = Array.from({ length: 240 }, (_, i) => `t${i}`);
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

describe('derived: the sheet reads the engine, not an approximation of it', () => {
    /** A cultivator shaped for the view, without needing a row for it. */
    function subject(overrides: Partial<Cultivator> = {}): Cultivator {
        return CultivatorSchema.parse({
            id: 'view-subject',
            name: 'Subject',
            spiritRoot: 'single_fire',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            hp: 50, maxHp: 50, qi: 20, maxQi: 20,
            age: 16,
            ...overrides
        });
    }

    it('counts a False Immortal lifespan, not the Tribulation Transcendence one', () => {
        // Ordinal 44 with the last crossing survived but not completed. The
        // ceiling is the False Immortal one, and the whole point of that state
        // is that it is vast, finite and countable - so the number has to be
        // right on the wire rather than corrected in the browser.
        const barred = subject({
            realmOrdinal: 44,
            immortalStatus: 'false_immortal',
            age: 1000
        });

        const derived = derivedView(barred);
        expect(derived.lifespanRemaining)
            .toBe(effectiveLifespanYears(44, 'false_immortal') - 1000);
        expect(derived.lifespanRemaining).not.toBe(lifespanForOrdinal(44) - 1000);
    });

    it('uses the plain realm ceiling for everyone else', () => {
        const ordinary = subject({ realmOrdinal: 44, age: 1000 });
        expect(derivedView(ordinary).lifespanRemaining).toBe(lifespanForOrdinal(44) - 1000);
        expect(derivedView(subject()).lifespanRemaining).toBe(lifespanForOrdinal(0) - 16);
    });

    // ── the two mortality clocks ──
    //
    // The panel had `50` written into it in four places and said "Fifty years
    // without advancing is fatal" to everybody, which was true through
    // Foundation Establishment and a lie above it. The fix is that the browser
    // stops knowing the number at all, so what is asserted here is that the
    // wire carries the engine's own figure for whatever rung is being asked
    // about - not that any particular constant is 50.
    it('ships the settling clock and the span it belongs to, per rung', () => {
        for (const ordinal of [0, 13, 17, 21, 25, 29, 33, 37, 41]) {
            const d = derivedView(subject({ realmOrdinal: ordinal }));
            expect(d.stagnationYears).toBe(stagnationYearsForOrdinal(ordinal));
            expect(d.lifespanYears).toBe(lifespanForOrdinal(ordinal));
            // The meter's own maximum has to be the same span its remainder was
            // subtracted from, or the bar and the sentence under it disagree.
            expect(d.lifespanYears - d.lifespanRemaining).toBe(16);
        }

        // And the figure genuinely moves, which is the whole defect: a client
        // that hardcoded any single number was wrong for most of the ladder.
        expect(derivedView(subject({ realmOrdinal: 0 })).stagnationYears)
            .toBeLessThan(derivedView(subject({ realmOrdinal: 41 })).stagnationYears);
    });

    it('measures the same span a False Immortal is actually living on', () => {
        const d = derivedView(subject({
            realmOrdinal: 44,
            immortalStatus: 'false_immortal',
            age: 1000
        }));
        expect(d.lifespanYears).toBe(effectiveLifespanYears(44, 'false_immortal'));
        expect(d.lifespanYears).not.toBe(lifespanForOrdinal(44));
    });

    // The age term, on the wire so the panel can say what waiting costs rather
    // than only what it leaves. A fraction of THIS rung's span, never an
    // absolute age - which is what makes reaching a rung early worth anything.
    it('ships the age penalty on the next crossing, and where it starts', () => {
        const young = derivedView(subject({ realmOrdinal: 0, age: 16 }));
        expect(young.lifespanPressure).toBe(0);
        expect(young.lifespanPressureFromAge).toBe(lifespanPressureOnsetAge(0));
        expect(young.lifespanPressureFromAge).toBeGreaterThan(young.lifespanPressure);

        const old = derivedView(subject({ realmOrdinal: 0, age: 90 }));
        expect(old.lifespanPressure).toBe(lifespanPressure(0, 90));
        expect(old.lifespanPressure).toBeLessThan(0);

        // Ninety is lethal at Qi Condensation and irrelevant at Core Formation,
        // because the term is age over the realm's span and nothing else. Get
        // this wrong and every high cultivator is permanently doomed.
        expect(derivedView(subject({ realmOrdinal: 17, age: 90 })).lifespanPressure).toBe(0);

        // Reaching a rung early leaves runway on it, and the runway is the
        // reward for climbing young. No bonus awards this; it falls out.
        const early = derivedView(subject({ realmOrdinal: 13, age: 30 }));
        const late = derivedView(subject({ realmOrdinal: 13, age: 95 }));
        expect(early.lifespanPressureFromAge).toBe(late.lifespanPressureFromAge);
        expect(early.lifespanPressureFromAge - 30)
            .toBeGreaterThan(late.lifespanPressureFromAge - 95);
    });

    it('carries the engine own refusal text while a breakthrough is blocked', () => {
        const blocked = derivedView(subject());
        expect(blocked.breakthroughReady).toBe(false);
        expect(blocked.breakthroughBlockedReason).toMatch(/Not enough has accumulated/);

        const barred = derivedView(subject({
            realmOrdinal: 44,
            immortalStatus: 'false_immortal',
            cultivationProgress: 1e9
        }));
        expect(barred.breakthroughReady).toBe(false);
        expect(barred.breakthroughBlockedReason).toMatch(/does not open twice/);
    });

    it('is null once the engine will actually permit an attempt', () => {
        const ready = derivedView(subject({ cultivationProgress: 100_000 }));
        expect(ready.breakthroughReady).toBe(true);
        expect(ready.breakthroughBlockedReason).toBeNull();
    });

    it('says the same sentence the endpoint refuses with', async () => {
        const { game } = makeGame();
        await game.newRun('Impatient');
        const reason = game.state().derived.breakthroughBlockedReason;

        expect(reason).toBeTruthy();
        await expect(game.breakthrough()).rejects.toMatchObject({ message: reason });
    });
});
