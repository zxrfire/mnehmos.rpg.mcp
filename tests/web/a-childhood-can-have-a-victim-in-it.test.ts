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
 * ═════════════════════════════════════════════════════════════════════════
 * THE DOOR THIS FILE RECORDED AS SHUT, AND WHY IT IS NOT A MORTAL RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This header used to end on an open question: a MORTAL household is a mention
 * and inherited no second parent, so a mortal whose father was murdered ten
 * years ago was told nothing, while the same man reached the opening if he was
 * a neighbour. The design owner has ruled, and the ruling is not about mortals:
 *
 *   > "if he knows then it counts otherwise he doesn't know what happened to
 *   > his parents and that's fine it doesn't matter to the story"
 *
 * YOU KNOW WHAT YOU WERE TOLD. Both halves are the design - a life that opens
 * never having found out is a legitimate and common opening, so a path that
 * always told them would be the same defect as one that never did.
 *
 * ── WHAT THE SHUT DOOR ACTUALLY WAS ──────────────────────────────────────
 *
 * Not a ruling about mortals meeting a ruling about the street. The read for a
 * second parent lived INSIDE `bindNewbornToHousehold` and there was no way to
 * ask it without writing a row, so the mention path named one parent whatever
 * the world held. `theOtherParentOf` is that read extracted, exactly as
 * `theOtherChildrenOf` already was and for the reason that one gives.
 *
 * Measured, 1,950 births over 13 pinned worlds, twice:
 *
 *     on the day a world opens
 *       mortal households drawn                          1,853  95.0%
 *       whose named parent holds a spouse tie                0
 *
 *     the same worlds, run 25 years
 *       mortal households drawn                          1,634  83.8%
 *       whose named parent holds a spouse tie            1,355
 *       whose second parent was killed in these years       22
 *
 * So on day one the case cannot arise at all - `seedTheMarriages` pairs
 * cultivators only, and a mortal has no second parent for a killing to have
 * taken. It arises once the world has run, and all 22 said nothing.
 *
 * What the extraction moves, on the same 1,950 births:
 *
 *     lives naming two parents      day one          4 ->     4
 *                                   at 25 years     94 -> 1,108
 *
 * Nothing on a fresh world changes, because there is nothing there to name.
 *
 * ── AND THE ANSWER FOR ALL 22 IS STILL THAT NOBODY TOLD THEM ─────────────
 *
 * Every one of those 22 killings came through a path that opened no account -
 * no `deedWeight` on the row. That is the same field `whatATellingLandsOn` looks
 * for before it will write a row and the same one `whoIsStillCarriedFor` keeps
 * the victim over the mortal sweep for, so a killing without it is one nobody is
 * carrying and one whose victim the world DELETES on its next pass. It is
 * therefore the honest sense of OPEN, and it is what the opening asks - for a
 * parent now as well as for a neighbour, which it did not before. A mortal
 * parent the world is about to forget is not named at all; a cultivator is, and
 * says the ending without the killing.
 *
 * Which is a finding about the world and is left where it was found: THE
 * WORLD'S OWN KILLINGS OPEN NO ACCOUNT. The wrongs a world opens holding are
 * priced; the 115 further killings 13 worlds produced over 25 years are not one
 * of them, so nobody inherits them and the victims are swept.
 *
 * ── WHICH KNOWLEDGE READER, AND WHY NOT THE OTHER ONE ────────────────────
 *
 * `whatOneOfTheWorldsOwnPeopleKnows` is the reader for a question of this shape
 * - the player has a world row by the time the faces are drawn, `newRun` puts
 * one there - and `KnowledgeGate` is not, because at turn 0 the player's table
 * holds nothing about any killing and a gate on it answers `unaware` every time.
 *
 * So the right reader was asked, and then measured before it was wired:
 *
 *     asked at every settlement in 13 worlds about every killing they hold
 *     could have been told                              1,998 / 1,998  100%
 *
 * A grave killing clears every province, so circulation is a check that cannot
 * fail and adding one would have been a path that always tells them wearing a
 * gate. What actually decides whether a life heard is WHO ITS CHILDHOOD
 * CONTAINED, and that is the draw rather than a second reader:
 *
 *     lives whose faces include a victim                    32 / 1,950  1.64%
 *     lives that open never having been told             1,918 / 1,950  98.4%
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
 *   A MORTAL HOUSEHOLD NAMES THE WHOLE HOUSEHOLD, and a killed parent in one is
 *   said. It is still a mention - no tie, no whereabouts - which is why the
 *   account is not offered with it.
 *
 *   AND A DEATH THE WORLD OPENED NO ACCOUNT FOR IS A DEATH. One rule for a
 *   parent and a neighbour alike, where the parent had none.
 *
 * Red-checked, each assertion producing exactly the failure named beside it.
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
 * RE-DRAWN, AND WHY. The pins these replaced stopped opening beside a killing at
 * `8166972a`, which seeded houses with their rank and file: the seeded killings
 * were drawn as one row among a province's rows, compounds came to hold most of
 * them, and the killings moved onto house ground with them (the parent of that
 * commit passes, it and every commit since fail on `probe-w4`). Drawing the
 * killing's place by `populationWeightOf` put them back where lives open - see
 * `a-fresh-world-has-somebody-to-tell.test.ts` - and re-dealt the draw again, so
 * these four come out of a sweep on that tree: worlds `probe-w1` to `probe-w24`,
 * births `probe-rN-k`, a pure pre-filter for a priced killing inside a childhood
 * at the birth place, then played. 120 played, 46 lives with a killing among
 * their faces, on 23 of the 24 worlds; named 24, unnamed 22. No life in the
 * sweep had its own parent as the killer, so the category the old pins claimed
 * is not claimed here.
 *
 * A PIN ON A DRAW IS A PIN ON THE DRAW. When the seeding moves these will be
 * re-dealt again; the sweep above is the instrument, and what the assertions
 * below pin is what the opening says about whatever killing it finds.
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
    // A village, and a killer this life can put a name to.
    { worldSeed: 'probe-w7', seed: 'probe-r7-6' },
    // A village, and a killer nobody has named to them.
    { worldSeed: 'probe-w6', seed: 'probe-r6-43' },
    // And a sect town rather than a village, where the reach is wider - both answers.
    { worldSeed: 'probe-w14', seed: 'probe-r14-2' },
    { worldSeed: 'probe-w17', seed: 'probe-r17-4' }
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
     *   WHETHER THE HOUSEHOLD CULTIVATES. Below {@link FOUNDATION_ORDINAL} a
     *   household is a MENTION - the names and nothing else - and above it the
     *   ties are written. Both are arranged here, because the ruling is that
     *   the rule is the same for both and the only way to show that is to run
     *   it twice.
     *
     *   THE PLAYER HAS A ROW. The kin tier is `whoTheyCarryFor`'s, and that
     *   reads the HEARER's own ties - which only land where the world already
     *   holds them a row. Without one the household still comes back and the
     *   account does not, which is the asymmetry `the-family-a-life-opens-with`
     *   has had to be taught twice.
     */
    function aHouseholdWithAKilledParent(
        opts: { yearsAgo: number; mortal?: boolean; priced?: boolean }
    ): WorldState {
        const state = createWorld({ seed: 'household', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 100 * DAYS_PER_YEAR;
        state.locations.push(makeLocation({
            id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
        }));
        // A mortal household is the same arrangement one realm down. Nothing
        // else about it changes, which is the point of running it twice.
        const rung = opts.mortal === true ? 0 : FOUNDATION_ORDINAL;
        const standing: [string, string, number, number][] = [
            ['npc-left', 'The One Left', rung, 60],
            ['npc-killed', 'The One Killed', rung, 60],
            ['npc-killer', 'The Killer', rung, 20],
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
        const actors = [
            { id: 'npc-killer', name: 'The Killer', role: 'killer' },
            { id: 'npc-killed', name: 'The One Killed', role: 'victim' }
        ];
        const summary = 'The Killer killed The One Killed at Autumn Gate.';
        // The two doors again, and the same difference. See the street fixture
        // above: `aDeedEntersTheWorld` stamps `deedWeight` and a bare
        // `appendWorldFact` does not, and the world's own yearly passes take
        // the second one.
        if (opts.priced === false) {
            appendWorldFact(state, makeFact({
                day: killedOn,
                kind: 'death',
                scale: 'personal',
                summary,
                actors,
                locationId: 'home',
                visibility: 'regional',
                magnitude: 0.4,
                causeKnown: true
            }), { recur: false });
        } else {
            aDeedEntersTheWorld(state, {
                kind: 'death',
                day: killedOn,
                locationId: 'home',
                actors,
                summary,
                unattributed: 'Somebody was found dead here some years ago.',
                weight: 'grave'
            });
        }
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

    /**
     * THE HALF THIS FILE RECORDED AS A SHUT DOOR. The same arrangement one
     * realm down, which is the whole of the difference between a household the
     * world writes ties for and one it only names.
     *
     * The mention is unchanged in what it claims - no tie, no whereabouts - and
     * that is why the account is not offered: `whoTheyCarryFor` reads ties, and
     * a mention writes none. A player whose parents are mortal carrying for
     * nobody is `the-family-a-life-opens-with`'s standing ruling and is not
     * softened here.
     */
    it('names a killed parent in a mortal household, and claims nothing else', () => {
        const world = aHouseholdWithAKilledParent({ yearsAgo: 11, mortal: true });
        const faces = facesFromHome({
            world,
            cultivator: {
                id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
            } as Cultivator,
            origin: 'thin_county',
            seed: 'v'
        });

        const dead = faces.find(one => one.name === 'The One Killed');
        expect(dead, 'nobody named them at all').toBeDefined();
        // THE TIE IS THE ASSERTION, not that they appear. They are standing in
        // the birthplace, so the street draw reaches them here whatever the
        // household does - which is exactly the asymmetry the open question
        // named, and is not what the world produces: of the 22 killed second
        // parents measured over 13 worlds run 25 years, NONE was reachable off
        // the street, because the street asks whether the world opened an
        // account and none of those killings had one.
        expect(dead!.tie, 'a mortal household still names one parent and stops').toBe('parent');
        expect(dead!.aMentionOnly, 'a mortal household claims nothing').toBe(true);
        expect(dead!.whereTheyAre, 'a mention names no place').toBeNull();
        expect(dead!.diedYearsAgo).toBe(11);
        expect(dead!.killedBy).toEqual({
            killerId: 'npc-killer', killerName: 'The Killer', anAccountWasOpened: true
        });

        // AND THE ONE WHO DID THE RAISING IS STILL THERE. A second parent is an
        // addition to the household, never a replacement for the first.
        expect(faces.filter(one => one.tie === 'parent').map(one => one.name).sort())
            .toEqual(['The One Killed', 'The One Left']);

        const carries = new Set(whoTheyCarryFor('pc', getNpc(world, 'pc')).ids);
        expect(carries.has('npc-killed'),
            'a mention wrote a tie, and the account came with it').toBe(false);
    });

    /**
     * AND THE OTHER DIRECTION, FOR A MORTAL HOUSEHOLD: NOTHING IS SAID AT ALL.
     *
     * The owner's *"otherwise he doesn't know what happened to his parents and
     * that's fine"*, and it is not a softening - it is the mortal ruling doing
     * its own job. A dead mortal the world opened no account for is deleted by
     * `theWorldForgetsTheMortalDead` on the next pass, so a name here is a name
     * that stops resolving, which is the one thing a mention may not be.
     *
     * This is the case the world actually produces: of the 22 killed second
     * parents measured over 13 worlds run 25 years, every one arrived through a
     * path that opened no account.
     */
    it('says nothing of a mortal parent the world is about to forget', () => {
        const world = aHouseholdWithAKilledParent({
            yearsAgo: 11, mortal: true, priced: false
        });
        const faces = facesFromHome({
            world,
            cultivator: {
                id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
            } as Cultivator,
            origin: 'thin_county',
            seed: 'v'
        });

        expect(faces.map(one => one.name), 'named somebody the world will not keep')
            .not.toContain('The One Killed');
        // AND THE HOUSEHOLD IS STILL A HOUSEHOLD. The drop is one person, not
        // the mention.
        expect(faces.some(one => one.tie === 'parent' && one.name === 'The One Left'),
            'the one who did the raising went with them').toBe(true);
    });

    /**
     * AND FOR A CULTIVATING ONE, THE ENDING WITHOUT THE KILLING. A killing the
     * world opened no account for is a death: nobody is carrying it, nothing
     * will write a telling about it, and the mortal sweep does not keep a victim
     * over it. The street has refused this since it learned to take the dead;
     * the household never asked, so a parent said `Killed` on a row the world
     * was holding nothing about.
     *
     * The person stays, because somebody past {@link FOUNDATION_ORDINAL} who has
     * died is somebody the world keeps whatever else is true - the same ruling,
     * from its other end.
     */
    it('reads a killing the world opened no account for as a death', () => {
        const world = aHouseholdWithAKilledParent({ yearsAgo: 11, priced: false });
        const faces = facesFromHome({
            world,
            cultivator: {
                id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0, age: 16
            } as Cultivator,
            origin: 'sect_retainer',
            seed: 'v'
        });

        const dead = faces.find(one => one.name === 'The One Killed');
        expect(dead, 'the household still inherits its second parent').toBeDefined();
        expect(dead!.diedYearsAgo).toBe(11);
        expect(dead!.killedBy, 'the opening said a killing nobody is carrying').toBeNull();
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
