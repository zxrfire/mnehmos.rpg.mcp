/**
 * What a grade's effect turns out to be, drawn at the moment it is used.
 *
 * The design owner listed outcomes and then said, in as many words, *"non
 * exhaustive examples, again"*. So this is not a closed union and nothing
 * downstream may switch on the set.
 */

import type {
    FoundationQuality,
    Insight,
    InsightDegree,
    InsightDomain,
    TechniqueGrade
} from '../../schema/cultivation.js';
import type { CultivationRNG } from './rng.js';
import {
    OVERCOMES,
    rollSpiritRoot,
    getSpiritRoot,
    type Element,
    type SpiritRootKey
} from './spirit-roots.js';
import { LEANING_DEGREE } from './dao.js';
import {
    MAX_ORDINAL,
    bodyMultiplierForOrdinal,
    rankName,
    realmIndexOf
} from './realms.js';
import { BODY_COST_OF_A_CROSSING } from './breakthrough.js';
import {
    FOUNDATION_A_GIVEN_CROSSING_LEAVES,
    NOTHING_IS_GIVEN_AT_OR_ABOVE
} from './taking-the-unearned-step.js';
import { BEASTS, BEAST_CORE_ORDINAL } from '../../data/cultivation/beasts.js';
// THE ONE DETONATION. `what-somebody-does-about-being-wronged.ts` already owns
// what spending yourself reaches and what it costs by distance; a second way to
// explode would be the same defect as a second way to compute a body.
import { whatADetonationCosts } from '../social-leverage/what-somebody-does-about-being-wronged.js';
// Type-only, so no runtime edge from `engine/cultivation` to `engine/world`.
// The tier vocabulary belongs to the bloodline layer and is not restated here.
import type { AbilityTier } from '../world/hunting-a-spirit-beast.js';

// WHAT A DRAW CAN DO TO A SHEET

/** The parts of a cultivator a consequence reads. Nothing else is needed. */
export interface SheetForOutcome {
    spiritRoot: SpiritRootKey;
    insights: readonly Insight[];
    realmOrdinal: number;
}

/** What the object itself brings to the draw, independent of who took it. */
export interface OutcomeContext {
    /**
     * The rung the OBJECT is pitched at.
     */
    sourceOrdinal: number;
}

export interface Overdraw {
    /** The rung the OBJECT is pitched at: where its stored energy came from. */
    pitchOrdinal: number;
    /** The rung this body reads as while it is carrying that. Fractional. */
    standsAt: number;
    /** That as a whole rung, for anything that needs one. */
    standsAtRung: number;
    /** How much bigger the body reads than its own. 1 is no change at all. */
    bodyMultiplier: number;
    /** How long the window lasts, in days. */
    days: number;
    /** What is still there when it ends. Kept, permanently. */
    residueRungs: number;
    /**
     * What the residue's structure is, and it is the Unearned Step's word.
     */
    foundation: FoundationQuality;
    /**
     * The price paid DURING the window, and it is control rather than damage.
     */
    halfMad: boolean;
    /**
     * What the body is left carrying, as a fraction of the pool.
     */
    bodyCost: number;
}

export interface Detonation {
    /**
     * The rung the blast is priced from: the OBJECT's, never the holder's.
     *
     * That is what makes it empowered rather than ordinary.
     */
    poweredFromOrdinal: number;
    /** There is no version of this the person who swallowed it walks away from. */
    theTakerIsGone: true;
}

export interface SheetChange {
    /** Present where the root was dealt again. */
    spiritRoot?: SpiritRootKey;
    /** Present where a comprehension formed. A candidate, not a formed Insight. */
    comprehension?: { domain: InsightDomain; subject: string; degree: InsightDegree };
    /** Present where a line started with this person. */
    bloodline?: { speciesId: string; tier: AbilityTier };
    /** Present where the body was pulled up past itself. */
    overdraw?: Overdraw;
    /** Present where it went off. */
    detonation?: Detonation;
    /**
     * Whether accumulation toward the next rung goes with it.
     *
     * Only a redrawn root sets this, and it is the honest reading of "you have
     * to restart": progress is accumulation IN a root, and that root is gone.
     */
    losesAccumulation: boolean;
    /** What happened, engine-authored and factual. Phase 3 dresses it. */
    line: string;
}

// THE TABLE

