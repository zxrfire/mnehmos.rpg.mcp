/**
 * The cadence: when the world gets a chance to do something.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import {
    ARRIVAL_PER_FACT_CHANCE,
    MAX_ARRIVAL_CANDIDATES,
    locatabilityApplies,
    socialReach,
    ENCOUNTER_GRID_DAYS,
    MAX_OCCURRENCES_PER_WINDOW,
    SPAN_ENCOUNTER_CHANCE,
    TURN_ENCOUNTER_CHANCE,
    activityProfile,
    arrivalExposure,
    placeRateMultiplier
} from './activity.js';
import { drawEncounter, encounterPool, type WeightedEntry } from './select.js';
import { summonsPool, type DutyCandidate } from './duties.js';
import {
    CONTACT_SPAN_CHANCE,
    CONTACT_TURN_CHANCE,
    contactFor,
    withinSocialRange,
    type ContactPerson
} from './contact.js';
import { resolveOccurrence } from './resolve.js';
import { fillTokens } from './tokens.js';
import { valenceOf } from './valence.js';
import type {
    ArrivableFact,
    Duty,
    DutyMouth,
    EncounterOccurrence,
    EncounterRoll,
    EncounterRollInput,
    Scene
} from './types.js';

// FORTUNE

/** Chance a good thing has already been taken, before Fortune. */
export const WINDOW_SHUT_BASE = 0.34;
export const WINDOW_SHUT_PER_FORTUNE = -0.09;
/** Chance an avoidable bad thing goes past instead of arriving. */
export const PASSES_BY_BASE = 0.1;
export const PASSES_BY_PER_FORTUNE = 0.1;

// BEING SENT FOR
//
// A separate check from everything else, because an institution acts on its
// own schedule rather than on whether the cultivator happened to walk past
// something. And it uses `arrivalExposure` rather than `exposure`, for the
// same reason a war does: a house that wants somebody sends somebody to the
// cave. A door is not an answer to being wanted.
//
// `sealed` still produces nothing, because its arrival exposure is zero. The
// formation holds against the house too, which is the bargain and is also the
// honest reading - nobody gets a message through a closed-door seclusion.

/** Chance the house sends for somebody over the act of doing something. */
export const SUMMONS_TURN_CHANCE = 0.028;
/** Chance per grid check that the house sends for somebody across a span. */
export const SUMMONS_SPAN_CHANCE = 0.0045;

/** Fortune clamped to its legal range, defensively. Mirrors `time-skip.ts`. */
function fortuneOf(fortune: number): number {
    return Number.isFinite(fortune) ? Math.max(0, Math.min(3, fortune)) : 0;
}

// THE ROLL

/**
 * Everything that happens to one cultivator across one window of days.
 *
 * The narrow Fortune rule from `time-skip.ts`, unchanged and deliberately not
 * extended: Fortune moves whether a thing ARRIVES and whether a window is still
 * OPEN. It never touches damage, never softens a resolution and never
 * manufactures a branch. Here that is exactly two places, and the samples for
 * both are drawn unconditionally so two cultivators of different Fortune stay on
 * the same stream.
 */
