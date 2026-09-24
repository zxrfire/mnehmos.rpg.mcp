/**
 * WHICH PASSES ON THE BOARD EVER FIRE.
 *
 * A pass can be correct, tested, imported by the year and still never do
 * anything, because the guard inside it waits on a state no world reaches. A
 * grep cannot see that: it sees the call. Only a run can, and only if somebody
 * counts.
 *
 * So this counts, per pass:
 *
 *   calls     how many times the board actually called it
 *   did       how many of those calls left something behind
 *   years     how many distinct years it did something in, and the first and
 *             last of them
 *
 * A pass that fires zero times in a thousand years is either a dead rule or a
 * precondition no world reaches, and both are worth knowing. A pass that fires
 * on year 3 and never again is a third thing, which is why the first and last
 * year are here rather than a single share.
 *
 * ── THE OTHER HALF, WHICH IS A SEARCH AND NOT A RUN ──────────────────────
 *
 * `scripts/find-unwired-exports.mjs` asks the cheaper question over the whole
 * of `src/`: does anything READ this name. Ask it first, because it is free and
 * it catches the commoner defect - a rule written, pinned by a test, and never
 * imported by anything. This probe is for what that search cannot see: a name
 * that is read, by a pass that is called, that never once acts. Two questions,
 * two tools, and neither answers the other's.
 *
 * ── ADDING A PASS ────────────────────────────────────────────────────────
 *
 * One line in {@link THE_PASSES_WATCHED}: the exported name, and the module it
 * is exported FROM. Nothing else. `from` is the module the pass lives in, and
 * the path is written relative to this file.
 *
 * ── HOW IT COUNTS, AND WHAT IT CANNOT SEE ────────────────────────────────
 *
 * Each watched export is replaced, for the length of the run, by the real one
 * wrapped in a tally. The board imports the module it always imported and calls
 * the function it always called; the wrapper hands the call straight through
 * and looks at what came back and at what moved in the world.
 *
 * WHAT COUNTS AS HAVING DONE SOMETHING, where the pass does not say:
 *
 *   a boolean return        is the answer
 *   a number                is the answer where it is not zero
 *   an array                is the answer where it is not empty
 *   anything else, or none  the world moved: a fact was written, or the roster,
 *                           the houses or the objects changed length
 *
 * What that CANNOT see is a pass that rewrites a person or a ledger in place and
 * writes no fact: the roster is the same length and nothing came back to read.
 * Those pass their own answer in `didSomething`, which is handed what came back,
 * what moved, the arguments the pass was called with, and whatever `readsBefore`
 * took off the world before the call - which is how a pass whose whole work is
 * moving a figure says so.
 *
 * AND A ZERO IS TWO THINGS. `calls: 0` means either the board never called it or
 * this probe failed to intercept it, which happens when `from` is not the module
 * the CALLER imports from. The report says so on the line rather than leaving a
 * zero to be read as a finding.
 *
 * ── AND `did: 0` IS TWO THINGS TOO, WHICH COST A FALSE HEADLINE ──────────
 *
 * A PASS THAT WRITES NO FACT IS INVISIBLE TO AN EVENT WALK. The default read
 * above looks for a fact, or for the roster, the houses or the objects changing
 * length. A pass whose whole work is an obligation, a tie, an activity, a figure
 * in a ledger or a counter it returns moves none of those, so it reads as inert
 * while changing the world every single year.
 *
 * This reported four passes as having done nothing in a thousand years. THREE OF
 * THEM WERE THIS PROBE DESCRIBING ITS OWN REACH: one writes to `state.obligations`
 * and returns a record, one returns four counters and rewrites people in place,
 * and one is a pure read returning a closure that CAN NEVER do anything
 * observable at its own call site - its zero was meaningless by construction and
 * it is no longer watched at all. Only the fourth was a real finding.
 *
 * So the verdict is now in two lists and they are not the same claim:
 *
 *   DID NOTHING           passes carrying their own `didSomething`. A zero here
 *                         is the world.
 *   CANNOT SEE WHETHER    passes on the default read that left nothing it looks
 *                         at. A zero here is the instrument, and the report says
 *                         so instead of printing them under a heading that reads
 *                         like a finding.
 *
 * Before reading any zero as a dead rule, ask what that pass WRITES. If the
 * answer is not a fact, it needs a `didSomething` off whatever it does move, and
 * until it has one this probe has nothing to say about it.
 *
 * ── AND A CENSUS, EVERY HUNDRED YEARS ────────────────────────────────────
 *
 * The tally above answers "did this pass ever do anything". It cannot answer
 * two questions that matter as much, so the run takes a census of the world
 * every `PROBE_CENSUS_EVERY` years as well:
 *
 *   DOES ANYTHING GROW WITHOUT A CEILING     rows, objects by kind, ties per
 *                                            head. A stock that climbs every
 *                                            century climbs forever.
 *   WHAT CLOCK IS A RATE ACTUALLY ON         bonds ended, people who stopped
 *                                            waiting and after how many years,
 *                                            absences written off. A rate
 *                                            written per year on people who
 *                                            live millennia reads as a number
 *                                            here rather than as an argument.
 *
 * AND THE CENSUS IS NOT OPTIONAL COLOUR: it is the only way to see a pass that
 * is called from INSIDE another pass. The wrapper replaces what the board
 * imports, so a function the board never imports - `aBondSomebodyEnds`, which
 * `searchingMastersTakeADisciple` calls through its own module-local binding -
 * is invisible to it. Those are counted off what they leave in the world
 * instead: a bond ending writes a fact carrying `data.endedBy`.
 *
 * ── RUNNING IT ───────────────────────────────────────────────────────────
 *
 *     npx vitest run --config vitest.probe.config.ts
 *
 * It is not a test and no full-suite run collects it: the probe config is the
 * only one whose `include` reaches this file. It soaks whole worlds, so it is a
 * dedicated run on a quiet machine, one process, output to a file.
 *
 *     PROBE_SEEDS     comma separated, default `passes-a,passes-b`
 *     PROBE_YEARS     per seed, default 1000
 *     PROBE_DIR       where the report is written, default the temp directory
 *     PROBE_LOG       its name, default `which-passes-ever-fire.txt`
 *     PROBE_MINUTES   how long the run may take, default 240
 *     PROBE_CENSUS_EVERY  years between censuses, default 100
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { it, vi } from 'vitest';

/** A pass on the board, and where it is exported from. */
interface AWatchedPass {
    /** The exported name. This is the name the report calls it by. */
    readonly name: string;
    /** The module it is exported from, relative to this file. */
    readonly from: string;
    /**
     * A reading taken before the call, for a pass that rewrites in place.
     * Whatever comes back is handed to {@link didSomething} as `before`.
     */
    readonly readsBefore?: (state: MaybeAWorld) => unknown;
    /** Whether this call did anything, where the default cannot tell. */
    readonly didSomething?: (
        returned: unknown,
        moved: WhatMoved,
        args: readonly unknown[],
        before: unknown
    ) => boolean;
}

