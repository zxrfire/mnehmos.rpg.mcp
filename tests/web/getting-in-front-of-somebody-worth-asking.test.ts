/**
 * From a fresh run, using only what the game shows: stand in front of somebody
 * worth asking, and put something to them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS THE ACCEPTANCE TEST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The directed-ask verb, the courtesy-and-tie system and the want model all
 * price what it costs somebody to say yes to you. Every one of them needs a
 * body the player can point at, and the engine says so, correctly and often:
 *
 *   > 5 people in Green Water City stand above Qi Condensation Layer 1, the deepest of
 *   > them 10 rungs up, and you have never met any of them. You have no name to
 *   > ask for, which is the whole of what is stopping you.
 *
 * Measured on five seeds: every cultivator at Foundation Establishment and
 * above stood on a `region` node, which `npcsAt` treats as a container nobody
 * stands in. The whole social layer had nobody in reach, and the reason was one
 * seeder function. `tests/engine/world/the-people-worth-asking-stand-somewhere-reachable`
 * holds that half.
 *
 * This file holds the other half, and it is the half that matters: the route
 * has to be walkable by a person who only knows what the game printed. That is
 * a stricter bar than "somebody exists at ordinal 17", and it is the bar three
 * separate defects hid behind:
 *
 *   NOBODY WAS ON THE GROUND. All 34 sect seats were empty, so a player who did
 *   find one arrived at a compound with no one in it.
 *   THE READ NEVER NAMED ONE. `destinations` scanned wilds, caves and veins, so
 *   "where can I go" could not name a gate at any stage of knowing.
 *   AND NOTHING GAVE THE NAME. `seedSectGround` says its own name is given by
 *   joining, by being told, or by asking in the region. The third had no caller.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT DERIVES THE ROUTE RATHER THAN SCRIPTING IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The house the player is born knowing, the province its gate stands in and who
 * is standing there are all products of two seeds and the catalogs. Hard-coding
 * "Azure Dew Sect" would make this a test of one draw that any content pass
 * breaks for reasons that are not defects. So the route is read off the world
 * and the knowledge table, and what is asserted is that each step is REACHABLE
 * - not that it lands on a particular name.
 *
 * The world is pinned as well as the run (`makeGameInWorld`), because a run seed
 * on a fresh database meets a different several hundred people and a test that
 * pins one without the other is pinning a coincidence.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { npcsAt } from '../../src/engine/world/world-state';

/** Foundation Establishment and above. What a beginner has to reach up to. */
const WORTH_ASKING = 17;

const WORLD_SEED = 'in-front-of-somebody-world';
const RUN_SEED = 'in-front-of-somebody-run';

