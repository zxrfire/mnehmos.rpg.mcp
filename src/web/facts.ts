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

import type {
    AmbientQi,
    BreakthroughResult,
    Cultivator,
    DeathCause,
    SimEvent,
    TimeSkipResult
} from '../schema/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';

export interface EngineFacts {
    /** One-line summary. Used as the overlay title and the log's first line. */
    headline: string;
    /**
     * The complete factual content of the outcome, one statement per entry.
     * This is what a narrator is allowed to know. Nothing else is sent.
     */
    lines: string[];
    /** The deterministic rendering, ready to show a player as-is. */
    prose: string;
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
    thin: 'The qi here is thin: drawn down long ago, or never rich. Cultivating in it is chewing on nothing - half rate, and breakthroughs suffer. Most of the world is like this and some of it is hopeless.',
    normal: 'The qi here is ordinary inhabited land. Progress is possible and unhurried.',
    dense: 'The qi here is dense - a vein close to the surface, or ground nobody has worked. Cultivation runs at double rate. Somebody owns this, or somebody is about to.',
    spirit_tide: 'A spirit tide is running: a vein shifting, a seal failing, a season turning over. The hair lifts on your arms and breathing is easier than it was an hour ago. Qi is three times as abundant, the heavens are unusually permissive, everyone within a hundred li can feel it, and it does not last.'
};

const DEATH_IN_WORLD: Record<DeathCause, string> = {
    combat_defeat: 'killed in combat',
    obviously_fatal_choice: 'forced a fight while barely able to stand',
    lifespan_exhausted: 'lifespan exhausted - died of old age at the ceiling of the realm',
    stagnation_aging: 'settled: fifty years at one realm, and the qi already inside them finished working on them instead',
    untreated_injuries: 'the meridians gave out, untreated',
    starvation: 'starved - the flesh keeps its mortal arithmetic',
    failed_breakthrough: 'the meridians ruptured mid-breakthrough',
    qi_deviation: 'qi deviation',
    heavenly_tribulation: 'destroyed by heavenly tribulation'
};

export function describeAmbientInWorld(ambient: AmbientQi): string {
    return AMBIENT_IN_WORLD[ambient];
}