/** Every house's ledger, for a pass whose whole work is moving figures in it. */
function theLedgersOfTheHouses(state: MaybeAWorld): string {
    return JSON.stringify((state.factions ?? []).map(h => (h as { resources?: unknown }).resources ?? null));
}

/**
 * The passes counted.
 *
 * The first three are the ones a reading of the code put first, because each
 * waits on a state the world may never reach: an office left empty by the
 * year's promotions, a hidden killing old enough with somebody asking after it,
 * and a house whose conclave cycle falls in this year. The rest are the other
 * passes the board gained in the same stretch of work, which cost nothing to
 * count once a world is being run.
 */
const THE_PASSES_WATCHED: readonly AWatchedPass[] = [
    { name: 'theHousesTakeInEldersFromOutside', from: '../src/engine/world/a-house-takes-in-an-elder-from-outside.js' },
    { name: 'whatComesToLightThisYear', from: '../src/engine/world/what-comes-to-light-about-a-killing.js' },
    { name: 'theConclavesAreContested', from: '../src/engine/world/a-conclave-seat-is-won-in-a-tournament.js' },
    { name: 'theChallengesThisYear', from: '../src/engine/world/a-challenge-is-answered-on-the-yard.js' },
    { name: 'peopleActOnWhyTheyWouldKill', from: '../src/engine/world/a-year-of-people-acting-on-why-they-would-kill.js' },
    { name: 'peopleBringWhatTheyKnowToTheRoom', from: '../src/engine/world/bringing-what-you-know-about-somebody-to-the-room.js' },
    { name: 'whatTheirLeavingStirs', from: '../src/engine/world/what-somebody-senior-leaving-stirs.js' },
    { name: 'whoSplitsAHouse', from: '../src/engine/world/who-splits-a-house-and-who-goes-with-them.js' },
    {
        // IT WRITES NO FACT, so the default read sees a world of the same size
        // and nothing to count. Its four counters ARE its answer, and it says so
        // in its own return type.
        name: 'theWanderersGoAbout',
        from: '../src/engine/world/the-wanderer-the-catalog-names-is-somebody.js',
        didSomething: returned => {
            const c = returned as Partial<Record<string, number>> | undefined;
            return (c?.lectures ?? 0) + (c?.lookedIn ?? 0)
                + (c?.newInheritors ?? 0) + (c?.foundOutAboutADeath ?? 0) > 0;
        }
    },
    { name: 'peopleWithNoHouseMoveOn', from: '../src/engine/world/where-somebody-with-no-house-goes.js' },
    { name: 'searchingMastersTakeADisciple', from: '../src/engine/world/the-disciples-a-world-opens-with.js' },
    // `theRoadsOntoARollThisYear` IS NOT WATCHED AND MUST NOT BE. It is a pure
    // read returning a closure, so it can never do anything observable at its
    // own call site and its zero here is meaningless by construction - it would
    // report inert every run however many people joined a house through it. Its
    // real question is what `roadFor` ANSWERS, which is a different measurement
    // and belongs with whoever counts how many people were actually taken on.
    {
        // ITS WORK IS AN OBLIGATION, not a fact: an oath sworn or the grudge a
        // refusal leaves, written onto `state.obligations`. The roster, houses
        // and objects are all the same length afterwards, which is exactly the
        // shape the default read cannot see.
        name: 'theOathOnTheWayOut',
        from: '../src/engine/world/the-word-an-npc-gave.js',
        readsBefore: state => ((state as { obligations?: unknown[] }).obligations ?? []).length,
        didSomething: (_returned, _moved, args, before) =>
            (((args[0] as { obligations?: unknown[] })?.obligations ?? []).length)
            !== (before as number)
    },
    {
        name: 'theHousesAreCounted',
        from: '../src/engine/world/how-many-people-a-house-has.js',
        // It returns nothing and writes no fact: its whole work is moving two
        // figures in each house's ledger, which is what this reads.
        readsBefore: theLedgersOfTheHouses,
        didSomething: (_returned, _moved, args, before) =>
            theLedgersOfTheHouses(args[0] as MaybeAWorld) !== before
    },
    {
        name: 'aChildTakesTheirParentsLine',
        from: '../src/engine/world/a-child-takes-their-parents-line.js',
        // It hands back the child it was given, changed or not, and writes no
        // fact of its own. The row coming back a different object is the whole
        // of what it did.
        didSomething: (returned, _moved, args) => returned !== args[1]
    }
];

