/**
 * What a played corpus still comes back refusing, by verb - and which of those
 * refusals is the game failing to understand.
 *
 * The instrument behind the 348-turn audit in
 * `a-near-synonym-reaches-the-same-answer.test.ts`: play the sentences a player
 * actually types, in several situations, at three heights of the ladder, in
 * pinned worlds, and count which verb was chosen and whether the turn answered.
 *
 * A refusal here is an engine call that came back `ok: false` - which is what
 * the turn's own inspector channel says about itself, and includes the blank
 * look (`engine.parseIntent/unclear`, "intent not recognised"). Counting the
 * VERB `unclear` instead over-counts: a turn can settle a back-reference and
 * answer under that verb, and the first cut of this probe scored those as
 * refusals and reported a fix going backwards.
 *
 * ── ONE NUMBER WAS MEASURING THREE THINGS ────────────────────────────────
 *
 * `ok: false` means the engine declined to act, and three unlike outcomes were
 * landing under it:
 *
 *   the engine did not understand   a blank look. The defect being hunted.
 *   it acted and the world said no  a theft that resolved and failed. A day
 *                                   was spent, an account opened. A good turn.
 *   a precondition was not met      no cultivation method, an empty pouch,
 *                                   nobody here crossing. The engine understood
 *                                   perfectly and said so, naming the route.
 *
 * Only the first is the game saying it does not know. Measured on the 744-turn
 * corpus, ~36 of the `coerce`/`interact` refusals were the second, and whole
 * verbs were the third: `cultivate` refused 24 of 24, every one of them the
 * no-method gate naming a book and somebody who could teach it.
 *
 * THE DISCRIMINATOR, off what a turn already records and nothing else:
 *
 *   not understood   the turn threw, or the call that refused is the reading
 *                    layer (`parseIntent`) - no handler was reached.
 *   world refused    a named handler refused AND the clock moved. Something
 *                    was attempted; it failed; the day is gone.
 *   precondition     a named handler refused and nothing was spent.
 *
 * The clock rather than a string: `run.elapsedDays` is state, and the
 * mechanical channel's "no time passed" is prose that can be rewritten.
 *
 * ── AND THE FIXTURE WAS MEASURING ITSELF ─────────────────────────────────
 *
 * The corpus only ever played a fresh cultivator: no method, empty pouch, no
 * sword, nobody nearby crossing, no steward. A large share of the 376 was the
 * engine correctly saying "you do not have one" to a character constructed
 * never to have one, which measures the fixture and not the game.
 *
 * So situations come in two classes and are reported apart:
 *
 *   LEAN       the original three, unchanged, in the original worlds, so every
 *              figure already published stays comparable.
 *   FURNISHED  the same corpus against a cultivator the ordinary preconditions
 *              are met for - somebody standing here with a name, things in the
 *              pouch, names that can be pointed at, a rung on the ladder.
 *
 * A penniless beginner is a real state and its refusals are worth measuring.
 * It is just not the whole game.
 *
 * Furnishing goes through ADMIN, which is the surface built to set a
 * precondition and assert no outcome, and an ADMIN line travels the same road
 * as anything else typed - so it arranges the situation without opening a
 * second door into the engine. What it will NOT do is grant a
 * cultivation method: that is a precondition and admin refuses to force one, so
 * `cultivate`'s gate is unreachable by this corpus by construction. Its 100% is
 * a fact about the fixture, and the gate itself is correct.
 *
 * WHAT IS ARRANGED AND WHAT IS PLAYED, in order of preference:
 *
 *   the world side    seeded. Who is standing here, who can be named. That is
 *                     a world draw rather than anything the player achieved.
 *   the rung          admin. The climb has its own tests and this probe is not
 *                     measuring it - it measures how a sentence is read by
 *                     somebody who has already climbed.
 *   player things     played, where the played path is a handful of turns: the
 *                     manual, the stones, the house roll. A hand-written row
 *                     for one of those freezes today's assumption about what
 *                     that path writes, and the old "on a roll" fixture is what
 *                     that looks like when it has drifted.
 *
 * ── EVERY SENTENCE IS MEASURED AGAINST THE SAME ARRANGED STATE ───────────
 *
 * This probe used to open ONE run per scenario and play the whole corpus down
 * it, so turn N inherited turns 1..N-1: days spent, stones gone, items bought,
 * and a fight left standing, which read "I stand guard while she crosses" as a
 * guard round in 3 of 6 situations rather than reaching the guard verb. The
 * numbers moved if the corpus was reordered, which makes them a property of the
 * list rather than of the game.
 *
 * So the arrangement is played ONCE, its rows are captured, and every sentence
 * runs against a restored copy of them behind a freshly constructed
 * `GameService`. Two halves, because state lives in two places: the rows are in
 * SQLite, and the turn-scoped memory - the world handle, a fight that has not
 * ended, what the last turn named, which is what `more` and `the second one`
 * resolve against - is in the service object, and a new one has none of it.
 *
 * Rows rather than a fixture: what is captured is whatever the played
 * arrangement actually produced, so a path that starts writing a different
 * column is captured with it, and there is nothing here that can drift from it.
 *
 * Measured: 8ms to capture 5,727 rows across 105 tables, 48ms to put them back
 * and construct a service, against 0.4s to 4.3s to replay an arrangement. Over
 * the whole matrix that is 2.6 minutes of restoring against about 86 minutes of
 * replaying, on top of the corpus turns either way.
 *
 * `tests/web/the-probe-reads-the-same-in-any-order.test.ts` holds the property:
 * the corpus in its own order and shuffled must agree sentence by sentence. Run
 * over the whole 124-sentence corpus rather than the test's slice, 124 of 124
 * agree, in the richest scenario and in the back-reference one.
 *
 * ── AND IT ONLY EVER MEASURED ONE HEIGHT ─────────────────────────────────
 *
 * Every scenario was a Qi Condensation beginner, so a refusal that only happens
 * at Nascent Soul was invisible and so was a verb that only becomes reachable
 * up there.
 *
 * The bands are NOT redeclared here. `theRegisterAtThisHeight` is the one
 * implementation of the cuts and this probe asks it which band an ordinal is
 * in and which ordinal is the floor of a band, so a boundary moved there moves
 * here and cannot be moved here at all. One vocabulary across the prose and the
 * measurement, which is the whole point of borrowing it.
 *
 * ── WHAT IT READ ────────────────────────────────────────────────────────
 *
 *   3472 turns, 14 scenarios x 2 pinned worlds, across the three bands
 *     ok:false, the old figure       1740   50.1%
 *     the engine could not answer     656   18.9%
 *     it answered with a refusal     1084   31.2%
 *         acted, world said no        140    4.0%
 *         a precondition unmet        944   27.2%
 *
 *   per band                 turns   blank    world    gate
 *     at the bottom           2480   18.7%    4.0%   27.1%
 *     through the middle       496   19.4%    4.0%   27.4%
 *     at the top               496   19.4%    4.0%   27.4%
 *
 * WHAT THE HEIGHT CHANGED: one verb, in one direction. `cultivate` refuses 80%
 * at the bottom and 100% in both bands above it, because the only method a
 * player can buy in this corpus comes off a village stall and does not carry
 * anyone past Core Formation. Every other verb reached at more than one height
 * has the same refusal rate at all three, to the turn. **The game reads the
 * same at every height; what changes is what the ground has to sell.**
 *
 * AND THE ORDER DEPENDENCE WAS WORTH 6.6 POINTS. The same nine scenarios read
 * 43.8% ok:false and 15.3% blank when the corpus was played down one run;
 * restoring the arranged state between sentences makes them 50.4% and 19.4%.
 * The whole of the blank increase is bare back-references: `the second one` used
 * to land on whatever the sentence before it happened to list. Given a listing
 * of their own to point into, 8 of the 10 resolve, and the two that do not are
 * `more` and `why`, which were the only two that ever failed.
 *
 * The blank figure is **24 distinct sentences** repeated across every scenario -
 * not a long tail. Arson, vandalism, causing a scene, showing off, climbing,
 * sparing somebody, standing between two people, teaching somebody a form.
 * Verbs that do not exist, rather than verbs that misread.
 *
 * And the comparison the single figure could not make:
 *
 *   cultivate     100% given a beginner -> 0% given a method. A gate, and the
 *                 precondition was the whole of it.
 *   destinations  100% -> 0% everywhere, once an empty perception stopped
 *                 filing as a refusal.
 *   give/request  80% and 100% in EVERY scenario including the furnished ones,
 *                 at every height. Not the fixture. What is left is one defect
 *                 wearing three hats: a pronoun (`he`, `his`, `it`) does not
 *                 resolve to somebody standing here, so `I press the pill into
 *                 his hand` refuses for want of a recipient while six people
 *                 are listed in the same sentence.
 *   guard         100% everywhere, and the arrangement is the reason: the
 *                 person `spawn_encounter` puts here is a stored row and
 *                 `guard` wants a world record. The verb is fine; nothing in
 *                 this corpus arranges the state it needs.
 *
 * ── KNOWN, AND NOT FIXED HERE ────────────────────────────────────────────
 *
 * `ok: <count> > 0` appears on five more calls in `turn-engine.ts` (6282, 6334,
 * 6484, 6515, 9103). Each scores an answer by how many rows came back, so an
 * honest "none" files as a refusal - the same defect that put `destinations` at
 * 6 of 6 refused for a read that had answered in full. They are in a contended
 * file and belong to whoever owns it.
 *
 *   npx tsx scripts/probe-what-a-refusal-is-still-for.ts [out.json]
 */