/**
 * How an outcome stands in the archives, and the middle one is the interesting one.
 */
export type RecordStanding = 'attributed' | 'unattributed' | 'unrecorded';

export interface GradeOutcome {
    /**
     * Stable id for this row. A bare string on purpose: see the header. A union
     * here would make adding a row a compile error somewhere else, which is the
     * exact pressure this table exists to remove.
     */
    key: string;
    /** Relative frequency within its grade's spread. */
    weight: number;
    /** What survives of the effect the object promised. */
    potencyMultiplier: number;
    /** What the body takes for it, against the object's own toxicity figure. */
    toxicityMultiplier: number;
    /**
     * How this outcome stands in the archives.
     */
    recordedAs: RecordStanding;
    /**
     * The account as the records carry it.
     *
     * For an `unattributed` row this describes the EVENT and not the cause,
     * because that is genuinely all the annal says.
     */
    account: string;
/**
 * What the archives put an `unattributed` event down to instead. The record can
 * be confidently WRONG rather than merely short - whoever wrote the annal needed
 * a reason and had one to hand - so anything rendering a record must not present
 * an unexplained event as an explained one.
 */
    blamedOn?: string;
    /**
     * Extra weight this row gains per rung the body is UNDER the pitch.
     */
    underweightPerRung?: number;
    /**
     * What this row does to the sheet it lands on.
     *
     * Optional: a row that only moves the multipliers needs none. Present, it
     * is the whole of the row's behaviour, which is what keeps the table open.
     */
    consequence?: (
        sheet: SheetForOutcome,
        ctx: OutcomeContext,
        rng: CultivationRNG
    ) => SheetChange;
}

/** A grade whose effect is fixed when the object is made. One row, always. */
const AS_MADE: readonly GradeOutcome[] = [
    {
        key: 'as_promised',
        weight: 1,
        potencyMultiplier: 1,
        toxicityMultiplier: 1,
        recordedAs: 'attributed',
        account: 'It does what it is for. Somebody made it to do that and it does that.'
    }
];

const ELEMENTS: readonly Element[] = ['metal', 'wood', 'water', 'fire', 'earth', 'lightning', 'ice'];

function isElement(value: string): value is Element {
    return (ELEMENTS as readonly string[]).includes(value);
}

/**
 * The element that destroys this one, or null where nothing does.
 */
export function whatStandsAgainst(element: Element): Element | null {
    for (const candidate of ELEMENTS) {
        if (OVERCOMES[candidate] === element) return candidate;
    }
    return null;
}

/**
 * The element this person's road is actually built on.
 */
export function theRoadTheyWalk(sheet: SheetForOutcome): Element | null {
    for (const insight of sheet.insights) {
        if (insight.domain === 'element' && isElement(insight.subject)) return insight.subject;
    }
    return getSpiritRoot(sheet.spiritRoot).elements[0] ?? null;
}

/** Beasts with a core, which is the bar for there being anything to carry down. */
const LINES_THAT_COULD_START = BEASTS.filter(b => b.ordinal >= BEAST_CORE_ORDINAL);

// THE THING IS A BATTERY, AND THAT ONE FACT EXPLAINS ALL OF IT
//
//   > that means that a grade 5 swallowing it is not 2x grade 5, but a 29 + a
//   > 5 (anyone over 29 is 2x their own realm). that makes sense, cuz the
//   > chaos pill stores energy
//
//   > ANYONE ABOVE A 29 GETS A BONUS A FEW ORDINALS UP. CUZ TO A 41, A 29 IS
//   > NOTHING. BUT IF A 5 WERE TO SWALLOW IT AND SURVIVE THEY'D GET A 29
//
// **A chaos-grade object holds a FIXED quantity of stored energy - what a body
// at the rung it is pitched at is worth - and that quantity does not scale to
// whoever drinks it.** Everything else here is arithmetic on that sentence.
//
// WHY THERE IS NO `29` ANYWHERE BELOW, AND MUST NOT BE
//
// The pitch comes from `PILL_GRADE_REALM` through the caller, so it is a value
// rather than a number written down twice. And the two halves of the ruling
// are not two rules: they are one addition on the body curve, which is
// exponential, so a sum on it collapses to its largest term.
//
//   a 5 drinks it     1.4 of body plus 32 of body is 33.4, which is a 29.
//                     Their own 5 is a rounding error next to what they drank,
//                     and the "max wins" half falls out with no comparison.
//   a 29 drinks it    32 plus 32 is 64, which is exactly one realm up -
//                     `BODY_REALM_MULTIPLIER` is 2, so a doubling IS a realm,
//                     which is why "2x their own realm" and "a few ordinals
//                     up" were always the same sentence.
//   a 41 drinks it    256 plus 32 is 288. An eighth. To a 41, a 29 is nothing.
//
// One derivation, three answers, no branch - and a chaos pill pitched at some
// other rung tomorrow behaves correctly without an edit.
//
// AND IT IS THE SAME NUMBER THE BLAST IS PRICED FROM
//
// `ctx.sourceOrdinal` feeds the overdraw and the detonation both, because they
// are the same stored energy let go two different ways. That is also the whole
// explanation of why a weak drinker goes off: a 5 who survives BECOMES a 29 -
// a body built for 5 holding what a 29 holds - and the ones who do not survive
// are the crater. One quantity explains the boost, the risk and the blast.

