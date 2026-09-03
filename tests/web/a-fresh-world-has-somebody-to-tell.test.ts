/**
 * On turn one, in a fresh world, can a player find somebody who lost a relative
 * and tell them who did it?
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AND WHAT IT REPLACES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `telling-somebody-opens-the-account.test.ts` proves the verb works. It has to
 * ARRANGE both of its preconditions by hand, and says so in its own header,
 * because measured on a freshly created world:
 *
 *     103 historical facts, of which   0 carry `deedWeight`
 *     436 living people,     of which  0 hold a kin, spouse, parent, child,
 *                                        master or disciple tie
 *
 * So every assertion in that file was about a world the player never meets. A
 * verb that works only on a situation a test wrote by hand is the same defect as
 * a module nothing calls, one level down: every artefact of a finished feature
 * is present except a world it can happen in.
 *
 * `the-families-a-world-opens-holding.ts` and `the-wrongs-a-world-opens-holding.ts`
 * are what put the brother and the killing there. This file arranges neither.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ANSWER, IN TWO HALVES, AND THE SECOND ONE IS NOT YET YES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **THE WORLD NOW HOLDS IT.** A fresh world has open killings in it, priced by
 * `whatADeedLeaves` and written by `aDeedEntersTheWorld`, done to people whose
 * families are standing in the same town - and about one run in six opens with
 * one of those families in the room. Measured over six worlds against all
 * seventeen settlements a birth can open in: 16 of 102. That is the first test
 * below, and nothing in it is arranged.
 *
 * **AND THE PLAYER CANNOT FIND OUT ABOUT IT.** Measured, standing in Thirdwall,
 * in the town where the killing happened, next to the dead man's father, on the
 * pinned pair below - every discovery verb the game has returns nothing:
 *
 *     "I look around"                    the ground, the qi, who is here
 *     "what news is there"               apex faction history, generations back
 *     "I listen for rumours"             the same two lines again
 *     "what do people say about this     the settlement's own description
 *      place"
 *     "I ask <the father> what happened   "they could not tell you"
 *      here"
 *     "I investigate <the dead man>"     "nothing here answers to it"
 *
 * so `couldPointAtIt` refuses, correctly, and the telling comes back *"news only
 * carries as far as you can point at what was done."* The gate is right. What is
 * missing is any way through it.
 *
 * The cause is in `airtimeOf` in `what-people-are-saying.ts`, and it is one term
 * rather than a system: a fact's airtime is its magnitude, its scale, HOW FAR
 * ABOVE THE TELLER THE PEOPLE IN IT STAND, and its age. There is no term for
 * *it happened here*. `TellerStanding` carries `regionId` and `airtimeOf` never
 * reads it. So a fact naming an apex house scores +2.2 for the gap alone and a
 * killing between two ordinary people in this street scores +0.3, and a rumour
 * layer whose entire job is what the people standing HERE say is happening
 * reports the top of the world and never the town.
 *
 * That is a design question and not this file's to settle - it changes what
 * every market in the world repeats - so the second test arranges the one thing
 * and only the thing the world cannot yet supply: that the player has heard the
 * dead man's name. Everything past that is played.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { worldLocationFor } from '../../src/web/entities';
import type { WorldState } from '../../src/engine/world/world-state';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import type { HistoricalFact } from '../../src/engine/world/history';

/** The blood kinds `whoTheyCarryFor` reads. Not the two teaching ones. */
const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);

/**
 * The world and the birth that put one of this world's bereaved households in
 * the room a run opens in. Both halves pinned - see the header for the rate.
 */
const WORLD = 'wants-telling-world';
const BIRTH = 'sweep-10';

interface LedgerRow {
    holder_id: string;
    subject_id: string | null;
    severity: string;
    cause: string;
    tags: string;
    triggering_event_id: string | null;
}

function ledger(db: { prepare(sql: string): { all(): unknown } }): LedgerRow[] {
    return db.prepare(
        'SELECT holder_id, subject_id, severity, cause, tags, triggering_event_id '
        + 'FROM obligations'
    ).all() as LedgerRow[];
}

interface Standing {
    world: WorldState;
    here: { id: string; name: string }[];
    hearer: NpcRecord;
    /** The blood tie that makes the wrong theirs to hold. */
    lostKind: string;
    victimId: string;
    victimName: string;
    fact: HistoricalFact;
    killer: { id: string; name: string };
}

/**
 * What the run opened next to, read off the world and off `present`.
 *
 * `present` is the roster the engine itself uses to decide who is here, so a
 * test that picked people any other way would be arranging a situation the verb
 * will not agree it is in.
 */
async function whatIsStandingHere(game: unknown, cultivator: unknown): Promise<Standing> {
    const svc = game as {
        loadWorld(): Promise<WorldState | null>;
        present(c: unknown): { id: string; name: string }[];
    };
    const world = (await svc.loadWorld())!;
    const here = svc.present(cultivator);

    const dead = new Set(
        world.npcs.filter(npc => npc.status !== 'alive').map(npc => npc.id));
    const priced = world.history.facts.filter(
        fact => fact.data && 'deedWeight' in fact.data);

    const hearer = world.npcs.find(npc =>
        here.some(p => p.id === npc.id)
        && npc.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId)))!;
    const loss = hearer?.relationships.find(
        r => BLOOD.has(r.kind) && dead.has(r.targetId))!;
    const fact = priced.find(f => f.actors.some(a => a.id === loss?.targetId))!;
    const killer = fact?.actors.find(a => a.id !== loss.targetId)!;

    return {
        world, here, hearer,
        lostKind: loss?.kind,
        victimId: loss?.targetId,
        victimName: loss?.targetName,
        fact, killer
    };
}