export function rollEncounters(input: EncounterRollInput): EncounterRoll {
    const startDay = Math.max(0, Math.floor(input.startDay));
    const days = Math.max(0, Math.floor(input.days));
    const profile = activityProfile(input.activity);
    const pool = encounterPool({
        ordinal: input.cultivator.realmOrdinal,
        activity: input.activity,
        place: input.place,
        locatability: input.locatability
    });

    const arrivable = [...(input.arrivable ?? [])];
    const empty: EncounterRoll = {
        occurrences: [],
        firstInterruptDay: null,
        checks: 0,
        poolSize: pool.length
    };
    if (profile.exposure <= 0 && arrivalExposure(input.activity) <= 0) return empty;

    const limit = Math.max(1, Math.min(input.limit ?? MAX_OCCURRENCES_PER_WINDOW, 32));
    const placeRate = placeRateMultiplier(input.place);
    const occurrences: EncounterOccurrence[] = [];
    let checks = 0;

    // the occasion
    // Day zero of the window, so a one-day turn has exactly one chance and a
    // long span is not charged twice for its first fortnight.
    const occasionChance = TURN_ENCOUNTER_CHANCE * profile.exposure * placeRate;
    checks++;
    const occasion = attempt(input, pool, startDay, 0, occasionChance, 'occasion');
    if (occasion) occurrences.push(occasion);

    // The house asks first. Drawn before the world's own coincidences so that
    // a turn which produced both reports the summons as the thing that
    // happened, which is what it is.
    if (!interruptedIn(occurrences)) {
        const sent = attemptSummons(
            input, startDay, 0,
            SUMMONS_TURN_CHANCE * arrivalExposure(input.activity) * placeRate,
            'occasion'
        );
        if (sent) occurrences.push(sent);
    }

    // Ordinary company, last, because it is the thing that yields to anything
    // else happening. A day with a muster in it is not also a day somebody
    // dropped by.
    if (occurrences.length === 0) {
        const met = attemptContact(input, startDay, 0, CONTACT_TURN_CHANCE * placeRate);
        if (met) occurrences.push(met);
    }

    // the span
    if (!interruptedIn(occurrences)) {
        const spanChance = SPAN_ENCOUNTER_CHANCE * profile.exposure * placeRate;
        const firstGrid = nextGridDay(startDay);

        for (let day = firstGrid; day <= startDay + days; day += ENCOUNTER_GRID_DAYS) {
            if (occurrences.length >= limit) break;
            checks++;

            const drawn = attempt(input, pool, day, day - startDay, spanChance, 'span');
            if (drawn) {
                occurrences.push(drawn);
                if (drawn.interrupts) break;
            }

            const sent = attemptSummons(
                input, day, day - startDay,
                SUMMONS_SPAN_CHANCE * arrivalExposure(input.activity) * placeRate,
                'span'
            );
            if (sent) {
                occurrences.push(sent);
                if (sent.interrupts) break;
                continue;
            }

            const met = attemptContact(input, day, day - startDay, CONTACT_SPAN_CHANCE * placeRate);
            if (met) {
                occurrences.push(met);
                if (met.interrupts) break;
            }
        }
    }

    // what arrived
    // Rolled per candidate rather than per day, then merged into the timeline,
    // so the world's own event volume is what decides how often it reaches
    // anybody. Merged after the grid loop and re-cut below, because an arrival
    // in year two invalidates a catalog draw in year nine and the truncation
    // has to be taken from the earliest interruption of either kind.
    for (const arrived of rollArrivals(input, arrivable, startDay, days)) {
        occurrences.push(arrived);
    }

    occurrences.sort((a, b) => a.dayOffset - b.dayOffset || (a.id < b.id ? -1 : 1));
    const cut = occurrences.findIndex(o => o.interrupts);
    const kept = cut === -1 ? occurrences : occurrences.slice(0, cut + 1);
    const interrupt = cut === -1 ? null : kept[kept.length - 1];

    return {
        occurrences: kept.slice(0, limit),
        firstInterruptDay: interrupt ? interrupt.absoluteDay : null,
        checks,
        poolSize: pool.length
    };
}

function interruptedIn(occurrences: readonly EncounterOccurrence[]): boolean {
    return occurrences.some(o => o.interrupts);
}

/** The first grid day strictly after `startDay`. Never `startDay` itself. */
function nextGridDay(startDay: number): number {
    return (Math.floor(startDay / ENCOUNTER_GRID_DAYS) + 1) * ENCOUNTER_GRID_DAYS;
}

// ONE CHECK

