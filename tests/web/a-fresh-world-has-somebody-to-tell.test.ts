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
 * families are standing in the same town - and about one run in fifteen opens
 * with one of those families in the room. Measured over six worlds against all
 * seventeen settlements a birth could open in: 16 of 102. RE-MEASURED after the
 * world layer moved, over twelve worlds and thirty birth draws each: 23 of 360,
 * with ten of the twelve worlds holding at least one. The rate halved and the
 * claim held. That is the first two tests below, and nothing in either is
 * arranged.
 *
 * **AND THE PLAYER CANNOT FIND OUT ABOUT IT.** Measured, standing in Three Walls,
 * in the town where the killing happened, next to the dead man's father - every
 * discovery verb the game has returns nothing:
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
import { seedWorld } from '../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../src/engine/world/catalog';
import { drawBirth } from '../../src/engine/birth/birth';
import { WORLD_POPULATION } from '../../src/server/state/cultivation-world';
import type { WorldState } from '../../src/engine/world/world-state';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import type { HistoricalFact } from '../../src/engine/world/history';

/** The blood kinds `whoTheyCarryFor` reads. Not the two teaching ones. */
const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);

/**
 * ═════════════════════════════════════════════════════════════════════════
 * THE PAIR IS SWEPT FOR, NOT PINNED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This file used to name one world and one birth - `wants-telling-world` and
 * `sweep-10` - found by sweeping and then written down. That is the coincidence
 * the header's own rate warns about from the other side: at about one opening
 * in fifteen, ANY pinned pair is one world change away from being one of the
 * fourteen, and this one duly stopped being an opening when the world moved.
 *
 * Re-measured after it moved, over 12 worlds and 30 birth draws each, at the
 * population `createWorld` actually uses:
 *
 *     23 of 360 (world, birth) pairs      6.4%     was 16 of 102, 15.7%
 *     10 of 12 worlds hold at least one   83%
 *
 * So the claim is now tested in the shape it was always making - a FRESH WORLD
 * has somebody to tell, in most worlds - and the played tests take whichever
 * pair the same sweep finds first. `seedWorld` needs no database and the whole
 * sweep costs about four seconds, which is what makes reading affordable where
 * pinning was not.
 */
const WORLDS = [
    'wants-telling-world',
    ...Array.from({ length: 11 }, (_, i) => `telling-world-${i}`)
];
const BIRTHS = Array.from({ length: 30 }, (_, i) => `sweep-${i}`);

interface Sweep {
    pairs: number;
    hits: number;
    worldsWithOne: number;
    /** The first pair that opens beside a priced loss. */
    first: { worldSeed: string; seed: string } | null;
}

/**
 * Whether a run opening at this place would open beside somebody with a priced
 * loss, a living killer in the same square, and a bystander who has lost
 * nobody - which is every precondition the three tests below need.
 *
 * The same reads `whatIsStandingHere` does, against the seeded world rather
 * than against a service, so the sweep costs no database and no run.
 */
function opensBesideALoss(state: WorldState, placeName: string): boolean {
    const row = state.locations.find(
        l => l.name.toLowerCase() === placeName.trim().toLowerCase());
    if (!row) return false;
    const here = state.npcs.filter(n => n.status === 'alive' && n.locationId === row.id);
    const dead = new Set(state.npcs.filter(n => n.status !== 'alive').map(n => n.id));
    const priced = state.history.facts.filter(f => f.data && 'deedWeight' in f.data);

    for (const hearer of here) {
        const loss = hearer.relationships.find(
            r => BLOOD.has(r.kind) && dead.has(r.targetId));
        if (!loss) continue;
        const fact = priced.find(f => f.actors.some(a => a.id === loss.targetId));
        const killer = fact?.actors.find(a => a.id !== loss.targetId);
        if (!killer) continue;
        if (state.npcs.find(n => n.id === killer.id)?.status !== 'alive') continue;
        if (!here.some(p => p.id === killer.id)) continue;
        if (!here.some(p =>
            !p.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId)))) continue;
        return true;
    }
    return false;
}

let swept: Sweep | null = null;

/** Run once per file; the three tests below all read the same sweep. */
async function theSweep(): Promise<Sweep> {
    if (swept) return swept;
    const catalog = await loadCultivationCatalog();
    const places = new Map(BIRTHS.map(seed => [seed, drawBirth(seed).place.name]));
    let pairs = 0;
    let hits = 0;
    let worldsWithOne = 0;
    let first: Sweep['first'] = null;
    for (const worldSeed of WORLDS) {
        const state = seedWorld({
            seed: worldSeed, catalog, population: WORLD_POPULATION
        }).state;
        let here = 0;
        for (const [seed, place] of places) {
            pairs++;
            if (!opensBesideALoss(state, place)) continue;
            hits++;
            here++;
            first ??= { worldSeed, seed };
        }
        if (here > 0) worldsWithOne++;
    }
    swept = { pairs, hits, worldsWithOne, first };
    return swept;
}

/** The world and the birth the sweep found, for the played tests. */
async function aWorldWithSomebodyToTell() {
    const { first } = await theSweep();
    expect(first, 'no world in the sweep opens a run beside a priced loss').not.toBeNull();
    return first!;
}

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
     * THE DENSITY, WHICH IS WHAT THIS FILE'S TITLE CLAIMS.
     *
     * A world, not a seed. One pair working proves nothing about a fresh world
     * and was what this file used to rest on; what is asserted here is that most
     * worlds put one of their own bereaved households in front of a run inside a
     * handful of births, and that the pooled rate is not a rounding error.
     *
     * Floors at roughly half the measured figures, so an ordinary drift in the
     * seeder does not fail this and a collapse does. Measured over 12 worlds and
     * 30 births each: 10 of 12 worlds, 23 of 360 pairs.
     */
    it('is a property of fresh worlds rather than of one seed', async () => {
        const { pairs, hits, worldsWithOne } = await theSweep();
        expect(pairs).toBe(WORLDS.length * BIRTHS.length);
        expect(
            worldsWithOne,
            `only ${worldsWithOne} of ${WORLDS.length} worlds opens a run beside a `
            + 'priced loss; measured at 10 of 12'
        ).toBeGreaterThanOrEqual(Math.ceil(WORLDS.length / 2));
        expect(
            hits / pairs,
            `${hits} of ${pairs} openings; measured at 23 of 360`
        ).toBeGreaterThan(0.03);
    }, 180000);

    /**
     * The half that is now yes, with nothing arranged at all.
     *
     * A world is created from a seed, a run opens in it, and the person standing
     * in the room has lost somebody to a killing the world priced and wrote down.
     */
    it('opens a run standing next to somebody who lost a relative to a priced wrong', async () => {
        const { worldSeed, seed } = await aWorldWithSomebodyToTell();
        const { game } = await makeGameInWorld({ seed, worldSeed, worldEnabled: true });
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
        const { worldSeed, seed } = await aWorldWithSomebodyToTell();
        const { db, game } = await makeGameInWorld({ seed, worldSeed, worldEnabled: true });
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
        const { worldSeed, seed } = await aWorldWithSomebodyToTell();
        const { db, game } = await makeGameInWorld({ seed, worldSeed, worldEnabled: true });
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