describe('a fresh world has somebody to tell', () => {
    /**
     * The half that is now yes, with nothing arranged at all.
     *
     * A world is created from a seed, a run opens in it, and the person standing
     * in the room has lost somebody to a killing the world priced and wrote down.
     */
    it('opens a run standing next to somebody who lost a relative to a priced wrong', async () => {
        const { game } = await makeGameInWorld({
            seed: BIRTH, worldSeed: WORLD, worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        const s = await whatIsStandingHere(game, cultivator);

        const priced = s.world.history.facts.filter(f => f.data && 'deedWeight' in f.data);
        expect(priced.length,
            'a fresh world holds wrongs somebody can hold an account about')
            .toBeGreaterThan(0);

        const where = worldLocationFor(s.world, (cultivator as { location: string }).location);
        expect(s.hearer, `somebody at ${where?.name} has lost somebody`).toBeDefined();
        expect(BLOOD.has(s.lostKind),
            'and the tie is one `whoTheyCarryFor` reads').toBe(true);

        // The wrong is a real, complete, findable record - not a flag on a
        // person. Everything downstream reads these four fields.
        expect(s.fact.data.deedWeight, 'priced by the one pricer').toBeDefined();
        expect(s.fact.actors.map(a => a.id))
            .toEqual(expect.arrayContaining([s.victimId, s.killer.id]));
        expect(s.fact.witnessIds.length,
            'and it happened in front of people, because it was written through '
            + '`appendWorldFact` like any other deed').toBeGreaterThan(0);

        // And the man who did it is still alive and still standing here, so the
        // account has somewhere to point.
        const killer = s.world.npcs.find(npc => npc.id === s.killer.id)!;
        expect(killer.status, 'the killer is still alive').toBe('alive');
        expect(s.here.some(p => p.id === killer.id),
            'and standing where it happened, so a player can name him').toBe(true);
    }, 180000);

    /**
     * And the telling, played, with exactly one thing arranged.
     *
     * The arrangement is that the player has heard the dead man's name, which is
     * the whole of what the discovery layer cannot currently give them - see the
     * header. It is `learn`, one row, the same row hearing it in a square would
     * write, and nothing else about the situation is touched.
     */
    it('the telling opens the account, at the weight the world priced it', async () => {
        const { db, game } = await makeGameInWorld({
            seed: BIRTH, worldSeed: WORLD, worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        const s = await whatIsStandingHere(game, cultivator);

        (game as unknown as { knowledge: { learn(i: unknown): unknown } }).knowledge.learn({
            holderId: (cultivator as { id: string }).id,
            kind: 'cultivator',
            id: s.victimId,
            name: s.victimName,
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'Heard the name in the street.'
        });

        expect(ledger(db), 'nothing is held before somebody is told').toHaveLength(0);

        const said = await game.act(
            `I tell ${s.hearer.name} that ${s.killer.name} killed ${s.victimName}`);

        const rows = ledger(db);
        expect(rows, 'the telling opened exactly one account').toHaveLength(1);
        expect(rows[0].holder_id, 'held by the person who lost somebody')
            .toBe(s.hearer.id);
        expect(rows[0].subject_id, 'against the man the player named')
            .toBe(s.killer.id);
        // The weight the world priced it at on the day, carried through
        // untouched. Finding out makes a thing held, not heavier.
        expect(rows[0].severity).toBe(String(s.fact.data.deedWeight));
        // The two views of one event, joined. A reader in forty years can walk
        // from the account to the killing and back.
        expect(rows[0].triggering_event_id).toBe(s.fact.id);
        const tags = JSON.parse(rows[0].tags) as string[];
        expect(tags, 'and the row says which tie made it theirs to hold')
            .toContain(`carried:${s.lostKind}`);
        expect(tags).toContain(`told-by:${(cultivator as { id: string }).id}`);
        expect(said.narration).toContain(s.hearer.name);
    }, 180000);

    /**
     * The other edge, because a world that has finally got wrongs in it could as
     * easily have got too many.
     *
     * The person told here is standing in the same room, has heard the same
     * sentence, and has lost nobody. A verb that opened an account against
     * anybody in earshot would be the same defect from the opposite side.
     */
    it('reaches nothing when the person told has lost nobody', async () => {
        const { db, game } = await makeGameInWorld({
            seed: BIRTH, worldSeed: WORLD, worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        const s = await whatIsStandingHere(game, cultivator);

        const dead = new Set(
            s.world.npcs.filter(npc => npc.status !== 'alive').map(npc => npc.id));
        const carriesNothing = s.here.find(p => {
            const npc = s.world.npcs.find(n => n.id === p.id);
            return npc !== undefined
                && !npc.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId));
        })!;
        expect(carriesNothing, 'somebody here has lost nobody').toBeDefined();

        const said = await game.act(
            `I tell ${carriesNothing.name} that ${s.killer.name} killed ${s.victimName}`);

        expect(ledger(db), 'nobody holds anything').toHaveLength(0);
        // And the answer is about the world rather than about the sentence. The
        // refusal this verb replaced was "they look at you the way people look
        // at a sentence with a hole in it", and a player cannot tell that apart
        // from indifference.
        expect(said.narration.toLowerCase()).not.toContain('hole in it');
    }, 180000);
});