function attempt(
    input: EncounterRollInput,
    pool: readonly WeightedEntry[],
    absoluteDay: number,
    dayOffset: number,
    chance: number,
    stage: string
): EncounterOccurrence | null {
    if (pool.length === 0) return null;

    // Four samples, drawn unconditionally and in a fixed order, so that two
    // cultivators of different Fortune standing in the same place on the same
    // day stay aligned on the stream. The same discipline `time-skip.ts` keeps.
    const rng = forStream(input.seed, 'enc.check', absoluteDay, stage, input.cultivator.id);
    const came = rng.next();
    const shut = rng.next();
    const passes = rng.next();
    void rng.next();

    if (came >= clampChance(chance)) return null;

    const draw = forStream(input.seed, 'enc.draw', absoluteDay, stage, input.cultivator.id);
    const entry = drawEncounter(pool, input.activity, draw);
    if (!entry) return null;

    const fortune = fortuneOf(input.cultivator.fortune);
    const valence = valenceOf(entry);

    // Luck generates opportunity, not success. Arriving four days late is
    // exactly what low Fortune means, and it is the whole of what it means.
    let outcome: 'landed' | 'passed_by' | 'missed' = 'landed';
    if (valence === 'good' && !entry.interrupts) {
        const shutChance = clampChance(WINDOW_SHUT_BASE + fortune * WINDOW_SHUT_PER_FORTUNE);
        if (shut < shutChance) outcome = 'missed';
    } else if (valence === 'bad' && entry.tags.includes('avoidable')) {
        const passChance = clampChance(PASSES_BY_BASE + fortune * PASSES_BY_PER_FORTUNE);
        if (passes < passChance) outcome = 'passed_by';
    }

    const threat = entry.threatOrdinal === null
        ? 0
        : entry.threatOrdinal - input.cultivator.realmOrdinal;

    const filled = fillTokens({
        entry,
        ordinal: input.cultivator.realmOrdinal,
        place: input.place,
        cast: input.cast ?? [],
        names: input.names ?? {},
        rng: forStream(input.seed, 'enc.fill', absoluteDay, entry.id, input.cultivator.id),
        absoluteDay,
        threatGap: threat,
        spoken: outcome === 'landed'
    });

    return resolveOccurrence({
        entry,
        activity: input.activity,
        ordinal: input.cultivator.realmOrdinal,
        maxHp: input.cultivator.maxHp,
        hp: input.cultivator.hp,
        spiritStones: input.cultivator.spiritStones,
        absoluteDay,
        dayOffset,
        values: filled.values,
        grants: filled.grants,
        castIds: filled.castIds,
        cast: input.cast ?? [],
        outcome
    });
}

// BEING SENT FOR

/**
 * The house asking for this person by name.
 */
