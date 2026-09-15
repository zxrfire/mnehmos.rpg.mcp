/**
 * A world opens holding killings. A life opens knowing people. Nobody checked
 * whether the two sets overlap.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `seedTheWrongsStillOpen` writes one open killing per province as the world is
 * laid out, with somebody living left carrying the account for each. `newRun`
 * then draws a household and a few faces off that same world and prints them
 * with where each of them is, and it already distinguished somebody dead - the
 * row read `Dead these 25 years.`
 *
 * Where the dead person was the victim of one of those killings, the opening
 * said nothing about it. The player's own childhood had a murder in it, the
 * world was still carrying an unsettled account for it, and the sentence the
 * player read was the one it would have read for old age.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CONSTRAINT THAT SHAPED THE FIX
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on how NOT to arrive at it: *do not make the wrongs reach
 * for the player.* They run at world creation, when no player exists, and
 * aiming them at a player's people inverts the dependency.
 *
 * So the question is asked from the other end. The wrong is already there; the
 * opening does one lookup and notices that the victim is somebody this life
 * knew. No world change, no reseed, and nothing arranged around anybody.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW OFTEN, MEASURED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * 30,000 births drawn with `drawBirth` across 120 pinned worlds at the shipped
 * population of 240, each put through `facesFromHome`:
 *
 *     lives                                          30,000
 *     open killings written across the 120 worlds        703
 *     lives born where an open killing's victim stands  1,819   6.1%
 *     lives whose own faces include a victim                4   0.013%
 *     of those, the killer was nameable                     0
 *
 * All four are a second PARENT: the household inherits a spouse whether or not
 * that spouse is still standing, so a widowed household is the one door a dead
 * person walks through. All four were `sect_retainer` births - 4 of the 89 such
 * births in the sweep, 4.5% - because a spouse tie is only ever written between
 * cultivators and only a good birth's reach puts a cultivator in the kitchen.
 *
 * ONE IN SEVEN THOUSAND FIVE HUNDRED IS THE RATE AND IT IS NOT A BUG. The draw
 * was deliberately not widened to raise it: `facesFromHome` takes only the
 * living for the street, so the 1,819 lives born beside a victim who was not
 * their kin still hear nothing, and that is the honest shape of the world
 * rather than a hole to fill. Widening it would be the wrongs reaching for the
 * player through a different door.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   A killing is a different sentence from a death, and the opening reads it
 *   off the world's own deed rather than keeping a second account of it.
 *
 *   A killer's name is said only where this life could say it. Measured across
 *   the sweep the answer is nearly always no - the killer is drawn from a whole
 *   province and a childhood reaches one settlement - and `somebody killed her
 *   and you do not know who` is the better sentence anyway.
 *
 * Red-checked: dropping the killing branch in `whereToFindThem` puts
 * `Dead these 25 years.` back and every assertion below goes red.
 */

import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { theLifeBehindTheFirstTurn } from '../../src/web/the-life-behind-the-first-turn';
import { facesFromHome } from '../../src/web/who-a-life-like-this-grew-up-knowing';
import { aDeedEntersTheWorld } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact';
import { createWorld, type WorldState } from '../../src/engine/world/world-state';
import { createNpc, markDead, upsertRelationship } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';
import type { Cultivator } from '../../src/schema/cultivation';

/**
 * The two arrangements the sweep found, out of 30,000 births.
 *
 * Pinned in both halves. An unpinned `worldEnabled` game mints a world from
 * `randomUUID()`, so a run seed alone pins a coincidence - and at this rate the
 * coincidence would be an empty test that passes by saying nothing.
 */
const WHERE_IT_HAPPENS = [
    { worldSeed: 'probe-w19', seed: 'probe-r19-142' },
    { worldSeed: 'probe-w24', seed: 'probe-r24-58' }
];

function theRecap(db: Database.Database): string[] {
    const rows = db
        .prepare("SELECT text FROM web_play_log WHERE role = 'engine' AND turn = 0 ORDER BY id")
        .all()
        .map(row => (row as { text: string }).text);
    const recap = rows.find(text => /years old, standing in/.test(text));
    expect(recap, 'no turn 0 ruling carried the life behind this cultivator').toBeDefined();
    return recap!.split('\n');
}

