/**
 * Does anything get BIGGER as you climb?
 *
 * Every other harness in this directory asks whether a thing is reachable. This
 * one asks whether it is DIFFERENT, which is a separate question and the one
 * that decides whether climbing forty-six rungs is worth a player's time.
 *
 * The distinction matters because a verb can be perfectly reachable at every
 * height and still be worthless: `market` shows a False Immortal the same
 * twenty-five lines it shows a sixteen-year-old, and `cultivate` pays both of
 * them thirteen progress for a month.
 *
 * ── A CORRECTION THIS FILE OWES ITS OWN FIRST DRAFT ───────────────────────
 * That paragraph originally accused `gather`, on the strength of a run in which
 * it returned Qi Grass worth 2 spirit stones at every one of eleven heights.
 * Measured properly it is the best-scaling verb in the package: 4 stones at
 * ordinal 0 and 9,000 at 45, climbing through 10, 15, 36, 95, 320, 1,200 and
 * 3,200 on the way. Two harness faults produced the false accusation and both
 * are guarded against below - the run was taken against a half-landed edit in
 * another agent's file (see `treeStamp`), and an earlier version seeded each
 * height differently, so which herb the ground held varied with the SEED and
 * not with the person bending over it (see `SEED`).
 *
 * The prose yields to the measurement. It is left here with its retraction
 * attached rather than deleted, because a number nobody can trace is worth less
 * than a number that says what it used to be.
 *
 * So each row below is one verb at every height, and the columns are the
 * numbers a player would actually feel:
 *
 *   - what it COST: days spent, stones spent
 *   - what it GAVE: stones, value, qi, an item worth carrying
 *   - what it DID to a body: damage dealt, damage taken, wounds left
 *
 * A verb passes when its numbers move with the ladder. It fails when the
 * column is flat, and flat is reported as a defect rather than a curiosity -
 * a flat column is forty-five rungs of climbing that bought nothing.
 *
 * TWO LAYERS, MEASURED SEPARATELY
 * The combat engine scales properly; `combatPowerForOrdinal` is a steep curve
 * and the apex simulations lean on it. The verb layer is where scaling gets
 * dropped on the floor. So this measures both - the resolver directly, and the
 * same fight through the sentence a player would type - because when they
 * disagree the defect is in the wiring rather than in the design.
 */

import { readdirSync, statSync } from 'node:fs';

import { makeGame } from '../tests/web/harness.js';
import { SECTS } from '../src/data/cultivation/sects.js';
import { rankName } from '../src/engine/cultivation/realms.js';
import {
    resolveConfrontation, combatPowerForOrdinal, assessPower,
    type CombatantInput, type ConfrontationContext
} from '../src/engine/cultivation/combat.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import type { ImmortalStatus } from '../src/schema/cultivation.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(96)); line('  ' + t); line('='.repeat(96)); };

/**
 * `SAY=1` echoes what the game actually said under every verb row.
 *
 * A column of zeroes is ambiguous between "the verb refused and said why" and
 * "the verb ran and gave nothing", and the two are opposite findings. The prose
 * is never scored - it only disambiguates a number that has already been read
 * out of state.
 */
const SAY = process.env.SAY === '1';

/**
 * The one world every height is measured in. `SEED=... ` to re-run in another.
 *
 * A flat column under one seed is worth much more than a moving column under
 * twelve, because the twelve were never comparable in the first place.
 */
const SEED = process.env.SEED ?? 'one-world';

type Kind = 'works' | 'friction' | 'broken';
const notes: { kind: Kind; text: string }[] = [];
const note = (kind: Kind, text: string) => notes.push({ kind, text });

/**
 * Every height, including the two above the Lid.
 *
 * A False Immortal is a permanent resident up there and can be met; a True
 * Immortal is being expelled the entire time they are below it, so whatever
 * they do has to fit inside ten to fifteen breaths.
 */
const HEIGHTS: { ordinal: number; status: ImmortalStatus }[] = [
    ...[0, 5, 13, 17, 21, 25, 29, 33, 37, 41].map(ordinal => ({ ordinal, status: 'none' as const })),
    { ordinal: 45, status: 'false_immortal' },
    { ordinal: 46, status: 'true_immortal' }
];