function attemptSummons(
    input: EncounterRollInput,
    absoluteDay: number,
    dayOffset: number,
    chance: number,
    stage: string
): EncounterOccurrence | null {
    const membership = input.membership ?? null;
    if (!membership || chance <= 0) return null;

    // The house has to know where to send somebody. This is the other half of
    // "a senior sister may come looking for you": on the house's own ground she
    // knows which cave, and three provinces away under a false name nobody
    // does. Belonging is only worth something where you can be found.
    const findable = locatabilityApplies(input.activity)
        ? socialReach(input.locatability ?? 'private')
        : 1;
    if (findable <= 0) return null;

    const pool = summonsPool(input.cultivator.realmOrdinal, membership);
    if (pool.length === 0) return null;

    const rng = forStream(input.seed, 'enc.summons', absoluteDay, stage, input.cultivator.id);
    const came = rng.next();
    const which = rng.next();
    if (came >= clampChance(chance * findable)) return null;

    const candidate = pickCandidate(pool, which);
    const terms = candidate.terms;
    const mouth = mouthFor(input, membership, rng);

    const duty: Duty = {
        origin: terms.origin,
        posture: terms.posture,
        factionId: membership.factionId,
        factionName: membership.factionName,
        days: terms.days,
        contribution: terms.contribution,
        stones: terms.stones,
        pitchOrdinal: terms.pitchOrdinal,
        dueOnDay: absoluteDay + terms.days,
        refusal: terms.refusal,
        scale: terms.scale,
        cohort: terms.cohort,
        access: terms.access,
        spokenBy: mouth
    };

    const filled = fillTokens({
        entry: candidate.entry,
        ordinal: input.cultivator.realmOrdinal,
        place: input.place,
        cast: input.cast ?? [],
        names: input.names ?? {},
        rng: forStream(input.seed, 'enc.fill', absoluteDay, candidate.entry.id, input.cultivator.id),
        absoluteDay,
        threatGap: (candidate.entry.threatOrdinal ?? input.cultivator.realmOrdinal)
            - input.cultivator.realmOrdinal,
        spoken: true
        // Deliberately NOT forcing `{faction}` to the summoning house.
        //
        // It reads as the obvious thing to do and it produces nonsense: on
        // `enc-plague-village` the `{faction}` slot means "the body that has
        // not sent anybody", so forcing it gave "Azure Cloud Pavilion has not
        // sent anyone" immediately followed by Azure Cloud Pavilion sending
        // this cultivator. The summoning house is named once, in `dutyLine`,
        // where it is unambiguously the party doing the asking - and the
        // entry's own `{faction}` keeps meaning whatever the entry meant.
    });

    return resolveOccurrence({
        entry: candidate.entry,
        activity: input.activity,
        ordinal: input.cultivator.realmOrdinal,
        maxHp: input.cultivator.maxHp,
        hp: input.cultivator.hp,
        spiritStones: input.cultivator.spiritStones,
        absoluteDay,
        dayOffset,
        values: filled.values,
        grants: filled.grants,
        castIds: filled.castIds,
        cast: input.cast ?? [],
        outcome: 'landed',
        duty
    });
}

/** Weighted pick over the duty pool, on the catalog's own weights. */
function pickCandidate(pool: readonly DutyCandidate[], sample: number): DutyCandidate {
    const total = pool.reduce((sum, row) => sum + row.weight, 0);
    let cursor = clampSample(sample) * total;
    for (const row of pool) {
        cursor -= row.weight;
        if (cursor < 0) return row;
    }
    return pool[pool.length - 1];
}

function clampSample(sample: number): number {
    if (!Number.isFinite(sample)) return 0;
    return Math.max(0, Math.min(0.999999999, sample));
}

/**
 * Who brought the order.
 */
function mouthFor(
    input: EncounterRollInput,
    membership: { rankIndex: number },
    rng: CultivationRNG
): DutyMouth | null {
    const roster = input.roster ?? [];
    if (roster.length === 0) return null;

    const senior = roster.filter(p => p.rankIndex > membership.rankIndex);
    const pool = senior.length > 0 ? senior : roster;
    const picked = pool[Math.min(pool.length - 1, Math.floor(rng.next() * pool.length))];

    return {
        id: picked.id,
        name: picked.name,
        rankIndex: picked.rankIndex,
        realmOrdinal: picked.realmOrdinal,
        known: picked.known ?? false,
        detail: picked.detail ?? null
    };
}

// SOMEBODY FROM THE HOUSE

/**
 * Ordinary contact with the people you live with.
 */
