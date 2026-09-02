/**
 * Engine outcomes, rendered as English.
 *
 * This module is the single place where a `TimeSkipResult`, a
 * `BreakthroughResult` or a survival state becomes a sentence. Both narrator
 * paths consume it and neither may bypass it:
 *
 * - the provider narrator is handed `lines` as the *entire* factual content
 *     of its phase-3 prompt, so the model has nothing to narrate from except
 *     what the engine actually returned;
 * - the deterministic narrator ships `prose` verbatim.
 *
 * That symmetry is the point. With no provider configured the player reads the
 * engine's own account; with one configured they read the same account in
 * better sentences. Neither version can contain a fact the engine did not
 * produce, because neither version is composed anywhere else.
 *
 * The register is the one context.md asks for: plain declarative sentences,
 * cruelty in the content rather than the adjectives, cosmic events anchored to
 * one physical detail.
 */

import {
    CRIPPLING_UNTREATED_INJURIES,
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
import { LOW_SATIETY } from '../engine/cultivation/survival.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import type { GroundEntitlement } from '../engine/world/the-ground-somebody-is-actually-standing-on.js';
import type { AttemptResult } from '../engine/social-leverage/index.js';
import type { AdmissionReading } from '../data/cultivation/inheritance-trials.js';
import { aggregateInjuryPenalties, untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import { getSect } from '../data/cultivation/sects.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';

export interface EngineFacts {
    /** One-line summary. Used as the overlay title and the log's first line. */
    headline: string;
    /**
     * The complete factual content of the outcome, one statement per entry.
     * This is what a narrator is allowed to know. Nothing else is sent.
     *
     * OBSERVABLE ONLY. Everything here must be something a person in the room
     * could see, hear, feel or be told - never a category out of the schema.
     * docs/world/tone.md: nobody tells the protagonist how anything works, and
     * a bare label in a prompt is an invitation to paraphrase it into a
     * briefing. That is what a category in a prompt is FOR.
     */
    lines: string[];
    /**
     * The structural truth: governance, ladders, grades, ordinals, thresholds.
     *
     * Engine-only. It reaches the inspector and the play log, where mechanical
     * precision is the whole point, and it is never sent to a narrator. The
     * engine holds the structure so that people can BEHAVE according to it,
     * which is its only purpose in narration - so the narrator gets the
     * behaviour and the operator gets the structure.
     */
    structure: string[];
    /** The deterministic rendering, ready to show a player as-is. */
    prose: string;
    /**
     * Lines the player MUST end up reading, whatever the narrator does.
     *
     * A subset of `lines`, not a second channel of content: everything here is
     * also in `lines`, so a model that renders it well renders it once and this
     * adds nothing. What it defends against is OMISSION.
     *
     * The measurement that made it necessary: the engine files a
     * `method_ceiling` event saying, in full, "without a manual there is no
     * road for the qi to take, so nothing accumulates and nothing ever will."
     * The model receives that whole sentence inside a long digest and drops it,
     * so a cultivator sits for fifty years gaining nothing and is never told
     * why. With the deterministic narrator it reaches the player on every seed.
     * The difference between the two front doors was the model's mood.
     *
     * Reserved for facts a player cannot play without: why nothing is
     * accumulating, that they have died, what a crossing cut away. Not for
     * anything merely interesting - a required line that arrives stapled to the
     * end of good prose is a cost, and it is only worth paying where silence
     * would be a lie by omission.
     */
    required?: string[];
}

/** Build facts with an empty structure channel. Most outcomes have none. */
function observable(headline: string, lines: string[], prose: string, structure: string[] = []): EngineFacts {
    return { headline, lines, structure, prose };
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD, AS THE ENGINE'S STATES MEAN IT
// The ambient table is the qi-density table. Qi is a resource that pools in
// spiritual veins and is not evenly distributed, so these strings say what a
// band means to live in rather than what it multiplies. They are what the
// narrator is given, so a model that has never seen context.md still cannot
// describe a spirit tide as scenery.
// ─────────────────────────────────────────────────────────────────────────

const AMBIENT_IN_WORLD: Record<AmbientQi, string> = {
    thin: 'Qi density thin: half cultivation rate, and a penalty to breakthrough odds. Drawn down long ago, or never rich.',
    normal: 'Qi density ordinary: no modifier either way. Inhabited land.',
    dense: 'Qi density dense: double cultivation rate, and a bonus to breakthrough odds. A vein near the surface, or ground nobody has worked.',
    spirit_tide: 'Qi density spirit tide: triple cultivation rate and the largest breakthrough bonus in the table. A vein shifting, a seal failing, a season turning over. Temporary.',
    sealed_vein: 'Qi density sealed vein: quadruple cultivation rate and a substantial breakthrough bonus. Never drawn on. Weight zero in the ambient roll - this is found, not encountered.'
};

/**
 * The same four states, as a person standing in them would experience them.
 *
 * This is what goes to the narrator; the table above goes to the inspector.
 * Nobody in this world is told they are standing in a 0.5x multiplier - they
 * sit down for an hour and get less than an hour back, and after enough years
 * of that they draw their own conclusions. Rate language would teach the player
 * a rule, which is the one thing narration is not for.
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
    // The figure is the RUNG'S, not fifty. `stagnationYearsForOrdinal` is
    // max(50, lifespan / 5), so fifty is only true through Foundation
    // Establishment - it is a hundred at Core Formation and twenty thousand at
    // Tribulation Transcendence. This entry said fifty to everybody, which made
    // it a lie about most of the ladder in the one sentence a player reads
    // about their own death. `describeDeathCause` takes the ordinal now and
    // this row is a function of it, the way `standingStructure` already does it.
    stagnation_aging: 'settled - the years this rung credits ran out, and the qi already inside them finished working on them instead',
    // RETIRED. Nothing produces this cause any more; the row is kept so a run
    // ledger written before the ruling still renders. See `docs/world/injuries.md`.
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
 *
 * The engine knows both ordinals exactly. Handing them to a narrator produces
 * "as a mere Qi Condensation Layer 3, he could never..." - power-level
 * exposition, banned in Tier 1 and tedious besides. What a person actually
 * perceives is a gap, and discovery.md is explicit that the player should do
 * the arithmetic themselves rather than be given the sum.
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
 *
 * The Immortal realm is a place rather than a rank band - other immortals and
 * immortal beasts are in it, and the province the cultivator came from is on
 * the other side of a hole they had to punch to leave through.
 */
export const ABOVE_THE_LID_PLACE = 'the far side of the Lid';

export function placeName(
    cultivator: Pick<Cultivator, 'location'> & Partial<Pick<Cultivator, 'immortalStatus'>>
): string {
    // A True Immortal keeps whatever `location` row they had when they crossed,
    // because nothing clears it - and every surface that read it then reported
    // them as standing in a market town they left permanently.
    if ((cultivator.immortalStatus ?? 'none') === 'true_immortal') return ABOVE_THE_LID_PLACE;
    return cultivator.location?.trim() || 'Sweptground';
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
 * The player's own condition, as they experience it.
 *
 * Their own sheet is not world structure and is not withheld - a person knows
 * their own rank and counts their own money. What IS withheld is the rule
 * behind each number: not "three untreated injuries and the next fight is
 * fatal", which teaches a threshold, but the state of the meridians, which the
 * player can draw a conclusion from. The interface shows the arithmetic.
 */
export function standingLines(cultivator: Cultivator, ambient: AmbientQi): string[] {
    const untreated = untreatedInjuryCount(cultivator.injuries);
    const root = getSpiritRoot(cultivator.spiritRoot);
    return [
        `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}, in ${placeName(cultivator)}.`,
        `Spirit root: ${root.name}. Might ${cultivator.attributes.might}, Insight ${cultivator.attributes.insight}, Fortune ${cultivator.attributes.fortune}, Charm ${cultivator.attributes.charm}.`,
        `Cultivation progress ${Math.round(cultivator.cultivationProgress)} qi-units. HP ${cultivator.hp}/${cultivator.maxHp}. Satiety ${cultivator.satiety}/100. Spirit stones ${cultivator.spiritStones}.`,
        // AND WHAT CARRYING THAT MANY ACTUALLY COSTS.
        //
        // The sheet reported the number and never what it meant. Played to
        // three untreated wounds it said "3 meridian injuries have been open
        // since the day it was taken" and stopped, while combat and work had
        // both been saying the consequential half for some time. The one screen
        // a player reads when they suspect they are in trouble was the last
        // place to tell them.
        //
        // What it says has changed with the ruling: this is not the count that
        // kills, because nothing about a torn channel kills. It is the count at
        // which the body gives up repairing itself, and it is meant to read as
        // intolerable rather than as terminal.
        //
        // The pronouns were singular too, against a plural subject.
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
        `${cultivator.yearsAtCurrentRealm.toFixed(1)} years at this realm without advancing.`,
        // WHOSE ROLL THEY ARE ON.
        //
        // The sheet listed root, attributes, qi, health, hunger and money and
        // never once said what house the cultivator serves - so somebody who
        // had joined a sect could read their own status and find no trace of
        // it. Standing is most of what a person IS in this setting: it decides
        // what they are taught, what they are owed and what is asked of them.
        //
        // Found by playing, twice over. "What is my reputation" routed here
        // correctly and came back with a sheet containing no reputation, which
        // is the deflection this file already treats as a defect elsewhere.
        cultivator.sectId
            ? `On the roll of ${sectNameFor(cultivator.sectId)}`
              + `${cultivator.sectRank ? `, ranked ${cultivator.sectRank}` : ''}.`
            : 'Serves no house. Nothing is owed to them and nothing is asked of them.',
        describeAmbientPerceived(ambient)
    ];
}

/**
 * A house's name from its id, falling back to the id itself.
 *
 * The catalog is the only place the pretty name lives, and a run may carry a
 * house the catalog has never heard of - one the world founded for itself. The
 * id is a poor name but it is a true one, and it beats printing nothing.
 */
function sectNameFor(sectId: string): string {
    return getSect(sectId)?.name ?? sectId;
}

/** The thresholds behind those numbers. Inspector only. */
export function standingStructure(cultivator: Cultivator, ambient: AmbientQi): string[] {
    return [
        `realmOrdinal=${cultivator.realmOrdinal} (${rankName(cultivator.realmOrdinal)}), spiritRoot=${cultivator.spiritRoot}, foundation=${cultivator.foundationQuality}.`,
        // The count and what it is costing, as numbers, so the ruling panel
        // carries them rather than only the prose does. `daysUntilBleedOut` used
        // to ride here and was a countdown to a death that no longer happens;
        // how long the channels have been open is the true version of the same
        // fact and is what replaced it.
        `untreatedInjuries=${untreatedInjuryCount(cultivator.injuries)} of ${CRIPPLING_UNTREATED_INJURIES} before the body stops mending, ` +
        `daysChannelsOpen=${Math.max(0, Math.round(cultivator.bleedingTurns))}, ` +
        `rateLost=${Math.round(aggregateInjuryPenalties(cultivator.injuries).cultivationPenalty * 100)}%; ` +
        `yearsAtRealm=${cultivator.yearsAtCurrentRealm.toFixed(1)} of ${Math.round(stagnationYearsForOrdinal(cultivator.realmOrdinal))} before settling.`,
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
     *
     * A seclusion can be shortened before it starts - the encounter layer
     * decides somebody arrives in year two, and the skip is handed the
     * truncated span. `skip.requestedDays` is then the truncated figure, so
     * asking for five years and being told "Seclusion of 2 years was intended"
     * is the engine reporting its own arithmetic as the player's intention.
     *
     * Omitted where the two agree, which is every caller that does not
     * pre-truncate.
     */
    askedForDays?: number,
    /**
     * The span the SENTENCE asked for, before the engine's own ceiling.
     *
     * `parseDuration` clamps at MAX_CULTIVATION_DAYS and said nothing about it,
     * so "I cultivate for 100000 years" answered "Seclusion of 100 years was
     * intended" - a thousandfold correction that reads like agreement. The
     * ceiling is real; being silent about it is the invisible-fallback defect
     * in numeric form. Omitted where nothing was clamped, which is almost
     * always.
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
        const death = `${after.name} is dead: ${describeDeathCause(skip.deathCause, after.realmOrdinal)}. `
            + 'The run is closed. There is no reload.';
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
 *
 * Deliberately short, and every entry earns its place by being something a
 * player cannot make a decision without.
 *
 *   `method_ceiling`  why the years are buying nothing. Measured being dropped
 *                     from a long digest by a model that had been handed the
 *                     whole sentence, leaving a cultivator to sit for fifty
 *                     years and never find out that no manual means no road.
 *   `ground_ceiling`  the same fact about the ground rather than the book, and
 *                     the same answer: the thing to do is move, and a player
 *                     who is not told will sit.
 *
 * A death is required too, and is pushed separately below rather than listed
 * here, because it is not an event kind - it is a property of the skip.
 */
const REQUIRED_EVENT_KINDS: ReadonlySet<string> = new Set([
    'method_ceiling',
    'ground_ceiling'
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
 *
 * Written to be read, not to be a debug dump: an opening that places the
 * player, the events in order as short flat statements, and a closing that
 * says plainly what it cost. The engine's own `summary` strings carry the
 * numbers, so this composes around them rather than restating them.
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
    //
    // This renderer serves every action that consumes time, and its opening
    // assumed the one that made it: seclusion. So travelling read as
    // "Low Fall. Drive Recheck sat down and began to breathe. Travel of 1 day
    // was intended." - a person setting out described as somebody settling in,
    // and the ambient flavour underneath it is about the ground they are
    // leaving rather than anywhere they are going.
    //
    // The label already says which it is; it just was not being asked.
    // Three postures, not two. Travelling is a road; a sect duty, a commission
    // or a stretch of work is somebody OUT DOING SOMETHING, and neither is
    // sitting still. The seclusion opener reached both until it was played:
    // "Wheatgate. Shen Weiran sat down and began to breathe. Sect duty: What a
    // Poor District Has Instead of Monsters of 20 days was intended." - a man
    // sent to deal with a district's troubles, described as settling in to
    // meditate, with the ambient flavour underneath about ground he is not
    // sitting on.
    //
    // The label already says which it is; it just was not being asked.
    const travelling = /travel|journey|road|walk/i.test(label);
    const sentOut = /dut(?:y|ies)|commission|assignment|errand|mission|task|work|labour/i.test(label);

    const opening = travelling
        ? `${where}. ${before.name} took to the road.`
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

    // "Nothing found you" is a claim about the whole stretch and this function
    // can only see half of it: the encounter layer's own occurrences arrive
    // later, appended by the caller. Where the span was shortened BEFORE the
    // skip - `asked > skip.requestedDays` - something demonstrably did find
    // them, and saying otherwise produced the flat contradiction a playtester
    // reported: "Something was already coming that would end it at 1.7 years"
    // followed immediately by "Nothing found you. 1.7 years went by in the
    // ordinary way." The player planned thirty years, got 1.7, and was told
    // nothing happened, which is strictly worse than either outcome.
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
    paragraphs.push(closing.join(' '));

    if (skip.died) {
        paragraphs.push(
            `${after.name} is dead - ${describeDeathCause(skip.deathCause, after.realmOrdinal)}. The run is closed and written to the ledger. There is no reload and no revival.`
        );
    }

    return paragraphs.join('\n\n');
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
    ambient: AmbientQi
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
        structure: [
            `outcome=${result.outcome}, from=${result.fromOrdinal}, to=${result.toOrdinal}, ` +
            `finalChance=${result.finalChance.toFixed(4)}, roll=${result.roll.toFixed(4)}, ` +
            `boundary=${isBoundaryCrossing(result)}.`,
            ...standingStructure(after, ambient)
        ],
        prose: breakthroughProse(before, after, result)
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

function breakthroughProse(before: Cultivator, after: Cultivator, result: BreakthroughResult): string {
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
     *
     * A player who has sworn to an order and walks into its seat was being
     * told the same thing a stranger would be told. Membership is the most
     * consequential thing a low cultivator can acquire and the world never
     * mentioned it again.
     */
    standing: string | null = null
): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    const where = placeName(cultivator);
    const who = describeCompany(company, cultivator.realmOrdinal);

    if (standing) lines.push(standing);
    if (who) lines.push(who);

    const prose = [
        `${where}. ${describeAmbientPerceived(ambient)}`,
        ...(standing ? [standing] : []),
        ...(who ? [who] : []),
        selfNoticing(cultivator)
    ].join('\n\n');

    return observable(`${where}.`, lines, prose, [
        ...standingStructure(cultivator, ambient),
        `present=${company.total} (named ${company.named.length}, unnamed ${company.strangers.length}).`
    ]);
}


/**
 * Who is about, asked directly.
 *
 * `look` and this used to return the same paragraph, which made asking the
 * narrower question pointless. Someone scanning a square for a face does not
 * want the weather: the people come first and the room is dropped entirely.
 * The discovery gate is the same one - being in the square is permission to
 * see somebody, never to know their name.
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
        [`present=${company.total} (named ${company.named.length}, unnamed ${company.strangers.length}).`]
    );
}

/**
 * Who is standing here, split by whether the player can put a name to them.
 *
 * The split is the discovery rule applied to people rather than to factions.
 * Nineteen people present does not mean nineteen names: being in the room is
 * permission to SEE somebody, not to know who they are, and a village square
 * that hands over a cast list has spent nineteen introductions at once.
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
 *
 * Below this everybody in a square reads the same, and describing five
 * strangers one at a time produces five identical clauses - which is what the
 * first version of this did. A crowd is a crowd; the person worth a sentence is
 * the one the others are being careful around.
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

        // The crowd clause and the standout clause are both written for a
        // plural, and a square with one or two people in it is common - a thin
        // county at dawn is most of the early game. Found by playing: the
        // second paragraph of a new run read "One other person ARE about, none
        // of whom are looking at you", and then sent THE OTHERS moving around
        // somebody who was the only other person there.
        //
        // So each count gets the sentence that is true of it. The plural
        // wording is kept exactly where it was for the case it was written
        // for; what is added is the two counts underneath it.
        if (others === 1) {
            sentences.push('one other person is about, and they are not looking at you.');
        } else if (others > 1) {
            sentences.push(
                `${roughly(others)} are about, none of whom are looking at you.`
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
 *
 * The sheet is already on screen. A fallback narrator that answers "look
 * around" with "Wen Shu, Qi Condensation Layer 4, 17 years old, 0 spirit stones
 * to their name" has written the sheet twice and the situation not at all. An
 * empty purse, a wound that has not closed and a year that went nowhere are all
 * things somebody notices about themselves; none of them are things they count.
 */
function selfNoticing(cultivator: Cultivator): string {
    const notes: string[] = [];
    const untreated = untreatedInjuryCount(cultivator.injuries);

    if (untreated >= CRIPPLING_UNTREATED_INJURIES) {
        // What somebody in this state would actually notice about themselves.
        //
        // This line has been rewritten twice. It first said standing up was a
        // decision; then it added a countdown, because untreated wounds gave
        // out on their own. They do not - a torn channel is a torn muscle - so
        // the countdown is gone and what is left is the thing that is true and
        // is worse to live with: nothing is getting better, and it has stopped
        // getting better on its own.
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
 *
 * Rank and dao are separate axes and only one of them is shut above the Lid.
 * `discoverableInsights` reads the spirit root and nothing else, and degree has
 * no ceiling tied to the ladder, so understanding keeps deepening at 45 and 46
 * exactly as it did below - which is the whole of what a False Immortal has to
 * do with a span that long, and the only honest answer to "where do I stand".
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
     *
     * `techniqueCeiling(...).line`, passed in rather than derived, because the
     * cap is the caller's to know and this module holds no catalog. Null is the
     * ordinary case and adds nothing.
     */
    ceiling: string | null = null
): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    if (progressRequired === null) {
        // No figure, because there is no rung above this one priced in qi -
        // handing the narrator a number here would be handing it a lie. But
        // saying only that leaves somebody above the Lid with a status read that
        // is entirely absences, which is the opposite of the truth about them.
        //
        // The rank is finished. The dao is not: insight formation, degree and
        // discovery never touched the ladder, so the one axis that still moves
        // is the one that was never counted in qi to begin with. For a False
        // Immortal it is the only thing left that can go up, and it is what six
        // hundred years of having nothing to attempt is actually spent on.
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
            `progress=${Math.round(cultivator.cultivationProgress)}/${progressRequired}, breakthroughReady=${ready}.`
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
 *
 * `intent` says how it was meant - travelling, fleeing, slipping in - and it is
 * carried into the account so the narrator can describe it. It selects nothing:
 * the engine resolves every movement the same way, and until the world layer's
 * capability predicates land it has no basis for treating a flight differently
 * from a stroll. Pretending otherwise would be inventing a mechanic in the
 * narration layer.
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

    const prose = skip.events.length === 0 && !skip.died
        ? `${before.name} went out of ${placeName(before)} and into ${destination}. ` +
          `${describeAmbientPerceived(ambientAfter)} Nothing happened on the road, which is not the same as nothing being on it.`
        : base.prose;

    return observable(
        `${destination}.`, lines, prose,
        [`ambientAfter=${ambientAfter}. ${describeAmbientInWorld(ambientAfter)}`, ...standingStructure(after, ambientAfter)]
    );
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
 *
 * `scene` is what the player sees, and it is the only part that is narrated: a
 * short piece of the world declining, in the world's own voice. `mechanical` is
 * why, in the engine's voice, and goes to the inspector and the play log.
 *
 * The split matters more here than anywhere else in this file. An error message
 * that reaches the player is a scene that failed to get written - naming the
 * engine, explaining the policy, or listing the valid targets all break the
 * fiction harder than bad prose ever could, and all three are the reflex of
 * writing for a developer and shipping it unaltered. Refusals still may not be
 * softened; they simply have to be in character.
 */
export function factsForRefusal(headline: string, scene: string, mechanical?: string): EngineFacts {
    return observable(headline, [scene], scene, mechanical ? [mechanical] : []);
}

// ─────────────────────────────────────────────────────────────────────────
// SEMANTIC ACTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * An examination.
 *
 * Everything in `subjectFacts` was read out of a row or a catalog entry. The
 * narrator dresses it; it does not get to add a detail the record does not
 * hold, which is the point of examining something in a simulation rather than
 * in a story.
 */
export function factsForInvestigation(
    cultivator: Cultivator,
    ambient: AmbientQi,
    subject: string,
    subjectFacts: readonly string[]
): EngineFacts {
    const lines = [
        `${cultivator.name} examined ${subject}. Nothing was moved, spent or taken; this was looking.`,
        ...subjectFacts,
        `Observed from ${placeName(cultivator)}.`,
        describeAmbientPerceived(ambient)
    ];
    return {
        headline: `${subject}, examined.`,
        structure: standingStructure(cultivator, ambient),
        lines,
        prose: [
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
     *
     * The ONLY thing this renderer is permitted to branch on. A place can hold
     * a cause that nobody has recovered - the seeded ruins all do - and the
     * answer for that case has to be indistinguishable from the answer for a
     * place whose cause was never written down at all. If the prose could be
     * read to say "there is a reason and you have not earned it", the gate has
     * been turned into a hint, and a hint is the whole prize.
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
 *
 * The shape of the answer is fixed and the knowledge gate decides only its last
 * paragraph. Everything above that - what it is now, that it changed, the year
 * it changed - is physical and observable by anybody with eyes. The cause is
 * the only part that is knowledge rather than perception, and it is the only
 * part that can be missing.
 *
 * When it is missing the answer is the disagreement, in full, with no ranking
 * and no hint of which of them is closest. A player who could tell the likely
 * story from the unlikely one by how it was phrased would be reading the
 * engine's opinion, and the engine does not have one.
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
            `location change ${i}: year ${c.year}, causeKnown=${c.causeKnown}, `
            + `explanations held locally=${c.attributed.length}.`),
        prose: lines.join('\n\n')
    };
}

/**
 * An attempted interaction.
 *
 * Note what this deliberately does NOT contain: an outcome. The engine can
 * state who this party is and what stands between them from real rows, and it
 * cannot yet resolve what came of the approach. Saying so plainly is the whole
 * discipline - an intent is an attempt, and an attempt narrated as an
 * accomplishment is the drift this architecture exists to prevent.
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
 *
 * The alternative would be to let the narrator describe it, and a described
 * outcome with no state change behind it is precisely the failure mode the
 * whole architecture is built against. So this is a first-class result: it says
 * what was attempted, that nothing happened, and which layer would have to
 * exist for something to happen.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS CULTIVATOR IS CARRYING
//
// Two reads, and the discipline is the same one that governs the whole
// knowledge layer: these renderers may say what the holder HOLDS and may not
// say what is true. A knowledge row that says a name got said and nothing else
// renders as a name that got said and nothing else, however thin that reads.
//
// The thinness is the content. `docs/world/discovery.md` wants a player to
// accumulate fragments they cannot place, and the moment this file starts
// helpfully joining two of them up, the revelation the player was supposed to
// earn over a hundred turns has been spent on a status read.
// ─────────────────────────────────────────────────────────────────────────

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
 * What the holder has on one name.
 *
 * Several rows for one query is the ordinary case and is never collapsed. A
 * cultivator who has heard four incompatible stories has four incompatible
 * stories, and the engine has no opinion about which of them is the real one -
 * working that out is the prize, and a renderer that ranked them would have
 * handed it over for the price of a question.
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
            `held: "${fact.name}" stance=${fact.stance}, source=${fact.sourceKind}, `
            + `day=${fact.acquiredOnDay}, earned lines=${fact.earned.length}.`),
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

    const byKind = new Map<string, string[]>();
    for (const row of held) {
        if (!byKind.has(row.kind)) byKind.set(row.kind, []);
        byKind.get(row.kind)!.push(row.name);
    }

    const lines = [`${held.length} names, and a name is most of what any of them is.`];
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
        headline: `${held.length} names.`,
        structure: [`knowledge records held: ${held.length} across ${byKind.size} kind(s).`],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * The other axis.
 *
 * Rank and dao are separate and only one of them can be shut, which is why
 * this read exists as its own answer rather than as a line on the status
 * sheet. For a cultivator whose ladder is finished it is not a subsection of
 * their condition - it is the whole of what they are still doing, and
 * `theOnlyAxisLeft` comes off the same predicate the engine refuses a
 * re-attempt with, so the sheet, the refusal and this sentence cannot disagree.
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
            `dao standing=${dao.standing}, subject=${dao.subject ?? 'none'}, depth=${dao.depth}, `
            + `breadth=${dao.breadth}, totalDegrees=${panel.totalDegrees}. `
            + `theOnlyAxisLeft=${panel.theOnlyAxisLeft}, read off the same predicate that gates a re-attempt.`
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * A course of mortal care, bought and taken.
 *
 * Reads out the price twice on purpose - what it cost in cash and what that
 * came to in stones - because the board quotes the first and the purse holds
 * the second, and a player who was shown "40 cash the visit" and charged
 * "1 stone" has been given two numbers with no bridge between them.
 *
 * The count of wounds still open is stated plainly and last. It is the number
 * the whole spiral turns on: untreated injuries raise deviation risk, and a
 * player who has paid for one course out of four needs to know they have not
 * bought their way out yet.
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
        for (const description of course.treated) {
            lines.push(`Closed: ${description} It is scar tissue now, and scar tissue costs nothing.`);
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

// ─────────────────────────────────────────────────────────────────────────
// INHERITANCE GROUNDS
//
// Four renderers for the four steps, and the split between the first two and
// the last two IS the structural gate. `SiteFace` has no interior key. Not
// "does not read one" - does not have one, so the compiler refuses a version
// of this file that leaks the inside through the outside view, exactly the
// way `outsideViewOf` refuses it one layer down. Everything an un-entered
// player can be told goes through {@link factsForSiteFace}, and everything
// that renderer can say is in the type it is handed.
//
// The other rule these carry: none of the prose below is composed. The
// marker, the rumour, the two readings, the chamber, what it does to people
// and what each gate does when it refuses were all authored beside the site
// in `inheritance-trials.ts`, and they are passed through verbatim. A
// renderer that paraphrased them would be a second, worse copy of the catalog
// living in the presentation layer.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A site as somebody standing outside it has it.
 *
 * Deliberately not derived from the catalog's `Site` by omission: it is
 * written out, so a field added to an interior can never widen this by
 * accident. Same reasoning, and the same wording, as `SiteOutsideView`.
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
    /** Graves only. Legible from the marker, and the whole of the useful read. */
    grave: {
        mannerOfDeath: string;
        burial: string;
        occupantOrdinal: number;
        yearsDead: number;
    } | null;
}

/** How a site is referred to when the player cannot name it. */
function siteHead(face: SiteFace): string {
    return face.name ?? (face.kind === 'grave' ? 'A grave nobody has attributed' : 'An unattributed site');
}

/**
 * Everything that can be learned without going in, and nothing else.
 *
 * `arriving` changes only the framing sentence. It does not change what is
 * disclosed, and it must not: a player who walked up to the threshold has
 * exactly what a player who stood back and read it has, because the gate
 * between outside and inside is a door rather than a distance.
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

    if (face.grave) {
        lines.push(
            `The manner of death is legible off the marker: ${face.grave.mannerOfDeath.replace(/_/g, ' ')}, `
            + `${face.grave.yearsDead} years ago, at ordinal ${face.grave.occupantOrdinal}. `
            + `${face.grave.burial.replace(/_/g, ' ')}.`
        );
    }
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
            `site ${face.kind}: awareness permits naming = ${face.name !== null}. `
            + `Advertised ordinal ${face.advertisedOrdinal ?? 'none'}, which is the rumour's number and `
            + 'not the room\'s - three entries in the catalog disagree with their own interior on purpose.',
            'Pre-entry view only. The interior was not read: this renderer has no field that could hold it.'
        ],
        lines,
        prose: lines.join('\n\n')
    };
}

/**
 * What this cultivator could name, when they named none.
 *
 * The same answer the sect listing gives and for the same reason: no entry in
 * the catalog carries a location, so "what is near here" cannot be answered by
 * distance and is answered by what has actually reached this person instead.
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
 *
 * This is the only renderer in the file that may hold interior text, and the
 * only caller that may build one is the branch in `game.ts` that has already
 * written the entry.
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
 *
 * `shortfall` is present exactly where the concept applies, and its absence on
 * a fate gate is the whole point of this renderer existing rather than one
 * generic refusal. A player refused by strength is told what they are short of
 * because getting stronger is a thing they can go and do. A player refused by
 * talent is told what the door wanted and that hitting it harder is not an
 * answer. A player refused by fate is told that it did not open, and nothing
 * else, because there is nothing else that is true - and a sentence implying
 * there is something to try would be the engine lying to keep them busy.
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
 *
 * `granted` and `withheld` both come back from `technique_manage.learn`, which
 * is the same handler the tool surface uses, so a manual sitting in a ruin
 * that the claimant cannot read comes back as the engine's own refusal rather
 * than as a silent nothing. That case is not a bug: the world says outright
 * that the top grades are written for somebody who has walked a road, which is
 * why such manuals sit in ruins unread.
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

    return {
        headline: found ? `${found.name}, pouched.` : 'Nothing worth carrying.',
        structure: base.structure,
        lines: [
            `${before.name} spent ${humanDays(skip.simulatedDays)} working the ground around ${placeName(before)}.`,
            outcome,
            ...base.lines
        ],
        prose: [
            `${humanDays(skip.simulatedDays)} bent over the ground around ${placeName(before)}.`,
            outcome
        ].join('\n\n')
    };
}

/**
 * What a house's ground is worth to the person standing in the queue for it.
 *
 * Ground is the largest multiplier in the model - ordinal 29 costs 317 years on
 * ordinary ground against 79 on a sealed vein - and a member's rank already
 * decides how much of the year they get on the good ground. Every NPC in the
 * world was getting that and the player had no sentence that reached it.
 *
 * Said in DAYS PER YEAR rather than as a fraction, because it is an entitlement
 * and not a resource: "fifty-one days a year on the vein" is a thing a person
 * can plan a life around, and "0.14" is not.
 *
 * The poor-house answer reads bleak on purpose. Unlimited access to ground
 * worth nothing is the honest description of a small house, and a player who
 * reads it as generous will stay somewhere that cannot carry them - which is
 * the difference between understanding why to leave and thinking you are fine.
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

    const { room, daysPerYear, chamberRate, fallbackRate, effectiveRate, atNextRank } = entitlement;
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
            `groundEntitlementFor: room=${room.id} density=${room.density} band=${room.band}, `
            + `daysPerYear=${daysPerYear}, chamberRate=${chamberRate ?? 'none'}, `
            + `fallbackRate=${fallbackRate}, effectiveRate=${effectiveRate}`
            + (atNextRank
                ? `, atNextRank[${atNextRank.rankIndex}]=${atNextRank.daysPerYear}d/${atNextRank.effectiveRate}`
                : ', atTop')
        ]
    );
    return facts;
}

/**
 * An attempt to move somebody, resolved.
 *
 * The sibling of `factsForInteraction`, which exists because for a long time
 * nothing here could resolve an approach and saying so plainly was the honest
 * answer. This is what replaces it now that `engine/social-leverage/` is
 * reachable: four outcomes, each with its own consequence, and none of them
 * "nothing is settled by it".
 *
 * Each outcome gets its own sentence deliberately. `turned` coming back as "It
 * is done. Nothing about it drew attention." is the invisible-fallback failure
 * this codebase has had four times, and it is worst here - being turned means
 * the person you leaned on is now working against you, which is the single most
 * consequential thing that can come out of a conversation.
 */
export function factsForAttempt(
    cultivator: Cultivator,
    subject: string,
    intent: string,
    result: AttemptResult,
    subjectFacts: readonly string[]
): EngineFacts {
    const lines: string[] = [`${cultivator.name} put it to ${subject}.`, ...subjectFacts];

    // The engine's own factual line first - it names who did what.
    lines.push(result.line);

    switch (result.outcome) {
        case 'taken':
            lines.push(
                result.stonesSpent > 0
                    ? `It was taken, and ${result.stonesSpent} spirit stones went with it.`
                    : 'It was taken.'
            );
            break;
        case 'refused':
            lines.push('It was refused, and it stayed between the two of you.');
            break;
        case 'reported':
            lines.push(
                'It was refused and it did not stay between the two of you. Somebody who was not '
                + 'in the room now knows what was asked for.'
            );
            break;
        case 'turned':
            lines.push(
                `${subject} is not merely unwilling. They have decided what you are, and they are `
                + 'going to act on it.'
            );
            break;
    }

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
            `resolveAttempt(${intent}): outcome=${result.outcome}, odds=${result.odds}, `
            + `days=${result.days}, stonesSpent=${result.stonesSpent}, `
            + `theyKnowWhatYouTried=${result.marks.theyKnowWhatYouTried}, `
            + `reachedTheHouse=${result.marks.reachedTheHouse}.`
        ]
    );
}

/**
 * Ground that would not have them, and who should go instead.
 *
 * The CAP, which is one of three ways the catalog closes ground and the only
 * one whose whole point is that somebody else must go. Nothing player-facing
 * ever read it, so a site written to say "this is not for you, send your
 * junior" had never once said it to anybody.
 *
 * THE PROSE IS THE CATALOG'S. `readAdmission` composes `account` out of the
 * site's own `whatReadsThePerson`, `whyItRefusesPower` and `soWhoGoesInstead` -
 * three strings written for that place and no other - and this renders it
 * unchanged. Composing a sentence here from `admits` and a ceiling would give
 * every capped site in the world the same voice, which is exactly the
 * difference between this surface and a template.
 *
 * It costs the days and nothing else. Being measured at a threshold and found
 * too large is not an injury: `groundForceOrdinalOf` returns null above the
 * line for that reason.
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
 *
 * The other side of the same read, and it exists so that clearing a floor is
 * an event rather than silence. `whatIsDownThere` and `whatComesBackForThatPerson`
 * are written per site; an elder floor in particular says who the errand is FOR,
 * which is the sentence that makes a senior's trip somebody else's inheritance.
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
