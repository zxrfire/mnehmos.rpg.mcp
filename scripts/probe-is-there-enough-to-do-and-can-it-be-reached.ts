/**
 * Whether a square has anything in it, and whether what it advertises can be had.
 *
 * The refusal probe measures whether the engine UNDERSTANDS a sentence. This
 * one measures the other two halves of the design owner's brief - *that the
 * things I want to do are reachable*, and *that the world has enough to do* -
 * neither of which had a number against it.
 *
 * An instrument, not a test: no model, no assertions, and the figures move when
 * the world does.
 *
 *   npx tsx scripts/probe-is-there-enough-to-do-and-can-it-be-reached.ts [out.json]
 *
 * ── WHAT AN ACT IS, AND WHY READS ARE NOT ONE ────────────────────────────
 *
 * `whatIsWorthDoingStandingHere` is the engine's own account of what is live
 * for somebody standing here, and every row carries the sentence to type and
 * the verb it routes to. An act is a row whose verb is NOT in
 * `READ_ONLY_ACTIONS` - the list `action-set.ts` already keeps of the verbs
 * that pass no time and change nothing. It is not redeclared here.
 *
 * A square whose only act is `cultivate` is the failure this is looking for: a
 * player can sit down anywhere, so sitting down is not something the PLACE
 * offers.
 *
 * ── AND A BOARD WITH THREE DUTIES ON IT IS THREE THINGS, NOT ONE ─────────
 *
 * The affordance list is a menu of KINDS. "what duties are there" is one row
 * whether the board holds six errands or none, so counting rows alone reports
 * a full board and an empty one as the same square. So the advertisements are
 * expanded: every duty on the board, every bill on the wall, every book on the
 * stall, every thing somebody here would part with, every road within reach.
 *
 * ── REACHABLE MEANS THE ENGINE ITSELF WILL HONOUR IT ─────────────────────
 *
 * Two checks, and the first is the one that matters:
 *
 *   THE SENTENCE COMES BACK    every affordance's `say` is typed at the engine
 *                              verbatim, against the same arranged state. The
 *                              engine printed it as a thing to do; a turn that
 *                              comes back `ok: false` is the engine advertising
 *                              something it will not honour.
 *   THE BAR IS ONE THEY CLEAR  each expanded advertisement carries its own gate
 *                              - an admission rung, a price, a road that either
 *                              exists or does not - and is scored against the
 *                              cultivator reading it.
 *
 * ── A SPAN OF TIME IS A PLACE TOO ────────────────────────────────────────
 *
 * A year that produces nothing is the same emptiness as a square with nothing
 * in it, and seclusion is how a player spends most of their life. So the third
 * sweep sits a cultivator down for one, five and twenty years and counts what
 * reached them while they were under. The digest is the channel
 * (`reportFromDigest` stamps each line `Year N:`), and an empty one says so in
 * the inspector rather than silently.
 *
 * ── WHAT IS ARRANGED AND WHAT IS READ ────────────────────────────────────
 *
 * The rung and the place are arranged with ADMIN, which is the surface built
 * to set a precondition and assert no outcome, and an ADMIN line travels the
 * same road as anything else typed. The climb has its own tests and this probe
 * is not measuring it.
 *
 * The bands are NOT redeclared. `floorOf` is the refusal probe's read of
 * `theRegisterAtThisHeight`, and it is imported rather than copied so a
 * boundary moved there moves here.
 *
 * EVERY WORLD IS PINNED. An unpinned `worldEnabled` run mints a world from
 * `randomUUID()`, so who is standing here and what they are holding differ
 * every run, and it reads exactly like pollution.
 *
 * AND EVERY PLACE IS MEASURED AGAINST THE SAME ARRANGED STATE. The places are
 * a set, not a sequence: the arrangement is played once per world and band, its
 * rows are captured, and each place is read against a restored copy behind a
 * freshly constructed service. Without that, a duty taken at the fourth place
 * is on the ledger at the fifth.
 *
 * ── WHAT IT READ ────────────────────────────────────────────────────────
 *
 * 222 squares: 37 places x 3 bands x 2 pinned worlds, about 100 minutes.
 *
 *   ACTS LIVE IN A SQUARE      acts  median  worst   reads
 *     at the bottom             4.0     4      3      4.0
 *     through the middle        3.3     3      2      4.7
 *     at the top                3.3     3      3      4.7
 *
 * It goes DOWN with the rung, and above the bottom band there are more things
 * to LOOK at than to do. It is also flat across the map: a city offers 4.0 at
 * the bottom and a hamlet offers 4.0.
 *
 * SEVEN VERBS ARE EVER LIVE, out of the whole action set:
 *
 *     site  100%   move  99%   buy  65%   sect  48%
 *     cultivate  23%   passage  11%   request  1%   interact  0.4%
 *
 * The two that are live everywhere are `site` and `move`, which are both ways
 * of LEAVING. Nothing else is offered in even two thirds of squares.
 *
 *   ADVERTISED AND OUT OF REACH      bottom   middle      top
 *     duties on a board               100%       0%   none advertised at all
 *     intakes on a wall                70%     100%     100%
 *     arts on a stall                 100%       0%       0%
 *     goods somebody would sell        72%       1%       0%
 *     dao ground within reach           0%       2%       6%
 *
 * THE ENGINE'S OWN SENTENCES, TYPED BACK AT IT: 780 offered, 127 refused,
 * 16.3%. Two sentences are the whole of it - `I go into <site>` refused 74
 * times on `gate_age_and_talent`, and `I cultivate for a year` refused 50 times
 * on `techniqueCeiling`.
 *
 *   WHAT A SPAN OF TIME PRODUCES      digest lines + events, per year
 *     at the bottom                     5.0, 3.6, 4.1  (1, 5, 20 years)
 *     through the middle                3.0, 1.8, 1.7
 *     at the top                        2.0, 2.0, 2.0
 *
 * And in the second world, at every band, the one-year sitting came back with
 * the inspector saying **nothing reached this cultivator and 166 events passed
 * unheard**. A year of a life, and the channel that carries the world to
 * somebody who was not looking delivered none of it.
 */

