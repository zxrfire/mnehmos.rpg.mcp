/**
 * What a played corpus still comes back refusing, by verb - and which of those
 * refusals is the game failing to understand.
 *
 * The instrument behind the 348-turn audit in
 * `a-near-synonym-reaches-the-same-answer.test.ts`: play the sentences a player
 * actually types, in several situations and pinned worlds, and count which verb
 * was chosen and whether the turn answered.
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
 *              pouch, names that can be pointed at.
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
 * ── WHAT IT READ, THE DAY THE SPLIT WAS ADDED ───────────────────────────
 *
 *   2232 turns, 9 scenarios x 2 pinned worlds
 *     ok:false, the old figure        977   43.8%
 *     the engine could not answer     342   15.3%
 *     it answered with a refusal      635   28.4%
 *         acted, world said no         90    4.0%
 *         a precondition unmet        545   24.4%
 *
 * The headline the directive is actually about is 15.3%, not 43.8%, and it is
 * **19 distinct sentences** repeated across every scenario - not a long tail.
 * Arson, vandalism, napping, praying, climbing, singing, showing off, teaching
 * somebody a form, and two bare back-references (`more`, `why`). Verbs that do
 * not exist, rather than verbs that misread.
 *
 * And the comparison the single figure could not make:
 *
 *   cultivate     100% given a beginner -> 0% given a method. A gate, and the
 *                 precondition was the whole of it.
 *   destinations  100% -> 0% everywhere, once an empty perception stopped
 *                 filing as a refusal.
 *   give/request  ~78% and 100% in EVERY scenario including the furnished
 *                 ones. Not the fixture. What is left is one defect wearing
 *                 three hats: a pronoun (`he`, `his`, `it`) does not resolve
 *                 to somebody standing here, so `I press the pill into his
 *                 hand` refuses for want of a recipient while six people are
 *                 listed in the same sentence.
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

import { makeGameInWorld } from '../tests/web/harness.js';
import { SENTENCES } from './sentences-a-player-would-actually-type.js';

// Furnishing is ADMIN, and ADMIN is read off the process at start.
process.env.ADMIN_MODE = 'true';

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

const SAID: string[] = [
    ...SENTENCES.map(s => s.text),
    ...NOTHING_BUT_A_REFERENCE,
    ...AT_A_PERSON
];

/**
 * What the turn was, once the three unlike outcomes under `ok: false` are told
 * apart. See the banner.
 */
type Verdict = 'answered' | 'not_understood' | 'world_refused' | 'precondition';

