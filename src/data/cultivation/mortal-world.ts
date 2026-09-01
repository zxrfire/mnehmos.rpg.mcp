/**
 * The mortal world: what people do, what things cost, where they live, and
 * what they think of cultivators.
 *
 * The setting's whole argument is scarcity, so an unmodelled mortal economy is
 * a hole in it. This file is not a simulation and the engine will not run one -
 * it is authored reference so the narrator can answer "what does that cost"
 * and "what could I do for money" with the same number twice.
 *
 * TWO CURRENCIES, AND WHY
 * -----------------------
 * Mortals do not use spirit stones. A stone is compressed qi: it is fuel, and
 * it is the only way to cultivate somewhere the ambient will not carry you,
 * which is why a poor cultivator's stones are never savings. Mortals use cash,
 * and the exchange is the one number that makes every other price legible:
 *
 *   1 spirit stone = 100 cash, at a market-town changer, less at the edges
 *
 * Anchors, so the scale is never guesswork:
 *
 *   30 stones      the starting purse of every run - 3,000 cash
 *   1 cash         a bowl of millet
 *   12 cash        a night at an inn with a floor
 *   20 stones      a Minor Healing Pill, the one pill every run begins with
 *   40 stones      one day of grant access to a workable face in the Marches
 *   60 stones      a month of cave rent on a decent vein in the Low Fall
 *   9,000 stones   the Grain Abstinence Pill, and the reason it is a goal
 *
 * A starting cultivator is therefore a person with three months of an
 * innkeeper's wages in their pocket, one pill, and no way to make more except
 * the jobs below.
 */

import { z } from 'zod';
import { RegardProfileSchema } from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { offeredTo, regardOf, type RegardAskerInput } from '../../engine/cultivation/regard.js';

/** Cash to the spirit stone. The one conversion the whole file rests on. */
export const CASH_PER_STONE = 100;

export function cashToStones(cash: number): number {
    return cash / CASH_PER_STONE;
}

export function stonesToCash(stones: number): number {
    return Math.round(stones * CASH_PER_STONE);
}

// ─────────────────────────────────────────────────────────────────────────
// OCCUPATIONS
// What a poor cultivator does between breakthroughs, and what everyone else
// does all the time.
// ─────────────────────────────────────────────────────────────────────────

export const OccupationSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** Who can actually hold it. */
    kind: z.enum(['mortal', 'cultivator', 'either']),
    /** Minimum realm ordinal. Zero means a mortal can do it. */
    minOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Typical earnings in cash per month, before food and lodging. */
    cashPerMonth: z.number().int().min(0),
    /** Where the work exists. */
    settlements: z.array(z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city'])),
    /** How likely it is to hurt you, in plain terms. */
    risk: z.enum(['none', 'low', 'moderate', 'high', 'lethal']),
    /** Why a cultivator would or would not take it. */
    note: z.string().min(40),
    /**
     * The generic column. Filled uniformly below rather than per entry: work
     * is offered a little further up the ladder than most things, because a
     * wage is a relationship and relationships are slower to become absurd
     * than transactions are.
     */
    regard: RegardProfileSchema.optional()
});
export type Occupation = z.infer<typeof OccupationSchema>;

/**
 * How much longer than usual a job keeps being put to somebody.
 *
 * This one number is what makes `MORTAL_WORK_CEILING_ORDINAL` true. With the
 * ordinary bands a gate-zero job stops being offered at ordinal 17; the mortal
 * economy in fact keeps offering into the high teens, because a town that has
 * seen three cultivators this year still asks the fourth if he wants a day's
 * work. 1.2 stretches `dismissed` to open at ordinal 21, which is exactly where
 * `MORTAL_ATTITUDES` turns to fear-dressed-as-ceremony. The ceiling is now a
 * consequence of a generic column instead of a branch, and the test asserts the
 * two still agree.
 */
export const OCCUPATION_REGARD_SPAN = 1.2;

/**
 * The mortal economy, as one gate.
 *
 * A market stall, an inn floor and a bowl of millet are all pitched at the same
 * rung - the bottom one - and how a market treats somebody is one fact about
 * that person and that market rather than a fact about each item on the board.
 * Handlers read this profile instead of inventing a gate, so the board and the
 * jobs answer with the same arithmetic.
 */
export const MORTAL_ECONOMY_REGARD = { gate: 0, span: OCCUPATION_REGARD_SPAN } as const;