function attemptContact(
    input: EncounterRollInput,
    absoluteDay: number,
    dayOffset: number,
    chance: number
): EncounterOccurrence | null {
    const membership = input.membership ?? null;
    const roster = input.roster ?? [];
    if (!membership || roster.length === 0 || chance <= 0) return null;

    const rng = forStream(input.seed, 'enc.contact', absoluteDay, input.cultivator.id);
    const came = rng.next();
    if (came >= clampChance(chance)) return null;


    const contact = contactFor({
        ordinal: input.cultivator.realmOrdinal,
        membership,
        roster,
        activity: input.activity,
        locatability: input.locatability ?? 'private',
        onDay: absoluteDay,
        rng
    });
    if (!contact) return null;

    // Being in an event with somebody is how they stop being a stranger. The
    // same grant every other encounter uses, so there is one promotion path.
    const grants = contact.person.known
        ? []
        : [{
            kind: 'cultivator' as const,
            id: contact.person.id,
            name: contact.person.name,
            sourceKind: 'witnessed' as const,
            sourceNote: `Of the same house. Met on day ${Math.round(absoluteDay)}.`,
            stance: 'knows' as const,
            confidence: 0.9,
            statement: `${contact.person.name} is somebody from their own house.`
        }];

    return {
        id: `contact:${contact.kind}:${contact.person.id}`,
        entryId: null,
        kind: 'contact',
        // Company is not a windfall and friction is not a wound. Neither is the
        // world doing something to somebody; it is the world containing them.
        valence: 'neutral',
        dayOffset,
        absoluteDay,
        interrupts: contact.interrupts,
        stance: 'none',
        event: {
            kind: 'npc_event',
            dayOffset,
            summary: contact.line,
            interrupts: contact.interrupts,
            occurrences: 1,
            data: {
                contactKind: contact.kind,
                personId: contact.person.id,
                tieType: contact.tie.type,
                tieStrengthDelta: contact.tie.strengthDelta,
                absoluteDay
            }
        },
        deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 },
        confrontation: null,
        duty: null,
        scene: null,
        contact,
        grants,
        castIds: [contact.person.id],
        source: 'contact'
    };
}

// AN ARRIVAL

/**
 * Magnitude at or above which a thing that turns up stops the day. Between
 * `SECT_MAGNITUDE` and `MARKET_MAGNITUDE` in `digest.ts`, deliberately: a thing
 * big enough that the market would have talked about it is big enough to stop
 * somebody when it happens on top of them instead.
 */
export const ARRIVAL_INTERRUPT_MAGNITUDE = 0.6;

/**
 * Which of the things already happening in the world turned up here.
 */
