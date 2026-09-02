/**
 * A fight reaches the person it was with.
 *
 * ── WHAT WAS MEASURED BEFORE THIS ────────────────────────────────────────
 *
 * Played, with the world on: `game.act('I attack someone of my own rank')`
 * wrote a `combat_records` row with `opponent_id` NULL and changed nothing at
 * all about the person fought. They were standing there the next turn
 * unmarked, at full strength, holding nothing about anybody.
 *
 * The cause was one gate. `combat_manage.resolve` persists its opponent's half
 * only for an opponent with a row in the `cultivators` table, and most of a
 * square is not in that table - they are `NpcRecord`s in world state, so
 * `game.ts` has no id to pass and DESCRIBES them instead. Everything the
 * resolver decided about them was then thrown away on the way out: not the
 * wounds, not the account, not the death.
 *
 * ── WHAT THESE PIN ───────────────────────────────────────────────────────
 *
 *   - the world's own copy of the person changes, on a fight the player
 *     actually reached, through the played verb rather than the tool
 *   - what changes is WOUNDS and ties, and never a hit-point bar: the world
 *     stores no such field and this must not be where one appears
 *   - what the world wrote is read back the next time they are fought, which is
 *     the whole point of writing it
 *   - it survives a reload, because a killing lost to a restart is a killing
 *     that did not happen
 *
 * ── WHY THESE SWEEP SEEDS ────────────────────────────────────────────────
 *
 * For the reason `a-bout-two-people-agreed-to.test.ts` gives: a played
 * confrontation is reproducible from its seed, but WHO is standing in the
 * square and whether the exchange lands a wound at all are properties of the
 * seeded world. So these ask for the event across a handful of seeds and assert
 * what the record holds once it happens. The engine-side contract - which wound
 * lands, who ends up dead - is pinned exactly, without a sweep, in
 * `tests/engine/world/what-a-confrontation-does-to-somebody-the-world-holds.test.ts`.
 */

import { describe, it, expect } from 'vitest';