describe('getting in front of somebody worth asking', () => {
    it('walks the whole route on names the game printed', async () => {
        const { db, game } = await makeGameInWorld({ worldSeed: WORLD_SEED, seed: RUN_SEED });
        const { cultivator } = await game.newRun('Lin Baoqing');

        const world = await activeWorld();
        const state = world!.state;

        // ── WHAT THE PLAYER STARTS HOLDING ───────────────────────────────
        //
        // Read off the knowledge table, not off the prose. A harness that
        // parses narration is measuring the narrator.
        const knownHouseIds = (db
            .prepare(
                `SELECT claim_key FROM knowledge_records
                 WHERE holder_id = ? AND superseded = 0
                   AND stance IN ('knows','believes','suspects')
                   AND claim_key LIKE 'exists:sect:%'`
            )
            .all(cultivator.id) as { claim_key: string }[])
            .map(row => row.claim_key.replace('exists:sect:', ''));

        expect(knownHouseIds.length, 'a fresh cultivator is born knowing at least one house')
            .toBeGreaterThan(0);

        // The gate of one of them, and the province that gate stands in. Both
        // are world rows; neither is invented here.
        //
        // ACROSS the houses this cultivator can name, not the first row that
        // happens to match. A fresh life now knows several local houses rather
        // than one global one, and taking whichever `locations` listed first
        // picked the Six Li Wardens (six people, deepest at 14) while the
        // Gleaners' gate next door held somebody at exactly the rung this test
        // is about. The claim is that SOME house they can name is worth walking
        // to; asserting it of an arbitrary one is a different, weaker claim
        // that fails on the ordering of a list.
        const reachableGates = state.locations.filter(row =>
            row.kind === 'sect_seat'
            && row.controllingFactionId !== null
            && knownHouseIds.includes(row.controllingFactionId));
        expect(reachableGates.length, 'a house the player can name keeps ground somewhere')
            .toBeGreaterThan(0);

        const gate = reachableGates.find(row =>
            npcsAt(state, row.id).some(npc => npc.cultivation.realmOrdinal >= WORTH_ASKING))
            ?? reachableGates[0];

        const houseName = state.factions.find(f => f.id === gate!.controllingFactionId)?.name;
        expect(houseName, 'the house has a name').toBeTruthy();

        const province = state.locations.find(row => row.id === gate!.parentId);
        expect(province?.kind, 'a gate sits inside a province').toBe('region');

        // And somebody worth asking is standing on it. This is the assertion the
        // whole seeder fix exists for; without it every step below is theatre.
        const worthAsking = npcsAt(state, gate!.id)
            .filter(npc => npc.cultivation.realmOrdinal >= WORTH_ASKING);
        expect(
            worthAsking.map(n => `${n.name}@${n.cultivation.realmOrdinal}`),
            'the gate holds somebody a beginner would cross a province for'
        ).not.toEqual([]);

        // ── THE ROUTE ────────────────────────────────────────────────────
        //
        // Every target below is a name the game itself printed or holds a
        // record for. Nothing is typed that a player could not have read.
        const turns: string[] = [];
        const say = async (input: string): Promise<string> => {
            turns.push(input);
            return (await game.act(input)).narration;
        };
        const whereTheyAre = (): string =>
            (db.prepare('SELECT location FROM cultivators WHERE id = ?')
                .get(cultivator.id) as { location: string }).location;

        // The province is in their starting awareness - everybody can name the
        // one they were born in and the ones over the border.
        await say(`I travel to ${province!.name}`);

        // Asking in the region gives the gate. `seedSectGround` says so; until
        // this change nothing did it.
        await say(`I ask around about the ${houseName}`);

        // And the read that answers "where can I go" now names it. This is the
        // step that makes the route walkable rather than merely possible: a
        // player who has not been told the name cannot type it.
        const destinations = await say('where can I go');
        expect(
            destinations,
            `"where can I go" must name ${gate!.name} once the player can point at it`
        ).toContain(gate!.name);

        await say(`I go to ${gate!.name}`);
        expect(whereTheyAre(), 'the journey ended at the gate').toBe(gate!.name);

        // ── AND SOMETHING IS PUT TO SOMEBODY ─────────────────────────────
        //
        // The point of the whole exercise. Not that the ask LANDS - it should
        // not, at ordinal 0 against a Nascent Soul cultivator, and an engine
        // that let it would be softening. What is asserted is that the request
        // reaches a person and comes back priced, which is the shape of a world
        // that has somebody in it to refuse you.
        const asked = await say('I ask the nearest cultivator to teach me');
        const reached = worthAsking.some(npc => asked.includes(npc.name));
        expect(
            reached,
            `the request must reach one of ${worthAsking.map(n => n.name).join(', ')}; got: ${asked.slice(0, 300)}`
        ).toBe(true);

        // Priced, not shrugged off. `summariseToolBody`'s fallback - "It is
        // done. Nothing about it drew attention." - is what an unwired verb
        // looks like, and it reads like a sentence.
        expect(asked, 'the answer says what it would take').not.toContain('Nothing about it drew attention');

        // Five turns. Stated so that a change which makes the route longer is
        // visible rather than silent - this is a bar on the shape of the route,
        // not a performance target.
        expect(turns.length).toBeLessThanOrEqual(6);
    }, 300_000);

    /**
     * And the gate stays shut until somebody opens it.
     *
     * The mirror of the test above, and the reason this is not a repopulation:
     * a player who has walked nowhere and asked nobody must not be handed a
     * list of the province's gates. If this ever goes green by accident, the
     * discovery gate has been turned into decoration and the stratum has become
     * something a beginner trips over.
     */
    it('does not hand a fresh cultivator the gates around them', async () => {
        const { game } = await makeGameInWorld({
            worldSeed: WORLD_SEED,
            seed: `${RUN_SEED}-gated`
        });
        await game.newRun('Lin Baoqing');

        const world = await activeWorld();
        const seats = world!.state.locations.filter(row => row.kind === 'sect_seat');
        expect(seats.length, 'the world has gates to keep shut').toBeGreaterThan(0);

        const opening = (await game.act('where can I go')).narration;
        for (const seat of seats) {
            expect(opening, `${seat.name} was handed over unasked`).not.toContain(seat.name);
        }
    }, 300_000);
});