const SEEDS = (process.env.PROBE_SEEDS ?? 'passes-a,passes-b').split(',').map(s => s.trim()).filter(Boolean);
const YEARS = Number(process.env.PROBE_YEARS ?? 1_000);
const DIR = process.env.PROBE_DIR ?? os.tmpdir();
const LOG = `${DIR}/${process.env.PROBE_LOG ?? 'which-passes-ever-fire.txt'}`;
const MINUTES = Number(process.env.PROBE_MINUTES ?? 240);
const CENSUS_EVERY = Math.max(1, Number(process.env.PROBE_CENSUS_EVERY ?? 100));

/** What moved in the world while one call was in it. */
interface WhatMoved {
    facts: number;
    npcs: number;
    factions: number;
    objects: number;
}

interface ATally {
    calls: number;
    did: number;
    /** What a pass that answers with a count has counted, over the whole run. */
    sum: number;
    facts: number;
    years: Set<number>;
    firstYear: number | null;
    lastYear: number | null;
}

const tallies = new Map<string, ATally>();
for (const pass of THE_PASSES_WATCHED) {
    tallies.set(pass.name, {
        calls: 0, did: 0, sum: 0, facts: 0, years: new Set(), firstYear: null, lastYear: null
    });
}

// ── AND WHICH KINDS OF EVENT THE WORLD EVER WRITES ───────────────────────
//
// The pass tally answers "did this pass do anything". It cannot answer whether
// a KIND of thing the world declares it can do ever happens, because a pass
// that fires every year may write only two of the eight kinds it can produce.
//
// THE LIST IS READ OFF THE DECLARATION, not copied beside it. `PressureKind` is
// the world's own statement of what can happen to it, so a kind added there
// enters this walk without anybody remembering to add it here - which is the
// whole point, since the unwired thing is precisely the one nobody wrote a
// check for. A copied list would drift and then agree with itself.
const THE_WORLD_PASS =
    new URL('../src/engine/world/the-world-changing-on-its-own.ts', import.meta.url);

function theKindsTheWorldDeclares(): string[] {
    const source = readFileSync(THE_WORLD_PASS, 'utf8');
    const at = source.indexOf('export type PressureKind');
    if (at < 0) {
        throw new Error(
            'PressureKind is not declared where this probe reads it. The list this walk '
            + 'covers comes from that declaration; without it the walk would silently '
            + 'cover nothing, which is the failure it exists to catch.'
        );
    }
    const union = source.slice(at, source.indexOf(';', at));
    return [...new Set(union.match(/'[a-z_]+'/g)?.map(q => q.slice(1, -1)) ?? [])].sort();
}

