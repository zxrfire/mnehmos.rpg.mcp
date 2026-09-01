/**
 * Does the engine do what the lore says the world does?
 *
 * `audit-lore.ts` checks the catalogs against EACH OTHER - ids that resolve,
 * numbers that agree. This checks them against the DOCS: every claim in
 * `docs/world/` that has a mechanical counterpart, tested against the engine
 * that is supposed to produce it.
 *
 * The two failure directions are different and both matter:
 *
 *   UNIMPLEMENTED  the lore states a rule the engine does not have. The world
 *                  is described as doing something it does not do, and a player
 *                  who reads the setting and plays it will find they disagree.
 *   CONTRADICTED   the engine does something the lore says it must not. Worse,
 *                  because the setting is being actively undermined rather than
 *                  merely oversold.
 *
 * Each check quotes the sentence it is testing, so a failure can be argued with
 * rather than merely believed - the doc may be the thing that is wrong, and
 * saying which line is being tested is what makes that argument possible.
 */

import { PILLS, isAdvancement } from '../src/data/cultivation/pills.js';
import { RECIPES } from '../src/data/cultivation/recipes.js';
import { HERBS } from '../src/data/cultivation/herbs.js';
import { FACTION_CHARACTER } from '../src/data/cultivation/faction-character.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { computeCultivationRate } from '../src/engine/cultivation/cultivation.js';
import { computeBreakthroughOdds } from '../src/engine/cultivation/breakthrough.js';
import { progressRequiredForOrdinal } from '../src/engine/cultivation/realms.js';
import { assessGap, assessPower } from '../src/engine/cultivation/combat.js';
import { BAND_DENSITY_CENTRE } from '../src/engine/cultivation/ambient.js';
import { QI_BARREN_DENSITY } from '../src/engine/cultivation/cultivation.js';
import { MANUALS_MAY_EXCEED_THE_LID, OBJECT_CEILING_BELOW_THE_LID } from '../src/engine/cultivation/realms.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(96)); line('  ' + t); line('='.repeat(96)); };

type Verdict = 'HOLDS' | 'UNIMPLEMENTED' | 'CONTRADICTED';
const findings: { verdict: Verdict; claim: string; quote: string; evidence: string }[] = [];

function check(verdict: Verdict, claim: string, quote: string, evidence: string): void {
    findings.push({ verdict, claim, quote, evidence });
}

// ─────────────────────────────────────────────────────────────────────────
// qi.md - "qi is contested"
// ─────────────────────────────────────────────────────────────────────────

/**
 * The claim has a precise mechanical shape: rate should fall as the number of
 * cultivators drawing on the same ground rises. So the test is whether the rate
 * function can even SEE a population. It takes a cultivator and an ambient
 * band; there is no third argument for the valley.
 */
function qiIsContested(): void {
    const body = {
        spiritRoot: 'single_fire' as const, attributes: { might: 3, insight: 3, fortune: 3, charm: 3 },
        realmOrdinal: 10, foundationQuality: 'none' as const, insights: [], injuries: []
    };
    const valley = (heads: number) => ({
        density: BAND_DENSITY_CENTRE.normal,
        occupantOrdinals: Array.from({ length: heads }, () => 10)
    });

    // The doc's own worked example, run as an experiment: the same person, the
    // same ground, thirty neighbours against three hundred.
    const thirty = computeCultivationRate(body as never, 'normal' as never,
        { ground: valley(30) } as never);
    const threeHundred = computeCultivationRate(body as never, 'normal' as never,
        { ground: valley(300) } as never);
    const slower = threeHundred.perDay < thirty.perDay;

    check(slower ? 'HOLDS' : 'UNIMPLEMENTED',
        'Qi is contested: more cultivators on one vein means everyone advances more slowly',
        'A valley that comfortably carries thirty cultivators carries three hundred badly, and '
        + 'everyone in it progresses more slowly for every additional person.',
        `On one ordinary vein, thirty occupants give ${thirty.perDay.toFixed(3)}/day and three `
        + `hundred give ${threeHundred.perDay.toFixed(3)}/day - a factor of `
        + `${(thirty.perDay / Math.max(threeHundred.perDay, 1e-9)).toFixed(1)}. `
        + (slower
            ? 'Occupancy is summed as draw rather than heads, so one elder crowds out many mortals '
            + 'and the setting\'s culling arithmetic has a mechanism behind it.'
            : 'Rate does not move with occupancy, so the stated motive for limiting intake and for '
            + '"a massacre is an investment ... and it works" has nothing behind it.'));
}

