/**
 * What a grade's effect turns out to be, drawn at the moment it is used.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING THIS EXISTS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaos grade is **immortal grade's peer, not its superior**. The two are the
 * same magnitude of power. What separates them is that an immortal-grade thing
 * does what it says on the tin every time, and a chaos-grade thing does not:
 *
 *   > a herb should be chaos cuz eating it gives you random effects (good or
 *   > bad) same for the canon, you don't know if the canon gives you the
 *   > ability that you want until you practice it. its not the fact that its
 *   > split that makes it chaos, but practicing it could turn you into a
 *   > cactus.
 *
 * So the grade is defined by ONE property and nothing else: **the effect is
 * settled when the thing is used, not when it was made.** Not rarity, not
 * price, not where it came from, not whether the canon it belongs to is
 * complete. Those are facts about particular objects and say nothing about
 * grade.
 *
 * An immortal pill gives you a rung cleanly. A chaos pill gives you a rung, a
 * window in which you are briefly dangerous, and a body that will not be what
 * it was. **Same power, different shape.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THERE IS NO BRANCH ON THE WORD `chaos` ANYWHERE BELOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `GRADE_SPREAD` gives EVERY grade a spread. Four of the five are a single row
 * - a point mass at "it did what it said" - so drawing from them is total and
 * costs nothing, and `isSettledOnUse` is derived from the shape of the spread
 * rather than from the grade's name.
 *
 * A sixth grade added tomorrow with a spread of its own gets all of this for
 * free, and an object moved between grades changes behaviour without anybody
 * editing a resolver.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TABLE IS OPEN AND MUST STAY OPEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner listed outcomes and then said, in as many words, **"non
 * exhaustive examples, again"**. So this is not a closed union with seven
 * members, and nothing downstream may switch on the set.
 *
 * The shape that keeps it open: **an outcome carries its own consequence.** A
 * row is `{ weight, multipliers, account, consequence }` where `consequence` is
 * the function that applies it to a sheet. Adding an outcome next month is
 * adding one entry to one array. If anybody ever has to edit a resolver to add
 * "your meridians reroute", the shape has gone wrong - that is the
 * no-branch-on-chaos rule one level up.
 *
 * `key` is a bare `string` rather than a union for the same reason. A union
 * would compile-error the moment somebody added a row, which is precisely the
 * pressure this is built to remove.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE OUTCOMES ARE NOT A GOOD/BAD AXIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > a chaos pill might give you comprehension in a dao which is the total
 *   > opposite of your current one (which is useless) or change your root
 *   > (which might be devastating, cuz you have to restart, or good, if you
 *   > were a 5 elements root), or it might give you a bloodline, or turn you
 *   > into a spirit beast
 *
 * Read what that says about severity. **The severity is not in the effect. It
 * is in who it lands on, and where they were standing.** A redrawn root ruins a
 * Single Metal Root and rescues a muddled five-element one, and it is the SAME
 * outcome. A detonation in an empty field is a story; the same detonation in
 * the inner court of a house you hate is *"situationally useful if you were in
 * a sect you hated"*. So nothing here decides in advance which tail is bad. The
 * draw applies the change and the world prices it, which is also the only way
 * "good if you were a five-elements root" comes out right with no special case.
 *
 * And every one of them is irreversible. A chaos object that cannot actually
 * ruin somebody is not a chaos object, so a redrawn root really does take the
 * accumulation with it - that is what "you have to restart" means - and the
 * detonation really does end the run.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT ANYBODY KNOWS ABOUT IT BEFOREHAND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > like you have SOME idea of what it does, based on past records
 *   > which may or may not be complete
 *
 * So this is NOT an unknowable, and researching one is a real thing to do -
 * which is what makes a chaos object a decision you can prepare for rather than
 * a coin flip. `whatTheRecordsSay` is that surface, and its incompleteness is
 * structural rather than a hedge, for two separate reasons:
 *
 * - **Somebody has to have lived to write the account.** `recordedAs` carries
 *   that on the row itself, so the archive is systematically missing its own
 *   worst tail rather than missing a random sample of it.
 * - **The set is open.** Nobody has seen all of what this material does,
 *   because there is no all. An archive holding nine accounts holds nine out of
 *   an unknown number, NOT nine out of eleven - which is why `RecordOfAGrade`
 *   deliberately refuses to report a denominator. A count with a total beside
 *   it would be a lie the data cannot support.
 *
 * The honest archivist's sentence is *these are the ones we have accounts of*,
 * and here it is true rather than modest.
 *
 * **And an absence from the record is not the same as a silence.** The third
 * standing, `unattributed`, is the important one: an account of a compound
 * going up, with a year and a place and a number of dead, and no established
 * cause. The event is visible and the causation is not - which is a clue rather
 * than a hole, and it is the knowledge layer's ordinary business, since it
 * already reports things reaching people in unattributed and in partial form.
 *
 * It also means **the record can be confidently wrong rather than merely
 * short**. Whoever wrote the annal needed a reason and had one to hand, so the
 * Cinnabar hall was "lost to a formation failure in the year 812" and the entry
 * looks exactly like a settled fact. `blamedOn` carries that, and anything
 * rendering a record must not present an unexplained event as an explained one.
 *
 * Knowing changes nothing about what happens. It only changes whether the
 * person chose it with their eyes open, so nothing here gates the draw on it.
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
import { REALM_TIERS } from './realms.js';
import { BODY_COST_OF_A_CROSSING } from './breakthrough.js';
import { FOUNDATION_A_GIVEN_CROSSING_LEAVES } from './taking-the-unearned-step.js';
import { BEASTS, BEAST_CORE_ORDINAL } from '../../data/cultivation/beasts.js';
// THE ONE DETONATION. `what-somebody-does-about-being-wronged.ts` already owns
// what spending yourself reaches and what it costs by distance; a second way to
// explode would be the same defect as a second way to compute a body.
import { whatADetonationCosts } from '../social-leverage/what-somebody-does-about-being-wronged.js';
// Type-only, so no runtime edge from `engine/cultivation` to `engine/world`.
// The tier vocabulary belongs to the bloodline layer and is not restated here.
import type { AbilityTier } from '../world/hunting-a-spirit-beast.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A DRAW CAN DO TO A SHEET
// ─────────────────────────────────────────────────────────────────────────

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
     *
     * Read by the outcomes that are the object's power rather than the
     * holder's - "empowered" detonation means the blast carries the thing's
     * weight, so a nobody who swallows the wrong pill takes out something a
     * nobody could never touch.
     */
    sourceOrdinal: number;
}