/** How long the window lasts. Long enough to spend, short enough to be a window. */
export const OVERDRAW_DAYS = 30;
/** What is still there when it ends. */
export const OVERDRAW_RESIDUE_RUNGS = 1;

/**
 * How much body this person is holding while they carry the thing's worth too.
 */
export function bodyWhileCarrying(ordinal: number, pitchOrdinal: number): number {
    return bodyMultiplierForOrdinal(ordinal) + bodyMultiplierForOrdinal(pitchOrdinal);
}

/**
 * How much larger than their own body they read. 1 is no change at all.
 */
export function liftFromCarrying(ordinal: number, pitchOrdinal: number): number {
    const own = bodyMultiplierForOrdinal(ordinal);
    return own <= 0 ? 1 : bodyWhileCarrying(ordinal, pitchOrdinal) / own;
}

/**
 * The rung a body of `ordinal` reads as while it carries `pitchOrdinal`'s worth.
 */
export function standingWhileCarrying(ordinal: number, pitchOrdinal: number): number {
    const carried = bodyWhileCarrying(ordinal, pitchOrdinal);
    // The last whole rung whose body is inside what they are holding: that is
    // the rung they ARE. Anything past it is the remainder, and the remainder
    // is what the interpolation is for.
    let rung = 0;
    for (let o = MAX_ORDINAL; o >= 0; o--) {
        if (bodyMultiplierForOrdinal(o) <= carried) { rung = o; break; }
    }
    if (rung >= MAX_ORDINAL) return MAX_ORDINAL;
    const here = bodyMultiplierForOrdinal(rung);
    const next = bodyMultiplierForOrdinal(rung + 1);
    if (next <= here) return rung;
    return rung + (carried - here) / (next - here);
}

function beginsALine(tier: AbilityTier) {
    return (_sheet: SheetForOutcome, _ctx: OutcomeContext, rng: CultivationRNG): SheetChange => {
        const species = LINES_THAT_COULD_START[rng.int(0, LINES_THAT_COULD_START.length - 1)];
        return {
            bloodline: { speciesId: species.id, tier },
            losesAccumulation: false,
            line: tier === 'final'
                ? `What is standing there is a ${species.name} wearing a person, and it can put `
                  + 'the other shape on whenever it likes. Nobody they grew up with is going to '
                  + 'take this well.'
                : `Something of a ${species.name} settled into the blood and did not leave. No `
                  + 'ancestor of theirs had it. Their children will.'
        };
    };
}

/**
 * What each grade's effect is drawn from at the moment of use.
 */