// ─────────────────────────────────────────────────────────────────────────
// qi.md - the hard floor
// ─────────────────────────────────────────────────────────────────────────

function thinGroundStops(): void {
    const on = (ordinal: number) => computeCultivationRate(
        {
            spiritRoot: 'single_fire' as const, attributes: { might: 3, insight: 3, fortune: 3, charm: 3 },
            realmOrdinal: ordinal, foundationQuality: 'none' as const, insights: [], injuries: []
        } as never,
        'thin' as never,
        { ground: { density: QI_BARREN_DENSITY * 0.9, occupantOrdinals: [ordinal] } } as never
    ).perDay;

    // The claim is a CEILING, not a slowdown: barren ground should carry a life
    // through the first realm and then stop, so the answer is to move.
    const insideFirstRealm = on(6);
    const pastIt = on(13);
    const holds = insideFirstRealm > 0 && pastIt === 0;

    check(holds ? 'HOLDS' : 'UNIMPLEMENTED',
        'In poor enough ground, cultivation stops outright rather than merely slowing',
        'There is not enough ambient qi to condense, and no amount of talent, discipline or years '
        + 'will manufacture it. Whole provinces exist where nobody has passed Qi Condensation in '
        + 'living memory.',
        `On ground poorer than the thin band (density ${(QI_BARREN_DENSITY * 0.9).toFixed(3)}): ordinal 6 draws `
        + `${insideFirstRealm.toFixed(3)}/day, ordinal 13 draws ${pastIt.toFixed(3)}/day. `
        + (holds
            ? 'A hard zero from ordinal 12 up. Rungs 0-11 stay climbable, so a life born on dead '
            + 'ground has most of a realm of runway before the ceiling is the thing in its way, and '
            + 'the answer is to leave.'
            : 'A multiplier scales and never stops, so given years everybody passes Qi Condensation '
            + 'and the hopeless province is not reproducible.'));
}

// ─────────────────────────────────────────────────────────────────────────
// economy.md - two pricing rules, both strict
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which effects count as advancement is `isAdvancement` in `pills.ts`, and it is
 * imported rather than restated. This audit hardcoded its own set once, which
 * meant three places in the project were entitled to an opinion about the same
 * question and two of them were wrong - so a correction to the catalog's own
 * definition could not reach the check that was supposed to police it.
 */
function advancementCostsMore(): void {
    const byGrade = new Map<string, { adv: number[]; sur: number[] }>();
    for (const p of PILLS) {
        const g = String((p as never as { grade: string }).grade ?? 'unknown');
        const slot = byGrade.get(g) ?? { adv: [], sur: [] };
        (isAdvancement((p as never as { effect: never }).effect) ? slot.adv : slot.sur)
            .push(Number((p as never as { value: number }).value ?? 0));
        byGrade.set(g, slot);
    }
    const broken: string[] = [];
    for (const [grade, { adv, sur }] of byGrade) {
        if (adv.length === 0 || sur.length === 0) continue;
        // "sit at the top of the value range" - the cheapest advancement pill in
        // a grade should still beat the dearest survival pill in it.
        const cheapestAdvancement = Math.min(...adv);
        const dearestSurvival = Math.max(...sur);
        if (cheapestAdvancement <= dearestSurvival) {
            broken.push(`${grade}: cheapest advancement ${cheapestAdvancement} <= dearest survival ${dearestSurvival}`);
        }
    }
    check(broken.length === 0 ? 'HOLDS' : 'CONTRADICTED',
        'Within a grade, advancement is dearer than survival',
        'Buying advancement always costs more than buying survival. Within a grade, the things that '
        + 'touch progression ... sit at the top of both the value and the danger ranges.',
        broken.length === 0
            ? `Holds across ${byGrade.size} grade(s).`
            : broken.join('; '));
}