const OCCUPATION_DATA: readonly Occupation[] = [
    // ── mortal work, which is most work ───────────────────────────────
    { id: 'job-farmhand', name: 'Farmhand', kind: 'mortal', minOrdinal: 0, cashPerMonth: 180, settlements: ['hamlet', 'village'], risk: 'low', note: 'Board and a corner to sleep in are usually included, which is most of the pay. A cultivator who takes this is either hiding or finished.' },
    { id: 'job-porter', name: 'Porter', kind: 'either', minOrdinal: 0, cashPerMonth: 240, settlements: ['village', 'market_town', 'sect_town', 'city'], risk: 'low', note: 'The commonest first job for a Qi Condensation cultivator with no connections: the body is better than a mortal\'s and nobody asks questions.' },
    { id: 'job-ferryman', name: 'Ferryman', kind: 'either', minOrdinal: 0, cashPerMonth: 300, settlements: ['village', 'market_town'], risk: 'low', note: 'Clear River Alliance work in the Low Fall. Steady, and the Alliance pays partly in crossings owed rather than cash.' },
    { id: 'job-charcoal-burner', name: 'Charcoal burner', kind: 'mortal', minOrdinal: 0, cashPerMonth: 200, settlements: ['hamlet', 'village'], risk: 'moderate', note: 'Solitary, filthy and out in the woods for weeks, which makes it the standard cover for anyone who does not want to be found.' },
    { id: 'job-scribe', name: 'Scribe', kind: 'either', minOrdinal: 0, cashPerMonth: 400, settlements: ['market_town', 'sect_town', 'city'], risk: 'none', note: 'Requires literacy, which is rare. Lantern Hall and the Ninefold Ledger both hire, and both read what you wrote before paying.' },
    { id: 'job-mortal-doctor', name: 'Physician (mortal)', kind: 'mortal', minOrdinal: 0, cashPerMonth: 700, settlements: ['market_town', 'sect_town', 'city'], risk: 'none', note: 'Sets bones and delivers babies. Cannot treat a torn meridian and will say so, which is the difference between a doctor and a cultivator healer.' },
    { id: 'job-innkeeper', name: 'Innkeeper', kind: 'mortal', minOrdinal: 0, cashPerMonth: 900, settlements: ['village', 'market_town', 'sect_town', 'city'], risk: 'low', note: 'Owns rather than earns. An inn near a sect gate is a small fortune and is usually held by a family with a sect connection.' },
    { id: 'job-miner', name: 'Miner', kind: 'mortal', minOrdinal: 0, cashPerMonth: 260, settlements: ['hamlet', 'village'], risk: 'high', note: 'Ore, not qi. Miners resent the assumption that they are quarrying spirit stones and will explain the difference at length.' },
    { id: 'job-caravan-guard', name: 'Caravan guard (mortal)', kind: 'mortal', minOrdinal: 0, cashPerMonth: 320, settlements: ['market_town', 'city'], risk: 'moderate', note: 'Spears and numbers. Hired alongside a cultivator escort rather than instead of one, and paid a tenth as much.' },
    { id: 'job-herb-picker', name: 'Herb picker', kind: 'either', minOrdinal: 0, cashPerMonth: 220, settlements: ['hamlet', 'village', 'market_town'], risk: 'moderate', note: 'Mortal-grade herbs off safe ground. The Cinnabar Crucible Guild buys at a fixed rate and does not haggle, which pickers regard as fair and dull.' },
    { id: 'job-corpse-carrier', name: 'Corpse carrier', kind: 'mortal', minOrdinal: 0, cashPerMonth: 210, settlements: ['market_town', 'sect_town', 'city'], risk: 'low', note: 'Steady work near sects, and the Bone Lantern Cult recruits from it openly enough that the trade is watched.' },
    { id: 'job-tax-clerk', name: 'Tax clerk', kind: 'mortal', minOrdinal: 0, cashPerMonth: 500, settlements: ['market_town', 'city'], risk: 'low', note: 'Safe, literate, despised, and the only mortal profession with a reliable view of who actually owns what.' },

    // ── work a Qi Condensation cultivator can realistically take ───────
    { id: 'job-beast-culler', name: 'Spirit-beast culler', kind: 'cultivator', minOrdinal: 3, cashPerMonth: 1_200, settlements: ['village', 'market_town', 'sect_town'], risk: 'high', note: 'Paid per head on a village contract. The standard living for an unaffiliated Qi Condensation cultivator, and the standard way one dies at twenty-six.' },
    { id: 'job-escort', name: 'Caravan escort (cultivator)', kind: 'cultivator', minOrdinal: 5, cashPerMonth: 2_000, settlements: ['market_town', 'sect_town', 'city'], risk: 'high', note: 'Underwritten by the Stonewright Consortium, which prices the contract off its own rank table - the table that reads Marches carvers a rank low.' },
    { id: 'job-dangerous-herb-gathering', name: 'Herb gathering, guarded ground', kind: 'cultivator', minOrdinal: 6, cashPerMonth: 1_800, settlements: ['village', 'market_town'], risk: 'high', note: 'Earth-grade herbs grow where something is living. Pays four times a picker and kills about one gatherer in twenty a year.' },
    { id: 'job-bellows-hand', name: 'Bellows hand (alchemy)', kind: 'either', minOrdinal: 0, cashPerMonth: 600, settlements: ['market_town', 'sect_town', 'city'], risk: 'moderate', note: 'The Cinnabar Crucible Guild\'s bottom rung and the only route into alchemy from outside. Three years of it before anyone lets you near a cauldron.' },
    { id: 'job-formation-hand', name: 'Formation hand', kind: 'cultivator', minOrdinal: 8, cashPerMonth: 1_500, settlements: ['sect_town', 'city'], risk: 'moderate', note: 'Holding nodes steady while somebody who understands them works. Impossible in the Quiet Marches, where formations do not run at all.' },
    { id: 'job-courier', name: 'Courier', kind: 'cultivator', minOrdinal: 4, cashPerMonth: 1_100, settlements: ['market_town', 'sect_town', 'city'], risk: 'moderate', note: 'Measured Span work, paid per true li rather than walked. The Span will not hire anyone who cannot read its two-number directions.' },
    { id: 'job-cave-sitter', name: 'Cave sitter', kind: 'cultivator', minOrdinal: 2, cashPerMonth: 800, settlements: ['sect_town', 'village'], risk: 'low', note: 'Sitting in somebody else\'s rented cave so the claim does not lapse while they are away. Dull, safe, and the sitter cultivates on their employer\'s ground, which is the actual wage.' },
    { id: 'job-outer-chores', name: 'Outer disciple chores', kind: 'cultivator', minOrdinal: 1, cashPerMonth: 400, settlements: ['sect_town'], risk: 'low', note: 'A stipend rather than a wage, plus access to sect ground - which is worth more than the stipend and is why anyone accepts it.' },
    { id: 'job-tutor', name: 'Tutor to a merchant family', kind: 'cultivator', minOrdinal: 5, cashPerMonth: 900, settlements: ['market_town', 'city'], risk: 'none', note: 'Teaching a merchant\'s child the Lesser Qi-Gathering Manual. Humiliating, safe, and the fastest way for a low-realm cultivator to meet people with money.' },
    { id: 'job-gleaner', name: 'Gleaner (burn zone)', kind: 'cultivator', minOrdinal: 4, cashPerMonth: 3_000, settlements: ['village', 'market_town'], risk: 'lethal', note: 'Quiet Marches only. The best-paid work available to a Qi Condensation cultivator anywhere, and it kills about one in nine a season.' },
    { id: 'job-face-labour', name: 'Face labour (carving)', kind: 'cultivator', minOrdinal: 0, cashPerMonth: 700, settlements: ['market_town'], risk: 'high', note: 'Quiet Marches only. Cutting a face on somebody else\'s grant for a share of what comes out, and inhaling the reason carvers die at forty.' },
    { id: 'job-placer-runner', name: 'Placer\'s runner', kind: 'either', minOrdinal: 0, cashPerMonth: 550, settlements: ['village', 'market_town'], risk: 'low', note: 'Border-road work: finding foreign cultivators willing to be assessed, for a placer who charges more than a month of cave rent to do it.' },
    { id: 'job-gravedigger', name: 'Gravedigger', kind: 'mortal', minOrdinal: 0, cashPerMonth: 230, settlements: ['village', 'market_town', 'sect_town', 'city'], risk: 'low', note: 'Paid by the plot and not by the month, so the wage is a winter figure. The only trade that can tell you honestly how a town died last year.' },
    { id: 'job-bell-keeper', name: 'Bell keeper', kind: 'mortal', minOrdinal: 0, cashPerMonth: 150, settlements: ['village', 'market_town'], risk: 'none', note: 'Rings for funerals, for beasts and for fire, and refuses to ring for anything else, which in several valleys includes ringing twice.' },
    { id: 'job-salt-carrier', name: 'Salt carrier', kind: 'mortal', minOrdinal: 0, cashPerMonth: 290, settlements: ['village', 'market_town', 'city'], risk: 'moderate', note: 'Legal at the gate and lucrative between them. The risk in the figure is the gate rather than the road.' },

    // ── commissions ──────────────────────────────────────────────────
    //
    // Not a second catalog and not a second system: the same rows, the same
    // schema, the same `findWorkForOrdinal`. What changes above the mortal
    // ceiling is only which entries the bands still put forward, which is the
    // whole point of the mechanism.
    //
    // The old behaviour was that everything from ordinal 21 upward got an
    // empty list and the sentence "nobody here is hiring anyone, for
    // anything", which said a Tribulation Transcendence cultivator was
    // unemployable. They are not unemployable. They are asked for entirely
    // different things, at prices that are not on the same scale, and the
    // asking is done by sects and cities rather than by a foreman with a
    // board. These are those things.
    { id: 'job-vein-warden', name: 'Vein warden', kind: 'cultivator', minOrdinal: 21, cashPerMonth: 12_000, settlements: ['sect_town', 'city'], risk: 'moderate', note: 'Sitting on somebody else\'s vein so that nothing else draws on it. The wage is nominal; what is actually being paid is the right to cultivate on the ground you are guarding.' },
    { id: 'job-convoy-escort', name: 'Pill convoy escort', kind: 'cultivator', minOrdinal: 23, cashPerMonth: 20_000, settlements: ['market_town', 'sect_town', 'city'], risk: 'high', note: 'The Cinnabar Crucible Guild moves finished heaven-grade medicine four times a year and will not move it without somebody who can survive being ambushed by the people who want it.' },
    { id: 'job-tide-breaker', name: 'Tide breaker', kind: 'cultivator', minOrdinal: 25, cashPerMonth: 45_000, settlements: ['village', 'market_town', 'sect_town'], risk: 'lethal', note: 'A beast tide is coming and a county has raised what it can. Paid on the count of what is standing afterwards, which is a payment structure with an obvious defect.' },
    { id: 'job-formation-keeper', name: 'Formation keeper', kind: 'cultivator', minOrdinal: 27, cashPerMonth: 60_000, settlements: ['sect_town', 'city'], risk: 'low', note: 'Holding a great formation steady across a season. Dull, safe, extremely well paid, and the standard way a sect finds out what an unaffiliated cultivator actually knows.' },
    { id: 'job-boundary-arbiter', name: 'Boundary arbiter', kind: 'cultivator', minOrdinal: 29, cashPerMonth: 120_000, settlements: ['sect_town', 'city'], risk: 'none', note: 'Two houses disagree about a vein and neither will accept the other\'s survey. What is being bought is somebody both sides would rather not argue with.' },
    { id: 'job-retained-deterrent', name: 'Retained deterrent', kind: 'cultivator', minOrdinal: 31, cashPerMonth: 250_000, settlements: ['sect_town', 'city'], risk: 'none', note: 'Paid to be resident and visible and to do nothing at all. The contract specifies attendance and says nothing about work, because the work is the attendance.' },
    { id: 'job-tribulation-watch', name: 'Tribulation watch', kind: 'cultivator', minOrdinal: 33, cashPerMonth: 400_000, settlements: ['sect_town'], risk: 'high', note: 'Standing off a crossing so nothing interferes with it, and being close enough to the lightning that a bad crossing takes the watcher with it. Sects pay this without haggling.' },
    { id: 'job-seal-inspection', name: 'Seal inspection', kind: 'cultivator', minOrdinal: 35, cashPerMonth: 700_000, settlements: ['sect_town', 'city'], risk: 'lethal', note: 'Going down to a seal that has held for two ages and reporting whether it still does. The fee is large because the reporting half is not reliably included.' },
    { id: 'job-house-guest', name: 'House guest', kind: 'cultivator', minOrdinal: 37, cashPerMonth: 1_200_000, settlements: ['city'], risk: 'none', note: 'A high house pays for the fact of your presence under its roof for a season, and expects nothing whatever in return. Everyone involved knows what is being purchased.' },
    { id: 'job-sky-survey', name: 'Sky survey', kind: 'cultivator', minOrdinal: 39, cashPerMonth: 2_000_000, settlements: ['city'], risk: 'moderate', note: 'Walking the upper air over a region and saying what is up there. Almost nobody can go and look, so almost nobody can check the answer, which is priced in.' },
    { id: 'job-lid-assay', name: 'Assay beneath the Lid', kind: 'cultivator', minOrdinal: 42, cashPerMonth: 5_000_000, settlements: ['city'], risk: 'high', note: 'Reading how much of the ceiling is left over a place, for people who have a reason to want the number and no way at all to take it themselves.' }
];

