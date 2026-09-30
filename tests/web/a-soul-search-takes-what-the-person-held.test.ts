/**
 * Soul searching had only a threat and no act. The live act reads both stored
 * claims and first-hand history, preserves a belief as a belief, and applies
 * the soul-search resolver's harm. Swallowing the quiet pill denies the search
 * and must also record a permanent death, rather than leave a living empty row.
 */
import { describe, expect, it } from 'vitest';
import { engineCalls, makeGameInWorld } from './harness';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import { getPill } from '../../src/data/cultivation/index.js';
import { SOUL_QUENCHING_PILL_ID } from '../../src/data/cultivation/pills.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { soulSearchOpensAt } from '../../src/engine/social/what-a-soul-search-takes.js';
import { makeFact } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support.js';

async function besideSomebodyWithAMemory(worthKeeping = false) {
    const harness = await makeGameInWorld({
        seed: 'search-a-soul', worldSeed: 'world-search-a-soul', worldEnabled: true
    });
    const { game, db, repos } = harness;
    const { cultivator } = await game.newRun('Lin Zhaoyi');
    db.prepare('UPDATE cultivators SET realm_ordinal = 29, hp = 9000, max_hp = 9000 WHERE id = ?')
        .run(cultivator.id);
    await standWhereThePeopleAre(harness, cultivator.id);
    const me = repos.cultivators.getById(cultivator.id)!;
    const mark = game.present(me).map(person => game.atHand!.npcs.find(npc => npc.id === person.id))
        .find(npc => npc !== undefined)!;
    expect(mark).toBeDefined();
    mark.cultivation.realmOrdinal = 0;
    mark.soulState = 'intact';
    mark.identityContinuity = 1;
    game.knowledge.learn({
        holderId: me.id, kind: 'cultivator', id: mark.id, name: mark.name,
        onDay: 0, sourceKind: 'told', stance: 'knows'
    });
    const memory = game.knowledge.learn({
        holderId: mark.id, kind: 'thing', id: 'hidden-ledger', name: 'Hidden ledger',
        onDay: 0, sourceKind: 'fabricated', stance: 'believes', stage: 'placed', confidence: 0.9,
        statement: 'The ledger is beneath the hearth.'
    });
    // Fabrication is a whisper; the pill needs something held with conviction.
    if (worthKeeping) {
        game.knowledge.learn({
            holderId: mark.id, kind: 'thing', id: 'kept-ledger', name: 'Kept ledger',
            onDay: 0, sourceKind: 'told', stance: 'believes', stage: 'placed', confidence: 0.9,
            statement: 'The ledger is inside the western store.'
        });
    }
    game.theWorldMoved();
    const live = () => game.atHand!.npcs.find(npc => npc.id === mark.id)!;
    return { game, db, me, memory, live };
}

