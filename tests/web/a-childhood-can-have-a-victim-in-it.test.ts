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
 * THE FIRST CUT REACHED ONLY KIN, AND THE OWNER SAID WHY THAT WAS WRONG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Measured on it: 30,000 births across 120 pinned worlds gave FOUR lives that
 * heard about a killing, all four a dead second parent, while 1,819 of the
 * same lives were born in a settlement where an open killing's victim was
 * standing. The cause was one filter. `facesFromHome` drew the street off
 * `npcsAt`, which answers who is STANDING somewhere and drops the dead before
 * anything else looks, so the only door a victim could reach the opening
 * through was a household inheriting a spouse who had died.
 *
 * The owner, shown that:
 *
 *   > "why can't it be an acquaintance you made? grudges already have tiers"
 *
 * Both halves are the design. The street draw admits somebody killed inside
 * this life's own years, and the difference between a parent and a face from
 * the well is carried by `whoTheyCarryFor` - the engine's existing answer to
 * whose killing somebody may open an account about - rather than by a second
 * notion of closeness written here.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW OFTEN, MEASURED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The same instrument, 30,000 births across 120 pinned worlds at the shipped
 * population of 240, each through `facesFromHome`:
 *
 *     lives                                              30,000
 *     open killings across the 120 worlds                   703
 *     lives born where a victim stands                    1,819   6.1%
 *     of those, the killing inside this life's 16 years     815   2.7%
 *     lives whose own faces include a victim                470   1.57%
 *       as a face from the street                           466
 *       as kin                                               4
 *     of the 470, the killer could be named                 164   34.9%
 *       of those, the killer was this life's own kin         38
 *
 * Before the street draw opened: 4 in 30,000. The three steps down from the
 * 6.1% ceiling are both accounted for and both are rules rather than losses -
 * the lifetime bound takes out the killings that happened before this person
 * was born, and the remainder is the face budget, three to eight faces drawn
 * from everybody eligible at home.
 *
 * AND THE KILLER IS NOW NAMEABLE A THIRD OF THE TIME, where it was never
 * nameable at all. Predicted before the change from the world side - 226 of the
 * 703 killers are alive, standing in the victim's own settlement, and inside Qi
 * Condensation, which is the street draw's own reach - and 38 of the 164 are
 * the player's own parent, which the world produced without anybody arranging
 * it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HOUSEHOLD HALF IS NOT SOMETHING A SEED CAN HOLD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Read the table again: 466 of the 470 arrive through the street and 4 through
 * kin. A pinned seed for the kin half is a one-in-seven-thousand draw, and this
 * file held one - `probe-w1/probe-r1-221`, picked out of that sweep. It has
 * stopped being a kin arrangement. That birth opens on Cold Sword Sect ground,
 * which holds five living catalog members, one married couple among them, and
 * nobody dead at all, so there is no second parent for a killing to have taken.
 * Nothing in the opening moved: the other three pins say exactly what they said.
 *
 * Re-measured on this tree, 1,950 births over 13 pinned worlds:
 *
 *     lives                                              1,950
 *     lives whose own faces include a victim                27   1.38%
 *       as a face from the street                           27
 *       as kin                                               0
 *
 * 0 of 27 is what 4-in-470 predicts rather than evidence of a shut door, and the
 * door is open on the world's side: over 24 pinned worlds, 21 households hold a
 * priced killing whose victim died inside a childhood and left a living spouse
 * old enough to have done the raising. Every one is on a house's ground, because
 * the reach table only lets a sixteen-year-old have grown up beside somebody
 * that far up where a birth puts them inside the walls.
 *
 * So the household half is ARRANGED, the way the street half's admission rules
 * already are, and the played sweep now promises only what a played sweep can.
 *
 * AND ONE DOOR THAT IS GENUINELY SHUT, written down rather than closed here: a
 * MORTAL household is a mention and inherits no second parent at all, so a
 * mortal whose father was murdered ten years ago is told nothing - while the
 * same man reaches the opening if he was a neighbour. That is the mortal ruling
 * and the street ruling meeting, and which of them wins is not this file's.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   A killing is a different sentence from a death, and the opening reads it
 *   off the world's own deed rather than keeping a second account of it.
 *
 *   A killer's name is said only where this life could say it.
 *
 *   The tier is `whoTheyCarryFor`'s. A neighbour is a name and a killing; kin
 *   is that and an account the player can act on, and the opening says so in
 *   the same words the telling layer would. Both tiers are still asserted; only
 *   the kin one is arranged rather than drawn.
 *
 *   A heading promises only what the lines under it deliver. A dead person has
 *   no whereabouts, so `and where each of them is` goes.
 *
 * Red-checked four ways, each producing exactly the failures named below.
 */