/**
 * The catalog as everything reads it: the authored rows, each carrying the
 * generic column, filled in one uniform pass so no entry can forget it and no
 * resolver has to guess.
 */
export const OCCUPATIONS: readonly Occupation[] = OCCUPATION_DATA.map(o =>
    o.regard ? o : { ...o, regard: { span: OCCUPATION_REGARD_SPAN } });

// ─────────────────────────────────────────────────────────────────────────
// PRICES
// Anchored against the 30-stone starting purse and the 9,000-stone pill.
// ─────────────────────────────────────────────────────────────────────────

export const PriceSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    category: z.enum(['food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information']),
    /** Price in cash. Divide by CASH_PER_STONE for the stone figure. */
    cash: z.number().int().min(1),
    unit: z.string().min(2),
    note: z.string().min(20)
});
export type Price = z.infer<typeof PriceSchema>;

export const PRICES: readonly Price[] = [
    // ── food and lodging: the mortal end of the scale ─────────────────
    { id: 'price-millet', name: 'Bowl of millet', category: 'food', cash: 1, unit: 'each', note: 'The floor of the whole economy. A day of eating badly is three of these.' },
    { id: 'price-meal', name: 'Hot meal at an inn', category: 'food', cash: 6, unit: 'each', note: 'Fish and rice in the Low Fall; flatbread and sour broth in the Marches, at half again the price.' },
    { id: 'price-month-rations', name: 'A month of rations', category: 'food', cash: 120, unit: 'month', note: 'What travelling actually costs, and the number that makes the Grain Abstinence Pill worth nine thousand stones.' },
    { id: 'price-inn-night', name: 'Night at an inn', category: 'lodging', cash: 12, unit: 'night', note: 'A floor, a blanket and no privacy. A private room is four times that and exists in perhaps six buildings per town.' },
    { id: 'price-month-lodging', name: 'A month\'s lodging', category: 'lodging', cash: 300, unit: 'month', note: 'A room in a market town, which is roughly one and a half months of a porter\'s wage.' },

    // ── transport ─────────────────────────────────────────────────────
    { id: 'price-ferry', name: 'Ferry crossing', category: 'transport', cash: 2, unit: 'crossing', note: 'Free for Clear River Alliance members, and the Alliance counts the debt in crossings rather than cash.' },
    { id: 'price-caravan-passage', name: 'Caravan passage', category: 'transport', cash: 250, unit: 'per 100 li', note: 'Includes food and the protection of being one of a group. The border road to Kettle is eleven days and priced as such.' },
    { id: 'price-mule', name: 'Mule', category: 'transport', cash: 1_400, unit: 'each', note: 'Fourteen stones on four legs, and the single largest purchase most mortals ever make.' },
    { id: 'price-cart', name: 'Cart', category: 'transport', cash: 3_000, unit: 'each', note: 'Thirty stones: exactly the starting purse of a cultivator, which is a comparison mortals make bitterly and often.' },
    { id: 'price-span-courier', name: 'Measured Span courier', category: 'transport', cash: 900, unit: 'per true li', note: 'Priced by true rather than walked distance, which nobody outside the Span can verify and everybody pays.' },

    // ── medicine: where the two currencies meet ───────────────────────
    { id: 'price-doctor-visit', name: 'Mortal physician, one visit', category: 'medicine', cash: 40, unit: 'visit', note: 'Sets a bone, stitches a cut, cannot touch a meridian.' },
    { id: 'price-splint-and-month', name: 'Splint and a month of care', category: 'medicine', cash: 500, unit: 'course', note: 'The mortal alternative to a healing pill: slower, cheaper, and it leaves you out of the fight for a season.' },
    { id: 'price-minor-healing-pill', name: 'Minor Healing Pill', category: 'medicine', cash: 2_000, unit: 'each', note: 'Twenty stones. Every run starts with exactly one, and it is worth a mule and a half.' },
    { id: 'price-qi-gathering-pill', name: 'Qi-Gathering Pill', category: 'medicine', cash: 1_800, unit: 'each', note: 'Eighteen stones. Cheap by cultivator standards and a year of a farmhand\'s savings.' },
    { id: 'price-clear-meridian-pill', name: 'Clear Meridian Pill', category: 'medicine', cash: 6_000, unit: 'each', note: 'Sixty stones, and unobtainable in the Quiet Marches at any price because alchemy will not hold there.' },

    // ── land and access: the real cost of advancing ───────────────────
    { id: 'price-cave-ordinary', name: 'Cave rent, ordinary ground', category: 'land', cash: 800, unit: 'month', note: 'Eight stones a month for somewhere with a door and nothing in the air worth breathing.' },
    { id: 'price-cave-vein', name: 'Cave rent, decent vein', category: 'land', cash: 6_000, unit: 'month', note: 'Sixty stones a month, twice the starting purse, and the single largest recurring expense in any cultivator\'s life.' },
    { id: 'price-grant-day', name: 'Grant day at a workable face', category: 'land', cash: 4_000, unit: 'day', note: 'Forty stones a DAY, Quiet Marches only, and the reason nobody there saves anything.' },
    { id: 'price-farmland-mu', name: 'Farmland', category: 'land', cash: 9_000, unit: 'per mu', note: 'Ninety stones for land a family can live off, which prices a whole mortal life against three months of a good cave.' },

    // ── services and information ──────────────────────────────────────
    { id: 'price-gate-registration', name: 'Gate registration', category: 'service', cash: 300, unit: 'year', note: 'Three stones a year to the House of Held Names, compulsory in nine cities, and the House\'s real income.' },
    { id: 'price-oath-witness', name: 'Oath witnessing', category: 'service', cash: 5_000, unit: 'oath', note: 'Fifty stones and up, scaled to the penalty clause rather than the sum at stake.' },
    { id: 'price-scribe-letter', name: 'A letter written', category: 'service', cash: 8, unit: 'letter', note: 'Most people cannot write. This is why a scribe eats better than a farmhand.' },
    { id: 'price-placement', name: 'Placement of a foreign cultivator', category: 'information', cash: 7_000, unit: 'assessment', note: 'Seventy stones to have the Ninefold Ledger say where inside a realm somebody stands. Cheaper than being wrong once.' },
    { id: 'price-chisel', name: 'Carver\'s chisel', category: 'tool', cash: 450, unit: 'each', note: 'Lasts about a season at a face. In the Marches this is a recurring cost of cultivating, which the Low Fall finds absurd.' },
    { id: 'price-mortal-sword', name: 'Sword, mortal steel', category: 'tool', cash: 700, unit: 'each', note: 'Ashen Forge work, reforged from ploughed-up fragments. A cultivator\'s blade starts at fifty times this.' },

    // ── the dead, which is the largest unavoidable expense a family has ──
    //
    // Priced here rather than left implied because a burial is the one
    // purchase every mortal household makes and cannot decline, and the whole
    // scale above is easier to read against it: a coffin costs what a mule
    // costs, and a mule is the largest thing most families ever buy on
    // purpose.
    { id: 'price-coffin', name: 'Coffin', category: 'service', cash: 1_400, unit: 'each', note: 'The same figure as a mule, which every family notices, and the comparison is made at every funeral in both provinces.' },
    { id: 'price-burial-plot', name: 'Ground for a grave', category: 'land', cash: 600, unit: 'plot', note: 'Bought once and held forever, which is the only thing a mortal family owns that a cultivator cannot outbid them for, because nobody wants it.' },
    { id: 'price-corpse-cart', name: 'Carriage of a body', category: 'transport', cash: 90, unit: 'per stage', note: 'A city will not bury an outsider and a village will not keep one, so a body travels, and it travels at a fixed rate nobody haggles over.' },
    { id: 'price-bell-tolling', name: 'A bell rung out', category: 'service', cash: 20, unit: 'each', note: 'Paid to the bell keeper by the stroke. In the Low Fall a second stroke is refused at any price in the valleys that will not ring twice.' },
    { id: 'price-mourner', name: 'A hired mourner', category: 'service', cash: 30, unit: 'day', note: 'Standard in the cities and considered grotesque in the villages, which supply most of the mourners.' },
    { id: 'price-name-cut', name: 'A name cut in stone', category: 'service', cash: 250, unit: 'each', note: 'Two and a half stones to be legible for a century. Most families pay for the name and not the dates, which is why the graveyards cannot be used to date anything.' },

    // ── the ordinary board, which sets the floor everything else sits on ──
    { id: 'price-salt', name: 'Salt', category: 'food', cash: 4, unit: 'catty', note: 'Taxed at the gate in nine cities and smuggled everywhere else, which is the commonest crime in the world and is punished as one.' },
    { id: 'price-cloth', name: 'Cloth, undyed', category: 'tool', cash: 55, unit: 'bolt', note: 'A set of clothes is two bolts and a winter, and a cultivator whose robes are obviously new is read as either freshly paid or freshly robbed.' },
    { id: 'price-firewood', name: 'Firewood', category: 'food', cash: 18, unit: 'month', note: 'The reason charcoal burning is a trade and the reason a cold winter shows up in the corpse carriers\' takings before it shows up anywhere else.' },
    { id: 'price-culling-bounty', name: 'Beast-culling bounty', category: 'service', cash: 350, unit: 'head', note: 'Paid by a village out of its own store, which means the village decides what it can afford to be afraid of. Below this figure nobody comes.' },
    { id: 'price-village-well', name: 'A well sunk', category: 'land', cash: 5_000, unit: 'each', note: 'Fifty stones, raised over years by a whole village, and the largest thing most hamlets will ever do collectively.' }
];

