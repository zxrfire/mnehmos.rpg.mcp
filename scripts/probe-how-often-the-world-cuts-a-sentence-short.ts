/**
 * How often does a real sentence get cut short, and by which of the three?
 *
 * The agency rule names two things that may limit a player - the world, and
 * their own body - and one that may not, which is a rule about how sentences
 * may be shaped. This measures the two that may, AS PLAYED: whole sentences
 * typed into the turn loop, in a pinned world, against a cultivator who can
 * actually sit for a decade.
 *
 * Three causes are counted apart, because until they were joined they were
 * three systems that did not know about each other:
 *
 *   somebody_arrived - the arrival window cut the span before the cultivation
 *                      skip ever saw it
 *   the_world        - a scheduled consequence at this place, or one naming
 *                      this person, landed inside the span
 *   the_body         - the skip's own stop: a wound, an empty pack, a wall
 *
 * And the number the rule is actually about: of the sentences that chained
 * something onto a span, how many had the later clauses cut off. A chain that
 * runs whatever happened is the world not being allowed to act.
 *
 * THE CULTIVATOR IS ARRANGED, THE MEASUREMENT IS PLAYED. Somebody with no
 * manual is refused every long sitting before a day is spent, and somebody with
 * no stones starves out of a month - both are true and neither is what this is
 * measuring, so the fixture hands over a manual and a purse and then types.
 *
 * Run:  npx tsx scripts/probe-how-often-the-world-cuts-a-sentence-short.ts
 *       SEEDS=12 npx tsx scripts/probe-how-often-the-world-cuts-a-sentence-short.ts
 */

import { makeGameInWorld } from '../tests/web/harness.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => {
    line();
    line('='.repeat(78));
    line('  ' + t);
    line('='.repeat(78));
};
const pct = (n: number, of: number) => (of === 0 ? 'n/a' : `${((100 * n) / of).toFixed(1)}%`);

/** The catalog's shortest manual. Enough that a sitting is not refused outright. */
const MANUAL = 'lesser-qi-gathering-manual';

interface Said { text: string; chained: boolean }

/**
 * Sentences a player would type that spend a span, half of them chained.
 *
 * A mix of lengths on purpose: a seven-day errand and a thirty-year sitting are
 * drawn from the same books, and only one of them is likely to be reached by
 * anything.
 */
const SAID: Said[] = [
    { text: 'I sit in seclusion for thirty years', chained: false },
    { text: 'I cultivate for ten years', chained: false },
    { text: 'I cultivate for a year', chained: false },
    { text: 'I wait for a month', chained: false },
    { text: 'I gather herbs', chained: false },
    { text: 'I sit in seclusion for thirty years, then I go to the market', chained: true },
    { text: 'I cultivate for ten years and then look around', chained: true },
    { text: 'I cultivate for a year and then I gather herbs', chained: true },
    { text: 'I wait a month, then I look around', chained: true },
    { text: 'I cultivate for twenty years and then I look around', chained: true }
];

interface Tally {
    spans: number;
    cut: number;
    byCause: Map<string, number>;
    chains: number;
    chainsCut: number;
    /** Later clauses that never ran because something ended the span. */
    clausesNeverReached: number;
    /** Chains whose later clauses ran anyway, for the other side of the rate. */
    chainsRunWhole: number;
    /**
     * Spans the world shortened before anything was spent.
     *
     * Counted apart from `byCause` because the world decides FIRST and the body
     * can still stop things earlier - so the world can shorten a span and never
     * be the reason it ended. Which of those two numbers is bigger is the whole
     * answer to "is the world allowed to act".
     */
    worldWouldHave: number;
}

const empty = (): Tally => ({
    spans: 0, cut: 0, byCause: new Map(), chains: 0, chainsCut: 0,
    clausesNeverReached: 0, chainsRunWhole: 0, worldWouldHave: 0
});

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

