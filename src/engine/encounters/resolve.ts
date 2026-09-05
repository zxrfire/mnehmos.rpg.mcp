/**
 * Turning a drawn row into something that happened.
 *
 * An entry that `interrupts` produces no automatic deltas at all - bandits on
 * the road do not silently take spirit stones, they are standing there, and
 * paying, fighting or leaving is the turn. An entry that does not interrupt
 * happened while the cultivator was busy, so the engine settles it and reports
 * what it settled.
 */

import { encounterDamage, encounterThreatRegard, fillSummary } from '../../data/cultivation/encounters.js';
import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type { SimEvent } from '../../schema/cultivation.js';
import { interruptsThrough } from './activity.js';
import { valenceOf } from './valence.js';
import type {
    Confrontation,
    Duty,
    EncounterActivity,
    EncounterDeltas,
    EncounterOccurrence,
    EncounterPerson,
    EncounterStance,
    EncounterValence,
    KnowledgeGrant,
    Scene
} from './types.js';

/** Base damage from a hazard that lands, as a share of maximum HP. */
export const HAZARD_DAMAGE_SHARE = 0.12;
/** Share of a stated sum that actually changes hands when nobody decides. */
export const INCIDENTAL_SHARE = 0.35;

export interface ResolveInput {
    entry: EncounterEntry;
    activity: EncounterActivity;
    ordinal: number;
    maxHp: number;
    hp: number;
    spiritStones: number;
    absoluteDay: number;
    dayOffset: number;
    values: Record<string, string | number>;
    grants: KnowledgeGrant[];
    castIds: string[];
    cast: readonly EncounterPerson[];
    /** Set when Fortune moved the thing out of the way, or the window shut. */
    outcome: 'landed' | 'passed_by' | 'missed';
    /** Set when an institution asked for this person rather than the world
     *  merely happening near them. */
    duty?: Duty | null;
    /** Set when the thing was still running when they arrived. */
    scene?: Scene | null;
}

export function resolveOccurrence(input: ResolveInput): EncounterOccurrence {
    const { entry, ordinal } = input;
    const valence = valenceOf(entry);
    const threat = encounterThreatRegard(entry, ordinal);
    const stance = stanceFor(entry, threat?.band ?? null);

    // Fortune has already had its one say by the time this runs, and its say is
    // whether the thing arrived - never what it does now that it has.
    const landed = input.outcome === 'landed';
    const duty = landed ? input.duty ?? null : null;
    const scene = landed ? input.scene ?? null : null;

    // Being asked for by name always stops what you were doing, whatever the
    // door rule would otherwise say. A summons that a cultivator sat through
    // without noticing is a notification, and the point of the whole mechanism
    // is that it is not one. The same goes for walking into something still
    // happening: a decision is required either way, including the decision to
    // walk on.
    const interrupts = duty !== null || scene !== null
        ? landed
        : landed && stance !== 'beneath' && interruptsThrough(entry, input.activity);

    const deltas = landed && !interrupts
        ? incidentalDeltas(input, valence, stance)
        : zeroDeltas();

    const confrontation: Confrontation | null =
        landed && entry.threatOrdinal !== null
            ? {
                threatOrdinal: entry.threatOrdinal,
                count: countIn(input.values),
                stance,
                damageMultiplier: threat?.damageMultiplier ?? 1,
                reaction: threat?.reaction ?? '',
                // An `unavoidable` TAG means the event happens to you. It has
                // never meant that fighting is compulsory, and reading it that
                // way told a driver it had to fight things nine rungs up. A
                // thing that far above is not a fight that can be had at all.
                avoidable: stance !== 'engaged' ||
                    entry.tags.includes('avoidable') ||
                    entry.tags.includes('negotiable'),
                engageable: stance === 'engaged'
            }
            : null;

    return {
        id: entry.id,
        entryId: entry.id,
        kind: entry.kind,
        valence,
        dayOffset: input.dayOffset,
        absoluteDay: input.absoluteDay,
        interrupts,
        stance,
        event: eventFor(input, valence, stance, interrupts, deltas, duty, scene),
        deltas,
        confrontation,
        duty,
        scene,
        contact: null,
        // A thing that never arrived introduced nobody. Grants are earned by
        // the encounter happening, not by it having been rolled.
        grants: landed ? input.grants : [],
        castIds: landed ? input.castIds : [],
        source: duty ? 'summons' : 'catalog'
    };
}

// STANCE

/**
 * Where the hostile half stands, straight off the regard band.
 * `docs/world/houses/discovery.md` made mechanical: something nine or more rungs
 * up is not a fight that was lost, it is a fight that was never offered. No
 * branch here on who or what it is, only on the size of the number.
 */
export function stanceFor(entry: EncounterEntry, band: string | null): EncounterStance {
    if (entry.threatOrdinal === null || band === null) return 'none';
    if (band === 'unreachable' || band === 'overmatched') return 'above';
    if (band === 'dismissed' || band === 'beneath') return 'beneath';
    return 'engaged';
}

// WHAT THE ENGINE SETTLES ON ITS OWN