// ─────────────────────────────────────────────────────────────────────────
// SETTLEMENTS
// ─────────────────────────────────────────────────────────────────────────

export const SettlementSchema = z.object({
    kind: z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city']),
    name: z.string().min(1),
    typicalPopulation: z.string().min(4),
    /** What is actually there. */
    contains: z.array(z.string().min(10)),
    /** What a cultivator can get here that they cannot get in a smaller place. */
    cultivatorCanGet: z.array(z.string().min(10)),
    /** What is absent, and matters. */
    lacks: z.array(z.string().min(10)),
    note: z.string().min(40)
});
export type Settlement = z.infer<typeof SettlementSchema>;

export const SETTLEMENTS: readonly Settlement[] = [
    {
        kind: 'hamlet',
        name: 'Hamlet',
        typicalPopulation: '20 to 80',
        contains: ['a well and a trough', 'a headman who is also a farmer', 'one ox between everybody', 'a shrine nobody maintains'],
        cultivatorCanGet: ['food, grudgingly sold', 'a barn to sleep in', 'directions, which may be wrong'],
        lacks: ['any medicine at all', 'anyone who can read', 'a reason to stay another day'],
        note: 'A cultivator in a hamlet is an event. They will be fed, watched, and asked to do something about the thing in the woods.'
    },
    {
        kind: 'village',
        name: 'Village',
        typicalPopulation: '200 to 900',
        contains: ['a market on fixed days', 'a herbalist who is not an alchemist', 'a headman and a tax clerk', 'a bell nobody rings twice'],
        cultivatorCanGet: ['mortal-grade herbs', 'a beast-culling contract', 'rumours worth acting on', 'a bed for cash'],
        lacks: ['pills of any grade', 'a manual of any kind', 'anyone above Qi Condensation, usually'],
        note: 'The unit the world is actually made of. Most villages have seen three cultivators in living memory and remember all three.'
    },
    {
        kind: 'market_town',
        name: 'Market town',
        typicalPopulation: '3,000 to 12,000',
        contains: ['a changer who sets the cash-to-stone rate', 'an inn with private rooms', 'a physician', 'a Held Names register at the gate', 'a Ledger arbitration bench on circuit'],
        cultivatorCanGet: ['mortal-grade pills over a counter', 'escort and courier work', 'a cave rented on ordinary ground nearby', 'a placer, on the border road'],
        lacks: ['earth-grade medicine', 'a teacher for anything above the basics', 'any cultivator who will fight for you'],
        note: 'Where the two economies touch. A cultivator can live here on culling contracts indefinitely, and many do, and that is what stagnation looks like from outside.'
    },
    {
        kind: 'sect_town',
        name: 'Sect town',
        typicalPopulation: '5,000 to 30,000, plus the sect',
        contains: ['a sect gate with a queue at admission season', 'shops that exist only to sell to disciples', 'an inn owned by somebody\'s cousin in the sect', 'a mission or temple taking in the refused'],
        cultivatorCanGet: ['outer-disciple chores and a stipend', 'earth-grade pills at sect prices', 'instruction, if admitted', 'cave rent on sect ground, which is the real prize'],
        lacks: ['neutrality - everything here is inside somebody\'s claim', 'privacy of any kind', 'any way to avoid sect politics'],
        note: 'The whole town is a sect\'s support economy, and its prices are set by what disciples can pay rather than what townspeople earn.'
    },
    {
        kind: 'city',
        name: 'City',
        typicalPopulation: '80,000 upward',
        contains: ['an auction house', 'a Stonewright assay hall', 'nine gates, all registering', 'a Bound Word oath hall', 'more cultivators than anybody has counted'],
        cultivatorCanGet: ['heaven-grade goods at auction, occasionally', 'certification, arbitration and oath witnessing', 'work at every risk level', 'anonymity, which is unavailable anywhere smaller'],
        lacks: ['cheap anything', 'ground worth cultivating on inside the walls', 'patience with a Qi Condensation cultivator'],
        note: 'The only places where a low-realm cultivator is genuinely unremarkable, which is either a relief or an insult depending on the person.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// HOW MORTALS REGARD CULTIVATORS
// It varies by realm and by region, and the first band is the important one:
// a Qi Condensation cultivator is not impressive to a farmer who has seen
// three of them.
// ─────────────────────────────────────────────────────────────────────────

export const MortalAttitudeSchema = z.object({
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    toOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    lowFall: z.string().min(60),
    quietMarches: z.string().min(60)
});
export type MortalAttitude = z.infer<typeof MortalAttitudeSchema>;

export const MORTAL_ATTITUDES: readonly MortalAttitude[] = [
    {
        fromOrdinal: 0, toOrdinal: 12,
        lowFall: 'Unimpressed. A farmer near a sect town has seen three of these this year, one of whom stole a chicken. They are treated as capable young people with an unreliable trade - useful for the thing in the woods, not owed deference, and charged the same as anyone.',
        quietMarches: 'Assessed as labour. A Chipping carver is a working adult, and the question is not what realm you are but whether you hold a grant. Visiting cultivators who expect deference are read as people who have never worked.'
    },
    {
        fromOrdinal: 13, toOrdinal: 16,
        lowFall: 'Respect with distance. Foundation Establishment is the line where a mortal stops assuming they can appeal to a magistrate about you. Innkeepers stop haggling, and nobody wants you in their village for long.',
        quietMarches: 'Stared at in the street. A Standing Cut carver is among the strongest people most Marches towns have met, and the Low Fall visitor who does not know that is walking around underestimating everyone.'
    },
    {
        fromOrdinal: 17, toOrdinal: 20,
        lowFall: 'Deference, and immediate curiosity about which sect. A Core Formation cultivator without an institution behind them is treated as either very dangerous or about to be somebody\'s problem.',
        quietMarches: 'The Weir Master is Keystone and there is one of him. A second one arriving in the region is a political event before it is a social one.'
    },
    {
        fromOrdinal: 21, toOrdinal: 28,
        lowFall: 'Fear, dressed as ceremony. Towns send someone out to meet them rather than let them arrive unannounced, and the meeting is about establishing what they want.',
        quietMarches: 'No frame of reference. The Marches has produced two people at this height in nine hundred years and both left, so the reaction is closer to how a mortal reacts to weather.'
    },
    {
        fromOrdinal: 29, toOrdinal: MAX_ORDINAL,
        lowFall: 'Not really a social category. Mortals who have been in a room with one describe the room rather than the person, and most of the province considers them rumour until one arrives.',
        quietMarches: 'Regarded as stories, in the specific sense that the local understanding of the upper realms is that they are stories. A visitor at this height would not be disbelieved so much as not understood.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT PEOPLE ARE AFRAID OF
//
// A settlement's fears are the most reliable statement of what it is, because
// a fear costs money: somebody is paid to stand somewhere, a store is kept
// that could have been eaten, a field is not sown. So each entry below names
// the expenditure, and the expenditure is the part that is checkable.
//
// The pattern worth noticing is that the fears get LESS accurate as the
// settlement gets larger. A hamlet is afraid of the thing in the woods, which
// is there. A city is afraid of a shortage it has never had, and spends more
// on it than the hamlet spends on everything.
//
// Nothing here is a hazard table. No entry spawns, gates or prices an
// encounter; `encounters.ts` and the world engine decide what is actually out
// there, and several of these fears are of things that are not.
// ─────────────────────────────────────────────────────────────────────────

export const SettlementFearSchema = z.object({
    id: z.string(),
    /** Where it is held. */
    settlement: z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city']),
    /** Stated the way somebody living there would state it. */
    fear: z.string().min(40),
    /** What is actually out there, which is frequently less and sometimes more. */
    behindIt: z.string().min(60),
    /**
     * What it costs, in money, labour or land not used. The load-bearing
     * field: a fear with no expenditure attached is a mood.
     */
    spentOnIt: z.string().min(40),
    /** Who receives the spending, where anybody does. */
    paidTo: z.string().nullable()
});
export type SettlementFear = z.infer<typeof SettlementFearSchema>;

export const SETTLEMENT_FEARS: readonly SettlementFear[] = [
    {
        id: 'fear-hamlet-woods',
        settlement: 'hamlet',
        fear: 'The thing in the woods, which has taken stock twice and a child once, and which nobody has seen properly.',
        behindIt: 'Usually a real beast at the bottom of the ladder, and the hamlet\'s description of it is unreliable in the direction of larger. What makes it dangerous is not the beast but the fact that a hamlet cannot afford the bounty that would bring anybody.',
        spentOnIt: 'Stock kept in at night, which costs grazing; a watch kept by men who worked all day; and a bounty saved toward and never quite reached.',
        paidTo: null
    },
    {
        id: 'fear-hamlet-being-noticed',
        settlement: 'hamlet',
        fear: 'Being noticed. A hamlet that gets onto somebody\'s list has been given a reason to be on it, and there is no coming off.',
        behindIt: 'Well founded. A hamlet has nothing worth taking except its people and its ground, and the mechanisms that would take either are the ordinary ones - a levy, a grant, a boundary moving - none of which require any malice.',
        spentOnIt: 'Understating the harvest to the tax clerk, which is the only universal mortal crime, and repairing nothing that faces the road.',
        paidTo: null
    },
    {
        id: 'fear-village-the-year',
        settlement: 'village',
        fear: 'The year. Not a bad year, the year: one hard winter with a bad harvest behind it and the village is a hamlet again and does not come back.',
        behindIt: 'The correct fear and the one nobody outside a village takes seriously. The margin between a village and a hamlet is about two seasons of stores, and the world holds no institution whose business it is to notice.',
        spentOnIt: 'A common store that is kept full and is never eaten from until it must be, and the headman\'s standing rests entirely on not touching it.',
        paidTo: null
    },
    {
        id: 'fear-village-the-cultivator-who-stays',
        settlement: 'village',
        fear: 'One who stays. They come through and that is fine. One who takes a house and does not leave is the end of the village deciding anything for itself.',
        behindIt: 'Accurate, and the mechanism is social rather than violent. A resident cultivator becomes the court of appeal for every dispute whether they want to or not, and a village that has one stops resolving anything without them.',
        spentOnIt: 'Hospitality calculated to be adequate and not welcoming, and a standing willingness to name a better village a day further on.',
        paidTo: null
    },
    {
        id: 'fear-market-town-the-rate',
        settlement: 'market_town',
        fear: 'The rate moving. Every price in the town is quoted against the cash-to-stone rate and the changer does not set it and cannot explain it.',
        behindIt: 'The rate is downstream of an assay the town has no access to, and it does move. What the town does not know is that it moves for reasons that have nothing to do with the town, which is why every local theory about it is wrong.',
        spentOnIt: 'Holding cash and stones both, in a proportion each merchant guards as a trade secret, at a cost in dead capital nobody has ever totalled.',
        paidTo: null
    },
    {
        id: 'fear-market-town-the-road',
        settlement: 'market_town',
        fear: 'The road shutting. A market town is a road with buildings on it and a season of closure empties it.',
        behindIt: 'Closures are real, common, and mostly unexplained. The town attributes nearly all of them upward, which means it cannot tell a closure it could have petitioned about from one it could not.',
        spentOnIt: 'A second route kept passable at the town\'s expense, and an understanding with a waystation on it that costs a fixed sum every year and is invoked perhaps twice a decade.',
        paidTo: 'a waystation keeper on the alternate route'
    },
    {
        id: 'fear-sect-town-admission-season',
        settlement: 'sect_town',
        fear: 'Admission season, and the fortnight afterwards, when the refused are still there and have spent everything getting there.',
        behindIt: 'The largest predictable disorder in either province, entirely produced by an intake that is smaller than the queue. The sects do not regard it as their problem and are correct that nothing obliges them to.',
        spentOnIt: 'Extra watchmen, a mission or temple kept open all year for a fortnight\'s use, and the food price rising for everybody so that the town is paid back for it.',
        paidTo: 'the missions and temples that take in the refused'
    },
    {
        id: 'fear-sect-town-the-sect-losing',
        settlement: 'sect_town',
        fear: 'The sect losing its ground. Not being defeated in some grand way. Losing the vein, after which the town has no reason to exist.',
        behindIt: 'A sect that loses its vein stops producing cultivators within a generation and is absorbed by whoever took it. The town is generally the last party to be told and the first to be affected.',
        spentOnIt: 'Nothing, because there is nothing a town can spend on this, which is precisely why it is the fear that gets talked about most and acted on least.',
        paidTo: null
    },
    {
        id: 'fear-city-the-stores',
        settlement: 'city',
        fear: 'The grain not arriving. A city eats what is carted in and has never gone more than a fortnight without.',
        behindIt: 'It has not happened in living memory and the fear is nonetheless the most expensive one in the world, because a city that has never been hungry has no way to calibrate how much reserve is enough.',
        spentOnIt: 'Public granaries, a standing subsidy to the carters, and the gate salt tax, which is levied as a grain measure and is the reason salt is smuggled.',
        paidTo: 'the city, which is to say the people who administer the granaries'
    },
    {
        id: 'fear-city-the-unregistered',
        settlement: 'city',
        fear: 'The ones who came in without registering. A city is the only place a cultivator can be anonymous and everybody in it knows that.',
        behindIt: 'True, and it is the reason the gate registers exist, and the registers catch the people who would have registered anyway. The population the fear is about is exactly the population the instrument cannot see.',
        spentOnIt: 'Gate registration at every gate, enforced continuously, funded by the fee, which is the real income of the house that runs it.',
        paidTo: 'the house that holds the registers'
    },
    {
        id: 'fear-city-a-quarrel-arriving',
        settlement: 'city',
        fear: 'Two of them falling out inside the walls. Nobody is afraid of one. Everybody is afraid of two.',
        behindIt: 'A duel between anybody above the bottom band is a building, and the city has no instrument that would stop it and no claim it could bring afterwards. What actually restrains it is that both parties usually want to come back.',
        spentOnIt: 'Retaining somebody resident and visible to do nothing at all, which is the most expensive line in a city\'s accounts and is renewed without discussion.',
        paidTo: 'whoever is currently retained, at a figure the city does not publish'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS DONE WITH THE DEAD
//
// The one thing every settlement in the world has to do and the one where
// they differ most, because a funeral is where a place's economics, its
// geography and its beliefs are all forced to produce a single decision about
// a body by a fixed deadline.
//
// Three facts run underneath all of them and none of them is a rule the
// engine reads:
//
//   A city will not bury an outsider and a village will not keep one, so
//   bodies travel, and the carriage rate is a real price above.
//
//   A cultivator's body is not the same object as a mortal's to the people
//   handling it, and the difference is entirely about who might come asking.
//
//   The corpse-carrying trade is watched, everywhere, because one of the
//   sects recruits out of it openly.
// ─────────────────────────────────────────────────────────────────────────

export const FuneraryPracticeSchema = z.object({
    id: z.string(),
    settlement: z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city']),
    /** What is actually done, plainly. */
    practice: z.string().min(60),
    /** Why it is done that way, which is usually about land or distance. */
    because: z.string().min(50),
    /** What it costs the family, in the currency they have. */
    cost: z.string().min(30),
    /** What is done differently when the body is a cultivator's. */
    ifTheyWereACultivator: z.string().min(60)
});
export type FuneraryPractice = z.infer<typeof FuneraryPracticeSchema>;

export const FUNERARY_PRACTICE: readonly FuneraryPractice[] = [
    {
        id: 'dead-hamlet',
        settlement: 'hamlet',
        practice: 'Buried the same day in ground the hamlet holds in common, wrapped rather than coffined, with the bell from the nearest village if somebody can be sent and without one if not.',
        because: 'There is no coffin maker, no gravedigger and no stone cutter within a day, and the ground is the one asset a hamlet has that costs it nothing to spend.',
        cost: 'A day of everybody\'s labour and a length of cloth, which is the only cash in it.',
        ifTheyWereACultivator: 'The hamlet sends word before it does anything, waits as long as it dares, and then buries them shallow and marks the place carefully, on the assumption that somebody will come and will want them moved.'
    },
    {
        id: 'dead-village',
        settlement: 'village',
        practice: 'A coffin if the family can raise it and a wrapping if not, a plot bought outright, a name cut without dates, and the bell rung once.',
        because: 'A village has a bell keeper, a plot register and a stone cutter on circuit, and it has enough people that a burial is a public act rather than a family one.',
        cost: 'Between a coffin and a bare wrapping there is the price of a mule, and which one a family pays is remarked on for a generation.',
        ifTheyWereACultivator: 'Buried apart from the village ground, in a plot bought for the purpose, because the village will not have an unclaimed cultivator among its own dead and cannot say why beyond that it will not.'
    },
    {
        id: 'dead-market-town',
        settlement: 'market_town',
        practice: 'Carried out to a burial ground beyond the walls at a fixed rate, coffined, with hired mourners for anybody who traded in the town, and a stone with dates for anybody who owned in it.',
        because: 'The town has no ground to spare inside and a road out that somebody is already paid to use, and the distinction between trading and owning is the distinction the whole town runs on.',
        cost: 'Coffin, carriage, plot and stone, which together are a season of a porter\'s wage and are borrowed against by most families.',
        ifTheyWereACultivator: 'The gate register is consulted first, because an unregistered body is a problem the town would rather hand to somebody else, and a registered one has a name that can be written to.'
    },
    {
        id: 'dead-sect-town',
        settlement: 'sect_town',
        practice: 'Two burial grounds, one for the town and one on sect ground, and everybody knows which one they will be in before they die.',
        because: 'A sect town is a support economy and its whole social order is which side of the gate a family stands on. The grounds make it permanent, which is the point.',
        cost: 'The town ground is priced like a village\'s. The sect ground is not sold, and there is no figure, which is a form of price.',
        ifTheyWereACultivator: 'A disciple is taken in by the sect and a refused applicant is not, and the missions bury the refused at their own expense, which is the largest single thing the missions do and the reason they are always short.'
    },
    {
        id: 'dead-city',
        settlement: 'city',
        practice: 'Registered, carted, and buried in ground the city holds and charges for, with the carriage of outsiders back to wherever they registered from as a paid trade in itself.',
        because: 'A city will not bury an outsider, which is a rule about liability rather than sentiment: an unclaimed body in a city ground is a claim somebody may bring later, and the register is what the city has instead of an answer.',
        cost: 'Everything above at city prices, plus the carriage if the register says elsewhere, which is why a gate registration is the cheapest funeral insurance available.',
        ifTheyWereACultivator: 'Held, not buried, until somebody claims them or a stated interval passes, and the interval is the one figure in the whole arrangement that the city publishes and does not enforce consistently.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const OCCUPATION_BY_ID: ReadonlyMap<string, Occupation> = new Map(OCCUPATIONS.map(o => [o.id, o]));
const PRICE_BY_ID: ReadonlyMap<string, Price> = new Map(PRICES.map(p => [p.id, p]));
const SETTLEMENT_BY_KIND: ReadonlyMap<Settlement['kind'], Settlement> =
    new Map(SETTLEMENTS.map(s => [s.kind, s]));

export function getOccupation(id: string): Occupation | undefined {
    return OCCUPATION_BY_ID.get(id);
}

export function getPrice(id: string): Price | undefined {
    return PRICE_BY_ID.get(id);
}

export function getSettlement(kind: Settlement['kind']): Settlement | undefined {
    return SETTLEMENT_BY_KIND.get(kind);
}

/**
 * What a cultivator at this ordinal can actually take for money. The answer at
 * ordinal 0 to 6 is the important one, because that is where a run spends most
 * of its life and there is otherwise nothing to do between breakthroughs.
 */
/**
 * The last ordinal at which anybody offers a cultivator work.
 *
 * Read straight off `MORTAL_ATTITUDES`: at 21 the attitude turns to "fear,
 * dressed as ceremony", where a town sends somebody out to meet the cultivator
 * rather than let them arrive. Nobody puts a day rate to a person they are
 * sending a delegation to meet, and by 29 they are "not really a social
 * category" at all.
 *
 * So this is not a rule about what a cultivator is willing to do. A Nascent
 * Soul who wanted to haul crates for the afternoon would find nobody prepared
 * to hire them, and a True Immortal asking after a porter's job is asking a
 * question the world has no answer to.
 */
export const MORTAL_WORK_CEILING_ORDINAL = 20;

/**
 * Everything reachable and still in place, before regard narrows it.
 *
 * `minOrdinal` is a survival floor and the settlement list is a fact about
 * geography; neither is a judgement about the asker. This is the honest
 * "what exists here" answer, and `findWorkForOrdinal` is the "what is put to
 * them" answer built on top of it.
 */
export function workExistingFor(ordinal: number, settlement?: Settlement['kind']): Occupation[] {
    return OCCUPATIONS.filter(o =>
        o.minOrdinal <= ordinal
        && (settlement === undefined || (o.settlements as readonly string[]).includes(settlement)));
}

/**
 * What is actually put to somebody standing here.
 *
 * There is no ceiling branch any more. The old one returned an empty list for
 * every ordinal above 20 and told a Tribulation Transcendence cultivator that
 * nobody was hiring anyone for anything, which read as unemployability rather
 * than as what it was. Now the ordinary bands do it: a job whose gate is far
 * enough below the asker stops being offered and says why, and the commissions
 * further up the catalog start being offered instead. The mortal ceiling
 * survives as a measured consequence - see `OCCUPATION_REGARD_SPAN` - rather
 * than as a rule.
 */
export function findWorkForOrdinal(
    ordinal: RegardAskerInput,
    settlement?: Settlement['kind']
): Occupation[] {
    const rung = typeof ordinal === 'number' ? ordinal : ordinal.ordinal;
    return offeredTo(workExistingFor(rung, settlement), ordinal);
}

/**
 * Work that exists here and is not being put to them, each with the reason.
 *
 * This is the half that stops silence being an answer. "Nobody is hiring" and
 * "there are eleven jobs on that board and every one of them is beneath you"
 * are different facts, and the second one is the one the world usually means.
 */
export function workWithheldFrom(
    ordinal: RegardAskerInput,
    settlement?: Settlement['kind']
): { occupation: Occupation; reason: string; band: string }[] {
    const rung = typeof ordinal === 'number' ? ordinal : ordinal.ordinal;
    const out: { occupation: Occupation; reason: string; band: string }[] = [];
    for (const occupation of workExistingFor(rung, settlement)) {
        const regard = regardOf(occupation, ordinal);
        if (regard.offered) continue;
        out.push({ occupation, reason: regard.reaction, band: regard.band });
    }
    return out;
}

/**
 * The highest ordinal at which any mortal-economy job is still put to somebody.
 *
 * Measured off the catalog and the bands rather than asserted, so the prose
 * above cannot go stale against the data. The test pins it equal to
 * `MORTAL_WORK_CEILING_ORDINAL`; if a future edit moves it, the constant is
 * what changes, and the paragraph with it.
 */
export function measuredMortalWorkCeiling(): number {
    const mortalWork = OCCUPATIONS.filter(o => o.kind !== 'cultivator');
    for (let ordinal = MAX_ORDINAL; ordinal >= 0; ordinal--) {
        if (offeredTo(mortalWork, ordinal).some(o => o.minOrdinal <= ordinal)) return ordinal;
    }
    return 0;
}

/** Prices in a category, cheapest first. */
export function pricesByCategory(category: Price['category']): Price[] {
    return PRICES.filter(p => p.category === category).sort((a, b) => a.cash - b.cash);
}

/** How mortals here treat a cultivator at this ordinal. */
export function mortalAttitudeFor(ordinal: number, regionId: string): string | undefined {
    const band = MORTAL_ATTITUDES.find(a => ordinal >= a.fromOrdinal && ordinal <= a.toOrdinal);
    if (!band) return undefined;
    return regionId === 'region-quiet-marches' ? band.quietMarches : band.lowFall;
}

/**
 * How long the starting purse lasts at a given standard of living, in months.
 * Thirty stones is three thousand cash, and this is the number that decides
 * whether a new cultivator takes the culling contract this week or next.
 */
export function monthsOfSurvival(stones: number, standard: 'rough' | 'inn' | 'cave' = 'rough'): number {
    const monthly = standard === 'rough'
        ? getPrice('price-month-rations')!.cash
        : standard === 'inn'
            ? getPrice('price-month-rations')!.cash + getPrice('price-month-lodging')!.cash
            : getPrice('price-month-rations')!.cash + getPrice('price-cave-vein')!.cash;
    return Number((stonesToCash(stones) / monthly).toFixed(1));
}

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS: FEARS AND THE DEAD
// ─────────────────────────────────────────────────────────────────────────

/** Everything a settlement of this size is afraid of, largest fear first. */
export function fearsOf(settlement: Settlement['kind']): SettlementFear[] {
    return SETTLEMENT_FEARS.filter(f => f.settlement === settlement);
}

/**
 * The fears somebody is actually paid for.
 *
 * The useful cut, because a fear with a recipient is an institution's income
 * and therefore a fear that will be maintained whether or not the thing behind
 * it is still there.
 */
export function fearsThatFundSomebody(): SettlementFear[] {
    return SETTLEMENT_FEARS.filter(f => f.paidTo !== null);
}

/** What a settlement of this size does with a body. */
export function funeraryPracticeOf(settlement: Settlement['kind']): FuneraryPractice | undefined {
    return FUNERARY_PRACTICE.find(f => f.settlement === settlement);
}
