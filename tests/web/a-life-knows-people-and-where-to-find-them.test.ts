/**
 * A name with no place attached is half an acquaintance.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The opening led with what sixteen years came to, and what it led with was
 * this:
 *
 *     What 16 years got you: 3 names, and this is where each came from.
 *     The Furnace Flank is home. Grew up here.
 *     Azure Dew Sect exists somewhere out there and takes disciples.
 *     Burnt Earth Temple exists somewhere out there and takes disciples.
 *
 * Three names and every one a place or a house. `birth.knowledge` holds no
 * people at all - the people a childhood leaves are drawn off the world by
 * `who-a-life-like-this-grew-up-knowing.ts` - so the count line was answering
 * "what did a life come to" with a gazetteer, and the block that did name
 * people sat under it where it read as an afterthought.
 *
 * The design owner, shown that a quarter of runs open in a square holding fewer
 * than three people: *"even they aren't there, you know where to find them"*.
 * That is one ruling with two halves, and the second half was missing outright -
 * a face carried a name and a note and nothing that said where to go.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * MEASURED FIRST, BECAUSE THE FIX DEPENDS ON IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * 80 lives over 20 pinned worlds, counting `exists:cultivator:` rows held on
 * day zero:
 *
 *     1 person   3 lives      knows nobody    0 of 80
 *     2 people   7 lives      every face standing in the birthplace
 *     3 people  58 lives
 *     4 people   9 lives
 *     5 people   3 lives
 *
 * So the fact was there and the read was there. What was missing was the place,
 * and the ordering that made the people the answer rather than the footnote.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULE THESE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Not "every life has company" - an orphan in a hamlet of immortals legitimately
 * knows nobody, and `facesFromHome` answers with an empty list rather than with
 * somebody out of reach. The rule that covers both:
 *
 *   **A life either names nobody, or names people and says where each of them
 *   is, and every one of those people can be acted on on turn one.**
 */

import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { whoTheyCarryFor } from '../../src/web/what-a-telling-lands-on';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms';

/** Four worlds, so the rule is asserted against more than one arrangement. */
const WORLDS = ['knows-people-a', 'knows-people-b', 'knows-people-c', 'knows-people-d'];

const THE_PEOPLE_BLOCK = /^People you can already put a name to/;
const THE_HOUSEHOLD_BLOCK = /^The household, and where each of them is now:/;

function theRecap(db: Database.Database): string[] {
    const rows = db
        .prepare("SELECT text FROM web_play_log WHERE role = 'engine' AND turn = 0 ORDER BY id")
        .all()
        .map(row => (row as { text: string }).text);
    const recap = rows.find(text => /years old, standing in/.test(text));
    expect(recap, 'no turn 0 ruling carried the life behind this cultivator').toBeDefined();
    return recap!.split('\n');
}

/**
 * The lines under the people heading, read off the printed page.
 *
 * Read out of the output rather than rebuilt from the knowledge table on
 * purpose: the table holds every person this cultivator has ever been told
 * about, and by the time turn 0 has been narrated that includes whoever a stall
 * or an overheard conversation named. Rebuilding the list would be a second
 * copy of a deal this block already made.
 */
function linesUnder(recap: readonly string[], heading: RegExp): string[] {
    const at = recap.findIndex(line => heading.test(line));
    if (at < 0) return [];
    const out: string[] = [];
    for (let i = at + 1; i < recap.length; i++) {
        if (/^(What \d+ years got you|Nobody has told you anything|People you can already|The household)/
            .test(recap[i])) break;
        out.push(recap[i]);
    }
    return out;
}

function whoTheOpeningNamed(recap: readonly string[]): string[] {
    return [...linesUnder(recap, THE_HOUSEHOLD_BLOCK), ...linesUnder(recap, THE_PEOPLE_BLOCK)];
}

