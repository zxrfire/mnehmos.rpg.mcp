/**
 * A fight, played, from inside it.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * Design owner: *"combat should also of course resolve across multiple turns to
 * give the player agency (fleeing, how, to where, using what ability, or item?).
 * if you fought and it resolves in one turn and you died it would be
 * unsatisfying cuz there's nothing you can do about it."*
 *
 * The engine half is asserted in `tests/engine/cultivation/unfinished-fight.ts`
 * and the reading half in `tests/web/fight-answers.ts`. This is the part neither
 * of those can prove: that a person typing at the game reaches it. A module
 * nothing calls is not a feature, and until these passed the whole of it was
 * documentation with a type signature.
 *
 * Everything here goes through `game.act`, which is the road a player's sentence
 * actually travels.
 */

import { describe, expect, it } from 'vitest';

import { npcsAt } from '../../src/engine/world/world-state';
import { bodyStandingOn, bodyTaken, maxBodyOf } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/web/entities';
import { MAX_EXCHANGES } from '../../src/engine/cultivation/combat';
import { cultivatorRow, makeGameInWorld } from './harness';

/** Everybody standing where the player is standing. */
async function peopleHere(game: {
    loadWorld: () => Promise<unknown>;
    state: () => unknown;
}) {
    const world = (await game.loadWorld()) as {
        npcs: unknown[];
        locations?: unknown;
    } | null;
    if (!world) return { world: null, people: [] as ReturnType<typeof npcsAt> };
    const where = (game.state() as { cultivator: { location: string } }).cultivator.location;
    const place = worldLocationFor(world as never, where);
    return { world, people: place ? npcsAt(world as never, place.id) : [] };
}

const names = (r: { toolCalls: Array<{ name: string }> }) => r.toolCalls.map(c => c.name);

describe('a fight the player stands inside', () => {
    it('opens on the swing and does not settle in that turn', async () => {
        const { game } = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1' });
        await game.newRun('Duellist');
        await game.act('I look around');

        const opened = await game.act('I attack someone of my own rank');

        // A round happened.
        expect(names(opened)).toContain('combat.round');
        // And the fight did NOT resolve, which is the whole of the change.
        expect(names(opened)).not.toContain('combat_manage.resolve');
        expect(opened.narration).toMatch(/strikes at/);
    }, 120_000);

    it('tells the player where they stand before they have to answer', async () => {
        const { game } = await makeGameInWorld({ seed: 'state-1', worldSeed: 'w-state-1' });
        await game.newRun('Duellist');
        await game.act('I look around');

        const opened = await game.act('I attack someone of my own rank');

        // ── ON `lines`, NOT ONLY IN `structure` ──────────────────────────
        //
        // `composeNarrationUser` sends `lines` alone, so a fact written only to
        // the structural channel reaches an operator reading the log and nobody
        // playing. The harness runs the DETERMINISTIC narrator, so anything in
        // this string is something a player with no model attached actually
        // reads - which is the strongest form of the assertion available.
        //
        // The three numbers are the ruling: you can see you are losing, you can
        // see how long you have, and you can see what the exit costs BEFORE you
        // choose it.
        expect(opened.narration).toMatch(/You are on \d+ of \d+/);
        expect(opened.narration).toMatch(/rounds? before neither of you can finish it/);
        expect(opened.narration).toMatch(/Breaking off would come off at \d+%/);
    }, 120_000);

    it('answers the five sentences that used to reach nothing', async () => {
        // Each is played into a fresh fight, because they are alternatives - a
        // player gets one answer a round.
        const cases: Array<[string, RegExp]> = [
            ['I block his sword', /strikes at/],
            ['I let him hit me', /strikes at/],
            ['I back off', /(Broke away|Did not get clear)/],
            ['I call for help', /(You shout|comes)/],
            ['I shout for the wardens', /(You shout|comes)/]
        ];
        for (const [said, expected] of cases) {
            const { game } = await makeGameInWorld({
                seed: `five-${said.length}`, worldSeed: `w-five-${said.length}`
            });
            await game.newRun('Duellist');
            await game.act('I look around');
            await game.act('I attack someone of my own rank');

            const answered = await game.act(said);
            expect(answered.narration, said).toMatch(expected);
            // And it was never refused, which is what these five did before.
            expect(answered.narration, said).not.toMatch(/does not resolve into anything/i);
            expect(answered.narration, said).not.toMatch(/say what you mean/i);
        }
    }, 300_000);

    it('spends no model call on a sentence said inside a fight', async () => {
        const { game } = await makeGameInWorld({ seed: 'nomodel', worldSeed: 'w-nomodel' });
        await game.newRun('Duellist');
        await game.act('I look around');
        await game.act('I attack someone of my own rank');

        const answered = await game.act('I block his sword');
        // Phase 1 is skipped outright. A model asked to route "I back off" can
        // only turn it into `move` and walk the player calmly out of a fight
        // they are still standing in.
        //
        // Asserted on the ROUTING ROW rather than on its absence: `routingCall`
        // is written for every turn whatever read it, and what says whether a
        // model was asked is its `source`.
        const routing = answered.toolCalls.find(c => c.name === 'narrator.plan')!;
        expect(routing.source).toBe('fallback');
        expect(routing.summary).toContain('a fight is standing');
        expect(routing.summary).toContain('guard');
    }, 120_000);

    it('does not refuse a sentence the fight has no answer for', async () => {
        const { game } = await makeGameInWorld({ seed: 'notaban', worldSeed: 'w-notaban' });
        await game.newRun('Duellist');
        await game.act('I look around');
        await game.act('I attack someone of my own rank');

        // AGENTS.md: do not ban. The blade arrives and THEN they do the thing
        // they asked for. A fight is a situation, not a mode.
        const elsewhere = await game.act('I look around');
        expect(elsewhere.narration).not.toMatch(/does not resolve into anything/i);
        // The round landed on them first.
        expect(names(elsewhere)).toContain('combat.round');
        // And the thing they actually asked for ran.
        expect(names(elsewhere).some(n => n !== 'combat.round' && !n.startsWith('narrator.')))
            .toBe(true);
    }, 120_000);

    it('does not open a second fight against somebody it is already fighting', async () => {
        const { game } = await makeGameInWorld({ seed: 'onefight', worldSeed: 'w-onefight' });
        await game.newRun('Duellist');
        await game.act('I look around');

        const first = await game.act('I attack someone of my own rank');
        const second = await game.act('I attack someone of my own rank');

        expect(names(first)).toContain('combat.round');
        expect(names(second)).toContain('combat.round');
        // The round counter moved rather than resetting. Without this the fight
        // restarted every turn and could never be won or lost.
        const roundOf = (r: { toolCalls: Array<{ name: string; summary: string }> }) =>
            r.toolCalls.find(c => c.name === 'combat.round')!.summary;
        expect(roundOf(first)).not.toEqual(roundOf(second));
    }, 120_000);

    it('ends through the same settlement a one-call fight always used', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'settle', worldSeed: 'w-settle' });
        const { cultivator } = await game.newRun('Duellist');
        await game.act('I look around');

        let settled: string[] = [];
        for (let round = 0; round <= MAX_EXCHANGES; round++) {
            const r = await game.act(
                round === 0 ? 'I attack someone of my own rank' : 'I keep swinging'
            );
            if (names(r).includes('combat_manage.resolve')) { settled = names(r); break; }
            if (!cultivatorRow(db, cultivator.id).alive) { settled = names(r); break; }
        }

        // A fight held over several turns writes the wounds, the lesson, the
        // feud and the death gate through the one path, so what a fight left
        // cannot depend on how many turns the player spent in it.
        expect(settled).toContain('combat_manage.resolve');
    }, 300_000);
});

