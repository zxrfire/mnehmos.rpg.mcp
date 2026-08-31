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
    LETHAL_UNTREATED_INJURIES,
    stagnationYearsForOrdinal,
    type AmbientQi,
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

/** Mechanical reading. Inspector and log only - never a narrator prompt. */
export function describeAmbientInWorld(ambient: AmbientQi): string {
    return AMBIENT_IN_WORLD[ambient];
}

/** What it is like to stand in it. The narration-safe rendering. */
export function describeAmbientPerceived(ambient: AmbientQi): string {
    return AMBIENT_PERCEIVED[ambient];
}

export function describeDeathCause(cause: DeathCause | null | undefined): string {
    if (!cause) return 'cause unrecorded';
    return DEATH_IN_WORLD[cause] ?? cause.replace(/_/g, ' ');
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
        untreated === 0
            ? 'The meridians are whole.'
            : `${untreated} meridian injur${untreated === 1 ? 'y is' : 'ies are'} still open, and have been since they were taken.`,
        `${cultivator.yearsAtCurrentRealm.toFixed(1)} years at this realm without advancing.`,
        describeAmbientPerceived(ambient)
    ];
}

/** The thresholds behind those numbers. Inspector only. */
export function standingStructure(cultivator: Cultivator, ambient: AmbientQi): string[] {
    return [
        `realmOrdinal=${cultivator.realmOrdinal} (${rankName(cultivator.realmOrdinal)}), spiritRoot=${cultivator.spiritRoot}, foundation=${cultivator.foundationQuality}.`,
        `untreatedInjuries=${untreatedInjuryCount(cultivator.injuries)} of ${LETHAL_UNTREATED_INJURIES} lethal; ` +
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
    label = 'Seclusion'
): EngineFacts {
    const lines: string[] = [];

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
        structure: standingStructure(after, ambient),
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
    company: Company = { named: [], strangers: [], total: 0 }
): EngineFacts {
    const lines = standingLines(cultivator, ambient);
    const where = placeName(cultivator);
    const who = describeCompany(company, cultivator.realmOrdinal);

    if (who) lines.push(who);

    const prose = [
        `${where}. ${describeAmbientPerceived(ambient)}`,
        ...(who ? [who] : []),
        selfNoticing(cultivator)
    ].join('\n\n');

    return observable(`${where}.`, lines, prose, [
        ...standingStructure(cultivator, ambient),
        `present=${company.total} (named ${company.named.length}, unnamed ${company.strangers.length}).`
    ]);
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

        if (others > 0) {
            sentences.push(
                `${roughly(others)} are about, none of whom are looking at you.`
            );
        }
        if (standsOut) {
            sentences.push(
                `One of them is ${describeStanding(observerOrdinal, deepest.ordinal)}, ` +
                'and the way the others move around them is the part worth noticing.'
            );
        }
    }

    return sentences.length > 0 ? sentences.join(' ') : null;
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

    if (untreated >= LETHAL_UNTREATED_INJURIES) {
        notes.push('Three things have gone wrong inside and none of them have closed. Standing up is a decision now.');
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

    return notes.length > 0
        ? notes.join(' ')
        : 'Nothing about the day is urgent, which in this world is worth noticing on its own.';
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
        structure: [
            ...standingStructure(cultivator, ambient),
            `progress=${Math.round(cultivator.cultivationProgress)}/${progressRequired}, breakthroughReady=${ready}.`
        ],
        prose: lines.join('\n')
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
        structure: [],
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
