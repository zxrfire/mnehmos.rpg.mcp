/**
 * Does the book in your hands decide how long the road takes?
 *
 * Manuals gained a second axis. Coverage - `requiredOrdinal` to `cap` - says
 * which rungs a book carries you over and was already modelled. QUALITY says
 * how well the thing is written, and it is independent: a trash Core Formation
 * manual and an excellent one cover exactly the same rungs.
 *
 * Each section states the claim in the words it was made in and then measures
 * it. Nothing here passes or fails on a number somebody chose; it reports the
 * shape, and where a claim is not made true by the engine it says so, because a
 * claim the design makes and the engine ignores is worse than one nobody made.
 *
 *   THE EIGHTY YEARS  "bad manual -> can still cultivate, but horribly
 *                      inefficiently. That gives you: 'I have a trash Core
 *                      Formation technique. I can continue, but it's going to
 *                      take 80 years.'"
 *   THE PAPERWEIGHT   "a mediocre person wouldn't understand a manual from a TT
 *                      either"
 *   THE CLOCKS        "shitty manuals you can still proceed but you may run out
 *                      of time if not talented"
 *   AZURE DEW         "that's where the quality between the azure dew sect's
 *                      0-13 manual differs from the ones you buy outside"
 *   THE CROSSING      a better book leaves you better PREPARED and never
 *                      teaches the crossing
 *
 * Run: npx tsx scripts/probe-manual-quality.ts
 */

import {
    DAYS_PER_YEAR,
    computeCultivationRate
} from '../src/engine/cultivation/cultivation.js';
import { computeBreakthroughOdds } from '../src/engine/cultivation/breakthrough.js';
import { assessPower } from '../src/engine/cultivation/combat.js';
import {
    MANUAL_QUALITY_ORDER,
    MANUAL_QUALITY_TIERS,
    canTellApart,
    readManual,
    readerComprehension
} from '../src/engine/cultivation/manual-quality.js';
import {
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal
} from '../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../src/schema/cultivation.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { getOrigin } from '../src/engine/cultivation/origin.js';
import { deriveOrdinal } from '../src/engine/world/seeding.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import type {
    AmbientQi,
    InnateAttributes,
    ManualQuality,
    SpiritRootKey
} from '../src/schema/cultivation.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('═'.repeat(94)); line('  ' + t); line('═'.repeat(94)); };
const claim = (t: string) => { line(); line('  CLAIM: ' + t); line(); };

const verdicts: { name: string; holds: boolean; because: string }[] = [];
const record = (name: string, holds: boolean, because: string) => {
    verdicts.push({ name, holds, because });
    line();
    line(`  ${holds ? 'HOLDS' : 'DOES NOT HOLD'} - ${because}`);
};

// ─────────────────────────────────────────────────────────────────────────
// THE WALKER
//
// Rung by rung on the player's own functions - `computeCultivationRate`
// against `progressRequiredForOrdinal`, rolled at `computeBreakthroughOdds` -
// and refused by the clocks that already exist. There is no manual-specific
// death rule anywhere in this file and there must not be one: a bad book is
// slow, and `stagnationYearsForOrdinal` and `lifespanForOrdinal` decide on
// their own whether slow is fatal.
//
// The attribute block is built legally. `might` caps at 3 and `insight` at 4,
// so a probe using 5s is not measuring this game.
// ─────────────────────────────────────────────────────────────────────────

const MEDIOCRE: InnateAttributes = { might: 2, insight: 2, fortune: 1, charm: 2 };
const PRODIGY: InnateAttributes = { might: 3, insight: 4, fortune: 2, charm: 2 };

interface Walk {
    /** Rung reached. */
    ordinal: number;
    /** Years spent getting there from the start rung. */
    years: number;
    /** Why it stopped. */
    end: 'arrived' | 'settling' | 'lifespan';
    /** Odds faced at the last boundary attempted, or null if none was reached. */
    oddsAtCrossing: number | null;
    /** Failed attempts paid for along the way. */
    failures: number;
}