import type Database from 'better-sqlite3';

import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import { REGISTER_BANDS, theRegisterAtThisHeight, type RegisterBand } from '../src/web/prompt.js';
import { GameService } from '../src/web/turn-engine.js';
import { resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { makeGameInWorld, type Harness } from '../tests/web/harness.js';
import { SENTENCES } from './sentences-a-player-would-actually-type.js';

/** Sentences that are nothing but a reference to what the last turn listed. */
const NOTHING_BUT_A_REFERENCE = [
    'the second one', 'that one', 'the first one', 'I take it', 'the intake',
    'more', 'why', 'the last one', 'I take the first one', 'that'
];

/** Things said straight at a person, which is the verb that refused most. */
const AT_A_PERSON = [
    'I talk to the nearest cultivator',
    'I ask him about the sect',
    'I greet the elder',
    'I introduce myself',
    'I follow him',
    'I ask what he wants',
    'I ask around about work',
    'I have a word with the steward',
    'I bow to him',
    'I tell him my name'
];

export const SAID: readonly string[] = [
    ...SENTENCES.map(s => s.text),
    ...NOTHING_BUT_A_REFERENCE,
    ...AT_A_PERSON
];

export const WORLDS = ['refusal-audit-a', 'refusal-audit-b'] as const;

/**
 * What the turn was, once the three unlike outcomes under `ok: false` are told
 * apart. See the banner.
 */
export type Verdict = 'answered' | 'not_understood' | 'world_refused' | 'precondition';

/**
 * The lowest rung in a band, which is where that band is measured.
 *
 * Found by asking rather than written down: any other rung inside a band is a
 * number somebody picked, and writing the floor down here would be a second
 * copy of a boundary `theRegisterAtThisHeight` already owns.
 */
export function floorOf(band: RegisterBand): number {
    for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
        if (theRegisterAtThisHeight(ordinal) === band) return ordinal;
    }
    throw new Error(`No rung on the ladder is in the band "${band}".`);
}