function refinementAddsValue(): void {
    const herbValue = new Map(HERBS.map(h => [h.id, Number((h as never as { value: number }).value ?? 0)]));
    const pillValue = new Map(PILLS.map(p => [p.id, Number((p as never as { value: number }).value ?? 0)]));
    const broken: string[] = [];
    for (const r of RECIPES) {
        const recipe = r as never as {
            id: string; pillId: string;
            ingredients: { herbId: string; quantity: number }[];
        };
        const out = pillValue.get(recipe.pillId);
        if (out === undefined) continue;
        const inValue = (recipe.ingredients ?? [])
            .reduce((sum, i) => sum + (herbValue.get(i.herbId) ?? 0) * (i.quantity ?? 1), 0);
        if (inValue >= out) broken.push(`${recipe.id}: ingredients ${inValue} >= pill ${out}`);
    }
    check(broken.length === 0 ? 'HOLDS' : 'CONTRADICTED',
        'Refining is worth doing: a pill is worth strictly more than its ingredients',
        'The combined market value of a recipe\'s ingredients is strictly less than the pill\'s, '
        + 'otherwise no alchemist would exist and the ingredient market would be the whole economy.',
        broken.length === 0
            ? `Holds across ${RECIPES.length} recipes.`
            : `${broken.length} of ${RECIPES.length} recipes lose money: ` + broken.slice(0, 4).join('; '));
}

// ─────────────────────────────────────────────────────────────────────────
// The gap, which the setting is emphatic about in both directions
// ─────────────────────────────────────────────────────────────────────────

function theGapIsAsymmetric(): void {
    const make = (ordinal: number) => assessPower({
        id: `c${ordinal}`, name: 'x', realmOrdinal: ordinal, immortalStatus: 'none',
        hp: 100, maxHp: 100, qi: 100, maxQi: 100,
        attributes: { might: 3, insight: 3, fortune: 3, charm: 3 },
        spiritRoot: 'single_fire', injuries: [], techniques: [], artifacts: []
    } as never, { ambient: 'normal' } as never);

    const low = make(4);
    const high = make(30);
    const lookingUp = assessGap(low, high);     // two-plus realms above me
    const lookingDown = assessGap(high, low);   // two-plus realms below me

    const upOk = lookingUp.verdict === 'helpless';
    const downOk = lookingDown.verdict !== 'contested';
    check(upOk && downOk ? 'HOLDS' : 'CONTRADICTED',
        'A gap of two major realms is not a fight, seen from either side',
        'HELPLESS_REALM_GAP ... a decision the stronger party makes alone, and nothing carried into '
        + 'a direct confrontation changes that.',
        `Looking UP at 26 rungs: '${lookingUp.verdict}'. Looking DOWN at the same gap: `
        + `'${lookingDown.verdict}' - "${lookingDown.summary.slice(0, 90)}". `
        + (downOk ? '' : 'The downward case falls through to the default branch, whose ternary reads '
            + "`realmGap <= -HELPLESS_REALM_GAP ? 'contested' : 'contested'` - both arms identical, so "
            + "the condition is dead and 'outmatched'/'helpless' are unreachable downward. Being two "
            + 'realms above somebody is reported as "Close enough that everything else decides it."'));
}

// ─────────────────────────────────────────────────────────────────────────
// A manual is paper; an object is not
// ─────────────────────────────────────────────────────────────────────────

function manualsMayExceedTheLid(): void {
    const rated = TECHNIQUES
        .map(t => Number((t as never as { requiredOrdinal?: number }).requiredOrdinal ?? 0))
        .filter(n => Number.isFinite(n));
    const top = rated.length > 0 ? Math.max(...rated) : 0;
    const anyAboveTheLid = top > OBJECT_CEILING_BELOW_THE_LID;
    check(MANUALS_MAY_EXCEED_THE_LID && !anyAboveTheLid ? 'UNIMPLEMENTED' : 'HOLDS',
        'A manual may be rated above the Lid, where no object may',
        'A manual is paper. It may be rated anywhere, including above the Lid.',
        `MANUALS_MAY_EXCEED_THE_LID=${MANUALS_MAY_EXCEED_THE_LID}, object ceiling `
        + `${OBJECT_CEILING_BELOW_THE_LID}, dearest art in the catalog requires ${top}. `
        + (anyAboveTheLid
            ? 'At least one art exists above the ceiling, as the rule permits.'
            : 'The rule permits something the catalog never uses, so the highest prize the setting '
            + 'describes - a manual sent down from above the Lid - does not exist to be found.'));
}

