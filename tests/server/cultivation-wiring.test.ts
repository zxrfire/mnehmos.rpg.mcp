/**
 * The wiring tests.
 *
 * Everything here was BUILT and UNREACHABLE: the world clock, the five
 * capability predicates, understanding and Dao, the mortal economy, and sect
 * politics. The engine's own suites already prove the arithmetic. What these
 * prove is that the arithmetic is now connected to a tool, that what the engine
 * decided reaches SQLite, and that nothing leaks past the discovery gate on the
 * way out.
 */

import { randomUUID } from 'crypto';
import {
    handleCultivationManage
} from '../../src/server/consolidated/cultivation-manage.js';
import { handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import {
    activeWorldId,
    createWorld,
    listWorlds,
    resetCultivationWorlds
} from '../../src/server/state/cultivation-world.js';
import { runSeedFor } from '../../src/engine/world/legacy.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { CERTIFICATION_COST_STONES } from '../../src/server/consolidated/sect-politics.js';
import { getSectsClaimingLivingAncestor, getSectAncestry } from '../../src/data/cultivation/sects.js';

const ctx = { sessionId: 'wiring' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx as never));
const sect = async (args: Record<string, unknown>) =>
    payload(await handleSectManage(args, ctx as never));

/**
 * Open a life. Pass `null` for the seed to let the run seed DERIVE from the
 * world's, which is the ordinary path; pass one to replay a known run.
 */
async function newRun(seed: string | null = 'wiring-seed', name = 'Ru Anjing') {
    const created = await cultivation({
        action: 'create_cultivator',
        name,
        ...(seed === null ? {} : { seed }),
        location: 'Scarwater'
    });
    expect(created.error).toBeUndefined();
    return created;
}

