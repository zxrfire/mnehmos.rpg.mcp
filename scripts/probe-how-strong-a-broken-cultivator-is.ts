/**
 * How strong is somebody who crossed and arrived broken?
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ORDERING IS, AND WHAT IT USED TO BE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This was first scoped as a strict two-sided ordering - a broken holder of a
 * realm weaker than EVERY intact holder of that realm and stronger than EVERY
 * intact holder of the realm below - and that is unsatisfiable. Table 1 shows
 * why, and it is worth keeping because it is what a future attempt will
 * rediscover: the window between the realms is x2.000 and a strict fit needs
 * x2.299.
 *
 * The design has since said that the case which does not fit is a case it
 * WANTS. A cracked core who has been fighting for a century should be dangerous
 * to somebody who formed their core last year. So the ordering that binds is
 * one-sided, and it is three claims rather than one:
 *
 *   MUST   beat every intact holder of the realm below, at every attribute
 *          spread, from any rung of their own realm. This is what makes the
 *          crossing worth attempting even when it goes wrong, and it is the
 *          only hard constraint.
 *   MUST   lose to a typical holder of their own rung. Otherwise the break is
 *          not a break.
 *   MAY    beat a weak one. This is wanted, not tolerated, and battle
 *          experience is the reason it is wanted - a line worth x1.4 which the
 *          break does not touch.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IS VARIED AND WHAT IS HELD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Only the break and the attributes, except in the last two tables which say so
 * in their own headings. Both sides get the same spirit root, the same art, the
 * same battle history, the same ground, full health and full qi. That is the
 * controlled table AGENTS.md asks for: handing one side a technique and not the
 * other is a x1.4 swing that would look like whatever was being investigated.
 *
 * The attribute grid is the LEGAL one - might 1..3, insight 1..4, both uniform
 * out of `rollAttributes` - so all twelve combinations are equally likely and
 * every percentage below is exact rather than sampled.
 *
 *   npx tsx scripts/probe-how-strong-a-broken-cultivator-is.ts
 */

import {
    assessPower,
    combatPowerForOrdinal,
    brokenCombatPowerForOrdinal,
    resolveExchange,
    BROKEN_STATUS_POWER,
    BROKEN_TRANSMISSION,
    WITHIN_REALM_PEAK,
    type CombatantInput,
    type CombatantPower
} from '../src/engine/cultivation/combat.js';
import { REALM_TIERS } from '../src/engine/cultivation/realms.js';
import {
    ARRIVES_BROKEN_CHANCE,
    brokenStatusFor,
    trialForOrdinal
} from '../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { createInjury } from '../src/engine/cultivation/injuries.js';
import { CultivationRNG } from '../src/engine/cultivation/rng.js';
import { TechniqueSchema, type Injury, type Technique } from '../src/schema/cultivation.js';