describe('somebody the world has already worn down', () => {
    /**
     * The player's path did not read a persisted body.
     *
     * The world's own bouts have read `bodyStandingOn` since NPCs were given
     * one - `gatherings.ts`, at `BOUT_BODY` - so a cultivator who paid a
     * crossing toll last spring fought weaker for everybody except the player,
     * who met them whole. That is "a player can do everything an NPC can"
     * running backwards: the toll made the world's fights honest and the
     * player's harder than anybody else's.
     */
    it('is met worn down rather than whole', async () => {
        const { game } = await makeGameInWorld({ seed: 'worn', worldSeed: 'w-worn' });
        await game.newRun('Duellist');
        await game.act('I look around');

        const { world, people } = await peopleHere(game);
        expect(world).not.toBeNull();
        const them = people.find(n => n.cultivation.hp !== undefined);
        expect(them, 'nobody was standing here to wear down').toBeDefined();

        // Take half their body, the way a crossing does, and write it back.
        const day = Math.floor((world as unknown as { currentDay: number }).currentDay);
        const whole = maxBodyOf(them!);
        const worn = bodyTaken(them!, Math.floor(whole / 2), day);
        expect(bodyStandingOn(worn, day)).toBeLessThan(whole);
        const npcs = (world as unknown as { npcs: unknown[] }).npcs;
        npcs[npcs.findIndex(n => (n as { id: string }).id === them!.id)] = worn;

        const opened = await game.act(`I attack ${them!.name}`);

        // The state line reports the body the world says they are standing in.
        // Before this, a described opponent was rebuilt at full from
        // `maxHpForOrdinal` and the wear evaporated on the way in.
        const said = /is on (\d+) of (\d+)/.exec(opened.narration ?? '');
        expect(said, opened.narration ?? '').not.toBeNull();
        expect(Number(said![1])).toBeLessThan(Number(said![2]));
    }, 120_000);
});