import { npcsAt } from '../../src/engine/world/world-state';
import { worldLocationFor } from '../../src/web/entities';
import { worldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { makeGameInWorld, cultivatorRow } from './harness';
import type { NpcRecord } from '../../src/engine/world/npc-state';

/** Everybody standing where the player is, as the world holds them. */
async function othersHere(game: { loadWorld: () => Promise<unknown>; state: () => unknown }) {
    const world = (await game.loadWorld()) as Awaited<ReturnType<typeof worldForRun>> | null;
    if (!world) return { world: null, people: [] as NpcRecord[] };
    const where = (game.state() as { cultivator: { location: string } }).cultivator.location;
    const place = worldLocationFor(world, where);
    return { world, people: place ? npcsAt(world, place.id) : [] };
}

function marks(npc: NpcRecord): string {
    return JSON.stringify({
        injuries: npc.cultivation.injuries.length,
        untreated: npc.cultivation.untreatedInjuries,
        ties: npc.relationships.length,
        status: npc.status
    });
}

describe('a confrontation with somebody only the world holds', () => {
    /**
     * The reproduction, as a test. Fight until the resolver leaves a mark on
     * somebody, then ask the world about them.
     */
    it('changes the world\'s own record of the person fought', async () => {
        let landed: { before: string; after: NpcRecord; playerId: string } | null = null;

        for (const seed of ['reach-a', 'reach-b', 'reach-c', 'reach-d', 'reach-e'] as const) {
            if (landed) break;
            const { db, game } = await makeGameInWorld({ seed, worldSeed: `w-${seed}` });
            const { cultivator } = await game.newRun('Brawler');
            await game.act('I look around');

            for (let fights = 0; fights < 8 && !landed; fights++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                // Kept standing, so the sweep measures what a fight does to THEM
                // rather than how long the player lasts.
                db.prepare(
                    'UPDATE cultivators SET hp = 5000, max_hp = 5000, battles_survived = 400 '
                    + 'WHERE id = ?'
                ).run(cultivator.id);

                const { people } = await othersHere(game);
                const snapshot = new Map(people.map(npc => [npc.id, marks(npc)]));
                if (snapshot.size === 0) break;

                await game.act('I attack someone of my own rank');

                // Re-read from the world rather than from the return value: the
                // claim is about what is STORED, not about what was reported.
                const { people: now } = await othersHere(game);
                for (const npc of now) {
                    const was = snapshot.get(npc.id);
                    if (was !== undefined && was !== marks(npc)) {
                        landed = { before: was, after: npc, playerId: cultivator.id };
                        break;
                    }
                }
                // Somebody who died leaves the square, so they are looked for
                // among everybody rather than only among who is still standing.
                if (!landed) {
                    const world = (await game.loadWorld())!;
                    for (const [id, was] of snapshot) {
                        const npc = world.npcs.find(n => n.id === id);
                        if (npc && marks(npc) !== was) {
                            landed = { before: was, after: npc, playerId: cultivator.id };
                            break;
                        }
                    }
                }
            }
        }

        expect(landed, 'no fight across five seeds reached anybody the world holds')
            .not.toBeNull();

        const them = landed!.after;
        // Whatever changed, it is one of the three things this layer writes.
        const tie = them.relationships.find(r => r.targetId === landed!.playerId);
        const marked = them.cultivation.injuries.length > 0
            || tie !== undefined
            || them.status !== 'alive';
        expect(marked, `nothing on the record names what happened: ${marks(them)}`).toBe(true);

        // The count is derived at the write, so it cannot disagree with the list.
        expect(them.cultivation.untreatedInjuries)
            .toBe(them.cultivation.injuries.filter(i => !i.treated).length);

        // And no hit points anywhere. The world stores wounds; a bar here would
        // be a second body model beside the cultivation engine's.
        expect(JSON.stringify(them)).not.toMatch(/"(hp|maxHp)"/);
    }, 300_000);

    /**
     * Written means written. A world changed inside one turn is persisted
     * before anything is narrated - `act` does it on `worldDirty` - so the
     * record survives the process that made it.
     */
    it('survives a reload of the world', async () => {
        let checked = false;

        for (const seed of ['durable-a', 'durable-b', 'durable-c'] as const) {
            if (checked) break;
            const { db, game } = await makeGameInWorld({ seed, worldSeed: `w-${seed}` });
            const { cultivator } = await game.newRun('Brawler');
            await game.act('I look around');

            for (let fights = 0; fights < 8 && !checked; fights++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                db.prepare('UPDATE cultivators SET hp = 5000, max_hp = 5000 WHERE id = ?')
                    .run(cultivator.id);
                await game.act('I attack someone of my own rank');

                const { people } = await othersHere(game);
                const wounded = people.find(npc => npc.cultivation.injuries.length > 0);
                if (!wounded) continue;

                // Drop every process cache and read the world back off disk.
                resetCultivationWorlds();
                const reloaded = await worldForRun(game.state().run as never);
                const same = reloaded.npcs.find(n => n.id === wounded.id);
                expect(same, 'the person went missing across a reload').toBeDefined();
                expect(same!.cultivation.injuries.length)
                    .toBe(wounded.cultivation.injuries.length);
                checked = true;
            }
        }

        expect(checked, 'no fight across three seeds ever wounded anybody').toBe(true);
    }, 300_000);

    /**
     * And it is answerable for, by their house, in the ordinary ledger.
     *
     * ── WHY THIS ASSERTS A MAIMING AND NOT A KILLING ─────────────────────
     *
     * A killing IS wired now. `whatFollowedTheBout` reads whether the LOSER
     * died, and that flag used to be the player's alone - the only opponent the
     * engine could kill was one with a cultivator row - so the whole
     * killed-somebody branch was unreachable against the population a player
     * actually meets. It now arrives from the world for a world person, and the
     * write path it goes through is pinned exactly in
     * `tests/engine/world/what-a-confrontation-does-to-somebody-the-world-holds.test.ts`.
     *
     * What is NOT reachable through this verb is the killing itself, and the
     * reason is one hardcoded argument several layers up rather than anything
     * here: `attack` passes `fightToTheEnd: false`, so `willWithdraw` is true,
     * so `resolveConfrontation` ends a fight at `WITHDRAW_HP_FRACTION` with the
     * loser breaking off. A played `goal: 'kill'` therefore reaches
     * `withdrawal` and never `lethal`, whoever the opponent is and whatever
     * store they live in. Asserting a killing here would be asserting that
     * somebody changes that argument, which is a decision about what "I kill
     * him" means and is not this file's to make.
     *
     * ── AND WHY IT DOES NOT ASSERT A MAIMING EITHER ──────────────────────
     *
     * It did, and the assertion was withdrawn as unsound rather than because it
     * failed. A `crippled` outcome between two peers is roughly a one-in-twenty
     * event per seeded world, so pinning it meant pinning the seeds that happen
     * to produce one - and those are a fact about the combat tuning on the day
     * the test was written, not about this code. It broke the moment it was
     * measured against a different tree, and it would break again on any honest
     * change to the damage curve, blaming this join for somebody else's work.
     *
     * The house-ledger half is anyway already swept for, over thirty seeds and
     * with the sweep's cost justified in its own header, in
     * `a-bout-two-people-agreed-to.test.ts`. Duplicating it here bought nothing
     * and cost a flake.
     *
     * What IS new, and what this pins instead, is the LOSER'S OWN RECORD. Every
     * account the world keys on - grudges, feuds, a house's answer for a member,
     * an heir who inherits an enmity - starts from somebody holding something
     * about somebody. A world person held nothing about anybody who fought them,
     * because nothing was ever written to them at all. This is that write, in
     * the direction the rest of the codebase reads: the tie is on THEM and it
     * names the player.
     */
    it('leaves the account on their own record, naming whoever did it', async () => {
        let held: { kind: string; standing: number; onWhom: string } | null = null;
        let playerId = '';

        for (const seed of ['account-a', 'account-b', 'account-c'] as const) {
            if (held) break;
            const { db, game } = await makeGameInWorld({ seed, worldSeed: `w-${seed}` });
            const { cultivator } = await game.newRun('Brawler');
            playerId = cultivator.id;
            await game.act('I look around');

            for (let fights = 0; fights < 8 && !held; fights++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                db.prepare(
                    'UPDATE cultivators SET hp = 5000, max_hp = 5000, battles_survived = 400 '
                    + 'WHERE id = ?'
                ).run(cultivator.id);
                await game.act('I attack someone of my own rank');

                const world = (await game.loadWorld())!;
                for (const npc of world.npcs) {
                    const tie = npc.relationships.find(r => r.targetId === cultivator.id);
                    if (tie) {
                        held = { kind: tie.kind, standing: tie.standing, onWhom: npc.id };
                        break;
                    }
                }
            }
        }

        expect(
            held,
            'nobody the world holds came out of a fight holding anything about the player'
        ).not.toBeNull();
        // On THEM, about the player. A tie the other way would be the engine
        // deciding how the player feels, which is not its to decide.
        expect(held!.onWhom).not.toBe(playerId);
        // Losing is not a friendship. The band is graded - `rival` for an
        // ordinary loss, `enemy` for a maiming or a killing - and either is a
        // standing the world can act on.
        expect(['rival', 'enemy']).toContain(held!.kind);
        expect(held!.standing).toBeLessThan(0);
    }, 300_000);

    /**
     * The half that makes writing it worth anything.
     *
     * A wound the next fight does not read is a wound nobody has. The described
     * opponent used to be built from a name and an ordinal alone - might 2,
     * insight 2, unwounded - so a man crippled here last week stood up fresh,
     * and the write path would have been feeding a record nothing consulted.
     */
    it('carries what they are already carrying back into the next fight', async () => {
        /**
         * One seeded fight, run twice, differing in exactly one thing: what the
         * WORLD says the person on the other side is carrying. Same run seed,
         * same world, same sentence, same streams. If the described opponent is
         * still a stunt double, the two reports are byte-identical.
         */
        async function fightSomebodyCarrying(seed: string, wounds: number): Promise<string | null> {
            // BOTH seeds pinned, and the world one is the half that matters
            // here. `makeGame` leaves the population to a minted world, so two
            // runs on one run-seed meet different people and their reports
            // differ for reasons that have nothing to do with wounds - which
            // would make this pass whatever the code did.
            const { db, game } = await makeGameInWorld({ seed, worldSeed: `w-${seed}` });
            const { cultivator } = await game.newRun('Brawler');
            await game.act('I look around');

            const world = (await game.loadWorld())!;
            const where = game.state().cultivator.location;
            const place = worldLocationFor(world, where);
            if (!place) return null;
            const here = npcsAt(world, place.id);
            if (here.length === 0) return null;

            // Everybody in the square, so the sweep does not turn on which of
            // them the peer rule picks.
            for (const npc of here) {
                const at = world.npcs.findIndex(n => n.id === npc.id);
                world.npcs[at] = {
                    ...world.npcs[at],
                    cultivation: { ...world.npcs[at].cultivation, untreatedInjuries: wounds }
                };
            }

            db.prepare('UPDATE cultivators SET hp = 5000, max_hp = 5000 WHERE id = ?')
                .run(cultivator.id);
            const acted = await game.act('I attack someone of my own rank');

            // THE FIGHT, and only the fight. The lines this layer writes after
            // the resolve mention the injected count by construction, so leaving
            // them in would have this pass on its own tail: the comparison has
            // to be of what the RESOLVER did, which is the exchanges, the damage
            // and the verdict.
            return acted.narration
                .split('\n')
                .filter(line => !/ is carrying \d+ untreated /.test(line))
                .filter(line => !/is dead, and the world has it written down/.test(line))
                .filter(line => !/They left somebody/.test(line))
                .join('\n');
        }

        let differed = false;
        for (const seed of ['reads-a', 'reads-b', 'reads-c', 'reads-d'] as const) {
            if (differed) break;
            const whole = await fightSomebodyCarrying(seed, 0);
            const broken = await fightSomebodyCarrying(seed, 8);
            if (whole === null || broken === null) continue;
            if (whole !== broken) differed = true;
        }

        expect(
            differed,
            'the same seeded fight against a whole body and a ruined one produced the same '
            + 'report, so the world\'s record of the person is not reaching the resolver'
        ).toBe(true);
    }, 300_000);
});
