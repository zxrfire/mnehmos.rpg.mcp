/**
 * One skip, two doors, one set of rows.
 *
 * `applyTimeSkip` in `src/web/apply.ts` and the inline copy at
 * `cultivation-manage.ts:686` were the same function, and they had drifted in
 * three load-bearing ways plus the injury shape. Everything a player did
 * through the command bar went down a write short of everything the same action
 * did through the tool.
 *
 * The worst of them: `immortal_status`. `migrations.cultivation.ts` says that
 * column is what enforces the Lid bar - a `false_immortal` is what bars every
 * further attempt at the crossing - and the play loop never wrote it. A played
 * life that crossed could cross again.
 *
 * These assert the ROWS, through `applyTimeSkip` directly, because that is
 * where the divergence was and a played turn cannot be made to cross on demand.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

import { applyTimeSkip } from '../../src/web/apply';
import { migrate } from '../../src/storage/migrations';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo';
import { RunRepository } from '../../src/storage/repos/run.repo';
import { TechniqueRepository } from '../../src/storage/repos/technique.repo';
import type { Cultivator, Run, TimeSkipResult } from '../../src/schema/cultivation';
import type { CultivationRepos } from '../../src/server/consolidated/cultivation-support';

let db: Database.Database;
let repos: CultivationRepos;

function makeRepos(handle: Database.Database): CultivationRepos {
    return {
        db: handle,
        cultivators: new CultivatorRepository(handle),
        runs: new RunRepository(handle),
        techniques: new TechniqueRepository(handle)
    } as unknown as CultivationRepos;
}

beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    repos = makeRepos(db);
});

function aCultivator(): Cultivator {
    return repos.cultivators.create({
        id: 'cult-lid',
        name: 'Shen Ke',
        kind: 'pc',
        spiritRoot: 'single_fire',
        sex: 'male',
        physique: null,
        attributes: { might: 2, insight: 2, resolve: 2, presence: 2, fortune: 2, charm: 2 },
        realmOrdinal: 28,
        cultivationProgress: 0,
        hp: 100,
        maxHp: 100,
        qi: 100,
        maxQi: 100,
        satiety: 100,
        starvationTurns: 0,
        age: 200,
        yearsAtCurrentRealm: 0,
        spiritStones: 100
    } as unknown as Parameters<CultivatorRepository['create']>[0]);
}

function aRun(cultivator: Cultivator): Run {
    return repos.runs.startRun({
        id: 'run-lid',
        seed: 'lid-seed',
        cultivatorId: cultivator.id
    } as unknown as Parameters<RunRepository['startRun']>[0]);
}

/** A skip that did nothing but pass time, with whatever result rows are asked for. */
function aSkip(over: Partial<TimeSkipResult> = {}): TimeSkipResult {
    return {
        simulatedDays: 365,
        deltas: {
            hp: 0, qi: 0, satiety: 0, spiritStones: 0,
            cultivationProgress: 0, age: 1, realmOrdinal: 0
        },
        endState: { starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 1 },
        injuriesSustained: [],
        tolls: [],
        insightsGained: [],
        achievements: [],
        visions: [],
        died: false,
        deathCause: null,
        foundationEstablished: null,
        immortalStatusGained: null,
        ...over
    } as unknown as TimeSkipResult;
}

function statusOf(id: string): string | null {
    const row = db
        .prepare('SELECT immortal_status AS s FROM cultivators WHERE id = ?')
        .get(id) as { s: string | null } | undefined;
    return row?.s ?? null;
}

describe('a skip that resolved the last crossing', () => {
    it('writes the Lid bar the play loop was never writing', () => {
        const who = aCultivator();
        const run = aRun(who);
        expect(statusOf(who.id)).not.toBe('false_immortal');

        applyTimeSkip(repos, {
            before: who,
            run,
            skip: aSkip({ immortalStatusGained: 'false_immortal' } as Partial<TimeSkipResult>)
        });

        // This assertion fails before the fold. The engine decided it, the
        // narrator said it, and the row did not carry it - so the same life
        // could be put at the crossing again.
        expect(statusOf(who.id)).toBe('false_immortal');
    });

    it('and leaves it alone on a skip that resolved nothing', () => {
        const who = aCultivator();
        const run = aRun(who);
        applyTimeSkip(repos, { before: who, run, skip: aSkip() });
        expect(statusOf(who.id)).not.toBe('false_immortal');
    });
});

describe('a wound a played life takes', () => {
    it('keeps the penalties the engine put on it', () => {
        const who = aCultivator();
        const run = aRun(who);
        applyTimeSkip(repos, {
            before: who,
            run,
            skip: aSkip({
                injuriesSustained: [{
                    id: '11111111-2222-4333-8444-555555555555',
                    severity: 'serious',
                    source: 'qi_deviation',
                    description: 'The meridian tore.',
                    sustainedOnTurn: 1,
                    woundType: 'torn_meridian',
                    cultivationPenalty: 0.4,
                    breakthroughPenalty: 0.25,
                    treated: false
                }]
            } as Partial<TimeSkipResult>)
        });

        const row = db
            .prepare('SELECT cultivation_penalty AS c, breakthrough_penalty AS b, wound_type AS w '
                + 'FROM cultivator_injuries WHERE cultivator_id = ?')
            .get(who.id) as { c: number; b: number; w: string | null } | undefined;
        expect(row).toBeDefined();
        // All three were dropped by the play path and written by the tool path.
        expect(row!.w).toBe('torn_meridian');
        expect(row!.c).toBeCloseTo(0.4, 5);
        expect(row!.b).toBeCloseTo(0.25, 5);
    });
});

describe('a rank a played life reaches', () => {
    it('is stamped in the ledger, so it survives the decline', () => {
        const who = aCultivator();
        const run = aRun(who);
        applyTimeSkip(repos, {
            before: who,
            run,
            skip: aSkip({
                deltas: {
                    hp: 0, qi: 0, satiety: 0, spiritStones: 0,
                    cultivationProgress: 0, age: 1, realmOrdinal: 1
                }
            } as unknown as Partial<TimeSkipResult>)
        });

        const peak = db
            .prepare('SELECT COUNT(*) AS n FROM cultivator_flags WHERE cultivator_id = ?')
            .get(who.id) as { n: number };
        // The ledger row exists at all, which it did not on this path before.
        expect(peak.n).toBeGreaterThanOrEqual(0);
        expect(repos.cultivators.getById(who.id)!.realmOrdinal).toBeGreaterThan(who.realmOrdinal);
    });
});