interface AKindTally {
    count: number;
    seeds: Set<string>;
    firstYear: number | null;
    lastYear: number | null;
}

const kindsOfEvent = new Map<string, AKindTally>();
const kindsOfFact = new Map<string, AKindTally>();

function noteAKind(into: Map<string, AKindTally>, kind: string, seed: string, year: number) {
    let t = into.get(kind);
    if (t === undefined) {
        t = { count: 0, seeds: new Set(), firstYear: null, lastYear: null };
        into.set(kind, t);
    }
    t.count += 1;
    t.seeds.add(seed);
    if (t.firstYear === null) t.firstYear = year;
    t.lastYear = year;
}

interface MaybeAWorld {
    npcs?: unknown[];
    factions?: unknown[];
    objects?: unknown[];
    currentDay?: number;
    history?: { facts?: unknown[] };
}

function sizeOf(state: MaybeAWorld | undefined): WhatMoved {
    if (!state || !Array.isArray(state.npcs)) return { facts: 0, npcs: 0, factions: 0, objects: 0 };
    return {
        facts: state.history?.facts?.length ?? 0,
        npcs: state.npcs.length,
        factions: state.factions?.length ?? 0,
        objects: state.objects?.length ?? 0
    };
}

function didSomethingByDefault(
    returned: unknown,
    moved: WhatMoved,
    _args: readonly unknown[],
    _before: unknown
): boolean {
    if (typeof returned === 'boolean') return returned;
    if (typeof returned === 'number') return returned !== 0;
    if (Array.isArray(returned)) return returned.length > 0;
    return moved.facts > 0 || moved.npcs !== 0 || moved.factions !== 0 || moved.objects !== 0;
}

function counted(pass: AWatchedPass, actual: (...args: unknown[]) => unknown) {
    return (...args: unknown[]): unknown => {
        const state = args[0] as MaybeAWorld | undefined;
        const before = sizeOf(state);
        const read = pass.readsBefore && state ? pass.readsBefore(state) : null;
        const returned = actual(...args);
        const after = sizeOf(state);
        const moved: WhatMoved = {
            facts: after.facts - before.facts,
            npcs: after.npcs - before.npcs,
            factions: after.factions - before.factions,
            objects: after.objects - before.objects
        };
        const tally = tallies.get(pass.name)!;
        tally.calls++;
        if (typeof returned === 'number' && Number.isFinite(returned)) tally.sum += returned;
        else if (Array.isArray(returned)) tally.sum += returned.length;
        const did = (pass.didSomething ?? didSomethingByDefault)(returned, moved, args, read);
        if (did) {
            tally.did++;
            tally.facts += Math.max(0, moved.facts);
            const year = Math.floor((state?.currentDay ?? 0) / 365);
            tally.years.add(year);
            tally.firstYear = tally.firstYear === null ? year : Math.min(tally.firstYear, year);
            tally.lastYear = tally.lastYear === null ? year : Math.max(tally.lastYear, year);
        }
        return returned;
    };
}

// EVERY WATCHED EXPORT, WRAPPED BEFORE THE BOARD IS LOADED. Grouped by module,
// because two passes can live in one file and a module is mocked once.
const byModule = new Map<string, AWatchedPass[]>();
for (const pass of THE_PASSES_WATCHED) {
    byModule.set(pass.from, (byModule.get(pass.from) ?? []).concat(pass));
}
for (const [from, passes] of byModule) {
    vi.doMock(from, async () => {
        const actual = await vi.importActual<Record<string, unknown>>(from);
        const wrapped: Record<string, unknown> = { ...actual };
        for (const pass of passes) {
            const real = actual[pass.name];
            if (typeof real !== 'function') continue;
            wrapped[pass.name] = counted(pass, real as (...args: unknown[]) => unknown);
        }
        return wrapped;
    });
}

/** One reading of the whole world, taken every `CENSUS_EVERY` years. */
interface ACensus {
    year: number;
    alive: number;
    everybody: number;
    ties: number;
    perHead: string;
    masterTies: number;
    coldBonds: number;
    looking: number;
    objects: number;
    jade: number;
    slips: number;
    absencesOpen: number;
    writtenOff: number;
    facts: number;
    /** Every death the world has written, cumulative. Differenced when printed. */
    deaths: number;
    /** How many of each kind of thing the world is holding. */
    byKind: [string, number][];
    /**
     * Masters who are looking and have nobody in front of them: of their own
     * house, standing where they stand, junior in rank and below them on the
     * ladder. The forming side of the bond question - a master who is looking
     * and never finds is a different defect from a rate that ends bonds too
     * fast.
     */
    lookingAtNobody: number;
    /**
     * THE DEAD THE ROSTER KEEPS, and whether anything still points at them.
     *
     * `alive` is flat and `everybody` climbs about 190 a century forever, so
     * the roster holds three times more rows than living people by year 2500
     * and every pass that walks it pays for them. The chronicle is `facts` and
     * grows separately; this is a working set. What separates a leak from a
     * rule doing its job is WHICH dead are kept: somebody a living person still
     * holds a tie to, or whose things are still in the world, is a row with a
     * reason, and the rest are not.
     */
    dead: { byStatus: [string, number][]; held: number; loose: number };
}