import type Database from 'better-sqlite3';

import { READ_ONLY_ACTIONS, type ActionName } from '../src/web/action-set.js';
import { REGIONS } from '../src/data/cultivation/regions/the-map.js';
import { REGISTER_BANDS, type RegisterBand } from '../src/web/prompt.js';
import { GameService } from '../src/web/turn-engine.js';
import { billsOnTheWall } from '../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import { manualsAStallCarries } from '../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { openDoorsInTheWorld, postingGroundOf, provinceOfPlace } from '../src/web/what-is-posted-on-the-wall-here.js';
import { readWhatIsOnOfferHere } from '../src/web/who-here-is-offering-something.js';
import { resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { sectBoardFor } from '../src/web/encounters.js';
import { situatedReads } from '../src/web/situated-reads.js';
import { makeGameInWorld, type Harness } from '../tests/web/harness.js';
import { floorOf } from './probe-what-a-refusal-is-still-for.js';

export const WORLDS = ['enough-to-do-a', 'enough-to-do-b'] as const;

/** Every place a player's `location` can be, which is what the map publishes. */
export const PLACES: readonly { name: string; kind: string; region: string }[] =
    REGIONS.flatMap(region => region.places.map(place => ({
        name: place.name,
        kind: place.kind,
        region: region.id
    })));

const isARead = (verb: string): boolean =>
    READ_ONLY_ACTIONS.includes(verb as ActionName);

/** What kind of thing the world is holding out. */
export type OfferKind = 'duty' | 'intake' | 'art' | 'goods' | 'road';

export interface Offer {
    kind: OfferKind;
    what: string;
    /** Whether the gate this thing carries is one this cultivator clears. */
    reachable: boolean;
    /** The gate, said plainly, whether or not it was cleared. */
    gate: string;
}

export interface Square {
    world: string;
    band: RegisterBand;
    ordinal: number;
    place: string;
    /** The map's own word for what kind of place this is. */
    kind: string;
    /** Affordance rows whose verb changes something. */
    acts: { say: string; routesTo: string; id: string }[];
    /** Affordance rows that only look. Counted apart, never pooled in. */
    reads: number;
    offers: Offer[];
    /** Acts whose own sentence the engine then refused. */
    refusedItsOwn: { say: string; why: string }[];
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

/** Restore the rows this was taken from, behind a service with no memory. */
type Restore = () => GameService;

/**
 * The arranged rows, put back before every place.
 *
 * Lifted whole from the refusal probe's `capture`, for the reason its banner
 * gives: the rows are in SQLite and the turn-scoped memory is on the service,
 * so both halves come back or neither does.
 *
 * Taken TWICE per band here, at two depths: once over the arrangement, which
 * every place is restored to, and again over the arrangement plus standing in
 * one place, which every sentence tried at that place is restored to. The
 * second is what keeps the sentences a set rather than a sequence without
 * replaying the walk to the square for each of them - measured, 8ms to take
 * and 50ms to put back, against three turns.
 */
function capture(harness: Harness, seed: string): Restore {
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

    return () => {
        // Off for the restore: the tables go back in creation order, which is
        // not dependency order.
        db.pragma('foreign_keys = OFF');
        putBack();
        db.pragma('foreign_keys = ON');
        resetCultivationWorlds();
        return new GameService({
            db,
            narrator: harness.narrator,
            worldEnabled: true,
            adminMode: true,
            seedFactory: () => seed,
            idFactory: () => `cultivator-${seed}`
        });
    };
}

/**
 * Put the cultivator in a place, and load the world they are standing in.
 *
 * The second turn is not decoration. `act` answers an ADMIN line and RETURNS
 * before it reaches `this.atHand = await this.loadWorld()`, so a service whose
 * only turn has been an admin one is holding no world at all - and every read
 * that asks the world a question then answers honestly that there is nobody
 * here and no ground within reach. Measured at Green Water City: 0 things on
 * offer and 0 roads within reach off an admin-only service, against 3 and 23
 * for the same square once a `look` had been played. `look` is in
 * `READ_ONLY_ACTIONS` - it spends nothing and moves nobody - and it is what
 * somebody arriving does anyway.
 */
async function standIn(game: GameService, place: string): Promise<void> {
    for (const line of [`ADMIN set_location ${place}`, 'look']) {
        try { await game.act(line); } catch { /* a place that refuses is still a state */ }
    }
}

interface Call { name: string; action: string; ok: boolean }

/** A turn the engine declined, on any call that is not the narrator's. */
const declinedOn = (calls: readonly Call[]): Call[] =>
    calls.filter(call => !call.ok && !call.name.startsWith('narrator.'));

/**
 * Everything this square is holding out, expanded to one row per thing.
 *
 * Read straight off the producers rather than off the prose: every scene read
 * caps what it prints (six facts, four sellers, three bills), so counting the
 * rendered lines counts the cap.
 */
function whatIsAdvertised(game: GameService, ordinal: number, place: string): Offer[] {
    const anyGame = game as unknown as {
        repos: unknown; knowledge: unknown; atHand: unknown;
        currentRun(): { run: { seed: string; elapsedDays: number }; cultivator: unknown };
    };
    const { run, cultivator } = anyGame.currentRun();
    const holder = cultivator as { realmOrdinal: number; spiritStones: number; location: string | null };
    const out: Offer[] = [];

    // ── THE BOARD. Offers have already passed the house's own gate; refusals
    // are what is posted here and not on offer to this person, which is
    // advertised-and-out-of-reach by the engine's own word.
    const board = sectBoardFor(
        { repos: anyGame.repos, knowledge: anyGame.knowledge, world: anyGame.atHand } as never,
        cultivator as never
    );
    for (const offer of board.offers) {
        out.push({
            kind: 'duty', what: offer.entry.name, reachable: true,
            gate: `pitched at ${offer.terms.pitchOrdinal}, ${offer.terms.days} days, ${offer.terms.stones} stones`
        });
    }
    for (const refused of board.refusals) {
        out.push({ kind: 'duty', what: refused.name, reachable: false, gate: refused.reason });
    }

    // ── THE WALL. An intake carries two gates: a rung, and a date.
    //
    // A DATED THING IS REACHABLE WHEN ITS DATE HOLDS STILL. Every bill is
    // always in the future by construction, so scoring "is it open today"
    // scores the construction and reports 0% forever. What a player can
    // actually do with a date is walk toward it - `datedThingsHere` publishes
    // every bill as a thing to WAIT for - so the question is whether the day is
    // the same day when they get there. Read at today and at a week from today,
    // and a bill that has named two different days is one nobody can reach.
    const onDay = Math.floor(run.elapsedDays);
    const wall = (day: number) => billsOnTheWall({
        field: openDoorsInTheWorld(),
        placeName: place,
        ground: postingGroundOf(place),
        placeProvinceId: provinceOfPlace(place),
        onDay: day,
        seed: run.seed
    });
    const today = wall(onDay);
    const inAWeek = new Map(wall(onDay + 7).map(bill => [bill.houseId, bill.opensOnDay]));
    for (const bill of today) {
        const later = inAWeek.get(bill.houseId);
        // Only while the paper is still advertising THAT intake: a bill whose
        // day falls inside the week has legitimately moved on to the next one.
        const held = bill.opensOnDay <= onDay + 7 || later === undefined
            || later === bill.opensOnDay;
        const clears = ordinal >= bill.admissionOrdinal;
        out.push({
            kind: 'intake',
            what: `${bill.houseName} takes from ${bill.takesFrom}`,
            reachable: held && clears,
            gate: !held
                ? `the day moves: ${bill.opensOnDay} today, ${later} in a week`
                : clears
                    ? `admits at ${bill.admissionOrdinal}, in ${bill.opensOnDay - onDay} days`
                    : `admits at ${bill.admissionOrdinal} and you stand at ${ordinal}`
        });
    }

    // ── THE STALL. A book the reader cannot open is not for them, and a book
    // whose ceiling is at or below where they already stand teaches them
    // nothing - both are advertised, and only one of them is a thing to do.
    for (const book of manualsAStallCarries()) {
        if (book.requiredOrdinal > ordinal) continue;
        const cap = book.cap ?? null;
        out.push({
            kind: 'art', what: book.name,
            reachable: cap === null || cap > ordinal,
            gate: cap === null ? 'no ceiling' : `carries to ${cap}`
        });
    }

    // ── WHAT PEOPLE STANDING HERE WOULD PART WITH.
    const trading = readWhatIsOnOfferHere(cultivator as never, anyGame.atHand as never);
    for (const offer of trading.offers) {
        out.push({
            kind: 'goods', what: offer.name,
            reachable: offer.usableFrom <= ordinal
                && offer.usefulUntil >= ordinal
                && offer.askStones <= holder.spiritStones,
            gate: `usable ${offer.usableFrom}-${offer.usefulUntil}, asks ${offer.askStones} `
                + `against ${holder.spiritStones}`
        });
    }

    // ── GROUND WITHIN REACH THAT TEACHES A ROAD. `shortBy` is the ground's own
    // statement of what this cultivator is missing; null means nothing.
    for (const ground of situatedReads.groundTheyCanPointAt.call(game as never, cultivator as never)) {
        out.push({
            kind: 'road', what: ground.name,
            reachable: ground.standing.shortBy === null,
            gate: ground.standing.shortBy ?? 'open'
        });
    }

    return out;
}

/**
 * One world, one band, every place read against the same arranged state.
 */
export async function measureAcross(
    worldSeed: string, band: RegisterBand, places: readonly typeof PLACES[number][]
): Promise<Square[]> {
    return withAdminMode(async () => {
        const ordinal = floorOf(band);
        const seed = `${worldSeed}-${band}`;
        const harness = await makeGameInWorld({ seed, worldSeed, adminMode: true });
        await harness.game.newRun('Prober');
        // The rung is arranged; the climb has its own tests. `grant_knowledge`
        // lifts the awareness gate so that a road out of reach is out of reach
        // for a reason about the ROAD rather than because nobody has mentioned
        // it - which is the refusal probe's question, not this one.
        for (const line of ['ADMIN set_realm ordinal=' + ordinal, 'ADMIN grant_knowledge kind=place']) {
            try { await harness.game.act(line); } catch { /* an arrangement that fails is a state */ }
        }

        const fresh = capture(harness, seed);
        const out: Square[] = [];

        for (const place of places) {
            const game = fresh();
            await standIn(game, place.name);

            let acts: Square['acts'] = [];
            let reads = 0;
            let offers: Offer[] = [];
            try {
                const { run, cultivator } = (game as unknown as {
                    currentRun(): { run: never; cultivator: never };
                }).currentRun();
                const live = situatedReads.affordancesFor.call(game as never, cultivator, run);
                acts = live.filter(a => !isARead(a.routesTo))
                    .map(a => ({ say: a.say, routesTo: a.routesTo, id: a.id }));
                reads = live.length - acts.length;
                offers = whatIsAdvertised(game, ordinal, place.name);
            } catch { /* a square that throws has nothing in it, and that counts */ }

            // ── AND THEN THE ENGINE IS ASKED TO HONOUR ITS OWN OFFER.
            // Restored per sentence: the acts are a set, and one that spends a
            // decade must not be what the next one is measured against.
            const standing = capture(harness, seed);
            const refusedItsOwn: Square['refusedItsOwn'] = [];
            for (const act of acts) {
                const one = standing();
                try {
                    const turn = await one.act(act.say);
                    const declined = declinedOn(turn.toolCalls as Call[]);
                    if (declined.length > 0) {
                        refusedItsOwn.push({
                            say: act.say,
                            why: declined.map(c => `${c.name}/${c.action}`).join(' ')
                        });
                    }
                } catch (err) {
                    refusedItsOwn.push({ say: act.say, why: `threw: ${(err as Error).message}` });
                }
            }

            out.push({
                world: worldSeed, band, ordinal, place: place.name, kind: place.kind,
                acts, reads, offers, refusedItsOwn
            });
            // To stderr, so a run that takes an hour says where it is without
            // getting into the report a caller is redirecting.
            process.stderr.write(
                `  ${worldSeed} ${shortly(band)} ${out.length}/${places.length} `
                + `${place.name}: ${acts.length} acts, ${offers.length} advertised\n`
            );
        }

        harness.db.close();
        return out;
    });
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A SPAN OF TIME PRODUCES
// ─────────────────────────────────────────────────────────────────────────

export interface Span {
    world: string;
    band: RegisterBand;
    said: string;
    /** Days the run actually spent, which is not what was asked for. */
    lived: number;
    /** Lines of world digest that reached the player. */
    reached: number;
    /** Events the span put in front of them, interrupting or not. */
    events: number;
    /** The inspector's own count of what passed unheard, when it said. */
    unheard: number | null;
}

/** `reportFromDigest` stamps every line it renders with the year it happened. */
const A_DIGEST_LINE = /^Year \d+:/gm;
const NOTHING_REACHED = /nothing reached this cultivator\. (\d+) event/i;

/**
 * ANYWAY, ON EVERY ONE OF THEM, and it is not a trick.
 *
 * The only manual a stall anywhere in this world sells ends at Foundation
 * Establishment Early, so a cultivator at the middle or top band who sits down
 * meets `engine.techniqueCeiling/cultivate` and spends no time at all. That is
 * a correct gate and it names its own route - *"say it again with anyway and
 * the years go by regardless"*. Measured without it, this sweep reported zero
 * days lived at two of the three bands, which measures the stall and not the
 * span.
 */
const SPANS = [
    'I go into seclusion for one year anyway',
    'I go into seclusion for five years anyway',
    'I go into seclusion for twenty years anyway'
] as const;

export async function measureSpans(worldSeed: string, band: RegisterBand): Promise<Span[]> {
    return withAdminMode(async () => {
        const ordinal = floorOf(band);
        const seed = `${worldSeed}-span-${band}`;
        const harness = await makeGameInWorld({ seed, worldSeed, adminMode: true });
        await harness.game.newRun('Sitter');
        for (const line of [
            `ADMIN set_realm ordinal=${ordinal}`,
            'ADMIN grant_item kind=pill name=Qi Gathering Pill quantity=3'
        ]) {
            try { await harness.game.act(line); } catch { /* an arrangement that fails is a state */ }
        }
        // A sitting needs something to sit. Played rather than granted: admin
        // refuses to force a method, and correctly.
        const stall = (await harness.game.act('I buy a manual')).narration ?? '';
        const book = /^\s*([A-Z][^,\n]{4,48}Manual|[A-Z][^,\n]{4,48}Scripture)\b/m.exec(stall)?.[1];
        if (book) {
            for (const line of [`I buy the ${book.trim()}`, `I learn the ${book.trim()}`]) {
                try { await harness.game.act(line); } catch { /* still a state */ }
            }
        }

        const fresh = capture(harness, seed);
        const out: Span[] = [];
        for (const said of SPANS) {
            const game = fresh();
            const before = (() => {
                try { return game.state().run.elapsedDays; } catch { return 0; }
            })();
            let reached = 0;
            let events = 0;
            let unheard: number | null = null;
            let lived = 0;
            try {
                const turn = await game.act(said);
                reached = (turn.narration ?? '').match(A_DIGEST_LINE)?.length ?? 0;
                events = turn.events.length;
                const summaries = turn.toolCalls.map(c => (c as { summary?: string }).summary ?? '').join(' ');
                const missed = NOTHING_REACHED.exec(`${turn.narration ?? ''} ${summaries}`);
                unheard = missed ? Number(missed[1]) : null;
                lived = Math.max(0, game.state().run.elapsedDays - before);
            } catch { /* a sitting that threw lived nothing */ }
            out.push({ world: worldSeed, band, said, lived, reached, events, unheard });
        }

        harness.db.close();
        return out;
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE REPORT
// ─────────────────────────────────────────────────────────────────────────

const shortly = (band: RegisterBand): string => band.split(':')[0];

const mean = (ns: readonly number[]): number =>
    ns.length === 0 ? 0 : ns.reduce((a, b) => a + b, 0) / ns.length;

function actsPerBand(rows: readonly Square[]): void {
    console.log('\nACTS LIVE IN A SQUARE, by band');
    console.log('band                 squares   acts  median  worst   only-sit   reads');
    for (const band of REGISTER_BANDS) {
        const got = rows.filter(r => r.band === band);
        if (got.length === 0) continue;
        const counts = got.map(r => r.acts.length).sort((a, b) => a - b);
        const onlySit = got.filter(
            r => r.acts.length > 0 && r.acts.every(a => a.routesTo === 'cultivate')
        ).length;
        console.log(
            `${shortly(band).padEnd(20)} ${String(got.length).padStart(7)} `
            + `${mean(counts).toFixed(1).padStart(6)} ${String(counts[Math.floor(counts.length / 2)]).padStart(7)} `
            + `${String(counts[0]).padStart(6)} ${String(onlySit).padStart(10)} `
            + `${mean(got.map(r => r.reads)).toFixed(1).padStart(7)}`
        );
    }
}

function actsPerKind(rows: readonly Square[]): void {
    const kinds = [...new Set(rows.map(r => r.kind))].sort();
    console.log('\nACTS AND ADVERTISED THINGS, by kind of place and band');
    console.log('kind          ' + REGISTER_BANDS.map(b => shortly(b).slice(0, 8).padStart(16)).join(''));
    console.log('              ' + REGISTER_BANDS.map(() => '   acts  offers'.padStart(16)).join(''));
    for (const kind of kinds) {
        const cells = REGISTER_BANDS.map(band => {
            const got = rows.filter(r => r.kind === kind && r.band === band);
            if (got.length === 0) return '        -       -';
            return `${mean(got.map(r => r.acts.length)).toFixed(1).padStart(7)} `
                + `${mean(got.map(r => r.offers.length)).toFixed(1).padStart(7)}`;
        });
        console.log(kind.padEnd(14) + cells.join(' '));
    }
}

/**
 * WHICH acts, not how many.
 *
 * Four things live in every square is a different world from four things live
 * in this square and four different ones in the next. The second is a map worth
 * walking; the first is one square repeated 37 times.
 */
function whichActsAreEverLive(rows: readonly Square[]): void {
    console.log('\nWHICH ACTS ARE EVER LIVE, and in how many of the squares');
    const seen = new Map<string, { squares: number; bands: Set<RegisterBand> }>();
    for (const row of rows) {
        for (const verb of new Set(row.acts.map(a => a.routesTo))) {
            const held = seen.get(verb) ?? { squares: 0, bands: new Set<RegisterBand>() };
            held.squares += 1;
            held.bands.add(row.band);
            seen.set(verb, held);
        }
    }
    console.log(`verb            squares   share   bands`);
    for (const [verb, held] of [...seen].sort((a, b) => b[1].squares - a[1].squares)) {
        console.log(
            `${verb.padEnd(15)} ${String(held.squares).padStart(7)} `
            + `${`${((held.squares / rows.length) * 100).toFixed(0)}%`.padStart(7)}   `
            + [...held.bands].map(shortly).join(', ')
        );
    }
}

function whereItThins(rows: readonly Square[]): void {
    console.log('\nWHERE IT THINS OUT - squares with the fewest acts, worst first');
    const ordered = [...rows].sort(
        (a, b) => a.acts.length - b.acts.length || a.offers.length - b.offers.length
    );
    const said = new Set<string>();
    for (const row of ordered) {
        const key = `${row.place}|${row.band}`;
        if (said.has(key)) continue;
        said.add(key);
        if (said.size > 20) break;
        const reachable = row.offers.filter(o => o.reachable).length;
        console.log(
            `  ${String(row.acts.length).padStart(2)} acts  `
            + `${String(reachable).padStart(3)}/${String(row.offers.length).padStart(3)} offers reachable  `
            + `[${shortly(row.band).padEnd(18)}] ${row.kind.padEnd(12)} ${row.place}`
            + (row.acts.length > 0 ? `   (${row.acts.map(a => a.routesTo).join(', ')})` : '')
        );
    }
}

function whatIsOutOfReach(rows: readonly Square[]): void {
    console.log('\nADVERTISED AND OUT OF REACH, by kind of thing and band');
    console.log('kind    band                 advertised  reachable   share   the commonest gate');
    const kinds: OfferKind[] = ['duty', 'intake', 'art', 'goods', 'road'];
    for (const kind of kinds) {
        for (const band of REGISTER_BANDS) {
            const got = rows.flatMap(r => r.band === band ? r.offers.filter(o => o.kind === kind) : []);
            if (got.length === 0) {
                console.log(`${kind.padEnd(8)}${shortly(band).padEnd(20)} ${'0'.padStart(11)}`
                    + `${'-'.padStart(11)}${'-'.padStart(8)}   NOTHING IS ADVERTISED AT ALL`);
                continue;
            }
            const ok = got.filter(o => o.reachable).length;
            const gates = new Map<string, number>();
            for (const row of got) {
                if (row.reachable) continue;
                const key = row.gate.replace(/\d+/g, 'N');
                gates.set(key, (gates.get(key) ?? 0) + 1);
            }
            const worst = [...gates].sort((a, b) => b[1] - a[1])[0];
            console.log(
                `${kind.padEnd(8)}${shortly(band).padEnd(20)} ${String(got.length).padStart(11)}`
                + `${String(ok).padStart(11)}${`${((ok / got.length) * 100).toFixed(0)}%`.padStart(8)}   `
                + (worst ? `x${worst[1]} ${worst[0]}` : 'all of it is reachable')
            );
        }
    }
}

function offersItWillNotHonour(rows: readonly Square[]): void {
    const all = rows.flatMap(r => r.refusedItsOwn.map(x => ({ ...x, band: r.band })));
    const offered = rows.reduce((n, r) => n + r.acts.length, 0);
    console.log(
        `\nTHE ENGINE'S OWN SENTENCES, TYPED BACK AT IT   ${offered} offered, `
        + `${all.length} refused  ${offered === 0 ? '' : `${((all.length / offered) * 100).toFixed(1)}%`}`
    );
    const bySay = new Map<string, { n: number; why: string }>();
    for (const row of all) {
        const held = bySay.get(row.say);
        if (held) held.n += 1;
        else bySay.set(row.say, { n: 1, why: row.why });
    }
    for (const [say, { n, why }] of [...bySay].sort((a, b) => b[1].n - a[1].n).slice(0, 20)) {
        console.log(`  x${String(n).padStart(4)}  ${say.padEnd(40)} ${why}`);
    }
}

function whatASpanProduces(spans: readonly Span[]): void {
    console.log('\nWHAT A SPAN OF TIME PRODUCES');
    console.log('band                 said                                   lived   reached  events   unheard  per year');
    for (const span of spans) {
        const years = span.lived / 365;
        console.log(
            `${shortly(span.band).padEnd(20)} ${span.said.padEnd(38)} `
            + `${span.lived.toFixed(0).padStart(6)} ${String(span.reached).padStart(9)} `
            + `${String(span.events).padStart(7)} ${(span.unheard === null ? '-' : String(span.unheard)).padStart(9)} `
            + `${(years < 0.5 ? '-' : ((span.reached + span.events) / years).toFixed(1)).padStart(9)}`
        );
    }
}

async function main(): Promise<void> {
    const only = process.env.PLACES ? Number(process.env.PLACES) : PLACES.length;
    const places = PLACES.slice(0, only);
    const worlds = process.env.WORLD ? [process.env.WORLD] : [...WORLDS];

    const squares: Square[] = [];
    const spans: Span[] = [];
    for (const world of worlds) {
        for (const band of REGISTER_BANDS) {
            squares.push(...await measureAcross(world, band, places));
            spans.push(...await measureSpans(world, band));
        }
    }

    console.log(
        `\n${squares.length} squares read  -  ${places.length} places x `
        + `${REGISTER_BANDS.length} bands x ${worlds.length} pinned world(s)`
    );
    actsPerBand(squares);
    actsPerKind(squares);
    whichActsAreEverLive(squares);
    whereItThins(squares);
    whatIsOutOfReach(squares);
    offersItWillNotHonour(squares);
    whatASpanProduces(spans);

    const out = process.argv[2];
    if (out) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(out, JSON.stringify({ squares, spans }, null, 1));
        console.log(`\nwrote ${out}`);
    }
}

if (process.argv[1] !== undefined && /probe-is-there-enough-to-do/.test(process.argv[1])) {
    await main();
}