type Game = ReturnType<typeof makeGame>['game'];
const cur = (game: Game): any => { const s: any = (game as any).state(); return s.cultivator ?? s; };

/** One cell of a scaling row: what a number was at one height. */
interface Cell { ordinal: number; value: number | string; }

/**
 * A column is flat when every height produced the same number.
 *
 * Strings are compared as strings on purpose - `gather` returns a herb NAME,
 * and a changing name across the ladder is a real (if partial) scaling signal
 * that a numeric-only check would report as flat and miss.
 */
function isFlat(cells: Cell[]): boolean {
    const values = cells.map(c => String(c.value));
    return new Set(values).size <= 1;
}

/**
 * The True Immortal row is not a rung and must not be allowed to count as one.
 *
 * A descended True Immortal is on the far side of the Lid with nobody around
 * them, so almost every verb answers `there are no people here` - a correct and
 * interesting answer, and a DIFFERENT string. Scoring the whole column together
 * therefore turned four dead flat columns into passes: `gather` returned Qi
 * Grass worth 2 stones at every one of eleven heights and scored `ok` on the
 * strength of the twelfth cell being 0. Flatness is judged on the ladder, and
 * the cell above it is printed and excluded.
 */
const BELOW_THE_LID = (c: Cell) => c.ordinal < 46;