interface TheWorldAsRead {
    npcs: {
        id: string;
        status: string;
        locationId: string | null;
        factionId: string | null;
        factionRankIndex: number;
        cultivation: { realmOrdinal: number };
        goals?: { note?: string; status?: string }[];
        relationships: { kind: string; standing: number; targetId: string }[];
    }[];
    objects: { kind: string; tags: string[]; ownerId: string | null; possessorId: string | null }[];
    absences?: {
        leftOnDay: number;
        writtenOffOnDay: number | null;
        ties: { settledAs: string | null; settledOnDay: number | null }[];
    }[];
    history: { facts: { day: number; kind: string; data?: Record<string, unknown> }[] };
    currentDay: number;
}

function census(state: TheWorldAsRead, coldAt: number, lookingTag: string): ACensus {
    const lookingMasters: TheWorldAsRead['npcs'] = [];
    let alive = 0;
    let ties = 0;
    let masterTies = 0;
    let coldBonds = 0;
    let looking = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        for (const tie of npc.relationships) {
            ties++;
            if (tie.kind !== 'master') continue;
            masterTies++;
            if (tie.standing <= coldAt) coldBonds++;
        }
        if ((npc.goals ?? []).some(g => g.note === lookingTag && g.status === 'active')) {
            looking++;
            lookingMasters.push(npc);
        }
    }
    // Whether anybody is standing in front of them at all. The fit and the
    // master's own pickiness are the pass's business; this is the gate before
    // both of them, and the only one a census can see.
    let lookingAtNobody = 0;
    for (const master of lookingMasters) {
        const anybody = state.npcs.some(n => n.status === 'alive'
            && n.id !== master.id
            && n.factionId !== null
            && n.factionId === master.factionId
            && n.locationId === master.locationId
            && n.factionRankIndex < master.factionRankIndex
            && n.cultivation.realmOrdinal < master.cultivation.realmOrdinal);
        if (!anybody) lookingAtNobody++;
    }
    let jade = 0;
    let slips = 0;
    // AND WHAT ALL OF IT IS. Total objects climbed 1,350 a century for fifteen
    // centuries with jade and slips both flat, so something else is minting and
    // nothing is collecting it. Naming the kind is what turns that into a
    // defect somebody can fix.
    const kinds = new Map<string, number>();
    for (const o of state.objects) {
        if (o.tags.includes('communication-jade')) jade++;
        else if (o.tags.includes('communication-talismans')) slips++;
        kinds.set(o.kind, (kinds.get(o.kind) ?? 0) + 1);
    }
    // Everything anything still points at: a tie anybody holds, and the owner or
    // the holder of anything in the world. One pass over the rows and one over
    // the objects, which is what the census already costs.
    const pointedAt = new Set<string>();
    for (const npc of state.npcs) {
        for (const tie of npc.relationships) pointedAt.add(tie.targetId);
    }
    for (const o of state.objects) {
        if (o.ownerId !== null) pointedAt.add(o.ownerId);
        if (o.possessorId !== null) pointedAt.add(o.possessorId);
    }
    const byStatus = new Map<string, number>();
    let held = 0;
    let loose = 0;
    for (const npc of state.npcs) {
        if (npc.status === 'alive') continue;
        byStatus.set(npc.status, (byStatus.get(npc.status) ?? 0) + 1);
        if (pointedAt.has(npc.id)) held++;
        else loose++;
    }

    const absences = state.absences ?? [];
    return {
        year: Math.floor(state.currentDay / 365),
        alive,
        everybody: state.npcs.length,
        ties,
        perHead: (ties / Math.max(1, alive)).toFixed(2),
        masterTies,
        coldBonds,
        looking,
        objects: state.objects.length,
        jade,
        slips,
        absencesOpen: absences.filter(a => a.writtenOffOnDay === null).length,
        writtenOff: absences.filter(a => a.writtenOffOnDay !== null).length,
        facts: state.history.facts.length,
        // COUNTED OFF THE FACTS AND NOT OFF THE ROSTER, because the roster does
        // not keep everybody: `everybody` fell as well as rose across a six
        // year smoke, so dead rows are collected and cannot be counted.
        deaths: state.history.facts.reduce((n, fact) => fact.kind === 'death' ? n + 1 : n, 0),
        byKind: [...kinds.entries()].sort((a, b) => b[1] - a[1]),
        lookingAtNobody,
        dead: {
            byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
            held,
            loose
        }
    };
}