import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { whoTheyCarryFor } from '../../src/web/what-a-telling-lands-on';
import { theLifeBehindTheFirstTurn } from '../../src/web/the-life-behind-the-first-turn';
import { facesFromHome } from '../../src/web/who-a-life-like-this-grew-up-knowing';
import { aDeedEntersTheWorld } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { makeFact } from '../../src/engine/world/history';
import { createWorld, getNpc, type WorldState } from '../../src/engine/world/world-state';
import { createNpc, markDead, upsertRelationship } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms';
import type { Cultivator } from '../../src/schema/cultivation';

/**
 * Four arrangements out of the sweep, chosen to cover both answers to whether
 * the killer can be named, on four different worlds.
 *
 * Pinned in both halves. An unpinned `worldEnabled` game mints a world from
 * `randomUUID()`, so a run seed alone pins a coincidence.
 *
 * All four are faces from the street, and that is not a narrowing of what is
 * covered - see the header. A kin pin is a one-in-seven-thousand draw and the
 * one this file held has been re-drawn by the world work since; the household
 * tier is arranged instead, under `aHouseholdWithAKilledParent`.
 */
const WHERE_IT_HAPPENS = [
    // The killer is this life's own parent.
    { worldSeed: 'probe-w3', seed: 'probe-r3-0' },
    { worldSeed: 'probe-w4', seed: 'probe-r4-1' },
    // A killer this life has never been given a name for.
    { worldSeed: 'probe-w1', seed: 'probe-r1-37' },
    // And one on a sect town rather than a village, where the reach is wider.
    { worldSeed: 'probe-w16', seed: 'probe-r16-30' }
];

const A_BLOCK_OPENS = /^(The household|People (you|they) can already put a name to)/;

function theRecap(db: Database.Database): string[] {
    const rows = db
        .prepare("SELECT text FROM web_play_log WHERE role = 'engine' AND turn = 0 ORDER BY id")
        .all()
        .map(row => (row as { text: string }).text);
    const recap = rows.find(text => /years old, standing in/.test(text));
    expect(recap, 'no turn 0 ruling carried the life behind this cultivator').toBeDefined();
    return recap!.split('\n');
}

/** The heading the line at `at` is printed under. */
function theHeadingAbove(recap: readonly string[], at: number): string {
    for (let i = at; i >= 0; i--) if (A_BLOCK_OPENS.test(recap[i])) return recap[i];
    return '';
}