const line = (s = '') => console.log(s);
const f2 = (n: number) => n.toFixed(2);
const f3 = (n: number) => n.toFixed(3);
const pct = (n: number) => `${(100 * n).toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────────────────
// THE POPULATION UNDER TEST
// ─────────────────────────────────────────────────────────────────────────

/** Every legal attribute pair, each equally likely - `rollAttributes` is uniform. */
const ATTRIBUTE_GRID: Array<{ might: number; insight: number }> = [];
for (let might = 1; might <= 3; might++) {
    for (let insight = 1; insight <= 4; insight++) ATTRIBUTE_GRID.push({ might, insight });
}
const WORST = { might: 1, insight: 1 };
const MEDIAN = { might: 2, insight: 2 };
const BEST = { might: 3, insight: 4 };

const woundRng = new CultivationRNG('broken-probe');

/** One art, fully mastered and matched to the root. Used only where it is named. */
const MASTERED_ART: Technique = TechniqueSchema.parse({
    id: 'probe-art',
    name: 'A mastered art',
    category: 'attack',
    grade: 'earth',
    element: 'fire',
    mastery: 1
});

function brokenWound(status: string): Injury {
    return createInjury(
        { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: status },
        woundRng
    );
}

interface Over {
    injuries?: readonly Injury[];
    battlesSurvived?: number;
    technique?: Technique | null;
}

/**
 * A cultivator carrying nothing that separates them from anybody else at their
 * rung. Everything a fight could turn on is identical on both sides unless a
 * table says otherwise.
 */
function combatant(ordinal: number, might: number, insight: number, over: Over = {}): CombatantInput {
    return {
        id: 'x',
        name: 'x',
        realmOrdinal: ordinal,
        spiritRoot: 'single_fire',
        attributes: { might, insight, fortune: 1, charm: 2 },
        injuries: [...(over.injuries ?? [])],
        hp: 100,
        maxHp: 100,
        qi: 50,
        maxQi: 50,
        battlesSurvived: over.battlesSurvived ?? 10,
        technique: over.technique ?? null,
        techniqueMastery: over.technique ? 1 : undefined
    };
}

const priced = (ordinal: number, might: number, insight: number, over: Over = {}): CombatantPower =>
    assessPower(combatant(ordinal, might, insight, over), { ambient: 'normal' });

const power = (ordinal: number, might: number, insight: number, over: Over = {}): number =>
    priced(ordinal, might, insight, over).total;

/**
 * Realms somebody can actually arrive at broken, read off `brokenStatusFor`
 * rather than off the trial map - the last crossing lands on its own two rungs
 * and has its own answer, so the Immortal realm is not one of these.
 *
 * Foundation Establishment IS one and its rate is zero: every run starts at
 * that wall and a permanent bar there would end lives before they began. Kept
 * in the sweep because the wound row exists and the ordering has to hold for it
 * if the rate ever moves.
 */
const BROKEN_REALMS = REALM_TIERS
    .map((tier, index) => ({ tier, index, status: brokenStatusFor(tier.ordinalStart - 1) }))
    .filter(({ index, status }) => index > 0 && status !== null)
    .map(({ tier, index, status }) => ({
        tier,
        below: REALM_TIERS[index - 1],
        status: status!,
        rate: ARRIVES_BROKEN_CHANCE[trialForOrdinal(tier.ordinalStart - 1)] ?? 0
    }));

// ═════════════════════════════════════════════════════════════════════════
// 1. THE GEOMETRY, AND WHY THE STRICT ORDERING WAS DROPPED
// ═════════════════════════════════════════════════════════════════════════

line();
line('  1. THE GEOMETRY OF THE WINDOW');
line();

// What the legal attribute range is worth, measured rather than asserted: the
// same rung, the same everything, only the attributes moved.
const spread = (() => {
    const totals = ATTRIBUTE_GRID.map(a => power(17, a.might, a.insight));
    return { lo: Math.min(...totals), hi: Math.max(...totals), ratio: Math.max(...totals) / Math.min(...totals) };
})();
const median = power(17, MEDIAN.might, MEDIAN.insight);
// Divided by the median rather than by the bare rung, so everything both sides
// carry identically divides out and what is left is the attribute multiplier.
const attrLo = spread.lo / median;
const attrHi = spread.hi / median;

line(`  WITHIN_REALM_PEAK is ${WITHIN_REALM_PEAK}, so a realm's top rung is ${WITHIN_REALM_PEAK}x its floor and the top of`);
line('  one realm sits at exactly half the bottom of the next.');
line(`  The whole legal attribute range is worth x${f3(spread.ratio)}, from x${f3(attrLo)} to x${f3(attrHi)}.`);
line();
line('  realm                       floor    below-ceiling   window   strict needs   fits?');
line('  ' + '-'.repeat(86));
for (const { tier, below } of BROKEN_REALMS) {
    const ownFloor = combatPowerForOrdinal(tier.ordinalStart);
    const belowCeiling = combatPowerForOrdinal(below.ordinalEnd);
    const window = ownFloor / belowCeiling;
    // To sit strictly between two bands each widened by the attribute range,
    // the window has to be wider than that range squared.
    const needed = spread.ratio * spread.ratio;
    line(
        '  ' + tier.name.padEnd(24) +
        f2(ownFloor).padStart(9) + f2(belowCeiling).padStart(15) +
        `x${f3(window)}`.padStart(11) + `x${f3(needed)}`.padStart(15) +
        (window > needed ? '     yes' : '      NO')
    );
}
line();
line('  Every window is the same because the ladder is geometric, so this fails at');
line('  every realm identically and cannot be made to fit by choosing a better');
line('  number. The strict ordering was dropped for that reason, and because the');
line('  case it was excluding - an experienced broken cultivator beating a fresh');
line('  peer - is wanted. What is left binding is the realm BELOW, and that needs');
line(`  the broken share to clear x${f3(0.5 * attrHi)} rather than to fit between two bands.`);
line();