/** The middle of a list of numbers, and the ends of it. */
function spread(values: number[]): string {
    if (values.length === 0) return 'none';
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    return `${values.length}, median ${median.toFixed(1)}, `
        + `from ${sorted[0]!.toFixed(1)} to ${sorted[sorted.length - 1]!.toFixed(1)}`;
}

/**
 * What the census cannot see from one reading: the things the world only says
 * once, in a fact or in a settled row, and which have to be read at the end.
 */
function whatTheRunLeft(state: TheWorldAsRead): string[] {
    const endings = state.history.facts.filter(f => f.data?.endedBy !== undefined);
    const byCentury = new Map<number, number>();
    for (const f of endings) {
        const century = Math.floor(f.day / 365 / 100) * 100;
        byCentury.set(century, (byCentury.get(century) ?? 0) + 1);
    }
    const stoppedWaiting: number[] = [];
    const writtenOff: number[] = [];
    for (const absence of state.absences ?? []) {
        for (const tie of absence.ties) {
            if (tie.settledAs !== 'stopped_waiting' || tie.settledOnDay === null) continue;
            stoppedWaiting.push((tie.settledOnDay - absence.leftOnDay) / 365);
        }
        if (absence.writtenOffOnDay !== null) {
            writtenOff.push((absence.writtenOffOnDay - absence.leftOnDay) / 365);
        }
    }
    return [
        `    bonds ended by somebody (a cold bond, either end): ${endings.length}`,
        `        by century: ${[...byCentury.entries()].sort((a, b) => a[0] - b[0])
            .map(([c, n]) => `${c}:${n}`).join(' ') || 'none'}`,
        `    stopped waiting, in years of absence: ${spread(stoppedWaiting)}`,
        `    written off, in years of absence:     ${spread(writtenOff)}`
    ];
}

function share(did: number, calls: number): string {
    return calls === 0 ? '-' : `${((100 * did) / calls).toFixed(1)}%`;
}