describe('a life knows people, and where to find them', () => {
    it('names somebody, says where they are, and never prints an empty heading', async () => {
        let namedSomebodySomewhere = false;

        for (const worldSeed of WORLDS) {
            const { db, game } = await makeGameInWorld({ worldSeed, seed: `run-${worldSeed}` });
            const { cultivator } = await game.newRun('Aspirant');
            const recap = theRecap(db);
            const named = whoTheOpeningNamed(recap);

            // A heading with nothing under it is the engine promising names it
            // does not have. Either the block is absent or it has people in it.
            for (const heading of [THE_PEOPLE_BLOCK, THE_HOUSEHOLD_BLOCK]) {
                const printed = recap.some(line => heading.test(line));
                expect(printed, `${worldSeed} printed ${heading} with nobody under it`)
                    .toBe(linesUnder(recap, heading).length > 0);
            }

            for (const line of named) {
                // WHO THEY ARE TO YOU, AND WHERE THEY ARE NOW. Both halves, on
                // every line - a name and a note with no place is the state this
                // file exists to end.
                expect(line, `${worldSeed}: "${line}" says nothing about where they are`)
                    .toMatch(/(Still in .+\.|In .+ now\.|Nobody could say where they are)$/);
            }
            if (named.length > 0) namedSomebodySomewhere = true;

            // AND THE PLACE IS ONE THE GAME WILL TAKE. Every face this world
            // produced is standing where the cultivator is, so the place named
            // is the square they are in - which is the strongest form of
            // reachable there is. The clause is asserted rather than assumed
            // because the move verb is gated on `canPointAt` and an opening that
            // named a place outside that gate would print a destination the
            // next turn refuses.
            for (const line of named) {
                const where = line.match(/Still in (.+)\.$/)?.[1];
                if (where === undefined) continue;
                expect(where, `${worldSeed} named a square nobody is standing in`)
                    .toBe(cultivator.location);
            }

            db.close();
        }

        expect(namedSomebodySomewhere, 'not one of these worlds left a life knowing anybody')
            .toBe(true);
    }, 300_000);

    /**
     * AND THE SENTENCE A PLAYER FORMS OFF IT WORKS. "I go and find X" on turn
     * one is the whole point of printing the name: the engine must find the
     * person, not answer that nobody has said a name in front of you.
     */
    it('lets the player act on somebody the opening named', async () => {
        const { db, game } = await makeGameInWorld({
            worldSeed: WORLDS[0], seed: `act-${WORLDS[0]}`
        });
        await game.newRun('Aspirant');

        const named = whoTheOpeningNamed(theRecap(db));
        expect(named.length, 'this world left nobody to act on').toBeGreaterThan(0);

        // The name is whatever the opening printed, never one this test chose.
        // Any name the game prints is a name the game has to accept.
        const who = named[0].split('.')[0];
        const said = await game.act(`I look at ${who}`) as { narration?: string };
        expect(said.narration ?? '').not.toMatch(/no name|nobody of that name|have not heard/i);
        expect((said.narration ?? '').length).toBeGreaterThan(0);

        db.close();
    }, 300_000);

    /**
     * AND A SIXTEEN-YEAR-OLD HAS A FAMILY.
     *
     * Measured before this existed: 80 lives over 20 pinned worlds, and the
     * player held zero rows in any tie store while every other person in the
     * world had kin. The design owner: *"the player needs to find a master,
     * that doesn't change. but kin yes. rival no."*
     *
     * The rule, which covers the orphan as well: a life either has no household
     * the world can name - a birthplace with nobody old enough to have raised
     * anybody - or its household is named, placed, and held from the other side
     * by the kin themselves.
     */
    it('opens with a household the world holds the other half of', async () => {
        let somebodyHadAFamily = false;

        // A CULTIVATING BIRTH, because only a cultivating household writes
        // anything at all. A mortal parent is a mention with no tie behind it -
        // the owner's ruling, and `writes nothing at all for a mortal
        // household` is the test that pins the other side of it. Arranged by
        // seed: a family that cultivates is about three births in a thousand.
        for (const worldSeed of ['kin-10']) {
            const { db, game } = await makeGameInWorld({ worldSeed, seed: 'hunt-23660' });
            const { cultivator } = await game.newRun('Aspirant');
            const household = linesUnder(theRecap(db), THE_HOUSEHOLD_BLOCK);
            if (household.length === 0) { db.close(); continue; }
            somebodyHadAFamily = true;

            // Read back off DISK rather than the handle in memory: a tie that
            // never reached SQLite is a family that lasts until the process
            // ends, and the world is only flushed as a side effect of the
            // player's row being written for the first time. Dropping the
            // process cache is what makes the next read a real one.
            resetCultivationWorlds();
            const world = await game.loadWorld();
            const held = world.npcs.filter(npc => npc.relationships.some(tie =>
                tie.targetId === cultivator.id));

            expect(held.length, `${worldSeed}: nobody in the world holds this family`)
                .toBeGreaterThan(0);
            for (const one of held) {
                const tie = one.relationships.find(t => t.targetId === cultivator.id)!;
                // Kin and only kin. A master is the road the game is about and
                // a rival is earned; neither is handed over at birth.
                expect(['child', 'kin'], `${worldSeed} handed the player a ${tie.kind}`)
                    .toContain(tie.kind);
                // And the person holding it is named in the opening, so the
                // player is not the only one who does not know.
                expect(household.join(' ')).toContain(one.name);
            }

            db.close();
        }

        expect(somebodyHadAFamily, 'not one of these worlds gave a life a family').toBe(true);
    }, 300_000);

    /**
     * AND THE PLAYER HOLDS THEIR OWN HALF OF IT.
     *
     * ═══════════════════════════════════════════════════════════════════
     * THE BUG THIS EXISTS FOR, WHICH WAS FIXED TWICE AND BROKEN BY THE FIX
     * ═══════════════════════════════════════════════════════════════════
     *
     * A tie has two rows. The kin's half - the parent's `child` row - is
     * written onto their world record whatever else happens. The player's half
     * only lands if the world already holds a row for the player when the
     * household is bound, and `newRun` has to create that row itself.
     *
     * Writing it too late lost the half. Moving the write earlier lost it
     * again, for a different reason: `refreshThePlayerRow` returns on a null
     * `atHand`, and the call that loaded the world was the very face seeding it
     * had been moved above - so on a cold process the write became a no-op and
     * the ordering that fixed the bug restored it.
     *
     * BOTH ORDERINGS PASSED EVERY TEST IN THIS FILE, because every assertion
     * about the household read the KIN's side, which lands either way. That is
     * the gap this closes.
     *
     * ═══════════════════════════════════════════════════════════════════
     * WHY IT IS ASSERTED THROUGH `whoTheyCarryFor`
     * ═══════════════════════════════════════════════════════════════════
     *
     * Because that is the reader that was broken, and it fails for a reason
     * somebody can read: it decides whose killing a person may open an account
     * about by walking the HEARER's own rows, so a player holding no half of
     * their own household cannot tell a soul their parent was killed.
     * `rescuersFor` reads the other end and worked through both orderings,
     * which is exactly why this hid for so long.
     *
     * The row is read back off SQLite rather than out of the handle in memory,
     * because a half that never reached disk is a family that lasts until the
     * process ends.
     */
    it('leaves the player holding their own half, which is the half a telling reads', async () => {
        let checkedSomewhere = false;

        // The same cultivating birth, and for the same reason: a mortal
        // household writes no half for anybody to hold.
        for (const worldSeed of ['kin-10']) {
            const { db, game } = await makeGameInWorld({ worldSeed, seed: 'hunt-23660' });
            const { cultivator } = await game.newRun('Aspirant');

            resetCultivationWorlds();
            const world = await game.loadWorld();
            const me = world.npcs.find(npc => npc.id === cultivator.id) ?? null;
            expect(me, `${worldSeed}: the world holds no row for the player at all`).not.toBeNull();

            // Whose household this is, read off the side that always lands.
            const kinOfMine = world.npcs.filter(npc => npc.relationships.some(tie =>
                tie.targetId === cultivator.id && (tie.kind === 'child' || tie.kind === 'kin')));
            if (kinOfMine.length === 0) { db.close(); continue; }
            checkedSomewhere = true;

            const carry = whoTheyCarryFor(cultivator.id, me);
            for (const one of kinOfMine) {
                expect(carry.ids, `${worldSeed}: the player does not carry for ${one.name}, `
                    + 'who holds them as family').toContain(one.id);
            }

            db.close();
        }

        expect(checkedSomewhere, 'not one of these worlds gave a life a family to hold').toBe(true);
    }, 300_000);

    /**
     * A CULTIVATOR KIN IS A REAL PERSON. A MORTAL ONE IS A MENTION.
     *
     * The design owner, on the two standards:
     *
     *   > "note that if your parents are mortals they're just mentioned once and
     *   > you never really see them again. that's how xianxia works too. so that
     *   > wouldn't be a defect. its only a defect if your parents are immortals
     *   > and don't have entities"
     *
     * So this asserts ONE half on purpose. Somebody past `FOUNDATION_ORDINAL`
     * is alive in a hundred years and is somewhere the world can name, so a
     * life told it has a cultivator parent must be able to find them: a record,
     * a place, and a gate that opens. A MORTAL PARENT IS DELIBERATELY HELD TO
     * NONE OF THAT, because mortals are not tracked and a mortal bound to a
     * particular row is a promise nothing can keep - *"cuz we don't track
     * mortals, so we don't have a choice."*
     *
     * DO NOT COMPLETE THIS INTO REQUIRING ENTITIES FOR EVERYBODY. The filter is
     * the point of the test, and `mortal kin occur` below is there so that
     * removing it is visible rather than silent.
     *
     * The cultivating birth is arranged by seed: a family that cultivates is
     * about three births in a thousand, so waiting for one is not a fixture.
     */
    it('requires a world record of a cultivator kin, and a mention of a mortal one', async () => {
        const { db, game } = await makeGameInWorld({
            worldSeed: 'kin-10', seed: 'hunt-23660'
        });
        const { cultivator } = await game.newRun('Aspirant');

        resetCultivationWorlds();
        const world = await game.loadWorld();
        const me = world.npcs.find(npc => npc.id === cultivator.id) ?? null;
        expect(me, 'the world holds no row for the player').not.toBeNull();

        const kin = me!.relationships.filter(t => t.kind === 'parent' || t.kind === 'kin');
        expect(kin.length, 'this life opened with no household at all').toBeGreaterThan(0);

        const cultivators: string[] = [];
        const mortals: string[] = [];
        for (const tie of kin) {
            const them = world.npcs.find(npc => npc.id === tie.targetId) ?? null;
            // Read off the world, never off a name this test chose.
            expect(them, `the household names ${tie.targetName} and the world holds nobody `
                + 'by that id').not.toBeNull();
            if (them!.cultivation.realmOrdinal < FOUNDATION_ORDINAL) {
                mortals.push(them!.name);
                continue;
            }
            cultivators.push(them!.name);

            // A record, somewhere the world can name, and a gate that opens -
            // which is the whole of what "has an entity" means to a player.
            expect(them!.locationId, `${them!.name} cultivates and is nowhere`).not.toBeNull();
            expect(world.locations.some(l => l.id === them!.locationId),
                `${them!.name} stands in a place the world does not hold`).toBe(true);
            expect(game.knowledge.canPointAt(cultivator.id, 'cultivator', them!.id),
                `${them!.name} cultivates and the player cannot point at them`).toBe(true);
        }

        expect(cultivators.length,
            'this fixture has no cultivator kin in it, so it asserts nothing').toBeGreaterThan(0);
        // Mortal kin occur, and nothing above was asked of them.
        expect(mortals.length + cultivators.length).toBe(kin.length);

        db.close();
    }, 300_000);

    /**
     * THE COUNT LINE SAYS WHAT IT IS COUNTING. It reads `birth.knowledge`,
     * which is places and houses and never a person, and a bare "3 names" under
     * a heading asking what sixteen years came to reads as the whole of it.
     */
    it('does not offer a count of places as the answer to what a life came to', async () => {
        const { db, game } = await makeGameInWorld({
            worldSeed: WORLDS[1], seed: `count-${WORLDS[1]}`
        });
        await game.newRun('Aspirant');

        const recap = theRecap(db);
        const count = recap.find(line => /^What \d+ years got you/.test(line));
        expect(count, 'this life was told nothing about anywhere').toBeDefined();
        expect(count!).toMatch(/names? of places and houses/);

        // And the people come first, because that is the question a life
        // answers first. Both indices are read, so a block that stopped being
        // printed at all cannot pass this by coming back as -1.
        const people = recap.findIndex(line => THE_PEOPLE_BLOCK.test(line));
        expect(people, 'this life named nobody at all').toBeGreaterThan(-1);
        expect(people).toBeLessThan(recap.indexOf(count!));

        db.close();
    }, 300_000);
});