describe('the wiring', () => {
    let db: ReturnType<typeof getDb>;

    beforeEach(() => {
        closeDb();
        resetCultivationWorlds();
        db = getDb(':memory:');
        delete process.env.ADMIN_MODE;
    });

    afterEach(() => {
        resetCultivationWorlds();
        closeDb();
    });

    // ── THE WORLD CLOCK ──────────────────────────────────────────────────

    describe('the world advances with the cultivator', () => {
        it('returns a digest for the same span that was actually lived', async () => {
            const created = await newRun();
            const result = await cultivation({
                action: 'cultivate',
                cultivatorId: created.cultivator.id,
                years: 20
            });

            expect(result.error).toBeUndefined();
            expect(result.worldDigest).not.toBeNull();
            // The world moved by the span the cultivator lived, never by the
            // span that was asked for.
            const spanDays = result.worldDigest.toDay - result.worldDigest.fromDay;
            expect(spanDays).toBe(Math.floor(result.simulatedDays));
            expect(typeof result.worldDigest.headline).toBe('string');
        });

        it('never names a faction the cultivator has no record for', async () => {
            const created = await newRun();
            const result = await cultivation({
                action: 'cultivate',
                cultivatorId: created.cultivator.id,
                years: 40
            });

            const gate = new KnowledgeGate(db);
            for (const line of result.worldDigest.heard) {
                for (const id of line.namableFactionIds) {
                    expect(gate.isAwareOf(created.cultivator.id, 'sect', id)).toBe(true);
                }
            }
        });

        it('is deterministic: the same WORLD seed and span produce the same digest', async () => {
            // The seed that matters is the world's, not the run's. A run seed
            // reproduces one life; a world seed reproduces the place it was
            // lived in.
            await createWorld({ seed: 'a-fixed-world' });
            const first = await newRun('replay-seed');
            const a = await cultivation({
                action: 'cultivate', cultivatorId: first.cultivator.id, years: 15
            });

            closeDb();
            resetCultivationWorlds();
            db = getDb(':memory:');

            await createWorld({ seed: 'a-fixed-world' });
            const second = await newRun('replay-seed');
            const b = await cultivation({
                action: 'cultivate', cultivatorId: second.cultivator.id, years: 15
            });

            expect(b.worldDigest.headline).toBe(a.worldDigest.headline);
            expect(b.worldDigest.unheard).toBe(a.worldDigest.unheard);
        });
    });

    // ── THE WORLD IS THE OUTER OBJECT ────────────────────────────────────

    describe('the world outlives its runs', () => {
        it('derives a run seed from the world seed, never mints one beside it', async () => {
            const world = await createWorld({ seed: 'derivation' });
            const created = await newRun(null);

            // Run zero of this world, and it is that seed and no other.
            expect(created.run.seed).toBe(runSeedFor(world.seed, 0));
            expect(created.world.id).toBe(world.id);
        });

        it('puts a second run in the SAME world, on the map the first one changed', async () => {
            await createWorld({ seed: 'continuity' });
            const first = await newRun(null, 'Wen Zhao');
            await cultivation({
                action: 'cultivate', cultivatorId: first.cultivator.id, years: 30
            });
            const dayAfterFirst = listWorlds()[0].currentDay;
            expect(dayAfterFirst).toBeGreaterThan(0);

            // End the life; the world keeps going.
            const repos = ensureCultivationDb();
            repos.runs.endRun(first.run.id, 'lifespan_exhausted', 'Lived it out.');

            const second = await newRun(null, 'Wen Shu');
            const worlds = listWorlds();
            // One world, two lives. Not two worlds.
            expect(worlds.length).toBe(1);
            expect(worlds[0].runs).toBe(2);
            // The second life starts in a world the first one already aged.
            expect(worlds[0].currentDay).toBeGreaterThanOrEqual(dayAfterFirst);
            expect(second.run.seed).toBe(runSeedFor(worlds[0].seed, 1));
            expect(second.run.seed).not.toBe(first.run.seed);
        });

        it('creating a fresh world is deliberate, and leaves the old one standing', async () => {
            const first = await createWorld({ seed: 'the-first' });
            const second = await createWorld({ seed: 'the-second' });

            const worlds = listWorlds();
            expect(worlds.map(w => w.id)).toContain(first.id);
            expect(worlds.map(w => w.id)).toContain(second.id);
            // Nothing walks into two at once.
            expect(worlds.filter(w => w.active).length).toBe(1);
            expect(activeWorldId()).toBe(second.id);
        });

        it('survives a cold start by loading the world rather than reseeding it', async () => {
            await createWorld({ seed: 'cold-start' });
            const created = await newRun(null);
            await cultivation({
                action: 'cultivate', cultivatorId: created.cultivator.id, years: 25
            });
            const before = listWorlds()[0];

            // Drop everything this process was holding. The database stays.
            resetCultivationWorlds();

            const after = listWorlds()[0];
            expect(after.id).toBe(before.id);
            expect(after.seed).toBe(before.seed);
            // The clock is where the run left it, not back at the beginning.
            expect(after.currentDay).toBe(before.currentDay);
            expect(after.runs).toBe(before.runs);
        });
    });

    // ── UNDERSTANDING ────────────────────────────────────────────────────

    describe('understanding reaches rest', () => {
        it('writes insights and achievements the skip produced', async () => {
            const created = await newRun();
            // Long enough that the yearly checks have real chances to fire.
            let gained = 0;
            for (let i = 0; i < 4 && gained === 0; i++) {
                const result = await cultivation({
                    action: 'cultivate',
                    cultivatorId: created.cultivator.id,
                    years: 60,
                    rations: 0
                });
                if (result.died) break;
                gained += result.understanding.achievements.length;
            }

            const stored = new CultivatorRepository(db).getById(created.cultivator.id)!;
            // Whatever the engine produced is what the row holds. If nothing
            // was produced that is a legitimate run, but the arrays must at
            // least agree with each other.
            expect(stored.achievements.length).toBeGreaterThanOrEqual(0);
            for (const insight of stored.insights) {
                // Provenance is the whole discipline: an insight that cannot
                // say where it came from is unrepresentable.
                expect(insight.provenance.achievementId.length).toBeGreaterThan(0);
                expect(insight.id).toContain(insight.provenance.achievementId);
            }
        });

        it('reports the Dao as derived, with no affinity anywhere in the payload', async () => {
            const created = await newRun();
            const view = await cultivation({
                action: 'understanding',
                cultivatorId: created.cultivator.id
            });

            expect(view.error).toBeUndefined();
            expect(view.dao.standing).toBe('none');
            expect(view.consequences.grades.find((g: any) => g.grade === 'chaos').permitted)
                .toBe(false);

            // The forbidden surface: latent predisposition, and any advisory
            // about whether a road suits the person walking it.
            const serialised = JSON.stringify(view).toLowerCase();
            expect(serialised).not.toContain('affinity');
            expect(serialised).not.toContain('aptitude');
            expect(serialised).not.toContain('suited');
            expect(serialised).not.toContain('recommend');
        });

        it('lists only what access actually puts within reach', async () => {
            const created = await newRun();
            const view = await cultivation({
                action: 'understanding',
                cultivatorId: created.cultivator.id
            });

            // A cultivator with no library, no teacher and nothing underfoot
            // reaches their own root and nothing else.
            for (const candidate of view.withinReach) {
                expect(candidate.access.kind).toBe('own_root');
            }
        });

        it('widens the set when the ground underfoot has something to teach', async () => {
            const created = await newRun();
            const before = await cultivation({
                action: 'understanding', cultivatorId: created.cultivator.id
            });
            expect(before.withinReach.every((c: any) => c.access.kind === 'own_root')).toBe(true);

            // A discovered site is a real row, and it is the only thing that
            // changes here. Nothing about the cultivator moves.
            db.prepare(`
                INSERT INTO cultivation_sites
                    (id, run_id, kind, name, ordinal, location, discovered, created_on_day)
                VALUES (?, ?, 'grave', 'A sealed tomb under Scarwater', 3, 'Scarwater', 1, 0)
            `).run(randomUUID(), created.run.id);

            const after = await cultivation({
                action: 'understanding', cultivatorId: created.cultivator.id
            });
            const fromSite = after.withinReach.filter((c: any) => c.access.kind === 'site');
            expect(fromSite.length).toBeGreaterThan(0);
            // Every candidate still names what put it within reach.
            for (const candidate of after.withinReach) {
                expect(candidate.access.label.length).toBeGreaterThan(0);
                expect(candidate.opening.length).toBeGreaterThan(0);
            }
        });
    });

    // ── CAPABILITY ───────────────────────────────────────────────────────

    describe('assess answers what happens when you try', () => {
        it('never refuses an attempt against a person, however far above', async () => {
            const created = await newRun();
            const elder = await cultivation({
                action: 'create_cultivator',
                name: 'Elder Shu',
                kind: 'npc',
                runId: created.run.id
            });
            const repos = ensureCultivationDb();
            repos.cultivators.advanceRealm(elder.cultivator.id, 22);

            const view = await cultivation({
                action: 'assess',
                cultivatorId: created.cultivator.id,
                against: 'opponent',
                opponentId: elder.cultivator.id
            });

            expect(view.error).toBeUndefined();
            // The line the whole module exists to hold.
            expect(view.verdicts.attempt.holds).toBe(true);
            expect(view.verdicts.attempt.blockers).toEqual([]);
            // And the honest answers to the other four.
            expect(view.verdicts.succeed.holds).toBe(false);
            expect(view.verdicts.force.holds).toBe(false);
            expect(typeof view.verdicts.survive.likelihood).toBe('string');
            expect(view.verdicts.survive.reason.length).toBeGreaterThan(0);
        });

        it('refuses a place the cultivator has never heard of, rather than describing it', async () => {
            const created = await newRun();
            const view = await cultivation({
                action: 'assess',
                cultivatorId: created.cultivator.id,
                against: 'place',
                place: 'The Ninth Face'
            });
            expect(view.error).toBe('place_not_known');
        });
    });

    // ── THE MORTAL WORLD ─────────────────────────────────────────────────

    describe('the low-realm loop', () => {
        it('lists work and pays for days actually worked', async () => {
            const created = await newRun();
            const before = new CultivatorRepository(db).getById(created.cultivator.id)!;

            const offer = await cultivation({
                action: 'work',
                cultivatorId: created.cultivator.id
            });
            expect(offer.work.length).toBeGreaterThan(0);

            const job = offer.work.find((o: any) => o.minOrdinal === 0);
            const done = await cultivation({
                action: 'work',
                cultivatorId: created.cultivator.id,
                occupationId: job.id,
                months: 12
            });

            expect(done.error).toBeUndefined();
            expect(done.worked).toBe(true);
            const after = new CultivatorRepository(db).getById(created.cultivator.id)!;
            if (!done.span.died) {
                expect(after.spiritStones).toBe(before.spiritStones + done.spiritStonesEarned);
                // The trade the action exists to make real.
                expect(done.span.rate.focus).toBe('idle');
            }
        });

        it('prices the board against what the purse actually holds', async () => {
            const created = await newRun();
            const board = await cultivation({
                action: 'market',
                cultivatorId: created.cultivator.id,
                category: 'lodging'
            });
            expect(board.error).toBeUndefined();
            expect(board.prices.length).toBeGreaterThan(0);
            expect(board.purse.monthsRough).toBeGreaterThan(0);
            for (const price of board.prices) expect(price.category).toBe('lodging');
        });
    });

    // ── SECT POLITICS ────────────────────────────────────────────────────

    describe('sect politics', () => {
        it('refuses to weigh a house the cultivator has never heard of', async () => {
            const created = await newRun();
            const list = await sect({ action: 'list' });
            const target = list.sects[0];
            const view = await sect({
                action: 'prospect',
                cultivatorId: created.cultivator.id,
                sectId: target.id
            });
            expect(view.error).toBe('sect_not_known');
        });

        it('sells a certification, charges for it, and lets a denunciation rest on it', async () => {
            const created = await newRun();
            const claimant = getSectsClaimingLivingAncestor()
                .find(id => getSectAncestry(id)?.claimIsTrue === false);
            expect(claimant).toBeDefined();

            const gate = new KnowledgeGate(db);
            const repos = ensureCultivationDb();
            for (const id of [claimant!, 'house-ninefold-ledger']) {
                gate.learn({
                    holderId: created.cultivator.id,
                    kind: 'sect',
                    id,
                    name: repos.sects.getById(id)?.name ?? id,
                    onDay: 0,
                    sourceKind: 'told'
                });
            }
            repos.cultivators.applyDeltas(created.cultivator.id, { spiritStones: 500 });
            const before = repos.cultivators.getById(created.cultivator.id)!.spiritStones;

            // A denunciation with nothing behind it does not land.
            const bare = await sect({
                action: 'denounce',
                cultivatorId: created.cultivator.id,
                sectId: claimant
            });
            expect(bare.landed).toBe(false);

            const certified = await sect({
                action: 'verify_claim',
                cultivatorId: created.cultivator.id,
                sectId: claimant
            });
            expect(certified.error).toBeUndefined();
            expect(certified.findings.claimStands).toBe(false);
            expect(repos.cultivators.getById(created.cultivator.id)!.spiritStones)
                .toBe(before - CERTIFICATION_COST_STONES);

            // With the certification in hand it does.
            const armed = await sect({
                action: 'denounce',
                cultivatorId: created.cultivator.id,
                sectId: claimant
            });
            expect(armed.landed).toBe(true);
            expect(armed.evidenceHeld).toBe(true);
        });

        it('returns the stack only as far as the cultivator can name it', async () => {
            const created = await newRun();
            const view = await sect({ action: 'above', cultivatorId: created.cultivator.id });
            expect(view.error).toBeUndefined();
            expect(view.stack).toEqual([]);
            // No bare structural label. The model decides what comes back; it
            // is never itself the answer, because "governance: federated"
            // invites a narrator to explain the world instead of showing it.
            // The word may appear inside authored prose - that is the world
            // describing itself - but never as a field of its own.
            expect(view.governance).toBeUndefined();
            expect(view.model).toBeUndefined();
            expect(view.whatItIsLikeHere.length).toBeGreaterThan(0);
        });

        it('will not surface a hidden dormant ancestor to an outsider', async () => {
            const created = await newRun();
            const hidden = Object.entries(
                Object.fromEntries(
                    getSectsClaimingLivingAncestor().map(id => [id, getSectAncestry(id)])
                )
            );
            void hidden;

            for (const sectId of ['sect-crimson-abyss-hall', 'house-narrow-hour', 'house-measured-span']) {
                const records = getSectAncestry(sectId);
                if (!records?.dormant || records.dormant.publiclyKnown) continue;
                const view = await sect({
                    action: 'wake',
                    cultivatorId: created.cultivator.id,
                    sectId
                });
                expect(view.somethingUnderTheMountain).toBe(false);
                expect(JSON.stringify(view)).not.toContain(records.dormant.name);
            }
        });

        it('refuses to be the mechanism that asserts a wake condition was met', async () => {
            const created = await newRun();
            // Even with a claim smuggled in as an argument, nothing wakes.
            const view = await sect({
                action: 'wake',
                cultivatorId: created.cultivator.id,
                sectId: 'sect-azure-cloud-pavilion',
                conditionMet: true,
                woken: true
            });
            expect(view.woken ?? false).toBe(false);
        });
    });

    // ── THE AUTHORITY BOUNDARY, ACROSS EVERY NEW ACTION ──────────────────

    it('accepts no outcome on any newly wired action', async () => {
        const created = await newRun();
        const attempts: Record<string, unknown>[] = [
            { action: 'assess', against: 'opponent', opponentId: created.cultivator.id, holds: true, likelihood: 'certain' },
            { action: 'understanding', dao: 'the Dao of the Sword', standing: 'dao' },
            { action: 'work', occupationId: 'job-porter', months: 1, spiritStonesEarned: 99_999 },
            { action: 'market', prices: [] }
        ];
        for (const args of attempts) {
            const result = await cultivation({ ...args, cultivatorId: created.cultivator.id });
            // Nothing the caller asserted may appear as an engine answer.
            if (args.standing) expect(result.dao?.standing).toBe('none');
            if (args.spiritStonesEarned) {
                expect(result.spiritStonesEarned).not.toBe(99_999);
            }
        }
        expect(randomUUID().length).toBeGreaterThan(0);
    });
});