function walk(opts: {
    root: SpiritRootKey;
    attributes: InnateAttributes;
    quality: ManualQuality;
    from: number;
    to: number;
    ambient?: AmbientQi;
    age?: number;
    sectBonus?: number;
    seed?: string;
    maxAttempts?: number;
}): Walk {
    const ambient = opts.ambient ?? 'normal';
    const rng = forStream(opts.seed ?? 'probe-manual-quality', 'walk', opts.quality);
    let ordinal = opts.from;
    let age = opts.age ?? 20;
    let years = 0;
    let failures = 0;
    let oddsAtCrossing: number | null = null;

    while (ordinal < opts.to) {
        const cost = progressRequiredForOrdinal(ordinal);
        if (cost === null) break;
        const body = {
            spiritRoot: opts.root,
            injuries: [],
            realmOrdinal: ordinal,
            attributes: opts.attributes,
            cultivationProgress: cost,
            alive: true
        };
        const perYear = computeCultivationRate(body, ambient, {
            techniqueQuality: opts.quality,
            sectBonus: opts.sectBonus ?? 1
        }).perDay * DAYS_PER_YEAR;
        if (perYear <= 0) return { ordinal, years, end: 'settling', oddsAtCrossing, failures };

        const allowance = stagnationYearsForOrdinal(ordinal);
        const lifespan = lifespanForOrdinal(ordinal);
        let atRank = 0;
        let crossed = false;

        for (let attempt = 0; attempt < (opts.maxAttempts ?? 20); attempt++) {
            const needed = cost / perYear;
            // The two clocks that already exist. A plateau longer than the realm
            // permits ends the life where it stands (`stagnation_aging` in
            // survival.ts is a real cause of death); a span runs out.
            if (atRank + needed >= allowance) {
                return { ordinal, years, end: 'settling', oddsAtCrossing, failures };
            }
            if (age + needed >= lifespan) {
                return { ordinal, years, end: 'lifespan', oddsAtCrossing, failures };
            }
            atRank += needed;
            years += needed;
            age += needed;

            const odds = computeBreakthroughOdds(body, {
                ambient,
                pill: null,
                manualQuality: opts.quality
            });
            if (realmForOrdinal(ordinal).ordinalEnd === ordinal) oddsAtCrossing = odds.finalChance;
            if (rng.next() < odds.finalChance) { crossed = true; break; }
            failures++;
        }
        if (!crossed) return { ordinal, years, end: 'settling', oddsAtCrossing, failures };
        ordinal++;
    }
    return { ordinal, years, end: 'arrived', oddsAtCrossing, failures };
}

const yrs = (n: number) => (!Number.isFinite(n) ? 'never' : n >= 10000 ? '10000+' : n.toFixed(0));
const pct = (n: number | null) => (n === null ? '-' : `${(n * 100).toFixed(1)}%`);

/**
 * Years of accumulation to climb a stretch, with no breakthrough rolls in it.
 *
 * Deliberately separate from `walk`. Mixing the road and the dice produced a
 * table in which a corrupt book "took fewer years" than a good one - because it
 * had been REFUSED by the settling clock early and stopped counting, while the
 * good book was still climbing. The road is a deterministic quantity and gets
 * reported as one; luck gets its own column.
 */
function climbYears(opts: {
    root: SpiritRootKey;
    attributes: InnateAttributes;
    quality: ManualQuality;
    from: number;
    to: number;
    ambient?: AmbientQi;
    sectBonus?: number;
}): number {
    let total = 0;
    for (let o = opts.from; o < opts.to; o++) {
        const cost = progressRequiredForOrdinal(o);
        if (cost === null) return total;
        const perYear = computeCultivationRate(
            { spiritRoot: opts.root, injuries: [], realmOrdinal: o, attributes: opts.attributes },
            opts.ambient ?? 'normal',
            { techniqueQuality: opts.quality, sectBonus: opts.sectBonus ?? 1 }
        ).perDay * DAYS_PER_YEAR;
        if (perYear <= 0) return Number.POSITIVE_INFINITY;
        total += cost / perYear;
    }
    return total;
}

/** Odds at a boundary, for somebody standing on it with the progress banked. */
function oddsAt(ordinal: number, attributes: InnateAttributes, quality: ManualQuality): number {
    return computeBreakthroughOdds({
        realmOrdinal: ordinal, spiritRoot: 'dual_metal_wood', attributes, injuries: [],
        cultivationProgress: progressRequiredForOrdinal(ordinal) ?? 0
    }, { ambient: 'normal', pill: null, manualQuality: quality }).finalChance;
}