describe('searching a soul', () => {
    it('routes an explicit search without treating an ordinary search as coercion', () => {
        expect(parseIntent("I search Qiu Wanbo's soul")).toMatchObject({
            action: 'coerce', intent: 'soul_search', target: 'Qiu Wanbo'
        });
        expect(parseIntent('I search for herbs').action).not.toBe('coerce');
        expect(parseIntent('I read the manual').action).not.toBe('coerce');
        expect(parseIntent('Can I soul search Qiu Wanbo?').action).not.toBe('coerce');
    });

    it('copies a belief with its provenance and without promoting it to truth', async () => {
        const { game, db, me, memory, live } = await besideSomebodyWithAMemory();
        const acted = await game.act(`I soul search ${live().name}`);
        expect(engineCalls(acted).some(c => c.name === 'social.whatASoulSearchTakes' && c.ok)).toBe(true);
        const taken = db.prepare(
            'SELECT stance, statement, source_kind, source_from_holder_id, source_via_record_id, confidence FROM knowledge_records WHERE holder_id = ? AND claim_key = ?'
        ).all(me.id, memory.claimKey);
        expect(taken).toContainEqual({
            stance: 'believes', statement: memory.statement, source_kind: 'taken',
            source_from_holder_id: live().id, source_via_record_id: memory.id, confidence: 0.9
        });
        expect(live().soulState, 'a distant reader opens it without tearing').toBe('intact');
    });

    it('takes a witnessed memory even when the subject was not an actor', async () => {
        const { game, db, me, live } = await besideSomebodyWithAMemory();
        const fact = appendWorldFact(game.atHand!, makeFact({
            day: game.atHand!.currentDay, kind: 'said_in_public',
            summary: 'The storekeeper said the eastern store was empty.',
            witnessIds: [live().id], actors: []
        }));
        game.theWorldMoved();
        await game.act(`I soul search ${live().name}`);
        const taken = db.prepare(
            "SELECT statement, source_kind FROM knowledge_records WHERE holder_id = ? AND claim_key = ?"
        ).get(me.id, `fact:${fact.id}`);
        expect(taken).toEqual({ statement: fact.summary, source_kind: 'taken' });
    });

    it('records death and spends the pill when the subject denies the search', async () => {
        const { game, db, me, memory, live } = await besideSomebodyWithAMemory(true);
        const pill = getPill(SOUL_QUENCHING_PILL_ID)!;
        game.atHand!.objects.push(makeObject({
            id: 'quiet-pill-in-the-hand', name: pill.name, kind: 'pill', significance: 'significant',
            possessorId: live().id, ownerId: live().id, power: null,
            data: { pillId: pill.id }
        }));
        game.theWorldMoved();
        const acted = await game.act(`I soul search ${live().name}`);
        expect(engineCalls(acted).some(c => c.name === 'social.wouldTheySwallowIt' && c.ok)).toBe(true);
        expect(live().status).not.toBe('alive');
        expect(live().soulState).toBe('fading');
        expect(live().identityContinuity).toBe(0);
        expect(game.atHand!.objects.find(object => object.id === 'quiet-pill-in-the-hand')?.data.spent)
            .toBe(true);
        expect(db.prepare('SELECT 1 FROM knowledge_records WHERE holder_id = ? AND claim_key = ?')
            .get(me.id, memory.claimKey)).toBeUndefined();
        expect(game.atHand!.history.facts.some(fact => fact.kind === 'death'
            && fact.actors.some(actor => actor.id === live().id))).toBe(true);
    });

    it('applies the harm when the reader has to force the soul open', async () => {
        const { game, live } = await besideSomebodyWithAMemory();
        live().cultivation.realmOrdinal = soulSearchOpensAt();
        // One arranged memory isolates harm from a partial search's selection.
        game.atHand!.history.facts = [];
        game.theWorldMoved();
        const acted = await game.act(`I soul search ${live().name}`);
        expect(engineCalls(acted).some(c => c.name === 'social.whatASoulSearchTakes' && c.ok)).toBe(true);
        expect(live().soulState).toBe('damaged');
        expect(live().status).toBe('alive');
    });

    it('can put the quiet pill in somebody\'s hand by playing, and they can swallow it', async () => {
        const { game, db, me, live } = await besideSomebodyWithAMemory(true);
        addToPouch(db, me.id, SOUL_QUENCHING_PILL_ID, 'pill', 1);
        const given = await game.act(`I give the Soul-Quenching Pill to ${live().name}`);
        expect(given.narration).toContain('Soul-Quenching Pill');
        expect(pouchQuantity(db, me.id, SOUL_QUENCHING_PILL_ID)).toBe(0);
        expect(pouchQuantity(db, live().id, SOUL_QUENCHING_PILL_ID)).toBe(1);
        const searched = await game.act(`I soul search ${live().name}`);
        expect(engineCalls(searched).some(c => c.name === 'social.wouldTheySwallowIt' && c.ok)).toBe(true);
        expect(pouchQuantity(db, live().id, SOUL_QUENCHING_PILL_ID)).toBe(0);
        expect(live().status).not.toBe('alive');
    });

    it('also records death when the same pill is forced down their throat', async () => {
        const { game, db, me, live } = await besideSomebodyWithAMemory();
        addToPouch(db, me.id, SOUL_QUENCHING_PILL_ID, 'pill', 1);
        await game.act(`I make ${live().name} swallow the Soul-Quenching Pill`);
        expect(pouchQuantity(db, me.id, SOUL_QUENCHING_PILL_ID)).toBe(0);
        expect(live().status).not.toBe('alive');
        expect(live().soulState).toBe('fading');
        expect(live().identityContinuity).toBe(0);
    });

    it('names the capability gate before opening a fight', async () => {
        const { game, db, me, live } = await besideSomebodyWithAMemory();
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(soulSearchOpensAt() - 1, me.id);
        const acted = await game.act(`I soul search ${live().name}`);
        expect(acted.narration).toMatch(/nascent soul|Nascent Soul/);
        expect(engineCalls(acted).some(c => c.name === 'social.whatASoulSearchTakes')).toBe(false);
        expect(live().soulState).toBe('intact');
    });
});