/** "At the bottom", for a table column. The full band name is a sentence. */
const shortly = (band: RegisterBand): string => band.split(':')[0];

export interface Row {
    said: string;
    situation: string;
    /** LEAN or FURNISHED. Reported apart, never pooled into the headline. */
    fixture: Fixture;
    band: RegisterBand;
    world: string;
    verb: string;
    intent?: string;
    /** The old figure: `ok: false` on any non-narrator call. Kept comparable. */
    refused: boolean;
    verdict: Verdict;
    /** Days the turn spent. Non-zero is the engine having acted. */
    spent: number;
    why: string;
}

type Fixture = 'lean' | 'furnished';

/** What a turn looks like coming back, as much of it as an arrangement reads. */
type Act = (said: string) => Promise<{ narration?: string }>;

/**
 * A GIVEN: one arrangement, played once before the corpus runs against it.
 *
 * Written as code rather than as a table of strings because several
 * arrangements have to READ the world to arrange it - which manual this stall
 * carries, who is actually standing here - and a fixed sentence that names the
 * wrong book is an arrangement that silently does nothing. `tests/dsl/` is two
 * ordinary vitest files and there is no given/when/then framework in this repo,
 * so these are plain helpers named so the scenario is legible.
 *
 * ARRANGING IS FAST AND MAY USE ADMIN. PROVING IT REACHABLE IS SLOW AND MAY
 * NOT. The second half is `tests/web/a-precondition-the-probe-arranges-is-one-
 * a-player-can-reach.test.ts`, which gets to each of these states by typing
 * sentences from a fresh run with no admin verb anywhere. An arrangement that
 * no player can reach measures a state nobody occupies, and hides a gameplay
 * defect behind a tidy number - so the two are kept apart and both are
 * required. The exception is the rung: nothing can play a cultivator to Nascent
 * Soul inside a test, and the climb has its own suite, so `mid` and `late` are
 * arranged with no played sibling here.
 */
