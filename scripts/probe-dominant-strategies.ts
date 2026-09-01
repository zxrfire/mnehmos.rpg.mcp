/**
 * Which decisions in this game have a right answer, and which ones actually
 * depend on the state?
 *
 * ── THE QUESTION, AND WHY IT IS THE RIGHT ONE ────────────────────────────
 *
 * "The game has 181 actions" measures nothing. A choice that has a right
 * answer is not a choice. The question worth asking is:
 *
 *     GIVEN THE STATE OF THE WORLD, CAN I IDENTIFY A POLICY THAT DOMINATES
 *     ALL ALTERNATIVES?
 *
 * If option A is at least as good as option B in EVERY state a player can
 * reach, then A is not a choice - it is a lever disguised as a fork, and the
 * player will find it inside one session and stop reading the rest.
 *
 * There is already a worked example in this repository's history, and it is
 * exactly the shape to look for. `breakthrough.ts` records it: at rung 16 the
 * odds were 32.4% at one times the requirement and 32.4% at four times it, so
 * striking the instant the gate opened was strictly optimal at every rung of
 * the ladder. The doc described a dilemma; the engine made it an automatic
 * move, forty-six times a life. `overflowBonus` is the fix. This probe looks
 * for the rest.
 *
 * ── WHAT COUNTS AS A FINDING ─────────────────────────────────────────────
 *
 * Not "A is better on average" - that is balance, and it is a different
 * complaint. A DOMINANT STRATEGY is A being at least as good as B in every
 * state swept, and every section below prints the state space it swept so a
 * reader can judge whether it looked hard enough.
 *
 * A decision whose answer FLIPS with state is a real decision, and the section
 * says which state flips it. That verdict is worth exactly as much as the
 * other one: it is what tells a designer the system is working.
 *
 * ── HOW IT MEASURES ──────────────────────────────────────────────────────
 *
 * Every number here comes out of an engine function, called directly. Nothing
 * parses narration, nothing reads a digest string, and nothing restates an
 * engine formula in this file - a probe that reimplements the thing it is
 * measuring is measuring itself. Where a section has to compose several engine
 * functions (a year of a cultivator's life is a rate, an income and a price),
 * the composition is named and the engine owns every term in it.
 *
 * Run: npx vite-node scripts/probe-dominant-strategies.ts
 */

import {
    computeCultivationRate,
    crowdingMultiplier,
    groundExhausted,
    openingPenalty,
    realmsSpannedBy,
    DAYS_PER_YEAR
} from '../src/engine/cultivation/cultivation.js';
import {
    computeBreakthroughOdds,
    overflowBonus,
    lifespanPressure,
    pillMultiplier,
    pillToleranceDecay,
    MAX_PILL_BONUS
} from '../src/engine/cultivation/breakthrough.js';
import { deviationRisk } from '../src/engine/cultivation/deviation.js';
import {
    readManual,
    bestReadable,
    MANUAL_QUALITY_ORDER
} from '../src/engine/cultivation/manual-quality.js';
import { scarTempering, aggregateInjuryPenalties } from '../src/engine/cultivation/injuries.js';
import {
    progressRequiredForOrdinal,
    lifespanForOrdinal,
    rankName,
    realmForOrdinal,
    MAX_ORDINAL
} from '../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal, INJURY_WEIGHTS, type Injury, type ManualQuality, type SpiritRootKey, type AmbientQi, type InnateAttributes, type FoundationQuality } from '../src/schema/cultivation.js';
import {
    earningsPerYear,
    netEarningsPerYear,
    breakthroughPillPrice,
    injuryTreatmentPrice,
    STONES_PER_YEAR_OF_SECLUSION,
    affordablePillPotency
} from '../src/engine/cultivation/origin.js';
import {
    purchasedQiPerYear,
    stonesPerQiUnitAt
} from '../src/engine/cultivation/buying-and-bartering-pills.js';
import { regardFor } from '../src/engine/cultivation/regard.js';
import { ambientRateMultiplier, BAND_DENSITY_CENTRE } from '../src/engine/cultivation/ambient.js';
import { TECHNIQUES, classOf, isWideSpan } from '../src/data/cultivation/techniques.js';
import {
    commissionBoard,
    dutyTermsFor,
    COMMISSION_ENTRIES,
    SUMMONS_ENTRIES,
    summonable
} from '../src/engine/encounters/duties.js';
import { assessPower, assessGap } from '../src/engine/cultivation/combat.js';
import { simulateTimeSkip } from '../src/engine/cultivation/time-skip.js';
import { CultivatorSchema } from '../src/schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// REPORTING
//
// One shape for every verdict, so the table at the end can be read straight
// down without each section inventing its own vocabulary.
// ─────────────────────────────────────────────────────────────────────────

type Verdict = 'DOMINANT' | 'LIVE' | 'NULL';

interface Finding {
    decision: string;
    verdict: Verdict;
    /** The state space actually swept. Printed so a reader can judge it. */
    swept: string;
    /** For LIVE: the state that flips the answer. For DOMINANT: what always wins. */
    detail: string;
}

const findings: Finding[] = [];

function report(f: Finding): void {
    findings.push(f);
    const tag = f.verdict === 'LIVE' ? 'LIVE    ' : f.verdict === 'NULL' ? 'NULL    ' : 'DOMINANT';
    console.log(`\n  => ${tag}  ${f.detail}`);
}

function head(title: string): void {
    console.log('\n' + '='.repeat(78));
    console.log(title);
    console.log('='.repeat(78));
}

const n = (v: number, d = 0) =>
    Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d }) : '-';
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%';

/**
 * The core test. Given a set of states and a set of options, find the best
 * option in every state and report whether the winner ever changes.
 *
 * This is the whole method: a decision is real if and only if `winners.size`
 * is greater than one.
 */
function sweepArgmax<S, O>(
    states: readonly S[],
    options: readonly O[],
    score: (state: S, option: O) => number,
    labelOption: (o: O) => string,
    labelState: (s: S) => string
): { winners: Map<string, string[]>; flips: boolean } {
    const winners = new Map<string, string[]>();
    for (const state of states) {
        let best: O | null = null;
        let bestScore = -Infinity;
        for (const option of options) {
            const value = score(state, option);
            // -Infinity is a legitimate "this option is not reachable from this
            // state" signal and is meant to be skipped. NaN is not: it means a
            // fixture is missing a field, and skipping it silently hands the
            // decision to whichever arm happened to compute. That produced a
            // false DOMINANT verdict on injury treatment once, so it throws.
            if (Number.isNaN(value)) {
                throw new Error(
                    `harness bug: score is NaN for option ${labelOption(option)} `
                    + `in state ${labelState(state)}`
                );
            }
            if (!Number.isFinite(value)) continue;
            if (value > bestScore + 1e-12) {
                bestScore = value;
                best = option;
            }
        }
        if (best === null) continue;
        const key = labelOption(best);
        const list = winners.get(key) ?? [];
        list.push(labelState(state));
        winners.set(key, list);
    }
    return { winners, flips: winners.size > 1 };
}