describe('a childhood can have a victim in it', () => {
    // ─────────────────────────────────────────────────────────────────────
    // PLAYED, ON PINNED WORLDS
    // ─────────────────────────────────────────────────────────────────────

    it('says somebody was killed rather than that they are dead', async () => {
        for (const pinned of WHERE_IT_HAPPENS) {
            const { db, game } = await makeGameInWorld(pinned);
            const { cultivator } = await game.newRun('Aspirant');
            const recap = theRecap(db);
            const where = pinned.worldSeed;

            const at = recap.findIndex(line => /\bKilled\b/.test(line));
            expect(at, `${where} said nothing about a killing`).toBeGreaterThan(-1);
            const said = recap[at];
            expect(recap.filter(line => /\bKilled\b/.test(line)).length).toBe(1);

            // The name is read OUT of the line rather than hardcoded: any name
            // the game prints is a name the game has to accept, and pinning the
            // one this world happened to draw would pin the draw.
            const whoDied = said.split('.')[0];

            // It is the ENDING that is said, not the address. A killed person's
            // row still carries the place they died in, so a whereabouts here
            // would send the player somewhere to look for a corpse.
            expect(said).not.toMatch(/Dead these|Still in|now\./);

            // ── AND THE HEADING DOES NOT PROMISE ONE EITHER ─────────────
            expect(theHeadingAbove(recap, at), `${where} promised a whereabouts it has not got`)
                .not.toMatch(/where each of them is/);

            // The claim is the world's, not the opening's. The same person is
            // the victim of a deed the world is holding, and is still on the
            // roster after the mortal sweep - `whoIsStillCarriedFor` keeps
            // everybody a priced deed names, which is the exception that pass
            // carries for exactly this seeder.
            const world = await activeWorld();
            const victim = world.state.npcs.find(npc => npc.name === whoDied);
            expect(victim, `${whoDied} is not somebody the world holds`).toBeDefined();
            const killing = world.state.history.facts.find(fact =>
                fact.actors.some(who => who.id === victim!.id && who.role === 'victim'));
            expect(killing, `nothing in the world says ${whoDied} was killed`).toBeDefined();
            expect(victim!.status).not.toBe('alive');

            // ── THE NAME IS EARNED OR IT IS NOT SAID ────────────────────
            //
            // Asked through the same gate the engine asked, rather than by
            // rebuilding the rule. Where the gate is shut the line says a
            // killing happened and that nobody has put a name to it, which is
            // the motive rather than a hole in the record.
            const killer = killing!.actors.find(who => who.role === 'killer')!;
            const gate = new KnowledgeGate(db, () => world.state);
            const couldSayIt = gate.isAwareOf(cultivator.id, 'cultivator', killer.id)
                && gate.canPointAt(cultivator.id, 'cultivator', killer.id);
            expect(said.includes(killer.name),
                `${where} ${couldSayIt ? 'withheld' : 'handed over'} a name it should not`)
                .toBe(couldSayIt);

            // ── AND THE TIER IS THE ENGINE'S ────────────────────────────
            //
            // `whoTheyCarryFor` is what `whatATellingLandsOn` asks before it
            // will write a row, so the opening may promise an account exactly
            // when the telling layer would honour one.
            const carries = new Set(
                whoTheyCarryFor(cultivator.id, getNpc(world.state, cultivator.id)).ids);
            expect(said.includes('The account is yours to carry'),
                `${where} disagreed with whoTheyCarryFor about ${whoDied}`)
                .toBe(carries.has(victim!.id));

            db.close();
        }
    }, 900_000);

    /**
     * The played half of what used to be `reaches a face from the street and a
     * face from the household`. The household half of that claim rested on one
     * seed drawing a 4-in-30,000 arrangement, which is the shape of a test that
     * is green by luck; it is arranged below instead, and the reasoning and the
     * numbers for the split are in the header.
     *
     * Asserted as a membership rather than as "all four are street", because
     * which tier a given seed draws is the engine's choice and not this file's.
     */
    it('reaches a face from the street on the worlds it is pinned to', async () => {
        const ties: string[] = [];
        for (const pinned of WHERE_IT_HAPPENS) {
            const { db, game } = await makeGameInWorld(pinned);
            await game.newRun('Aspirant');
            const recap = theRecap(db);
            const at = recap.findIndex(line => /\bKilled\b/.test(line));
            ties.push(/^The household/.test(theHeadingAbove(recap, at)) ? 'kin' : 'street');
            db.close();
        }
        expect(new Set(ties), 'no pinned world drew a victim off the street').toContain('street');
    }, 900_000);

    // ─────────────────────────────────────────────────────────────────────
    // WHO THE STREET DRAW ADMITS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * A hamlet of three, none of them old enough to have raised a
     * sixteen-year-old, so every face is a face from the street and the
     * household is legitimately empty.
     */
    function aStreetWithAKilling(
        opts: { yearsAgo: number; priced: boolean }
    ): WorldState {
        const state = createWorld({ seed: 'street', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 100 * DAYS_PER_YEAR;
        state.locations.push(makeLocation({
            id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
        }));
        for (const [i, name] of ['The Dead One', 'The Killer', 'Still Standing'].entries()) {
            state.npcs.push(createNpc(state.seed, {
                id: `npc-${i}`, name,
                bornOnDay: state.currentDay - 20 * DAYS_PER_YEAR,
                onDay: state.currentDay,
                locationId: 'home', occupation: 'disciple'
            }));
        }
        const killedOn = state.currentDay - Math.round(opts.yearsAgo * DAYS_PER_YEAR);
        const actors = [
            { id: 'npc-1', name: 'The Killer', role: 'killer' },
            { id: 'npc-0', name: 'The Dead One', role: 'victim' }
        ];
        // THE TWO DOORS A KILLING ACTUALLY ENTERS THE WORLD BY, and the
        // difference between them is the whole of what OPEN means here.
        // `aDeedEntersTheWorld` stamps `deedWeight`, which is the field
        // `whoIsStillCarriedFor` keeps the victim's row for and
        // `whatATellingLandsOn` looks for before it will write a row.
        // `appendWorldFact` straight is the other door - the confrontation
        // resolver takes it - and a row through it is a killing the world
        // remembers and holds no account for.
        if (opts.priced) {
            aDeedEntersTheWorld(state, {
                kind: 'death',
                day: killedOn,
                locationId: 'home',
                actors,
                summary: 'The Killer killed The Dead One at Autumn Gate.',
                unattributed: 'Somebody was found dead here some years ago.',
                weight: 'grave'
            });
        } else {
            appendWorldFact(state, makeFact({
                day: killedOn,
                kind: 'death',
                scale: 'personal',
                summary: 'The Killer killed The Dead One at Autumn Gate.',
                actors,
                locationId: 'home',
                visibility: 'regional',
                magnitude: 0.4,
                causeKnown: true
            }), { recur: false });
        }
        const at = state.npcs.findIndex(npc => npc.id === 'npc-0');
        state.npcs[at] = markDead(state.npcs[at], killedOn, 'Killed by The Killer.');
        return state;
    }

    const player = {
        id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
    } as Cultivator;

    const drawnFrom = (world: WorldState) => facesFromHome({
        world, cultivator: player, origin: 'thin_county', seed: 'v'
    });

    it('admits somebody killed inside this life own years', () => {
        const faces = drawnFrom(aStreetWithAKilling({ yearsAgo: 10, priced: true }));
        const dead = faces.find(one => one.name === 'The Dead One');
        expect(dead, 'the street draw is still taking only the living').toBeDefined();
        expect(dead!.tie, 'drawn as a face from the street, not as kin').toBeNull();
        expect(dead!.diedYearsAgo).toBe(10);
        expect(dead!.killedBy).toEqual({
            killerId: 'npc-1', killerName: 'The Killer', anAccountWasOpened: true
        });
    });

    /**
     * NOBODY GREW UP AROUND SOMEBODY WHO WAS ALREADY DEAD, and that is the
     * whole of what "recently" means here - the age the run opens at, not a
     * span chosen in this module. It is load-bearing rather than a formality:
     * the wrongs pass dates its killings 3 to 30 years back, and 1,004 of the
     * 1,819 lives born beside a victim were born after the killing.
     */
    it('refuses somebody who died before this life began', () => {
        const faces = drawnFrom(aStreetWithAKilling({ yearsAgo: 40, priced: true }));
        expect(faces.map(one => one.name)).not.toContain('The Dead One');
        expect(faces.length, 'the living are still drawn').toBeGreaterThan(0);
    });

    /**
     * AND ONLY A WRONG THE WORLD IS STILL HOLDING AN ACCOUNT FOR. Nothing marks
     * a wrong settled, so a priced deed is the only sense of OPEN available -
     * and it is the same field `whoIsStillCarriedFor` keeps the victim's row
     * for and `whatATellingLandsOn` looks for before it will write a row.
     */
    it('refuses a killing the world never opened an account for', () => {
        const faces = drawnFrom(aStreetWithAKilling({ yearsAgo: 10, priced: false }));
        expect(faces.map(one => one.name)).not.toContain('The Dead One');
        expect(faces.length, 'the living are still drawn').toBeGreaterThan(0);
    });

    // ─────────────────────────────────────────────────────────────────────
    // WHO THE HOUSEHOLD ADMITS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * A house's ground holding one widowed household: the parent who did the
     * raising, the spouse who was killed inside this life's own years, and the
     * person who killed them, too young to have raised anybody.
     *
     * TWO THINGS ARE LOAD-BEARING AND NEITHER IS A NUMBER CHOSEN HERE.
     *
     *   THE HOUSEHOLD IS A CULTIVATING ONE. Below {@link FOUNDATION_ORDINAL} a
     *   household is a MENTION - no tie, no whereabouts, and no second parent
     *   inherited - so a mortal family cannot reach this case at all. That is
     *   the mortal ruling rather than a gap in the draw, and it is why a birth
     *   on a house's ground is the arrangement.
     *
     *   THE PLAYER HAS A ROW. The kin tier is `whoTheyCarryFor`'s, and that
     *   reads the HEARER's own ties - which only land where the world already
     *   holds them a row. Without one the household still comes back and the
     *   account does not, which is the asymmetry `the-family-a-life-opens-with`
     *   has had to be taught twice.
     */
    function aHouseholdWithAKilledParent(opts: { yearsAgo: number }): WorldState {
        const state = createWorld({ seed: 'household', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 100 * DAYS_PER_YEAR;
        state.locations.push(makeLocation({
            id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
        }));
        const standing: [string, string, number, number][] = [
            ['npc-left', 'The One Left', FOUNDATION_ORDINAL, 60],
            ['npc-killed', 'The One Killed', FOUNDATION_ORDINAL, 60],
            ['npc-killer', 'The Killer', FOUNDATION_ORDINAL, 20],
            ['pc', 'Probe', 0, 16]
        ];
        for (const [id, name, ordinal, age] of standing) {
            state.npcs.push(createNpc(state.seed, {
                id, name,
                bornOnDay: state.currentDay - age * DAYS_PER_YEAR,
                onDay: state.currentDay,
                locationId: 'home',
                occupation: id === 'pc' ? 'the one being played' : 'disciple',
                cultivation: { realmOrdinal: ordinal }
            }));
        }

        // Both ends, though the bind reads only the parent's. A half-written
        // marriage is a shape the world never produces.
        for (const [a, b] of [['npc-left', 'npc-killed'], ['npc-killed', 'npc-left']]) {
            const i = state.npcs.findIndex(npc => npc.id === a);
            const other = state.npcs.find(npc => npc.id === b)!;
            state.npcs[i] = upsertRelationship(state.npcs[i], {
                targetId: other.id, targetName: other.name, kind: 'spouse',
                standing: 0.8, note: 'Their household.'
            }, state.currentDay);
        }

        const killedOn = state.currentDay - Math.round(opts.yearsAgo * DAYS_PER_YEAR);
        aDeedEntersTheWorld(state, {
            kind: 'death',
            day: killedOn,
            locationId: 'home',
            actors: [
                { id: 'npc-killer', name: 'The Killer', role: 'killer' },
                { id: 'npc-killed', name: 'The One Killed', role: 'victim' }
            ],
            summary: 'The Killer killed The One Killed at Autumn Gate.',
            unattributed: 'Somebody was found dead here some years ago.',
            weight: 'grave'
        });
        const at = state.npcs.findIndex(npc => npc.id === 'npc-killed');
        state.npcs[at] = markDead(state.npcs[at], killedOn, 'Killed by The Killer.');
        return state;
    }

    /**
     * THE HALF A PINNED SEED USED TO CARRY. Arranged rather than drawn, because
     * the draw reaches it once in seven thousand births - see the header for
     * the measurement and for the 21 households across 24 worlds that say the
     * world does produce it.
     */
    it('hands a killed parent back as kin, and as somebody to carry for', () => {
        const world = aHouseholdWithAKilledParent({ yearsAgo: 11 });
        const faces = facesFromHome({
            world,
            cultivator: {
                id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
            } as Cultivator,
            origin: 'sect_retainer',
            seed: 'v'
        });

        const dead = faces.find(one => one.name === 'The One Killed');
        expect(dead, 'the household still inherits only a living spouse').toBeDefined();
        expect(dead!.tie, 'the second parent, inherited off the spouse tie').toBe('parent');
        expect(dead!.aMentionOnly, 'a household with rows in it is not a mention').toBe(false);
        expect(dead!.diedYearsAgo).toBe(11);
        expect(dead!.killedBy).toEqual({
            killerId: 'npc-killer', killerName: 'The Killer', anAccountWasOpened: true
        });

        // AND THE TIER IS THE ENGINE'S, asked through the call the telling
        // layer makes rather than rebuilt here.
        const carries = new Set(whoTheyCarryFor('pc', getNpc(world, 'pc')).ids);
        expect(carries.has('npc-killed'),
            'the household landed and the account behind it did not').toBe(true);
    });

    // ─────────────────────────────────────────────────────────────────────
    // WHAT THE OPENING SAYS
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

    const aKilledFace = (
        killedBy: { byName: string | null; yoursToCarry: boolean } | null,
        tie: string | null = null
    ) => ({
        name: 'Shen Wuyou',
        sourceNote: 'One of the faces that was always at the well.',
        tie,
        diedYearsAgo: 12,
        whereTheyAre: { name: 'Three Walls' },
        killedBy
    });

    const alive = (name: string) => ({
        name,
        sourceNote: 'Grew up on the same road.',
        tie: null as string | null,
        diedYearsAgo: null as number | null,
        whereTheyAre: { name: 'Three Walls' }
    });

    const opening = (faces: unknown[]) =>
        theLifeBehindTheFirstTurn(birth, 16, faces as never).toldToThePlayer.join('\n');

    it('names the killer where the life can name them, and says so where it cannot', () => {
        const withAName = opening([
            aKilledFace({ byName: 'Wei Shenchuan', yoursToCarry: false })
        ]);
        expect(withAName).toMatch(/Killed by Wei Shenchuan, 12 years ago\./);
        expect(withAName).not.toMatch(/Dead these/);

        const stranger = opening([aKilledFace({ byName: null, yoursToCarry: false })]);
        expect(stranger).toMatch(/Killed 12 years ago, and nobody has put a name to who did it\./);
        expect(stranger).not.toMatch(/Dead these/);
    });

    /**
     * THE TIER, SAID ONLY WHERE IT IS TRUE. The absence is what makes a
     * neighbour's killing read as a neighbour's, so a line that carried it
     * either way would have collapsed the two the owner asked to keep apart.
     */
    it('offers an account for somebody this life carries for, and for nobody else', () => {
        expect(opening([aKilledFace({ byName: null, yoursToCarry: true }, 'parent')]))
            .toMatch(/The account is yours to carry\./);
        expect(opening([aKilledFace({ byName: null, yoursToCarry: false })]))
            .not.toMatch(/account is yours/);
    });

    /**
     * A HEADING PROMISES ONLY WHAT THE LINES UNDER IT DELIVER. The household
     * block has branched for this since a mortal household could say no
     * whereabouts at all; the street block could not reach the case until it
     * took the dead, and now it can.
     */
    it('drops the whereabouts clause from a block holding somebody dead', () => {
        expect(opening([alive('Qiu Lanhe'), alive('Ji Peilu')]))
            .toMatch(/People you can already put a name to, and where each of them is\./);

        const withADeadOne = opening([
            alive('Qiu Lanhe'),
            aKilledFace({ byName: null, yoursToCarry: false })
        ]);
        expect(withADeadOne).toMatch(/People you can already put a name to\. Knowing/);
        expect(withADeadOne).not.toMatch(/where each of them is/);
    });

    /** An ordinary death is untouched, which is most of them. */
    it('leaves a death that was not a killing saying what it always said', () => {
        const plain = opening([aKilledFace(null, 'parent')]);
        expect(plain).toMatch(/Dead these 12 years\./);
        expect(plain).not.toMatch(/Killed/);
    });
});
