/**
 * Domain shapes to wire shapes.
 *
 * The browser is a display, not a second engine, so nothing here computes a
 * game value. Every field is either copied from a domain object or derived by
 * calling the engine's own function for it - `rankName`,
 * `effectiveLifespanYears`, `canAttemptBreakthrough`. If a number appears on
 * the wire that this module invented, that number is a bug.
 *
 * The one thing this layer does own is *omission*: `run.seed` is not sent. It
 * is not a secret in a single-operator deployment, but nothing in the client
 * needs it and a value the client cannot use is a value it cannot be wrong
 * about.
 */

import {
    insightName,
    isUniversalDomain,
    understandingEffects
} from '../engine/cultivation/understanding.js';
import { hasCrossedTheLid } from '../engine/cultivation/realms.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { CrowdingRead } from './how-crowded-this-ground-is.js';
import type { Affordance } from './what-is-worth-doing-standing-here.js';
import { getSect } from '../data/cultivation/sects.js';
import {
    MAX_ORDINAL,
    effectiveLifespanYears,
    fullLadder,
    lifespanForOrdinal,
    rankName,
    realmForOrdinal,
    type LadderEntry
} from '../engine/cultivation/realms.js';
import {
    ATTRIBUTES,
    SPIRIT_ROOTS,
    getSpiritRoot,
    rootProbability
} from '../engine/cultivation/spirit-roots.js';
import {
    canAttemptBreakthrough,
    lifespanPressure,
    lifespanPressureOnsetAge
} from '../engine/cultivation/breakthrough.js';
import { aggregateInjuryPenalties, untreatedInjuryCount } from '../engine/cultivation/injuries.js';
import { stagnationYearsForOrdinal } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { NpcRecord } from '../engine/world/npc-state.js';

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE
// ─────────────────────────────────────────────────────────────────────────

export interface LadderView {
    ranks: LadderEntry[];
}

/** All 45 rungs. Straight from the engine's own table. */
export function ladderView(): LadderView {
    return { ranks: fullLadder() };
}

export interface SpiritRootView {
    key: string;
    name: string;
    grade: string;
    elements: string[];
    /** Draw probability as a fraction of 1, from the engine's weight table. */
    probability: number;
    cultivationSpeed: number;
    description: string;
}

export interface AttributeView {
    key: string;
    name: string;
    min: number;
    max: number;
    description: string;
}

export interface SpiritRootsView {
    roots: SpiritRootView[];
    attributes: AttributeView[];
}