export interface Scenario {
    /** Reads as a GIVEN: "given a cultivator practising a method". */
    given: string;
    fixture: Fixture;
    band: RegisterBand;
    arrange(act: Act): Promise<void>;
    /**
     * One turn played on the SAME service as the sentence, immediately before
     * it, for an arrangement whose effect is not in the rows.
     *
     * MEASURED: `the second one` resolves against what the last turn listed,
     * and that list is a field on the service rather than a row - so restoring
     * the database and building a fresh service gives the corpus's ten bare
     * back-references nothing at all to point at, and all ten file as blank
     * wherever they sit. Playing the listing in the arrangement does not help
     * for the same reason: it happened on the arranging service.
     *
     * It is still order-independent, because it is the same fixed turn before
     * every sentence rather than whatever the corpus put there.
     */
    leadIn?: string;
    /**
     * Set where the arrangement is known NOT to hold in full, with what is
     * missing. A scenario measured in this state is still worth measuring; it
     * is not worth believing without the caveat.
     */
    caveat?: string;
}

/** Every ADMIN line here arranges a precondition and asserts no outcome. */
const say = async (act: Act, ...lines: string[]): Promise<void> => {
    for (const line of lines) {
        try { await act(line); } catch { /* an arrangement that fails is still a state */ }
    }
};

/**
 * Buy a book off the stall here and begin it, by playing.
 *
 * The name is read off what the stall actually lists rather than typed in,
 * because which manual a ground carries is a property of the ground.
 * `grant_item` cannot do this job at all - a manual is a knowledge row with a
 * provenance, not a counted pouch row - and admin correctly refuses to force a
 * method, so this arrangement is played whether or not admin is available.
 */
async function practisingAMethod(act: Act): Promise<void> {
    const stall = (await act('I buy a manual')).narration ?? '';
    const book = /^\s*([A-Z][^,\n]{4,48}Manual|[A-Z][^,\n]{4,48}Scripture)\b/m.exec(stall)?.[1];
    if (!book) return;
    await say(act, `I buy the ${book.trim()}`, `I learn the ${book.trim()}`);
}