function show(label: string, cells: Cell[], unit = ''): void {
    if (cells.length === 0) { line(`  ----  ${label.padEnd(26)} (no cells)`); return; }
    const flat = isFlat(cells.filter(BELOW_THE_LID));
    const body = cells.map(c => `${c.ordinal}:${c.value}${unit}`).join('  ');
    line(`  ${flat ? 'FLAT' : 'ok  '}  ${label.padEnd(26)} ${body}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. THE RESOLVER, WHICH IS THE HALF THAT WORKS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The same fight at every height, against a fixed opponent.
 *
 * The opponent is deliberately held still at ordinal 20 so that the only thing
 * changing between rows is the player. What should be visible is the whole
 * shape of the ladder: badly outmatched at the bottom, an even fight in the
 * middle, and no contest at all once the gap passes the helpless threshold.
 */
/**
 * A LEGAL combatant.
 *
 * `might` caps at 3 and `insight` at 4 (`src/schema/cultivation.ts`), and both
 * sides get the identical sheet, identical spirit root, identical HP and no
 * technique or artifact on either side. The only thing that differs between the
 * two inputs is the rung, which is the whole point: hand one side an art and
 * the swing is 1.4x before the ladder is consulted at all.
 */
function combatant(id: string, name: string, ordinal: number, status: ImmortalStatus): CombatantInput {
    return {
        id, name, realmOrdinal: ordinal, immortalStatus: status,
        hp: 100, maxHp: 100, qi: 500, maxQi: 500,
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
        spiritRoot: 'single_fire', injuries: []
    };
}

/**
 * The context the resolver actually takes.
 *
 * Written blind the first time against a guessed shape - `{ambient:{density,
 * purity}, seed, day, intent:'kill'}` - and every one of those four fields was
 * wrong. `ambient` is a string band from `AmbientQiSchema`, there is no `seed`
 * or `day`, the stream is a `CultivationRNG` handed in whole, and `intent` is
 * an object with a `goal`. The missing `rng` was what threw, and it threw only
 * from ordinal 13 up because below that the gap check returns `no_contest`
 * before a die is rolled - so the two rows that DID print were the two rows
 * where nothing was ever measured.
 */
function fight(ordinal: number, status: ImmortalStatus, against: number) {
    const ctx: ConfrontationContext = {
        rng: forStream('scaling-harness', 'confrontation', ordinal, status),
        ambient: 'normal',
        turn: 1,
        intent: { goal: 'kill', willWithdraw: true }
    };
    return resolveConfrontation(
        combatant('me', 'You', ordinal, status),
        combatant('them', 'A Stranger', against, 'none'),
        ctx
    );
}

function theResolver(): void {
    rule('1. THE RESOLVER - the same opponent, climbed past');

    const OPPONENT = 20;
    const dealt: Cell[] = [];
    const taken: Cell[] = [];
    const wounds: Cell[] = [];
    const powers: Cell[] = [];
    const outcomes: string[] = [];

    line(`  the opponent is held still at ordinal ${OPPONENT} (${rankName(OPPONENT)}), same sheet, no art either side`);
    line();
    line(`  ${'you'.padEnd(34)}${'power'.padStart(14)}${'ratio'.padStart(10)}  ${'outcome'.padEnd(14)}  dealt  taken  wounds`);
    line('  ' + '-'.repeat(100));

    const basePower = assessPower(combatant('x', 'x', OPPONENT, 'none'), { ambient: 'normal' }).total;

    for (const { ordinal, status } of HEIGHTS) {
        let result;
        try {
            result = fight(ordinal, status, OPPONENT);
        } catch (error) {
            line(`  ${rankName(ordinal).padEnd(34)} THREW: ${(error as Error).message.slice(0, 60)}`);
            note('broken', `The resolver threw at ordinal ${ordinal}: ${(error as Error).message}`);
            continue;
        }

        const myHp = result.hp['me'] ?? 0;
        const theirHp = result.hp['them'] ?? 0;
        const power = assessPower(combatant('me', 'You', ordinal, status), { ambient: 'normal' }).total;
        const myWounds = (result.injuries['me'] ?? []).length;

        dealt.push({ ordinal, value: 100 - theirHp });
        taken.push({ ordinal, value: 100 - myHp });
        wounds.push({ ordinal, value: myWounds });
        powers.push({ ordinal, value: power.toFixed(1) });
        outcomes.push(result.outcome);

        line(`  ${rankName(ordinal).padEnd(34)}${power.toFixed(1).padStart(14)}`
            + `${(power / basePower).toFixed(2).padStart(9)}x  `
            + `${result.outcome.padEnd(14)}  ${String(100 - theirHp).padStart(5)}  `
            + `${String(100 - myHp).padStart(5)}  ${String(myWounds).padStart(6)}`);
    }

    line();
    show('assessed power', powers);
    show('damage dealt', dealt);
    show('damage taken', taken);
    show('wounds left on you', wounds);

    const distinct = new Set(outcomes).size;
    if (isFlat(dealt) || isFlat(taken)) {
        note('broken', 'The resolver returns the same damage regardless of who is fighting. Every '
            + 'number in the power system is decorative if this is flat.');
    } else if (distinct < 2) {
        note('broken', `Every height produced the same outcome (${outcomes[0]}) against one fixed `
            + 'opponent, so the ladder does not decide fights.');
    } else {
        note('works', `Damage moves with height and the fixed opponent produces ${distinct} distinct `
            + `outcomes across the ladder (${[...new Set(outcomes)].join(', ')}) - the resolver reads the gap.`);
    }

    // ── The mirror: does climbing help against somebody climbing with you? ──
    // The row above conflates two things - being stronger, and being stronger
    // THAN THIS PERSON. Holding the gap fixed at one realm and sliding both up
    // the ladder separates them, and answers the question a player at rung 40
    // actually has: is a fight up here different from a fight down there, or is
    // it the same fight with bigger nouns?
    rule('1b. THE MIRROR - the same GAP, at every altitude');
    line(`  ${'you'.padEnd(34)}${'vs'.padEnd(30)}  ${'outcome'.padEnd(14)}  dealt  taken  exch`);
    line('  ' + '-'.repeat(100));

    const mirrorOutcomes: string[] = [];
    const mirrorDealt: Cell[] = [];
    const mirrorExchanges: Cell[] = [];
    for (const { ordinal, status } of HEIGHTS) {
        const below = Math.max(0, ordinal - 4);
        let result;
        try {
            result = fight(ordinal, status, below);
        } catch (error) {
            note('broken', `The mirror threw at ordinal ${ordinal}: ${(error as Error).message}`);
            continue;
        }
        const theirHp = result.hp['them'] ?? 0;
        mirrorOutcomes.push(result.outcome);
        mirrorDealt.push({ ordinal, value: 100 - theirHp });
        mirrorExchanges.push({ ordinal, value: result.exchanges.length });
        line(`  ${rankName(ordinal).padEnd(34)}${rankName(below).padEnd(30)}  `
            + `${result.outcome.padEnd(14)}  ${String(100 - theirHp).padStart(5)}  `
            + `${String(100 - (result.hp['me'] ?? 0)).padStart(5)}  `
            + `${String(result.exchanges.length).padStart(4)}`);
    }
    line();
    show('damage dealt', mirrorDealt);
    show('exchanges taken', mirrorExchanges);
    if (isFlat(mirrorDealt) && isFlat(mirrorExchanges)) {
        note('friction', 'A four-rung gap resolves identically at the bottom of the ladder and at the '
            + 'top. Climbing changes who you can beat, but a fight against your own near-peer is the '
            + 'same fight at every altitude - which is a design answer, not necessarily a defect.');
    } else {
        note('works', 'A fixed four-rung gap does NOT resolve identically at every altitude: '
            + `outcomes ${[...new Set(mirrorOutcomes)].join(', ')}.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. THE VERB LAYER, WHICH IS THE HALF THAT DOES NOT
// ─────────────────────────────────────────────────────────────────────────

/** A verb, and the numbers worth watching when it resolves. */
interface Probe {
    say: string;
    why: string;
    /** Pulled from the cultivator before and after, so a flat column is visible. */
    read: (before: any, after: any, said: string) => Record<string, number | string>;
    /**
     * The columns a player would expect to GROW, named explicitly.
     *
     * Without this every flat column reads as a defect, and most of them are
     * not: `battlesSurvived` goes up by exactly one per fight at every height
     * and is supposed to, and a seven-day forage is seven days by design.
     * Naming the columns that carry the claim is the difference between a
     * finding and a list of counters incrementing correctly.
     */
    mustScale: string[];
}

const PROBES: Probe[] = [
    {
        say: 'I gather what herbs I can find',
        why: 'the ordinary trade, at every height',
        read: (before, after, said) => ({
            days: after.elapsedDays - before.elapsedDays,
            found: (said.match(/one ([A-Z][\w' -]+?)[,.]/)?.[1] ?? 'nothing'),
            worth: Number(said.match(/worth about (\d+)/)?.[1] ?? 0)
        }),
        mustScale: ['worth']
    },
    {
        say: 'I cultivate for a month',
        why: 'the thing the whole game is named after',
        read: (before, after) => ({
            // `qi` is the POOL and refills; the thing a month of breathing buys
            // is `cultivationProgress`. Reading `qi` here was the harness's own
            // bug and reported a working verb as flat.
            progress: Math.round(after.cultivationProgress - before.cultivationProgress),
            days: after.elapsedDays - before.elapsedDays,
            age: (after.age - before.age).toFixed(2)
        }),
        mustScale: ['progress']
    },
    {
        say: 'I take any work I can get for a season',
        why: 'earning, which should get easier as you get rarer',
        read: (before, after) => ({
            stones: after.spiritStones - before.spiritStones,
            days: after.elapsedDays - before.elapsedDays
        }),
        mustScale: ['stones']
    },
    {
        say: 'I attack the nearest cultivator',
        why: 'the resolver, reached through a sentence instead of an import',
        read: (before, after) => ({
            hpLost: before.hp - after.hp,
            wounds: after.injuries.length - before.injuries.length,
            fights: after.battlesSurvived - before.battlesSurvived,
            won: after.battlesWon - before.battlesWon
        }),
        // One fight is one fight at every height, and `battlesSurvived` going up
        // by exactly one everywhere is the counter working rather than a flat
        // curve. What should move is how much of the fight you wear.
        mustScale: ['hpLost']
    },
    {
        say: 'I go to the market and see what is for sale',
        why: 'what the world is willing to show you',
        read: (_before, _after, said) => ({
            onOffer: Number(said.match(/of (\d+) things on offer/)?.[1] ?? 0),
            // Prices on this board are quoted in CASH as well as in stones, and
            // the first pass matched only `stones` - so a board of twenty-five
            // priced lines read as zero lines and scored as a flat column for
            // the wrong reason entirely.
            dearest: Math.max(0, ...(said.match(/(\d[\d,]*)\s+(?:cash|stones?)/g) ?? ['0'])
                .map(s => Number(s.replace(/\D/g, ''))))
        }),
        mustScale: ['onOffer', 'dearest']
    },
    {
        say: 'I apply to the Azure Dew Sect',
        why: 'a door whose bar should be beneath a Nascent Soul cultivator',
        read: (before, after, said) => ({
            joined: after.sectId ? 'yes' : 'no',
            rank: String(after.sectRank ?? '-'),
            said: said.slice(0, 34).replace(/\s+/g, ' ')
        }),
        mustScale: ['joined']
    },
    {
        // The same door, said the other way. `petition` and `sect` both match a
        // sentence naming a house, and which one wins decides whether the
        // player joins anything - so the two phrasings are measured separately
        // rather than assumed equivalent.
        say: 'I ask to join the Azure Dew Sect as a disciple',
        why: 'the same door, phrased so the sect verb should take it',
        read: (_before, after) => ({
            joined: after.sectId ? 'yes' : 'no',
            rank: String(after.sectRank ?? '-')
        }),
        // A False Immortal and a sixteen-year-old should not walk in on the same
        // rung. If `rank` is flat, the door reads nothing about who knocked.
        mustScale: ['rank']
    },
    {
        say: 'I go into closed-door seclusion for ten years',
        why: 'a decade, which is what climbing actually costs at height',
        read: (before, after) => ({
            years: Math.round((after.elapsedDays - before.elapsedDays) / 365),
            progress: Math.round(after.cultivationProgress - before.cultivationProgress),
            rungs: after.realmOrdinal - before.realmOrdinal,
            wounds: after.injuries.length - before.injuries.length,
            alive: after.alive ? 'yes' : 'NO'
        }),
        // A decade should not buy the same thing at the bottom and at the top.
        // If it does, the ladder above the middle is a wall with rungs painted
        // on it.
        mustScale: ['progress']
    }
];

/**
 * The whole persisted position, not one field of it.
 *
 * The first version of this read `after.daysElapsed - before.daysElapsed` and
 * `after.qi - before.qi`. Neither field exists on a `Cultivator`: elapsed time
 * lives on the RUN as `elapsedDays`, and what cultivating buys is
 * `cultivationProgress`. Both differences were therefore `0 - 0` at every
 * height, and the harness reported two working verbs as FLAT across
 * forty-six rungs. A missing field and a flat curve look identical from the
 * outside, which is exactly why the snapshot is taken whole and diffed.
 */
function snapshot(game: Game): any {
    const s: any = (game as any).state();
    return { ...s.cultivator, elapsedDays: s.run.elapsedDays, turn: s.run.turn };
}

/** Fields that move on their own and would drown the diff in noise. */
const NOISE = new Set(['id', 'runId', 'name', 'kind', 'turn']);

/** Everything that actually changed, so `done` can be told from `done nothing`. */
function changed(before: any, after: any): string[] {
    const out: string[] = [];
    for (const key of Object.keys(after)) {
        if (NOISE.has(key)) continue;
        const a = JSON.stringify(before[key]);
        const b = JSON.stringify(after[key]);
        if (a !== b) out.push(key);
    }
    return out;
}

async function theVerbs(): Promise<void> {
    rule('2. THE VERB LAYER - the same sentence, typed at every height');

    for (const probe of PROBES) {
        line(`\n  "${probe.say}"  - ${probe.why}`);
        const columns = new Map<string, Cell[]>();
        const routed: Cell[] = [];
        const touched: Cell[] = [];
        const narrations: [number, string][] = [];

        for (const { ordinal, status } of HEIGHTS) {
            // ONE SEED FOR THE WHOLE COLUMN.
            //
            // The first version seeded each height `scale-${ordinal}`, so every
            // row got a different world: a different starting place, a different
            // ambient band, a different herb table roll. `gather` then returned
            // 10, 20, 20, 2, 6, 150, 9, 150, 15, 15, 95 stones up the ladder and
            // the harness scored that `ok - it moves`. It does move. It moves
            // with the SEED. Holding the seed still is what makes a difference
            // between two cells attributable to the only thing left that varies,
            // which is the rung.
            const { game, repos } = makeGame({ seed: SEED, worldEnabled: true });
            await (game as any).newRun('Subject');
            const me = cur(game);
            repos.cultivators.update(me.id, {
                realmOrdinal: ordinal, immortalStatus: status, spiritStones: 1_000,
                attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
            } as never);
            for (const s of SECTS) {
                (game as any).knowledge.learnIfNew({
                    holderId: me.id, kind: 'sect', id: s.id, name: s.name,
                    onDay: 0, sourceKind: 'told', sourceNote: 'a name said in a market town'
                });
            }

            // Proof the seat took. If this is not the ordinal we asked for, the
            // whole row is measuring an ordinal-0 beginner twelve times.
            const before = snapshot(game);
            if (before.realmOrdinal !== ordinal || before.immortalStatus !== status) {
                note('broken', `The seat did not take at ordinal ${ordinal}: the game reports `
                    + `${before.realmOrdinal}/${before.immortalStatus}. Every row is measuring the wrong person.`);
                return;
            }

            let said = '';
            let action = '?';
            try {
                const r: any = await (game as any).act(probe.say);
                said = String(r?.narration ?? '');
                action = String(r?.toolCalls?.find((t: any) => t.name !== 'plan')?.action
                    ?? r?.toolCalls?.[0]?.action ?? '?');
            } catch (error) {
                note('broken', `"${probe.say}" threw at ordinal ${ordinal}: ${(error as Error).message}`);
                continue;
            }
            const after = snapshot(game);

            routed.push({ ordinal, value: action });
            touched.push({ ordinal, value: changed(before, after).join('+') || 'NOTHING' });
            narrations.push([ordinal, said.replace(/\s+/g, ' ').slice(0, 200)]);

            for (const [key, value] of Object.entries(probe.read(before, after, said))) {
                columns.set(key, [...(columns.get(key) ?? []), { ordinal, value }]);
            }
        }

        show('routed to', routed);
        show('state fields written', touched);
        if (touched.length > 0 && touched.every(c => c.value === 'NOTHING')) {
            note('broken', `"${probe.say}" routes to \`${routed[0]?.value}\` and writes nothing to the `
                + 'cultivator at ANY height. It answers and it does not happen.');
        }
        for (const [key, cells] of columns) {
            show(key, cells);
            // Only the columns the probe put its claim on are scored. A flat
            // counter is a counter; a flat REWARD across forty-six rungs is the
            // finding, and conflating them buries the second in the first.
            if (!probe.mustScale.includes(key)) continue;
            const ladder = cells.filter(BELOW_THE_LID);
            if (isFlat(ladder)) {
                note('broken',
                    `"${probe.say}" returns the same ${key} (${cells[0]?.value}) at ordinal 0 and at `
                    + 'ordinal 45. Forty-five rungs of climbing bought nothing a player can feel here.');
                continue;
            }
            // A column can move at the bottom and stop. That is the worse
            // shape of the two, because the player is taught by the early
            // rungs that the number responds and then climbs thirty more
            // that it does not - and a whole-column check calls it a pass.
            const top = ladder.filter(c => c.ordinal >= 21);
            if (top.length >= 3 && !isFlat(top)) {
                // Say what WORKS as loudly as what does not. A findings block
                // that only ever accuses is a findings block nobody trusts when
                // it accuses something real.
                note('works', `"${probe.say}" scales all the way: ${key} runs `
                    + `${ladder[0].value} at ordinal ${ladder[0].ordinal} to `
                    + `${ladder[ladder.length - 1].value} at ${ladder[ladder.length - 1].ordinal}, `
                    + `and is still moving above ordinal 21 (${top.map(c => c.value).join(' -> ')}).`);
            }
            if (top.length >= 3 && isFlat(top)) {
                note('friction',
                    `"${probe.say}" moves ${key} across the low ladder and then PLATEAUS: `
                    + `${top[0].value} at every height from ordinal ${top[0].ordinal} to `
                    + `${top[top.length - 1].ordinal}. The column passes a whole-ladder flatness `
                    + 'check and is flat where most of the climbing happens.');
            }
        }
        if (SAY) for (const [ordinal, text] of narrations) line(`      ${ordinal}: ${text}`);
    }
}

/**
 * Was the tree standing still while this ran?
 *
 * Several agents work this repo at once, and a verb row measured across a
 * landing edit is not evidence about anything - the routing table can change
 * between the first height and the twelfth, and the column that results is an
 * artifact of the clock. So the source the verb layer depends on is stamped
 * before and after, and a run that straddles an edit says so at the top of its
 * own findings rather than being quietly reported as a measurement.
 */
function treeStamp(): string {
    // The whole of `src/`, not the three files this leans on hardest. A run
    // once came back with every verb throwing and a stamp that had not moved,
    // because the half-landed edit was in a data catalog several imports away.
    const walk = (dir: URL): string[] => {
        const out: string[] = [];
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
            if (entry.isDirectory()) out.push(...walk(child));
            else if (entry.name.endsWith('.ts')) out.push(String(statSync(child).mtimeMs));
        }
        return out;
    };
    try { return walk(new URL('../src/', import.meta.url)).join(','); } catch { return 'unreadable'; }
}

/**
 * The same seed, twice, from a cold game.
 *
 * "Same seed and input produce an identical result" is a charter claim, and a
 * scaling table is worth nothing without it - a column that moves because the
 * run is not reproducible looks exactly like a column that moves because the
 * ladder is being read. This runs each verb twice in two fresh worlds on one
 * seed and prints the pair.
 */
/** Verbs whose columns are withdrawn, because they do not answer the same twice. */
const unreproducible: string[] = [];

async function theSameTwice(): Promise<void> {
    rule('3. REPRODUCIBILITY - the same seed, run twice');
    line('  A verb that answers differently under one seed cannot be used as evidence about');
    line('  height, because a moving column and a noisy one are indistinguishable.');
    line();

    for (const probe of PROBES) {
        const runs: string[] = [];
        for (const pass of [1, 2]) {
            const { game, repos } = makeGame({ seed: SEED, worldEnabled: true });
            await (game as any).newRun('Subject');
            const me = cur(game);
            repos.cultivators.update(me.id, {
                realmOrdinal: 13, spiritStones: 1_000,
                attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
            } as never);
            for (const s of SECTS) {
                (game as any).knowledge.learnIfNew({
                    holderId: me.id, kind: 'sect', id: s.id, name: s.name,
                    onDay: 0, sourceKind: 'told', sourceNote: 'a name said in a market town'
                });
            }
            const before = snapshot(game);
            let said = '';
            try { said = String((await (game as any).act(probe.say))?.narration ?? ''); }
            catch (error) { said = `THREW ${(error as Error).message}`; }
            const after = snapshot(game);
            runs.push(JSON.stringify(probe.read(before, after, said)) + '|' + changed(before, after).join('+'));
            void pass;
        }
        const same = runs[0] === runs[1];
        line(`  ${same ? 'ok  ' : 'DIFF'}  ${probe.say.slice(0, 46).padEnd(48)}${runs[0].slice(0, 60)}`);
        if (!same) {
            line(`        ${' '.repeat(48)}${runs[1].slice(0, 60)}`);
            unreproducible.push(probe.say);
            note('broken', `"${probe.say}" is NOT reproducible: two cold runs on seed "${SEED}" at the `
                + 'same ordinal disagree. Every column this verb contributes to is unreadable until '
                + 'it draws from the run seed, and the charter requires it to.');
        }
    }
}

async function main(): Promise<void> {
    const stampBefore = treeStamp();

    theResolver();
    await theVerbs();
    await theSameTwice();

    // A file changing is not the defect; an ANSWER changing is. Several agents
    // work this repository at once and `src/` is saved every few seconds, so a
    // guard that demands a motionless tree either never passes or gets lowered
    // until it means nothing. Section 3 above already runs every verb twice on
    // one seed against the tree as it stands at the END of the run, so a moved
    // stamp with a clean section 3 is a table that survived whatever landed
    // under it, and a moved stamp with a dirty section 3 is two builds mixed.
    if (stampBefore !== treeStamp()) {
        // Per verb, not per run. `attack` failing to reproduce is a property of
        // `attack` and would fail on a frozen tree too; saying "no number here
        // should be quoted" because of it would throw away seven honest columns
        // to protect one. So the unreproducible verbs are NAMED, their columns
        // are the ones withdrawn, and the rest of the table stands.
        note('friction',
            `src/ changed while this ran - it changes constantly with several agents in the `
            + 'repository. Section 3 re-ran every verb twice against the tree as it stands NOW. '
            + (unreproducible.length === 0
                ? 'All of them reproduced, so nothing that landed underneath altered a row and the '
                + 'whole table stands.'
                : `These did not reproduce and their columns are withdrawn: ${unreproducible
                    .map(s => `"${s}"`).join('; ')}. Every other column stands.`));
    }

    rule('FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as Kind[]) {
        const hits = notes.filter(n => n.kind === kind);
        if (hits.length === 0) continue;
        line(`\n  ${kind.toUpperCase()} (${hits.length})`);
        for (const h of hits) line(`    ${h.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