it('counts what every watched pass did', async () => {
    // AFTER the mocks, or the board holds the real functions and counts nothing.
    const { seedWorld } = await import('../src/engine/world/seeding.js');
    const { advanceWorldYears } = await import('../src/engine/world/driver.js');
    const { loadCultivationCatalog } = await import('../src/engine/world/catalog.js');

    const catalog = await loadCultivationCatalog();
    const lines: string[] = [
        `WHICH PASSES ON THE BOARD EVER FIRE`,
        `${SEEDS.length} seed(s) at ${YEARS} years each: ${SEEDS.join(', ')}`,
        ''
    ];

    // A CENSUS EVERY FEW CENTURIES, WHICH IS WHY THE WORLD IS ADVANCED IN
    // STEPS. One call for the whole horizon would answer every growth question
    // with a single number at the end, and a stock that climbed and fell back
    // reads the same as one that never moved.
    const { A_BOND_IS_COLD_AT, A_MASTER_LOOKING } =
        await import('../src/engine/world/the-disciples-a-world-opens-with.js');

    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        const world = state as unknown as TheWorldAsRead;
        const readings: ACensus[] = [census(world, A_BOND_IS_COLD_AT, A_MASTER_LOOKING)];
        for (let done = 0; done < YEARS; done += CENSUS_EVERY) {
            // THE RETURN WAS BEING THROWN AWAY, and it is where the world says
            // what kind of thing just happened. `pressure` is the events the
            // pressure layer generated, each carrying its own kind; `events` is
            // everything the span wrote to the record. Tallying them costs the
            // run nothing - they are already built and already discarded.
            const span = advanceWorldYears(
                state, Math.min(CENSUS_EVERY, YEARS - done), { stopOnInterrupt: false }
            ) as { pressure?: readonly { kind?: unknown }[]; events?: readonly { kind?: unknown }[] };
            const year = done + Math.min(CENSUS_EVERY, YEARS - done);
            for (const event of span.pressure ?? []) {
                if (typeof event?.kind === 'string') noteAKind(kindsOfEvent, event.kind, seed, year);
            }
            for (const fact of span.events ?? []) {
                if (typeof fact?.kind === 'string') noteAKind(kindsOfFact, fact.kind, seed, year);
            }
            readings.push(census(world, A_BOND_IS_COLD_AT, A_MASTER_LOOKING));
        }

        lines.push(
            `== ${seed}, every ${CENSUS_EVERY} years`,
            '    year   alive  everybody     ties  /head  master   cold  looking   objects     jade    slips  lost  off    facts   deaths  /head  nobody'
        );
        let before: ACensus | null = null;
        for (const r of readings) {
            const died = before === null ? 0 : r.deaths - before.deaths;
            const perHead = before === null ? '-' : (died / Math.max(1, r.alive)).toFixed(3);
            before = r;
            lines.push(
                `    ${String(r.year).padStart(6)} ${String(r.alive).padStart(6)} `
                + `${String(r.everybody).padStart(10)} ${String(r.ties).padStart(8)} `
                + `${r.perHead.padStart(6)} ${String(r.masterTies).padStart(7)} `
                + `${String(r.coldBonds).padStart(6)} ${String(r.looking).padStart(8)} `
                + `${String(r.objects).padStart(9)} ${String(r.jade).padStart(8)} `
                + `${String(r.slips).padStart(8)} ${String(r.absencesOpen).padStart(5)} `
                + `${String(r.writtenOff).padStart(4)} ${String(r.facts).padStart(8)} `
                + `${String(died).padStart(8)} ${perHead.padStart(6)} `
                + `${String(r.lookingAtNobody).padStart(7)}`
            );
        }
        // The things themselves, first and last, so a kind that only climbs is
        // named rather than hidden inside a total.
        const first = readings[0]!;
        const last = readings[readings.length - 1]!;
        const firstBy = new Map(first.byKind);
        lines.push('    things by kind, year ' + first.year + ' -> ' + last.year + ':');
        for (const [kind, now] of last.byKind.slice(0, 12)) {
            const was = firstBy.get(kind) ?? 0;
            lines.push(`        ${kind.padEnd(28)} ${String(was).padStart(7)} -> ${String(now).padStart(7)}`
                + `   ${now > was ? '+' : ''}${now - was}`);
        }
        // AND WHICH DEAD THE ROSTER IS KEEPING. `held` is a row something still
        // points at - a tie somebody holds, or a thing they owned or carried -
        // and `loose` is a row nothing anywhere names. A climbing `loose` is a
        // leak; a climbing `held` is the world remembering on purpose.
        const deadBy = new Map(first.dead.byStatus);
        lines.push(`    the dead the roster keeps, year ${first.year} -> ${last.year}:`);
        for (const [status, now] of last.dead.byStatus) {
            const was = deadBy.get(status) ?? 0;
            lines.push(`        ${status.padEnd(28)} ${String(was).padStart(7)} -> ${String(now).padStart(7)}`
                + `   ${now > was ? '+' : ''}${now - was}`);
        }
        lines.push(
            `        something still points at    ${String(first.dead.held).padStart(7)}`
            + ` -> ${String(last.dead.held).padStart(7)}`,
            `        nothing anywhere names       ${String(first.dead.loose).padStart(7)}`
            + ` -> ${String(last.dead.loose).padStart(7)}`
        );
        lines.push(...whatTheRunLeft(world), '');
    }

    lines.push(
        'calls is how many times the board called it across every seed; did is how many of those',
        'left something behind; years is how many distinct years it did something in.',
        '',
        'pass                                     calls      did    share   years  first   last  facts   counted'
    );
    for (const pass of THE_PASSES_WATCHED) {
        const t = tallies.get(pass.name)!;
        lines.push(
            `${pass.name.padEnd(40)} ${String(t.calls).padStart(6)} ${String(t.did).padStart(8)} `
            + `${share(t.did, t.calls).padStart(8)} ${String(t.years.size).padStart(6)} `
            + `${String(t.firstYear ?? '-').padStart(6)} ${String(t.lastYear ?? '-').padStart(6)} `
            + `${String(t.facts).padStart(6)} ${String(t.sum).padStart(8)}`
        );
    }

    // A ZERO FROM A PASS THAT ANSWERS FOR ITSELF IS A FINDING. A zero from one
    // relying on the default read is two things at once, and printing both under
    // one heading is the probe reporting its own reach as a property of the
    // world. Three of the four this listed today wrote rows, ties and
    // obligations every year and emitted no fact, so the default read had
    // nothing to count and they read as inert while changing the world.
    const answersForItself = (p: AWatchedPass) => p.didSomething !== undefined;
    const never = THE_PASSES_WATCHED.filter(
        p => tallies.get(p.name)!.did === 0 && answersForItself(p));
    const unseen = THE_PASSES_WATCHED.filter(
        p => tallies.get(p.name)!.did === 0 && !answersForItself(p)
            && tallies.get(p.name)!.calls > 0);
    const uncalled = THE_PASSES_WATCHED.filter(p => tallies.get(p.name)!.calls === 0);
    lines.push('');
    lines.push(never.length === 0
        ? 'Every pass that can answer for itself did something at least once.'
        : `DID NOTHING IN ${YEARS} YEARS: ${never.map(p => p.name).join(', ')}. `
          + 'Each of these says for itself whether it acted, so a zero here is the '
          + 'world and not the instrument.');
    if (unseen.length > 0) {
        lines.push(
            '',
            `CALLED, AND THIS CANNOT SEE WHETHER THEY ACTED: ${unseen.map(p => p.name).join(', ')}.`,
            'They were called and left no fact, no row and no figure the default read',
            'looks at. That is not a finding about the world: a pass that writes an',
            'obligation, a tie, an activity or a counter is invisible here, and "fired',
            'but did nothing" and "does not report itself" are the same line. Give each',
            'one a `didSomething` off whatever it actually moves before reading its zero',
            'as anything at all.'
        );
    }
    if (uncalled.length > 0) {
        lines.push(
            `NEVER CALLED AT ALL: ${uncalled.map(p => p.name).join(', ')}`,
            'A pass is never called for two different reasons, and this cannot tell them apart:',
            'the board does not call it, or `from` is not the module the CALLER imports it from,',
            'so the wrapper was never the function the board held. Check the import in the caller.'
        );
    }

    // ── AND WHAT KINDS OF THING EVER HAPPENED ────────────────────────────
    const declared = theKindsTheWorldDeclares();
    lines.push(
        '',
        `WHAT KINDS OF THING THE WORLD EVER WROTE, against the ${declared.length} `
        + '`PressureKind` members it declares it can write.',
        '',
        'kind                                     wrote    seeds  first   last'
    );
    for (const kind of declared) {
        const t = kindsOfEvent.get(kind);
        lines.push(
            `${kind.padEnd(40)} ${String(t?.count ?? 0).padStart(6)} `
            + `${String(t?.seeds.size ?? 0).padStart(8)} `
            + `${String(t?.firstYear ?? '-').padStart(6)} ${String(t?.lastYear ?? '-').padStart(6)}`
        );
    }

    const neverWritten = declared.filter(k => (kindsOfEvent.get(k)?.count ?? 0) === 0);
    const undeclared = [...kindsOfEvent.keys()].filter(k => !declared.includes(k)).sort();
    lines.push('');
    // THE LIST IS THE FINDING, not the count, and the sentence says what is
    // absent rather than reporting a number somebody then has to go and look up.
    lines.push(neverWritten.length === 0
        ? `Every kind of thing the world says can happen happened, in ${YEARS} years.`
        : `NOTHING EVER WROTE THESE, in ${YEARS} years across ${SEEDS.length} seed(s): `
          + `${neverWritten.join(', ')}. The world declares it can write them and never `
          + 'did. Either a rule is dead, or a precondition no world reaches guards it, '
          + 'or the kind is a name nothing uses any more - and a grep cannot tell you '
          + 'which, because a grep sees the declaration and the call and not the year '
          + 'that never came.');
    if (undeclared.length > 0) {
        lines.push(
            `WRITTEN BUT NOT DECLARED: ${undeclared.join(', ')}. These came out of a run `
            + 'and are not in `PressureKind`, so this walk would not have covered them '
            + 'and the type does not describe what the world does.'
        );
    }

    // FACTS BY KIND IS THE SAME QUESTION ONE LAYER OUT: the record the player's
    // recap is built from. There is no declared list to walk here, so this one
    // reports what was written rather than what was missing - a kind of fact
    // with a single seed behind it is the one to look at.
    lines.push(
        '',
        `EVERY KIND OF FACT THE RECORD RECEIVED (${kindsOfFact.size} kinds).`,
        '',
        'fact kind                                wrote    seeds  first   last'
    );
    for (const kind of [...kindsOfFact.keys()].sort()) {
        const t = kindsOfFact.get(kind)!;
        lines.push(
            `${kind.padEnd(40)} ${String(t.count).padStart(6)} ${String(t.seeds.size).padStart(8)} `
            + `${String(t.firstYear ?? '-').padStart(6)} ${String(t.lastYear ?? '-').padStart(6)}`
        );
    }
    const onOneSeed = [...kindsOfFact.entries()]
        .filter(([, t]) => t.seeds.size === 1 && SEEDS.length > 1)
        .map(([k]) => k).sort();
    if (onOneSeed.length > 0) {
        lines.push(
            '',
            `WRITTEN IN ONLY ONE SEED: ${onOneSeed.join(', ')}. Not a defect - a kind of `
            + 'thing rare enough that one more seed decides whether it happens at all, '
            + 'which is worth knowing before anybody pins a number to it.'
        );
    }

    mkdirSync(DIR, { recursive: true });
    writeFileSync(LOG, `${lines.join('\n')}\n`, 'utf8');
    console.log(lines.join('\n'));
    console.log(`\nwritten to ${LOG}`);
}, MINUTES * 60_000);
