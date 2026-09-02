/**
 * A cultivator's pools are derived from the rung, and the rung moves.
 *
 * The companion to `tests/engine/cultivation/what-a-rung-buys-in-body.test.ts`,
 * which pins the CURVE. This pins that a live cultivator is actually on it.
 *
 * `advanceRealm` is the one function every rank change in the codebase passes
 * through - the played layer (`src/web/apply.ts`), the MCP tool surface
 * (`cultivation-manage.ts`) and the admin panel (`admin-manage.set_realm`) all
 * land here - so it is the single place the derivation can bind everybody at
 * once. A stored pool that nothing re-derives is the "field nothing writes"
 * defect in AGENTS.md at its most expensive: it reads as a value, and every
 * system around it goes on answering with total confidence.
 *
 * What it read before: a played run at False Immortal holding 50 HP and 30 qi.
 */

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import {
    MAX_ORDINAL,
    maxHpForOrdinal,
    maxQiForOrdinal
} from '../../src/engine/cultivation/realms.js';

const NOW = '2025-01-01T00:00:00.000Z';
const MIGHT = 3;
const INSIGHT = 4;

function repoWith(overrides: { realmOrdinal?: number; hp?: number; qi?: number } = {}) {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    const repo = new CultivatorRepository(db);
    const ordinal = overrides.realmOrdinal ?? 0;
    repo.create({
        id: 'climber',
        name: 'Climber',
        kind: 'pc',
        spiritRoot: 'single_fire',
        attributes: { might: MIGHT, insight: INSIGHT, fortune: 2, charm: 2 },
        realmOrdinal: ordinal,
        hp: overrides.hp ?? maxHpForOrdinal(MIGHT, ordinal),
        maxHp: maxHpForOrdinal(MIGHT, ordinal),
        qi: overrides.qi ?? maxQiForOrdinal(INSIGHT, ordinal),
        maxQi: maxQiForOrdinal(INSIGHT, ordinal),
        createdAt: NOW,
        updatedAt: NOW
    });
    return { db, repo };
}

describe('the pool is re-derived wherever a rung changes', () => {
    it('climbing the ladder grows the body', () => {
        // The defect in one assertion: this used to read 50 HP and 30 qi at
        // every one of these rungs.
        for (const ordinal of [1, 13, 29, MAX_ORDINAL]) {
            const { db, repo } = repoWith();
            const after = repo.advanceRealm('climber', ordinal)!;
            expect(after.realmOrdinal).toBe(ordinal);
            expect(after.maxHp, `HP at ordinal ${ordinal}`).toBe(maxHpForOrdinal(MIGHT, ordinal));
            expect(after.maxQi, `qi at ordinal ${ordinal}`).toBe(maxQiForOrdinal(INSIGHT, ordinal));
            db.close();
        }
    });

    it('the derivation survives a round trip through SQLite', () => {
        const { db, repo } = repoWith();
        repo.advanceRealm('climber', 29);
        const loaded = repo.getById('climber')!;
        expect(loaded.maxHp).toBe(maxHpForOrdinal(MIGHT, 29));
        expect(loaded.maxQi).toBe(maxQiForOrdinal(INSIGHT, 29));
        db.close();
    });

    it('the vessel is enlarged and not filled', () => {
        // A crossing is not a heal. What a crossing costs is
        // `price-of-advancement.ts`, and nothing here may quietly give
        // something back on the side.
        const { db, repo } = repoWith({ realmOrdinal: 12, hp: 7, qi: 3 });
        const after = repo.advanceRealm('climber', 1)!;
        expect(after.hp).toBe(7);
        expect(after.qi).toBe(3);
        expect(after.maxHp).toBe(maxHpForOrdinal(MIGHT, 13));
        db.close();
    });

    it('going back down shrinks the vessel, and the clamp holds', () => {
        // `admin set_realm` moves a cultivator either way through this same
        // call. Without the clamp the row would carry hp above maxHp and the
        // schema would reject the next write it took part in.
        const { db, repo } = repoWith();
        repo.advanceRealm('climber', MAX_ORDINAL);
        const down = repo.advanceRealm('climber', -MAX_ORDINAL)!;
        expect(down.realmOrdinal).toBe(0);
        expect(down.maxHp).toBe(maxHpForOrdinal(MIGHT, 0));
        expect(down.hp).toBeLessThanOrEqual(down.maxHp);
        expect(down.qi).toBeLessThanOrEqual(down.maxQi);
        db.close();
    });
});
