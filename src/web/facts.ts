/**
 * Engine outcomes, rendered as English.
 */

import {
    CRIPPLING_UNTREATED_INJURIES,
    HP_RECOVERY_FRACTION_PER_DAY,
    stagnationYearsForOrdinal,
    type AmbientQi,
    BreakthroughResult,
    Cultivator,
    DeathCause,
    SimEvent,
    TimeSkipResult
} from '../schema/cultivation.js';
import { insightName } from '../engine/cultivation/understanding.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    headstoneStructure,
    whatTheStoneSays,
    type HeadstoneFacts
} from './headstone-reading.js';
import { LOW_SATIETY, lifespanCeilingFor } from '../engine/cultivation/survival.js';
import { physiqueOrNull } from '../engine/cultivation/physiques.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import type { GroundEntitlement } from '../engine/world/the-ground-somebody-is-actually-standing-on.js';
import type { AskWeight, AttemptResult, Wrong } from '../engine/social-leverage/index.js';
import { whatTheirRefusalIsLike } from '../engine/social-leverage/index.js';
import { howItHasBeenGoing } from './saying-what-an-ask-cost-and-how-likely-it-was.js';
import type { AdmissionReading } from '../data/cultivation/inheritance-trials.js';
import { aggregateInjuryPenalties, untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import { getSect } from '../data/cultivation/sects.js';
import type { ClaimVerdict } from '../engine/world/recognising-whose-art-you-just-watched.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { PLACE } from '../data/cultivation/place-names.js';

export interface EngineFacts {
    /** One-line summary. Used as the overlay title and the log's first line. */
    headline: string;
    /**
     * The complete factual content of the outcome, one statement per entry. This is
     * what a narrator is allowed to know. Nothing else is sent.
     */
    lines: string[];
    /**
     * The structural truth: governance, ladders, grades, ordinals, thresholds.
     */
    structure: string[];
    /** The deterministic rendering, ready to show a player as-is. */
    prose: string;
    /**
     * Lines the player MUST end up reading, whatever the narrator does.
     */
    required?: string[];
}

/**
 * Add a fact a caller learned AFTER the prose was composed, on every channel.
 */
export function sayThisWhateverTheNarratorDoes(facts: EngineFacts, said: string): void {
    facts.lines.push(said);
    facts.prose = facts.prose.length > 0 ? `${facts.prose}\n\n${said}` : said;
    (facts.required ??= []).push(said);
}

/**
 * A rung, named, with its ordinal kept beside it.
 */
export function rungAndOrdinal(ordinal: number): string {
    return `${rankName(ordinal)} (ordinal ${ordinal})`;
}

/** Build facts with an empty structure channel. Most outcomes have none. */
function observable(headline: string, lines: string[], prose: string, structure: string[] = []): EngineFacts {
    return { headline, lines, structure, prose };
}

// THE WORLD, AS THE ENGINE'S STATES MEAN IT The ambient table is the qi-density
// table. Qi is a resource that pools in spiritual veins and is not evenly
// distributed, so these strings say what a band means to live in rather than what
// it multiplies. They are what the narrator is given, so a model that has never
// seen context.md still cannot describe a spirit tide as scenery.

const AMBIENT_IN_WORLD: Record<AmbientQi, string> = {
    thin: 'Qi density thin: half cultivation rate, and a penalty to breakthrough odds. Drawn down long ago, or never rich.',
    normal: 'Qi density ordinary: no modifier either way. Inhabited land.',
    dense: 'Qi density dense: double cultivation rate, and a bonus to breakthrough odds. A vein near the surface, or ground nobody has worked.',
    spirit_tide: 'Qi density spirit tide: triple cultivation rate and the largest breakthrough bonus in the table. A vein shifting, a seal failing, a season turning over. Temporary.',
    sealed_vein: 'Qi density sealed vein: quadruple cultivation rate and a substantial breakthrough bonus. Never drawn on. Weight zero in the ambient roll - this is found, not encountered.'
};

/**
 * The same four states, as a person standing in them would experience them.
 */
const AMBIENT_PERCEIVED: Record<AmbientQi, string> = {
    thin: 'The air here gives very little back. A long sitting yields what a short one should, and everybody local has stopped remarking on it.',
    normal: 'The air here is unremarkable. It neither helps nor gets in the way, which is most places.',
    dense: 'The air here is thick enough to notice on the first breath. Whatever is under this ground is close to the surface, and the ground shows signs of being worked.',
    spirit_tide: 'The hair lifts on the arms. Breathing is easier than it was an hour ago, and it will not stay that way. Somewhere out of sight people are already moving.',
    // The whole economy of exploration, in one sensation. Nothing has breathed
    // this. It is the only air in the Late Age that is not second-hand, which
    // is why people die getting into rooms like this one.
    sealed_vein: 'The air in here has not been breathed. It is thicker than anything outside and it does not move, and the first lungful is enough to understand why people die getting into rooms like this.'
};

export const DEATH_IN_WORLD: Record<DeathCause, string> = {
    combat_defeat: 'killed in combat',
    obviously_fatal_choice: 'forced a fight while barely able to stand',
    lifespan_exhausted: 'lifespan exhausted - died of old age at the ceiling of the realm',
    // The figure is the RUNG'S, not fifty. `stagnationYearsForOrdinal` is max(50,
    // lifespan / 5), so fifty is only true through Foundation Establishment - it is
    // a hundred at Core Formation and twenty thousand at Tribulation Transcendence.
    // This entry said fifty to everybody, which made it a lie about most of the
    // ladder in the one sentence a player reads about their own death.
    // `describeDeathCause` takes the ordinal now and this row is a function of it,
    // the way `standingStructure` already does it.
    stagnation_aging: 'settled - the years this rung credits ran out, and the qi already inside them finished working on them instead',
    // RETIRED. Nothing produces this cause any more; the row is kept so a run
    // ledger written before the ruling still renders. See `docs/world/climbing/injuries.md`.
    untreated_injuries: 'the meridians gave out, untreated',
    starvation: 'starved - the flesh keeps its mortal arithmetic',
    failed_breakthrough: 'the meridians ruptured mid-breakthrough',
    qi_deviation: 'qi deviation',
    heavenly_tribulation: 'destroyed by heavenly tribulation'
};

/** Mechanical reading. Inspector and log only - never a narrator prompt. */
export function describeAmbientInWorld(ambient: AmbientQi): string {
    return AMBIENT_IN_WORLD[ambient];
}

/** What it is like to stand in it. The narration-safe rendering. */
export function describeAmbientPerceived(ambient: AmbientQi): string {
    return AMBIENT_PERCEIVED[ambient];
}

export function describeDeathCause(
    cause: DeathCause | null | undefined,
    /**
     * The rung they died at, where it is known. Only settling reads it, and
     * only to say how many years that rung actually credited - a figure that
     * ranges from fifty to twenty thousand across the ladder. Omitted, the
     * sentence stays true and simply does not quote a number.
     */
    atOrdinal?: number
): string {
    if (!cause) return 'cause unrecorded';
    const said = DEATH_IN_WORLD[cause] ?? cause.replace(/_/g, ' ');
    if (cause !== 'stagnation_aging' || atOrdinal === undefined) return said;
    return said.replace(
        'the years this rung credits',
        `the ${Math.round(stagnationYearsForOrdinal(atOrdinal)).toLocaleString('en-GB')} years this rung credits`
    );
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED FRAGMENTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the difference between two cultivators feels like from below.
 */
export function describeStanding(observerOrdinal: number, subjectOrdinal: number): string {
    const gap = subjectOrdinal - observerOrdinal;
    if (gap <= -13) return 'plainly beneath notice, and aware of it';
    if (gap <= -4) return 'noticeably slighter, and careful about it';
    if (gap < 0) return 'a little behind, near enough that it could go either way';
    if (gap === 0) return 'level, as far as anyone can tell from looking';
    if (gap <= 3) return 'somewhat ahead, and unhurried about proving it';
    if (gap <= 8) return 'far enough ahead that the difference is not a matter of effort';
    if (gap <= 16) return 'out of reach in a way that does not invite comparison';
    return 'so far above that the question of comparison does not arise, and they are not thinking about it either';
}

/**
 * Where a True Immortal is, which is not anywhere on the map.
 */
export const ABOVE_THE_LID_PLACE = 'the far side of the Lid';

export function placeName(
    cultivator: Pick<Cultivator, 'location'> & Partial<Pick<Cultivator, 'immortalStatus'>>
): string {
    // A True Immortal keeps whatever `location` row they had when they crossed,
    // because nothing clears it - and every surface that read it then reported
    // them as standing in a market town they left permanently.
    if ((cultivator.immortalStatus ?? 'none') === 'true_immortal') return ABOVE_THE_LID_PLACE;
    // The same const `STARTING_LOCATION` is built from, rather than a second
    // spelling of it: this fallback IS where a cultivator with no row started.
    return cultivator.location?.trim() || PLACE.BURNT_EARTH;
}

/** "10 years", "3 months", "18 days" - whichever unit reads plainest. */
export function humanDays(days: number): string {
    const d = Math.max(0, Math.round(days));
    if (d >= DAYS_PER_YEAR) {
        const years = d / DAYS_PER_YEAR;
        const shown = years >= 10 ? Math.round(years) : Math.round(years * 10) / 10;
        return `${shown} year${shown === 1 ? '' : 's'}`;
    }
    if (d >= 60) {
        const months = Math.round(d / 30);
        return `${months} month${months === 1 ? '' : 's'}`;
    }
    return `${d} day${d === 1 ? '' : 's'}`;
}

function signed(n: number, digits = 0): string {
    const v = Number(n.toFixed(digits));
    return v > 0 ? `+${v}` : `${v}`;
}

/**
 * How long they have stood here, said the way a person would say it.
 */
function timeHeldAtThisRealm(years: number): string {
    if (years < 1) {
        return years < 0.05
            ? 'Newly at this rung, with nothing yet spent standing on it.'
            : 'Under a year at this rung so far.';
    }
    if (years < 2) return 'A year at this realm without advancing.';
    // Whole years above that. The tenth of a year was never a decision anybody
    // made on this screen, and a run measured in centuries prints it forever.
    return `${Math.round(years)} years at this realm without advancing.`;
}

/**
 * What this body is, or null for almost everybody.
 */
function bodyLine(cultivator: Cultivator): string | null {
    const physique = physiqueOrNull(cultivator.physique);
    if (!physique) return null;
    return `${physique.name}: ${physique.tell}. `
        + `This body is finished at ${Math.round(lifespanCeilingFor(cultivator))} years `
        + `whatever else happens, which at this rung is `
        + `${Math.round(lifespanCeilingFor(cultivator) - cultivator.age)} from today.`;
}

/**
 * The player's own condition, as they experience it.
 */
export function standingLines(cultivator: Cultivator, ambient: AmbientQi): string[] {
    const untreated = untreatedInjuryCount(cultivator.injuries);
    const root = getSpiritRoot(cultivator.spiritRoot);
    return [
        `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}, in ${placeName(cultivator)}.`,
        `Spirit root: ${root.name}. Might ${cultivator.attributes.might}, Insight ${cultivator.attributes.insight}, Fortune ${cultivator.attributes.fortune}, Charm ${cultivator.attributes.charm}.`,
        // AND WHAT THE BODY IS, WHERE IT IS ANYTHING
        ...(bodyLine(cultivator) ? [bodyLine(cultivator) as string] : []),
        // THE BODY AND THE PURSE, SAID ONCE EACH.
        `${cultivator.hp >= cultivator.maxHp
            ? `Unmarked, ${cultivator.maxHp} of ${cultivator.maxHp}.`
            : `${cultivator.hp} of ${cultivator.maxHp} left in the body.`} `
        + `${cultivator.satiety >= 100 ? 'Fed.' : `Satiety ${cultivator.satiety} of 100.`} `
        + `${cultivator.spiritStones} spirit stone${cultivator.spiritStones === 1 ? '' : 's'} in the purse.`,
        // AND WHAT CARRYING THAT MANY ACTUALLY COSTS.
        untreated === 0
            ? 'The meridians are whole.'
            : untreated >= CRIPPLING_UNTREATED_INJURIES
                ? `${untreated} meridian injuries are open and nothing has closed them. `
                  + 'At this many the body has stopped mending itself, and it will not start again '
                  + 'until they are treated.'
                : `${untreated} meridian injur${untreated === 1 ? 'y has' : 'ies have'} been open `
                  + `since the day ${untreated === 1 ? 'it was' : 'they were'} taken, and nothing `
                  + `has closed ${untreated === 1 ? 'it' : 'them'}. `
                  + `At ${CRIPPLING_UNTREATED_INJURIES} the body stops mending itself altogether.`,
        timeHeldAtThisRealm(cultivator.yearsAtCurrentRealm),
        // WHOSE ROLL THEY ARE ON.
        cultivator.sectId
            ? `On the roll of ${sectNameFor(cultivator.sectId)}`
              + `${cultivator.sectRank ? `, ranked ${cultivator.sectRank}` : ''}.`
            : 'Serves no house. Nothing is owed to them and nothing is asked of them.',
        describeAmbientPerceived(ambient)
    ];
}

/**
 * A house's name from its id, falling back to the id itself.
 */
function sectNameFor(sectId: string): string {
    return getSect(sectId)?.name ?? sectId;
}

/**
 * The thresholds behind those numbers, as sentences.
 */
export function standingStructure(cultivator: Cultivator, ambient: AmbientQi): string[] {
    const untreated = untreatedInjuryCount(cultivator.injuries);
    const daysOpen = Math.max(0, Math.round(cultivator.bleedingTurns));
    const rateLost = Math.round(aggregateInjuryPenalties(cultivator.injuries).cultivationPenalty * 100);
    const settling = Math.round(stagnationYearsForOrdinal(cultivator.realmOrdinal));
    return [
        `Standing at ${rungAndOrdinal(cultivator.realmOrdinal)}, `
        + `on a ${getSpiritRoot(cultivator.spiritRoot).name}, `
        + (cultivator.foundationQuality === 'none'
            ? 'with no foundation laid.'
            : `on a ${cultivator.foundationQuality} foundation.`),
        // The count and what it is costing, as numbers, so the ruling panel
        // carries them rather than only the prose does. `daysUntilBleedOut` used
        // to ride here and was a countdown to a death that no longer happens;
        // how long the channels have been open is the true version of the same
        // fact and is what replaced it.
        `${untreated} untreated injur${untreated === 1 ? 'y' : 'ies'} of the `
        + `${CRIPPLING_UNTREATED_INJURIES} at which the body stops mending. The channels have `
        + `been open ${daysOpen} day${daysOpen === 1 ? '' : 's'} and are costing ${rateLost}% `
        + `of the cultivation rate. ${cultivator.yearsAtCurrentRealm.toFixed(1)} years held at `
        + `this rank of the ${settling} the ladder credits before settling.`,
        describeAmbientInWorld(ambient)
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// TIME SKIP
// ─────────────────────────────────────────────────────────────────────────

export function factsForTimeSkip(
    before: Cultivator,
    after: Cultivator,
    skip: TimeSkipResult,
    ambient: AmbientQi,
    label = 'Seclusion',
    /**
     * What the PLAYER asked for, where that is not what the skip was given.
     */
    askedForDays?: number,
    /**
     * The span the SENTENCE asked for, before the engine's own ceiling.
     */
    ceilingCutFrom?: number
): EngineFacts {
    const lines: string[] = [];
    const required: string[] = [];

    lines.push(`${label} at ${placeName(before)}. ${describeAmbientPerceived(ambient)}`);
    lines.push(
        skip.simulatedDays === skip.requestedDays
            ? `${humanDays(skip.requestedDays)} passed as asked.`
            : `${humanDays(skip.requestedDays)} was asked for; ${humanDays(skip.simulatedDays)} passed before something returned control.`
    );
    if (skip.interrupted && skip.interruptReason) {
        lines.push(`The engine stopped the skip: ${skip.interruptReason.replace(/[_:]/g, ' ')}.`);
    }

    for (const event of skip.events) {
        const line = `Day ${Math.round(event.dayOffset)}: ${event.summary}`;
        lines.push(line);
        // Why nothing is accumulating is not an incidental detail of a long
        // span: it is the only thing in the digest a player has to act on, and
        // it is the one a model reliably drops. `REQUIRED_EVENT_KINDS` names
        // the kinds that cannot be left out, and the check is on the kind
        // rather than on the wording so the engine may rewrite the sentence
        // without silently losing its guarantee.
        if (REQUIRED_EVENT_KINDS.has(event.kind)) required.push(line);
    }

    lines.push(netChangeLine(skip));
    lines.push(
        `Standing afterwards: ${rankName(after.realmOrdinal)}, age ${Math.floor(after.age)}, ` +
        `${untreatedInjuryCount(after.injuries)} untreated injuries, ${after.spiritStones} spirit stones.`
    );
    if (skip.died) {
        // Required. A player who is not told they are dead is not playing.
        const death = theDeathSentence(after.name, skip.deathCause, after.realmOrdinal);
        lines.push(death);
        required.push(death);
    }

    return {
        headline: timeSkipHeadline(skip, before, after),
        lines,
        structure: standingStructure(after, ambient),
        prose: timeSkipProse(before, after, skip, ambient, label, askedForDays, ceilingCutFrom),
        required
    };
}

/**
 * Event kinds whose line a player must end up reading.
 */
const REQUIRED_EVENT_KINDS: ReadonlySet<string> = new Set([
    'method_ceiling',
    'ground_ceiling',
    // `resource_depleted` is the food running out, and the engine files it WITH the
    // arithmetic attached - "there is food for about 50 more days, and 5 days
    // beyond that before it kills". The skip interrupts itself to file it precisely
    // because starvation must be a decision a player declined rather than one they
    // never got, and a decision they are not told about is one they never got. It
    // earns its place here by the same test as the two above: a player cannot act
    // without it.
    'resource_depleted'
]);

function netChangeLine(skip: TimeSkipResult): string {
    const d = skip.deltas;
    const parts = [
        `${signed(d.cultivationProgress)} progress`,
        `${signed(d.realmOrdinal)} rank${Math.abs(d.realmOrdinal) === 1 ? '' : 's'}`,
        `${signed(d.hp)} HP`,
        `${signed(d.spiritStones)} spirit stones`,
        `${signed(d.age, 1)} years of age`,
        `${d.injuriesGained} new injur${d.injuriesGained === 1 ? 'y' : 'ies'}`
    ];
    return `Net change: ${parts.join(', ')}.`;
}

function timeSkipHeadline(skip: TimeSkipResult, before: Cultivator, after: Cultivator): string {
    if (skip.died) return `${before.name} did not come out of it.`;
    if (skip.deltas.realmOrdinal > 0) return `${rankName(before.realmOrdinal)} to ${rankName(after.realmOrdinal)}.`;
    if (skip.interrupted) return `Seclusion broken after ${humanDays(skip.simulatedDays)}.`;
    return `${humanDays(skip.simulatedDays)} of seclusion, and nothing came for you.`;
}

/**
 * The zero-configuration account of a decade.
 */
function timeSkipProse(
    before: Cultivator,
    after: Cultivator,
    skip: TimeSkipResult,
    ambient: AmbientQi,
    label: string,
    askedForDays?: number,
    /** The sentence's own span, before MAX_CULTIVATION_DAYS took a bite. */
    ceilingCutFrom?: number
): string {
    const paragraphs: string[] = [];
    const where = placeName(before);

    // NOT EVERY SPAN IS SPENT SITTING DOWN.
    const travelling = /travel|journey|road|walk/i.test(label);
    const sentOut = /dut(?:y|ies)|commission|assignment|errand|mission|task|work|labour/i.test(label);
    const livedWithSomebody = /rais(?:e|ing)|child|marriage|household/i.test(label);

    const opening = travelling
        ? `${where}. ${before.name} took to the road.`
        : livedWithSomebody
            // The years still passed and the world still moved. What did not
            // happen is anybody sitting down to breathe.
            ? `${where}. ${before.name} put the years into it.`
        : sentOut
            // Not a place they settled into - a place they were sent to, and
            // the ground's own qi is beside the point for the duration.
            ? `${where}. ${before.name} went out to it.`
        : ambient === 'thin'
            ? `${where}. The qi is thin here; it always has been. ${before.name} sat down anyway.`
            : ambient === 'spirit_tide'
                ? `${where}. A tide was running when ${before.name} sat down, and for once the air gave more than it asked.`
                : ambient === 'dense'
                    ? `${where}. There is a vein under this ground, close enough to feel. ${before.name} sat down on top of it.`
                    : `${where}. ${before.name} sat down and began to breathe.`;
    // What was INTENDED is what the player asked for, not what the engine
    // decided to run after it had already shortened the span. Asking for five
    // years and reading "Seclusion of 2 years was intended" is the game telling
    // somebody their own intention, wrongly, and then never mentioning the
    // three years it removed - the "you came out early" line below cannot fire,
    // because both its figures come from the truncated span.
    const asked = askedForDays ?? skip.requestedDays;

    // THE CEILING, SAID RATHER THAN APPLIED IN SILENCE.
    //
    // Said first, because it is a correction to the player's own sentence and
    // everything below is about the span that was actually sat.
    if (ceilingCutFrom !== undefined && ceilingCutFrom > asked) {
        paragraphs.push(
            `${humanDays(ceilingCutFrom)} was asked for. The longest stretch this engine will `
            + `resolve in one sitting is ${humanDays(asked)}, and that is what was sat. `
            + 'Sit again when it ends.'
        );
    }

    paragraphs.push(`${opening} ${label} of ${humanDays(asked)} was intended.`);
    if (asked > skip.requestedDays) {
        paragraphs.push(
            `It was never going to be ${humanDays(asked)}. Something was already coming that `
            + `would end it at ${humanDays(skip.requestedDays)}, and the door was shut on that `
            + 'understanding whether or not anybody said so.'
        );
    }

    // "Nothing found you" is a claim about the whole stretch and this function can
    // only see half of it: the encounter layer's own occurrences arrive later,
    // appended by the caller. Where the span was shortened BEFORE the skip - `asked
    // > skip.requestedDays` - something demonstrably did find them, and saying
    // otherwise produced the flat contradiction a playtester reported: "Something
    // was already coming that would end it at 1.7 years" followed immediately by
    // "Nothing found you. 1.7 years went by in the ordinary way." The player
    // planned thirty years, got 1.7, and was told nothing happened, which is
    // strictly worse than either outcome.
    if (skip.events.length === 0 && asked > skip.requestedDays) {
        paragraphs.push(
            `${humanDays(skip.simulatedDays)} of it were quiet, and then the stretch ended `
            + 'because the thing that was coming arrived.'
        );
    } else if (skip.events.length === 0) {
        paragraphs.push(
            `Nothing found you. ${humanDays(skip.simulatedDays)} went by in the ordinary way.`
        );
    } else {
        const beats = skip.events.map(e => `${dayStamp(e)} - ${e.summary}`);
        paragraphs.push(beats.join('\n'));
    }

    if (skip.interrupted && !skip.died) {
        paragraphs.push(
            `You came out early. ${humanDays(skip.simulatedDays)} of the ${humanDays(skip.requestedDays)} were spent; the rest was not yours to spend.`
        );
    }

    const untreated = untreatedInjuryCount(after.injuries);
    const closing: string[] = [];
    closing.push(`You stand at ${rankName(after.realmOrdinal)}, ${Math.floor(after.age)} years old.`);
    if (skip.deltas.realmOrdinal > 0) {
        closing.push(
            `${skip.deltas.realmOrdinal} rank${skip.deltas.realmOrdinal === 1 ? ' was' : 's were'} ` +
            'gained in that stretch.'
        );
    }
    if (untreated > 0) {
        // Names the cure, for the same reason the bleed warning does: untreated
        // meridian injuries are the leading cause of death in this game and a
        // month under a physician closes them for a few stones a wound. The
        // sentence that told a player their wound was permanent stopped one
        // clause short of the sentence that saves the run.
        closing.push(
            `${untreated} meridian injur${untreated === 1 ? 'y is' : 'ies are'} still untreated, `
            + 'and nothing closes them on its own. A month under a physician does, in any '
            + 'settlement; a healing pill does it faster.'
        );
        // Past the threshold the sentence above stops being a warning and becomes a
        // countdown, and until now it read exactly the same at nine wounds as at
        // one. A playtested run went 1 to 3 to 9 across three stretches, gained no
        // ranks in any of them, and died of qi deviation at Qi Condensation Layer 3
        // - having been told the identical sentence each time. The engine already
        // knows this threshold and already says it on two other surfaces; it was
        // silent on the one the player is actually reading.
        if (untreated >= CRIPPLING_UNTREATED_INJURIES) {
            closing.push(
                `That is past ${CRIPPLING_UNTREATED_INJURIES}, so the body has stopped mending `
                + 'itself: what is open stays open, and every stretch from here adds to it '
                + 'rather than working it off.'
            );
        }
    }
    // HP that came back, said out loud. Rest is a real answer to being hurt -
    // the design owner's ruling, after a cultivator with zero injuries and
    // sixty years of lifespan left died of a three-point scratch that had been
    // sitting on their sheet since a previous seclusion. A player who cannot
    // see the mending has no reason to believe sitting still is worth anything.
    if (skip.deltas.hp > 0 && after.alive) {
        closing.push(
            after.hp >= after.maxHp
                ? `The body mended over that stretch: ${after.hp} of ${after.maxHp}, whole again.`
                : `The body mended ${skip.deltas.hp} of what it was carrying, and stands at `
                  + `${after.hp} of ${after.maxHp}.`
        );
    }
    if (skip.deltas.spiritStones !== 0) {
        closing.push(`Spirit stones: ${after.spiritStones}, a change of ${signed(skip.deltas.spiritStones)}.`);
    }
    if (after.satiety <= LOW_SATIETY && after.alive) {
        closing.push(`Satiety is down to ${after.satiety}. Qi feeds the meridians; it does not feed the body.`);
    }
    // The edge, marked. See `nearlyGone`: an empty belly has said so on this
    // surface for a long time and an empty body never has.
    if (nearlyGone(after)) {
        closing.push(theBodyIsNearlyGone(after, after.spiritStones));
    }
    paragraphs.push(closing.join(' '));

    if (skip.died) {
        // WORD FOR WORD what the `required` channel holds, and that is the whole
        // point of calling the same function.
        paragraphs.push(theDeathSentence(after.name, skip.deathCause, after.realmOrdinal));
    }

    return paragraphs.join('\n\n');
}

/**
 * How little is left in a body before the body is what the turn is about.
 */
export const NEARLY_GONE = 0.1;

/** Whether the body is close enough to the end that saying so is the turn. */
export function nearlyGone(who: Pick<Cultivator, 'hp' | 'maxHp' | 'alive'>): boolean {
    return who.alive && who.maxHp > 0 && who.hp <= Math.max(1, who.maxHp * NEARLY_GONE);
}

/**
 * The body, when there is almost none of it left.
 */
export function theBodyIsNearlyGone(
    who: Pick<Cultivator, 'hp' | 'maxHp'>,
    /**
     * What is in the purse, when the caller knows.
     */
    spiritStones?: number
): string {
    // Off the same constant the mending block runs on, so the figure cannot
    // drift from the thing it describes. A fraction of the POOL per day, which
    // is why this is computed per cultivator rather than stated once.
    const perDay = who.maxHp * HP_RECOVERY_FRACTION_PER_DAY;
    const backToWhole = perDay > 0
        ? humanDays(Math.ceil((who.maxHp - who.hp) / perDay))
        : null;

    return `There is almost nothing left in the body: ${who.hp} of ${who.maxHp}. Anything at all `
        + 'that lands from here finishes it. '
        + (backToWhole === null
            ? 'It comes back on its own, slowly.'
            : `It comes back on its own and it is slow: about ${backToWhole} of quiet to be whole `
              + 'again, and none of that happens on an empty belly - a stretch that runs out of '
              + 'food stops mending on the day it does. ')
        + (spiritStones === undefined
            ? 'A physician is the fast answer and costs stones.'
            : spiritStones < PHYSICIAN_IS_ROUGHLY
                ? `A physician would do it in a month and you are carrying ${spiritStones} `
                  + `stone${spiritStones === 1 ? '' : 's'}, which is not enough to be asked for. `
                  + 'Earning is the move before either of them.'
                : `A physician does it in a month, and at ${spiritStones} stones you can afford `
                  + 'to ask.');
}

/**
 * About what a settlement's physician wants to close a wound.
 */
const PHYSICIAN_IS_ROUGHLY = 10;

/**
 * That the cultivator is dead and the run will not continue, in one sentence.
 */
function theDeathSentence(name: string, cause: DeathCause | null | undefined, ordinal: number): string {
    return `${name} is dead: ${describeDeathCause(cause, ordinal)}. `
        + 'The run is closed. There is no reload.';
}

function dayStamp(event: SimEvent): string {
    const day = Math.round(event.dayOffset);
    if (day >= DAYS_PER_YEAR) {
        const years = Math.floor(day / DAYS_PER_YEAR);
        const rest = day - years * DAYS_PER_YEAR;
        return `Year ${years}${rest > 0 ? `, day ${rest}` : ''}`;
    }
    return `Day ${day}`;
}

// ─────────────────────────────────────────────────────────────────────────
// BREAKTHROUGH
// ─────────────────────────────────────────────────────────────────────────

export function factsForBreakthrough(
    before: Cultivator,
    after: Cultivator,
    result: BreakthroughResult,
    ambient: AmbientQi,
    /**
     * What arriving actually took out of the body, after the caller's clamp.
     */
    paidWithTheBody = 0
): EngineFacts {
    const lines: string[] = [];
    lines.push(`Breakthrough attempted from ${rankName(result.fromOrdinal)} toward ${rankName(Math.min(44, result.fromOrdinal + 1))}.`);
    lines.push(`Final chance ${(result.finalChance * 100).toFixed(1)}%; the roll was ${result.roll.toFixed(4)}.`);
    lines.push(`Modifiers: ${result.modifiers.map(m => `${m.source} ${signed(m.delta * 100, 1)}pp`).join(', ')}.`);
    lines.push(describeAmbientPerceived(ambient));
    lines.push(result.narrationHint);

    if (result.tribulation) {
        lines.push(
            `Heavenly tribulation: ${result.tribulation.strikes} strikes came down. ` +
            `${result.tribulation.survived ? 'Still standing at the end of them.' : 'Not standing at the end of them.'}`
        );
    }
    for (const injury of result.injuriesSustained) {
        lines.push(`Injury sustained: ${injury.description} (${injury.severity}, untreated).`);
    }
    lines.push(`Progress consumed: ${Math.round(result.progressConsumed)} qi-units.`);
    // Deliberately not explained. Whether something was cut away is carried by
    // the toll line the caller appends; the RULE that boundaries exact a price
    // is a thing the player works out by crossing one, not by being told.
    lines.push(
        `Standing afterwards: ${rankName(after.realmOrdinal)}, ${untreatedInjuryCount(after.injuries)} untreated injuries, ${Math.round(after.cultivationProgress)} progress remaining.`
    );

    return {
        headline: breakthroughHeadline(result, before),
        lines,
        // The prose half of a breakthrough was always right - "Breakthrough failed
        // at Qi Condensation Layer 6 at 85.0%. The qi dispersed without damage; a
        // quarter of the accumulated progress is gone." - and it is the standard
        // the rest of this channel was rewritten to match. The ROLL is the thing
        // only this line carries: it is what makes the odds checkable rather than
        // merely stated, which is the whole promise.
        structure: [
            `Outcome: ${result.outcome}. `
            + `${rungAndOrdinal(result.fromOrdinal)} to ${rungAndOrdinal(result.toOrdinal)}, `
            + `on a final chance of ${result.finalChance.toFixed(4)} against a roll of `
            + `${result.roll.toFixed(4)}. `
            + (isBoundaryCrossing(result)
                ? 'This was a crossing between realms rather than a step inside one.'
                : 'This was a step inside a realm rather than a crossing between two.'),
            ...standingStructure(after, ambient)
        ],
        prose: breakthroughProse(before, after, result, paidWithTheBody)
    };
}

function isBoundaryCrossing(result: BreakthroughResult): boolean {
    return result.modifiers.some(m => m.source === 'realm_boundary_strain');
}

function breakthroughHeadline(result: BreakthroughResult, before: Cultivator): string {
    switch (result.outcome) {
        case 'success': return `${rankName(result.fromOrdinal)} to ${rankName(result.toOrdinal)}.`;
        case 'death': return `${before.name} died striking the barrier.`;
        case 'failure_stable': return 'The barrier held. Nothing tore.';
        case 'failure_injured': return 'The barrier held, and something tore.';
        case 'failure_deviation': return 'The attempt collapsed into qi deviation.';
        case 'false_immortal': return `The Lid opened. ${before.name} did not go through it.`;
    }
}

function breakthroughProse(
    before: Cultivator,
    after: Cultivator,
    result: BreakthroughResult,
    paidWithTheBody: number
): string {
    const paragraphs: string[] = [];
    const odds = `${(result.finalChance * 100).toFixed(1)}%`;
    const boundary = isBoundaryCrossing(result);

    paragraphs.push(
        `${before.name} gathered what had been accumulated and struck at ${rankName(result.fromOrdinal)}. ` +
        `The engine put the odds at ${odds}${boundary ? ', across a realm boundary' : ''}. The roll came up ${result.roll.toFixed(4)}.`
    );

    if (result.tribulation) {
        paragraphs.push(
            result.tribulation.survived
                ? `${result.tribulation.strikes} strikes came down out of the seam. ${before.name} was still standing at the end of them.`
                : `${result.tribulation.strikes} strikes came down out of the seam, and ${before.name} was not standing at the end of them. What is left is a scar in the ground where the qi never returns.`
        );
    }

    paragraphs.push(result.narrationHint);

    if (result.injuriesSustained.length > 0) {
        paragraphs.push(
            result.injuriesSustained.map(i => i.description).join(' ') +
            ' Nothing about that heals on its own.'
        );
    }

    if (result.outcome === 'success') {
        paragraphs.push(
            boundary
                ? `You are ${rankName(after.realmOrdinal)}. Something was cut away on the way across, the way something always is at a boundary. You will notice what is missing later, or you will not, which is worse.`
                : `You are ${rankName(after.realmOrdinal)}. The step was expensive and it was only a step.`
        );
        // AND THE BODY IS LARGER THAN IT WAS
        if (after.maxHp > before.maxHp) {
            paragraphs.push(
                `The body it has to be carried in is larger than it was: ${before.maxHp} before, `
                + `${after.maxHp} now.`
                // WHERE THEY ARE STANDING IN IT IS SAID ONCE. With a body cost
                // charged, the sentence below reports the same figure after
                // subtracting from it, and the two together read as arithmetic
                // that does not close: "50 of that is what you are standing up
                // with", then "took 4 out of you [...] you stand at 50 of 54".
                // The cost sentence owns the standing whenever there is one.
                + (paidWithTheBody > 0
                    ? ' A rung does not fill the vessel it enlarges.'
                    : ` ${after.hp} of that is what you are standing up with. A rung does not `
                      + 'fill the vessel it enlarges.')
            );
        }
        // AND WHAT GETTING THROUGH TOOK
        if (paidWithTheBody > 0) {
            paragraphs.push(
                `Getting through it took ${paidWithTheBody} out of you, which leaves `
                + `${after.hp} of ${after.maxHp}. It is not a wound - nothing tore and there is `
                + 'nothing to treat - and it comes back the way anything comes back, which is '
                + 'slowly.'
                + (after.hp <= Math.max(1, after.maxHp * NEARLY_GONE)
                    ? ' There is very little of you left in it. Another wall struck from here is '
                      + 'a wall struck on nothing.'
                    : '')
            );
        }
    } else if (result.outcome !== 'death') {
        paragraphs.push(
            `You are still ${rankName(after.realmOrdinal)}, with ${Math.round(after.cultivationProgress)} qi-units left of what you had banked.`
        );
    }

    return paragraphs.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────
// FREE AND MINOR ACTIONS
// ─────────────────────────────────────────────────────────────────────────

export function factsForLook(
    cultivator: Cultivator,
    ambient: AmbientQi,
    company: Company = { named: [], strangers: [], total: 0 },
    /**
     * What belonging to something looks like from where they are standing.
     */
    standing: string | null = null,
    /**
     * Whether the ground under them has nothing wrong with it.
     */
    groundIsQuiet = true
): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    const where = placeName(cultivator);
    const who = describeCompany(company, cultivator.realmOrdinal);
    const noticed = selfNoticing(cultivator, groundIsQuiet);

    if (standing) lines.push(standing);
    if (who) lines.push(who);

    const prose = [
        `${where}. ${describeAmbientPerceived(ambient)}`,
        ...(standing ? [standing] : []),
        ...(who ? [who] : []),
        ...(noticed ? [noticed] : [])
    ].join('\n\n');

    return observable(`${where}.`, lines, prose, [
        ...standingStructure(cultivator, ambient),
        `${company.total} present: ${company.named.length} this cultivator can put a name to, `
        + `${company.strangers.length} they cannot.`
    ]);
}


/**
 * Who is about, asked directly.
 */
export function factsForCompany(
    cultivator: Cultivator,
    company: Company,
    standing: string | null = null
): EngineFacts {
    const where = placeName(cultivator);
    const who = describeCompany(company, cultivator.realmOrdinal)
        ?? 'Nobody is about. Whatever this place does with its people, it is not doing it here.';

    const lines = [who, ...(standing ? [standing] : [])];

    return observable(
        company.total === 0 ? `${where}, empty.` : `${company.total} about in ${where}.`,
        lines,
        lines.join('\n\n'),
        [
            `${company.total} present: ${company.named.length} this cultivator can put a name `
            + `to, ${company.strangers.length} they cannot.`
        ]
    );
}

/**
 * Who is standing here, split by whether the player can put a name to them.
 */
export interface Company {
    /** People the player has a knowledge record for. Nameable. */
    named: { name: string; ordinal: number }[];
    /** People they can see and cannot name. Described by standing only. */
    strangers: { ordinal: number }[];
    /** Everybody present, including whoever did not fit in the two lists. */
    total: number;
}

/** Sentence case, for clauses that may or may not land first. */
function capitalise(sentence: string): string {
    return sentence.length === 0 ? sentence : sentence[0].toUpperCase() + sentence.slice(1);
}

/** The most people a look names individually. A square, not a census. */
export const COMPANY_SHOWN = 4;

/**
 * How far above the player somebody has to stand to be worth singling out.
 */
const NOTABLE_GAP = 4;

/** "a dozen", "twenty-odd" - the way somebody actually counts a square. */
function roughly(n: number): string {
    if (n === 1) return 'one other person';
    if (n === 2) return 'two other people';
    if (n === 3) return 'three others';
    if (n <= 5) return 'a handful of people';
    if (n <= 9) return 'half a dozen people';
    if (n <= 14) return 'a dozen or so people';
    if (n <= 25) return 'twenty-odd people';
    return `${n} people`;
}

function describeCompany(company: Company, observerOrdinal = 0): string | null {
    if (company.total === 0) return null;

    // Every clause here is written to stand alone, and some of them start
    // with a count - "twenty-odd people are about". Joined after a full
    // stop that reads as a typo, so the join capitalises rather than each
    // clause guessing whether it will be first.
    const sentences: string[] = [];

    // Named first: these are the people the player has earned.
    const named = company.named.slice(0, COMPANY_SHOWN);
    if (named.length === 1) {
        sentences.push(`${named[0].name} is here.`);
    } else if (named.length > 1) {
        const last = named[named.length - 1].name;
        const rest = named.slice(0, -1).map(p => p.name).join(', ');
        sentences.push(`${rest} and ${last} are here.`);
    }

    // Everybody else is a crowd, with at most one figure lifted out of it -
    // and only when they are far enough above to be noticeable as such.
    const strangers = company.strangers;
    if (strangers.length > 0) {
        const deepest = strangers[0];
        const standsOut = deepest.ordinal - observerOrdinal >= NOTABLE_GAP;
        const others = standsOut ? strangers.length - 1 : strangers.length;

        // The crowd clause and the standout clause are both written for a plural,
        // and a square with one or two people in it is common - a thin county at
        // dawn is most of the early game. Found by playing: the second paragraph of
        // a new run read "One other person ARE about, none of whom are looking at
        // you", and then sent THE OTHERS moving around somebody who was the only
        // other person there.
        if (others === 1) {
            sentences.push('one other person is about, and they are not looking at you.');
        } else if (others > 1) {
            sentences.push(
                `${roughly(others)} are about, none of whom are looking at you.`
            );
        }
        // AND WHAT THE CROWD IS, WHICH IS THE HALF A MODEL INVENTED
        if (!standsOut && others > 1) {
            sentences.push(
                'none of them reads as anything out of the ordinary, and nothing about the way '
                + 'they carry themselves suggests otherwise.'
            );
        }
        if (standsOut) {
            const standing = describeStanding(observerOrdinal, deepest.ordinal);
            if (others === 0) {
                // Nobody else is here, so the sentence cannot borrow its weight
                // from how a crowd behaves around them. What is left is the one
                // observable thing, which is enough on its own.
                sentences.push(`the only other person here is ${standing}.`);
            } else if (others === 1) {
                sentences.push(
                    `a second is ${standing}, and the room the first leaves them ` +
                    'is the part worth noticing.'
                );
            } else {
                sentences.push(
                    `one of them is ${standing}, ` +
                    'and the way the others move around them is the part worth noticing.'
                );
            }
        }
    }

    return sentences.length > 0 ? sentences.map(capitalise).join(' ') : null;
}

/**
 * What a person notices about themselves without reciting their own numbers.
 */
function selfNoticing(cultivator: Cultivator, groundIsQuiet = true): string {
    const notes: string[] = [];
    const untreated = untreatedInjuryCount(cultivator.injuries);

    if (untreated >= CRIPPLING_UNTREATED_INJURIES) {
        // What somebody in this state would actually notice about themselves.
        const days = Math.max(0, Math.round(cultivator.bleedingTurns));
        notes.push(
            'Three things have gone wrong inside and none of them have closed. Standing up is a '
            + 'decision now, and nothing is knitting'
            + (days > 0 ? `; it has been like this for ${days} days.` : '.')
        );
    } else if (untreated === 1) {
        notes.push('Something opened a while ago and has stayed open.');
    } else if (untreated > 1) {
        notes.push(`${untreated} things have gone wrong inside and stayed wrong.`);
    }

    if (cultivator.starvationTurns > 0) {
        notes.push('There has been nothing to eat for long enough that it has stopped being uncomfortable and started being a clock.');
    } else if (cultivator.satiety <= 20) {
        notes.push('The hunger is back, and there is nothing here to answer it with.');
    }

    if (cultivator.spiritStones === 0) {
        notes.push('The purse folds flat.');
    } else if (cultivator.spiritStones < 10) {
        notes.push('What is left in the purse would not buy a season.');
    }

    if (cultivator.yearsAtCurrentRealm >= stagnationYearsForOrdinal(cultivator.realmOrdinal) * 0.7) {
        notes.push('It has been a very long time since anything moved, and the body has begun to have opinions about that.');
    } else if (cultivator.yearsAtCurrentRealm >= 5) {
        notes.push('Nothing has shifted in years.');
    }

    if (cultivator.hp < cultivator.maxHp * 0.4) {
        notes.push('Whatever happened last has not been slept off.');
    }

    if (notes.length > 0) return notes.join(' ');

    // AND THE DAY IS ONLY QUIET IF THE GROUND AGREES.
    if (!groundIsQuiet) return '';

    // Nothing is wrong, which still has to be said differently in different
    // places. This line is a constant on a quiet day, so a player walking
    // from one town to the next read the identical sentence twice and the
    // world stopped being two places. Keyed on where they are standing: the
    // same square on the same day reads the same, which is right, and two
    // squares do not.
    return QUIET_DAY[stableIndex(cultivator.location ?? '', QUIET_DAY.length)];
}

/**
 * Ways of saying that nothing is wrong.
 *
 * Not randomised - asking.md's rule about stable habits applies to the
 * whole world, not only to people. The same place always gets the same one.
 */
const QUIET_DAY: readonly string[] = [
    'Nothing about the day is urgent.',
    'The day asks nothing in particular.',
    'Nothing here is going wrong at any speed worth watching.',
    'It is an ordinary day and it intends to stay one.',
    'Nothing is pressing. That will not last, and it is not pressing yet.'
];

/** A stable index from a string. Same input, same answer, every run. */
function stableIndex(key: string, modulo: number): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100_003;
    return Math.abs(hash) % Math.max(1, modulo);
}

/**
 * What is still moving for somebody whose rank never will.
 */
function daoStandingLines(cultivator: Cultivator): string[] {
    const insights = cultivator.insights ?? [];
    if (insights.length === 0) {
        return [
            'The rank is finished and the dao is not. Nothing has been comprehended deeply ' +
            'enough to name yet, which at this height is the only shortfall left worth reporting.'
        ];
    }

    const depth = insights.reduce((sum, i) => sum + i.degree, 0);
    const deepest = insights.reduce((best, i) => (i.degree > best.degree ? i : best), insights[0]);
    return [
        `The rank is finished and the dao is not: ${insights.length} ` +
        `insight${insights.length === 1 ? '' : 's'} held, ${depth} degrees between them, ` +
        `deepest is ${insightName(deepest)}.`,
        'Understanding has no rung above it to be barred from. It is the one axis still open.'
    ];
}

export function factsForStatus(
    cultivator: Cultivator,
    ambient: AmbientQi,
    progressRequired: number | null,
    ready: boolean,
    /**
     * Why nothing is accumulating, when nothing is.
     */
    ceiling: string | null = null
): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    if (progressRequired === null) {
        // No figure, because there is no rung above this one priced in qi - handing
        // the narrator a number here would be handing it a lie. But saying only
        // that leaves somebody above the Lid with a status read that is entirely
        // absences, which is the opposite of the truth about them.
        lines.push('There is nothing above this rung that qi buys, so there is no figure to report.');
        lines.push(...daoStandingLines(cultivator));
    } else {
        lines.push(
            ready
                ? `Enough progress has accumulated to attempt the next rank: ${Math.round(cultivator.cultivationProgress)} of ${progressRequired} required.`
                : `${Math.round(cultivator.cultivationProgress)} of ${progressRequired} qi-units toward the next rank. Not yet eligible.`
        );
    }
    // Last, and required. A progress figure with no explanation attached is
    // worse than no figure: "0 of 100 toward the next rank" invites a player to
    // spend another decade on it, and the true answer is that no number of
    // decades will move it.
    if (ceiling !== null) lines.push(ceiling);

    return {
        headline: `${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}.`,
        lines,
        structure: [
            ...standingStructure(cultivator, ambient),
            `${Math.round(cultivator.cultivationProgress)} qi-units of the ${progressRequired} the `
            + `next rung is priced at${ready ? ', which is enough to attempt it' : ', which is not enough to attempt it'}.`
        ],
        prose: lines.join('\n'),
        ...(ceiling !== null ? { required: [ceiling] } : {})
    };
}

export function factsForTalk(cultivator: Cultivator, ambient: AmbientQi, target: string | undefined): EngineFacts {
    const who = target?.trim() || 'whoever is within earshot';
    const lines = [
        `${cultivator.name} spoke to ${who}. Words, and nothing that anyone will be able to point to later.`,
        ...standingLines(cultivator, ambient)
    ];
    return {
        headline: `A conversation with ${who}.`,
        lines,
        structure: [
            'No system resolved this: no trade, no sect standing, no relationship state changed.',
            ...standingStructure(cultivator, ambient)
        ],
        prose:
            `${cultivator.name} speaks to ${who}. Nothing in the world's ledgers moves for it - no stones change hands, no standing shifts, ` +
            `no one owes anyone anything they did not already owe. In ${placeName(cultivator)}, at ${rankName(cultivator.realmOrdinal)}, that is what most conversations are.`
    };
}

/**
 * Going somewhere.
 */
export function factsForMove(
    before: Cultivator,
    after: Cultivator,
    destination: string,
    intent: string,
    skip: TimeSkipResult,
    ambientBefore: AmbientQi,
    ambientAfter: AmbientQi
): EngineFacts {
    const base = factsForTimeSkip(before, after, skip, ambientBefore, 'Travel');
    const lines = [
        `${before.name} went from ${placeName(before)} to ${destination}. Manner of going: ${intent}. ` +
        `It took ${humanDays(skip.simulatedDays)}.`,
        'The engine resolved the movement itself; it did not resolve whether anyone was watching, ' +
        'pursuing, or waiting.',
        `At the destination: ${describeAmbientPerceived(ambientAfter)}`,
        ...base.lines
    ];

    // A JOURNEY SAYS WHERE IT ENDED, WHATEVER HAPPENED ON THE WAY
    const arrival =
        `${before.name} is in ${destination} now. ${describeAmbientPerceived(ambientAfter)}`;
    const prose = skip.events.length === 0 && !skip.died
        ? `${before.name} went out of ${placeName(before)} and into ${destination}. ` +
          `${describeAmbientPerceived(ambientAfter)} Nothing happened on the road, which is not the same as nothing being on it.`
        // Somebody who did not survive the road did not arrive on it, and
        // saying they are standing there would be the engine contradicting the
        // sentence it just filed.
        : skip.died
            ? base.prose
            : [base.prose, arrival].join('\n\n');

    return {
        ...observable(
            `${destination}.`, lines, prose,
            // The band names itself in the sentence `describeAmbientInWorld` opens
            // with - "Qi density thin", "Qi density sealed vein" - so the enum key
            // in front of it was the same word twice, once as a column value.
            [`The ground at ${destination}. ${describeAmbientInWorld(ambientAfter)}`, ...standingStructure(after, ambientAfter)]
        ),
        // For the same reason `factsForGather` carries it, and narrowed the same
        // way: a road is a spent stretch, it can starve somebody or finish them,
        // and `required` is the only channel that survives a model deciding the
        // arrival was the interesting part. `observable` has no slot for it, so
        // dropping it was silent - which is how it stayed dropped. Not
        // `base.required`: a journey is not a stretch spent cultivating either, and
        // the ceiling paragraph belongs to that one.
        required: whatTheStretchCostTheBody(after, skip)
    };
}

export function factsForEat(cultivator: Cultivator, satietyRestored: number, stonesSpent: number): EngineFacts {
    const lines = [
        `${cultivator.name} ate. Satiety restored by ${satietyRestored} to ${cultivator.satiety}/100; ` +
        `${stonesSpent} spirit stone${stonesSpent === 1 ? '' : 's'} spent, leaving ${cultivator.spiritStones}.`,
        'The hunger stops. It will come back.'
    ];
    return {
        headline: `Fed. ${cultivator.spiritStones} stones left.`,
        lines,
        // Why a cultivator still has to eat is a rule, and rules are learned by
        // living in them. The player finds out what a Grain Abstinence Pill is
        // for by wanting one, not by being told what it does.
        structure: [
            'Qi feeds the meridians, not the body. Satiety burns per turn-consuming action ' +
            'until a Grain Abstinence Pill removes the requirement.'
        ],
        prose:
            `A meal, bought for ${stonesSpent} spirit stone${stonesSpent === 1 ? '' : 's'}. The hunger stops, ` +
            'and a farmer sitting at the next table did the same thing for less.'
    };
}

/**
 * An action that did not happen.
 */
export function factsForRefusal(headline: string, scene: string, mechanical?: string): EngineFacts {
    return observable(headline, [scene], scene, mechanical ? [mechanical] : []);
}

// ─────────────────────────────────────────────────────────────────────────
// SEMANTIC ACTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * An examination.
 */
export function factsForInvestigation(
    cultivator: Cultivator,
    ambient: AmbientQi,
    subject: string,
    subjectFacts: readonly string[]
): EngineFacts {
    // NOBODY HAS TO BE ASKED FOR YOUR OWN AGE
    const looking = subject === cultivator.name;
    return {
        headline: `${subject}, examined.`,
        structure: standingStructure(cultivator, ambient),
        lines: [
            looking
                ? `${cultivator.name} took stock of themselves. Nothing was moved, spent or taken.`
                : `${cultivator.name} examined ${subject}. Nothing was moved, spent or taken; this was looking.`,
            ...subjectFacts,
            `Observed from ${placeName(cultivator)}.`,
            describeAmbientPerceived(ambient)
        ],
        prose: looking
            ? subjectFacts.join(' ')
            : [
                `${subject}. ${subjectFacts.join(' ')}`,
                'That is what the record holds. What it means is a separate question, and nobody in ' +
                `${placeName(cultivator)} is obliged to answer it.`
            ].join('\n\n')
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT WAS DONE TO THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** One thing that was done to a place, as a player standing on it can learn it. */
export interface PlaceChangeAccount {
    /** The year it landed. */
    year: number;
    /** The engine's factual statement of what was done. Never flavour. */
    summary: string;
    /**
     * Whether the true cause is on record anywhere in the world.
     */
    causeKnown: boolean;
    /** The cause, and only ever when {@link causeKnown} is true. */
    cause: string | null;
    /**
     * The explanations the people here hold. Belief, never truth: these are
     * stories attached to the ground, and two of them being incompatible is
     * the normal state of a place rather than a defect in the record.
     */
    attributed: readonly string[];
}

/** What a place was before anybody did anything to it. */
export interface PlaceOrigin {
    kind: string;
    year: number | null;
}

/** `sect_seat` is a column value. Nobody standing in one calls it that. */
function plainKind(kind: string): string {
    return kind.replace(/_/g, ' ').trim() || 'ground';
}

/** The same, with its article, for the middle of a sentence. */
function aKind(kind: string): string {
    const plain = plainKind(kind);
    return /^[aeiou]/i.test(plain) ? `an ${plain}` : `a ${plain}`;
}

/**
 * What a place is, what was done to it, and what the people here say about why.
 */
export function factsForPlaceHistory(
    place: { name: string; kind: string; description: string },
    origin: PlaceOrigin | null,
    changes: readonly PlaceChangeAccount[]
): EngineFacts {
    const now = `${place.name} is ${aKind(place.kind)}.`
        + (place.description.trim() ? ` ${place.description.trim()}` : '');

    if (changes.length === 0) {
        const lines = [
            now,
            'Nothing has been done to this ground that anybody kept. It is what it was, and the '
            + 'people here have never had cause to explain it to anybody.'
        ];
        return {
            headline: `${place.name}, as it has always been.`,
            lines,
            structure: ['location history: origin only, no changes on record.'],
            prose: lines.join('\n\n')
        };
    }

    const latest = changes[0];
    const lines = [now];

    if (origin && plainKind(origin.kind) !== plainKind(place.kind)) {
        lines.push(
            `It was ${aKind(origin.kind)} before that`
            + (origin.year !== null && origin.year > Number.NEGATIVE_INFINITY
                ? `, from about the year ${origin.year.toLocaleString()}.`
                : '.')
        );
    }

    for (const change of changes) {
        lines.push(`In the year ${change.year.toLocaleString()}: ${change.summary}`);
    }

    if (latest.causeKnown && latest.cause) {
        lines.push(`Why is not in dispute here. ${latest.cause}`);
    } else if (latest.attributed.length > 0) {
        lines.push(
            'Nobody here can tell you why. What they can tell you is that they do not agree '
            + 'about it, and they have not for a long time.'
        );
        for (const held of latest.attributed) {
            lines.push(`One account has it: ${held}.`);
        }
    } else {
        lines.push(
            'Nobody here can tell you why. There is no story about it either - the people who '
            + 'would have carried one are not the people standing here.'
        );
    }

    return {
        headline: `${place.name}: ${latest.summary.slice(0, 90)}`,
        lines,
        // Deliberately no cause fact id, in either direction. The inspector is
        // a surface a player can read, and an id appearing there for a cause
        // the world has not surrendered is the leak this whole path is built
        // to avoid.
        structure: changes.map((c, i) =>
            `Change ${i + 1} of ${changes.length}, in the year ${c.year.toLocaleString()}: `
            + (c.causeKnown
                ? 'the cause is settled and the record here carries it'
                : 'the cause is not settled here')
            + `, and ${c.attributed.length} explanation(s) are held locally.`),
        prose: lines.join('\n\n')
    };
}

/**
 * An attempted interaction.
 */
export function factsForInteraction(
    cultivator: Cultivator,
    subject: string,
    intent: string,
    subjectFacts: readonly string[],
    unresolved: string
): EngineFacts {
    // `intent` is a label the parser wrote, and it belongs to the inspector.
    // Reading it back as prose produced "The intent is follow.", which is the
    // engine telling the player what the engine thinks the player meant - and
    // then, a paragraph later, "What comes of it is not settled. Nothing is
    // settled by it.", which is the same sentence twice.
    return {
        headline: `${subject}, approached.`,
        structure: [`Stated intent: ${intent}. Carried for the narrator; read by no conditional.`],
        lines: [
            `${cultivator.name} went to ${subject}.`,
            ...subjectFacts,
            unresolved
        ],
        prose: [
            `${cultivator.name} goes to ${subject}.`,
            subjectFacts.join(' '),
            unresolved
        ].join('\n\n')
    };
}

/**
 * An action the engine genuinely cannot resolve yet.
 */
export function factsForUnsupported(attempt: string, missing: string): EngineFacts {
    return observable(
        'Nothing comes of it.',
        ['Whatever was intended, nothing followed from it. No time passed and nothing was spent.'],
        'Whatever was intended, nothing followed from it. No time passed and nothing was spent.',
        [`Unresolvable: ${attempt}. ${missing}`]
    );
}

/**
 * A result handed back by one of the MCP tool handlers, which are the same
 * engine paths the tool surface uses. Their `narrationHint` is engine-authored,
 * so it goes through unchanged.
 */
export function factsForToolResult(
    headline: string,
    lines: readonly string[],
    prose?: string
): EngineFacts {
    return observable(headline, [...lines], prose ?? lines.join('\n'));
}

// WHAT THIS CULTIVATOR IS CARRYING

/** One thing the holder is carrying, as they hold it. */
export interface HeldFact {
    name: string;
    /** What they take it to be. Never what it is. */
    statement: string;
    /** `knows`, `believes`, `suspects` - how firmly, in the engine's words. */
    stance: string;
    /** How it reached them: witnessed, told, overheard. */
    sourceKind: string;
    sourceNote: string;
    acquiredOnDay: number;
    /**
     * Anything further the holder has genuinely earned about it, from the same
     * scoped resolver `investigate` uses. Empty unless they hold it firmly -
     * having overheard a word in a market buys the word and nothing else.
     */
    earned: readonly string[];
}

/** How firmly somebody holds a thing, said the way they would say it. */
function stancePhrase(stance: string): string {
    if (stance === 'knows') return 'You are sure of that much.';
    if (stance === 'believes') return 'You take it to be so.';
    return 'You would not put money on it.';
}

/** How it reached them, said as the moment rather than as a column value. */
function sourcePhrase(sourceKind: string): string {
    if (sourceKind === 'witnessed') return 'You were there for it.';
    if (sourceKind === 'told') return 'Somebody said it to you.';
    if (sourceKind === 'overheard') return 'You were not meant to hear it.';
    if (sourceKind === 'inferred') return 'Nobody told you; you put it together.';
    return 'Where it came from is not clear even to you.';
}

/**
 * The same two columns for the structure channel, which wants the distinction
 * exactly and does not want it in the second person.
 */
function heldFirmness(stance: string): string {
    if (stance === 'knows') return 'held as known';
    if (stance === 'believes') return 'held as believed';
    if (stance === 'suspects') return 'held as suspected';
    return `held as ${stance.replace(/_/g, ' ')}`;
}

function heldRoute(sourceKind: string): string {
    if (sourceKind === 'witnessed') return 'witnessed first-hand';
    if (sourceKind === 'told') return 'told to them directly';
    if (sourceKind === 'overheard') return 'overheard';
    if (sourceKind === 'inferred') return 'inferred, and told to them by nobody';
    return `arrived by ${sourceKind.replace(/_/g, ' ')}`;
}

/**
 * What the holder has on one name.
 */
export function factsForRecall(
    cultivator: Cultivator,
    asked: string,
    held: readonly HeldFact[]
): EngineFacts {
    if (held.length === 0) {
        // Worded so it does not confirm anything either way. A name the world
        // has never used and a name the world uses constantly, three provinces
        // from here, have to read identically from inside this head - the
        // shape of the answer must not be the answer.
        return factsForRefusal(
            'Nothing comes back.',
            `You turn "${asked}" over and it does not connect to anything you are carrying. `
            + 'It is not that you have forgotten. Nobody has ever said it in front of you.',
            `No knowledge record held by ${cultivator.name} matches "${asked}". The catalogs were `
            + 'not consulted: this read touches the holder\'s own rows and nothing else, so an '
            + 'unheard name and an invented one are indistinguishable here by construction.'
        );
    }

    const lines: string[] = [
        held.length === 1
            ? `One thing, and it is thin.`
            : `${held.length} separate things, and nothing joins them up.`
    ];

    for (const fact of held) {
        // The record's own sentence, unaltered. For a name that was merely
        // overheard that is "a name that got said. What it is remains
        // unknown", and the thinness is the accurate answer rather than a gap
        // for this renderer to fill in.
        lines.push(`${fact.statement} ${stancePhrase(fact.stance)}`);
        lines.push(`${sourcePhrase(fact.sourceKind)}${fact.sourceNote ? ` ${fact.sourceNote}` : ''}`);
        for (const earned of fact.earned) lines.push(earned);
    }

    if (held.length > 1) {
        // Said plainly, because it is true and because the alternative is the
        // player assuming the engine would have told them if they were the
        // same thing.
        lines.push(
            'Whether any of them are the same thing is not something you know. Nobody has ever '
            + 'put them side by side for you, and they do not sit together on their own.'
        );
    }

    return {
        headline: held.length === 1 ? `${held[0].name}, and not much of it.` : `${held.length} fragments.`,
        structure: held.map(fact =>
            `"${fact.name}", ${heldFirmness(fact.stance)}, ${heldRoute(fact.sourceKind)}, `
            + `on day ${fact.acquiredOnDay}. `
            + (fact.earned.length === 0
                ? 'Nothing further is earned on it.'
                : `${fact.earned.length} further line(s) earned on it.`)),
        lines,
        prose: lines.join('\n\n')
    };
}

/** Everything the holder has ever heard of, counted rather than listed out. */
export function factsForHolding(
    cultivator: Cultivator,
    held: ReadonlyArray<{ kind: string; name: string }>
): EngineFacts {
    if (held.length === 0) {
        return factsForRefusal(
            'Almost nothing.',
            'You go through what you have ever actually been told and find that it comes to very '
            + 'little. You know where you are from. Past that, the world is a rumour you have not '
            + 'heard yet.',
            `${cultivator.name} holds no knowledge records at all.`
        );
    }

    // ONE ENTRY PER NAME, not one per record.
    const byKind = new Map<string, string[]>();
    for (const row of held) {
        if (!byKind.has(row.kind)) byKind.set(row.kind, []);
        const names = byKind.get(row.kind)!;
        if (!names.includes(row.name)) names.push(row.name);
    }
    const distinct = [...byKind.values()].reduce((n, names) => n + names.length, 0);

    const lines = [`${distinct} names, and a name is most of what any of them is.`];
    for (const [kind, names] of byKind) {
        lines.push(
            `${kind === 'cultivator' ? 'People' : kind === 'sect' ? 'Houses' : kind === 'place' ? 'Places' : 'Things that happened'}: `
            + `${names.join(', ')}.`
        );
    }
    lines.push(
        'That is the whole of it. Most of these you could not say a second sentence about, and the '
        + 'world does not stop to explain itself to somebody who did not already know.'
    );

    return {
        headline: `${distinct} names.`,
        structure: [
            `knowledge records held: ${held.length} across ${byKind.size} kind(s), `
            + `${distinct} distinct names.`
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * The other axis.
 */
export function factsForDao(
    cultivator: Cultivator,
    dao: {
        standing: string;
        name: string | null;
        subject: string | null;
        depth: number;
        breadth: number;
    },
    panel: {
        insights: ReadonlyArray<{ name: string; domain: string; degree: number; universal: boolean }>;
        totalDegrees: number;
        cultivationMultiplier: number;
        breakthroughModifier: number;
        theOnlyAxisLeft: boolean;
    }
): EngineFacts {
    const lines: string[] = [];

    if (panel.insights.length === 0) {
        lines.push(
            `${cultivator.name} has comprehended nothing anybody would write down. That is the `
            + 'ordinary case and it is not a failure - most people live and die having understood '
            + 'nothing in particular, and it costs them nothing until the day it costs them '
            + 'everything.'
        );
    } else {
        lines.push(
            dao.standing === 'dao' && dao.name
                ? `You walk ${dao.name}. It is a road rather than a thing you know, which is the `
                  + 'difference the word is for.'
                : dao.standing === 'leaning' && dao.subject
                    ? `You lean toward ${dao.subject}, and have for long enough that other people `
                      + 'would say so before you did. It is not a road yet.'
                    : 'You have understood some things. None of them has become the thing you are.'
        );
        for (const insight of panel.insights) {
            lines.push(
                `${insight.name}, at degree ${insight.degree}`
                + (insight.universal ? ', which bears on everything rather than on one craft.' : '.')
            );
        }
        lines.push(
            `What it is worth, standing still: cultivation runs at ${panel.cultivationMultiplier.toFixed(2)} `
            + `times, and a crossing goes ${panel.breakthroughModifier >= 0 ? 'better' : 'worse'} by `
            + `${Math.abs(panel.breakthroughModifier * 100).toFixed(1)} in the hundred.`
        );
    }

    if (panel.theOnlyAxisLeft) {
        lines.push(
            'The ladder is finished for you and does not open twice. This does not finish. It is '
            + 'the only thing a span this long can be spent on, and it has no ceiling anybody has '
            + 'found.'
        );
    }

    return {
        headline: dao.name
            ? `${dao.name}.`
            : panel.insights.length === 0 ? 'Nothing comprehended.' : `${panel.insights.length} things understood.`,
        structure: [
            `Standing on the comprehension axis: ${dao.standing}`
            + `${dao.subject ? `, on ${dao.subject}` : ', on no subject'}. Depth ${dao.depth} `
            + `and breadth ${dao.breadth}, over ${panel.totalDegrees} degree`
            + `${panel.totalDegrees === 1 ? '' : 's'} of insight in total. `
            + (panel.theOnlyAxisLeft
                ? 'Comprehension is the only axis left to them, read off the same predicate '
                  + 'that gates a re-attempt.'
                : 'Comprehension is not the only axis left to them, read off the same '
                  + 'predicate that gates a re-attempt.')
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * A course of mortal care, bought and taken.
 */
export function factsForTreatment(
    before: Cultivator,
    after: Cultivator,
    course: {
        what: string;
        note: string;
        cashEach: number;
        stonesEach: number;
        stonesSpent: number;
        days: number;
        treated: readonly string[];
        stillUntreated: number;
        /** HP the stay put back. Zero is legal and says so. */
        mended?: number;
    }
): EngineFacts {
    const lines = [
        // "0 courses of Splint" is not a sentence anybody would say. A stay
        // with no meridians in it is a stay, and it is what somebody who is
        // battered rather than torn is actually buying.
        course.treated.length === 0
            ? `${before.name} paid ${course.stonesSpent} spirit `
              + `stone${course.stonesSpent === 1 ? '' : 's'} to be kept, fed and looked at for a `
              + `month. ${after.spiritStones} left in the purse.`
            : `${before.name} paid for ${course.treated.length === 1 ? 'a course' : `${course.treated.length} courses`} `
              + `of ${course.what}: ${course.cashEach} cash each, which is ${course.stonesEach} spirit `
              + `stone${course.stonesEach === 1 ? '' : 's'}, ${course.stonesSpent} in all. `
              + `${after.spiritStones} left in the purse.`,
        course.note,
        `${humanDays(course.days)} went by lying still.`
    ];

    // The body, which is a different thing from a meridian. A wound does not
    // mend on its own and a body does, under care - see the long note in
    // `GameService.treat` for why that is a decision rather than a constant.
    if (course.mended !== undefined && course.mended > 0) {
        lines.push(
            `${course.mended} of what the body was missing came back. `
            + `${after.hp} of ${after.maxHp} now, and a month of being kept is the whole of why.`
        );
    }

    if (course.treated.length === 0) {
        lines.push('Nothing closed. The month was spent and the meridians are where they were.');
    } else {
        // THE SAME WOUND, DESCRIBED ONCE.
        const counted = new Map<string, number>();
        for (const description of course.treated) {
            counted.set(description, (counted.get(description) ?? 0) + 1);
        }
        for (const [description, howMany] of counted) {
            lines.push(
                howMany === 1
                    ? `Closed: ${description} It is scar tissue now, and scar tissue costs nothing.`
                    : `Closed, ${howMany} of them, and all the same: ${description} `
                      + 'They are scar tissue now, and scar tissue costs nothing.'
            );
        }
    }

    lines.push(
        course.stillUntreated === 0
            ? 'Nothing is still open. Whatever else is wrong, it is not a wound any more.'
            : `${course.stillUntreated} still untreated, and nothing heals those on its own either.`
    );

    return {
        headline: course.treated.length === 0
            ? (course.mended ?? 0) > 0
                ? 'Back on your feet.'
                : 'The month bought nothing.'
            : `${course.treated.length} wound${course.treated.length === 1 ? '' : 's'} closed.`,
        structure: [
            `treatment: ${course.treated.length} treated at ${course.stonesEach} stone(s) each, `
            + `${course.stonesSpent} spent, ${course.stillUntreated} untreated remaining. `
            + 'Triage was the engine\'s, worst wound first.'
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

// INHERITANCE GROUNDS

/**
 * A site as somebody standing outside it has it.
 */
export interface SiteFace {
    /** Null where this cultivator's awareness does not permit naming it. */
    name: string | null;
    kind: 'trial' | 'grave';
    marker: string;
    /** Empty below `named`, because a rumour is how a name reaches somebody. */
    rumour: string;
    attributedTo: string | null;
    lastPartySaid: string | null;
    whatAKnowledgeablePartyReads: string;
    whatAnIgnorantPartyConcludes: string;
    /** The number in the rumour, which is not the number in the room. */
    advertisedOrdinal: number | null;
    /**
     * Graves only. Legible from the marker, and the whole of the useful read.
     */
    grave: HeadstoneFacts | null;
}

/** How a site is referred to when the player cannot name it. */
function siteHead(face: SiteFace): string {
    return face.name ?? (face.kind === 'grave' ? 'A grave nobody has attributed' : 'An unattributed site');
}

/**
 * Everything that can be learned without going in, and nothing else.
 */
export function factsForSiteFace(
    cultivator: Cultivator,
    face: SiteFace,
    arriving: boolean
): EngineFacts {
    const head = siteHead(face);
    const lines = [
        arriving
            ? `${cultivator.name} came to ${head} and stopped at the threshold.`
            : `${cultivator.name} read ${head} from outside it. Nothing was opened and nothing was entered.`,
        face.marker
    ];

    // WHAT CULTIVATION LEVEL IS THE EXPERT
    if (face.grave) lines.push(...whatTheStoneSays(face.grave));
    if (face.rumour) lines.push(face.rumour);
    if (face.attributedTo) lines.push(`It is put down to ${face.attributedTo}.`);
    if (face.lastPartySaid) lines.push(face.lastPartySaid);
    lines.push(face.whatAKnowledgeablePartyReads);
    lines.push(face.whatAnIgnorantPartyConcludes);
    lines.push(
        'That is the outside. What is behind it is behind it, and the only way to find out is to '
        + 'go in, which is a separate thing to decide.'
    );

    return {
        headline: arriving ? `${head}, reached.` : `${head}, from outside.`,
        structure: [
            `A ${face.kind}, which this cultivator\'s awareness `
            + `${face.name !== null ? 'does permit naming' : 'does not permit naming'}. `
            + (face.advertisedOrdinal === null || face.advertisedOrdinal === undefined
                ? 'Nothing advertises what rung it was built for.'
                : `It is advertised as built for ${rungAndOrdinal(face.advertisedOrdinal)}, `
                  + 'which is the rumour\'s number and not the room\'s - three entries in the '
                  + 'catalog disagree with their own interior on purpose.'),
            'Pre-entry view only. The interior was not read: this renderer has no field that could hold it.',
            // The band the marker implies, by name and by number, off the same
            // table the entries were authored from. Nothing had ever read it.
            ...(face.grave ? [headstoneStructure(face.grave)] : [])
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * What this cultivator could name, when they named none.
 */
export function factsForSiteListing(
    cultivator: Cultivator,
    /**
     * Trial and grave are the authored catalog's two kinds; ground the world
     * found carries its own character instead - a vault, a compound, a cave -
     * so this is a string rather than the union it used to be.
     */
    known: ReadonlyArray<{ name: string; kind: string }>
): EngineFacts {
    if (known.length === 0) {
        return factsForRefusal(
            'No ground you know of.',
            'You go over what you have ever been told about ground worth opening, and there is '
            + 'nothing in it. Somebody would have to have said one in front of you, and nobody has.',
            'No site in the catalog is nameable by this cultivator: awareness below `named` on all of them.'
        );
    }

    const graves = known.filter(k => k.kind === 'grave').length;
    const lines = [
        known.length === 1
            ? `There is one you have a name for: ${known[0].name}.`
            : `The ones you have names for are ${known.slice(0, -1).map(k => k.name).join(', ')} `
              + `and ${known[known.length - 1].name}.`,
        'Knowing a name is not a map. None of them is anywhere in particular as far as you are '
        + 'concerned, and getting to one is its own sentence.'
    ];

    return {
        headline: `${known.length} you could put a name to.`,
        structure: [
            `site listing: ${known.length} nameable by ${cultivator.name}, of which `
            + `${graves} grave(s). Filtered by awareness rather than by distance - the authored `
            + 'catalog holds no locations. Ground the world found carries its own character as '
            + 'its kind, and its own structure lines below this one.'
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * The inside, once the engine has recorded that somebody walked in.
 */
export function factsForSiteInterior(
    cultivator: Cultivator,
    name: string,
    interior: {
        /** The room, physically. `chamber` on a trial, `scene` on a grave. */
        scene: string;
        /**
         * Who arranged it and for whom. A trial says so directly; a grave has
         * no answer to that question and gives the other one it does have -
         * what the manner of death did to what is lying there - which is the
         * whole difference between the two kinds and is worth keeping visible.
         */
        arrangement: string;
        /** What the place does to people who come in. */
        whatItDoesToPeople: string;
        /** What is here to be taken, as the catalog describes it. */
        onOffer: readonly string[];
        /** Set only where somebody has already taken it. */
        afterwards: string | null;
    }
): EngineFacts {
    const lines = [
        `${cultivator.name} went into ${name}.`,
        interior.scene,
        interior.arrangement,
        interior.whatItDoesToPeople
    ];

    if (interior.afterwards) {
        lines.push(interior.afterwards);
    } else if (interior.onOffer.length > 0) {
        lines.push(...interior.onOffer);
        lines.push('It is all still here. Taking it is a separate act and it is the last one.');
    } else {
        lines.push('There is nothing here anybody could carry out.');
    }

    return {
        headline: `${name}, inside.`,
        structure: [
            `site entered: interior read for the first time this run. ${interior.onOffer.length} `
            + `item(s) on offer; ${interior.afterwards ? 'already taken by somebody.' : 'untaken.'}`
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * A door that did not open, and which of the three questions it was asking.
 */
export function factsForGateRefused(
    cultivator: Cultivator,
    name: string,
    verdict: { kind: 'strength' | 'age_and_talent' | 'fate'; account: readonly string[]; shortfall: string | null },
    spent: string
): EngineFacts {
    const opening = verdict.kind === 'fate'
        ? `${cultivator.name} went in, and ${name} did not open. There is no reading of this in `
          + 'which something was lacking. The door is not asking about the person standing at it.'
        : verdict.kind === 'strength'
            ? `${cultivator.name} went in, and ${name} is set at an ordinal they are not at.`
            : `${cultivator.name} went in, and ${name} wanted something that is not power.`;

    const lines = [opening, ...verdict.account];
    if (verdict.shortfall) lines.push(`Short by: ${verdict.shortfall}.`);
    lines.push(spent);

    return {
        headline: verdict.kind === 'fate'
            ? `${name}: it did not open.`
            : `${name}: refused at the ${verdict.kind === 'strength' ? 'strength' : 'talent'} gate.`,
        structure: [`gate kind ${verdict.kind}; shortfall ${verdict.shortfall ?? 'not applicable'}.`],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * What actually left the site.
 */
export function factsForSiteTaken(
    cultivator: Cultivator,
    name: string,
    outcome: {
        granted: readonly string[];
        withheld: readonly string[];
        other: readonly string[];
        afterwards: string;
    }
): EngineFacts {
    const lines = [`${cultivator.name} took what was behind the door at ${name}.`];

    if (outcome.granted.length > 0) {
        lines.push(`Carried out and learned: ${outcome.granted.join(', ')}.`);
    }
    for (const line of outcome.withheld) lines.push(line);
    for (const line of outcome.other) lines.push(line);
    if (outcome.granted.length === 0 && outcome.other.length === 0 && outcome.withheld.length === 0) {
        lines.push('There was nothing here that would come away with anybody.');
    }
    lines.push(outcome.afterwards);

    return {
        headline: `${name}: taken.`,
        structure: [
            `site taken: ${outcome.granted.length} art(s) learned, ${outcome.withheld.length} refused `
            + `by the engine, ${outcome.other.length} thing(s) with no catalog entry. Recorded against `
            + 'the site, so the next party finds it emptied.'
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * What a spent stretch did to the body, in the words the digest uses.
 */
function whatTheStretchCostTheBody(after: Cultivator, skip: TimeSkipResult): string[] {
    const said: string[] = [];
    // The pack running dry, which is the same class of fact as the belly and
    // the death and was the only one of the three this dropped. The event
    // carries its own arithmetic - how many days of food are left and how many
    // days past that are fatal - so it is quoted rather than paraphrased.
    for (const event of skip.events) {
        if (event.kind === 'resource_depleted') said.push(event.summary);
    }
    if (after.satiety <= LOW_SATIETY && after.alive) {
        said.push(`Satiety is down to ${after.satiety}. Qi feeds the meridians; it does not feed the body.`);
    }
    if (nearlyGone(after)) said.push(theBodyIsNearlyGone(after, after.spiritStones));
    if (skip.died) said.push(theDeathSentence(after.name, skip.deathCause, after.realmOrdinal));
    return said;
}

/** A stretch of foraging, and whatever the ground gave up. */
export function factsForGather(
    before: Cultivator,
    after: Cultivator,
    skip: TimeSkipResult,
    ambient: AmbientQi,
    found: { name: string; grade: string; value: number } | null
): EngineFacts {
    const base = factsForTimeSkip(before, after, skip, ambient, 'Foraging');
    const outcome = found
        ? `Found and pouched: one ${found.name}, ${found.grade} grade, worth about ${found.value} spirit stones.`
        : 'Nothing worth carrying. The ground here has been worked over already, the way most ground has.';
    const cost = whatTheStretchCostTheBody(after, skip);

    return {
        // A headline about a mushroom, over an answer that says the person
        // holding it is dead, is the same defect one line up.
        headline: skip.died
            ? `${before.name} did not come back off the ground.`
            : found ? `${found.name}, pouched.` : 'Nothing worth carrying.',
        structure: base.structure,
        lines: [
            `${before.name} spent ${humanDays(skip.simulatedDays)} working the ground around ${placeName(before)}.`,
            outcome,
            ...base.lines
        ],
        required: cost,
        prose: [
            `${humanDays(skip.simulatedDays)} bent over the ground around ${placeName(before)}.`,
            outcome,
            ...cost
        ].join('\n\n')
    };
}

/**
 * What a house's ground is worth to the person standing in the queue for it.
 */
export function factsForGroundTime(
    cultivator: Cultivator,
    sectName: string | null,
    entitlement: GroundEntitlement | null
): EngineFacts {
    if (!sectName) {
        return factsForRefusal(
            'You are in nobody\'s queue.',
            'Ground like that is allocated by houses to their own, in days, by standing. You '
            + 'belong to none, so there is no allocation with your name on it and nobody to ask. '
            + 'What a rogue cultivator gets is whatever ground they can find and hold themselves.',
            `${cultivator.name} holds no membership; ground-time allocation is per-faction.`
        );
    }
    if (!entitlement || !entitlement.room) {
        return factsForRefusal(
            `${sectName} has no ground to give.`,
            `${sectName} holds no chamber, vein or cave worth allocating - so there is no queue, `
            + 'no schedule and nothing your rank could move you up. Whatever else belonging here '
            + 'buys, it is not ground. That is a fact about the house rather than about you.',
            `No rooms with a priced qiDensity are controlled by this faction.`
        );
    }

    const { room, share, daysPerYear, chamberRate, fallbackRate, effectiveRate, atNextRank } = entitlement;
    const lines: string[] = [];

    // The whole year on ground worth nothing is not a gift, and must not read
    // as one. `daysPerYear` at 365 with a rate at or below the fallback means
    // nobody is competing for it, which is the bleak answer.
    const unlimited = daysPerYear >= 360;
    const worthHaving = chamberRate !== null && chamberRate > fallbackRate * 1.05;

    lines.push(
        unlimited && !worthHaving
            ? `${sectName} gives you ${room.name} for as much of the year as you want - ${daysPerYear} `
              + `days of it. Nobody is queueing, because ${room.band} ground is not worth queueing `
              + 'for. What the house has, you may have all of, and it is not much.'
            : `${sectName} allots you ${daysPerYear} days a year on ${room.name}: ${room.band} `
              + `ground, measured at ${Math.round(room.density)}. The rest of the year is spent on `
              + 'whatever the house has that nobody is competing for.'
    );

    if (chamberRate !== null) {
        lines.push(
            `In the room the qi comes at ${chamberRate.toFixed(2)} a day against ${fallbackRate.toFixed(2)} `
            + `off it, so across the whole year your climb runs at ${effectiveRate.toFixed(2)}.`
        );
    }

    // The refusal that teaches. Deliberately "what would a promotion get me"
    // rather than "what does the person above me have": those differ whenever a
    // house is lopsided, and only the first is a thing a player can act on.
    if (atNextRank) {
        lines.push(
            atNextRank.daysPerYear > daysPerYear
                ? `One rung up is ${atNextRank.daysPerYear} days a year rather than ${daysPerYear}, `
                  + `and a year that runs at ${atNextRank.effectiveRate.toFixed(2)}. That is what the `
                  + 'next promotion is actually worth, in the only currency that matters here.'
                : 'The rung above allots no more of it than this one does. Whatever a promotion '
                  + 'buys in this house, it is not more time on the ground.'
        );
    } else {
        lines.push('There is no rung above yours here, so there is no more of it to be had.');
    }

    const facts = observable(
        `${daysPerYear} days a year on ${room.name}.`,
        lines,
        lines.join(' '),
        [
            `The ground being allotted is ${room.name} (${room.id}), measured at ${room.density}, `
            + `which is ${room.band} ground. Their share of it is ${share}, taken as a fraction of `
            + `the whole year, which is the ${daysPerYear} days above rounded to whole days.`,
            chamberRate === null
                ? `The house prices no rate for that room, so the whole year runs at the rate off `
                  + `it, ${fallbackRate} a day, and the allotment buys nothing.`
                : `${daysPerYear} days in the room at ${chamberRate} a day and the other `
                  + `${DAYS_PER_YEAR - daysPerYear} at ${fallbackRate} a day come to ${effectiveRate} `
                  + `a day over the year. The average is taken on the exact share rather than on the `
                  + `rounded day count, so the two can part company in the last place.`,
            atNextRank
                ? `One rung up, at rank index ${atNextRank.rankIndex}, the same arithmetic over the `
                  + `same house gives ${atNextRank.daysPerYear} days a year and ${atNextRank.effectiveRate} `
                  + `a day. Everybody else is held still to compute it, so it is what a promotion is `
                  + `worth and not what the person above is holding.`
                : 'There is no rung above this one in this house, so there is no further allotment to '
                  + 'be had by rising.'
        ]
    );
    return facts;
}

/**
 * An attempt to move somebody, resolved.
 */
export function factsForAttempt(
    subject: string,
    intent: string,
    result: AttemptResult,
    subjectFacts: readonly string[],
    /**
     * What the attempt WAS, when what it was is a wrong.
     */
    wrong: Wrong | null = null,
    /**
     * How many times this has already been put to this person.
     */
    priorTries = 0
): EngineFacts {
    const taking = wrong !== null;
    const landed = result.outcome === 'taken' || result.outcome === 'turned';

    // AND IT IS THE PLAYER'S OWN TURN, IN THE PLAYER'S OWN PERSON
    const opening = taking
        ? `You go at ${subject} for it. Nothing is asked and nothing is offered.`
        : `You put it to ${subject}.`;
    const lines: string[] = [opening, ...subjectFacts];

    // The engine's own factual line first - it names who did what.
    lines.push(result.line);

    switch (result.outcome) {
        case 'taken':
            lines.push(
                taking
                    ? 'It came off.'
                    : result.stonesSpent > 0
                        ? `It was taken, and ${result.stonesSpent} spirit stones went with it.`
                        : 'It was taken.'
            );
            break;
        case 'refused':
            lines.push(
                taking
                    // The failure of a taking is being caught. Nobody declined
                    // anything, and saying they did is the engine describing a
                    // conversation that did not happen.
                    ? `${subject} caught you at it, and it went no further than the two of you.`
                    : 'It was refused, and it stayed between the two of you.'
            );
            break;
        case 'reported':
            lines.push(
                taking
                    ? `${subject} caught you at it and did not keep it to themselves. Somebody who `
                      + 'was not in the room knows what you tried.'
                    : 'It was refused and it did not stay between the two of you. Somebody who was '
                      + 'not in the room now knows what was asked for.'
            );
            break;
        case 'turned':
            lines.push(
                `${subject} is not merely unwilling. They have decided what you are, and they are `
                + 'going to act on it.'
            );
            break;
    }

    lines.push(howItHasBeenGoing(result.odds, priorTries, landed));
    if (result.marks.obligation) {
        lines.push('It is on somebody\'s ledger now, and ledgers here are kept.');
    }
    if (result.days > 1) {
        lines.push(`${result.days} days went into it.`);
    }

    return observable(
        `${subject}: ${result.outcome}.`,
        lines,
        lines.join(' '),
        [
            `${subject} `
            + `${result.marks.theyKnowWhatYouTried
                ? 'can say exactly what was tried'
                : 'knows something happened and not what it was'}`
            + `${result.marks.reachedTheHouse ? ', and so can their house' : ''}. `
            // The label the parser put on the verb, said as what it is: a note
            // for the narrator that no conditional anywhere reads. Printing it
            // as `intent=bribe` invited exactly the misreading the rule exists
            // to prevent, which is that it selected something.
            + `The approach was labelled "${intent}", which is carried for the `
            + 'narrator and read by no conditional - what the engine priced was '
            + 'the weight of the thing asked for, never the word.'
        ]
    );
}


// ─────────────────────────────────────────────────────────────────────────
// ASKING SOMEBODY FOR SOMETHING
// ─────────────────────────────────────────────────────────────────────────

/** What the ask weighs, said as what it costs THEM rather than as a label. */
const WHAT_THE_ASK_WEIGHS: Readonly<Record<AskWeight, string>> = {
    a_courtesy: 'It costs them a sentence and a moment.',
    a_real_favour: 'It costs them something real - time, or standing, or a book they '
        + 'would rather keep.',
    against_their_interest: 'They would end up worse off, and they can see that while you '
        + 'are still asking.',
    a_betrayal: 'If it is ever found out it ends them, and everybody who might find out is '
        + 'somebody they see every day.'
};

/** What each kind of request is, in one clause, for the headline. */
function whatWasAsked(kind: string, named: string): string {
    switch (kind) {
        case 'teaching':
            return named.length >= 2 ? `to be taught ${named}` : 'to be taught';
        case 'discipleship': return 'to be taken on';
        case 'introduction':
            return named.length >= 2 ? `to be introduced to ${named}` : 'for an introduction';
        // Reads as a clause after the actor's name rather than after "asks",
        // because nothing is being asked. See `factsForRequest`.
        case 'nothing': return 'spends an afternoon on somebody';
        default: return named.length >= 2 ? `for ${named}` : 'for something';
    }
}

/**
 * A request put to a person, resolved.
 */
export function factsForRequest(
    cultivator: Cultivator,
    subject: string,
    kind: string,
    named: string,
    costing: { ask: AskWeight; lines: string[]; structure: string[] },
    result: AttemptResult,
    subjectFacts: readonly string[],
    /** How many times this has already been put to this person. */
    priorAsks = 0,
    /**
     * Whether a record was actually WRITTEN, which is not the same as whether the
     * resolver produced one.
     */
    wroteToTheLedger = false,
    /**
     * How strongly they already hold you, 0..1, from the relationships table.
     */
    theirTie = 0,
    /**
     * How freely this person parts with things, on -1..+1.
     */
    openHandedness = 0
): EngineFacts {
    const asked = whatWasAsked(kind, named);
    // The odds the engine actually used, which is the one thing the player was
    // never told and the one thing that would have stopped eighteen identical
    // replies reading as a broken verb. See `howItHasBeenGoing`.
    const landed = result.outcome === 'taken' || result.outcome === 'turned';
    const courtesy = kind === 'nothing';
    const lines: string[] = [
        courtesy
            ? `${cultivator.name} spends an afternoon on ${subject}, and wants nothing out of it.`
            : `${cultivator.name} asks ${subject} ${asked}.`,
        ...subjectFacts,
        ...costing.lines,
        ...(courtesy ? [] : [WHAT_THE_ASK_WEIGHS[costing.ask]])
    ];

    // What they already know about being asked this. Before the outcome,
    // because it is what they are hearing the outcome through.
    const again = theyHaveHeardThisBefore(subject, priorAsks, courtesy);
    if (again) lines.push(again);

    // A COURTESY HAS ITS OWN OUTCOMES.
    if (courtesy) {
        lines.push(
            result.outcome === 'taken' || result.outcome === 'turned'
                ? `${subject} takes it, and the afternoon goes somewhere. You are not a stranger `
                  + 'to them any more, which is a small thing and is the thing every larger one '
                  + 'is built on.'
                : `${subject} is civil about it and it goes nowhere. Nothing was asked, so there `
                  + 'is nothing to hold against you and nothing has been spent but the day. '
                  + (priorAsks === 0
                      ? 'This is a thing that works by being done repeatedly, and this was once.'
                      : 'It works by being done repeatedly and it does not work every time.')
        );
    } else {
        switch (result.outcome) {
            case 'taken':
                lines.push(
                    result.stonesSpent > 0
                        ? `${subject} agrees, and ${result.stonesSpent} spirit stones go with it.`
                        : `${subject} agrees.`
                );
                break;
            case 'turned':
                lines.push(
                    `${subject} agrees, and is holding the fact that they were asked. They have `
                    + 'decided something about you, and they are going to act on it.'
                );
                break;
            // THEY NAMED TERMS
            case 'countered':
                lines.push(
                    `${subject} does not agree and does not say no. There is something they `
                    + 'want, and what you get back is what it would take rather than a door '
                    + `closing. ${inTheirOwnGrain(openHandedness)}`.trimEnd()
                );
                break;
            case 'refused':
                lines.push(
                    `${subject} says no, and it stays between the two of you. `
                    + `${inTheirOwnGrain(openHandedness)}`
                    + whatWouldMoveThem(costing.ask, theirTie)
                );
                break;
            case 'reported':
                lines.push(
                    `${subject} says no, and does not keep it to themselves. Somebody who was `
                    + `not in the room now knows what you asked for. `
                    + `${inTheirOwnGrain(openHandedness)}`
                    + whatWouldMoveThem(costing.ask, theirTie)
                );
                break;
        }
    }

    // HOW OFTEN A THING LIKE THIS COMES OFF, AND HOW OFTEN IT HAS BEEN TRIED
    lines.push(howItHasBeenGoing(result.odds, priorAsks, landed));

    if (wroteToTheLedger) {
        lines.push('It is on somebody\'s ledger now, and ledgers here are kept.');
    }
    if (result.days > 1) lines.push(`${result.days} days went into it.`);

    return observable(
        `${subject}, asked ${asked}: ${result.outcome}.`,
        lines,
        lines.join(' '),
        [
            // The whole attempt is said once, by `whatTheAskCameTo`, on the
            // call the engine files beside this. What belongs here is the part
            // that is about the two people rather than about the roll: what
            // they now know, and how many times this has happened.
            `${subject} `
            + `${result.marks.theyKnowWhatYouTried
                ? 'can say exactly what was tried'
                : 'knows something happened and not what it was'}`
            + `${result.marks.reachedTheHouse ? ', and so can their house' : ''}. `
            + `${priorAsks === 0
                ? 'It had not been put to them before.'
                : `It had been put to them ${priorAsks} time`
                  + `${priorAsks === 1 ? '' : 's'} before.`}`,
            ...costing.structure
        ]
    );
}

/**
 * A refusal in the voice of the person it came from, or nothing.
 */
function inTheirOwnGrain(openHandedness: number): string {
    const grain = whatTheirRefusalIsLike(openHandedness);
    return grain === null ? '' : `${grain} `;
}

/**
 * The other half of every refusal, and the reason there is a table rather than one
 * sentence.
 */
/**
 * EVERY SENTENCE HERE MUST NAME A DOOR THAT EXISTS.
 */
const WHAT_WOULD_HAVE_MOVED_THEM: Readonly<Record<AskWeight, string>> = {
    a_courtesy:
        'What moves somebody on a thing this small is having met you before, and there is '
        + 'exactly one way to get that: turn up again wanting nothing. Buy them a drink, sit '
        + 'with them, call on them, do them a small favour. Each costs a day and no stones at '
        + 'all, and it is the only lever in this game available to somebody carrying nothing.',
    a_real_favour:
        'The largest thing on the scale is what you have already done for them, and it is worth '
        + 'more than any purse - so buy them a drink, sit with them, come back wanting nothing, '
        + 'and ask this again when you are somebody they have dealt with. Standing in a house '
        + 'they have to take seriously moves it too. Money helps here and never decides it.',
    against_their_interest:
        'Money reaches a long way down and it does not reach this far, and neither does turning '
        + 'up: no number of afternoons gets somebody to a place where they end up worse off. '
        + 'What would move them is standing they have to answer to, or something they want badly '
        + 'enough to trade for - and neither of those is a thing you can do this afternoon.',
    a_betrayal:
        'Nothing you can do standing here reaches this, and that is not a price you have failed '
        + 'to meet. What you are asking them to spend is their standing in the only place that '
        + 'would have them, which is not for sale at any figure - a stranger with a purse reads '
        + 'to them as somebody who has not understood what they are looking at.'
};

/**
 * Where the tie stops being the answer.
 */
const A_TIE_THAT_HAS_NOTHING_LEFT = 0.9;

/**
 * What would move them, which depends on what has already been spent.
 */
function whatWouldMoveThem(ask: AskWeight, theirTie: number): string {
    if (theirTie < A_TIE_THAT_HAS_NOTHING_LEFT) return WHAT_WOULD_HAVE_MOVED_THEM[ask];
    switch (ask) {
        case 'a_courtesy':
            return 'You have already turned up as often as turning up is worth. They know '
                + 'exactly who you are and today is simply not the day.';
        case 'a_real_favour':
            return 'You have spent what turning up can buy - they know you, and it is not '
                + 'enough on its own. What is left is not another afternoon: it is standing '
                + 'they have to take seriously, or a debt they cannot walk away from, and '
                + 'both of those are earned somewhere other than in front of them.';
        case 'against_their_interest':
        case 'a_betrayal':
            return WHAT_WOULD_HAVE_MOVED_THEM[ask];
    }
}

/**
 * That they have heard this from you before, said out loud.
 */
function theyHaveHeardThisBefore(
    subject: string,
    priorAsks: number,
    /**
     * A courtesy repeated is the mechanic and not a nag.
     */
    courtesy = false
): string | null {
    if (priorAsks <= 0) return null;
    if (courtesy) {
        return priorAsks === 1
            ? `This is the second time you have come by wanting nothing, and the second time is `
              + 'the one that counts. The first is a stranger; the second is somebody who came '
              + 'back.'
            : `That is ${priorAsks + 1} times you have turned up asking for nothing. It is not `
              + `much each time and it is not nothing, and ${subject} has stopped thinking of `
              + 'you as somebody they have not met.';
    }
    if (priorAsks === 1) {
        return `${subject} has heard this from you once already, and remembers it. Asking a `
            + 'second time is a different sentence from asking a first, and they hear it that '
            + 'way.';
    }
    if (priorAsks < 5) {
        return `That is ${priorAsks + 1} times you have put this to ${subject}. They are not `
            + 'confused about what you want, and going back over it is not what is missing.';
    }
    return `${priorAsks + 1} times now. ${subject} has stopped hearing a request and started `
        + 'hearing a habit, and what they think of you is no longer about the thing you keep '
        + 'asking for.';
}

/**
 * What asking them would take, without asking them.
 */
export function factsForWeighingARequest(
    cultivator: Cultivator,
    subject: string,
    kind: string,
    costing: { ask: AskWeight; lines: string[]; structure: string[] },
    subjectFacts: readonly string[],
    offered: number | null,
    priorAsks = 0,
    theirTie = 0,
    /**
     * The odds the attempt WOULD run at, from `oddsOf` rather than from a
     * description of it. The whole value of weighing something is being told
     * the number before spending the afternoon.
     */
    odds: number | null = null
): EngineFacts {
    // Nothing has been refused here, so `inTheirOwnGrain` deliberately does not
    // appear: its sentences are about a no that was actually said. What this
    // surface carries about the person is `howTheyHoldWhatTheyHave`, which the
    // caller has already put into `subjectFacts` - the same reading, in the
    // tense that fits a thing which has not happened yet.
    const lines: string[] = [
        `What it would take to ask ${subject} ${whatWasAsked(kind, '')}, before you ask.`,
        ...subjectFacts,
        ...costing.lines,
        WHAT_THE_ASK_WEIGHS[costing.ask],
        whatWouldMoveThem(costing.ask, theirTie)
    ];
    if (odds !== null) lines.push(howItHasBeenGoing(odds, priorAsks, false));
    const heard = theyHaveHeardThisBefore(subject, priorAsks, kind === 'nothing');
    if (heard) lines.push(heard);
    if (offered !== null) {
        lines.push(
            `You would be putting ${offered} spirit stones down, and ${cultivator.name} is `
            + `carrying ${cultivator.spiritStones}.`
        );
    }
    lines.push('Nothing has been said to them. No day has gone by and nothing has changed hands.');

    return observable(
        `${subject}: what the asking would cost them.`,
        lines,
        lines.join(' '),
        [...costing.structure]
    );
}

/**
 * Ground that would not have them, and who should go instead.
 */
export function factsForGroundRefused(
    cultivator: Cultivator,
    siteName: string,
    reading: AdmissionReading,
    days: number
): EngineFacts {
    const lines = [
        `${siteName} would not have ${cultivator.name}.`,
        reading.account,
        `${humanDays(days)} spent going and coming back, and nothing else was taken.`
    ];
    return observable(
        `${siteName}: closed, from above.`,
        lines,
        lines.join(' '),
        [
            `readAdmission: admitted=false, closedBy=above_the_line at ordinal `
            + `${cultivator.realmOrdinal}. No gate consulted, no force applied, `
            + `${days} day(s) spent.`
        ]
    );
}

/**
 * Ground that let them in, and what being at its depth is like.
 */
export function factsForGroundSurvived(
    cultivator: Cultivator,
    siteName: string,
    reading: AdmissionReading
): EngineFacts {
    const lines = [
        `${siteName} admits ${cultivator.name}, and does not close behind them.`,
        reading.account
    ];
    return observable(
        `${siteName}: the ground holds.`,
        lines,
        lines.join(' '),
        [
            `readAdmission: admitted=true, survives=true at ordinal `
            + `${cultivator.realmOrdinal}. The floor is not what stops them.`
        ]
    );
}

// WHOSE ART THAT WAS

export interface ArtRecognitionInput {
    /** The art, as the catalog names it. */
    artName: string;
    /** The house the player named, as the catalog names it. Null when they named none. */
    claimedHouseName: string | null;
    verdict: ClaimVerdict;
    /** Houses this reader could place the art to, by display name. */
    placedTo: readonly string[];
    /** They followed what was done and it attached to no house they can name. */
    perceivedButCouldNotPlaceIt: boolean;
    /** Taught in enough places that no house can call it theirs. */
    nobodysArt: boolean;
    /** Knowing whose it is announces which rooms they have been in. */
    revealsTheReader: boolean;
    /** Inspector channel: the two axes, unrounded. */
    structure: readonly string[];
}

/**
 * What the character can honestly say about what they just watched.
 */
export function factsForRecognisingAnArt(input: ArtRecognitionInput): EngineFacts {
    const {
        artName, claimedHouseName, verdict, placedTo,
        perceivedButCouldNotPlaceIt, nobodysArt, revealsTheReader
    } = input;
    const house = claimedHouseName ?? 'that house';
    const lines: string[] = [];
    let headline: string;

    if (nobodysArt) {
        headline = 'Everybody\'s, and therefore nobody\'s.';
        lines.push(
            `${artName} is on half the shelves in the province. Watching somebody use it tells `
            + 'you nothing about where they were raised, because it tells you nothing about anybody.'
        );
    } else switch (verdict) {
        case 'would_not_know_it':
            // The honest answer to a question the character cannot hold, and
            // conspicuously NOT a "no". A false negative here would be the
            // engine lying to the player about their own head.
            headline = 'You would not know it.';
            lines.push(
                `You have never seen ${house}'s art, and nobody has ever described it to you in `
                + 'enough detail to be worth anything. Whatever that was, it could have been theirs '
                + 'and it could have been anybody\'s, and you are not the person to say which.'
            );
            lines.push(
                'It is not modesty. There is nothing in your head to hold it up against.'
            );
            break;

        case 'could_not_follow':
            headline = 'It went past you.';
            lines.push(
                'You saw a person move. What they actually did with the movement did not arrive - '
                + 'not as something you disagreed with, as something that was simply not there when '
                + 'you looked at it.'
            );
            lines.push(
                `Whether it was ${house}'s is a question for somebody who could see what happened.`
            );
            break;

        case 'consistent':
            headline = `It matches what you have heard of ${house}.`;
            lines.push(
                `Everything you have been told about how ${house} moves fits what you just watched. `
                + 'None of it contradicts.'
            );
            // The hedge, said plainly, because the uncertainty IS the answer.
            lines.push(
                'And you would not be able to tell a good imitation from the real thing. Somebody '
                + 'who had studied the same descriptions you have could produce exactly this, and '
                + 'you would nod along.'
            );
            break;

        case 'inconsistent':
            headline = `It does not sit right against ${house}.`;
            lines.push(
                `Something in it does not match what you have been told about ${house} - not `
                + 'obviously, and not in a way you could put into words for somebody else.'
            );
            lines.push(
                'Which is worth exactly as much as your telling is worth, and you have never '
                + 'watched them do it.'
            );
            break;

        case 'it_is':
            // Terse. This is the reward, and padding it would spend it.
            headline = `That is ${house}'s.`;
            lines.push(`That is ${house}'s art. You have watched it performed and there is no doubt in it.`);
            break;

        case 'it_is_not':
            headline = `That is not ${house}'s.`;
            lines.push(`That is not ${house}'s art. You have watched theirs, and this is not it.`);
            break;
    }

    if (placedTo.length > 0 && verdict !== 'would_not_know_it' && verdict !== 'could_not_follow') {
        // Where it was LEARNED. Said in those words on purpose: an art cannot
        // say whom anybody now serves, and a sentence that implied otherwise
        // would be the engine making the conflation the API refuses to.
        lines.push(
            placedTo.length === 1
                ? `It is ${placedTo[0]} who teach that. Where somebody learned a thing and whose `
                  + 'they are now are not the same question, and this only answers the first.'
                : `${placedTo.join(' and ')} both teach it, so it says where somebody trained and `
                  + 'not much about which of them.'
        );
    }

    if (perceivedButCouldNotPlaceIt) {
        lines.push(
            'You followed it cleanly enough. It simply does not attach to any house you could name.'
        );
    }

    // Only where there is something to say out loud. A reader who has just
    // been told the movement went past them has nothing to announce, and the
    // line read as a non-sequitur there in the first played turn of this verb.
    if (revealsTheReader && verdict !== 'could_not_follow' && verdict !== 'would_not_know_it') {
        // A social fact, not a perceptual one. Being able to say this out loud
        // announces that you have been in rooms most people cannot enter.
        lines.push(
            'And saying so out loud would tell anybody listening where you have been standing, '
            + 'which is not a room most people can get into.'
        );
    }

    return { headline, lines, structure: [...input.structure], prose: lines.join('\n\n') };
}