export const GRADE_SPREAD: Readonly<Record<TechniqueGrade, readonly GradeOutcome[]>> = {
    mortal: AS_MADE,
    earth: AS_MADE,
    heaven: AS_MADE,
    immortal: AS_MADE,
    chaos: [
        {
            key: 'as_promised',
            weight: 26,
            potencyMultiplier: 1,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'It did the thing it was described as doing, at the strength it was described '
                + 'as doing it at. This is the account most often given and it is why anybody '
                + 'takes one.'
        },
        {
            key: 'in_flood',
            weight: 10,
            potencyMultiplier: 4,
            toxicityMultiplier: 1.5,
            recordedAs: 'attributed',
            account:
                'It did the thing several times over, more than the body had asked for and more '
                + 'than it had room for. Two of the three accounts of this describe the '
                + 'aftermath as the harder part.'
        },
        {
            key: 'guttered',
            weight: 15,
            potencyMultiplier: 0.1,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'Almost nothing happened. The object is gone, the body carries what the object '
                + 'costs to swallow, and whatever was in it went somewhere that was not here.'
        },
        {
            key: 'opposing_road',
            weight: 13,
            // The medicine does not happen. What happens instead is that you
            // understand something - real comprehension, correctly formed, with
            // a provenance, in the road that destroys your own.
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'The effect never arrived and a comprehension did, in the road that stands '
                + 'against the one this person walks. It is real and it is theirs and there is '
                + 'nothing whatever they can do with it.',
            consequence: (sheet): SheetChange => {
                const road = theRoadTheyWalk(sheet);
                const against = road ? whatStandsAgainst(road) : null;
                // Where nothing stands against their road - a mutated root, or
                // nothing understood yet - the comprehension has nowhere
                // hostile to land and settles on the road they are already on.
                // That is a plain gift, and the grade is allowed to hand out
                // plain gifts: it is unreliable, not malicious.
                const subject = against ?? road;
                if (!subject) {
                    return {
                        losesAccumulation: false,
                        line: 'Something was understood and did not stay long enough to be named.'
                    };
                }
                return {
                    comprehension: { domain: 'element', subject, degree: LEANING_DEGREE },
                    losesAccumulation: false,
                    line: against
                        ? `A ${subject} comprehension, whole and correctly formed, in the one `
                          + `road that stands against ${road}. It is theirs now. It is worth `
                          + 'nothing to them.'
                        : `A ${subject} comprehension arrived, on the road already being walked. `
                          + 'Nothing in the cycle stands against this one, so what could have '
                          + 'been a ruin is simply a gift.'
                };
            }
        },
        {
            key: 'root_redrawn',
            weight: 11,
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'The root was dealt again. Everything accumulated toward the next rung was '
                + 'accumulated in a root that is no longer there, and it does not carry across. '
                + 'The accounts of this are numerous, detailed, and evenly split between ruin '
                + 'and deliverance, which the archivists find more troubling than a bad result.',
            consequence: (sheet, _ctx, rng): SheetChange => {
                // The same deck the world deals from, so a redraw is a fresh
                // hand rather than a curve somebody tuned. Landing on what they
                // already had is a legitimate result and is not re-rolled.
                const dealt = rollSpiritRoot(rng.next());
                const before = getSpiritRoot(sheet.spiritRoot);
                return {
                    spiritRoot: dealt.key,
                    losesAccumulation: true,
                    line: `The root was dealt again: ${before.name} before, ${dealt.name} now. `
                        + 'Everything accumulated toward the next rung was accumulated in a root '
                        + 'that no longer exists, and it does not come across.'
                };
            }
        },
        {
            key: 'a_line_begins',
            weight: 8,
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'Something that is not human settled into the blood and stayed. Nobody in the '
                + 'family had it before. Whether it is worth anything depends entirely on what '
                + 'it turned out to be.',
            // `latent` and `grown` are the diluted tiers `bloodlineTierForChild`
            // already moves between. The row below is the same mechanic read at
            // its top tier, which is why neither needs a resolver branch.
            consequence: (sheet, ctx, rng) =>
                beginsALine(rng.chance(0.5) ? 'grown' : 'latent')(sheet, ctx, rng)
        },
        {
            key: 'the_shape_changes',
            weight: 4,
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            // A HOLE IN THE RECORD, AND IT IS NOT RANDOM
            // Whoever this happened to did not come back and file an account.
            recordedAs: 'unrecorded',
            account:
                'What was standing there afterwards was a person until it decided otherwise.',
            // `final` is not a stronger `latent`; `abilityAt` says it is the
            // whole thing, with the beast shape available on request rather
            // than worn. So the owner's two examples are one mechanic at two
            // tiers and nothing has to know which is the frightening one.
            consequence: beginsALine('final')
        },
        {
            key: 'overdrawn_and_half_mad',
            weight: 9,
            // The medicine's own effect is beside the point next to this.
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            recordedAs: 'attributed',
            account:
                'They stood several rungs above themselves for a month and were not entirely '
                + 'the one deciding what to do with it. What is left afterwards is one rung they '
                + 'did not climb, a structure that was never formed under it, and a body that '
                + 'is not what it was. Every account of this is somebody explaining what they '
                + 'did during the month.',
            consequence: (sheet, ctx): SheetChange => {
                const stands = standingWhileCarrying(sheet.realmOrdinal, ctx.sourceOrdinal);
                const lift = liftFromCarrying(sheet.realmOrdinal, ctx.sourceOrdinal);
                // THE RESIDUE OBEYS THE LADDER'S OWN RULE ABOUT GIFTS
                //
                // `NOTHING_IS_GIVEN_AT_OR_ABOVE` is the Unearned Step's bound
                // and it is not about pills: nothing hands anybody a rung up
                // there, whatever it is. Reusing the constant rather than
                // writing a bound of my own is what stops this becoming a
                // second opinion about the top of the ladder - and it makes the
                // object what it should be, which is worth most to the people
                // who have furthest to go.
                const residueRungs = sheet.realmOrdinal >= NOTHING_IS_GIVEN_AT_OR_ABOVE
                    ? 0
                    : OVERDRAW_RESIDUE_RUNGS;
                return {
                    overdraw: {
                        pitchOrdinal: ctx.sourceOrdinal,
                        standsAt: stands,
                        standsAtRung: Math.round(stands),
                        bodyMultiplier: lift,
                        days: OVERDRAW_DAYS,
                        residueRungs,
                        foundation: FOUNDATION_A_GIVEN_CROSSING_LEAVES,
                        halfMad: true,
                        bodyCost: BODY_COST_OF_A_CROSSING
                    },
                    losesAccumulation: false,
                    // What they read as, said as a rung and as a ratio, because
                    // one of the two is uninformative at each end of the ladder:
                    // near the top the gain is real and smaller than a rung, and
                    // far below the pitch the ratio is enormous and the rung is
                    // the only thing that means anything.
                    line: `Overdrawn: standing at ${rankName(Math.round(stands))} for `
                        + `${OVERDRAW_DAYS} days, ${lift.toFixed(2)} times the body they own, `
                        + 'and not entirely the one deciding what to do with it. '
                        + (residueRungs > 0
                            ? `When it lets go they keep ${residueRungs}, on nothing, and the `
                              + 'body pays the price of a crossing for a crossing that never '
                              + 'happened.'
                            : 'When it lets go they keep nothing - nothing is given a rung this '
                              + 'high, by anything - and the body pays the price of a crossing '
                              + 'it did not make.')
                };
            }
        },
        {
            key: 'it_goes_off',
            weight: 4,
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            // THE EVENT IS IN THE ANNALS. THE CAUSE IS NOT
            // Not a silence: a compound going up is the most visible thing on
            // this table and gets written down every time. What is missing is
            // WHY, because the only person who knew swallowed it. So a
            // researcher gets a real entry to follow rather than a gap - and
            // gets it under whatever explanation the annalist reached for.
            recordedAs: 'unattributed',
            // HOW STEEP, AND WHY THAT NUMBER
            //
            // The base weights total 100, so a rung under the pitch is worth
            // eight points of a hundred. Against a pitch of 29 that produces
            // the two cases the owner described, and the middle is a curve
            // rather than a cliff:
            //
            //   at the pitch    4 in 100. A genuine gamble across the spread.
            //   nine under      44 in 172. A serious one.
            //   twenty-four under   196 in 292, about two in three. Mostly
            //                   holding a bomb - and still one chance in three
            //                   of something else, because it is a weighting.
            underweightPerRung: 8,
            account:
                'In such a year the compound went up. A date, a place, a count of the dead, '
                + 'and no cause anybody has ever settled.',
            blamedOn:
                'The standing explanation is a formation failure. It is written as a fact, it '
                + 'has been copied forward for two hundred years, and nobody who copied it was '
                + 'there.',
            consequence: (_sheet, ctx): SheetChange => ({
                detonation: { poweredFromOrdinal: ctx.sourceOrdinal, theTakerIsGone: true },
                losesAccumulation: false,
                line: 'It went off, carrying the thing\'s own weight rather than the body\'s. '
                    + 'Everybody standing there was standing there, and each of them is now a '
                    + 'wrong done to somebody with a name.'
            })
        }
    ]
};