/** How a hundred seeded lives on the same book ended. */
function survey(n: number, make: (seed: string) => Walk): {
    arrived: number; settling: number; lifespan: number; medianOrdinal: number;
} {
    const runs = Array.from({ length: n }, (_, i) => make(`life-${i}`));
    const byOrdinal = [...runs].sort((a, b) => a.ordinal - b.ordinal);
    return {
        arrived: runs.filter(r => r.end === 'arrived').length,
        settling: runs.filter(r => r.end === 'settling').length,
        lifespan: runs.filter(r => r.end === 'lifespan').length,
        medianOrdinal: byOrdinal[Math.floor(n / 2)].ordinal
    };
}

function main(): void {
    // -- THE TIERS ---------------------------------------------------------
    rule('THE AXIS: WHAT A TIER IS WORTH, AND WHAT IT ASKS FOR');
    line('  Coverage is `requiredOrdinal` to `cap` and is unchanged. This is the other');
    line('  axis. `demand` is in insight degrees - the ladder understanding.ts already');
    line('  uses - and the bottom two tiers demand nothing, which is what guarantees an');
    line('  untalented cultivator can always proceed on something.');
    line();
    line('  ' + 'tier'.padEnd(11) + 'rate'.padStart(7) + 'odds'.padStart(8)
        + 'power'.padStart(7) + 'demand'.padStart(8) + '   what makes a book this');
    line('  ' + '─'.repeat(92));
    for (const q of MANUAL_QUALITY_ORDER) {
        const t = MANUAL_QUALITY_TIERS[q];
        line('  ' + q.padEnd(11)
            + `x${t.rate.toFixed(2)}`.padStart(7)
            + (t.preparation >= 0 ? `+${(t.preparation * 100).toFixed(1)}pp` : `${(t.preparation * 100).toFixed(1)}pp`).padStart(8)
            + `x${t.power.toFixed(2)}`.padStart(7)
            + t.demand.toFixed(1).padStart(8)
            + '   ' + t.cause.split('. ')[0] + '.');
    }

    // -- THE EIGHTY YEARS --------------------------------------------------
    rule('THE EIGHTY YEARS: DOES A TRASH MANUAL COST A LIFETIME?');
    claim('"bad manual -> can still cultivate, but horribly inefficiently. That gives you:\n'
        + "         'I have a trash Core Formation technique. I can continue, but it's going\n"
        + "         to take 80 years.'\"");
    line('  Years of accumulation to walk the whole of Core Formation - 17 to 21, its first');
    line('  rung to standing on the far side - with no dice in it. The manual is the ONLY');
    line('  thing that changes. The crossing at 20 is reported beside it rather than folded');
    line('  in, because a book decides the road and the dice decide the day.');
    line();
    line('  ' + 'manual'.padEnd(11)
        + 'single root'.padStart(13) + 'dual root'.padStart(12) + 'muddled'.padStart(11)
        + 'odds at 20'.padStart(13) + 'vs a sound book'.padStart(18));
    line('  ' + '─'.repeat(80));
    const soundYears = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: 'sound', from: 17, to: 21 });
    for (const q of MANUAL_QUALITY_ORDER) {
        const one = climbYears({ root: 'single_fire', attributes: MEDIOCRE, quality: q, from: 17, to: 21 });
        const two = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: q, from: 17, to: 21 });
        const mud = climbYears({ root: 'muddled_five_element', attributes: MEDIOCRE, quality: q, from: 17, to: 21 });
        line('  ' + q.padEnd(11) + yrs(one).padStart(13) + yrs(two).padStart(12) + yrs(mud).padStart(11)
            + pct(oddsAt(20, MEDIOCRE, q)).padStart(13)
            + `x${(two / soundYears).toFixed(2)}`.padStart(18));
    }
    const corruptYears = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: 'corrupt', from: 17, to: 21 });
    const crudeYears = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: 'crude', from: 17, to: 21 });
    record('a trash manual costs a lifetime and still works',
        corruptYears > soundYears * 2 && Number.isFinite(corruptYears),
        `the same Core Formation stretch is ${yrs(soundYears)} years on a working book, `
        + `${yrs(crudeYears)} on a market copy and ${yrs(corruptYears)} on a damaged one `
        + `(x${(corruptYears / soundYears).toFixed(1)}) - and the damaged one still gets there, `
        + `at ${pct(oddsAt(20, MEDIOCRE, 'corrupt'))} at the crossing against `
        + `${pct(oddsAt(20, MEDIOCRE, 'pristine'))} on the author's own copy`);

    // -- THE PAPERWEIGHT ---------------------------------------------------
    rule('THE PAPERWEIGHT: IS A GREAT BOOK IN THE WRONG HANDS WORSE THAN A PLAIN ONE?');
    claim('"a mediocre person wouldn\'t understand a manual from a TT either"');
    line('  Two cultivators, same root and same ground, each handed the same books. The only');
    line('  difference is who they are. A book demands comprehension in insight degrees; the');
    line('  reader brings innate insight, the deepest insight that BEARS on what they are');
    line('  practising, and what their foundation left them standing on.');
    line();
    for (const [who, attrs] of [['mediocre', MEDIOCRE], ['prodigy', PRODIGY]] as const) {
        const c = readerComprehension({ spiritRoot: 'dual_metal_wood', attributes: attrs });
        line(`  ${who.padEnd(9)} comprehension ${c.degrees.toFixed(1)} degrees `
            + `(insight ${c.fromInsight}, seen ${c.fromSeen}, foundation ${c.fromFoundation})`);
    }
    line();
    line('  ' + 'manual'.padEnd(11) + 'mediocre rate'.padStart(15) + 'yrs 17->21'.padStart(12)
        + '   ' + 'prodigy rate'.padStart(13) + 'yrs 17->21'.padStart(12) + 'lands'.padStart(9));
    line('  ' + '─'.repeat(74));
    let paperweight = false;
    let plainMediocre = 0;
    for (const q of MANUAL_QUALITY_ORDER) {
        const rm = readManual({ quality: q }, { spiritRoot: 'dual_metal_wood', attributes: MEDIOCRE });
        const rp = readManual({ quality: q }, { spiritRoot: 'dual_metal_wood', attributes: PRODIGY });
        const wm = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: q, from: 17, to: 21 });
        const wp = climbYears({ root: 'dual_metal_wood', attributes: PRODIGY, quality: q, from: 17, to: 21 });
        if (q === 'sound') plainMediocre = rm.rateMultiplier;
        if (q === 'pristine' && rm.rateMultiplier < plainMediocre) paperweight = true;
        line('  ' + q.padEnd(11)
            + `x${rm.rateMultiplier.toFixed(2)}`.padStart(15) + yrs(wm).padStart(12)
            + '   ' + `x${rp.rateMultiplier.toFixed(2)}`.padStart(13) + yrs(wp).padStart(12)
            + `${Math.round(rm.realised * 100)}%`.padStart(9));
    }
    const rmP = readManual({ quality: 'pristine' }, { spiritRoot: 'dual_metal_wood', attributes: MEDIOCRE });
    record('a manual far above the reader is worse than one pitched at them',
        paperweight,
        paperweight
            ? `a mediocre reader gets x${rmP.rateMultiplier.toFixed(2)} out of a pristine canon `
              + `against x${plainMediocre.toFixed(2)} out of a sound one - ${rmP.shortfall.toFixed(1)} `
              + `degrees short, so ${Math.round(rmP.realised * 100)}% of it lands`
            : 'the best book is always the best book, so the axis is a shopping list');

    // -- THE THIRD CASE AND THE CLOCKS -------------------------------------
    rule('THE THIRD CASE, AND THE CLOCKS THAT WERE ALREADY THERE');
    claim('"shitty manuals you can still proceed but you may run out of time if not talented"');
    line('  Both halves of one sentence, measured together, because they are one measurement.');
    line('  A hundred seeded lives per book: a mediocre dual root admitted to a sect at');
    line('  sixteen, climbing all of Qi Condensation and across into Foundation Establishment.');
    line('  NOTHING IN THE QUALITY AXIS MENTIONS DEATH. What ends these lives is');
    line(`  \`stagnationYearsForOrdinal\` (${stagnationYearsForOrdinal(0)} years of allowance at rung 0) and `
        + `\`lifespanForOrdinal\``);
    line(`  (${lifespanForOrdinal(0)} years), which have been there the whole time and have never heard of a manual.`);
    line();
    line('  ' + 'manual'.padEnd(11) + 'reach Foundation'.padStart(18) + 'out of time'.padStart(13)
        + 'span ran out'.padStart(14) + 'median rung'.padStart(13) + 'road alone'.padStart(12));
    line('  ' + '─'.repeat(82));
    const results: Record<string, ReturnType<typeof survey>> = {};
    for (const q of MANUAL_QUALITY_ORDER) {
        const s = survey(100, seed => walk({
            root: 'dual_metal_wood', attributes: MEDIOCRE, quality: q,
            from: 0, to: 13, age: 16, sectBonus: 1.25, seed
        }));
        results[q] = s;
        const road = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: q, from: 0, to: 13, sectBonus: 1.25 });
        line('  ' + q.padEnd(11) + `${s.arrived}%`.padStart(18) + `${s.settling}%`.padStart(13)
            + `${s.lifespan}%`.padStart(14) + String(s.medianOrdinal).padStart(13)
            + `${yrs(road)} yrs`.padStart(12));
    }
    record('a plain book still carries an ordinary person across a realm',
        results.crude.arrived > 0,
        results.crude.arrived > 0
            ? `${results.crude.arrived} of 100 mediocre cultivators on the market primer reach `
              + `Foundation Establishment, against ${results.sound.arrived} on a working book`
            : 'not one mediocre cultivator on the market primer reaches Foundation, so nine in '
              + 'ten people in the world are locked out of it');
    record('a bad book runs the untalented out of time on the clocks that exist',
        results.corrupt.arrived < results.sound.arrived
            && results.corrupt.settling + results.corrupt.lifespan > 0,
        `a damaged text ends ${results.corrupt.settling + results.corrupt.lifespan} of 100 lives `
        + 'against the settling allowance or the span, where a working book ends '
        + `${results.sound.settling + results.sound.lifespan}`);

    // ── AZURE DEW ───────────────────────────────────────────────────────────
    rule('AZURE DEW: SAME RUNGS, DIFFERENT BOOK');
    claim('"that\'s where the quality between the azure dew sect\'s 0-13 manual differs from\n'
        + '         the ones you buy outside"');
    const stall = getTechnique('lesser-qi-gathering-manual');
    const dew = getTechnique('azure-dew-gathering-canon');
    if (!stall || !dew) {
        record('the comparison exists in the catalog', false,
            'one of the two 0-13 manuals is missing from the catalog');
    } else {
        line('  ' + 'manual'.padEnd(28) + 'grade'.padStart(8) + 'req'.padStart(5)
            + 'cap'.padStart(5) + 'element'.padStart(9) + 'quality'.padStart(10));
        line('  ' + '─'.repeat(66));
        for (const t of [stall, dew]) {
            line('  ' + t.name.padEnd(28) + t.grade.padStart(8)
                + String(t.requiredOrdinal).padStart(5) + String(t.cap).padStart(5)
                + String(t.element ?? 'none').padStart(9) + t.quality.padStart(10));
        }
        line();
        line('  Identical coverage and identical grade - which is the point. GRADE CANNOT');
        line('  SEPARATE THEM: `GRADE_ORDINAL_BANDS` binds grade to `requiredOrdinal`, both');
        line('  open at ordinal 0, so both are necessarily `mortal`.');
        line();
        line('  ' + 'reader'.padEnd(10) + 'on the stall book'.padStart(19)
            + 'on the Dew canon'.padStart(19) + 'can they tell?'.padStart(16));
        line('  ' + '─'.repeat(64));
        for (const [who, attrs] of [['mediocre', MEDIOCRE], ['prodigy', PRODIGY]] as const) {
            const reader = { spiritRoot: 'dual_metal_wood' as SpiritRootKey, attributes: attrs };
            const a = climbYears({ root: 'dual_metal_wood', attributes: attrs, quality: stall.quality, from: 0, to: 13 });
            const b = climbYears({ root: 'dual_metal_wood', attributes: attrs, quality: dew.quality, from: 0, to: 13 });
            line('  ' + who.padEnd(10)
                + `${yrs(a)} yrs to 13`.padStart(19)
                + `${yrs(b)} yrs to 13`.padStart(19)
                + (canTellApart(stall, dew, reader) ? 'yes' : 'no').padStart(16));
        }
        const mediocreStall = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: stall.quality, from: 0, to: 13 });
        const mediocreDew = climbYears({ root: 'dual_metal_wood', attributes: MEDIOCRE, quality: dew.quality, from: 0, to: 13 });
        record('joining a house buys a better version of rungs you could have bought',
            mediocreDew < mediocreStall,
            mediocreDew < mediocreStall
                ? `the Dew canon clears Qi Condensation in ${yrs(mediocreDew)} years where the `
                  + `stall copy takes ${yrs(mediocreStall)}, over identical rungs`
                : 'the house book is no faster over the same rungs, so admission buys nothing '
                  + 'at the bottom of the ladder');
    }

    // ── THE CROSSING ────────────────────────────────────────────────────────
    rule('THE CROSSING: PREPARATION, NEVER INSTRUCTION');
    claim('the crossing out of a realm is not in the book, and no book can put it there');
    line('  `triggersHeavenlyTribulation` takes an ordinal and nothing else, so what a');
    line('  cultivator meets at a boundary is decided by where they stand. What a better book');
    line('  contributes is the foundation it spent the realm building, arriving with them.');
    line();
    line('  Odds at the same boundary, same cultivator, different books:');
    line();
    line('  ' + 'boundary'.padEnd(32) + MANUAL_QUALITY_ORDER.map(q => q.padStart(10)).join(''));
    line('  ' + '─'.repeat(82));
    for (const at of [12, 20, 28]) {
        const cells = MANUAL_QUALITY_ORDER.map(q => {
            const o = computeBreakthroughOdds({
                realmOrdinal: at,
                spiritRoot: 'dual_metal_wood',
                attributes: MEDIOCRE,
                injuries: [],
                cultivationProgress: progressRequiredForOrdinal(at) ?? 0
            }, { ambient: 'normal', pill: null, manualQuality: q });
            return pct(o.finalChance).padStart(10);
        });
        line('  ' + `${at} -> ${at + 1}  ${rankName(at)}`.slice(0, 32).padEnd(32) + cells.join(''));
    }
    const worst = computeBreakthroughOdds({
        realmOrdinal: 20, spiritRoot: 'dual_metal_wood', attributes: MEDIOCRE, injuries: [],
        cultivationProgress: progressRequiredForOrdinal(20) ?? 0
    }, { ambient: 'normal', pill: null, manualQuality: 'corrupt' });
    const best = computeBreakthroughOdds({
        realmOrdinal: 20, spiritRoot: 'dual_metal_wood', attributes: MEDIOCRE, injuries: [],
        cultivationProgress: progressRequiredForOrdinal(20) ?? 0
    }, { ambient: 'normal', pill: null, manualQuality: 'pristine' });
    record('the book moves the odds without teaching the crossing',
        best.finalChance > worst.finalChance,
        `at 20 -> 21 a corrupt text leaves a mediocre cultivator on ${pct(worst.finalChance)} and `
        + `an author's own copy on ${pct(best.finalChance)}; the modifier is booked as `
        + `'manual:<tier>' beside the foundation, not beside the tribulation`);

    // ── STRENGTH ────────────────────────────────────────────────────────────
    rule('STRENGTH: IS A BETTER-EXPLAINED METHOD A BETTER CULTIVATOR AT THE SAME RUNG?');
    claim('"you cultivate it faster / are stronger cuz it\'s better explained (if you are a prodigy)"');
    line('  Same rung, same root, same mastery. Only the book changes. Note the parenthesis in');
    line('  the claim: the prodigy gets the whole of a great method and the mediocre reader');
    line('  gets a fraction, but NEVER less than 1 - an art you do not understand is an art you');
    line('  do not use, and being handed one does not make you weaker in a fight.');
    line();
    line('  ' + 'manual'.padEnd(11) + 'mediocre power'.padStart(16) + 'prodigy power'.padStart(16)
        + 'spread'.padStart(10));
    line('  ' + '─'.repeat(54));
    const priced = (attrs: InnateAttributes, q: ManualQuality): number => assessPower({
        id: 'x', name: 'x', realmOrdinal: 22, spiritRoot: 'dual_metal_wood',
        attributes: attrs, injuries: [], hp: 100, maxHp: 100, qi: 100, maxQi: 100,
        techniqueMastery: 0.6,
        technique: {
            id: 't', name: 'road', category: 'cultivation', grade: 'heaven', element: null,
            requiredOrdinal: 21, qiCost: 60, damage: null, subject: null, mastery: 0.6,
            description: '', cooldown: 0, class: 'cultivation', cap: 25, quality: q,
            rootGrades: [], domain: null, domainDegree: 1, volumes: null, derivable: false,
            opening: null
        }
    }, { ambient: 'normal' }).total;
    const baseM = priced(MEDIOCRE, 'sound');
    const baseP = priced(PRODIGY, 'sound');
    for (const q of MANUAL_QUALITY_ORDER) {
        const m = priced(MEDIOCRE, q) / baseM;
        const p = priced(PRODIGY, q) / baseP;
        line('  ' + q.padEnd(11) + `x${m.toFixed(3)}`.padStart(16) + `x${p.toFixed(3)}`.padStart(16)
            + `${((p / m - 1) * 100).toFixed(1)}%`.padStart(10));
    }
    const mp = priced(MEDIOCRE, 'pristine') / baseM;
    const pp = priced(PRODIGY, 'pristine') / baseP;
    record('a better book makes a better cultivator, and more so for a prodigy',
        pp > mp && mp >= 1,
        `an author's own copy is worth x${pp.toFixed(3)} to a prodigy and x${mp.toFixed(3)} to a `
        + 'mediocre reader at the same rung, and never under 1 to either');

    // -- BACKING -----------------------------------------------------------
    rule('BACKING: DOES THE BOOK AN ORIGIN HANDS YOU SHORTEN THE ROAD?');
    claim('"you take longer without a teacher"');
    line('  `scripts/audit-alive-world.ts` has been measuring this and reporting a gap of ONE');
    line('  rung, which is far too thin for the thing the setting says backing is worth. The');
    line('  reason was in `deriveLife`: `techniqueBonus` was fed `1 + insight * 0.06`, a proxy');
    line('  for a manual nobody was holding, so every life in the world practised the same');
    line('  imaginary average book and an origin could only move the ground and the stipend.');
    line();
    line('  An origin now says which BOOK somebody was handed - `roadQuality` on `OriginTier`,');
    line('  beside the ground and the sect bonus - and the same comparison reads:');
    line();
    line('  ' + 'born'.padEnd(20) + 'shelf'.padStart(10) + 'by age 60'.padStart(11)
        + 'by 200'.padStart(9) + 'ever'.padStart(7));
    line('  ' + '─'.repeat(58));
    // MEDIAN OF SIXTY LIVES, not one. `deriveLife` consumes its stream one
    // breakthrough attempt at a time, so a faster rate takes fewer attempts,
    // consumes fewer draws and lands on a different sequence. A single seed
    // therefore reports luck as if it were a finding - it showed a Dao house
    // reaching ordinal 9 where a retainer family reached 12, which is noise.
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const reachedBy: Record<string, number> = {};
    for (const key of ['thin_county', 'sect_retainer', 'dao_house_bloodline'] as const) {
        const origin = getOrigin(key);
        const at = (age: number) => median(Array.from({ length: 60 }, (_, i) => deriveOrdinal(
            'dual_metal_wood', MEDIOCRE, age, 1, MAX_ORDINAL,
            forStream('probe-manual-quality', 'backing', `${key}-${i}`),
            { ambient: 'normal', origin: key }
        )));
        reachedBy[key] = at(100000);
        line('  ' + key.padEnd(20) + origin.roadQuality.padStart(10)
            + String(at(60)).padStart(11) + String(at(200)).padStart(9)
            + String(reachedBy[key]).padStart(7));
    }
    const gap = Math.max(reachedBy.sect_retainer, reachedBy.dao_house_bloodline) - reachedBy.thin_county;
    record('backing shortens the road by more than a rung', gap > 1,
        gap > 1
            ? `unbacked reaches ${reachedBy.thin_county}, backed reaches `
              + `${Math.max(reachedBy.sect_retainer, reachedBy.dao_house_bloodline)} - a gap of ${gap} rungs, `
              + 'where the proxy produced 1'
            : `the gap is ${gap} rung(s): the book an origin hands over is not doing measurable work`);

    // ── SUMMARY ─────────────────────────────────────────────────────────────
    rule('WHAT THE ENGINE ACTUALLY MAKES TRUE');
    const held = verdicts.filter(v => v.holds);
    const broken = verdicts.filter(v => !v.holds);
    line();
    line(`  ${held.length} of ${verdicts.length} claims hold.`);
    if (broken.length > 0) {
        line();
        line('  NOT MADE TRUE BY THE ENGINE');
        for (const v of broken) line(`    ${v.name}
      ${v.because}`);
    }
    if (held.length > 0) {
        line();
        line('  MADE TRUE');
        for (const v of held) line(`    ${v.name}\n      ${v.because}`);
    }
    line();
}

main();
