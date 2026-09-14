/**
 * Every knowledge row in the world said it descended from nothing.
 *
 * `fact_id` is on the `knowledge_records` table, `KnowledgeRecord.factId` is in
 * the domain model, and two readers already use it: `isGroundless` answers
 * *"there is no event under this"* off `factId === null`, and `recordAccuracy`
 * can only weigh a claim against the truth it names. Both were dark, because
 * the gate's own INSERT wrote the column as a **literal `NULL` in the VALUES
 * clause** - not a parameter nobody passed, a constant - so `isGroundless` was
 * true of every row ever written and accuracy had nothing to compare against.
 *
 * A rumour has carried `Rumour.factId` since it was written, documented as
 * *"the ledger row this descends from, or null when nothing in the world
 * happened as described"*. It reached the gate and was dropped on the floor.
 *
 * WHAT IS PINNED HERE, AND WHAT IS DELIBERATELY NOT. That a claim about an
 * event carries the event, and that a claim about a thing merely existing does
 * not. Null is the ordinary answer for most of the table and is not a failure -
 * nothing happened for "the Azure Dew Sect is a house" to descend from - so
 * asserting non-null everywhere would pin the opposite defect.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';

interface Row { fact_id: string | null; claim_key: string }

describe('a claim says what it came off', () => {
    it('writes the ledger row a claim about an event descends from', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'came-off', worldSeed: 'came-off', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Wen Shu');

        const gate = new KnowledgeGate(db);
        gate.learn({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: 'somebody',
            name: 'Somebody',
            onDay: 1,
            sourceKind: 'told',
            sourceNote: 'Repeated in a market.',
            factId: 'fact-the-duel',
            statement: 'Somebody lost a duel at the ford.'
        });

        const rows = db.prepare(
            'SELECT fact_id, claim_key FROM knowledge_records WHERE holder_id = ?'
        ).all(cultivator.id) as Row[];
        const mine = rows.filter(r => r.claim_key.includes('somebody'));
        expect(mine.length, 'the row was not written at all').toBeGreaterThan(0);
        expect(mine[0].fact_id).toBe('fact-the-duel');
    }, 300_000);

    it('leaves it null for a claim that a thing merely exists', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'came-off-nothing', worldSeed: 'came-off-nothing', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Wen Shu');

        const gate = new KnowledgeGate(db);
        gate.learn({
            holderId: cultivator.id,
            kind: 'sect',
            id: 'a-house',
            name: 'A House',
            onDay: 1,
            sourceKind: 'read',
            sourceNote: 'A notice on a wall.'
        });

        const rows = db.prepare(
            'SELECT fact_id, claim_key FROM knowledge_records WHERE holder_id = ?'
        ).all(cultivator.id) as Row[];
        const mine = rows.filter(r => r.claim_key.includes('a-house'));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine[0].fact_id).toBeNull();
    }, 300_000);

    it('does not write the same one for every row it ever wrote', async () => {
        // THE SHAPE OF THE OLD DEFECT, pinned as its own arm. A constant in the
        // VALUES clause is invisible from any single row: one row reading null
        // is correct, and every row reading null is the bug. So this asks the
        // table whether the column varies at all.
        const { game, db } = await makeGameInWorld({
            seed: 'came-off-varies', worldSeed: 'came-off-varies', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Wen Shu');

        const gate = new KnowledgeGate(db);
        for (const [id, factId] of [['one', 'fact-one'], ['two', null], ['three', 'fact-three']] as const) {
            gate.learn({
                holderId: cultivator.id,
                kind: 'cultivator',
                id,
                name: id,
                onDay: 1,
                sourceKind: 'told',
                sourceNote: 'Said out loud.',
                factId
            });
        }

        const rows = db.prepare(
            'SELECT DISTINCT fact_id FROM knowledge_records WHERE holder_id = ?'
        ).all(cultivator.id) as { fact_id: string | null }[];
        expect(rows.length, 'every row carries the same value').toBeGreaterThan(1);
    }, 300_000);
});