function incidentalDeltas(
    input: ResolveInput,
    valence: EncounterValence,
    stance: EncounterStance
): EncounterDeltas {
    const deltas = zeroDeltas();
    const stated = numberIn(input.values, 'stones');
    const tags = new Set(input.entry.tags);

    if (valence === 'good' && tags.has('safe')) {
        // Picked up in passing. A share rather than the whole stated sum: the
        // stated sum is what the thing is worth, and nobody realised all of it
        // while walking past.
        deltas.spiritStones = Math.max(1, Math.round(stated * INCIDENTAL_SHARE));
        if (tags.has('food') || tags.has('trade')) deltas.rations = 1;
        return deltas;
    }

    if (valence === 'bad') {
        if (tags.has('loss')) {
            deltas.spiritStones = -Math.min(
                input.spiritStones,
                Math.max(1, Math.round(stated * INCIDENTAL_SHARE))
            );
            return deltas;
        }
        if (stance !== 'beneath') {
            const base = Math.max(1, Math.round(input.maxHp * HAZARD_DAMAGE_SHARE));
            const damage = encounterDamage(input.entry, base, input.ordinal);
            // Never lethal from a non-interrupting event. Something that could
            // kill somebody is by definition worth stopping for, and the
            // catalog says so with `interrupts`.
            deltas.hp = -Math.min(Math.max(0, input.hp - 1), damage);
        }
    }

    return deltas;
}

function zeroDeltas(): EncounterDeltas {
    return { hp: 0, spiritStones: 0, satiety: 0, rations: 0 };
}

// THE LINE THE NARRATOR GETS

function eventFor(
    input: ResolveInput,
    valence: EncounterValence,
    stance: EncounterStance,
    interrupts: boolean,
    deltas: EncounterDeltas,
    duty: Duty | null,
    scene: Scene | null
): SimEvent {
    const summary = `${summaryFor(input, stance)}${dutyLine(duty)}${sceneLine(scene)}`;
    return {
        kind: kindFor(input),
        dayOffset: input.dayOffset,
        summary,
        interrupts,
        occurrences: 1,
        data: {
            encounterId: input.entry.id,
            encounterKind: input.entry.kind,
            valence,
            stance,
            outcome: input.outcome,
            threatOrdinal: input.entry.threatOrdinal,
            absoluteDay: input.absoluteDay,
            hp: deltas.hp,
            spiritStones: deltas.spiritStones,
            castIds: input.castIds,
            dutyOrigin: duty?.origin ?? null,
            dutyPosture: duty?.posture ?? null,
            dutyContribution: duty?.contribution ?? null,
            sceneEndsOnDay: scene?.endsOnDay ?? null
        }
    };
}

/**
 * The terms, stated as facts.
 */
function dutyLine(duty: Duty | null): string {
    if (!duty) return '';
    const who = duty.factionName ?? 'The party asking';
    const ask = duty.posture === 'told'
        ? `${who} has said where to be and when. Nothing was asked.`
        : duty.posture === 'assigned'
            ? `${who} has given this to them to deal with.`
            : `${who} has put it to them and is waiting on an answer.`;

    const pay = duty.contribution > 0
        ? `${duty.contribution} contribution and ${duty.stones} spirit stones on completion`
        : `${duty.stones} spirit stones on completion, and nothing on any ledger`;

    // The cohort is the half that outlives the duty. People at your own rung
    // who were there, saw what was done, and are still about afterwards is
    // where every rivalry and every debt in this game is going to come from.
    const withThem = duty.cohort > 0
        ? ` ${duty.cohort} others of the house are going.`
        : '';
    // Who carried it. An order from a named elder who has an opinion about
    // somebody is a different object from an order from an institution, and
    // the house has a roster, so it is never the second.
    const mouth = duty.spokenBy
        ? ` It was brought by ${duty.spokenBy.name}.` +
          (duty.spokenBy.detail ? ` ${duty.spokenBy.detail}` : '')
        : '';
    const door = duty.access.granted ? ` ${duty.access.note}` : '';

    return ` ${ask}${mouth}${withThem}${door} Term: ${duty.days} days, by day ${duty.dueOnDay}. ` +
        `Paid: ${pay}. Declining is recorded as ${duty.refusal.severity}.`;
}

/** How much of it is left. Zero is a real answer and it means they were late. */
function sceneLine(scene: Scene | null): string {
    if (!scene) return '';
    if (scene.daysLeft <= 0) {
        return ' It was over before this cultivator reached it.';
    }
    const others = scene.involved > 0 ? `${scene.involved} already in it. ` : '';
    return ` It is still going. ${others}${scene.daysLeft} days before it is settled ` +
        'one way or the other, with or without them.';
}

/**
 * A window that shut before they reached it is its own SimEvent kind, and
 * using it here rather than inventing a flag is what lets a run be counted:
 * `opportunity_missed` is one of the more characteristic experiences of a low
 * Fortune life and it should be countable as such.
 */
function kindFor(input: ResolveInput): SimEvent['kind'] {
    if (input.outcome === 'missed') return 'opportunity_missed';
    return input.entry.simEventKind;
}

function summaryFor(input: ResolveInput, stance: EncounterStance): string {
    const filled = fillSummary(input.entry, input.values);

    if (input.outcome === 'missed') {
        return `${filled} It was already taken by the time this cultivator reached it.`;
    }
    if (input.outcome === 'passed_by') {
        return `${filled} It went past without arriving.`;
    }
    if (stance === 'above') {
        // Do not explain them. The gap is a number, and the number is the
        // whole of what the engine knows.
        return `${filled} Nothing was required of this cultivator and nothing was ` +
            'asked. They were not what any of it was about.';
    }
    if (stance === 'beneath') {
        return `${filled} None of it is at a level that can reach this cultivator.`;
    }
    return filled;
}


function numberIn(values: Record<string, string | number>, key: string): number {
    const raw = values[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function countIn(values: Record<string, string | number>): number {
    const n = numberIn(values, 'count');
    return n > 0 ? Math.round(n) : 1;
}