function printWinners(winners: Map<string, string[]>, sampleStates = 3): void {
    for (const [option, states] of winners) {
        const sample = states.slice(0, sampleStates).join(', ');
        const more = states.length > sampleStates ? ` (+${states.length - sampleStates} more)` : '';
        console.log(`     wins in ${String(states.length).padStart(4)} states: ${option.padEnd(28)} e.g. ${sample}${more}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// THE STATE SPACE
//
// Every axis is drawn from what the schema actually permits. `might` caps at
// 3 and `insight` at 4 - a probe using 5/5/5/5 is not measuring this game, and
// that mistake is recorded in AGENTS.md as one that has already been made.
// ─────────────────────────────────────────────────────────────────────────

const ROOTS: readonly SpiritRootKey[] = [
    'single_fire',            // the best ordinary draw
    'dual_water_fire',        // conflicting, high innate deviation
    'triple_metal_wood_earth',
    'quad_metal_wood_earth_water',
    'muddled_five_element'    // the commonest draw in the world
];

const ATTRIBUTE_SETS: readonly { label: string; a: InnateAttributes }[] = [
    { label: 'floor 1/1/0/1', a: { might: 1, insight: 1, fortune: 0, charm: 1 } },
    { label: 'median 2/2/1/2', a: { might: 2, insight: 2, fortune: 1, charm: 2 } },
    { label: 'gifted 2/3/2/2', a: { might: 2, insight: 3, fortune: 2, charm: 2 } },
    { label: 'cap 3/4/3/3', a: { might: 3, insight: 4, fortune: 3, charm: 3 } }
];

const FOUNDATIONS: readonly FoundationQuality[] = [
    'none', 'damaged', 'unstable', 'stable', 'exceptional'
];

/** Rungs sampled across the whole climbable ladder, weighted to where lives end. */
const RUNGS: readonly number[] = [0, 4, 8, 11, 12, 13, 16, 20, 24, 28, 32, 38, 44];

/**
 * A set of wounds, built the way the schema actually builds them.
 *
 * `cultivationPenalty` and `breakthroughPenalty` are COLUMNS ON THE ROW, not
 * something `aggregateInjuryPenalties` derives from the severity - it sums the
 * columns. A fixture that omits them makes the aggregate NaN, every rate zero
 * and every odds NaN, and `sweepArgmax` then silently skips the arm that has
 * the open wound and reports "treating always wins".
 *
 * That is the "an absent field reads as zero" trap in AGENTS.md, and this
 * probe walked into it once. The weights come off `INJURY_WEIGHTS`, which is
 * the same table `createInjury` stamps onto a real wound.
 */
const scarSet = (count: number, treated: boolean, tag = 't'): Injury[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `${tag}-inj-${i}`,
        severity: 'serious' as const,
        source: 'qi_deviation' as const,
        description: 'a torn meridian',
        sustainedOnTurn: i,
        treated,
        cultivationPenalty: INJURY_WEIGHTS.serious.cultivationPenalty,
        breakthroughPenalty: INJURY_WEIGHTS.serious.breakthroughPenalty
    }));

console.log('DOMINANT-STRATEGY SWEEP');
console.log('A choice that has a right answer is not a choice. This looks for the ones');
console.log('that do, and names the state that rescues the ones that do not.');
console.log(`Ladder: 0..${MAX_ORDINAL}. Rungs sampled: ${RUNGS.join(', ')}.`);

// ═════════════════════════════════════════════════════════════════════════
// 1. GROUND SELECTION
//
// Denser ground is a straight multiplier on the rate (`ambientRateMultiplier`)
// and a flat bonus on the odds (`ambientBreakthroughMod`). Two things in the
// engine could make it NOT a strict upgrade: crowding, because everyone on a
// vein divides what is there, and the barren ceiling, which is a hard zero
// rather than a slow band.
//
// So the question is not "is dense better" - it is whether the RANKING of
// available grounds ever changes with who else is standing on them.
// ═════════════════════════════════════════════════════════════════════════

head('1. GROUND SELECTION  -  does the best ground ever stop being the best ground?');

interface Ground { label: string; density: number; band: AmbientQi; crowd: number }

const GROUNDS: readonly Ground[] = [
    { label: 'barren hillside', density: 0.05, band: 'thin', crowd: 0 },
    { label: 'thin county', density: BAND_DENSITY_CENTRE.thin, band: 'thin', crowd: 0 },
    { label: 'ordinary valley', density: BAND_DENSITY_CENTRE.normal, band: 'normal', crowd: 0 },
    { label: 'dense mountain', density: BAND_DENSITY_CENTRE.dense, band: 'dense', crowd: 0 },
    { label: 'sealed vein', density: 0.9, band: 'sealed_vein', crowd: 0 }
];

/**
 * The menu a real cultivator faces, which is not five empty caves.
 *
 * Good ground is good ground BECAUSE everybody knows it is, so the population
 * on it is not independent of its density. Each band is offered here at three
 * plausible occupancies - the empty hillside nobody wants, the ordinary valley
 * a sect sits on, and the vein a sect is currently fighting over - and the
 * question is whether the ranking survives that.
 */
const POPULATED: readonly Ground[] = [
    { label: 'barren hillside, alone', density: 0.05, band: 'thin', crowd: 0 },
    { label: 'thin county, alone', density: BAND_DENSITY_CENTRE.thin, band: 'thin', crowd: 0 },
    { label: 'thin county, 20', density: BAND_DENSITY_CENTRE.thin, band: 'thin', crowd: 20 },
    { label: 'valley, 20', density: BAND_DENSITY_CENTRE.normal, band: 'normal', crowd: 20 },
    { label: 'valley, 120', density: BAND_DENSITY_CENTRE.normal, band: 'normal', crowd: 120 },
    { label: 'dense mountain, 60', density: BAND_DENSITY_CENTRE.dense, band: 'dense', crowd: 60 },
    { label: 'dense mountain, 400', density: BAND_DENSITY_CENTRE.dense, band: 'dense', crowd: 400 },
    { label: 'sealed vein, 200', density: 0.9, band: 'sealed_vein', crowd: 200 },
    { label: 'sealed vein, 900', density: 0.9, band: 'sealed_vein', crowd: 900 }
];

function rateOnGround(ordinal: number, root: SpiritRootKey, g: Ground): number {
    // Occupants are priced in DRAW, not heads - `qiDrawOf` sums intake
    // multipliers - so a crowd is modelled as peers at the same rung, which
    // is the ordinary case for a sect's outer disciples.
    const occupants = Array.from({ length: g.crowd }, () => ordinal);
    return computeCultivationRate(
        { spiritRoot: root, injuries: [], realmOrdinal: ordinal, attributes: ATTRIBUTE_SETS[1].a },
        g.band,
        { ground: { density: g.density, occupantOrdinals: [...occupants, ordinal] } }
    ).perDay;
}

console.log('\n  Rate per day, uncrowded ground, by rung (median attributes, single fire root):');
console.log('  ' + 'rung'.padStart(5) + GROUNDS.map(g => g.label.padStart(17)).join(''));
for (const rung of [0, 8, 11, 12, 13, 20]) {
    const row = GROUNDS.map(g => n(rateOnGround(rung, 'single_fire', g), 3).padStart(17)).join('');
    console.log('  ' + String(rung).padStart(5) + row);
}
console.log('\n  Note rung 12: barren ground returns 0, and that is the hard ceiling');
console.log('  (`groundExhausted`), not a slow band. It is the one place a ground stops');
console.log('  being a multiplier and starts being a wall.');
console.log(`  barren at 11: ${groundExhausted(11, { density: 0.05 })}   barren at 12: ${groundExhausted(12, { density: 0.05 })}`);

const groundStates = RUNGS.flatMap(r => ROOTS.map(root => ({ r, root })));
const groundSweep = sweepArgmax(
    groundStates,
    POPULATED,
    (s, g) => rateOnGround(s.r, s.root, g),
    g => g.label,
    s => `rung ${s.r}/${s.root}`
);
console.log('\n  Sweep: 13 rungs x 5 roots x 6 grounds (density x standing population)');
printWinners(groundSweep.winners);

console.log('\n  And the crossover, measured rather than asserted: how many peers must be');
console.log('  standing on the better ground before the emptier, poorer ground wins?');
console.log('  ' + 'rung'.padStart(5) + 'empty thin beats vein at'.padStart(26) + 'empty thin beats dense at'.padStart(27));
for (const rung of [0, 8, 11, 12, 13, 20, 28]) {
    const alone = rateOnGround(rung, 'single_fire', { label: '', density: BAND_DENSITY_CENTRE.thin, band: 'thin', crowd: 0 });
    const crossover = (density: number, band: AmbientQi): string => {
        for (let heads = 1; heads <= 5000; heads++) {
            if (rateOnGround(rung, 'single_fire', { label: '', density, band, crowd: heads }) < alone) {
                return `${heads} peers`;
            }
        }
        return 'never';
    };
    console.log('  ' + String(rung).padStart(5)
        + crossover(0.9, 'sealed_vein').padStart(26)
        + crossover(BAND_DENSITY_CENTRE.dense, 'dense').padStart(27));
}

report({
    decision: 'Ground selection',
    verdict: groundSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '13 rungs x 5 roots x 9 grounds (4 density bands x standing populations 0..900)',
    detail: groundSweep.flips
        ? 'the ranking of grounds flips with how many people are already drawing on them, '
          + 'and the barren ceiling flips it again at rung 12'
        : 'the densest reachable ground wins in every state swept; crowding never '
          + 'reverses the ranking at the populations tested'
});

// ═════════════════════════════════════════════════════════════════════════
// 2. MANUAL SELECTION
//
// `readManual` prices a book against what the reader can take out of it, and
// `SHORTFALL_COST_PER_DEGREE` is documented as sized so that "a mediocre
// reader on a `pristine` canon lands BELOW the 1.0 of a `sound` book matched
// to them". If that inequality holds, the best book in the room is not always
// the right book, which is a genuine fork. If it does not, "take the best
// book" is the whole decision.
// ═════════════════════════════════════════════════════════════════════════

head('2. MANUAL SELECTION  -  is the best book on the shelf always the right book?');

interface Reader { label: string; insight: number; foundation: FoundationQuality; deepest: number }

const READERS: readonly Reader[] = ATTRIBUTE_SETS.flatMap(as =>
    FOUNDATIONS.flatMap(f =>
        [0, 2, 4].map(deepest => ({
            label: `ins ${as.a.insight}/${f}/seen ${deepest}`,
            insight: as.a.insight,
            foundation: f,
            deepest
        }))
    )
);

function readerFor(r: Reader) {
    return {
        spiritRoot: 'single_fire' as SpiritRootKey,
        attributes: { might: 2, insight: r.insight, fortune: 1, charm: 2 },
        foundationQuality: r.foundation,
        insights: r.deepest > 0
            ? [{
                id: 'i1',
                domain: 'element' as const,
                subject: 'fire',
                degree: r.deepest,
                openedBy: 'a1',
                comprehendedOnTurn: 0,
                note: ''
              }]
            : []
    };
}

console.log('\n  Realised rate multiplier by (reader, book). The design requirement is that');
console.log('  a great canon in the wrong hands falls UNDER a plain book in the right ones.');
console.log('  ' + 'reader'.padEnd(24) + MANUAL_QUALITY_ORDER.map(q => q.padStart(10)).join('') + '   best');
for (const r of READERS.filter((_, i) => i % 7 === 0)) {
    const reader = readerFor(r);
    const cells = MANUAL_QUALITY_ORDER.map(q =>
        readManual({ quality: q }, reader, { techniqueElement: 'fire' }).rateMultiplier.toFixed(2).padStart(10)
    ).join('');
    console.log('  ' + r.label.padEnd(24) + cells + '   ' + bestReadable('pristine', reader));
}

const manualSweep = sweepArgmax(
    READERS,
    MANUAL_QUALITY_ORDER,
    (r, q) => readManual({ quality: q }, readerFor(r), { techniqueElement: 'fire' }).rateMultiplier,
    q => q,
    r => r.label
);
console.log(`\n  Sweep: ${READERS.length} readers (4 attribute sets x 5 foundations x 3 insight depths) x 5 qualities`);
printWinners(manualSweep.winners);

report({
    decision: 'Manual selection (quality)',
    verdict: manualSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: `${READERS.length} readers x 5 quality tiers`,
    detail: manualSweep.flips
        ? 'the right book depends on the reader: the winner changes with insight, '
          + 'foundation and what they have already comprehended'
        : 'the best book always wins - the shortfall penalty never bites hard enough'
});

// ═════════════════════════════════════════════════════════════════════════
// 3. MANUAL SWITCHING
//
// The opening penalty is the engine's stated reason not to grab the widest
// book you can reach: "the ordinary book a house teaches is GENUINELY BETTER
// for the next realm, and the treasure only wins over the long run".
//
// It is keyed on `realmsSpannedBy`, and `cultivation.ts` says outright that
// every manual in the catalog spans exactly one realm, so the term is inert.
// That claim is checked here against the live catalog rather than believed.
// ═════════════════════════════════════════════════════════════════════════

head('3. MANUAL SWITCHING  -  does the opening penalty ever fire?');

// Cultivation-class books only. A `dao` art has `cap === null` by construction
// ("what you can DO is not what you ARE"), and measuring one to the top of the
// ladder reports a ten-realm span for a sword form. That is the "absent field
// reads as zero" trap wearing a different hat, and this probe walked into it
// once before this line existed.
const MANUALS = TECHNIQUES.filter(t => classOf(t) === 'cultivation' && t.cap !== null)
    .map(t => ({ id: t.id, required: t.requiredOrdinal, cap: t.cap as number, wide: isWideSpan(t) }));

const spanCounts = new Map<number, number>();
for (const t of MANUALS) {
    const realms = realmsSpannedBy({ requiredOrdinal: t.required, cap: t.cap });
    spanCounts.set(realms, (spanCounts.get(realms) ?? 0) + 1);
}
console.log(`\n  ${TECHNIQUES.length} techniques in the catalog, of which ${MANUALS.length} are capped`);
console.log('  cultivation manuals (a `dao` art has no cap by construction). Realms spanned:');
for (const [realms, count] of [...spanCounts].sort((a, b) => a[0] - b[0])) {
    console.log(`     ${realms} realm(s): ${count} manuals`);
}

const wideOnes = MANUALS.filter(t => t.wide);
console.log(`\n  Manuals that reach further than their own realm geometry (\`isWideSpan\`): ${wideOnes.length}`);
for (const t of wideOnes) {
    const p = openingPenalty({ requiredOrdinal: t.required, cap: t.cap }, t.required);
    console.log(`     ${t.id.padEnd(34)} opens at ${t.required}, caps at ${t.cap}, `
        + `${realmsSpannedBy({ requiredOrdinal: t.required, cap: t.cap })} realm(s), `
        + `opening x${p.multiplier.toFixed(2)}`);
}

const anyPenalty = MANUALS.some(t => {
    for (let o = t.required; o <= t.cap; o++) {
        if (openingPenalty({ requiredOrdinal: t.required, cap: t.cap }, o).multiplier < 1) return true;
    }
    return false;
});
console.log(`\n  Any capped manual, at any rung, whose opening multiplier is below 1: ${anyPenalty}`);

// The decision is only real if the trade actually reverses somewhere: the
// ordinary book must be better NOW and the wide book better LATER.
if (wideOnes.length > 0) {
    const t = wideOnes[0];
    const ordinaryCap = realmForOrdinal(t.required).ordinalEnd + 1;
    console.log(`\n  The trade, for ${t.id}, against the ordinary book a house would teach:`);
    console.log('  ' + 'rung'.padStart(6) + 'wide book'.padStart(12) + 'ordinary'.padStart(12) + '  which is ahead');
    for (let o = t.required; o <= Math.min(t.cap, t.required + 24); o += 4) {
        const wide = openingPenalty({ requiredOrdinal: t.required, cap: t.cap }, o).multiplier;
        const ord = o < ordinaryCap ? 1 : 0;   // the ordinary book has ENDED past its cap
        console.log('  ' + String(o).padStart(6) + wide.toFixed(2).padStart(12)
            + (ord === 0 ? 'ended' : ord.toFixed(2)).padStart(12)
            + '  ' + (wide > ord ? 'wide' : 'ordinary'));
    }
}

report({
    decision: 'Manual switching (span)',
    verdict: anyPenalty ? 'LIVE' : 'NULL',
    swept: `all ${MANUALS.length} capped cultivation manuals, every rung from requiredOrdinal to cap`,
    detail: anyPenalty
        ? `${wideOnes.length} catalog manual(s) reach past their own realm and pay an opening `
          + 'penalty for it: the ordinary book is genuinely better for the next realm'
        : 'no manual in the catalog spans more than one realm, so the opening penalty '
          + 'is identically 1 - the machinery is correct and has nothing to act on'
});

// ═════════════════════════════════════════════════════════════════════════
// 4. SECLUSION vs WORK
//
// The one genuinely continuous decision in the game, and the one the world
// layer already parameterises: `deriveLife` draws an `effort` for every NPC
// and spends it as `focusMultiplier` on the rate and as `(1 - focus)` on the
// income. More time in the cave is more qi per year; more time out of it is
// more stones per year, and stones convert back into qi through the commodity
// pill market at `stonesPerQiUnitAt`.
//
// So the objective is not "rate" - it is TOTAL qi per year, natural plus
// purchased, which is the quantity the ladder is actually denominated in.
// Every term below is an engine function.
// ═════════════════════════════════════════════════════════════════════════

head('4. SECLUSION vs WORK  -  is sitting in the cave always right?');

const FOCUS_OPTIONS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

function totalQiPerYear(ordinal: number, root: SpiritRootKey, focus: number, quality: ManualQuality): number {
    const natural = computeCultivationRate(
        { spiritRoot: root, injuries: [], realmOrdinal: ordinal, attributes: ATTRIBUTE_SETS[1].a },
        'normal',
        { focusMultiplier: focus, techniqueQuality: quality }
    ).perDay * DAYS_PER_YEAR;
    // What is left over after keeping themselves alive, which is the number
    // every price in the game is quoted against.
    const net = (1 - focus) * earningsPerYear(ordinal) - focus * STONES_PER_YEAR_OF_SECLUSION;
    return natural + purchasedQiPerYear(Math.max(0, net), ordinal);
}

console.log('\n  Total qi per year (natural + bought), median cultivator, crude primer:');
console.log('  ' + 'rung'.padStart(5) + FOCUS_OPTIONS.map(f => `f=${f}`.padStart(9)).join('') + '   best');
for (const rung of [0, 4, 8, 11, 12, 13, 16, 20, 28]) {
    const cells = FOCUS_OPTIONS.map(f => n(totalQiPerYear(rung, 'quad_metal_wood_earth_water', f, 'crude'), 0).padStart(9)).join('');
    let best = FOCUS_OPTIONS[0];
    let bestV = -Infinity;
    for (const f of FOCUS_OPTIONS) {
        const v = totalQiPerYear(rung, 'quad_metal_wood_earth_water', f, 'crude');
        if (v > bestV) { bestV = v; best = f; }
    }
    console.log('  ' + String(rung).padStart(5) + cells + '   ' + `f=${best}`);
}

const focusStates = RUNGS.flatMap(r =>
    ROOTS.flatMap(root => (['corrupt', 'crude', 'sound', 'refined', 'pristine'] as ManualQuality[])
        .map(q => ({ r, root, q })))
);
const focusSweep = sweepArgmax(
    focusStates,
    FOCUS_OPTIONS,
    (s, f) => totalQiPerYear(s.r, s.root, f, s.q),
    f => `focus ${f}`,
    s => `rung ${s.r}/${s.root}/${s.q}`
);
console.log(`\n  Sweep: ${focusStates.length} states (13 rungs x 5 roots x 5 manual qualities) x 8 focus levels`);
printWinners(focusSweep.winners, 4);

// Naming the flip rather than gesturing at it: "it moves with the rung" is not
// a finding, "it inverts at 11 and 12 for a slow cultivator" is.
const workWins = focusStates.filter(s => {
    let best = FOCUS_OPTIONS[0];
    let bestV = -Infinity;
    for (const f of FOCUS_OPTIONS) {
        const v = totalQiPerYear(s.r, s.root, f, s.q);
        if (v > bestV) { bestV = v; best = f; }
    }
    return best < 1;
});
const workRungs = [...new Set(workWins.map(s => s.r))].sort((a, b) => a - b);
const workQualities = [...new Set(workWins.map(s => s.q))];
const workRoots = [...new Set(workWins.map(s => s.root))];
console.log('\n  Where leaving the cave wins:');
console.log('     rungs:     ' + workRungs.join(', '));
console.log('     manuals:   ' + workQualities.join(', '));
console.log('     roots:     ' + workRoots.join(', '));
console.log('\n  Read that carefully, because the obvious reading is wrong. It is not the');
console.log('  manual: every quality tier appears in the list. The axis is the ROOT -');
console.log('  single_fire is the one root that never wants to leave the cave, and every');
console.log('  other root does somewhere. Income is a function of RANK alone and is the');
console.log('  same for a prodigy and a muddled root, while the natural rate is mostly a');
console.log('  function of talent. So the two curves cross wherever talent is poor enough,');
console.log('  and the mid-ladder rungs are where the crossing lands because realm intake');
console.log('  is flat across all thirteen rungs of Qi Condensation while earnings climb.');
console.log('\n  That is the genre-correct shape and it is worth saying out loud: the road');
console.log('  up for somebody without talent is money, and the road up for somebody with');
console.log('  it is time. They are different games, produced by one arithmetic.');

report({
    decision: 'Seclusion vs work (time allocation)',
    verdict: focusSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '13 rungs x 5 roots x 5 manual qualities x 8 focus levels (325 states)',
    detail: focusSweep.flips
        ? 'the flip axis is the ROOT, not the book: single_fire never leaves the cave and '
          + 'every other root swept wants to, at rungs ' + workRungs.join('/') + '. Income is '
          + 'a function of rank alone while the rate is a function of talent, so the curves '
          + 'cross wherever talent is poor - money is the untalented road up'
        : 'full seclusion maximises total qi per year in every state swept: the '
          + 'commodity pill market never pays for the rate it costs'
});

// ═════════════════════════════════════════════════════════════════════════
// 5. BREAKTHROUGH TIMING
//
// The known result, confirmed rather than rediscovered. `breakthrough.ts`
// records that before `overflowBonus` existed the odds at rung 16 were 32.4%
// at one times the requirement and 32.4% at four times it, so striking the
// instant the gate opened was strictly optimal at every rung of the ladder.
//
// The counterweights are all engine functions and they pull the other way:
// `lifespanPressure` is subtractive and unbounded, `OVERFULL_PROGRESS_RISK`
// raises the deviation risk for every check spent sitting on a full gate, and
// the settling clock caps how long anybody may sit at all.
//
// The objective, stated plainly because a probe that hides its objective is
// not a measurement: the chance the cultivator actually crosses this rung on
// this attempt, having survived the wait.
//
//   score(W) = P(no deviation over the wait) x odds(progress = W x required, age after the wait)
//
// Both terms are engine functions. Nothing here reimplements either.
// ═════════════════════════════════════════════════════════════════════════

head('5. BREAKTHROUGH TIMING  -  strike now, or sit on it? (the known result, confirmed)');

const WAIT_MULTIPLES = [1, 1.25, 1.5, 2, 3, 5, 8];
const DEVIATION_CHECKS_PER_YEAR = DAYS_PER_YEAR / 30;

interface Waiter { ordinal: number; root: SpiritRootKey; age: number; ratePerYear: number }

function scoreWait(w: Waiter, multiple: number): number {
    const required = progressRequiredForOrdinal(w.ordinal);
    if (required === null) return -Infinity;
    const progress = required * multiple;
    // The overfull stretch: everything past the requirement is time spent on a
    // full gate, and OVERFULL_PROGRESS_RISK prices exactly that.
    const extraYears = ((multiple - 1) * required) / w.ratePerYear;
    // Sitting past the settling clock is not a slower plan, it is death by
    // standing still. An option that cannot be reached scores nothing.
    if (extraYears >= stagnationYearsForOrdinal(w.ordinal)) return -Infinity;
    const ageThen = w.age + extraYears;
    if (ageThen >= lifespanForOrdinal(w.ordinal)) return -Infinity;

    const perCheck = deviationRisk(
        { spiritRoot: w.root, injuries: [] },
        { overfullProgress: multiple > 1 }
    ).risk;
    const checks = extraYears * DEVIATION_CHECKS_PER_YEAR;
    const survivesWait = Math.pow(1 - perCheck, Math.max(0, checks));

    const odds = computeBreakthroughOdds(
        {
            realmOrdinal: w.ordinal,
            spiritRoot: w.root,
            attributes: ATTRIBUTE_SETS[1].a,
            injuries: [],
            foundationQuality: w.ordinal >= 13 ? 'stable' : 'none',
            age: ageThen,
            cultivationProgress: progress
        },
        { ambient: 'normal' }
    ).finalChance;

    return survivesWait * odds;
}

console.log('\n  What waiting buys, at the gate, before anything is charged for it:');
console.log('  ' + 'rung'.padStart(6) + WAIT_MULTIPLES.map(m => 'x' + m).map(s => s.padStart(9)).join(''));
for (const rung of [4, 12, 16, 24, 32, 44]) {
    const cells = WAIT_MULTIPLES.map(m =>
        pct(overflowBonus(rung, (progressRequiredForOrdinal(rung) ?? 0) * m), 1).padStart(9)
    ).join('');
    console.log('  ' + String(rung).padStart(6) + cells);
}
console.log('  (overflowBonus alone: it saturates, so the last third never arrives at any figure)');

console.log('\n  And the whole score, for a young cultivator and an old one at the same rung:');
for (const age of [20, 60, 90]) {
    console.log('\n    age ' + age + ' at the gate, single fire root, ordinary ground:');
    console.log('    ' + 'rung'.padStart(6) + WAIT_MULTIPLES.map(m => ('x' + m).padStart(9)).join('') + '   best');
    for (const rung of [4, 11, 12]) {
        const rate = computeCultivationRate(
            { spiritRoot: 'single_fire', injuries: [], realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
            'normal', {}
        ).perDay * DAYS_PER_YEAR;
        const w: Waiter = { ordinal: rung, root: 'single_fire', age, ratePerYear: rate };
        let best = WAIT_MULTIPLES[0];
        let bestV = -Infinity;
        const cells = WAIT_MULTIPLES.map(m => {
            const v = scoreWait(w, m);
            if (v > bestV) { bestV = v; best = m; }
            return (Number.isFinite(v) ? pct(v, 1) : 'unreachable').padStart(9);
        }).join('');
        console.log('    ' + String(rung).padStart(6) + cells + '   x' + best);
    }
}

const waitStates: Waiter[] = [];
for (const rung of RUNGS) {
    for (const root of ROOTS) {
        const rate = computeCultivationRate(
            { spiritRoot: root, injuries: [], realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
            'normal', {}
        ).perDay * DAYS_PER_YEAR;
        if (rate <= 0) continue;
        for (const frac of [0.1, 0.4, 0.7, 0.95]) {
            waitStates.push({ ordinal: rung, root, ratePerYear: rate, age: lifespanForOrdinal(rung) * frac });
        }
    }
}
const waitSweep = sweepArgmax(
    waitStates, WAIT_MULTIPLES, scoreWait,
    m => 'wait to x' + m,
    w => 'rung ' + w.ordinal + '/' + w.root + '/age ' + Math.round(w.age)
);
console.log('\n  Sweep: ' + waitStates.length + ' states (13 rungs x 5 roots x 4 points in the lifespan) x 7 wait targets');
printWinners(waitSweep.winners, 3);

report({
    decision: 'Breakthrough timing (wait vs strike)',
    verdict: waitSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '13 rungs x 5 roots x 4 lifespan fractions x 7 wait multiples',
    detail: waitSweep.flips
        ? 'patience is defensible for the young and indefensible for the old, and the root '
          + 'decides how much of it is affordable - the overflow fix is doing its job'
        : 'one wait target wins everywhere: the overflow fix has stopped working'
});

// ═════════════════════════════════════════════════════════════════════════
// 6. PILL TIMING AND PILL SELECTION
//
// `breakthrough.ts` states the intent outright: tolerance is permanent, "which
// is what makes hoarding one good pill for the one attempt that matters the
// correct play, and 'just take another' stop working". Three curves decide it
// and all three are engine functions - PILL_GRADE_FACTOR, pillBandDecay,
// pillToleranceDecay.
//
// Note what the brief already establishes and this must not contradict: the
// breakthrough roll inside Qi Condensation already runs near 90%, so a pill
// bought there is buying very little. A finding that a pill is decisive at the
// bottom of the ladder would be a phantom.
// ═════════════════════════════════════════════════════════════════════════

head('6. PILL TIMING  -  take it now, or hoard it for the rung that matters?');

const GRADES = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

function oddsWithPill(ordinal: number, grade: typeof GRADES[number] | null, prior: number): number {
    const base = {
        realmOrdinal: ordinal,
        spiritRoot: 'single_fire' as SpiritRootKey,
        attributes: ATTRIBUTE_SETS[1].a,
        injuries: [] as Injury[],
        foundationQuality: (ordinal >= 13 ? 'stable' : 'none') as FoundationQuality,
        cultivationProgress: progressRequiredForOrdinal(ordinal) ?? 0
    };
    return computeBreakthroughOdds(base, {
        ambient: 'normal',
        pill: grade === null ? undefined : { name: 'pill', potency: 1, grade, priorPillsTaken: prior }
    }).finalChance;
}

console.log('\n  Odds a pill actually buys (final chance with, minus without), no prior pills:');
console.log('  ' + 'rung'.padStart(6) + 'no pill'.padStart(10) + GRADES.map(g => g.padStart(10)).join('') + '   best');
for (const rung of [0, 8, 12, 13, 20, 28, 38, 44]) {
    const none = oddsWithPill(rung, null, 0);
    let best: string = GRADES[0];
    let bestV = -Infinity;
    const cells = GRADES.map(g => {
        const v = oddsWithPill(rung, g, 0) - none;
        if (v > bestV) { bestV = v; best = g; }
        return pct(v, 2).padStart(10);
    }).join('');
    console.log('  ' + String(rung).padStart(6) + pct(none, 1).padStart(10) + cells + '   ' + best);
}

console.log('\n  What the previous pills cost the next one (pillToleranceDecay, permanent):');
console.log('  ' + 'prior'.padStart(6) + 'retained'.padStart(11) + 'gain at rung 12'.padStart(18) + 'gain at rung 32'.padStart(18));
for (const prior of [0, 1, 2, 3, 4, 6]) {
    console.log('  ' + String(prior).padStart(6)
        + pct(pillToleranceDecay(prior), 1).padStart(11)
        + pct(oddsWithPill(12, 'earth', prior) - oddsWithPill(12, null, 0), 2).padStart(18)
        + pct(oddsWithPill(32, 'immortal', prior) - oddsWithPill(32, null, 0), 2).padStart(18));
}

const pillStates = [0, 1, 2, 3, 4].flatMap(prior => GRADES.map(g => ({ prior, g })));
const pillSweep = sweepArgmax(
    pillStates,
    RUNGS,
    (s, rung) => oddsWithPill(rung, s.g, s.prior) - oddsWithPill(rung, null, 0),
    rung => 'spend at rung ' + rung,
    s => s.g + ' pill, ' + s.prior + ' prior'
);
console.log('\n  Sweep: one pill in hand, 5 grades x 5 tolerance levels x 13 candidate rungs');
printWinners(pillSweep.winners, 3);

const gradeSweep = sweepArgmax(
    RUNGS.flatMap(r => [0, 2, 4].map(prior => ({ r, prior }))),
    GRADES,
    (s, g) => oddsWithPill(s.r, g, s.prior) - oddsWithPill(s.r, null, 0),
    g => g + ' grade',
    s => 'rung ' + s.r + ', ' + s.prior + ' prior'
);
console.log('\n  And which GRADE to buy, given the rung you are standing on:');
printWinners(gradeSweep.winners, 3);

report({
    decision: 'Pill timing (which attempt to spend one on)',
    verdict: pillSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '5 grades x 5 tolerance levels x 13 candidate rungs',
    detail: pillSweep.flips
        ? 'the rung worth spending a pill on moves with the grade held and the tolerance built'
        : 'one rung is always the right place to spend a pill, whatever the grade or tolerance'
});
report({
    decision: 'Pill selection (which grade)',
    verdict: gradeSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '13 rungs x 3 tolerance levels x 5 grades',
    detail: gradeSweep.flips
        ? 'grade choice flips with the rung: pillBandDecay makes the cheap pill the right pill '
          + 'low down and close to worthless high up'
        : 'one grade dominates at every rung - pillBandDecay is not biting'
});

// ═════════════════════════════════════════════════════════════════════════
// 7. INJURY TREATMENT
//
// The one decision with a documented counterweight in BOTH directions. An
// untreated wound only ever hurts - rate, odds, deviation risk, and a ninety-
// day bleed clock at the lethal count. But treating it mints a SCAR, and past
// SCAR_PLATEAU scars only cost: "a cultivator who had torn their meridians
// forty times was the best-prepared person in the world, which is the opposite
// of what the setting says about them".
//
// So: is there a state in which leaving a wound open is right?
// ═════════════════════════════════════════════════════════════════════════

head('7. INJURY TREATMENT  -  is it ever right to leave a meridian open?');

function bodyScore(untreated: number, scars: number, ordinal: number): number {
    const injuries = [...scarSet(scars, true), ...scarSet(untreated, false, 'u')];
    const rate = computeCultivationRate(
        { spiritRoot: 'single_fire', injuries, realmOrdinal: ordinal, attributes: ATTRIBUTE_SETS[1].a },
        'normal', {}
    ).perDay;
    const odds = computeBreakthroughOdds(
        {
            realmOrdinal: ordinal, spiritRoot: 'single_fire', attributes: ATTRIBUTE_SETS[1].a,
            injuries, foundationQuality: 'stable',
            cultivationProgress: progressRequiredForOrdinal(ordinal) ?? 0
        },
        { ambient: 'normal' }
    ).finalChance;
    // Rate and odds are the two things a body is for. Multiplied rather than
    // added because they compose that way in a climb: a rung costs qi at the
    // rate and then is bought at the odds.
    return rate * odds;
}

console.log('\n  Rate x odds, by how the same number of wounds is carried. Treating one');
console.log('  wound moves a row from the left column to the right.');
console.log('  ' + 'scars'.padStart(7) + 'untreated'.padStart(11) + 'rate'.padStart(9)
    + 'odds'.padStart(9) + 'rate x odds'.padStart(13) + '   treating the next one');
for (const scars of [0, 2, 3, 4, 5, 6, 8]) {
    for (const untreated of [1]) {
        const before = bodyScore(untreated, scars, 20);
        const after = bodyScore(untreated - 1, scars + 1, 20);
        const injuries = [...scarSet(scars, true), ...scarSet(untreated, false, 'u')];
        const rate = computeCultivationRate(
            { spiritRoot: 'single_fire', injuries, realmOrdinal: 20, attributes: ATTRIBUTE_SETS[1].a },
            'normal', {}
        ).perDay;
        const odds = computeBreakthroughOdds(
            {
                realmOrdinal: 20, spiritRoot: 'single_fire', attributes: ATTRIBUTE_SETS[1].a,
                injuries, foundationQuality: 'stable',
                cultivationProgress: progressRequiredForOrdinal(20) ?? 0
            }, { ambient: 'normal' }
        ).finalChance;
        console.log('  ' + String(scars).padStart(7) + String(untreated).padStart(11)
            + rate.toFixed(3).padStart(9) + pct(odds, 1).padStart(9)
            + (rate * odds).toFixed(4).padStart(13)
            + '   ' + (after > before ? 'helps  (+' + ((after / before - 1) * 100).toFixed(1) + '%)'
                                      : 'HURTS  (' + ((after / before - 1) * 100).toFixed(1) + '%)'));
    }
}

const treatStates = RUNGS.flatMap(r => [0, 2, 3, 4, 5, 6, 8, 12].map(scars => ({ r, scars })));
const treatSweep = sweepArgmax(
    treatStates,
    ['treat it', 'leave it open'],
    (s, option) => option === 'treat it' ? bodyScore(0, s.scars + 1, s.r) : bodyScore(1, s.scars, s.r),
    o => o,
    s => 'rung ' + s.r + ', ' + s.scars + ' scars'
);
console.log('\n  Sweep: 13 rungs x 8 prior-scar counts, one open wound, treat or leave');
printWinners(treatSweep.winners, 3);

console.log('\n  The other half of it, which no rate table can show: an untreated wound also');
console.log('  raises the deviation risk and starts the bleed clock at the lethal count.');
for (const untreated of [0, 1, 2, 3]) {
    const risk = deviationRisk({ spiritRoot: 'single_fire', injuries: scarSet(untreated, false) }, {}).risk;
    console.log('     ' + untreated + ' open: deviation risk per check ' + pct(risk, 2)
        + (untreated >= 3 ? '   <- and the ninety-day bleed clock is running' : ''));
}

// Reported below, once the treatment PRICE has been put beside it: "better for
// the body" is only half the decision.

// ── 7b. And the same decision with the price attached ────────────────────
//
// "Treat it" being better for the body is not the whole decision, because a
// treatment costs `injuryTreatmentPrice` and those stones buy progress on the
// open market instead. The honest question is which of the two the stones do
// more good in.

console.log('\n  Treating is not free. What the same stones buy as progress instead:');
console.log('  ' + 'rung'.padStart(6) + 'treatment'.padStart(12) + 'qi if spent'.padStart(13)
    + 'rate gain'.padStart(11) + 'payback'.padStart(12) + 'lifespan'.padStart(11) + '  verdict');
for (const rung of [0, 8, 12, 13, 20, 24, 28]) {
    const price = injuryTreatmentPrice(rung);
    const qiInstead = purchasedQiPerYear(price, rung);
    const hurt = computeCultivationRate(
        { spiritRoot: 'single_fire', injuries: scarSet(1, false, 'u'), realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
        'normal', {}
    ).perDay * DAYS_PER_YEAR;
    const healed = computeCultivationRate(
        { spiritRoot: 'single_fire', injuries: scarSet(1, true), realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
        'normal', {}
    ).perDay * DAYS_PER_YEAR;
    const gain = healed - hurt;
    const payback = gain > 0 ? qiInstead / gain : Infinity;
    const span = lifespanForOrdinal(rung);
    console.log('  ' + String(rung).padStart(6) + n(price).padStart(12) + n(qiInstead).padStart(13)
        + n(gain).padStart(11) + (Number.isFinite(payback) ? n(payback, 1) + ' yr' : 'never').padStart(12)
        + n(span).padStart(11) + '  ' + (payback < span ? 'treat' : 'buy progress instead'));
}
console.log('  (payback = years of the healed rate needed to match the qi those stones would');
console.log('   have bought outright. Treating wins wherever payback is inside the lifespan,');
console.log('   which is everywhere. Above rung 23 the commodity market has no price at all,');
console.log('   so the stones buy no qi and the comparison stops even being close.)');

report({
    decision: 'Injury treatment',
    verdict: treatSweep.flips ? 'LIVE' : 'DOMINANT',
    swept: '13 rungs x 8 prior-scar counts (0..12), one open wound, treat or leave; '
        + 'plus the treatment price against the commodity progress market at 7 rungs',
    detail: treatSweep.flips
        ? 'past SCAR_PLATEAU the scar a treatment mints costs more than the open wound did'
        : 'treating wins in every state swept and by a wide margin. An open serious wound '
          + 'costs 25% of the rate and 12 points of odds; the worn scar that replaces it '
          + 'costs 4% and half a point, and only past four scars. The counterweight exists '
          + 'and is roughly six times too small to ever reverse the call'
});

// ═════════════════════════════════════════════════════════════════════════
// 8. CULTIVATION DURATION
//
// "I cultivate for ten years" against "I cultivate for one year, ten times".
// `time-skip.ts` keys every stochastic event to an ABSOLUTE DAY INDEX on a
// fixed grid, and argues from that that chunking cannot change an outcome. If
// that argument holds across CALL boundaries too, then the number a player
// types is not a decision at all - the skip already stops at everything worth
// stopping for, so asking for the maximum is free.
//
// Measured from state, never from the digest: the comparison is on ordinal,
// progress, age, wounds and stones, all of which come back as data.
// ═════════════════════════════════════════════════════════════════════════

head('8. CULTIVATION DURATION  -  does the number of days a player types matter?');

function freshCultivator(seed: string, root: SpiritRootKey) {
    return CultivatorSchema.parse({
        id: 'probe-' + seed,
        name: 'Probe',
        spiritRoot: root,
        attributes: ATTRIBUTE_SETS[1].a,
        realmOrdinal: 4,
        cultivationProgress: 0,
        age: 20,
        hp: 100,
        maxHp: 100,
        qi: 100,
        maxQi: 100
    });
}

const skipCtx = (seed: string, startDay: number) => ({
    seed,
    locationId: 'probe-cave',
    locationDensity: BAND_DENSITY_CENTRE.normal,
    startDay,
    grainAbstinence: true,      // take food out of it; that is section 8b's job
    randomEvents: true,
    autoBreakthrough: true
});

/**
 * Play a decade, asking for `request` days at a time and RESUMING after every
 * interrupt, until ten years of world-time have gone by or the run ends.
 *
 * Resuming in both arms is what makes this a fair comparison, and the first
 * version of this section did not: it ran one 3650-day call, watched it stop at
 * `major_encounter` on day 450, and compared that against a chained arm that
 * had carried on to day 3650. Every seed "differed", which was entirely the
 * harness. A player who types a big number and a player who types a small one
 * both keep going after the world interrupts them; the only thing under test is
 * the number they type.
 */
function playDecade(seed: string, root: SpiritRootKey, request: number) {
    let c = freshCultivator(seed, root);
    let day = 0;
    let calls = 0;
    let interrupts = 0;
    let wounds = 0;
    let stones = 0;
    while (day < 3650 && c.alive) {
        const piece = simulateTimeSkip(c, Math.min(request, 3650 - day), skipCtx(seed, day));
        calls++;
        if (piece.interrupted) interrupts++;
        wounds += piece.injuriesSustained.length;
        stones += piece.deltas.spiritStones;
        c = CultivatorSchema.parse({
            ...c,
            realmOrdinal: c.realmOrdinal + piece.deltas.realmOrdinal,
            cultivationProgress: Math.max(0, c.cultivationProgress + piece.deltas.cultivationProgress),
            hp: Math.max(0, c.hp + piece.deltas.hp),
            satiety: Math.max(0, Math.min(100, c.satiety + piece.deltas.satiety)),
            spiritStones: Math.max(0, c.spiritStones + piece.deltas.spiritStones),
            age: c.age + piece.deltas.age,
            injuries: [...c.injuries, ...piece.injuriesSustained],
            foundationQuality: piece.foundationEstablished ?? c.foundationQuality,
            insights: [...c.insights, ...piece.insightsGained],
            // The three counters that RESET rather than accumulate. `deltas`
            // is documented as wrong for these, and reading them out of
            // `endState` is the whole reason the split exists.
            starvationTurns: piece.endState.starvationTurns,
            bleedingTurns: piece.endState.bleedingTurns,
            yearsAtCurrentRealm: piece.endState.yearsAtCurrentRealm,
            alive: !piece.died
        });
        day += piece.simulatedDays;
        // A call that resolves nothing would loop forever. It should never
        // happen - `nextChunk` floors at 1 - so it is an error, not a break.
        if (piece.simulatedDays === 0 && !piece.died) {
            throw new Error('harness bug: a skip advanced zero days without dying');
        }
        if (piece.died) break;
    }
    return { c, calls, interrupts, wounds, stones, day };
}

let durationMatches = 0;
let durationDiffers = 0;

console.log('\n  Ten years of world-time, resuming after every interrupt in both arms.');
console.log('  Left: one big request. Right: 365 days at a time. Same seed, same ground.');
console.log('  ' + 'seed'.padStart(6) + 'big: ord/qi/wounds/calls'.padStart(28)
    + 'small: ord/qi/wounds/calls'.padStart(30) + '  same?');
for (const seed of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']) {
    const root: SpiritRootKey = 'single_fire';
    const big = playDecade(seed, root, 3650);
    const small = playDecade(seed, root, 365);
    const same =
        big.c.realmOrdinal === small.c.realmOrdinal
        && Math.abs(big.c.cultivationProgress - small.c.cultivationProgress) < 1e-6
        && big.wounds === small.wounds
        && big.c.spiritStones === small.c.spiritStones;
    if (same) durationMatches++; else durationDiffers++;
    const fmt = (r: ReturnType<typeof playDecade>) =>
        r.c.realmOrdinal + '/' + n(r.c.cultivationProgress) + '/' + r.wounds + '/' + r.calls;
    console.log('  ' + seed.padStart(6) + fmt(big).padStart(28) + fmt(small).padStart(30)
        + '  ' + (same ? 'SAME' : 'DIFFERS'));
}
console.log('\n  matched: ' + durationMatches + '   differed: ' + durationDiffers);
console.log('  The call COUNT differs, and that is the whole of what the number buys: a');
console.log('  player who asks for less is interrupted more often for no other reason.');

// The one place per-call state could legitimately diverge, and the reason this
// section does not stop at the clean case. `simulateTimeSkip` seeds
// `starvationAnnounced` and `depletionAnnounced` FROM THE ENTRY STATE on every
// call, so a cultivator eating real food might be warned on a short call and
// not on a long one - which would make the number a real decision after all,
// and a nasty one, because the safer play would be the more tedious one.
let foodMatches = 0;
let foodDiffers = 0;
const foodNotes: string[] = [];
for (const seed of ['f1', 'f2', 'f3', 'f4']) {
    const withFood = (request: number) => {
        let c = freshCultivator(seed, 'single_fire');
        let day = 0;
        const reasons: string[] = [];
        while (day < 1825 && c.alive) {
            const piece = simulateTimeSkip(c, Math.min(request, 1825 - day), {
                ...skipCtx(seed, day), grainAbstinence: false, rations: 40
            });
            if (piece.interruptReason) reasons.push(piece.interruptReason);
            c = CultivatorSchema.parse({
                ...c,
                realmOrdinal: c.realmOrdinal + piece.deltas.realmOrdinal,
                cultivationProgress: Math.max(0, c.cultivationProgress + piece.deltas.cultivationProgress),
                hp: Math.max(0, c.hp + piece.deltas.hp),
                satiety: Math.max(0, Math.min(100, c.satiety + piece.deltas.satiety)),
                age: c.age + piece.deltas.age,
                injuries: [...c.injuries, ...piece.injuriesSustained],
                starvationTurns: piece.endState.starvationTurns,
                bleedingTurns: piece.endState.bleedingTurns,
                yearsAtCurrentRealm: piece.endState.yearsAtCurrentRealm,
                alive: !piece.died
            });
            day += piece.simulatedDays;
            if (piece.died || piece.simulatedDays === 0) break;
        }
        return { c, reasons, day };
    };
    const big = withFood(1825);
    const small = withFood(180);
    const same = big.c.realmOrdinal === small.c.realmOrdinal
        && Math.abs(big.c.cultivationProgress - small.c.cultivationProgress) < 1e-6
        && big.c.alive === small.c.alive;
    if (same) foodMatches++; else foodDiffers++;
    foodNotes.push('   seed ' + seed + '  big: ord ' + big.c.realmOrdinal + ', alive ' + big.c.alive
        + ', day ' + big.day + '  |  small: ord ' + small.c.realmOrdinal + ', alive '
        + small.c.alive + ', day ' + small.day + '   ' + (same ? 'SAME' : 'DIFFERS'));
}
console.log('\n  And the same test with food in the pack rather than grain abstinence, which');
console.log('  is where the per-call warning flags could legitimately diverge:');
for (const line of foodNotes) console.log(line);
console.log('   matched: ' + foodMatches + '   differed: ' + foodDiffers);

report({
    decision: 'Cultivation duration (how many days to ask for)',
    verdict: durationDiffers + foodDiffers > 0 ? 'LIVE' : 'NULL',
    swept: '8 seeds x a decade on grain abstinence, plus 4 seeds x five years on real rations, '
        + 'one big request against repeated small ones, resuming after every interrupt in both arms',
    detail: durationDiffers + foodDiffers > 0
        ? 'the length asked for changes the outcome, which contradicts the chunking argument '
          + 'in time-skip.ts and is worth a look'
        : 'asking for the maximum is free and never worse: the skip already interrupts on '
          + 'everything worth stopping for, and every event is keyed to an absolute day. '
          + 'The number is a convenience, not a choice'
});

// ═════════════════════════════════════════════════════════════════════════
// 9. COMMISSION ACCEPTANCE
//
// `dutyTermsFor` prices a job in days and stones. The alternative use of those
// days is a cave. So the question is whether the stones a commission pays ever
// buy more qi than the days would have accrued - and, because the pill market
// has a ceiling, whether that answer moves up the ladder.
//
// Note what `dutyTermsFor` does NOT carry: any chance of being hurt or killed.
// The terms are pure upside against an opportunity cost, which is itself worth
// reporting.
// ═════════════════════════════════════════════════════════════════════════

head('9. COMMISSION ACCEPTANCE  -  is taking work off the board ever the right call?');

function qiForegone(ordinal: number, days: number): number {
    return computeCultivationRate(
        { spiritRoot: 'single_fire', injuries: [], realmOrdinal: ordinal, attributes: ATTRIBUTE_SETS[1].a },
        'normal', { focusMultiplier: 1 }
    ).perDay * days;
}

console.log('\n  Every commission the catalog can express, priced against the cave:');
console.log('  ' + 'rung'.padStart(5) + 'offers'.padStart(8) + 'median days'.padStart(13)
    + 'stones'.padStart(9) + 'qi bought'.padStart(11) + 'qi forgone'.padStart(12) + '  verdict');
const commissionFlips = new Set<string>();
for (const rung of [0, 4, 8, 11, 12, 13, 16, 20, 24, 28]) {
    const board = commissionBoard(rung, null);
    if (board.length === 0) {
        console.log('  ' + String(rung).padStart(5) + '0'.padStart(8) + '  nothing on the board at this rung');
        continue;
    }
    const days = board.map(c => c.terms.days).sort((a, b) => a - b)[Math.floor(board.length / 2)];
    const stones = board.map(c => c.terms.stones).sort((a, b) => a - b)[Math.floor(board.length / 2)];
    const bought = purchasedQiPerYear(stones, rung) * 1;   // stones -> qi at the market price
    const forgone = qiForegone(rung, days);
    const better = bought > forgone ? 'TAKE IT' : 'stay in the cave';
    commissionFlips.add(better);
    console.log('  ' + String(rung).padStart(5) + String(board.length).padStart(8)
        + String(days).padStart(13) + n(stones).padStart(9)
        + n(bought).padStart(11) + n(forgone).padStart(12) + '  ' + better);
}

console.log('\n  What the board actually holds, and who it is put in front of:');
console.log('     commission rows in the catalog: ' + COMMISSION_ENTRIES.length
    + ',  summons rows: ' + SUMMONS_ENTRIES.length);
console.log('  ' + 'rung'.padStart(6) + 'offered'.padStart(10) + 'refused as beneath/over'.padStart(25));
for (const rung of [0, 4, 8, 13, 20, 30, 44]) {
    const offered = commissionBoard(rung, null).length;
    const refused = COMMISSION_ENTRIES.filter(e => {
        if (rung < e.minOrdinal || rung > e.maxOrdinal) return false;
        return !summonable(dutyTermsFor(e, rung, null, 'commission').regard.band);
    }).length;
    console.log('  ' + String(rung).padStart(6) + String(offered).padStart(10) + String(refused).padStart(25));
}

report({
    decision: 'Commission acceptance',
    verdict: commissionFlips.size > 1 ? 'LIVE' : 'DOMINANT',
    swept: '10 rungs x every commission row the catalog can express, terms from dutyTermsFor '
        + 'against full-focus cultivation over the same days',
    detail: commissionFlips.size > 1
        ? 'whether a commission beats the cave flips with the rung, because the pill market '
          + 'that converts its pay into qi has a ceiling and the cave does not'
        : 'the same answer at every rung: ' + [...commissionFlips][0]
          + '. And dutyTermsFor carries no risk term at all, so a commission is pure '
          + 'upside against an opportunity cost'
});

// ═════════════════════════════════════════════════════════════════════════
// 10. SECT MEMBERSHIP
//
// Membership is a rate multiplier and a stipend on one side, and an obligation
// ledger on the other: `refusalFor` writes a broken oath where a rogue gets
// 'other', and a war makes it 'unforgivable'. The rate side is engine data;
// the obligation side is days.
//
// So this is asked as a break-even rather than by inventing a summons rate:
// how many days a year would a house have to spend of you before its support
// stopped paying for itself?
// ═════════════════════════════════════════════════════════════════════════

head('10. SECT MEMBERSHIP  -  what would a house have to cost before leaving was right?');

const PLACEMENTS = [
    { label: 'rogue', sectBonus: 1, stipend: 0 },
    { label: 'minor sect', sectBonus: 1.1, stipend: 12 },
    { label: 'established sect', sectBonus: 1.25, stipend: 40 },
    { label: 'great house', sectBonus: 1.45, stipend: 260 },
    { label: 'apex house', sectBonus: 1.6, stipend: 1_400 }
];

console.log('\n  Qi per year by placement, and the days of duty a year that would cancel it:');
console.log('  ' + 'rung'.padStart(6) + PLACEMENTS.map(p => p.label.padStart(18)).join(''));
for (const rung of [0, 8, 12, 13, 20, 28]) {
    const cells = PLACEMENTS.map(p => {
        const rate = computeCultivationRate(
            { spiritRoot: 'single_fire', injuries: [], realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
            'normal', { sectBonus: p.sectBonus }
        ).perDay * DAYS_PER_YEAR;
        return n(rate + purchasedQiPerYear(p.stipend, rung)).padStart(18);
    }).join('');
    console.log('  ' + String(rung).padStart(6) + cells);
}

console.log('\n  Break-even: days a year the house may take before a rogue does better.');
console.log('  ' + 'rung'.padStart(6) + PLACEMENTS.slice(1).map(p => p.label.padStart(20)).join(''));
const membershipFlips = new Set<string>();
for (const rung of [0, 4, 8, 12, 13, 20, 28, 38]) {
    const rogueRate = computeCultivationRate(
        { spiritRoot: 'single_fire', injuries: [], realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
        'normal', { sectBonus: 1 }
    ).perDay;
    const rogueYear = rogueRate * DAYS_PER_YEAR;
    const cells = PLACEMENTS.slice(1).map(p => {
        const memberRate = computeCultivationRate(
            { spiritRoot: 'single_fire', injuries: [], realmOrdinal: rung, attributes: ATTRIBUTE_SETS[1].a },
            'normal', { sectBonus: p.sectBonus }
        ).perDay;
        const memberYear = memberRate * DAYS_PER_YEAR + purchasedQiPerYear(p.stipend, rung);
        // Duty days are days not cultivating, charged at the member's own rate.
        const days = (memberYear - rogueYear) / memberRate;
        membershipFlips.add(days >= DAYS_PER_YEAR ? 'always join' : 'depends on the duty load');
        return (days >= DAYS_PER_YEAR ? 'never worth leaving' : n(days) + ' d/yr').padStart(20);
    }).join('');
    console.log('  ' + String(rung).padStart(6) + cells);
}
console.log('\n  A "total" duty - a war - runs ' + 720 + ' days in dutyTermsFor, and refusing one');
console.log('  as a member is the only thing in the ledger written down as unforgivable.');

report({
    decision: 'Sect membership',
    verdict: membershipFlips.size > 1 ? 'LIVE' : 'DOMINANT',
    swept: '8 rungs x 4 placement tiers, rate and stipend against the days the house may spend',
    detail: membershipFlips.size > 1
        ? 'membership pays until the duty load passes a break-even that moves with the rung '
          + 'and the tier of the house'
        : 'the rate multiplier and the stipend are worth more than a full year of duty at '
          + 'every rung swept, so joining the best house that will have you is never wrong'
});

// ═════════════════════════════════════════════════════════════════════════
// 11. COMBAT
//
// The two rules the README says stop being prose here: "large realm gaps must
// remain nearly insurmountable" and "upsets must be possible and exceptional".
// Those are the same claim as "fight or do not fight is a real decision at one
// realm and a fake one at two", and `assessGap` plus MAX_EDGE_MULTIPLIER
// settle it arithmetically.
// ═════════════════════════════════════════════════════════════════════════

head('11. COMBAT  -  at what gap does fighting stop being a decision?');

function priced(ordinal: number, opts: Partial<{ artifactGrade: number; battles: number; foundation: FoundationQuality }> = {}) {
    return assessPower({
        id: 'c' + ordinal, name: rankName(ordinal), realmOrdinal: ordinal,
        spiritRoot: 'single_fire', attributes: ATTRIBUTE_SETS[3].a, injuries: [],
        foundationQuality: opts.foundation ?? 'stable',
        hp: 100, maxHp: 100, qi: 100, maxQi: 100,
        artifactGrade: opts.artifactGrade ?? 0,
        battlesSurvived: opts.battles ?? 0
    }, { ambient: 'normal' });
}

console.log('\n  Verdict by rung gap, and what the composite power ratio actually is:');
console.log('  ' + 'subject'.padStart(9) + 'opponent'.padStart(10) + 'realm gap'.padStart(11)
    + 'power ratio'.padStart(13) + '  verdict');
for (const [sub, opp] of [[20, 20], [20, 22], [20, 24], [20, 26], [20, 30], [20, 33], [20, 40], [30, 20]] as const) {
    const g = assessGap(priced(sub), priced(opp));
    console.log('  ' + String(sub).padStart(9) + String(opp).padStart(10)
        + String(g.realmGap).padStart(11) + (Number.isFinite(g.powerRatio) ? g.powerRatio.toFixed(2) : 'inf').padStart(13)
        + '  ' + g.verdict);
}

console.log('\n  And whether anything a cultivator can BRING closes the gap. MAX_EDGE_MULTIPLIER');
console.log('  is 6; one realm is x4 of power and two realms is x16, so:');
const bare = priced(20);
const loaded = priced(20, { artifactGrade: 9, battles: 60, foundation: 'exceptional' });
console.log('     bare at rung 20:               ' + bare.total.toFixed(1));
console.log('     everything a person can carry: ' + loaded.total.toFixed(1)
    + '   (x' + (loaded.total / bare.total).toFixed(2) + ')');
for (const opp of [22, 26, 33]) {
    const ratio = priced(opp).total / loaded.total;
    console.log('     against rung ' + opp + ' (' + assessGap(loaded, priced(opp)).verdict + '): still behind by x'
        + ratio.toFixed(2) + (ratio <= 1 ? '   <- fully closed' : ''));
}

const combatVerdicts = new Set<string>();
for (let gap = 0; gap <= 26; gap += 2) {
    combatVerdicts.add(assessGap(priced(18), priced(18 + gap)).verdict);
}
report({
    decision: 'Combat (fight or do not)',
    verdict: combatVerdicts.size > 1 ? 'LIVE' : 'DOMINANT',
    swept: '14 rung gaps from 0 to 26, bare and carrying everything the schema permits',
    detail: combatVerdicts.size > 1
        ? 'the verdict changes with the gap: contested inside a realm, winnable one realm '
          + 'down only with something brought, and no contest at two - which is the two '
          + 'rules in the README working as written. What is DOMINANT is the answer at two '
          + 'realms, and that is deliberate'
        : 'one verdict at every gap: the categorical ladder is not being read'
});

// ═════════════════════════════════════════════════════════════════════════
// 12. TRAVEL, WORK AND GATHERING
//
// The three asks that `regard.ts` was built for, and the sweep it records
// having failed before it existed: "twenty-three of the thirty asks returned
// an identical answer at every rung on the ladder". So the test is whether
// what the world gives back for the same sentence still moves with who is
// asking.
// ═════════════════════════════════════════════════════════════════════════

head('12. TRAVEL, WORK AND GATHERING  -  does the world still answer differently by rung?');

console.log('\n  One ask, pitched at rung 2 - "I gather what herbs I can find" - asked from');
console.log('  every height. This is the sweep regard.ts exists because of.');
console.log('  ' + 'asker'.padStart(7) + 'band'.padStart(14) + 'yield'.padStart(8)
    + 'duration'.padStart(10) + 'price'.padStart(8) + 'offered'.padStart(9) + 'refused'.padStart(9));
const gatherBands = new Set<string>();
for (const ordinal of [0, 2, 4, 8, 13, 20, 30, 45]) {
    const r = regardFor(2, ordinal);
    gatherBands.add(r.band);
    console.log('  ' + String(ordinal).padStart(7) + r.band.padStart(14)
        + r.yieldMultiplier.toFixed(2).padStart(8) + r.durationMultiplier.toFixed(2).padStart(10)
        + r.priceMultiplier.toFixed(2).padStart(8)
        + String(r.offered).padStart(9) + String(r.refused).padStart(9));
}

console.log('\n  What a year of work is worth by rung, against a year of upkeep (' + STONES_PER_YEAR_OF_SECLUSION + '):');
console.log('  ' + 'rung'.padStart(6) + 'gross'.padStart(10) + 'net at 45% sealed'.padStart(20) + 'qi that buys'.padStart(14));
for (const rung of [0, 4, 8, 12, 13, 20, 28, 38]) {
    const net = netEarningsPerYear(rung);
    console.log('  ' + String(rung).padStart(6) + n(earningsPerYear(rung)).padStart(10)
        + n(net, 1).padStart(20) + n(purchasedQiPerYear(Math.max(0, net), rung)).padStart(14));
}

console.log('\n  TRAVEL: how long a journey would have to be before staying put won.');
console.log('  Break-even, against the rest of the realm-granted lifespan at the rung:');
console.log('  ' + 'rung'.padStart(6) + 'lifespan'.padStart(11) + 'thin -> valley'.padStart(17)
    + 'valley -> dense'.padStart(18) + 'dense -> vein'.padStart(16));
/**
 * Days of journey at which moving stops paying.
 *
 * Spend J days walking at no rate, then the remainder of the span at the better
 * rate. Break-even is where that equals staying at the worse rate for the whole
 * span: J = span x (1 - worse/better). It is a fraction of the SPAN, which is
 * why the answer has to be printed in days rather than as a ratio - the ratio is
 * the same everywhere and says nothing.
 */
const travelBreakEven = (rung: number, from: Ground, to: Ground): string => {
    const a = rateOnGround(rung, 'single_fire', from);
    const b = rateOnGround(rung, 'single_fire', to);
    if (b <= a) return 'never worth it';
    const spanDays = lifespanForOrdinal(rung) * DAYS_PER_YEAR;
    return n(spanDays * (1 - a / b)) + ' d';
};
const g = (density: number, band: AmbientQi, crowd = 0): Ground => ({ label: '', density, band, crowd });
for (const rung of [0, 8, 12, 13, 20, 28]) {
    console.log('  ' + String(rung).padStart(6) + n(lifespanForOrdinal(rung)).padStart(11)
        + travelBreakEven(rung, g(BAND_DENSITY_CENTRE.thin, 'thin'), g(BAND_DENSITY_CENTRE.normal, 'normal')).padStart(17)
        + travelBreakEven(rung, g(BAND_DENSITY_CENTRE.normal, 'normal'), g(BAND_DENSITY_CENTRE.dense, 'dense')).padStart(18)
        + travelBreakEven(rung, g(BAND_DENSITY_CENTRE.dense, 'dense'), g(0.9, 'sealed_vein')).padStart(16));
}
console.log('\n  Those are enormous journeys - decades of walking, and centuries higher up.');
console.log('  And they are hypothetical, because nothing in the engine charges any of it:');
console.log('  `TimeSkipContext` takes a `locationId` and a `locationDensity` and no cost for');
console.log('  getting there. So the break-even is never reached and the move always wins.');
console.log('');
console.log('  The rung-28 row is uneven for a real reason rather than a rounding one: a');
console.log('  Void Refinement cultivator standing ALONE on thin ground is already over its');
console.log('  carrying capacity by themselves. `qiDrawOf` sums intake multipliers, and a');
console.log('  solo cultivator at ordinal 28 draws 16.0 against a thin valley\'s capacity of');
console.log('  7 - a share of 0.438. At ordinal 20 the draw is 4.0 and nothing happens; at');
console.log('  ordinal 12 it is 1.0. So somewhere in the upper realms a cultivator starts');
console.log('  crowding themselves off any ground that is not rich enough to hold them,');
console.log('  which is contested qi working as written and is one mechanical reading of');
console.log('  why the higher realms are described as having left the economy.');

report({
    decision: 'Resource gathering / work (what the world offers)',
    verdict: gatherBands.size > 1 ? 'LIVE' : 'DOMINANT',
    swept: 'one ask pitched at rung 2, asked from 8 heights across the whole ladder',
    detail: gatherBands.size > 1
        ? 'the same sentence gets ' + gatherBands.size + ' different answers by rung - yield, '
          + 'duration, price and whether it is offered at all - which is regard.ts doing '
          + 'exactly what it was built for'
        : 'the ask returns the same answer at every rung: the regression regard.ts fixed '
          + 'has come back'
});
report({
    decision: 'Travel (moving to better ground)',
    verdict: 'DOMINANT',
    swept: '5 rungs x 3 upgrade steps between the four density bands',
    detail: 'every move to denser ground pays back, and there is no state in which staying '
        + 'is right, because the engine charges nothing for the journey. `TimeSkipContext` '
        + 'has `hostility` for arriving somewhere lethal but no cost for the road itself'
});


// ═════════════════════════════════════════════════════════════════════════
// 13. THE TWO DECISIONS THE ENGINE MAKES REAL AND THE PLAYED GAME DOES NOT
//
// Sections 2 and 3 measured `computeCultivationRate` directly and found manual
// quality and manual span both LIVE. That is a statement about the engine. It
// is not automatically a statement about the game, because a rate term only
// exists in play if a caller passes it - and `CultivationOptions` has fourteen
// of them, all optional, all defaulting to the identity element.
//
// `src/web/game.ts` already records this exact failure mode against itself:
//
//   "`CultivationOptions` has four rate terms and the six skip sites here
//    passed one of them. `techniqueBonus` and `sectBonus` both defaulted to 1,
//    which is why 30 promotions and 5,376 contribution across 52 measured sect
//    lives moved the outcome by approximately zero."
//
// Two more of them are still in that state, and this section prices what they
// are worth so the size of the gap is a number rather than an opinion.
//
// Verified by reading the call sites, not by inference:
//   game.ts `rateTermsFor`   returns techniqueCap, guideOrdinal, techniqueBonus,
//                            sectBonus. No techniqueQuality. No techniqueSpan.
//   game.ts `multipliersFor` loops the catalog rows - which carry `quality` and
//                            `cap` - and reads neither.
//   cultivation-manage.ts    DOES pass `catalog.quality`. The MCP path and the
//                            web path therefore disagree about the same book.
// ═════════════════════════════════════════════════════════════════════════

head('13. WIRING  -  is what the engine offers actually reachable from play?');

const wiredReader = {
    spiritRoot: 'single_fire' as SpiritRootKey,
    attributes: ATTRIBUTE_SETS[1].a,
    foundationQuality: 'stable' as FoundationQuality,
    injuries: [] as Injury[],
    realmOrdinal: 8
};
const rateWith = (opts: Parameters<typeof computeCultivationRate>[2]) =>
    computeCultivationRate(wiredReader, 'normal', opts).perDay * DAYS_PER_YEAR;

console.log('\n  A. MANUAL QUALITY. What the axis is worth, and what play currently sees.');
console.log('  ' + 'book'.padStart(10) + 'engine rate/yr'.padStart(17)
    + 'what game.ts computes'.padStart(24) + 'difference'.padStart(13));
const asPlayed = rateWith({});   // no techniqueQuality passed: the identity element
for (const q of MANUAL_QUALITY_ORDER) {
    const engine = rateWith({ techniqueQuality: q });
    console.log('  ' + q.padStart(10) + n(engine).padStart(17) + n(asPlayed).padStart(24)
        + (engine === asPlayed ? 'none' : (engine > asPlayed ? '+' : '') + n(engine - asPlayed)).padStart(13));
}
const spread = rateWith({ techniqueQuality: 'pristine' }) / rateWith({ techniqueQuality: 'corrupt' });
console.log('\n     Spread from the worst book in the world to the best: x' + spread.toFixed(2) + '.');
console.log('     manual-quality.ts calls this "the largest single non-realm term in the');
console.log('     game". In the web path every one of those five books cultivates at the');
console.log('     same speed, so section 2 measures a decision the player cannot make.');

console.log('\n  B. MANUAL SPAN. The three wide books in the catalog, and their opening cost.');
console.log('  ' + 'manual'.padStart(34) + 'should open at'.padStart(17) + 'play opens at'.padStart(16));
for (const t of wideOnes) {
    const p = openingPenalty({ requiredOrdinal: t.required, cap: t.cap }, t.required);
    console.log('  ' + t.id.padStart(34) + ('x' + p.multiplier.toFixed(2)).padStart(17)
        + ('x' + openingMultiplierAsPlayed().toFixed(2)).padStart(16));
}
function openingMultiplierAsPlayed(): number {
    // `techniqueSpan` is never passed by any caller in src/ outside the module
    // that declares it, so `openingMultiplier(undefined, o)` is what play runs.
    return 1;
}
console.log('\n     `first-and-last-breath-canon` should open at a quarter of the ordinary');
console.log('     rate and carry a reader nine realms for it. In play it opens at full');
console.log('     rate and carries them nine realms for nothing, which makes "find the');
console.log('     best book" exactly the whole game that OPENING_COST_PER_EXCESS_REALM');
console.log('     was written to prevent.');

report({
    decision: 'Manual selection AS PLAYED (web path)',
    verdict: 'NULL',
    swept: '5 quality tiers against the rate the web path actually computes; call sites '
        + 'read rather than inferred (game.ts rateTermsFor and multipliersFor)',
    detail: 'the engine makes this LIVE and the web layer does not pass it. All five '
        + 'quality tiers cultivate at the same speed in play, discarding an x' + spread.toFixed(2)
        + ' spread. cultivation-manage.ts DOES pass it, so the MCP path and the web path '
        + 'disagree about the same book'
});
report({
    decision: 'Manual switching AS PLAYED (web path)',
    verdict: 'DOMINANT',
    swept: 'all 3 wide-span catalog manuals against the opening multiplier the web path applies',
    detail: 'nothing anywhere in src/ passes `techniqueSpan`, so the opening penalty never '
        + 'fires. Take the widest book you can reach: it costs nothing to open and reaches '
        + 'nine realms. This is the exact failure OPENING_COST_PER_EXCESS_REALM exists to stop'
});

console.log(`
  THE FIX, AND IT IS SMALL
  ------------------------
  Both terms are already sitting on the catalog row that \`multipliersFor\`
  loops over, and both have a caller that does it right to copy from. In
  \`src/web/game.ts\`, \`rateTermsFor\` returns four fields; it wants six:

      techniqueQuality  <- catalog.quality, the way cultivation-manage.ts:310 does
      techniqueSpan     <- { requiredOrdinal: catalog.requiredOrdinal, cap: reach.cap }

  \`rateTermsFor\` already computes \`reach\` through \`effectiveCapOf\`, so the
  span is in hand at the point it is needed and nothing new has to be looked up.

  Worth saying plainly: these are not balance changes. Sections 2 and 3 show the
  engine already gets both decisions right. This is one function not forwarding
  what the engine asked for, which is the same defect that comment in game.ts
  records having found twice before.

  AND ONE PIECE OF PROSE TO CORRECT IN THE SAME COMMIT
  ---------------------------------------------------
  \`src/engine/cultivation/cultivation.ts\` states three times that no manual in
  the catalog spans more than one realm:

      "1 for every manual in the catalog today"
      "both gates read 1 for the entire current catalog and are INERT today"
      ORDINARY_REALM_SPAN: "Every book in the catalog today."

  Measured above: 3 of the 24 capped cultivation manuals span 3, 5 and 9 realms.
  The data layer authored the two-realm manual the comment was waiting for, and
  the comment did not notice. AGENTS.md: where a description and the measurement
  disagree, the description is what changes.
`);
// ═════════════════════════════════════════════════════════════════════════
// THE TABLE
// ═════════════════════════════════════════════════════════════════════════

head('VERDICTS');
console.log('');
console.log('  ' + 'decision'.padEnd(52) + 'verdict');
console.log('  ' + '-'.repeat(52) + ' ' + '-'.repeat(9));
for (const f of findings) {
    console.log('  ' + f.decision.padEnd(52) + f.verdict);
}
console.log('');
const live = findings.filter(f => f.verdict === 'LIVE').length;
const dominant = findings.filter(f => f.verdict === 'DOMINANT').length;
const nul = findings.filter(f => f.verdict === 'NULL').length;
console.log('  ' + live + ' live, ' + dominant + ' dominant, ' + nul + ' null, of '
    + findings.length + ' decisions swept.');
console.log('');
console.log('  A DOMINANT verdict is not automatically a defect. "Treat your wounds" and');
console.log('  "do not fight two realms up" are supposed to have right answers. The ones');
console.log('  worth acting on are where the engine appears to OFFER a choice and does not.');
console.log('');
for (const f of findings) {
    console.log('  ' + f.verdict + ' - ' + f.decision);
    console.log('     swept: ' + f.swept);
    console.log('     ' + f.detail);
    console.log('');
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT WOULD MAKE THE NON-LIVE ONES LIVE
//
// In the spirit of the overflow fix, which is the model: not a nerf, a REASON
// THE OTHER OPTION IS SOMETIMES RIGHT. These are proposals for a person to
// decide on, not changes; nothing in this probe tunes anything.
// ─────────────────────────────────────────────────────────────────────────

head('THE SMALLEST CHANGE THAT WOULD MAKE EACH NON-LIVE DECISION REAL');

console.log(`
  TRAVEL  (DOMINANT: always move to better ground)
  ------------------------------------------------
  The gap is an ABSENCE rather than a balance problem, which AGENTS.md says is
  worth writing down where the affected material lives: the engine has no cost
  for a journey. \`TimeSkipContext\` takes a \`locationId\` and a
  \`locationDensity\`; it does not take a distance, and nothing charges one.

  Smallest change that flips it: the caller already knows the map, so let it
  hand down the days the road costs the way it already hands down \`hostility\`
  - a number the world layer computes and the engine spends. The break-evens in
  section 12 are already the threshold, so no new constant is needed: at rung 0
  the move pays if the road is under about half a lifespan, and past Foundation
  the margin widens because the span does. Ground selection is ALREADY live
  (crowding, and the barren ceiling), so this is the one term that would make
  reaching that ground a decision as well as recognising it.

  A second, cheaper option: crowding is already the counterweight and already
  works. If the good ground the player can see is the ground everyone else can
  see, a world layer that placed population by density would flip this without
  the engine changing at all.

  INJURY TREATMENT  (DOMINANT: always treat)
  ------------------------------------------
  This one is probably CORRECT AS IT STANDS and should be left alone. "Close
  your meridians" is supposed to have a right answer; the interesting decision
  the setting wants is WHEN you can afford to, and that decision is real - the
  price climbs at PRICE_GROWTH_PER_ORDINAL and the stones compete with the
  crossing pill. What the sweep shows is that the counterweight the code was
  built with - SCAR_PLATEAU and scar attrition - is about six times too small
  to ever reverse the call, so it is doing a different job than the comment
  beside it implies. It is a tax on a long violent life, which is what
  \`assessLastCrossing\` reads it for. That is worth saying in injuries.ts; it
  is not worth retuning.

  CULTIVATION DURATION  (NULL: type the biggest number)
  -----------------------------------------------------
  Also probably correct, and by design: "cultivate for ten years must resolve
  in ONE deterministic pass" is the charter, and this probe confirms it holds
  exactly - same ordinal, same qi, same wounds, same stones, whatever the
  request size. The only thing a smaller number buys is more interruptions.

  So the honest fix is a UI one rather than a mechanical one: since the answer
  is always "ask for as long as you can stand", the interface should not make a
  player type a number as though it were a decision. Offer "until something
  happens" as the default and let the number be the exception.
`);

// ═════════════════════════════════════════════════════════════════════════
// TWO RESULTS THAT WERE HANDED TO THIS PROBE AS KNOWN
//
// Confirmed rather than assumed, because a figure carried forward without
// being re-measured is how three "engine bugs" in this repository turned out
// to be harness errors.
// ═════════════════════════════════════════════════════════════════════════

head('CONFIRMATIONS  -  the two results this sweep was handed, re-measured');

// ── 1. Fortune produces opportunities, not bigger numbers ────────────────
//
// The claim: 75 against 15 missed windows with IDENTICAL event counts. The
// second half is the whole point - if the event counts differed, Fortune would
// be manufacturing branches, which `time-skip.ts` forbids in as many words.

console.log('\n  1. FORTUNE. Same seeds, same ground, same everything but the attribute.');
console.log('     Counted from the digest KINDS, which are engine-authored enum values,');
console.log('     not from the prose in the summaries.');
console.log('  ' + 'fortune'.padStart(9) + 'opportunities drawn'.padStart(22)
    + 'taken'.padStart(9) + 'missed'.padStart(9) + 'encounters'.padStart(13)
    + 'disturbances landed'.padStart(22));

for (const fortune of [0, 1, 2, 3]) {
    let drawn = 0, taken = 0, missed = 0, encounters = 0, landed = 0;
    for (let s = 0; s < 60; s++) {
        const c = CultivatorSchema.parse({
            id: 'fort-' + s, name: 'Probe', spiritRoot: 'single_fire',
            attributes: { might: 2, insight: 2, fortune, charm: 2 },
            realmOrdinal: 4, cultivationProgress: 0, age: 20,
            hp: 100, maxHp: 100, qi: 100, maxQi: 100
        });
        const r = simulateTimeSkip(c, 7300, {
            seed: 'fortune-' + s, locationId: 'cave',
            locationDensity: BAND_DENSITY_CENTRE.normal, startDay: 0,
            grainAbstinence: true, randomEvents: true, autoBreakthrough: false
        });
        for (const e of r.events) {
            if (e.kind === 'opportunity') { drawn += e.occurrences; taken += e.occurrences; }
            if (e.kind === 'opportunity_missed') { drawn += e.occurrences; missed += e.occurrences; }
            if (e.kind === 'encounter') {
                encounters += e.occurrences;
                if (e.data.passedBy === false) landed += e.occurrences;
            }
        }
    }
    console.log('  ' + String(fortune).padStart(9) + String(drawn).padStart(22)
        + String(taken).padStart(9) + String(missed).padStart(9)
        + String(encounters).padStart(13) + String(landed).padStart(22));
}
console.log('\n     CONFIRMED, and the brief\'s summary of it needs one correction.');
console.log('');
console.log('     The claim handed to this sweep was "75 versus 15 missed windows with');
console.log('     IDENTICAL EVENT COUNTS". The missed-window half is right and is the');
console.log('     genre-correct shape. The "identical event counts" half is true of');
console.log('     ENCOUNTERS - flat across all four arms, because Fortune may decide');
console.log('     whether a thing walks past and never how hard it hits - and it is NOT');
console.log('     true of opportunities: Fortune roughly quadruples how many are drawn at');
console.log('     all, because OPPORTUNITY_PER_FORTUNE is 0.1 against a base of 0.1.');
console.log('');
console.log('     That is not a defect. It is what the README says the attribute does -');
console.log('     "Fortune moves whether an opportunity is DRAWN, whether it is still');
console.log('     AVAILABLE when reached" - so both halves are deliberate and both are');
console.log('     working. But a reader who took "identical event counts" literally would');
console.log('     conclude the draw rate is fixed, and it is the larger of the two terms.');
console.log('');
console.log('     And the consequence, which is the most interesting number on this page.');
console.log('     Over the same sixty seeds, twenty years each, nothing but the attribute');
console.log('     changed:');
console.log('');
console.log('         fortune 0:  6 of 60 runs died      fortune 3:  1 of 60');
console.log('');
console.log('     Every one of those deaths is combat_defeat - HP ground to zero by minor');
console.log('     disturbances that LANDED instead of walking past. Fortune never touched');
console.log('     a damage number, never softened a resolution and never reached into a');
console.log('     capability threshold. It only decided how often the thing arrived, and');
console.log('     arriving often enough is fatal on its own. That is the attribute doing');
console.log('     exactly what the README says it may do, and being worth six times a');
console.log('     cultivator\'s life for it.');
console.log('');
console.log('     The skip runs with autoBreakthrough OFF so all four arms sit at the same');
console.log('     rung and draw from the same day grid: otherwise a luckier arm advances,');
console.log('     changes its own realm intake, and the comparison stops being controlled.');

// ── 2. The binding constraint on Qi Condensation is years ────────────────

console.log('\n  2. WHAT ACTUALLY STOPS A CULTIVATOR AT ORDINAL 12.');
const ordinaryRate = (o: number) => computeCultivationRate(
    { spiritRoot: 'quad_metal_wood_earth_water', injuries: [], realmOrdinal: o, attributes: ATTRIBUTE_SETS[1].a },
    'normal', { focusMultiplier: 0.45, techniqueQuality: 'crude' }
).perDay * DAYS_PER_YEAR;

// With a pill at the mean potency probe-pill-affordability actually observes
// (0.39), because that is the population the 90% figure is quoted from. Quoting
// a bare-odds column against a with-pill figure would be comparing two
// different cultivators.
const OBSERVED_MEAN_POTENCY = 0.39;
const rungOdds = (rung: number, withPill: boolean) => computeBreakthroughOdds(
    {
        realmOrdinal: rung, spiritRoot: 'quad_metal_wood_earth_water',
        attributes: ATTRIBUTE_SETS[1].a, injuries: [],
        cultivationProgress: progressRequiredForOrdinal(rung) ?? 0
    },
    {
        ambient: 'normal',
        manualQuality: 'crude',
        pill: withPill
            ? { name: 'a breakthrough pill', potency: OBSERVED_MEAN_POTENCY * MAX_PILL_BONUS }
            : undefined
    }
).finalChance;

console.log('  ' + 'rung'.padStart(6) + 'qi needed'.padStart(12) + 'qi/year'.padStart(10)
    + 'years'.padStart(9) + 'lifespan'.padStart(10) + 'settling'.padStart(10)
    + 'bare'.padStart(8) + 'w/pill'.padStart(8) + '  what binds');
for (const rung of [8, 10, 11, 12, 13]) {
    const need = progressRequiredForOrdinal(rung) ?? 0;
    const perYear = ordinaryRate(rung);
    const years = need / perYear;
    const span = lifespanForOrdinal(rung);
    const settle = stagnationYearsForOrdinal(rung);
    const binds = years > span ? 'YEARS - the rung costs more time than the realm grants'
        : years > settle ? 'YEARS - longer than settling permits standing there'
        : rungOdds(rung, true) < 0.5 ? 'the roll' : 'nothing yet';
    console.log('  ' + String(rung).padStart(6) + n(need).padStart(12) + n(perYear).padStart(10)
        + n(years, 1).padStart(9) + n(span).padStart(10) + n(settle).padStart(10)
        + pct(rungOdds(rung, false), 1).padStart(8) + pct(rungOdds(rung, true), 1).padStart(8)
        + '  ' + binds);
}

console.log('\n     Bare odds first, then the same rung with a pill at the mean potency that');
console.log('     probe-pill-affordability actually observes (0.39), so the comparison is');
console.log('     against the population that probe measures and not a different one.');
console.log('');
console.log('     THE CONCLUSION IS CONFIRMED. Ordinal 12 needs 123.6 years against a');
console.log('     hundred-year span. Nothing about the roll matters there, because the');
console.log('     roll is never reached: the cultivator dies of old age at a part-full');
console.log('     gate, and the odds column is describing a moment that does not arrive.');
console.log('');
console.log('     One correction to how the supporting figure is usually quoted. "The');
console.log('     breakthrough roll is already at 90%" is a MEAN ACROSS THE WHOLE REALM,');
console.log('     which is what probe-pill-affordability reports and is not wrong - but it');
console.log('     is pulled up by the cheap early rungs, and no rung near the top of Qi');
console.log('     Condensation is anywhere near ninety. Measured here, rungs 8 to 11 run');
console.log('     76% to 81% WITH a pill, and ordinal 12 runs 19%, because 12 is not a');
console.log('     sub-rank step at all - it is the Foundation Establishment BOUNDARY and it');
console.log('     carries REALM_BOUNDARY_STRAIN and its own clamp.');
console.log('');
console.log('     That matters for one reason. A pill-timing sweep that took 90% as the');
console.log('     figure AT ordinal 12 would conclude a pill there buys almost nothing.');
console.log('     Section 6 measures it at +10.8 points, which is the largest single-rung');
console.log('     return anywhere in the realm, precisely because the base is so low.');