// ═════════════════════════════════════════════════════════════════════════
// 2. THE ORDERING THAT BINDS
// ═════════════════════════════════════════════════════════════════════════

line('  2. THE ORDERING THAT BINDS, PER REALM');
line();
line('  Swept over every legal attribute pair on both sides, everything else held');
line('  identical. "beats below" is the hard requirement and takes the broken holder');
line('  from EVERY rung of their own realm against EVERY rung of the realm below.');
line();
line('  realm                    beats below   loses to median   beats a weak peer   margin');
line('  ' + '-'.repeat(90));

interface Row { name: string; beatsBelow: number; losesToMedian: number; beatsWeak: number; margin: number }
const rows: Row[] = [];

for (const { tier, below, status } of BROKEN_REALMS) {
    const wound = brokenWound(status);

    // The hard one, over the full cross product of rungs and attributes.
    let below_ok = 0, below_n = 0;
    let worstMargin = Infinity;
    for (let o = tier.ordinalStart; o <= tier.ordinalEnd; o++) {
        for (const b of ATTRIBUTE_GRID) {
            const brokenPower = power(o, b.might, b.insight, { injuries: [wound] });
            for (let io = below.ordinalStart; io <= below.ordinalEnd; io++) {
                for (const i of ATTRIBUTE_GRID) {
                    below_n++;
                    const them = power(io, i.might, i.insight);
                    if (brokenPower > them) below_ok++;
                    worstMargin = Math.min(worstMargin, brokenPower / them);
                }
            }
        }
    }

    // And the two same-rung claims, at the realm floor where a broken holder
    // arrives - the rung the wound rows describe them standing on.
    const floor = tier.ordinalStart;
    let median_ok = 0;
    let weak_ok = 0;
    for (const b of ATTRIBUTE_GRID) {
        const brokenPower = power(floor, b.might, b.insight, { injuries: [wound] });
        if (brokenPower < power(floor, MEDIAN.might, MEDIAN.insight)) median_ok++;
        if (brokenPower > power(floor, WORST.might, WORST.insight)) weak_ok++;
    }

    const row: Row = {
        name: tier.name,
        beatsBelow: below_ok / below_n,
        losesToMedian: median_ok / ATTRIBUTE_GRID.length,
        beatsWeak: weak_ok / ATTRIBUTE_GRID.length,
        margin: worstMargin
    };
    rows.push(row);
    line(
        '  ' + tier.name.padEnd(24) +
        pct(row.beatsBelow).padStart(13) +
        pct(row.losesToMedian).padStart(18) +
        pct(row.beatsWeak).padStart(20) +
        `x${f3(row.margin)}`.padStart(9)
    );
}
line();
line('  "beats below" must be 100%. "loses to median" must be 100% - a broken holder');
line('  with the best attributes in the world still prices under an ordinary intact');
line('  peer. "beats a weak peer" is the blessed case and is NOT required to be');
line('  anything: it says how often the break is overturned by attributes alone,');
line('  before experience or an art is brought into it at all.');
line();
line('  "margin" is the worst ratio anywhere in the "beats below" sweep - the closest');
line('  the weakest broken holder ever comes to the strongest holder of the realm');
line('  under them. Above 1 or the requirement failed somewhere.');
line();

// ── WHERE THE MARGIN RUNS OUT ────────────────────────────────────────────
line('  WHERE THE MARGIN RUNS OUT');
line();
line('  How far the attribute range could widen before the requirement inverts, and');
line('  how deep the transmission exponent could go. Both by bisection on the');
line('  measured band rather than by rearranging, and the model reproduces the');
line('  measured margin above to three figures.');
line();