/** Ask a house that admits at this standing to take you, by playing. */
async function onAHouseRoll(act: Act): Promise<void> {
    const houses = (await act('what sects are there')).narration ?? '';
    // The read names the one that would take them, and that sentence is where
    // the name is taken from: any name the game prints is one it must accept.
    const willing = /\b([A-Z][A-Za-z' ]{3,40}?) takes people at your standing/.exec(houses)?.[1];
    // "I join the nearest sect" does NOT join - it comes back with the listing
    // and leaves `sectId` null. See the banner.
    await say(act, `I ask to join the ${(willing ?? 'nearest sect').trim()}`);
}

const A_PERSON_STANDING_HERE = 'ADMIN spawn_encounter name=Shen Liefeng ordinal=10 disposition=friendly';
const NAMES_THAT_CAN_BE_POINTED_AT = 'ADMIN grant_knowledge kind=place';
// A pill or a herb needs `name=`; only an artifact is rated on the realm
// ladder. It is NOT a purse - measured, the 30 stones a run opens with are
// still 30 afterwards, and what the grant adds is list value in the pouch.
const THINGS_IN_THE_POUCH = [
    'ADMIN grant_item kind=pill name=Qi Gathering Pill quantity=3',
    'ADMIN grant_item kind=artifact ordinal=8'
];

/** Everything the furnished scenarios furnish, so a band variant is one line. */
async function allOfIt(act: Act): Promise<void> {
    await say(act, NAMES_THAT_CAN_BE_POINTED_AT, A_PERSON_STANDING_HERE, ...THINGS_IN_THE_POUCH);
    await practisingAMethod(act);
    await onAHouseRoll(act);
}

const [BOTTOM, MIDDLE, TOP] = REGISTER_BANDS;

const atTheFloorOf = (band: RegisterBand): string => `ADMIN set_realm ordinal=${floorOf(band)}`;

/** The rung is arranged and nothing here plays it. See the banner. */
const NOTHING_PLAYS_THE_CLIMB =
    'the rung is arranged; nothing here reaches it by playing, and the climb has its own tests';

export const SCENARIOS: readonly Scenario[] = [
    // ── LEAN. Unchanged, in the same worlds, at the same height, so every
    // figure reported off this probe before today stays comparable. The three
    // of them are the 744-turn baseline.
    {
        given: 'a beginner with nothing', fixture: 'lean', band: BOTTOM,
        arrange: async () => { /* a fresh run is the arrangement */ }
    },
    {
        given: 'a beginner who has just read a listing', fixture: 'lean', band: BOTTOM,
        arrange: act => say(act, 'what do I know', 'I look at the wall')
    },
    {
        given: 'a beginner who tried to join a house', fixture: 'lean', band: BOTTOM,
        arrange: act => say(act, 'what sects are there', 'I join the nearest sect'),
        // AND THE OLD SITUATION WAS NAMED FOR A STATE IT NEVER REACHED. This
        // was called "on a roll". Measured: "I join the nearest sect" routes to
        // `sect`, comes back with the LISTING, and leaves `sectId` null - so
        // every figure ever reported from this situation was measured on a
        // cultivator who had joined nothing.
        caveat: '"I join the nearest sect" does not join; sectId stays null'
    },

    // ── FURNISHED. One precondition each, so a verb that comes right can be
    // attributed to the thing that was missing.
    {
        given: 'a cultivator practising a method', fixture: 'furnished', band: BOTTOM,
        arrange: practisingAMethod
    },
    {
        given: 'a pouch with things in it and a purse', fixture: 'furnished', band: BOTTOM,
        arrange: act => say(act, ...THINGS_IN_THE_POUCH)
    },
    {
        given: 'somebody standing here the player can name', fixture: 'furnished', band: BOTTOM,
        arrange: act => say(act, A_PERSON_STANDING_HERE),
        // `spawn_encounter` writes a stored cultivator row and NOT a world
        // `NpcRecord`, so `guard` reaches this person and then refuses at
        // `guard.notAWorldRecord`. It is the right arrangement for `request`
        // and `give`, which only need somebody resolvable, and the wrong one
        // for `guard`.
        caveat: 'the spawned person is a stored row, not a world record'
    },
    {
        given: 'roads the player can name and set out for', fixture: 'furnished', band: BOTTOM,
        arrange: act => say(act, NAMES_THAT_CAN_BE_POINTED_AT)
    },
    {
        given: 'membership in a house, at a rank', fixture: 'furnished', band: BOTTOM,
        arrange: onAHouseRoll
    },
    {
        // A BARE BACK-REFERENCE NEEDS A TURN TO REFER BACK TO, AND RESETTING
        // TOOK THE LAST ONE AWAY. With the corpus played down one run, "the
        // second one" landed on whatever the sentence before it happened to
        // list, so the ten of them scored as answered by an accident of the
        // list. Under a reset they have nothing to point at and all ten file as
        // blank, which is the opposite error. The lead-in is the honest middle:
        // the same listing before every sentence, so a back-reference that
        // still fails here failed on its own merits.
        given: 'a listing the player can point back into', fixture: 'furnished', band: BOTTOM,
        arrange: async () => { /* the lead-in is the whole of it */ },
        leadIn: 'what sects are there'
    },
    {
        given: 'all of it at once', fixture: 'furnished', band: BOTTOM,
        arrange: allOfIt
    },

    // ── THE OTHER TWO HEIGHTS. Bare and furnished at each, so the bottom
    // band's own two poles are what they are compared against and a difference
    // is attributable to the rung rather than to the furniture.
    //
    // FURNISHED rather than LEAN even where nothing but the rung is arranged:
    // the rung IS an arrangement, and LEAN has to keep meaning the three
    // situations the published baseline was measured on.
    {
        given: 'nothing but the rung, through the middle', fixture: 'furnished', band: MIDDLE,
        arrange: act => say(act, atTheFloorOf(MIDDLE)),
        caveat: NOTHING_PLAYS_THE_CLIMB
    },
    {
        given: 'all of it at once, through the middle', fixture: 'furnished', band: MIDDLE,
        arrange: async act => { await say(act, atTheFloorOf(MIDDLE)); await allOfIt(act); },
        caveat: NOTHING_PLAYS_THE_CLIMB
    },
    {
        given: 'nothing but the rung, at the top', fixture: 'furnished', band: TOP,
        arrange: act => say(act, atTheFloorOf(TOP)),
        caveat: NOTHING_PLAYS_THE_CLIMB
    },
    {
        given: 'all of it at once, at the top', fixture: 'furnished', band: TOP,
        arrange: async act => { await say(act, atTheFloorOf(TOP)); await allOfIt(act); },
        caveat: NOTHING_PLAYS_THE_CLIMB
    }
];

interface Call { name: string; action: string; ok: boolean; summary: string }

/**
 * Whether the call that refused is the reading layer rather than a handler.
 *
 * A blank look never reaches a verb: `parseIntent` is the whole of what said
 * no. Anything named `engine.<handler>` or `<verb>.<something>` was reached,
 * which means the sentence was understood well enough to route.
 */
function isTheReadingLayer(call: Call): boolean {
    return /parseIntent/i.test(call.name) || call.action === 'unclear';
}

function verdictFor(declined: readonly Call[], spent: number): Verdict {
    if (declined.length === 0) return 'answered';
    if (declined.some(isTheReadingLayer)) return 'not_understood';
    return spent > 0 ? 'world_refused' : 'precondition';
}

/**
 * The arranged state, put back before every sentence.
 *
 * Both halves or neither. The rows come back from a captured copy; the
 * turn-scoped memory comes back by throwing the service away, because a
 * standing fight, the world handle and what the last turn named are fields on
 * it and a new one has none of them. Restoring only the rows leaves `more` and
 * `the second one` reading whatever the sentence before them listed, which is
 * the order dependence this exists to remove.
 */
interface Arranged {
    /** A service with no memory of any turn, over the arranged rows. */
    fresh(): GameService;
}

function capture(harness: Harness, seed: string): Arranged {
    const db: Database.Database = harness.db;
    const tables = (db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[]).map(row => row.name);

    const held = new Map<string, Record<string, unknown>[]>();
    for (const table of tables) {
        held.set(table, db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]);
    }

    const putBack = db.transaction(() => {
        for (const table of tables) {
            db.prepare(`DELETE FROM "${table}"`).run();
            const rows = held.get(table)!;
            if (rows.length === 0) continue;
            const columns = Object.keys(rows[0]);
            const insert = db.prepare(
                `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) `
                + `VALUES (${columns.map(c => `@${c}`).join(', ')})`
            );
            for (const row of rows) insert.run(row);
        }
    });

    return {
        fresh(): GameService {
            // Off for the restore: the tables go back in `sqlite_master` order,
            // which is creation order and not dependency order.
            db.pragma('foreign_keys = OFF');
            putBack();
            db.pragma('foreign_keys = ON');
            // The world layer's caches are process-global and keyed by world
            // id, so without this the next turn reads a WorldState built from
            // rows that are no longer there.
            resetCultivationWorlds();
            return new GameService({
                db,
                narrator: harness.narrator,
                worldEnabled: true,
                adminMode: true,
                seedFactory: () => seed,
                idFactory: () => `cultivator-${seed}`
            });
        }
    };
}

/** Admin is read off the process, and this probe must not leave it on. */
async function withAdminMode<T>(body: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await body();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/**
 * One scenario, one world, every sentence in `said` against the same arranged
 * state.
 *
 * Exported because the order-independence property is held by a test rather
 * than checked once: the same call with a shuffled `said` must come back
 * agreeing sentence for sentence.
 */
export async function measureAgainst(
    scenario: Scenario, worldSeed: string, said: readonly string[]
): Promise<Row[]> {
    return withAdminMode(async () => {
        const seed = `${worldSeed}-${scenario.given}`;
        // EVERY WORLD IS PINNED. An unpinned `worldEnabled` game mints one from
        // `randomUUID()`, so who is standing here and what the stall carries
        // differ every run - which is the arrangement quietly becoming a
        // different arrangement, and reads exactly like flake.
        const harness = await makeGameInWorld({ seed, worldSeed, adminMode: true });
        await harness.game.newRun('Prober');
        try {
            await scenario.arrange(line => harness.game.act(line));
        } catch { /* an arrangement that fails is still a state worth measuring */ }

        const arranged = capture(harness, seed);
        const rows: Row[] = [];

        for (const sentence of said) {
            const game = arranged.fresh();
            if (scenario.leadIn !== undefined) {
                try { await game.act(scenario.leadIn); } catch { /* still a state */ }
            }
            const clock = (): number => {
                try { return game.state().run.elapsedDays; } catch { return 0; }
            };
            // After the lead-in, so a day it spends is not charged to the
            // sentence and read as the world having refused.
            const before = clock();

            let verb = 'threw';
            let intent: string | undefined;
            let refused = true;
            let verdict: Verdict = 'not_understood';
            let spent = 0;
            let why = 'threw';
            try {
                const turn = await game.act(sentence);
                const plan = turn.toolCalls.find(c => c.name === 'narrator.plan');
                verb = plan?.action ?? 'none';
                intent = /intent=([a-z_]+)/.exec(plan?.summary ?? '')?.[1];
                const declined = turn.toolCalls.filter(
                    call => !call.ok && !call.name.startsWith('narrator.')
                ) as Call[];
                refused = declined.length > 0;
                why = declined.map(c => `${c.name}/${c.action}`).join(' ');
                spent = Math.max(0, clock() - before);
                verdict = verdictFor(declined, spent);
            } catch (err) {
                // A death no longer poisons the rest of the corpus: the next
                // sentence gets the arranged rows back. It used to, and the
                // whole tail then read as a reading defect.
                why = `threw: ${(err as Error).message}`;
            }

            rows.push({
                said: sentence, situation: scenario.given, fixture: scenario.fixture,
                band: scenario.band, world: worldSeed, verb, intent, refused, verdict,
                spent, why
            });
        }

        harness.db.close();
        return rows;
    });
}

async function main(): Promise<void> {
    const rows: Row[] = [];
    for (const worldSeed of WORLDS) {
        for (const scenario of SCENARIOS) {
            rows.push(...await measureAgainst(scenario, worldSeed, SAID));
        }
    }

    report(rows);

    const out = process.argv[2];
    if (out) {
        const { writeFileSync } = await import('node:fs');
        const total = rows.length;
        const refused = rows.filter(r => r.refused).length;
        writeFileSync(out, JSON.stringify({ total, refused, rows }, null, 1));
        console.log(`\nwrote ${out}`);
    }
}

/** The old single figure, plus the split it was hiding. */
function headline(label: string, rows: readonly Row[]): void {
    if (rows.length === 0) return;
    const total = rows.length;
    const count = (v: Verdict) => rows.filter(r => r.verdict === v).length;
    const refused = rows.filter(r => r.refused).length;
    const blank = count('not_understood');
    const world = count('world_refused');
    const gate = count('precondition');
    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

    console.log(`\n${label}  ${total} turns`);
    console.log(`  ok:false, the old figure          ${String(refused).padStart(4)}  ${pct(refused)}`);
    console.log(`  the engine could not answer       ${String(blank).padStart(4)}  ${pct(blank)}`);
    console.log(`  it answered with a refusal        ${String(world + gate).padStart(4)}  ${pct(world + gate)}`);
    console.log(`      acted, and the world said no  ${String(world).padStart(4)}  ${pct(world)}`);
    console.log(`      a precondition was not met    ${String(gate).padStart(4)}  ${pct(gate)}`);
}

/**
 * What only refuses up there, and what only answers up there.
 *
 * A verb that is fine for a beginner and refuses an elder is a finding, and so
 * is one that a beginner cannot reach at all. Neither is visible in a figure
 * pooled over heights, which is what this probe reported until today.
 */
function byHeight(rows: readonly Row[]): void {
    const verbs = [...new Set(rows.map(r => r.verb))].sort();
    const rate = (band: RegisterBand, verb: string): number | null => {
        const got = rows.filter(r => r.band === band && r.verb === verb);
        return got.length === 0 ? null : got.filter(r => r.refused).length / got.length;
    };
    const show = (n: number | null) => (n === null ? '     -' : `${(n * 100).toFixed(0)}%`.padStart(6));

    // Every verb reached at more than one height, not only the movers: a row of
    // three identical figures is the answer to "does this read differently up
    // there", and hiding it behind a threshold is how the first cut of this
    // table came back empty and said nothing.
    console.log('\nrefusal rate by verb and band');
    console.log('verb                 bottom middle    top   chosen   what moved');
    for (const verb of verbs) {
        const found = REGISTER_BANDS.map(band => rate(band, verb));
        const known = found.filter((n): n is number => n !== null);
        if (known.length < 2) continue;
        const chosen = rows.filter(r => r.verb === verb).length;
        const moved = Math.max(...known) - Math.min(...known) < 0.05
            ? 'the same at every height'
            : known[known.length - 1] > known[0]
                ? 'REFUSES HIGHER UP'
                : 'answers higher up';
        console.log(
            `${verb.padEnd(20)} ${found.map(show).join(' ')} `
            + `${String(chosen).padStart(8)}   ${moved}`
        );
    }
}

/**
 * The comparison the old metric could not make.
 *
 * A verb refusing 100% given a beginner and 0% given the thing it needs is a
 * healthy gate. One refusing 100% in both is a bug, and this table is the only
 * place the difference shows.
 */
function gateOrBug(rows: readonly Row[]): void {
    const lean = rows.filter(r => r.fixture === 'lean');
    const rich = rows.filter(r => r.fixture === 'furnished');
    const verbs = [...new Set(rows.map(r => r.verb))];

    console.log('\nlean vs furnished, by verb - a gate falls, a bug does not');
    console.log('verb                 lean chosen  refused   furnished chosen  refused   verdict');
    const rate = (got: Row[]) => got.length === 0
        ? null
        : got.filter(r => r.refused).length / got.length;
    for (const verb of verbs) {
        const a = lean.filter(r => r.verb === verb);
        const b = rich.filter(r => r.verb === verb);
        const ra = rate(a);
        const rb = rate(b);
        if (ra === null || rb === null) continue;
        // Only worth a line where the lean arm actually refuses.
        if (ra < 0.5) continue;
        const verdict = rb <= 0.2
            ? 'GATE - the precondition was the whole of it'
            : rb < ra - 0.2
                ? 'gate, partly'
                : 'STILL REFUSING - the fixture was not the reason';
        console.log(
            `${verb.padEnd(20)} ${String(a.length).padStart(11)} `
            + `${`${(ra * 100).toFixed(0)}%`.padStart(8)}   ${String(b.length).padStart(16)} `
            + `${`${(rb * 100).toFixed(0)}%`.padStart(8)}   ${verdict}`
        );
    }
}

function report(rows: readonly Row[]): void {
    headline('WHOLE CORPUS', rows);
    headline('LEAN - a beginner with nothing', rows.filter(r => r.fixture === 'lean'));
    headline('FURNISHED - preconditions arranged', rows.filter(r => r.fixture === 'furnished'));

    for (const band of REGISTER_BANDS) {
        headline(`${band}  (measured at ordinal ${floorOf(band)})`, rows.filter(r => r.band === band));
    }

    console.log('\nby scenario');
    for (const scenario of SCENARIOS) {
        const got = rows.filter(r => r.situation === scenario.given);
        if (got.length === 0) continue;
        const n = (v: Verdict) => got.filter(r => r.verdict === v).length;
        console.log(
            `  [${shortly(scenario.band).padEnd(18)}] given ${scenario.given.padEnd(44)} ${String(got.length).padStart(4)} turns  `
            + `blank ${String(n('not_understood')).padStart(4)}  `
            + `world ${String(n('world_refused')).padStart(4)}  `
            + `gate ${String(n('precondition')).padStart(4)}`
            + (scenario.caveat ? `\n        caveat: ${scenario.caveat}` : '')
        );
    }

    gateOrBug(rows);
    byHeight(rows);

    console.log('\nby verb, whole corpus');
    console.log('verb                 chosen  ok:f  blank  world   gate');
    const byVerb = new Map<string, Row[]>();
    for (const row of rows) byVerb.set(row.verb, [...(byVerb.get(row.verb) ?? []), row]);
    const ordered = [...byVerb].sort(
        (a, b) => b[1].filter(r => r.refused).length - a[1].filter(r => r.refused).length
    );
    for (const [verb, got] of ordered) {
        const n = (v: Verdict) => got.filter(r => r.verdict === v).length;
        console.log(
            `${verb.padEnd(20)} ${String(got.length).padStart(6)} `
            + `${String(got.filter(r => r.refused).length).padStart(5)} `
            + `${String(n('not_understood')).padStart(6)} `
            + `${String(n('world_refused')).padStart(6)} `
            + `${String(n('precondition')).padStart(6)}`
        );
    }

    // WHAT THE GAME STILL CANNOT READ, which is the list the directive is
    // actually about. Ordered by how often, because a sentence that fails in
    // every situation is worth more than one that fails in a corner.
    const blank = new Map<string, number>();
    for (const row of rows) {
        if (row.verdict !== 'not_understood') continue;
        blank.set(row.said, (blank.get(row.said) ?? 0) + 1);
    }
    console.log(`\nsentences the engine could not answer (${blank.size} distinct)`);
    for (const [said, n] of [...blank].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
        console.log(`  x${String(n).padStart(3)}  ${said}`);
    }
}

// Imported by the order-independence test, which wants the machinery and not
// the run.
if (process.argv[1] !== undefined && /probe-what-a-refusal-is-still-for/.test(process.argv[1])) {
    await main();
}