export function spiritRootsView(): SpiritRootsView {
    return {
        roots: SPIRIT_ROOTS.map(root => ({
            key: root.key,
            name: root.name,
            grade: root.grade,
            elements: [...root.elements],
            probability: Number(rootProbability(root.key).toFixed(6)),
            cultivationSpeed: root.cultivationSpeed,
            description: root.description
        })),
        attributes: ATTRIBUTES.map(attr => ({
            key: attr.key,
            name: attr.name,
            min: attr.min,
            max: attr.max,
            description: attr.description
        }))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RUN AND CULTIVATOR
// ─────────────────────────────────────────────────────────────────────────

export interface RunView {
    id: string;
    cultivatorId: string;
    status: Run['status'];
    turn: number;
    elapsedDays: number;
    startedAt: string;
    endedAt: string | null;
    deathCause: Run['deathCause'];
    deathDescription: string | null;
    peakOrdinal: number;
    peakRankName: string;
}

export function runView(run: Run): RunView {
    return {
        id: run.id,
        cultivatorId: run.cultivatorId,
        status: run.status,
        turn: run.turn,
        elapsedDays: run.elapsedDays,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        deathCause: run.deathCause,
        deathDescription: run.deathDescription,
        peakOrdinal: run.peakOrdinal,
        peakRankName: rankName(run.peakOrdinal)
    };
}

/**
 * The cultivator, unchanged.
 *
 * Passed through rather than re-shaped on purpose: the client's character sheet
 * shows exactly what the database holds, so a discrepancy between the two is
 * impossible by construction rather than by care.
 */
export function cultivatorView(cultivator: Cultivator): Cultivator {
    return cultivator;
}

/** One comprehended thing, as the sheet names it. */
export interface DaoInsightView {
    name: string;
    domain: string;
    degree: number;
    /** True for the four domains that bear on everything a cultivator does. */
    universal: boolean;
}

/**
 * The other axis.
 *
 * Rank and dao are separate, and only one of them can be shut. `realmOrdinal`
 * stops at the Lid; understanding does not - `discoverableInsights` reads the
 * spirit root and nothing else, and degree has no ceiling tied to the ladder.
 * So a False Immortal, whose rank is finished permanently, still has this one
 * open in front of them, and it is the only thing a span that long can be spent
 * on. The sheet has to show it or their whole page reads as absences.
 */
export interface DaoView {
    insights: DaoInsightView[];
    /** Degrees summed across every insight held. The single "how deep" number. */
    totalDegrees: number;
    /** Multiplier the universal insights fold into the cultivation rate. */
    cultivationMultiplier: number;
    /** Flat modifier they put on a breakthrough attempt. */
    breakthroughModifier: number;
    /**
     * True when the ladder is shut and this is all that is left moving. Read off
     * the same predicate the engine gates the re-attempt with, so the sheet and
     * the refusal can never disagree.
     */
    theOnlyAxisLeft: boolean;
}

export interface DerivedView {
    rankName: string;
    nextRankName: string | null;
    realmName: string;
    /** Null above the Lid, where progress is not denominated in qi at all. */
    progressRequired: number | null;
    breakthroughReady: boolean;
    /**
     * Years left before the ceiling, which may be negative for a cultivator
     * living past it.
     *
     * Read through `effectiveLifespanYears` rather than `lifespanForOrdinal`,
     * because a False Immortal sits at ordinal 45 and does NOT carry
     * Tribulation Transcendence's ceiling: they carry the False Immortal one.
     * That number is the whole point of the state - vast, finite, and
     * countable - so it has to be right here rather than corrected downstream.
     */
    lifespanRemaining: number;
    /**
     * The whole span this cultivator is measured against, so a client can show
     * "16 of 100" without knowing 100. A denominator the browser invents is a
     * bug; this is the engine's.
     *
     * `effectiveLifespanYears`, not `lifespanForOrdinal`, for the False
     * Immortal reason given on `lifespanRemaining`: the two have to be the same
     * span or the meter and its own remainder disagree.
     */
    lifespanYears: number;
    /**
     * Years at one rung before the climb ends there, at THIS rung.
     *
     * The client had 50 written into it. That is the floor and it is true only
     * through Foundation Establishment: `stagnationYearsForOrdinal` is a fifth
     * of the realm's own span above that, so the panel was telling a Core
     * Formation cultivator they had 50 years when the ladder credits 100, and
     * a Tribulation Transcendence cultivator the same when it credits 20,000.
     * A number the browser invents is a bug; this is the engine's.
     */
    stagnationYears: number;
    /**
     * What the span already spent is worth to the NEXT crossing, as the flat
     * modifier `computeBreakthroughOdds` will book - zero or negative.
     *
     * Sent because the two clocks in the mortality panel are two halves of one
     * decision and the panel could only show one of them. Lifespan was a
     * countdown with no consequence attached; this is the consequence, and it
     * is what makes waiting cost something before the span actually runs out.
     * Needs only ordinal and age, so it is honest here without the ambient the
     * full odds line would require.
     */
    lifespanPressure: number;
    /**
     * The age at which that penalty starts at this rung. Below it there is
     * nothing to pay, and how far below is the whole argument for crossing
     * young - a rung reached early is a rung with runway left on it.
     */
    lifespanPressureFromAge: number;
    untreatedInjuries: number;
    /**
     * How long the open channels have been carried, in days. Zero when there
     * are none, and it resets the moment the count drops below the threshold.
     *
     * This replaced `turnsUntilBleedOut` and `bleedOutTurns`, which were a
     * countdown to a death that no longer happens. A channel wound is a torn
     * muscle and does not kill anybody (`docs/world/injuries.md`), so the
     * honest number to give a client is how long this has been going on rather
     * than how long is left.
     */
    daysChannelsOpen: number;
    /**
     * The fraction of the cultivation rate the open wounds are currently
     * taking, in [0, 1].
     *
     * Sent because the panel needs something true and alarming to say now that
     * it cannot say "this will kill you". This is the number that makes a
     * player want the wounds gone, and it is the engine's own - the same figure
     * `computeCultivationRate` folds into the rate - rather than one the
     * browser works out from a severity count.
     */
    injuryRatePenalty: number;
    /** What is still moving, whether or not the rank is. */
    dao: DaoView;
    /**
     * The sect's display name, resolved server-side from `cultivator.sectId`.
     *
     * Null when unaffiliated, and null rather than the id when the id resolves
     * to nothing: a sheet showing `sect_azure` to a player is showing them a
     * database key, and a missing name is a smaller lie than a raw identifier.
     */
    sectName: string | null;
    /**
     * Why the engine will not permit an attempt right now, in plain English,
     * or null when it will.
     *
     * `canAttemptBreakthrough` returns a machine-readable `reason` and only
     * `eligible` used to reach the client, so every refusal rendered as a
     * generic "progress incomplete" and the control could not state its own
     * case. A refused breakthrough that explains itself is the difference
     * between a game that feels arbitrary and one that feels rule-bound, and
     * the explanation is the engine's, not the interface's.
     */
    breakthroughBlockedReason: string | null;
    /** What the rank is standing on. 'none' below Foundation Establishment. */
    foundationQuality: Cultivator['foundationQuality'];
    /** True once a crossing has taken the name. People have to be told it. */
    nameTaken: boolean;
    /**
     * Who else is drawing on the ground under them, and what it costs.
     *
     * Null when there is no world loaded to read it from - a state the sheet
     * renders as absent rather than as "nobody", because those are different
     * facts and only one of them is measured. See
     * `how-crowded-this-ground-is.ts` for why this is on the sheet at all: it
     * is the strongest environmental lever in the game and was invisible.
     */
    ground: CrowdingRead | null;
    /**
     * What is live standing here, most pressing first.
     *
     * Sent because the interface offered three buttons - Cultivate, Status,
     * Attempt Breakthrough - and a rich verb space with no discovery path
     * behind them. Measured by playing a full run: a cultivator who is broke,
     * starving and carrying three untreated wounds has a way out through work,
     * gathering and food, and a player who reads only what the screen shows
     * them presses Cultivate and dies without ever seeing it.
     *
     * These are PROMPTS, not the interface. The client offers two or three
     * beside the standing controls; free text is still the whole game, and a
     * player must always be able to type something nobody listed. Each entry
     * carries the sentence to insert verbatim (`say`), the engine action it
     * routes to, and the state fact that made it live.
     *
     * Nothing here changes an outcome, a price or a probability. Empty is a
     * legitimate value: a state read taken with no world loaded cannot see who
     * is standing here, and an empty list is a smaller lie than a guessed one.
     */
    standingHere: Affordance[];
}

export interface DerivedContext {
    sectName?: string | null;
    nameTaken?: boolean;
    ground?: CrowdingRead | null;
    standingHere?: Affordance[];
}

/** Everything the sheet needs that is a function of the cultivator, not a field of it. */
export function derivedView(cultivator: Cultivator, context: DerivedContext = {}): DerivedView {
    const ordinal = cultivator.realmOrdinal;
    const eligibility = canAttemptBreakthrough(cultivator);

    return {
        rankName: rankName(ordinal),
        /**
         * Null where there is no next rank, which is TWO different states and
         * used to be one.
         *
         * The obvious one is the top of the ladder. The other is a cultivator
         * whose ladder is shut below it: a False Immortal survived the crossing
         * without completing it, the Lid does not open twice for the same name,
         * and there is no second attempt. Found by playing at ordinal 45, where
         * the sheet read "next: True Immortal" while `breakthrough` said in as
         * many words that this crossing was survived and not completed - the
         * engine right and the label promising a rung that is gone.
         *
         * Read off the same predicate `DaoView.theOnlyAxisLeft` uses, which is
         * the same one the engine gates the re-attempt with, so the label, the
         * panel and the refusal cannot disagree.
         */
        nextRankName: ordinal >= MAX_ORDINAL || hasCrossedTheLid(cultivator.immortalStatus ?? 'none')
            ? null
            : rankName(ordinal + 1),
        realmName: realmForOrdinal(ordinal).name,
        progressRequired: eligibility.progressRequired,
        breakthroughReady: eligibility.eligible,
        breakthroughBlockedReason: eligibility.eligible
            ? null
            : refusalText(eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired),
        lifespanRemaining:
            effectiveLifespanYears(ordinal, cultivator.immortalStatus) - cultivator.age,
        lifespanYears: effectiveLifespanYears(ordinal, cultivator.immortalStatus),
        stagnationYears: stagnationYearsForOrdinal(ordinal),
        lifespanPressure: lifespanPressure(ordinal, cultivator.age),
        lifespanPressureFromAge: lifespanPressureOnsetAge(ordinal),
        untreatedInjuries: untreatedInjuryCount(cultivator.injuries),
        daysChannelsOpen: Math.max(0, Math.round(cultivator.bleedingTurns)),
        injuryRatePenalty: aggregateInjuryPenalties(cultivator.injuries).cultivationPenalty,
        dao: daoView(cultivator),
        sectName: context.sectName ?? null,
        foundationQuality: cultivator.foundationQuality,
        nameTaken: context.nameTaken ?? false,
        ground: context.ground ?? null,
        standingHere: context.standingHere ?? []
    };
}

/**
 * The dao side of the sheet.
 *
 * The effects are computed against the cultivator's own root and no technique,
 * which is the honest neutral reading: what their understanding is worth to
 * them standing still, rather than what it would be worth mid-practice of some
 * particular art. Anything element-specific that does not match their own root
 * is listed but not counted, because it is not doing anything at this moment.
 */
export function daoView(cultivator: Cultivator): DaoView {
    const insights = cultivator.insights ?? [];
    const ctx = {
        rootElements: getSpiritRoot(cultivator.spiritRoot).elements,
        techniqueElement: null,
        techniqueSubject: null
    };
    const effects = understandingEffects(insights, ctx);

    return {
        insights: insights.map(i => ({
            name: insightName(i),
            domain: i.domain,
            degree: i.degree,
            universal: isUniversalDomain(i.domain)
        })),
        totalDegrees: insights.reduce((sum, i) => sum + i.degree, 0),
        cultivationMultiplier: effects.cultivationMultiplier,
        breakthroughModifier: effects.breakthroughModifier,
        theOnlyAxisLeft: hasCrossedTheLid(cultivator.immortalStatus ?? 'none')
    };
}

/**
 * Plain English for the engine's machine-readable ineligibility reasons.
 *
 * Lives here rather than in game.ts because both the refusal a player gets from
 * `POST /api/breakthrough` and the reason the disabled control shows have to be
 * the same sentence. Two wordings for one engine verdict is how a UI starts
 * disagreeing with the rules it is displaying.
 */
export function refusalText(
    reason: string | null,
    available: number,
    required: number | null
): string {
    switch (reason) {
        case 'insufficient_progress':
            // Above the Lid the refusal is the same one, and quoting a figure
            // would invent an exchange rate that does not exist.
            if (required === null) {
                return 'Whatever is above this is not bought with qi, and there is no amount of it ' +
                    'that would do.';
            }
            return `Not enough has accumulated: ${Math.round(available)} of ${required} qi-units. ` +
                'The barrier does not care how badly you want it.';
        case 'barred:the_lid_opened_once':
            return 'The Lid does not open twice for the same name. This crossing was survived and ' +
                'not completed, and there is no second attempt: what is left is a very long time ' +
                'to think about it.';
        case 'at_ladder_summit':
            return 'There is no rung above this one.';
        case 'rank_cap_reached_this_turn':
            return 'One rank a turn. Bottlenecks are meant to be lived through.';
        case 'dead':
            return 'The cultivator is dead.';
        default:
            return 'The engine refused the attempt.';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// LEDGER AND ROSTER
// ─────────────────────────────────────────────────────────────────────────

export interface LedgerRowView {
    id: string;
    name: string;
    peakOrdinal: number;
    peakRankName: string;
    turn: number;
    elapsedDays: number;
    deathCause: Run['deathCause'];
    deathDescription: string | null;
    endedAt: string | null;
}

export function ledgerRowView(run: Run, name: string): LedgerRowView {
    return {
        id: run.id,
        name,
        peakOrdinal: run.peakOrdinal,
        peakRankName: rankName(run.peakOrdinal),
        turn: run.turn,
        elapsedDays: run.elapsedDays,
        deathCause: run.deathCause,
        deathDescription: run.deathDescription,
        endedAt: run.endedAt
    };
}

/**
 * A world NPC as a roster row.
 *
 * The database holds the player and whoever a run has written down. The world
 * holds the other four hundred people, who exist whether or not anybody has met
 * them - which is the entire point of seeding a population rather than spawning
 * one on demand. Both go in the same list because an operator looking at "who
 * is in this world" does not care which table somebody came out of.
 */
/** The faction's own name for itself, when the catalog knows the id. */
function factionNameFor(factionId: string | null): string | null {
    if (!factionId) return null;
    return getSect(factionId)?.name ?? null;
}

/**
 * The title a faction gives that rung, rather than the rung's number.
 *
 * Falls back to the index only when the catalog has no ladder for the id, so a
 * missing entry reads as missing rather than silently as rank zero.
 */
function factionRankTitle(factionId: string | null, index: number): string | null {
    if (!factionId || index < 0) return null;
    const ranks = getSect(factionId)?.ranks;
    if (!ranks || ranks.length === 0) return `rank ${index}`;
    return ranks[Math.min(index, ranks.length - 1)] ?? `rank ${index}`;
}

/**
 * The people this one has a standing grievance with.
 *
 * Read off the relationships that already exist rather than stored twice: a
 * `rival` or an `enemy` with negative standing is a feud by any reading, and
 * the tie already carries when it opened, what it is about and whether it was
 * inherited.
 */
function feudsFrom(npc: NpcRecord): string[] {
    return npc.relationships
        .filter(r => (r.kind === 'rival' || r.kind === 'enemy') && r.standing < 0)
        .map(r => r.targetName);
}

export function worldRosterRow(npc: NpcRecord, presentDay: number): RosterRowView {
    const ordinal = npc.cultivation.realmOrdinal;
    const age = Math.max(0, Math.floor((presentDay - npc.identity.bornOnDay) / 365));

    return {
        id: npc.id,
        name: npc.name,
        kind: 'npc',
        isPlayer: false,
        spiritRoot: npc.cultivation.spiritRoot,
        spiritRootName: getSpiritRoot(npc.cultivation.spiritRoot).name,
        realmOrdinal: ordinal,
        rankName: rankName(ordinal),
        realmName: realmForOrdinal(ordinal).name,
        lifespanYears: lifespanForOrdinal(ordinal),
        location: npc.locationId,
        sectId: npc.factionId,
        // Resolved, not blanked. The roster showed ninety-six members of a
        // sect whose name it declined to print, while carrying a perfectly
        // good id for it.
        sectName: factionNameFor(npc.factionId),
        // The faction's OWN title for the rank, not the index into its ladder.
        // The roster was printing raw integers beside the player's real title,
        // so one column held `5` and `Barrow Hand` and meant the same thing.
        sectRank: factionRankTitle(npc.factionId, npc.factionRankIndex),
        age,
        alive: npc.status === 'alive',
        deathCause: npc.status === 'alive' ? null : npc.status,
        // What the life walk actually left them. Zero was a placeholder that
        // had quietly become a fact about the whole world.
        spiritStones: npc.spiritStones,
        untreatedInjuries: npc.cultivation.untreatedInjuries,
        // Grudges were already modelled and simply never surfaced: a rival or
        // an enemy IS a feud, and `standing` is how badly. Inherited ties come
        // through the same way, which is what makes a grudge outlive its owner.
        feuds: feudsFrom(npc),
        // The world models what is left of somebody in more detail than the
        // cultivator table does: a projection, a remnant and a corpse are
        // different states, and `identityContinuity` is how much of the
        // original person a thing still is.
        existenceState: npc.status,
        soulState: npc.soulState,
        identityContinuity: npc.identityContinuity
    };
}

export interface RosterRowView extends RosterEntry {
    isPlayer: boolean;
    spiritRootName: string;
    rankName: string;
    realmName: string;
    lifespanYears: number;
}

/**
 * One roster row. The repository ships facts; the display names are added here,
 * which is where its own doc comment says they belong.
 */
export function rosterRowView(entry: RosterEntry, playerCultivatorId: string | null): RosterRowView {
    return {
        ...entry,
        isPlayer: entry.id === playerCultivatorId,
        spiritRootName: getSpiritRoot(entry.spiritRoot).name,
        rankName: rankName(entry.realmOrdinal),
        realmName: realmForOrdinal(entry.realmOrdinal).name,
        lifespanYears: lifespanForOrdinal(entry.realmOrdinal)
    };
}