const bandCentre = Math.sqrt(attrLo * attrHi);
{
    let widest = 1, lo = 1, hi = 32;
    for (let i = 0; i < 90; i++) {
        const mid = (lo + hi) / 2;
        const aLo = bandCentre / Math.sqrt(mid);
        const aHi = bandCentre * Math.sqrt(mid);
        // Broken at the realm floor with the worst attributes, against the
        // realm below's ceiling with the best. Window is x2 everywhere.
        if (BROKEN_STATUS_POWER * Math.pow(aLo, BROKEN_TRANSMISSION) > aHi / 2) lo = mid; else hi = mid;
    }
    widest = lo;

    let kLo = 0, kHi = 4;
    for (let i = 0; i < 90; i++) {
        const mid = (kLo + kHi) / 2;
        if (BROKEN_STATUS_POWER * Math.pow(attrLo, mid) > attrHi / 2) kLo = mid; else kHi = mid;
    }

    // The floor on the level, with the exponent in force and without it. The
    // second is what the code used to be doing, and it is the whole finding.
    const floorWithExponent = (attrHi / 2) / Math.pow(attrLo, BROKEN_TRANSMISSION);
    const floorIfFlat = (attrHi / 2) / attrLo;

    line(`  attribute range this survives     x${f2(widest)}   against x${f3(spread.ratio)} legal`);
    line(`  BROKEN_TRANSMISSION ceiling        ${f3(kLo)}   set to ${f2(BROKEN_TRANSMISSION)}`);
    line(`  BROKEN_STATUS_POWER floor          ${f3(floorWithExponent)}   set to ${f2(BROKEN_STATUS_POWER)}`);
    line(`    the same floor, with no exponent  ${f3(floorIfFlat)}`);
    line();
    line('  That last line is the finding. A FLAT penalty has to clear x' + f3(floorIfFlat) + ', because');
    line('  a flat penalty leaves the broken band the full attribute range wide and it');
    line(`  is the bottom edge that has to clear. x${f2(BROKEN_STATUS_POWER)} - which is exactly what one`);
    line('  crippling permanent wound cost through the condition line, by coincidence');
    line('  rather than by design - misses it by 1%, at a worst margin of x0.989. It');
    line('  failed silently for the obvious reason: the median case looked fine.');
    line();
    line('  The exponent buys it back by narrowing the band instead of moving it, which');
    line('  is why the level did not have to be raised. Raising the level would have');
    line('  been the other way to fix it and it is worse: it makes a broken cultivator');
    line('  stronger against their own rung as well, and the point of the break is that');
    line('  they are not.');
    line();
}

// ═════════════════════════════════════════════════════════════════════════
// 3. THROUGH RESOLUTION
// ═════════════════════════════════════════════════════════════════════════

/**
 * Run one duel to a conclusion through `resolveExchange`, alternating strikes.
 *
 * Deliberately not `resolveConfrontation`: this compares two priced combatants
 * and nothing else, and a draw is reported as a draw rather than scored as a
 * loss for either side - the failure mode AGENTS.md names by title.
 */
function duel(a: CombatantPower, b: CombatantPower, seed: string): 'a' | 'b' | 'draw' {
    const rng = new CultivationRNG(seed);
    let hpA = 100;
    let hpB = 100;
    for (let round = 0; round < 24; round++) {
        hpB -= resolveExchange(a, b, 100, { rng, ambient: 'normal', turn: round }).damage;
        if (hpB <= 0) return 'a';
        hpA -= resolveExchange(b, a, 100, { rng, ambient: 'normal', turn: round }).damage;
        if (hpA <= 0) return 'b';
    }
    return 'draw';
}

function winRate(a: CombatantPower, b: CombatantPower, seeds = 300): number {
    let wins = 0;
    for (let s = 0; s < seeds; s++) if (duel(a, b, `duel-${s}`) === 'a') wins++;
    return wins / seeds;
}