function rollArrivals(
    input: EncounterRollInput,
    arrivable: readonly ArrivableFact[],
    startDay: number,
    days: number
): EncounterOccurrence[] {
    const exposure = arrivalExposure(input.activity);
    if (arrivable.length === 0 || exposure <= 0) return [];

    // THE BACKLOG IS NOT THE WORLD'S EVENT VOLUME
    //
    // See MAX_ARRIVAL_CANDIDATES. The per-fact rate is calibrated on what is
    // HAPPENING; the list handed in is everything that ever happened and never
    // reached this cultivator, which only grows. Unbounded, the chance that at
    // least one arrival interrupts goes to one and the earliest of many uniform
    // draws goes to zero, so a long-lived player's every seclusion is cut short
    // near its start and the ladder becomes unclimbable by arithmetic.
    //
    // WHICH of them, drawn per window rather than taken off the top.
    //
    // The first version of this took the most recent, and that starves the
    // backlog: the same tail is examined in every window forever, so anything
    // below the cap can never arrive at all. That breaks the property this
    // whole system is built on - "a consequence that reached nobody in year
    // three can still reach them in year nine" - and a guard caught it.
    //
    // Sampled instead, on a stream keyed to the window, so which facts get
    // looked at rotates while the ARRIVAL roll below stays keyed to the fact
    // itself. Each fact therefore still has exactly one lifetime answer; the
    // bound is only on how many of them may be asked at once.
    const considered = arrivable.length <= MAX_ARRIVAL_CANDIDATES
        ? [...arrivable]
        : [...arrivable]
            .map(fact => ({
                fact,
                pick: forStream(
                    input.seed, 'enc.arrive.pick', fact.factId, startDay, input.cultivator.id
                ).next()
            }))
            .sort((a, b) => a.pick - b.pick || (a.fact.factId < b.fact.factId ? -1 : 1))
            .slice(0, MAX_ARRIVAL_CANDIDATES)
            .map(row => row.fact);

    const out: EncounterOccurrence[] = [];
    for (const fact of considered) {
        const rng = forStream(input.seed, 'enc.arrive', fact.factId, input.cultivator.id);
        const came = rng.next();
        const when = rng.next();

        // Weighted on magnitude: the bigger a thing is, the harder it is to be
        // somewhere it is happening and not notice.
        const chance = clampChance(
            ARRIVAL_PER_FACT_CHANCE * exposure * Math.max(0.2, Math.min(1, fact.magnitude))
        );
        if (came >= chance) continue;

        // On its own day where the fact has one inside the window, otherwise
        // somewhere in it. A fact dated outside the window still arrives - what
        // reaches somebody is a consequence, and consequences run late.
        const dated = Math.floor(fact.day);
        const dayOffset = dated >= startDay && dated <= startDay + days
            ? dated - startDay
            : Math.floor(when * Math.max(1, days));
        const absoluteDay = startDay + dayOffset;

        // Something still running when they got there is a different event
        // from something that has finished happening, and the world layer is
        // what knows which it is. A scene always interrupts: walking on is a
        // decision and the player gets to make it.
        const scene: Scene | null = fact.inProgress
            ? {
                locationId: fact.inProgress.locationId,
                endsOnDay: fact.inProgress.endsOnDay,
                threatOrdinal: fact.inProgress.threatOrdinal ?? null,
                involved: fact.inProgress.involved ?? 0,
                daysLeft: Math.max(0, Math.floor(fact.inProgress.endsOnDay - absoluteDay))
            }
            : null;

        const interrupts = scene !== null
            ? scene.daysLeft > 0
            : fact.magnitude >= ARRIVAL_INTERRUPT_MAGNITUDE;

        out.push({
            id: `digest:${fact.factId}`,
            entryId: null,
            kind: 'arrival',
            // A world event landing on somebody is not a gift and not a wound.
            // It is the world, and calling it either would be this layer
            // deciding something the pressure layer already decided.
            valence: 'neutral',
            dayOffset,
            absoluteDay,
            interrupts,
            stance: 'none',
            event: {
                kind: 'npc_event',
                dayOffset,
                summary: sceneSummary(fact.text, scene),
                interrupts,
                occurrences: 1,
                data: {
                    factId: fact.factId,
                    magnitude: fact.magnitude,
                    factKind: fact.kind ?? null,
                    absoluteDay,
                    arrival: true,
                    sceneEndsOnDay: scene?.endsOnDay ?? null,
                    sceneDaysLeft: scene?.daysLeft ?? null
                }
            },
            deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 },
            // A scene with something hostile still in it is a fight on offer,
            // priced the way every other fight is.
            confrontation: scene && scene.threatOrdinal !== null && scene.daysLeft > 0
                ? {
                    threatOrdinal: scene.threatOrdinal,
                    count: Math.max(1, scene.involved),
                    stance: 'engaged',
                    damageMultiplier: 1,
                    reaction: '',
                    avoidable: true,
                    engageable: true
                }
                : null,
            duty: null,
            scene,
            contact: null,
            // No name is granted. The consequence is name-free by construction
            // and the player still cannot say what acted, which is the point.
            grants: [],
            castIds: [],
            source: 'digest'
        });
    }

    return out;
}

/**
 * What may be said about a thing that turned up.
 */
function sceneSummary(text: string, scene: Scene | null): string {
    const base = `${text} It reached this cultivator directly rather than as a report, ` +
        'and nobody attached a name to it.';
    if (!scene) return base;
    if (scene.daysLeft <= 0) return `${text} It was finished by the time they got there.`;
    const others = scene.involved > 0 ? ` ${scene.involved} are already in it.` : '';
    return `${text} It is still going on where they are standing.${others} ` +
        `${scene.daysLeft} days before it settles, with or without them.`;
}

function clampChance(chance: number): number {
    if (!Number.isFinite(chance)) return 0;
    return Math.max(0, Math.min(0.95, chance));
}

export { withinSocialRange };
export type { CultivationRNG, ContactPerson };