interface Row {
    said: string;
    situation: string;
    /** LEAN or FURNISHED. Reported apart, never pooled into the headline. */
    fixture: Fixture;
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
 * NOT. The second half is `tests/web/a-scenario-the-probe-measures-is-one-a-
 * player-can-reach.test.ts`, which gets to each of these states by typing
 * sentences from a fresh run with no admin verb anywhere. An arrangement that
 * no player can reach measures a state nobody occupies, and hides a gameplay
 * defect behind a tidy number - so the two are kept apart and both are
 * required.
 */
interface Scenario {
    /** Reads as a GIVEN: "given a cultivator practising a method". */
    given: string;
    fixture: Fixture;
    arrange(act: Act): Promise<void>;
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
// ladder. The artifact is also the purse: granting one puts real stones in it.
const THINGS_IN_THE_POUCH = [
    'ADMIN grant_item kind=pill name=Qi Gathering Pill quantity=3',
    'ADMIN grant_item kind=artifact ordinal=8'
];

const SCENARIOS: readonly Scenario[] = [
    // ── LEAN. Unchanged, in the same worlds, so every figure reported off this
    // probe before today stays comparable.
    {
        given: 'a beginner with nothing', fixture: 'lean',
        arrange: async () => { /* a fresh run is the arrangement */ }
    },
    {
        given: 'a beginner who has just read a listing', fixture: 'lean',
        arrange: act => say(act, 'what do I know', 'I look at the wall')
    },
    {
        given: 'a beginner who tried to join a house', fixture: 'lean',
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
        given: 'a cultivator practising a method', fixture: 'furnished',
        arrange: practisingAMethod
    },
    {
        given: 'a pouch with things in it and a purse', fixture: 'furnished',
        arrange: act => say(act, ...THINGS_IN_THE_POUCH)
    },
    {
        given: 'somebody standing here the player can name', fixture: 'furnished',
        arrange: act => say(act, A_PERSON_STANDING_HERE),
        // `spawn_encounter` writes a stored cultivator row and NOT a world
        // `NpcRecord`, so `guard` reaches this person and then refuses at
        // `guard.notAWorldRecord`. It is the right arrangement for `request`
        // and `give`, which only need somebody resolvable, and the wrong one
        // for `guard`.
        caveat: 'the spawned person is a stored row, not a world record'
    },
    {
        given: 'roads the player can name and set out for', fixture: 'furnished',
        arrange: act => say(act, NAMES_THAT_CAN_BE_POINTED_AT)
    },
    {
        given: 'membership in a house, at a rank', fixture: 'furnished',
        arrange: onAHouseRoll
    },
    {
        given: 'all of it at once', fixture: 'furnished',
        arrange: async act => {
            await say(act, NAMES_THAT_CAN_BE_POINTED_AT, A_PERSON_STANDING_HERE, ...THINGS_IN_THE_POUCH);
            await practisingAMethod(act);
            await onAHouseRoll(act);
        }
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

function verdictFor(declined: readonly Call[], spent: number, threw: boolean): Verdict {
    if (threw) return 'not_understood';
    if (declined.length === 0) return 'answered';
    if (declined.some(isTheReadingLayer)) return 'not_understood';
    return spent > 0 ? 'world_refused' : 'precondition';
}

async function main(): Promise<void> {
    const rows: Row[] = [];
    for (const worldSeed of ['refusal-audit-a', 'refusal-audit-b']) {
        for (const scenario of SCENARIOS) {
            // EVERY WORLD IS PINNED. An unpinned `worldEnabled` game mints one
            // from `randomUUID()`, so who is standing here and what the stall
            // carries differ every run - which is the arrangement quietly
            // becoming a different arrangement, and reads exactly like flake.
            const { game } = await makeGameInWorld({
                seed: `${worldSeed}-${scenario.given}`, worldSeed, adminMode: true
            });
            let opened = 0;
            const open = async () => {
                await game.newRun(`Prober${opened++}`);
                try {
                    await scenario.arrange(said => game.act(said));
                } catch { /* an arrangement that fails is still a state worth measuring */ }
            };
            await open();

            /** The clock, which is how an attempt is told from a precondition. */
            const clock = (): number => {
                try { return game.state().run.elapsedDays; } catch { return 0; }
            };

            for (const said of SAID) {
                let refused = true;
                let why = 'threw';
                let verb = 'threw';
                let intent: string | undefined;
                let verdict: Verdict = 'not_understood';
                let spent = 0;
                const before = clock();
                try {
                    const turn = await game.act(said);
                    const plan = turn.toolCalls.find(c => c.name === 'narrator.plan');
                    verb = plan?.action ?? 'none';
                    intent = /intent=([a-z_]+)/.exec(plan?.summary ?? '')?.[1];
                    const declined = turn.toolCalls.filter(
                        call => !call.ok && !call.name.startsWith('narrator.')
                    ) as Call[];
                    refused = declined.length > 0;
                    why = declined.map(c => `${c.name}/${c.action}`).join(' ');
                    spent = Math.max(0, clock() - before);
                    verdict = verdictFor(declined, spent, false);
                } catch (err) {
                    const message = (err as Error).message;
                    why = `threw: ${message}`;
                    // A DEAD PROBER MEASURES NOTHING. Every turn after a death
                    // comes back refused for one reason, and the whole tail of
                    // the corpus reads as a reading defect.
                    if (/is dead|run is closed|no live run/i.test(message)) {
                        await open();
                        const reopened = clock();
                        try {
                            const turn = await game.act(said);
                            const plan = turn.toolCalls.find(c => c.name === 'narrator.plan');
                            verb = plan?.action ?? 'none';
                            const declined = turn.toolCalls.filter(
                                call => !call.ok && !call.name.startsWith('narrator.')
                            ) as Call[];
                            refused = declined.length > 0;
                            why = declined.map(c => `${c.name}/${c.action}`).join(' ');
                            spent = Math.max(0, clock() - reopened);
                            verdict = verdictFor(declined, spent, false);
                        } catch (second) {
                            why = `threw twice: ${(second as Error).message}`;
                            verdict = 'not_understood';
                        }
                    } else {
                        verdict = 'not_understood';
                    }
                }
                rows.push({
                    said, situation: scenario.given, fixture: scenario.fixture,
                    world: worldSeed, verb, intent, refused, verdict, spent, why
                });
            }
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

    console.log('\nby scenario');
    for (const scenario of SCENARIOS) {
        const got = rows.filter(r => r.situation === scenario.given);
        if (got.length === 0) continue;
        const n = (v: Verdict) => got.filter(r => r.verdict === v).length;
        console.log(
            `  given ${scenario.given.padEnd(48)} ${String(got.length).padStart(4)} turns  `
            + `blank ${String(n('not_understood')).padStart(4)}  `
            + `world ${String(n('world_refused')).padStart(4)}  `
            + `gate ${String(n('precondition')).padStart(4)}`
            + (scenario.caveat ? `\n        caveat: ${scenario.caveat}` : '')
        );
    }

    gateOrBug(rows);

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

await main();