describe('a childhood can have a victim in it', () => {
    // ─────────────────────────────────────────────────────────────────────
    // PLAYED, ON A PINNED WORLD
    // ─────────────────────────────────────────────────────────────────────

    it('says somebody was killed rather than that they are dead', async () => {
        for (const pinned of WHERE_IT_HAPPENS) {
            const { db, game } = await makeGameInWorld(pinned);
            const { cultivator } = await game.newRun('Aspirant');
            const recap = theRecap(db);

            const said = recap.filter(line => /\bKilled\b/.test(line));
            expect(said.length, `${pinned.worldSeed} said nothing about a killing`).toBe(1);

            // The name is read OUT of the line rather than hardcoded: any name
            // the game prints is a name the game has to accept, and pinning the
            // one this world happened to draw would pin the draw.
            const whoDied = said[0].split('.')[0];
            expect(whoDied.length).toBeGreaterThan(0);

            // It is the ENDING that is said, not the address. A killed person's
            // row still carries the place they died in, so a whereabouts here
            // would send the player somewhere to look for a corpse.
            expect(said[0]).not.toMatch(/Dead these|Still in|now\./);

            // And the claim is the world's, not the opening's. The same person
            // is the victim of a priced deed the world is holding.
            const world = await activeWorld();
            const victim = world.state.npcs.find(npc => npc.name === whoDied);
            expect(victim, `${whoDied} is not somebody the world holds`).toBeDefined();
            const killing = world.state.history.facts.find(fact =>
                fact.actors.some(who => who.id === victim!.id && who.role === 'victim'));
            expect(killing, `nothing in the world says ${whoDied} was killed`).toBeDefined();
            expect(victim!.status).not.toBe('alive');

            // ── AND THE NAME IS EARNED OR IT IS NOT SAID ────────────────
            //
            // Asked through the same gate the engine asked, rather than by
            // rebuilding the rule. Where the gate is shut the line says a
            // killing happened and that nobody has put a name to it, which is
            // the motive rather than a hole in the record.
            const killer = killing!.actors.find(who => who.role === 'killer')!;
            const gate = new KnowledgeGate(db, () => world.state);
            const couldSayIt = gate.isAwareOf(cultivator.id, 'cultivator', killer.id)
                && gate.canPointAt(cultivator.id, 'cultivator', killer.id);
            expect(said[0].includes(killer.name),
                `the opening ${couldSayIt ? 'withheld' : 'handed over'} a name it should not`)
                .toBe(couldSayIt);

            db.close();
        }
    }, 600_000);

    // ─────────────────────────────────────────────────────────────────────
    // THE LOOKUP, ON A WORLD SMALL ENOUGH TO REASON ABOUT
    // ─────────────────────────────────────────────────────────────────────

    /**
     * A widowed cultivating household, with the widow's spouse a killing's
     * victim. That is the one door a dead person reaches the opening through:
     * `bindNewbornToHousehold` inherits the second parent off a spouse tie
     * whether or not that spouse is still standing.
     */
    function aWidowedHousehold(
        withAKilling: boolean,
        kind: 'death' | 'grudge_opened' = 'death'
    ): WorldState {
        const state = createWorld({ seed: 'victim', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 100 * DAYS_PER_YEAR;
        state.locations.push(makeLocation({
            id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
        }));
        for (const [i, name] of ['Widow', 'The Dead One', 'The Killer'].entries()) {
            state.npcs.push(createNpc(state.seed, {
                id: `npc-${i}`, name,
                bornOnDay: state.currentDay - 40 * DAYS_PER_YEAR,
                onDay: state.currentDay,
                locationId: 'home', occupation: 'disciple',
                // A catalog figure is a record at any rung, so the household
                // binds instead of being a mention - which is what
                // `the-family-a-life-opens-with.ts` says it is for.
                tags: ['catalog:member']
            }));
        }
        const day = state.currentDay;
        const marry = (at: number, toId: string, toName: string) => {
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: toId, targetName: toName, kind: 'spouse', standing: 0.8
            }, day);
        };
        marry(0, 'npc-1', 'The Dead One');
        marry(1, 'npc-0', 'Widow');

        const killedOn = day - Math.round(12 * DAYS_PER_YEAR);
        if (withAKilling) {
            aDeedEntersTheWorld(state, {
                kind,
                day: killedOn,
                locationId: 'home',
                actors: [
                    { id: 'npc-2', name: 'The Killer', role: 'killer' },
                    { id: 'npc-1', name: 'The Dead One', role: 'victim' }
                ],
                summary: 'The Killer killed The Dead One at Autumn Gate.',
                unattributed: 'Somebody was found dead here some years ago.',
                weight: 'grave'
            });
        }
        const at = state.npcs.findIndex(npc => npc.id === 'npc-1');
        state.npcs[at] = markDead(state.npcs[at], killedOn, 'Killed by The Killer.');
        return state;
    }

    const player = {
        id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
    } as Cultivator;

    const theDeadOne = (world: WorldState) => facesFromHome({
        world, cultivator: player, origin: 'thin_county', seed: 'v'
    }).find(one => one.name === 'The Dead One');

    /**
     * BOTH KINDS, because the read is on the ROLES and not on the kind. The
     * three writers of a killing in `src/engine/world/` agree on `killer` and
     * `victim` and disagree on how they file the row: the yearly pass calls it
     * `grudge_opened` and the other two call it `death`, so a filter on the kind
     * would have covered two of three and looked complete.
     */
    it('reads the killing off the deed the world already holds', () => {
        for (const kind of ['death', 'grudge_opened'] as const) {
            const found = theDeadOne(aWidowedHousehold(true, kind));
            expect(found, `the widowed household did not reach the opening (${kind})`)
                .toBeDefined();
            expect(found!.diedYearsAgo).toBe(12);
            expect(found!.killedBy).toEqual({ killerId: 'npc-2', killerName: 'The Killer' });
        }
    });

    /**
     * AND A DEATH THE WORLD HOLDS NO KILLING FOR IS STILL A DEATH. The row's
     * `endNote` says `Killed by The Killer.` in both arrangements and only one
     * of them has a deed behind it, which is the point: the prose on a row is
     * not what this reads.
     */
    it('says nothing about a killing the world does not hold', () => {
        const found = theDeadOne(aWidowedHousehold(false));
        expect(found).toBeDefined();
        expect(found!.diedYearsAgo).toBe(12);
        expect(found!.killedBy).toBeNull();
    });

    // ─────────────────────────────────────────────────────────────────────
    // THE SENTENCE
    // ─────────────────────────────────────────────────────────────────────

    const birth = {
        origin: 'thin_county',
        opening: { name: 'A farm in a thin county', provisionedYears: 0.4 },
        place: { name: 'Three Walls', kind: 'market_town' },
        ground: 'thin',
        density: 0.3,
        spiritStones: 30,
        house: null,
        raisedInside: null,
        knowledge: []
    } as never;

    const aKilledParent = (killedBy: { byName: string | null } | null) => ({
        name: 'Shen Wuyou',
        sourceNote: 'Family. Did the raising.',
        tie: 'parent',
        diedYearsAgo: 12,
        whereTheyAre: { name: 'Three Walls' },
        killedBy
    });

    it('names the killer where the life can name them, and says so where it cannot', () => {
        const withAName = theLifeBehindTheFirstTurn(birth, 16, [aKilledParent({ byName: 'Wei Shenchuan' })])
            .toldToThePlayer.join(' ');
        expect(withAName).toMatch(/Killed by Wei Shenchuan/);
        expect(withAName).not.toMatch(/Dead these/);

        const stranger = theLifeBehindTheFirstTurn(birth, 16, [aKilledParent({ byName: null })])
            .toldToThePlayer.join(' ');
        expect(stranger).toMatch(/Killed 12 years ago/);
        expect(stranger).toMatch(/nobody has put a name to who did it/);
        expect(stranger).not.toMatch(/Dead these/);
    });

    /** An ordinary death is untouched, which is most of them. */
    it('leaves a death that was not a killing saying what it always said', () => {
        const plain = theLifeBehindTheFirstTurn(birth, 16, [aKilledParent(null)])
            .toldToThePlayer.join(' ');
        expect(plain).toMatch(/Dead these 12 years\./);
        expect(plain).not.toMatch(/Killed/);
    });
});
