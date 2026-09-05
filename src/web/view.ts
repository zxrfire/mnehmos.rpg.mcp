/**
 * Domain shapes to wire shapes.
 */

import {
    insightName,
    isUniversalDomain,
    understandingEffects
} from '../engine/cultivation/understanding.js';
import { hasCrossedTheLid } from '../engine/cultivation/realms.js';
import { lifespanWithPhysique, physiqueOrNull } from '../engine/cultivation/physiques.js';
import { lifespanCeilingFor } from '../engine/cultivation/survival.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { CrowdingRead } from './how-crowded-this-ground-is.js';
import type { Affordance } from './what-is-worth-doing-standing-here.js';
import { getSect } from '../data/cultivation/sects.js';
import {
    MAX_ORDINAL,
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
     * Years left before the ceiling, which may be negative for a cultivator living
     * past it.
     */
    lifespanRemaining: number;
    /**
     * The whole span this cultivator is measured against, so a client can show "16
     * of 100" without knowing 100. A denominator the browser invents is a bug; this
     * is the engine's.
     */
    lifespanYears: number;
    /**
     * Years at one rung before the climb ends there, at THIS rung.
     */
    stagnationYears: number;
    /**
     * What the span already spent is worth to the NEXT crossing, as the flat
     * modifier `computeBreakthroughOdds` will book - zero or negative.
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
     * How long the open channels have been carried, in days. Zero when there are
     * none, and it resets the moment the count drops below the threshold.
     */
    daysChannelsOpen: number;
    /**
     * The fraction of the cultivation rate the open wounds are currently taking, in
     * [0, 1].
     */
    injuryRatePenalty: number;
    /** What is still moving, whether or not the rank is. */
    dao: DaoView;
    /**
     * The sect's display name, resolved server-side from `cultivator.sectId`.
     */
    sectName: string | null;
    /**
     * Why the engine will not permit an attempt right now, in plain English, or
     * null when it will.
     */
    breakthroughBlockedReason: string | null;
    /** What the rank is standing on. 'none' below Foundation Establishment. */
    foundationQuality: Cultivator['foundationQuality'];
    /** True once a crossing has taken the name. People have to be told it. */
    nameTaken: boolean;
    /**
     * Who else is drawing on the ground under them, and what it costs.
     */
    ground: CrowdingRead | null;
    /**
     * What is live standing here, most pressing first.
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
         * Null where there is no next rank, which is TWO different states and used
         * to be one.
         */
        nextRankName: ordinal >= MAX_ORDINAL || hasCrossedTheLid(cultivator.immortalStatus ?? 'none')
            ? null
            : rankName(ordinal + 1),
        realmName: realmForOrdinal(ordinal).name,
        progressRequired: eligibility.progressRequired,
        breakthroughReady: eligibility.eligible,
        breakthroughBlockedReason: eligibility.eligible
            ? null
            : refusalText(
                eligibility.reason,
                eligibility.progressAvailable,
                eligibility.progressRequired,
                { held: eligibility.daoHeld, required: eligibility.daoRequired }
            ),
        lifespanRemaining: lifespanCeilingFor(cultivator) - cultivator.age,
        lifespanYears: lifespanCeilingFor(cultivator),
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
 */
export function refusalText(
    reason: string | null,
    available: number,
    required: number | null,
    /**
     * `daoHeld` and `daoRequired` off the same {@link EligibilityCheck}.
     */
    dao?: { held: number; required: number }
): string {
    // `barred:<status>` carries the structural break in the reason string, so
    // it cannot be a `case`. Read before the switch rather than in `default`,
    // where it would sit behind the shrug it exists to replace.
    const structural = reason?.startsWith('barred:') === true
        && reason !== 'barred:the_lid_opened_once'
        ? reason.slice('barred:'.length)
        : null;
    if (structural !== null) return structuralRefusalText(structural);

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
        case 'insufficient_dao':
            // `canAttemptBreakthrough` checks progress BEFORE this and says why in
            // its own comment: somebody short of both should hear about the qi
            // first, because that is the one sitting still fixes. So by the time
            // this reason exists the accumulation is already there, and "the qi is
            // there" is read off the ordering rather than guessed.
            return 'The qi is there and the understanding is not. '
                + (dao
                    ? `This crossing asks for ${dao.required} road${dao.required === 1 ? '' : 's'} `
                      + `besides your own, and you have walked ${dao.held}. `
                    : 'A realm boundary asks for roads besides your own, and you have not walked '
                      + 'enough of them. ')
                + 'A road is not bought and not waited out: it comes of an art practised, ground '
                + 'that teaches one, a ruin opened, or something spent once on you. Ask what arts '
                + 'you could learn, who would teach you, and where you could go.';
        case 'dead':
            return 'The cultivator is dead.';
        default:
            return 'The engine refused the attempt.';
    }
}

/**
 * What a cracked structure says, and what is left to do about it.
 */
function structuralRefusalText(status: string): string {
    const named = status.replace(/-/g, ' ');
    return `The crossing will not build on a ${named}. That is mechanical rather than punitive: `
        + 'each realm is built on the last one, and the next thing does not form on a broken '
        + 'version of the thing under it. The rungs inside this realm are still open - it is the '
        + 'realm boundary that is shut. What reopens it is a structural repair, which is a thing '
        + 'a house spends on somebody rather than a thing anybody buys for themselves: ask what '
        + 'would treat it, and who could.';
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
        // Carried through so a person standing in a square can be asked about
        // themselves. The world's people and the database's arrive at the ask
        // through the same projection, and a fact one of them held and the
        // other did not would make the answer depend on which table somebody
        // came out of.
        sex: npc.identity.sex,
        physique: npc.identity.physique,
        realmOrdinal: ordinal,
        rankName: rankName(ordinal),
        realmName: realmForOrdinal(ordinal).name,
        // The rung's ceiling as this body actually gets it. A world person
        // whose lifespan stamp already carries the physique and whose roster
        // row did not would read as somebody with decades they do not have.
        lifespanYears: lifespanWithPhysique(
            lifespanForOrdinal(ordinal),
            physiqueOrNull(npc.identity.physique)
        ),
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
        lifespanYears: lifespanWithPhysique(
            lifespanForOrdinal(entry.realmOrdinal),
            physiqueOrNull(entry.physique)
        )
    };
}