line('  3. THROUGH RESOLUTION');
line();
line('  A power ratio that satisfies the ordering can still produce upsets often');
line('  enough to matter. 300 seeds each, HP equalised so only the power ratio is');
line('  being measured. The broken holder is at their realm floor throughout.');
line();
line('  realm                    v median peer   v below-ceiling   v below-floor   veteran v fresh peer');
line('  ' + '-'.repeat(100));
for (const { tier, below, status } of BROKEN_REALMS) {
    const wound = brokenWound(status);
    const broken = priced(tier.ordinalStart, MEDIAN.might, MEDIAN.insight, { injuries: [wound] });
    const peer = priced(tier.ordinalStart, MEDIAN.might, MEDIAN.insight);
    const belowCeiling = priced(below.ordinalEnd, MEDIAN.might, MEDIAN.insight);
    const belowFloor = priced(below.ordinalStart, MEDIAN.might, MEDIAN.insight);

    // The case the design asks for by name: a century of fighting against
    // somebody who arrived last year. Nothing else differs.
    const veteran = priced(tier.ordinalStart, MEDIAN.might, MEDIAN.insight,
        { injuries: [wound], battlesSurvived: 40 });
    const fresh = priced(tier.ordinalStart, MEDIAN.might, MEDIAN.insight, { battlesSurvived: 0 });

    line(
        '  ' + tier.name.padEnd(24) +
        pct(winRate(broken, peer)).padStart(12) + ' win' +
        pct(winRate(broken, belowCeiling)).padStart(14) + ' win' +
        pct(winRate(broken, belowFloor)).padStart(12) + ' win' +
        pct(winRate(veteran, fresh)).padStart(18) + ' win'
    );
}
line();
line('  Column 1 is the break being real: they lose, most of the time, and not');
line('  every time. Columns 2 and 3 are the hazard test - a broken cultivator is not');
line('  safe to fight for anybody a realm below them, which is the other half of the');
line('  brief and the reason these people are worth putting in the world.');
line();
line('  Column 4 is the blessed upset, measured through resolution rather than');
line('  argued: the same break, the same attributes, forty confrontations survived');
line('  against none. Experience is not compressed by the break and this is why.');
line();

// ═════════════════════════════════════════════════════════════════════════
// 4. WHAT THE PENALTY LANDS AT, AND WHAT IT DOES NOT COVER
// ═════════════════════════════════════════════════════════════════════════

line('  4. WHAT THE PENALTY LANDS AT, AND WHAT IT DOES NOT COVER');
line();
line('  realm                    realised   declared   at floor   at realm top   armed v bare');
line('  ' + '-'.repeat(92));
for (const { tier, status } of BROKEN_REALMS) {
    const wound = brokenWound(status);
    const intact = power(tier.ordinalStart, MEDIAN.might, MEDIAN.insight);
    const broken = power(tier.ordinalStart, MEDIAN.might, MEDIAN.insight, { injuries: [wound] });
    const top = power(tier.ordinalEnd, MEDIAN.might, MEDIAN.insight, { injuries: [wound] });
    const declared = brokenCombatPowerForOrdinal(tier.ordinalStart) / combatPowerForOrdinal(tier.ordinalStart);

    // The uncontrolled case, and the one the ordering does NOT cover: the best
    // broken cultivator the world can field, with an art, against the worst
    // intact holder of the same rung, with none.
    const armed = power(tier.ordinalStart, BEST.might, BEST.insight,
        { injuries: [wound], battlesSurvived: 40, technique: MASTERED_ART });
    const bare = power(tier.ordinalStart, WORST.might, WORST.insight, { battlesSurvived: 0 });

    line(
        '  ' + tier.name.padEnd(24) +
        `x${f3(broken / intact)}`.padStart(10) +
        `x${f3(declared)}`.padStart(11) +
        f2(broken).padStart(11) +
        f2(top).padStart(15) +
        (armed > bare ? '   broken wins' : '   intact wins')
    );
}
line();
line('  "realised" is what the break costs at median attributes and "declared" is');
line('  `brokenCombatPowerForOrdinal` as a share of the rung. They agree, because');
line('  the break is now a declared price rather than a coincidence of');
line('  INJURY_WEIGHTS. The two power columns are the same person at the bottom and');
line(`  the top of their realm and differ by x${WITHIN_REALM_PEAK}: sub-rank steps are not gated by a`);
line('  break, so a broken cultivator who spends forty years at their rung is');
line('  genuinely stronger for it.');
line();
line('  The last column is the limit, and it is not a defect. The ordering is over');
line('  ATTRIBUTES with everything else matched; technique alone is a x1.9 line and');
line('  experience another x1.4, so a broken cultivator who brought both beats an');
line('  intact peer who brought neither. Take the art away and they price out under');
line('  every intact holder of their rung, which is the claim being made.');
line();