// ─────────────────────────────────────────────────────────────────────────
// The houses' own ceilings
// ─────────────────────────────────────────────────────────────────────────

function housesHaveCeilings(): void {
    const rows = Object.entries(FACTION_CHARACTER)
        .map(([id, c]) => ({ id, reliable: c.production.reliableOrdinal, peak: c.production.peakOrdinal }));
    const inverted = rows.filter(r => r.peak < r.reliable);
    check(inverted.length === 0 ? 'HOLDS' : 'CONTRADICTED',
        'A house\'s best ever is at least what it reliably produces',
        'production: { reliableOrdinal, peakOrdinal }',
        inverted.length === 0
            ? `Holds across ${rows.length} houses; spread runs ${Math.min(...rows.map(r => r.reliable))} `
            + `to ${Math.max(...rows.map(r => r.reliable))} reliable.`
            : inverted.map(r => `${r.id} reliable ${r.reliable} > peak ${r.peak}`).join('; '));
}

// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// tone.md - the design's own definition of a good run
// ─────────────────────────────────────────────────────────────────────────

/**
 * `tone.md` does not describe fun in the abstract. It names four specific
 * dilemmas and says a run is interesting when the player is choosing between
 * two things they will regret. That makes it checkable, and it is the most
 * important check in this file: the others ask whether the world is coherent,
 * this one asks whether it is worth playing.
 *
 * Only the FIRST is testable purely in the engine - the other three are verb
 * reachability and are measured by hand against a running server. This checks
 * the one that can be checked here, which is also the one a player faces most
 * often: once per rung, forty-six times a life.
 */
function waitingIsAChoice(): void {
    const ordinal = 16;
    const need = progressRequiredForOrdinal(ordinal);
    const oddsAt = (progress: number) => computeBreakthroughOdds(
        {
            realmOrdinal: ordinal, cultivationProgress: progress, spiritRoot: 'single_fire',
            foundationQuality: 'stable', attributes: { might: 3, insight: 3, fortune: 3, charm: 3 },
            insights: [], injuries: [], age: 60, yearsAtCurrentRealm: 5, immortalStatus: 'none'
        } as never,
        { ambient: 'normal', turn: 1, ranksGainedThisTurn: 0 } as never
    ).finalChance;

    const atTheGate = oddsAt(need ?? 0);
    const afterWaiting = oddsAt(Math.round((need ?? 0) * 4));
    const patienceBuysSomething = afterWaiting > atTheGate;

    check(patienceBuysSomething ? 'HOLDS' : 'UNIMPLEMENTED',
        'Striking now versus waiting is a real choice with no right answer',
        'A run is interesting when the player has to choose between two things the world will make '
        + 'them regret: breakthrough now at poor odds, or stagnate toward settling.',
        `At rung ${ordinal}, the odds are ${(atTheGate * 100).toFixed(1)}% the moment the gate opens `
        + `and ${(afterWaiting * 100).toFixed(1)}% with four times the required progress. `
        + (patienceBuysSomething
            ? 'Patience buys something, so the settling clock is a cost worth weighing against it.'
            : 'Nothing a cultivator accumulates moves the number, so striking the instant the gate '
            + 'opens is strictly optimal at every rung and waiting only burns the settling clock. '
            + 'The most frequent decision in the game has one correct answer.'));
}

function main(): void {
    rule('LORE AGAINST MECHANICS');
    line('  Every check quotes the sentence it tests. A failure may mean the doc is wrong.');

    qiIsContested();
    thinGroundStops();
    advancementCostsMore();
    refinementAddsValue();
    theGapIsAsymmetric();
    manualsMayExceedTheLid();
    housesHaveCeilings();
    waitingIsAChoice();

    for (const order of ['CONTRADICTED', 'UNIMPLEMENTED', 'HOLDS'] as Verdict[]) {
        const hits = findings.filter(f => f.verdict === order);
        if (hits.length === 0) continue;
        line();
        line(`  ${order} (${hits.length})`);
        for (const f of hits) {
            line();
            line(`    ${f.claim}`);
            line(`      lore: "${f.quote}"`);
            line(`      engine: ${f.evidence}`);
        }
    }

    line();
    line(`  ${findings.filter(f => f.verdict !== 'HOLDS').length} of ${findings.length} claims do not hold.`);
    line();
}

main();