/**
 * Whether this grade's effect is settled when the thing is USED rather than when it
 * was made.
 */
export function isSettledOnUse(grade: TechniqueGrade): boolean {
    return GRADE_SPREAD[grade].length > 1;
}

/**
 * How far under the thing's own rung this body is. Zero at or above it.
 *
 * The one input the drinker contributes to the draw, and it reads the pitch off
 * the object rather than off any number written down here.
 */
export function rungsUnderThePitch(ordinal: number, pitchOrdinal: number): number {
    return Math.max(0, Math.round(pitchOrdinal) - Math.round(ordinal));
}

/** The weight a row carries for a body this far under the thing's own rung. */
export function weightOf(outcome: GradeOutcome, rungsUnder: number): number {
    return outcome.weight + (outcome.underweightPerRung ?? 0) * Math.max(0, rungsUnder);
}

/**
 * Draw what this thing turns out to do.
 */
export function drawGradeOutcome(
    grade: TechniqueGrade,
    rng: CultivationRNG,
    rungsUnder = 0
): GradeOutcome {
    const spread = GRADE_SPREAD[grade];
    const total = spread.reduce((sum, o) => sum + weightOf(o, rungsUnder), 0);
    let roll = rng.next() * total;
    for (const outcome of spread) {
        roll -= weightOf(outcome, rungsUnder);
        if (roll < 0) return outcome;
    }
    return spread[spread.length - 1];
}