export interface Overdraw {
    /** How many rungs the body is pulled up to, for the window. */
    rungs: number;
    /** How long the window lasts, in days. */
    days: number;
    /** What is still there when it ends. Kept, permanently. */
    residueRungs: number;
    /**
     * What the residue's structure is, and it is the Unearned Step's word.
     *
     * A rung arrived at this way had no crossing under it, which is the
     * schema's own definition of `incomplete`: "rushed; part of the structure
     * was never formed". Reusing the constant rather than the string means the
     * world reads somebody carrying this exactly the way it reads somebody who
     * took a Step.
     */
    foundation: FoundationQuality;
    /**
     * The price paid DURING the window, and it is control rather than damage.
     *
     * Whether what they do with the burst is what they would have chosen is the
     * whole of what is in question. Note this is a state to be SHOWN, never an
     * excuse for a surface to refuse what somebody types: they bought this, and
     * a cost you bought reads as what you paid rather than as the parser saying
     * no.
     */
    halfMad: boolean;
    /**
     * What the body is left carrying, as a fraction of the pool.
     *
     * The crossing toll's own currency, off `BODY_COST_OF_A_CROSSING`, so
     * "damaged" is priced in the units this engine already charges for
     * climbing instead of inventing a second kind of harm.
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

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How an outcome stands in the archives, and the middle one is the interesting
 * one.
 *
 *   attributed    somebody it happened to said so afterwards, and the account
 *                 names the cause. Most of the table.
 *   unattributed  the EVENT is in the annals - a year, a place, a number of
 *                 dead - and the cause is not. A clue, not a hole, and usually
 *                 filed under somebody's confident wrong answer.
 *   unrecorded    nothing at all. Whoever it happened to was in no position to
 *                 write anything down and nobody outside saw enough to guess.
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
     *
     * The one axis the record layer reads, and it is not "how bad is it" - a
     * redrawn root is ruinous and thoroughly documented, because the people it
     * ruined were still there to be asked.
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
     * What the archives put an `unattributed` event down to instead.
     *
     * A confident wrong answer, not a blank: whoever wrote the entry needed a
     * reason and had one to hand. Present only where there is such an entry.
     */
    blamedOn?: string;
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
 *
 * `OVERCOMES` is written the other way round - it maps an element to the one it
 * destroys - so this inverts it rather than restating it, and the inversion is
 * where the honest gap shows: **lightning and ice are values of nothing**, so a
 * mutated root has no opposing element at all. That is not an oversight to
 * paper over. It is the existing table saying nothing in the five-element cycle
 * stands against a mutation, and this returns null and lets the caller deal
 * with it rather than inventing an opposite.
 */
export function whatStandsAgainst(element: Element): Element | null {
    for (const candidate of ELEMENTS) {
        if (OVERCOMES[candidate] === element) return candidate;
    }
    return null;
}

/**
 * The element this person's road is actually built on.
 *
 * Their comprehension first, because a cultivator who has understood water is
 * walking the water road whatever they were born with; their root only where
 * they have understood nothing yet.
 */
export function theRoadTheyWalk(sheet: SheetForOutcome): Element | null {
    for (const insight of sheet.insights) {
        if (insight.domain === 'element' && isElement(insight.subject)) return insight.subject;
    }
    return getSpiritRoot(sheet.spiritRoot).elements[0] ?? null;
}

/** Beasts with a core, which is the bar for there being anything to carry down. */
const LINES_THAT_COULD_START = BEASTS.filter(b => b.ordinal >= BEAST_CORE_ORDINAL);

/** Rungs the overdraw pulls a body up by. A realm, briefly. */
export const OVERDRAW_RUNGS = 4;
/** How long the window lasts. Long enough to spend, short enough to be a window. */
export const OVERDRAW_DAYS = 30;
/** What is still there when it ends. */
export const OVERDRAW_RESIDUE_RUNGS = 1;

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
 *
 * Four point masses and one open spread. The four are not an omission: an
 * immortal-grade object being uniformly positive is a design statement, and
 * writing it as a one-row table rather than as an absence is what lets every
 * consumer take one code path.
 *
 * The weights on the open one are relative, not percentages, precisely because
 * the set is open - a total that reads as 100 invites somebody to treat it as
 * complete. Roughly half the mass is still the object doing its job: a
 * chaos-grade thing is genuinely powerful and the ordinary case has to be worth
 * reaching for, or the grade is a trap rather than a decision.
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
            // ── A HOLE IN THE RECORD, AND IT IS NOT RANDOM ────────────────
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
            consequence: (_sheet, _ctx): SheetChange => ({
                overdraw: {
                    rungs: OVERDRAW_RUNGS,
                    days: OVERDRAW_DAYS,
                    residueRungs: OVERDRAW_RESIDUE_RUNGS,
                    foundation: FOUNDATION_A_GIVEN_CROSSING_LEAVES,
                    halfMad: true,
                    bodyCost: BODY_COST_OF_A_CROSSING
                },
                losesAccumulation: false,
                line: `Overdrawn: ${OVERDRAW_RUNGS} rungs above themselves for ${OVERDRAW_DAYS} `
                    + `days, and not entirely the one deciding. When it lets go they keep `
                    + `${OVERDRAW_RESIDUE_RUNGS}, on nothing, and the body pays the price of a `
                    + 'crossing for a crossing that never happened.'
            })
        },
        {
            key: 'it_goes_off',
            weight: 4,
            potencyMultiplier: 0,
            toxicityMultiplier: 1,
            // ── THE EVENT IS IN THE ANNALS. THE CAUSE IS NOT ─────────────
            // Not a silence: a compound going up is the most visible thing on
            // this table and gets written down every time. What is missing is
            // WHY, because the only person who knew swallowed it. So a
            // researcher gets a real entry to follow rather than a gap - and
            // gets it under whatever explanation the annalist reached for.
            recordedAs: 'unattributed',
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
 * Whether this grade's effect is settled when the thing is USED rather than
 * when it was made.
 *
 * Derived from the shape of the spread and never from the grade's name, which
 * is the whole of how "no bespoke branch on chaos" is kept true.
 */
export function isSettledOnUse(grade: TechniqueGrade): boolean {
    return GRADE_SPREAD[grade].length > 1;
}

/**
 * Draw what this thing turns out to do.
 *
 * Total over every grade. A grade with a point-mass spread returns its single
 * row and consumes exactly one sample, so the call site needs no branch and the
 * stream advances identically whatever is being swallowed.
 */
export function drawGradeOutcome(grade: TechniqueGrade, rng: CultivationRNG): GradeOutcome {
    const spread = GRADE_SPREAD[grade];
    const total = spread.reduce((sum, o) => sum + o.weight, 0);
    let roll = rng.next() * total;
    for (const outcome of spread) {
        roll -= outcome.weight;
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE BLAST REACHES
// ─────────────────────────────────────────────────────────────────────────

/** Which major realm an ordinal sits in. Index, for counting realms apart. */
function realmIndexOf(ordinal: number): number {
    const at = REALM_TIERS.findIndex(t => ordinal >= t.ordinalStart && ordinal <= t.ordinalEnd);
    return at < 0 ? REALM_TIERS.length - 1 : at;
}

/**
 * What an empowered detonation takes off somebody standing there, 0..1 of pool.
 *
 * `whatADetonationCosts` is the one pricing and is not reimplemented; all this
 * adds is WHERE the power is read from. An ordinary detonation is priced from
 * the detonator's rung. This one is priced from the object's, which is the
 * whole of what "empowered" means: a Qi Condensation nobody who swallows the
 * wrong pill takes out something a Qi Condensation nobody could never touch.
 *
 * The falloff runs one way only, which is the existing table's own shape:
 * anybody AT or BELOW the blast's weight is finished by it, and only somebody
 * standing above it takes a reduced share. So the interesting number is never
 * what it does to the crowd - it is what it reaches on whoever the room was
 * built around.
 */
export function whatTheBlastTakesFrom(
    poweredFromOrdinal: number,
    bystanderOrdinal: number
): number {
    const realmsBelow = realmIndexOf(bystanderOrdinal) - realmIndexOf(poweredFromOrdinal);
    return whatADetonationCosts(realmsBelow);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE RECORDS SAY
// ─────────────────────────────────────────────────────────────────────────

/**
 * The sentence a good archivist ends on, and it is not "we do not know".
 *
 * "These are the ones we have accounts of" and "these are the ones there are"
 * are different claims, and the difference is the whole of what makes a chaos
 * object worth researching and still worth being frightened of.
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
     *
     * Carried through so a renderer CANNOT present an unexplained event as an
     * explained one. An `unattributed` entry read out flat is exactly the lie
     * this field exists to prevent.
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
     *
     * NOTE WHAT IS NOT HERE. There is no total, no denominator and no "n of m",
     * because the set is open and a count with a total beside it would be a lie
     * the data cannot support. Anything rendering this must not invent one.
     */
    settledWhenMade: boolean;
    caveat: string;
}

/**
 * What somebody with this much reach into the archives can find out.
 *
 * `depth` is how many separate accounts the asker can actually get to - a
 * village elder is one, a house with four hundred years of shelves is most of
 * them. Deliberately a COUNT rather than a probability, because who you ask is
 * a real question with a real answer, and rolling for it would put a second
 * lottery in front of the first one.
 *
 * The commonest outcomes surface first, which needs no rule: an outcome that
 * happens often is an outcome many people wrote about.
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