export function describeDeathCause(cause: DeathCause | null | undefined): string {
    if (!cause) return 'cause unrecorded';
    return DEATH_IN_WORLD[cause] ?? cause.replace(/_/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED FRAGMENTS
// ─────────────────────────────────────────────────────────────────────────

export function placeName(cultivator: Pick<Cultivator, 'location'>): string {
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

/** The standing facts a narrator needs for any scene. */
export function standingLines(cultivator: Cultivator, ambient: AmbientQi): string[] {
    const untreated = untreatedInjuryCount(cultivator.injuries);
    const root = getSpiritRoot(cultivator.spiritRoot);
    return [
        `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}, in ${placeName(cultivator)}.`,
        `Spirit root: ${root.name}. Might ${cultivator.attributes.might}, Insight ${cultivator.attributes.insight}, Fortune ${cultivator.attributes.fortune}, Charm ${cultivator.attributes.charm}.`,
        `Cultivation progress ${Math.round(cultivator.cultivationProgress)} qi-units. HP ${cultivator.hp}/${cultivator.maxHp}. Satiety ${cultivator.satiety}/100. Spirit stones ${cultivator.spiritStones}.`,
        untreated === 0
            ? 'No untreated meridian injuries.'
            : `${untreated} untreated meridian injur${untreated === 1 ? 'y' : 'ies'}. Three, and the next fight is fatal.`,
        `Years at this realm without advancing: ${cultivator.yearsAtCurrentRealm.toFixed(1)} of the fifty that finish a cultivator.`,
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
    label = 'Seclusion'
): EngineFacts {
    const lines: string[] = [];

    lines.push(
        `${label} at ${placeName(before)}, ${describeAmbientInWorld(ambient).split('.')[0].toLowerCase()}.`
    );
    lines.push(
        skip.simulatedDays === skip.requestedDays
            ? `${humanDays(skip.requestedDays)} passed as asked.`
            : `${humanDays(skip.requestedDays)} was asked for; ${humanDays(skip.simulatedDays)} passed before something returned control.`
    );
    if (skip.interrupted && skip.interruptReason) {
        lines.push(`The engine stopped the skip: ${skip.interruptReason.replace(/[_:]/g, ' ')}.`);
    }

    for (const event of skip.events) {
        lines.push(`Day ${Math.round(event.dayOffset)}: ${event.summary}`);
    }

    lines.push(netChangeLine(skip));
    lines.push(
        `Standing afterwards: ${rankName(after.realmOrdinal)}, age ${Math.floor(after.age)}, ` +
        `${untreatedInjuryCount(after.injuries)} untreated injuries, ${after.spiritStones} spirit stones.`
    );
    if (skip.died) {
        lines.push(`${after.name} is dead: ${describeDeathCause(skip.deathCause)}. The run is closed. There is no reload.`);
    }

    return {
        headline: timeSkipHeadline(skip, before, after),
        lines,
        prose: timeSkipProse(before, after, skip, ambient, label)
    };
}

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
    label: string
): string {
    const paragraphs: string[] = [];
    const where = placeName(before);

    const opening = ambient === 'thin'
        ? `${where}. The qi is thin here; it always has been. ${before.name} sat down anyway.`
        : ambient === 'spirit_tide'
            ? `${where}. A tide was running when ${before.name} sat down, and for once the air gave more than it asked.`
            : ambient === 'dense'
                ? `${where}. There is a vein under this ground, close enough to feel. ${before.name} sat down on top of it.`
                : `${where}. ${before.name} sat down and began to breathe.`;
    paragraphs.push(`${opening} ${label} of ${humanDays(skip.requestedDays)} was intended.`);

    if (skip.events.length === 0) {
        paragraphs.push(
            `Nothing found you. ${humanDays(skip.simulatedDays)} went by in the ordinary way, which in this world is the good outcome and almost never the interesting one.`
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
        closing.push(`${skip.deltas.realmOrdinal} rank${skip.deltas.realmOrdinal === 1 ? '' : 's'} were gained in that stretch.`);
    }
    if (untreated > 0) {
        closing.push(`${untreated} meridian injur${untreated === 1 ? 'y is' : 'ies are'} still untreated, and nothing heals them on its own.`);
    }
    if (skip.deltas.spiritStones !== 0) {
        closing.push(`Spirit stones: ${after.spiritStones}, a change of ${signed(skip.deltas.spiritStones)}.`);
    }
    if (after.satiety <= 20 && after.alive) {
        closing.push(`Satiety is down to ${after.satiety}. Qi feeds the meridians; it does not feed the body.`);
    }
    paragraphs.push(closing.join(' '));

    if (skip.died) {
        paragraphs.push(
            `${after.name} is dead - ${describeDeathCause(skip.deathCause)}. The run is closed and written to the ledger. There is no reload and no revival.`
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
    lines.push(describeAmbientInWorld(ambient));
    lines.push(result.narrationHint);

    if (result.tribulation) {
        lines.push(
            `Heavenly tribulation: ${result.tribulation.strikes} strikes. ` +
            `${result.tribulation.survived ? 'Survived.' : 'Not survived.'} ` +
            'The lightning is the seam of the Lid discharging. It is not personal.'
        );
    }
    for (const injury of result.injuriesSustained) {
        lines.push(`Injury sustained: ${injury.description} (${injury.severity}, untreated).`);
    }
    lines.push(`Progress consumed: ${Math.round(result.progressConsumed)} qi-units.`);
    if (result.outcome === 'success' && isBoundaryCrossing(result)) {
        lines.push(
            'This crossed a realm boundary, where the crossing demands that something be cut away. ' +
            'What it takes is never a stat: a person who knew you, a memory you were using to stay ' +
            'yourself, a mastered technique, or at the highest crossings a name. It is rolled, not certain.'
        );
    }
    lines.push(
        `Standing afterwards: ${rankName(after.realmOrdinal)}, ${untreatedInjuryCount(after.injuries)} untreated injuries, ${Math.round(after.cultivationProgress)} progress remaining.`
    );

    return {
        headline: breakthroughHeadline(result, before),
        lines,
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

export function factsForLook(cultivator: Cultivator, ambient: AmbientQi): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    const where = placeName(cultivator);
    const untreated = untreatedInjuryCount(cultivator.injuries);

    const prose = [
        `${where}. ${describeAmbientInWorld(ambient)}`,
        `${cultivator.name}, ${rankName(cultivator.realmOrdinal)}, ${Math.floor(cultivator.age)} years old, ${cultivator.spiritStones} spirit stones to their name.` +
        (untreated > 0 ? ` ${untreated} meridian injur${untreated === 1 ? 'y' : 'ies'} still open.` : '')
    ].join('\n\n');

    return { headline: `${where}.`, lines, prose };
}

export function factsForStatus(cultivator: Cultivator, ambient: AmbientQi, progressRequired: number, ready: boolean): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    lines.push(
        ready
            ? `Enough progress has accumulated to attempt the next rank: ${Math.round(cultivator.cultivationProgress)} of ${progressRequired} required.`
            : `${Math.round(cultivator.cultivationProgress)} of ${progressRequired} qi-units toward the next rank. Not yet eligible.`
    );
    return {
        headline: `${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}.`,
        lines,
        prose: lines.join('\n')
    };
}

export function factsForTalk(cultivator: Cultivator, ambient: AmbientQi, target: string | undefined): EngineFacts {
    const who = target?.trim() || 'whoever is within earshot';
    const lines = [
        `${cultivator.name} spoke to ${who}. No engine system resolved this: no trade, no sect standing, no relationship state changed.`,
        ...standingLines(cultivator, ambient)
    ];
    return {
        headline: `A conversation with ${who}.`,
        lines,
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
        `The qi at the destination: ${describeAmbientInWorld(ambientAfter)}`,
        ...base.lines
    ];

    const prose = skip.events.length === 0 && !skip.died
        ? `${before.name} went out of ${placeName(before)} and into ${destination}. ` +
          `${describeAmbientInWorld(ambientAfter)} Nothing happened on the road, which is not the same as nothing being on it.`
        : base.prose;

    return { headline: `${destination}.`, lines, prose };
}

export function factsForEat(cultivator: Cultivator, satietyRestored: number, stonesSpent: number): EngineFacts {
    const lines = [
        `${cultivator.name} ate. Satiety restored by ${satietyRestored} to ${cultivator.satiety}/100; ${stonesSpent} spirit stone${stonesSpent === 1 ? '' : 's'} spent, leaving ${cultivator.spiritStones}.`,
        'Qi feeds the meridians. It does not feed the body. Until a Grain Abstinence Pill, the flesh keeps its mortal arithmetic.'
    ];
    return {
        headline: `Fed. ${cultivator.spiritStones} stones left.`,
        lines,
        prose:
            `A meal, bought for ${stonesSpent} spirit stone${stonesSpent === 1 ? '' : 's'}. Satiety back to ${cultivator.satiety}. ` +
            `Half the deaths in this world are logistical, and a Qi Condensation cultivator who forgets to eat dies exactly as fast as a farmer who does, ` +
            `and considerably more embarrassingly.`
    };
}

/**
 * An action the engine declined. Refusals are facts too, and they are the ones
 * a narrator is most tempted to soften, so they are stated flatly.
 */
export function factsForRefusal(headline: string, detail: string): EngineFacts {
    return { headline, lines: [detail], prose: detail };
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
        `Observed from ${placeName(cultivator)}, at ${rankName(cultivator.realmOrdinal)}.`,
        describeAmbientInWorld(ambient)
    ];
    return {
        headline: `${subject}, examined.`,
        lines,
        prose: [
            `${subject}. ${subjectFacts.join(' ')}`,
            'That is what the record holds. What it means is a separate question, and nobody in ' +
            `${placeName(cultivator)} is obliged to answer it.`
        ].join('\n\n')
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
    return {
        headline: `${subject}, approached.`,
        lines: [
            `${cultivator.name} approached ${subject}. Stated intent: ${intent}.`,
            'This is an attempt, not an outcome. Nothing has been agreed, bought, believed or refused.',
            ...subjectFacts,
            unresolved
        ],
        prose: [
            `${cultivator.name} goes to ${subject}. The intent is ${intent}.`,
            subjectFacts.join(' '),
            `What comes of it is not settled. ${unresolved}`
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
    const detail =
        `The engine cannot resolve that yet: ${attempt}. Nothing in the world changed, no time passed, ` +
        `and nothing was spent. ${missing}`;
    return {
        headline: 'The engine has no answer for that yet.',
        lines: [detail],
        prose: detail
    };
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
    return {
        headline,
        lines: [...lines],
        prose: prose ?? lines.join('\n')
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