async function sweep(seeds: number, quiet: boolean, sectId: string | null): Promise<Tally> {
    const tally = empty();

    for (let s = 0; s < seeds; s++) {
        const { game, repos, db } = await makeGameInWorld({
            seed: `cut-short-run-${s}`,
            worldSeed: `cut-short-world-${s}`,
            worldEnabled: true
        });
        const { cultivator } = await game.newRun('Shen Liefeng');
        // A manual, and a purse deep enough to provision a century. Neither is
        // what is being measured: without a manual every long sitting is refused
        // before a day is spent, and without stones the pack runs out inside a
        // fortnight and the body wins every arm of the comparison.
        repos.techniques.learn(cultivator.id, MANUAL, 0.6);
        db.prepare(
            'UPDATE cultivators SET known_techniques = ?, spirit_stones = 5000000, sect_id = ? '
            + 'WHERE id = ?'
        ).run(JSON.stringify([MANUAL]), sectId, cultivator.id);

        for (const said of SAID) {
            let rows: { name: string; summary: string }[];
            try {
                const result = await game.act(said.text);
                rows = result.toolCalls.map(c => ({ name: c.name, summary: c.summary }));
            } catch {
                continue;
            }

            const planRow = rows.find(r => r.name === 'engine.planCutShort');
            if (rows.some(r => r.name === 'engine.theWorldWouldCutIn')) tally.worldWouldHave++;
            const spanRow = rows.find(r => r.name === 'engine.spanCutShort');
            const skipRow = rows.find(r => r.name === 'engine.simulateTimeSkip');
            // Only turns that actually spent a span are evidence about spans. A
            // sentence the reader sent somewhere else, or one refused before a
            // day was spent, says nothing either way.
            if (skipRow === undefined && spanRow === undefined) continue;

            tally.spans++;
            if (said.chained) tally.chains++;

            // What the engine itself recorded, not what the prose said. The span
            // row is filed on every cut span; the plan row only where a later
            // clause was lost with it.
            const cause = spanRow
                ? /Cut short by (\w+):/.exec(spanRow.summary)?.[1] ?? 'unknown'
                : null;
            if (planRow) {
                tally.clausesNeverReached +=
                    Number(/(\d+) later steps? never ran/.exec(planRow.summary)?.[1] ?? 0);
            }

            if (cause !== null) {
                tally.cut++;
                bump(tally.byCause, cause);
                if (said.chained) tally.chainsCut++;
                if (!quiet) line(`    cut  [${cause}]  ${said.text}`);
            } else if (said.chained) {
                tally.chainsRunWhole++;
            }
        }
    }
    return tally;
}

async function main() {
    const seeds = Number(process.env.SEEDS ?? 6);
    const quiet = process.env.QUIET === '1';

    // TWO ARMS, BECAUSE A HOUSE IS THE ONE THING THE WORLD WRITES THAT CAN
    // REACH A PLAYER. A sect's grant on its vein comes up for renewal every
    // twelve years and a member is party to it; a rogue standing on a site the
    // world has scheduled nothing at is reached by none of it. The difference
    // between the two arms IS the world's channel, measured.
    for (const [label, sectId] of [
        ['ROGUE - nobody\'s disciple', null],
        ['IN A HOUSE - Stone Marrow Hall', 'sect-stone-marrow-hall']
    ] as const) {
        rule(`${label}   (${seeds} worlds x ${SAID.length} sentences)`);
        report(await sweep(seeds, quiet, sectId));
    }
}

function report(t: Tally) {
    line();
    line(`  spans played                 ${t.spans}`);
    line(`  cut short                    ${t.cut}  (${pct(t.cut, t.spans)})`);
    line();
    line('  by cause');
    for (const [cause, n] of [...t.byCause].sort((a, b) => b[1] - a[1])) {
        line(`    ${cause.padEnd(22)} ${String(n).padStart(4)}  (${pct(n, t.spans)} of spans)`);
    }
    line();
    line(`  spans the world shortened   ${t.worldWouldHave}  (${pct(t.worldWouldHave, t.spans)})`);
    line();
    line('  chained sentences - what the rule is actually about');
    line(`    chains played              ${t.chains}`);
    line(`    chains cut off             ${t.chainsCut}  (${pct(t.chainsCut, t.chains)})`);
    line(`    chains that ran whole      ${t.chainsRunWhole}`);
    line(`    later clauses never run    ${t.clausesNeverReached}`);
    line();
}

main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    }
);