/**
 * Apply a drawn row to one particular sheet.
 *
 * Three lines long on purpose. Every decision belongs to the row, so this
 * cannot acquire a branch: adding an outcome never touches this function.
 */
export function whatItDoesToTheSheet(
    outcome: GradeOutcome,
    sheet: SheetForOutcome,
    ctx: OutcomeContext,
    rng: CultivationRNG
): SheetChange {
    if (!outcome.consequence) return { losesAccumulation: false, line: outcome.account };
    return outcome.consequence(sheet, ctx, rng);
}

// WHAT THE BLAST REACHES

/**
 * What an empowered detonation takes off somebody standing there, 0..1 of pool.
 */
export function whatTheBlastTakesFrom(
    poweredFromOrdinal: number,
    bystanderOrdinal: number
): number {
    const realmsBelow = realmIndexOf(bystanderOrdinal) - realmIndexOf(poweredFromOrdinal);
    return whatADetonationCosts(realmsBelow);
}

// WHAT THE RECORDS SAY

/**
 * The sentence a good archivist ends on, and it is not "we do not know".
 */
export const RECORD_CAVEAT =
    'These are the accounts that exist, which is not the same as the outcomes that exist. '
    + 'A record of what a thing has done is assembled out of people who were in a position to '
    + 'say so afterwards, and nobody has ever seen the whole of what this material does.';

export interface RecordedAccount {
    key: string;
    /** What the archive says. For an unattributed entry, the event only. */
    account: string;
    /**
     * Whether this entry names a cause.
     */
    standing: RecordStanding;
    /** The confident wrong answer the archive files it under, where there is one. */
    blamedOn?: string;
}

export interface RecordOfAGrade {
    /** What this reach actually turns up, commonest account first. */
    accounts: readonly RecordedAccount[];
    /**
     * True where this grade has nothing to research: it does one thing.
     */
    settledWhenMade: boolean;
    caveat: string;
}

/**
 * What somebody with this much reach into the archives can find out. NOTE WHAT IS
 * NOT HERE: no total, no denominator and no "n of m", because the set is open and
 * a count with a total beside it would be a lie the data cannot support. Anything
 * rendering this must not invent one.
 */
export function whatTheRecordsSay(grade: TechniqueGrade, depth: number): RecordOfAGrade {
    const written = GRADE_SPREAD[grade]
        .filter(o => o.recordedAs !== 'unrecorded')
        .slice()
        .sort((a, b) => b.weight - a.weight);
    const reach = Math.max(0, Math.floor(depth));

    return {
        accounts: written.slice(0, reach).map(o => ({
            key: o.key,
            account: o.account,
            standing: o.recordedAs,
            ...(o.blamedOn === undefined ? {} : { blamedOn: o.blamedOn })
        })),
        settledWhenMade: !isSettledOnUse(grade),
        caveat: RECORD_CAVEAT
    };
}
