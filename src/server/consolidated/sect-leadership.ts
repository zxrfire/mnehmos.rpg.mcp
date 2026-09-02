/**
 * Authority inside a house: ordering the rungs below, and running the place.
 *
 * The thin tool layer over `src/engine/cultivation/leadership.ts`. Every rule,
 * threshold and price is in the engine module; this file resolves a cultivator,
 * reads the house, calls one pure function, rolls the one roll on a seeded
 * stream, and writes the rows.
 *
 * ── WHERE THE STATE LIVES ─────────────────────────────────────────────────
 *
 * `cultivator_flags` is keyed to a cultivator by foreign key, so per-house state
 * hangs off the acting cultivator - the same shape `siphon` uses for
 * `siphon_taken:<sectId>`. One JSON flag per house, `house:<sectId>`, holds the
 * whole ledger: standing, who this cultivator brought in, which elders were
 * dismissed and which walked, the standard the head set, and the curriculum they
 * decreed.
 *
 * Two things escape the flag because they are genuinely the world's rather than
 * this cultivator's, and the `sects` table already has columns for both:
 * `admission_ordinal`, which `join` and `promote` read and enforce, and
 * `power_ordinal`, which moves when the house grows or is gutted. Those are
 * re-asserted from the ledger on every leadership call, because
 * `ensureSectsSeeded` refreshes sect rows from the catalog once per process.
 *
 * ── WHERE THE PEOPLE COME FROM ────────────────────────────────────────────
 *
 * `members.ts` is a named cast, not a census: three people at the Azure Dew
 * Sect, eight at the Azure Cloud Pavilion. A head count taken from it would say
 * that a sect running four hill villages is three people. So the census comes
 * from `impliedHouseSize`, derived from the ladder, and the named cast is
 * matched into it - a rung's elders are its catalog members first and unnamed
 * fillers after, so the narrator gets a real name to use wherever the world has
 * one and a truthful count where it does not.
 */

import { z } from 'zod';
import { CultivationRNG } from '../../engine/cultivation/rng.js';
import { MAX_ORDINAL, rankName } from '../../engine/cultivation/realms.js';
import { DAYS_PER_YEAR } from '../../engine/cultivation/cultivation.js';
import {
    ERRANDS,
    OBSTRUCTED_DELIVERY_FRACTION,
    STANDING_ON_JOINING,
    type ActCost,
    type ActOutcome,
    type ElderFollowing,
    type Errand,
    type HouseState,
    type LeadershipPower,
    admissionCeilingFor,
    admissionChangeCost,
    affordable,
    authorityTier,
    backlashLevel,
    canOrder,
    challengeOutcome,
    commandableHands,
    curriculumChangeCost,
    distributeFollowing,
    elderRungOf,
    errandCost,
    expulsionCost,
    externalElderCost,
    holdsTheSeat,
    impliedHouseSize,
    obstructionChance,
    planDiscipleIntake,
    planGrowth,
    powerOrdinalDrift,
    powersAt,
    resolveAct,
    resolveErrand,
    rosterByRung,
    standingAfterYears
} from '../../engine/cultivation/leadership.js';
import { getSect } from '../../data/cultivation/sects.js';
import { getMembersOf, rankRealmBand } from '../../data/cultivation/members.js';
import { getParentage } from '../../data/cultivation/hierarchy.js';
import { getTechnique, transmissionModeOf } from '../../data/cultivation/techniques.js';
import { rollHerb } from '../../data/cultivation/herbs.js';
import {
    drawFromTheGround,
    howTheGroundReads,
    recordGroundDraw
} from '../../engine/world/what-a-place-still-has-in-the-ground.js';
import { saveWorldForRun, worldForRun } from '../state/cultivation-world.js';
import { worldLocationFor } from '../../web/entities.js';
import type { LocationRecord } from '../../engine/world/locations.js';
import {
    addToPouch,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    readJsonFlag,
    resolveActiveRun,
    round2,
    writeFlag,
    type CultivationRepos
} from './cultivation-support.js';
import { ORDINALS_PER_SECT_RANK } from '../../engine/cultivation/what-each-rung-of-a-house-ladder-requires.js';
import type { Run, Cultivator } from '../../schema/cultivation.js';

// ═══════════════════════════════════════════════════════════════════════════
// THE LEDGER
// ═══════════════════════════════════════════════════════════════════════════

/** One flag per house, on the cultivator who is acting inside it. */
export function houseFlagKey(sectId: string): string {
    return `house:${sectId}`;
}

export interface HouseLedger {
    /** Credit with the rungs below, in this house. */
    standing: number;
    /** In-world day the standing figure was last brought forward to. */
    accruedToDay: number;
    /** Disciples this cultivator personally took in. */
    ownFollowing: number;
    /** Ids of elders dismissed by this cultivator. */
    expelled: string[];
    /** Ids of elders who walked out over something this cultivator did. */
    departed: string[];
    /** Elders bought in from outside. Unnamed: the narrator names them. */
    externalElders: { id: string; rankIndex: number; following: number }[];
    /** The standard this head set, or null while the catalog's still stands. */
    admissionOrdinal: number | null;
    /** The working library this head decreed, or null for the catalog's. */
    teaches: string[] | null;
    /** Day the decree was read. The intake raised on it arrives later. */
    curriculumSetOnDay: number | null;
    /** Heads added by recruitment and growth. */
    membersAdded: number;
    /** Heads lost to departures and dismissals. */
    membersLost: number;
    /** Times an order or a decree was simply not carried out. */
    obstructions: number;
    /** Whether the seat has been challenged, and whether it was held. */
    challengedTimes: number;
}

function emptyLedger(day: number): HouseLedger {
    return {
        standing: STANDING_ON_JOINING,
        accruedToDay: day,
        ownFollowing: 0,
        expelled: [],
        departed: [],
        externalElders: [],
        admissionOrdinal: null,
        teaches: null,
        curriculumSetOnDay: null,
        membersAdded: 0,
        membersLost: 0,
        obstructions: 0,
        challengedTimes: 0
    };
}

function writeLedger(
    repos: CultivationRepos,
    cultivatorId: string,
    sectId: string,
    ledger: HouseLedger
): void {
    writeFlag(repos.db, cultivatorId, houseFlagKey(sectId), JSON.stringify(ledger));
}

/**
 * Advance the run and the standing clock together.
 *
 * Standing recovers with time served, and an act that consumes decades must not
 * also be credited with the recovery those decades would have bought - a leader
 * who spends thirty years growing the house has spent thirty years growing the
 * house. Without this the earned standing and the passive accrual stack, and
 * growth pays for the fight that follows it twice over.
 */
function spendYears(
    repos: CultivationRepos,
    view: HouseView,
    years: number
): number {
    const days = Math.max(0, Math.round(years * DAYS_PER_YEAR));
    if (days > 0) {
        repos.runs.advanceDays(view.run.id, days);
        view.ledger.accruedToDay = view.run.elapsedDays + days;
    }
    return days;
}

// ═══════════════════════════════════════════════════════════════════════════
// READING THE HOUSE
// ═══════════════════════════════════════════════════════════════════════════

/** An elder with a name where the world has one, and a count either way. */
export interface SeatedElder extends ElderFollowing {
    /** Null where the world never named this person. */
    name: string | null;
    rankTitle: string;
    realmOrdinal: number | null;
}

interface HouseView {
    run: Run;
    cultivator: Cultivator;
    sectId: string;
    sectName: string;
    ranks: readonly string[];
    rankCount: number;
    rankIndex: number;
    rankTitle: string;
    ledger: HouseLedger;
    elders: SeatedElder[];
    houseSize: number;
    baseHouseSize: number;
    admissionOrdinal: number;
    teaches: readonly string[];
    signatureTechniqueId: string | null;
    hasPatron: boolean;
    entryStipend: number;
    house: HouseState;
}

/**
 * Whether somebody stands above this house who could simply replace its head.
 *
 * `unbacked`, `unassailable` and `outside` answer to nobody, so their heads top
 * out at a challenge - a fight, which can be won. Everybody else holds their
 * ground from a patron, and a patron does not need to fight.
 */
function houseHasPatron(sectId: string): boolean {
    const parentage = getParentage(sectId);
    if (!parentage) return false;
    return (
        parentage.governance === 'federated' ||
        parentage.governance === 'administered' ||
        parentage.governance === 'deference'
    );
}

function loadHouse(
    repos: CultivationRepos,
    args: { cultivatorId?: string }
): HouseView | ReturnType<typeof guidingError> {
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return guidingError(
            'not_a_member',
            `${cultivator.name} serves no house and has nobody to give an order to.`,
            { hint: 'sect_manage({ action: "join", sectId }) first. Authority is the rank.' }
        );
    }
    const sect = repos.sects.getById(membership.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `Sect ${membership.sectId} no longer exists.`);
    }

    const facts = getSect(sect.id);
    const stored = readJsonFlag<HouseLedger>(repos.db, cultivator.id, houseFlagKey(sect.id));
    const ledger: HouseLedger = { ...emptyLedger(run.elapsedDays), ...(stored ?? {}) };

    // Standing recovers with time served and nothing else. Brought forward here
    // rather than on a schedule, so a run that skips forty years does not owe
    // anybody forty years of ticks.
    const elapsed = Math.max(0, run.elapsedDays - ledger.accruedToDay);
    if (elapsed > 0) {
        ledger.standing = standingAfterYears(ledger.standing, elapsed / DAYS_PER_YEAR);
        ledger.accruedToDay = run.elapsedDays;
    }

    const rankCount = sect.ranks.length;
    const baseHouseSize = impliedHouseSize(rankCount);
    const houseSize = Math.max(
        1,
        baseHouseSize + ledger.membersAdded - ledger.membersLost
    );

    const elders = seatElders(sect.id, sect.ranks, houseSize, ledger);

    // The head's own standard, re-asserted onto the row. `ensureSectsSeeded`
    // refreshes sects from the catalog once per process, so a decree read in a
    // previous session would otherwise quietly un-read itself.
    const admissionOrdinal = ledger.admissionOrdinal ?? sect.admissionOrdinal;
    const drift = powerOrdinalDrift(houseSize, baseHouseSize);
    const intendedPower = Math.max(
        0,
        Math.min(MAX_ORDINAL, (facts?.powerOrdinal ?? sect.powerOrdinal) + drift)
    );
    if (sect.admissionOrdinal !== admissionOrdinal || sect.powerOrdinal !== intendedPower) {
        repos.sects.upsert({
            ...sect,
            admissionOrdinal,
            powerOrdinal: intendedPower
        });
    }

    return {
        run,
        cultivator,
        sectId: sect.id,
        sectName: sect.name,
        ranks: sect.ranks,
        rankCount,
        rankIndex: membership.rankIndex,
        rankTitle: membership.rankTitle,
        ledger,
        elders,
        houseSize,
        baseHouseSize,
        admissionOrdinal,
        teaches: ledger.teaches ?? facts?.teaches ?? [],
        signatureTechniqueId: facts?.signatureTechniqueId ?? null,
        hasPatron: houseHasPatron(sect.id),
        entryStipend: sect.stipend[0] ?? 1,
        house: {
            standing: ledger.standing,
            elders,
            houseSize,
            ownFollowing: ledger.ownFollowing,
            hasPatron: houseHasPatron(sect.id),
            holdsTheSeat: holdsTheSeat(membership.rankIndex, rankCount)
        }
    };
}

/**
 * The elders of a house, named where the world named them.
 *
 * The elder rungs are everything from `elderRungOf` up to but not including the
 * seat, because the seat is whoever holds it. Catalog members fill their own
 * rungs first; the rest of each rung's roster is unnamed, and is returned as
 * unnamed rather than invented, because inventing a person here would make the
 * engine authoritative over somebody the narrator has to keep consistent.
 */
function seatElders(
    sectId: string,
    ranks: readonly string[],
    houseSize: number,
    ledger: HouseLedger
): SeatedElder[] {
    const rankCount = ranks.length;
    const elderRung = elderRungOf(rankCount);
    const roster = rosterByRung(houseSize, rankCount);
    const gone = new Set([...ledger.expelled, ...ledger.departed]);
    const named = getMembersOf(sectId);

    const seats: Omit<SeatedElder, 'following'>[] = [];
    for (let rung = elderRung; rung < rankCount - 1; rung++) {
        const onThisRung = named.filter(m => m.rankIndex === rung && !gone.has(m.id));
        for (const m of onThisRung) {
            seats.push({
                id: m.id,
                rankIndex: rung,
                source: 'house',
                name: m.name,
                rankTitle: ranks[rung] ?? '',
                realmOrdinal: m.realmOrdinal
            });
        }
        const unnamed = Math.max(0, (roster[rung] ?? 0) - onThisRung.length);
        for (let n = 0; n < unnamed; n++) {
            const id = `elder:${sectId}:${rung}:${n}`;
            if (gone.has(id)) continue;
            seats.push({
                id,
                rankIndex: rung,
                source: 'house',
                name: null,
                rankTitle: ranks[rung] ?? '',
                realmOrdinal: rankRealmBand(sectId, rung)?.minOrdinal ?? null
            });
        }
    }
    for (const bought of ledger.externalElders) {
        if (gone.has(bought.id)) continue;
        seats.push({
            id: bought.id,
            rankIndex: bought.rankIndex,
            source: 'outside',
            name: null,
            rankTitle: ranks[bought.rankIndex] ?? '',
            realmOrdinal: rankRealmBand(sectId, bought.rankIndex)?.minOrdinal ?? null
        });
    }

    // Everybody who is not an elder and not the head is somebody's disciple,
    // minus the ones this cultivator took in personally.
    const unattached = Math.max(0, houseSize - seats.length - 1 - ledger.ownFollowing);
    const shares = distributeFollowing(seats.map(s => s.rankIndex), unattached);
    const boughtIn = new Map(ledger.externalElders.map(e => [e.id, e.following]));

    return seats.map((seat, i) => ({
        ...seat,
        // An elder bought in from outside starts with nobody, and that is the
        // whole reason a head buys one: they answer to the person who seated
        // them because there is nobody else in the house who will answer to them.
        following: seat.source === 'outside' ? (boughtIn.get(seat.id) ?? 0) : shares[i]
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLYING AN OUTCOME
// One path for every act, so obstruction, departure, challenge and removal are
// resolved identically whether the act was an errand or a decree.
// ═══════════════════════════════════════════════════════════════════════════

interface Applied {
    outcome: ActOutcome;
    obstructed: boolean;
    lostTheSeat: boolean;
    dismissed: boolean;
    challengeHeld: boolean | null;
    narration: string;
}

function applyOutcome(
    repos: CultivationRepos,
    view: HouseView,
    outcome: ActOutcome,
    rng: CultivationRNG
): Applied {
    const ledger = view.ledger;
    ledger.standing = outcome.standingAfter;

    const obstructed = rng.next() < outcome.obstructionChance;
    if (obstructed) ledger.obstructions += 1;

    // ── Departures. Read off state, and they take their lines with them. ──
    let lostTheSeat = false;
    let dismissed = false;
    let challengeHeld: boolean | null = null;
    const parts: string[] = [];

    if (outcome.eldersLeaving.length > 0) {
        for (const elder of outcome.eldersLeaving) ledger.departed.push(elder.id);
        ledger.membersLost += outcome.eldersLeaving.length + outcome.disciplesLeaving;
        const named = outcome.eldersLeaving
            .map(e => (e as SeatedElder).name)
            .filter((n): n is string => Boolean(n));
        parts.push(
            `${outcome.eldersLeaving.length} elder${outcome.eldersLeaving.length === 1 ? '' : 's'} ` +
            `walked out of ${view.sectName}${named.length > 0 ? `, ${named.join(' and ')} among them` : ''}, ` +
            `and took ${outcome.disciplesLeaving} disciple${outcome.disciplesLeaving === 1 ? '' : 's'} ` +
            'with them. The house is smaller than it was this morning and the shortfall is the shape of the argument.'
        );
    }
    if (outcome.ownFollowingLost > 0) {
        ledger.ownFollowing = Math.max(0, ledger.ownFollowing - outcome.ownFollowingLost);
        ledger.membersLost += outcome.ownFollowingLost;
        parts.push(
            `${outcome.ownFollowingLost} of the disciples taken in under this line asked to be reassigned, ` +
            'and were.'
        );
    }

    // ── The seat, or the place. ──
    if (outcome.removedByPatron) {
        lostTheSeat = true;
        repos.sects.setRank(view.sectId, view.cultivator.id, Math.max(0, elderRungOf(view.rankCount)));
        parts.push(
            'A letter arrived from the house that holds this one\'s ground, naming a successor and ' +
            'thanking the outgoing holder for the years. There is nothing in it to answer and nobody to fight.'
        );
    } else if (outcome.seatChallenged) {
        ledger.challengedTimes += 1;
        const strongest = view.elders.reduce(
            (best, e) => Math.max(best, e.realmOrdinal ?? 0),
            0
        );
        const result = challengeOutcome(view.cultivator.realmOrdinal, strongest);
        challengeHeld = result.held;
        if (!result.held) {
            lostTheSeat = true;
            repos.sects.setRank(view.sectId, view.cultivator.id, Math.max(0, elderRungOf(view.rankCount)));
            parts.push(
                `The strongest elder left standing is at ${rankName(strongest)} and the seat is at ` +
                `${rankName(view.cultivator.realmOrdinal)}. The challenge was made in the yard, in front of ` +
                'everybody, and it did not take long. The rank goes to the winner because the rank was always the argument.'
            );
        } else {
            parts.push(
                `The challenge was made and answered: ${rankName(view.cultivator.realmOrdinal)} against ` +
                `${rankName(strongest)}, in the yard, in front of everybody. The seat holds. Nobody in the ` +
                'house has forgotten that it had to be defended, and the next one will be better prepared.'
            );
        }
    } else if (outcome.dismissedFromTheHouse) {
        dismissed = true;
        repos.sects.removeMember(view.sectId, view.cultivator.id);
        parts.push(
            `${view.sectName} does not keep a rung nobody below it will work for. The rank is struck, ` +
            'the room is reassigned, and the reason given is administrative.'
        );
    }

    if (obstructed) {
        parts.unshift(
            outcome.act === 'order'
                ? 'The order was given and the rung below took it the way they take everything now: slowly, ' +
                  'partly, and with a reason ready. A quarter of it got done.'
                : 'The decree was read out and then it was not carried out. Nobody refused it. It was simply ' +
                  'that the people who would have had to do the work were busy, and stayed busy.'
        );
    }

    return {
        outcome,
        obstructed,
        lostTheSeat,
        dismissed,
        challengeHeld,
        narration: parts.join(' ')
    };
}

/** The one-line reading of where a house stands, for the narrator. */
function moodLine(level: string, sectName: string): string {
    switch (level) {
        case 'none':
            return `${sectName} carries out what it is told and does not discuss it afterwards.`;
        case 'grumbling':
            return `Nothing in ${sectName} has been refused. Things are being done a little later than they were, and the conversation stops when the wrong person walks in.`;
        case 'obstruction':
            return `Orders in ${sectName} are now negotiations, and the negotiation happens after you leave the room.`;
        case 'departure':
            return `Elders of ${sectName} are working out what they would be worth somewhere else, and some of them have already been told.`;
        case 'challenge':
            return `Somebody in ${sectName} is going to stand up in the yard, and everyone has worked out who.`;
        default:
            return `${sectName} has stopped being a question the house answers. It is a question somebody else answers about the house.`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const AuthoritySchema = z.object({
    action: z.literal('authority'),
    cultivatorId: z.string().optional()
});

export const OrderSchema = z.object({
    action: z.literal('order'),
    errand: z.enum(['gather', 'carry', 'labour'])
        .describe('gather returns herbs, carry returns spirit stones, labour returns contribution'),
    toRankIndex: z.number().int().min(0).optional()
        .describe('Which rung is being sent. Defaults to the highest rung below this one that has people on it.'),
    hands: z.number().int().min(1).max(500).optional()
        .describe('How many people. Defaults to everyone this rank can call on.'),
    days: z.number().int().min(1).max(365).optional().default(7)
        .describe('How long they are out. Their time, not the caller\'s.'),
    cultivatorId: z.string().optional()
});

export const RecruitSchema = z.object({
    action: z.literal('recruit'),
    kind: z.enum(['disciple', 'elder']).optional().default('disciple')
        .describe('disciple: elder rungs and above. elder: the seat only, and it is the expensive one.'),
    count: z.number().int().min(1).max(50).optional().default(1),
    cultivatorId: z.string().optional()
});

export const AdmissionSchema = z.object({
    action: z.literal('admission'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL).optional()
        .describe('The realm ordinal the house admits from. Omit to price the move without making it.'),
    cultivatorId: z.string().optional()
});

export const CurriculumSchema = z.object({
    action: z.literal('curriculum'),
    teach: z.array(z.string()).optional().describe('Technique ids to add to the working library'),
    retire: z.array(z.string()).optional().describe('Technique ids to stop teaching'),
    cultivatorId: z.string().optional()
});

export const ExpelSchema = z.object({
    action: z.literal('expel'),
    elderId: z.string().optional()
        .describe('Elder to dismiss. Omit to price every elder in the house without dismissing anyone.'),
    cultivatorId: z.string().optional()
});

export const GrowSchema = z.object({
    action: z.literal('grow'),
    through: z.enum(['seat', 'elders']).optional().default('seat')
        .describe('seat: you recruit, slower, and they are yours. elders: faster, and they are theirs.'),
    decades: z.number().int().min(1).max(20).optional().default(1),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function noAuthority(
    power: LeadershipPower,
    view: HouseView
): ReturnType<typeof guidingError> {
    const elderRung = elderRungOf(view.rankCount);
    const opensAt =
        power === 'order'
            ? 1
            : power === 'recruit_disciples'
                ? elderRung
                : view.rankCount - 1;
    return guidingError(
        'rank_does_not_reach',
        `${view.rankTitle} does not do that in ${view.sectName}. It opens at ` +
        `${view.ranks[opensAt] ?? 'a rank this house does not have'}, and not before.`,
        {
            power,
            rankIndex: view.rankIndex,
            rankTitle: view.rankTitle,
            opensAtRankIndex: opensAt,
            opensAtRankTitle: view.ranks[opensAt] ?? null,
            tier: authorityTier(view.rankIndex, view.rankCount),
            powersHeld: powersAt(view.rankIndex, view.rankCount),
            hint: 'Authority is the rank index and it reaches every lower one in the same house. Nothing else grants it.'
        }
    );
}

/**
 * What this rank may do, what it would cost, and what the house currently
 * thinks. Takes nothing and changes nothing, which is the point: a leader is
 * entitled to price a fight before picking it.
 */
export async function handleAuthority(args: z.infer<typeof AuthoritySchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    const tier = authorityTier(view.rankIndex, view.rankCount);
    const powers = powersAt(view.rankIndex, view.rankCount);
    const level = backlashLevel(view.ledger.standing, view.hasPatron && view.house.holdsTheSeat);
    const roster = rosterByRung(view.houseSize, view.rankCount);

    const canSend = view.ranks
        .map((title, rung) => ({
            rankIndex: rung,
            rankTitle: title,
            onTheRung: roster[rung] ?? 0,
            handsYouCanCall: commandableHands(view.rankIndex, rung, view.houseSize, view.rankCount),
            reachOrdinal: rankRealmBand(view.sectId, rung)?.minOrdinal ?? null
        }))
        .filter(r => canOrder(view.rankIndex, r.rankIndex));

    const priced: Record<string, unknown> = {};
    if (powers.includes('set_admission')) {
        const ceiling = admissionCeilingFor(view.rankCount, ORDINALS_PER_SECT_RANK, MAX_ORDINAL);
        priced.admission = {
            current: view.admissionOrdinal,
            currentRank: rankName(view.admissionOrdinal),
            highestSettable: ceiling,
            highestSettableRank: rankName(ceiling),
            standingPerOrdinal: round2(
                affordable(view.house, admissionChangeCost(view.admissionOrdinal, view.admissionOrdinal + 1)).spends
            )
        };
    }
    if (powers.includes('expel_elder')) {
        priced.expulsions = view.elders.map(e => {
            const cost = expulsionCost(e.following, view.houseSize, view.ledger.expelled.length);
            const would = affordable(view.house, cost);
            return {
                elderId: e.id,
                name: e.name,
                rankTitle: e.rankTitle,
                following: e.following,
                disciplesLostWithThem: e.following,
                standingCost: round2(would.spends),
                wouldLeaveStandingAt: round2(would.wouldLandAt),
                wouldTrigger: would.wouldTrigger
            };
        });
    }
    if (powers.includes('grow')) {
        priced.growth = (['seat', 'elders'] as const).map(channel => {
            const plan = planGrowth(
                view.houseSize, view.entryStipend, view.teaches.length, 1, channel
            );
            return { ...plan, perDecade: true };
        });
    }

    return {
        sect: { id: view.sectId, name: view.sectName, size: view.houseSize },
        rank: { index: view.rankIndex, title: view.rankTitle, ladder: view.ranks },
        tier,
        powers,
        standing: {
            value: round2(view.ledger.standing),
            level,
            obstructionChance: round2(obstructionChance(view.ledger.standing)),
            ownFollowing: view.ledger.ownFollowing,
            ownFollowingShare: round2(view.ledger.ownFollowing / Math.max(1, view.houseSize)),
            obstructionsSoFar: view.ledger.obstructions
        },
        canSend,
        errands: ERRANDS,
        elders: view.elders.map(e => ({
            id: e.id,
            name: e.name,
            rankTitle: e.rankTitle,
            following: e.following,
            source: e.source
        })),
        house: {
            admissionOrdinal: view.admissionOrdinal,
            admissionRank: rankName(view.admissionOrdinal),
            teaches: view.teaches,
            curriculumDecreedOnDay: view.ledger.curriculumSetOnDay,
            membersAdded: view.ledger.membersAdded,
            membersLost: view.ledger.membersLost,
            answersToSomebody: view.hasPatron
        },
        priced,
        narrationHint:
            `${view.rankTitle} of ${view.sectName}. ` +
            (tier === 'ordered'
                ? 'The bottom rung, which means being sent rather than sending. Everything above can put this cultivator on a road.'
                : tier === 'ordering'
                    ? `Everything below this rung can be sent somewhere - ${canSend.reduce((n, r) => n + r.handsYouCanCall, 0)} pairs of hands, at most, and their days instead of yours.`
                    : tier === 'elder'
                        ? 'An elder rung: the disciples below can be sent, and new ones can be taken in under this line. A following built here is the only thing that makes a later bid for the seat survivable.'
                        : 'The head of the house: the standard, the methods, who is an elder, and how large the place gets. Every one of those is an act against people who were here first.') +
            ' ' + moodLine(level, view.sectName),
        note:
            'Nothing was ordered and nothing was decreed. Authority is the rank index and it reaches ' +
            'every lower rung in the same house; standing is the credit that spends and it is one number ' +
            'for the whole ladder.'
    };
}

/**
 * Send the rungs below somewhere. The first thing membership actually buys.
 */
/**
 * The world's row for the district a house's hands were sent out over.
 *
 * Where the order was given, because a house works the ground it stands on.
 * Null with no world layer, which is the same shape every other world-backed
 * read here has: with no world there is nothing that could say the district
 * has been worked out.
 */
async function theGroundTheHandsWereSentTo(
    run: Run,
    cultivator: Cultivator
): Promise<{ place: LocationRecord; onDay: number; wrote: boolean } | null> {
    try {
        const world = await worldForRun(run);
        const place = worldLocationFor(world, cultivator.location);
        return place
            ? { place, onDay: Math.floor(world.currentDay), wrote: false }
            : null;
    } catch {
        return null;
    }
}

export async function handleOrder(args: z.infer<typeof OrderSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    if (!powersAt(view.rankIndex, view.rankCount).includes('order')) {
        return noAuthority('order', view);
    }

    const roster = rosterByRung(view.houseSize, view.rankCount);
    const toRankIndex =
        args.toRankIndex ??
        (() => {
            for (let r = view.rankIndex - 1; r >= 0; r--) {
                if (commandableHands(view.rankIndex, r, view.houseSize, view.rankCount) > 0) return r;
            }
            return 0;
        })();

    if (!canOrder(view.rankIndex, toRankIndex)) {
        return guidingError(
            'cannot_order_upward',
            `${view.rankTitle} does not send ${view.ranks[toRankIndex] ?? 'that rank'} anywhere. ` +
            'A house runs downward, and asking the rung above for an errand is how a disciple ' +
            'becomes memorable for the wrong reason.',
            {
                rankIndex: view.rankIndex,
                rankTitle: view.rankTitle,
                toRankIndex,
                toRankTitle: view.ranks[toRankIndex] ?? null,
                canSend: view.ranks
                    .map((t, i) => ({ rankIndex: i, rankTitle: t }))
                    .filter(r => canOrder(view.rankIndex, r.rankIndex)),
                hint: 'Ask somebody below you, or earn the rank that reaches them.'
            }
        );
    }

    const available = commandableHands(view.rankIndex, toRankIndex, view.houseSize, view.rankCount);
    if (available <= 0) {
        return guidingError(
            'nobody_to_send',
            `There is nobody at ${view.ranks[toRankIndex]} that ${view.rankTitle} can call on. ` +
            `${roster[toRankIndex] ?? 0} stand on that rung and a rank one step above them can ask a quarter of them.`,
            { toRankIndex, onTheRung: roster[toRankIndex] ?? 0 }
        );
    }

    const hands = Math.min(args.hands ?? available, available);
    const days = args.days ?? 7;
    const errand = args.errand as Errand;
    const result = resolveErrand({ errand, hands, days, toRankIndex });
    const outcome = resolveAct(view.house, errandCost(errand, result));

    const rng = new CultivationRNG(
        `${view.run.seed}:order:${view.cultivator.id}:${view.sectId}:${view.run.elapsedDays}:${errand}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    const delivered = applied.obstructed
        ? Math.floor(result.delivered * OBSTRUCTED_DELIVERY_FRACTION)
        : result.delivered;

    // ── What actually arrives. The rung sent decides how far they can go. ──
    const reachOrdinal = rankRealmBand(view.sectId, toRankIndex)?.minOrdinal ?? 0;
    const herbs: { id: string; name: string; quantity: number }[] = [];
    let stones = 0;
    let contribution = 0;

    // ── A HOUSE DRAWS AT A SCALE ONE PERSON CANNOT ───────────────────────
    //
    // This is the consumer that makes depletion visible at all. A single
    // forager takes a tenth of what a district's mortal band grows back in a
    // year; twenty hands on a standing order do not, and the ground they are
    // sent to is the ground that runs out. Resolved before the transaction
    // because the world layer is async and the ledger write is not.
    const ground = errand === 'gather'
        ? await theGroundTheHandsWereSentTo(view.run, view.cultivator)
        : null;
    const groundLines: string[] = [];

    repos.db.transaction(() => {
        if (errand === 'gather') {
            const draw = new CultivationRNG(`${rng.seed}:herbs`);
            const tally = new Map<string, { name: string; quantity: number }>();
            for (let i = 0; i < delivered; i++) {
                const herb = rollHerb(reachOrdinal, draw.next());
                if (!herb) break;
                // One hand, one picking, one unit off the band. Ground with
                // nothing left sends that hand back empty rather than
                // inventing a stalk, and says so once per band.
                if (ground) {
                    const taken = drawFromTheGround(ground.place, {
                        kind: 'herb', grade: herb.grade, wanted: 1, onDay: ground.onDay
                    });
                    if (recordGroundDraw(ground.place, taken)) ground.wrote = true;
                    if (taken.line && !groundLines.includes(taken.line)) {
                        groundLines.push(taken.line);
                    }
                    if (taken.taken <= 0) continue;
                }
                const held = tally.get(herb.id) ?? { name: herb.name, quantity: 0 };
                held.quantity += 1;
                tally.set(herb.id, held);
            }
            for (const [id, held] of tally) {
                addToPouch(repos.db, view.cultivator.id, id, 'herb', held.quantity);
                herbs.push({ id, name: held.name, quantity: held.quantity });
            }
        } else if (errand === 'carry') {
            stones = delivered;
            repos.cultivators.applyDeltas(view.cultivator.id, { spiritStones: stones });
        } else {
            contribution = delivered;
            repos.sects.addContribution(view.sectId, view.cultivator.id, contribution);
        }
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    if (ground?.wrote) await saveWorldForRun(view.run);

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;

    return {
        ordered: true,
        obstructed: applied.obstructed,
        sect: { id: view.sectId, name: view.sectName },
        errand,
        sentRank: { index: toRankIndex, title: view.ranks[toRankIndex] },
        hands,
        days,
        handDays: result.handDays,
        expected: result.delivered,
        delivered,
        herbs,
        // What the ground the hands were sent to had to say. Empty while it is
        // holding up; a house that has worked its own district out has to be
        // told, because it is the reason to send the next party further.
        ground: ground
            ? {
                place: ground.place.name,
                says: groundLines,
                stillHas: howTheGroundReads(ground.place, ground.onDay)
            }
            : null,
        spiritStones: stones,
        contribution,
        standing: {
            before: round2(outcome.standingBefore),
            spent: round2(outcome.standingSpent),
            after: round2(outcome.standingAfter),
            level: outcome.level,
            obstructionChanceNextTime: round2(obstructionChance(outcome.standingAfter))
        },
        dismissedFromTheHouse: applied.dismissed,
        narrationHint:
            `${hands} ${view.ranks[toRankIndex]?.toLowerCase() ?? 'hands'} went out for ${days} days on ` +
            `${view.rankTitle}'s word, and ${view.cultivator.name} did not go with them - that is what the rank is for. ` +
            (applied.obstructed
                ? `${applied.narration} `
                : errand === 'gather'
                    ? `They came back with ${delivered} ${delivered === 1 ? 'thing' : 'things'} worth keeping, which is what that rung can reach without dying of the ground it stands on. `
                    : errand === 'carry'
                        ? `${delivered} spirit stones of haulage money, which is bad pay honestly earned by somebody else. `
                        : `${delivered} contribution, booked against the name that gave the order. `) +
            moodLine(outcome.level, view.sectName),
        note:
            'Ordering spends somebody else\'s days instead of the caller\'s, and spends a little of what ' +
            'that rung thinks of the caller. A rank that orders constantly is disliked by the rank below, ' +
            'and finds out on the same escalation the head of the house does.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

/**
 * Take people in. An elder takes disciples under their own line; only the seat
 * buys an elder in from outside, and that is the expensive one.
 */
export async function handleRecruit(args: z.infer<typeof RecruitSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    const kind = args.kind ?? 'disciple';
    const power: LeadershipPower = kind === 'elder' ? 'recruit_elders' : 'recruit_disciples';
    if (!powersAt(view.rankIndex, view.rankCount).includes(power)) {
        return noAuthority(power, view);
    }

    const count = args.count ?? 1;

    if (kind === 'elder') {
        const cost = externalElderCost(count, view.ledger.externalElders.length);
        const outcome = resolveAct(view.house, cost);
        const rng = new CultivationRNG(
            `${view.run.seed}:recruit_elder:${view.cultivator.id}:${view.sectId}:${view.run.elapsedDays}`
        );
        const applied = applyOutcome(repos, view, outcome, rng);

        const seated: string[] = [];
        if (!applied.obstructed && !applied.lostTheSeat) {
            const rung = Math.max(0, view.rankCount - 2);
            for (let i = 0; i < count; i++) {
                const id = `elder:${view.sectId}:bought:${view.ledger.externalElders.length + i}`;
                view.ledger.externalElders.push({ id, rankIndex: rung, following: 0 });
                seated.push(id);
            }
            view.ledger.membersAdded += count;
        }

        repos.db.transaction(() => {
            spendYears(repos, view, outcome.years);
            writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
            repos.runs.incrementTurn(view.run.id, 1);
        })();

        const after = repos.cultivators.getById(view.cultivator.id)!;
        const runAfter = repos.runs.getById(view.run.id)!;
        return {
            recruited: !applied.obstructed && !applied.lostTheSeat,
            kind: 'elder',
            obstructed: applied.obstructed,
            sect: { id: view.sectId, name: view.sectName },
            seatedElderIds: seated,
            yearsSpent: outcome.years,
            standing: {
                before: round2(outcome.standingBefore),
                spent: round2(outcome.standingSpent),
                after: round2(outcome.standingAfter),
                level: outcome.level
            },
            eldersLeaving: outcome.eldersLeaving.length,
            disciplesLeaving: outcome.disciplesLeaving,
            lostTheSeat: applied.lostTheSeat,
            narrationHint:
                (applied.obstructed
                    ? `The seat was offered and the paperwork went round the house and came back unsigned. ${applied.narration} `
                    : `${count} elder${count === 1 ? '' : 's'} seated at ${view.sectName} from outside it, ` +
                      'with no line in the house and nobody in the yard who owes them anything - which is ' +
                      'exactly why the head bought them. ') +
                outcome.insult + ' ' + moodLine(outcome.level, view.sectName) +
                (applied.narration && !applied.obstructed ? ` ${applied.narration}` : ''),
            note:
                'An elder brought in from outside starts with a following of nobody, so they answer to the ' +
                'person who seated them. The internal candidate who waited thirty years also noticed.',
            cultivator: describeCultivator(repos, after, runAfter)
        };
    }

    // ── Disciples, under this cultivator's own line. ──
    const plan = planDiscipleIntake(count, view.admissionOrdinal, view.entryStipend);
    if (view.cultivator.spiritStones < plan.stonesRequired) {
        return guidingError(
            'cannot_carry_them',
            `Taking ${count} disciple${count === 1 ? '' : 's'} in means carrying them for ten years before ` +
            `they are worth anything: ${plan.stonesRequired.toLocaleString()} spirit stones. ` +
            `${view.cultivator.name} holds ${view.cultivator.spiritStones.toLocaleString()}.`,
            {
                required: plan.stonesRequired,
                held: view.cultivator.spiritStones,
                shortBy: plan.stonesRequired - view.cultivator.spiritStones,
                perHead: Math.round(plan.stonesRequired / Math.max(1, count)),
                hint: 'A line of your own is bought with your own money. That is why most elders have three.'
            }
        );
    }

    // Recruiting into your own line costs nothing with the people below you -
    // it is what an elder rung is for - so the whole price is time and stones.
    const cost: ActCost = {
        act: 'recruit_disciples',
        standingCost: 0,
        standingEarned: 0,
        years: plan.years,
        insult: 'Nobody objects to an elder having disciples. That is what the rung is.'
    };
    const outcome = resolveAct(view.house, cost);
    const rng = new CultivationRNG(
        `${view.run.seed}:recruit:${view.cultivator.id}:${view.sectId}:${view.run.elapsedDays}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    view.ledger.ownFollowing += plan.count;
    view.ledger.membersAdded += plan.count;

    repos.db.transaction(() => {
        repos.cultivators.applyDeltas(view.cultivator.id, { spiritStones: -plan.stonesRequired });
        spendYears(repos, view, plan.years);
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;

    return {
        recruited: true,
        kind: 'disciple',
        sect: { id: view.sectId, name: view.sectName },
        count: plan.count,
        yearsSpent: plan.years,
        spiritStonesSpent: plan.stonesRequired,
        admissionOrdinal: view.admissionOrdinal,
        admissionRank: rankName(view.admissionOrdinal),
        ownFollowing: view.ledger.ownFollowing,
        ownFollowingShare: round2(view.ledger.ownFollowing / Math.max(1, view.houseSize + plan.count)),
        standing: { after: round2(outcome.standingAfter), level: outcome.level },
        // Taking disciples in costs no credit, but a cultivator who is already
        // past a threshold does not stop being past it because this act was free.
        dismissedFromTheHouse: applied.dismissed,
        lostTheSeat: applied.lostTheSeat,
        narrationHint:
            (applied.narration ? `${applied.narration} ` : '') +
            `${plan.count} disciple${plan.count === 1 ? '' : 's'} taken into ${view.sectName} under ` +
            `${view.cultivator.name}'s own line, over ${round2(plan.years)} years, at ` +
            `${plan.stonesRequired.toLocaleString()} spirit stones carried out of a private purse. ` +
            `The house admits from ${rankName(view.admissionOrdinal)}, which is why it took that long - ` +
            'the bar the head of the house sets is the bar every elder recruits against. ' +
            `${view.ledger.ownFollowing} people in this house now answer to this name rather than to the seat.`,
        note:
            'A following is armour. Every act against the house costs less in proportion to the share of ' +
            'it you personally brought in, which is the whole reason to spend decades as an elder before ' +
            'reaching for the seat.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

/** Set the standard the house admits at. There is no free direction. */
export async function handleAdmission(args: z.infer<typeof AdmissionSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    if (!powersAt(view.rankIndex, view.rankCount).includes('set_admission')) {
        return noAuthority('set_admission', view);
    }

    const ceiling = admissionCeilingFor(view.rankCount, ORDINALS_PER_SECT_RANK, MAX_ORDINAL);

    if (args.ordinal === undefined) {
        return {
            sect: { id: view.sectId, name: view.sectName },
            current: view.admissionOrdinal,
            currentRank: rankName(view.admissionOrdinal),
            highestSettable: ceiling,
            highestSettableRank: rankName(ceiling),
            standingPerOrdinal: round2(
                affordable(view.house, admissionChangeCost(0, 1)).spends
            ),
            narrationHint:
                `${view.sectName} admits from ${rankName(view.admissionOrdinal)} and nothing was changed. ` +
                'Raising it tells every disciple admitted under the old bar that they would not be admitted ' +
                'now; lowering it tells every elder that the one distinction they hold is being handed to ' +
                'the next person through the gate. There is no direction that costs nothing.',
            note: 'Nothing was set. Pass an ordinal to actually move the bar.'
        };
    }

    if (args.ordinal > ceiling) {
        return guidingError(
            'bar_would_strand_the_ladder',
            `${view.sectName} cannot admit from ${rankName(args.ordinal)}. Promotion needs ` +
            `${ORDINALS_PER_SECT_RANK} ordinals per rung above the bar, and a house of ` +
            `${view.rankCount} rungs set that high has a top rank nobody in the world could ever reach.`,
            {
                requested: args.ordinal,
                highestSettable: ceiling,
                highestSettableRank: rankName(ceiling),
                hint: 'The standard and the promotion ladder are the same number. Raise one and you raise the other.'
            }
        );
    }

    const cost = admissionChangeCost(view.admissionOrdinal, args.ordinal);
    if (cost.standingCost === 0) {
        return guidingError(
            'already_the_standard',
            `${view.sectName} already admits from ${rankName(view.admissionOrdinal)}.`,
            { current: view.admissionOrdinal }
        );
    }

    const outcome = resolveAct(view.house, cost);
    const rng = new CultivationRNG(
        `${view.run.seed}:admission:${view.cultivator.id}:${view.sectId}:${args.ordinal}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    const landed = !applied.obstructed && !applied.lostTheSeat;
    if (landed) view.ledger.admissionOrdinal = args.ordinal;

    repos.db.transaction(() => {
        if (landed) {
            const row = repos.sects.getById(view.sectId)!;
            repos.sects.upsert({ ...row, admissionOrdinal: args.ordinal! });
        }
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;

    return {
        set: landed,
        obstructed: applied.obstructed,
        sect: { id: view.sectId, name: view.sectName },
        from: view.admissionOrdinal,
        fromRank: rankName(view.admissionOrdinal),
        to: landed ? args.ordinal : view.admissionOrdinal,
        toRank: rankName(landed ? args.ordinal : view.admissionOrdinal),
        yearsBeforeTheHouseIsDifferent: outcome.years,
        standing: {
            before: round2(outcome.standingBefore),
            spent: round2(outcome.standingSpent),
            after: round2(outcome.standingAfter),
            level: outcome.level
        },
        eldersLeaving: outcome.eldersLeaving.length,
        disciplesLeaving: outcome.disciplesLeaving,
        lostTheSeat: applied.lostTheSeat,
        seatChallenged: outcome.seatChallenged,
        challengeHeld: applied.challengeHeld,
        narrationHint:
            (landed
                ? `${view.sectName} admits from ${rankName(args.ordinal)} as of this morning, where it ` +
                  `admitted from ${rankName(view.admissionOrdinal)} last night. ${outcome.insult} ` +
                  `It will take about ${outcome.years} years before the yard looks any different, because a ` +
                  'standard changes who comes in and nobody who is already here. '
                : `The decree was read. ${applied.narration} `) +
            moodLine(outcome.level, view.sectName) +
            (applied.narration && landed ? ` ${applied.narration}` : ''),
        note:
            'The admission ordinal is enforced by join and it is the same number promotion is measured ' +
            'from, so raising the bar raises the whole ladder for everybody already on it.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

/** Change what the house hands its intake. The most consequential act here. */
/**
 * Technique ids as the names a player would say back.
 *
 * An id the catalog does not hold passes through unchanged rather than being
 * dropped: an art a house genuinely teaches is worth naming even when this
 * process cannot resolve it, and inventing a name for it would be worse.
 */
function namesOf(ids: readonly string[]): string[] {
    return ids.map(id => getTechnique(id)?.name ?? id);
}

export async function handleCurriculum(args: z.infer<typeof CurriculumSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    const teach = args.teach ?? [];
    const retire = args.retire ?? [];

    // ── READING THE SHELF IS NOT DECREEING WHAT IS ON IT ─────────────────
    //
    // The authority gate used to run first, so a member asking what their own
    // house teaches was answered "Dew Servant does not do that in Azure Dew
    // Sect. It opens at Sect Warden, and not before." That is the right refusal
    // for rewriting a curriculum and the wrong one for looking at it: what a
    // house hands its intake is the single most useful fact about belonging to
    // it, every disciple in the world knows it, and it is not a secret from the
    // people being taught out of it.
    //
    // So the gate moved below the read. Naming nothing is a question and is
    // free to any member; naming something is a decree and still needs the
    // seat. Same split `site`, `petition`, `posture`, `seal` and `offer` all
    // follow, and the same one this file's own `expel` already uses.
    const decreeing = teach.length > 0 || retire.length > 0;
    if (!decreeing) {
        return {
            sect: { id: view.sectId, name: view.sectName },
            teaches: view.teaches,
            signatureTechniqueId: view.signatureTechniqueId,
            // NAMED, not counted. "Teaches 2 methods" is the deflection this
            // whole read exists to stop: the player asked WHAT, and a number is
            // an answer to how many. The names are what they would go and ask
            // to be taught.
            narrationHint: view.teaches.length === 0
                ? `${view.sectName} teaches nothing at all. A house with an empty shelf hands its `
                  + 'intake a name and a stipend and no road, and that is a fact about the house.'
                : `${view.sectName} teaches ${namesOf(view.teaches).join(', ')}. That is what a `
                  + 'member is taught out of, and what a house hands its intake is the single most '
                  + 'consequential thing about it over a century.',
            note: 'Nothing was decreed. Pass teach and retire to actually change the shelf.'
        };
    }

    if (!powersAt(view.rankIndex, view.rankCount).includes('set_curriculum')) {
        return noAuthority('set_curriculum', view);
    }

    const unknown = teach.filter(id => !getTechnique(id));
    if (unknown.length > 0) {
        return guidingError(
            'no_such_method',
            `${view.sectName} cannot teach what does not exist: ${unknown.join(', ')}.`,
            { unknown, hint: 'Technique ids come from the technique catalog, not from a description.' }
        );
    }

    // ── A HOUSE MAY TEACH WHAT A HOUSE HOLDS ─────────────────────────────
    //
    // The only check here was that the id existed, so a seat could decree a
    // RUIN- or GRAVE-provenance manual onto a taught shelf - which contradicts
    // the invariant `sects.ts` states in its own header: "no sect teaches a
    // ruin- or grave-provenance art". Not because those arts are forbidden,
    // but because of what provenance MEANS. `taught` is a shown art with a
    // living transmission behind it; `ruin` and `grave` are read ones, and a
    // house cannot show what nobody in it was ever shown. The manual is in a
    // hole, waiting for a digger, and a decree does not put a teacher next to
    // it.
    //
    // This is not a new rule and it is not a faction rule. It is one generic
    // column, read the same way `transmissionModeOf` reads it everywhere else,
    // and it applies to every house in the world including the seat that owns
    // the strongest thing in it.
    const notHeld = teach
        .map(id => getTechnique(id)!)
        .filter(art => art.provenance !== 'taught');
    if (notHeld.length > 0) {
        return guidingError(
            'nobody_here_was_ever_shown_it',
            `${view.sectName} cannot put ` +
            `${notHeld.map(a => `${a.name} (${a.provenance})`).join(', ')} on its shelf. ` +
            'A shelf is a living transmission and these are not: nobody in this house was ever ' +
            'shown them, and a decree does not produce somebody who was.',
            {
                notHeld: notHeld.map(a => ({
                    id: a.id,
                    name: a.name,
                    provenance: a.provenance,
                    mode: transmissionModeOf(a.provenance)
                })),
                hint:
                    'A dug art reaches a person through reading, one at a time, and never through ' +
                    'a curriculum. It is acquired by going to where it is.'
            }
        );
    }
    const notTaught = retire.filter(id => !view.teaches.includes(id));
    if (notTaught.length > 0) {
        return guidingError(
            'not_on_the_shelf',
            `${view.sectName} does not teach ${notTaught.join(', ')}, so there is nothing to retire.`,
            { notTaught, currentlyTeaches: view.teaches }
        );
    }

    const next = [...new Set([...view.teaches.filter(id => !retire.includes(id)), ...teach])];
    const cost = curriculumChangeCost(view.teaches, next, view.signatureTechniqueId);

    if (cost.standingCost === 0) {
        return {
            sect: { id: view.sectId, name: view.sectName },
            teaches: view.teaches,
            signatureTechniqueId: view.signatureTechniqueId,
            generationYears: cost.years,
            narrationHint:
                `${view.sectName}'s working library is unchanged: ${view.teaches.length} methods, and ` +
                'nothing on the shelf that was not on it yesterday. What a house hands its intake is the ' +
                'single most consequential thing about it over a century, which is why it costs what it costs.',
            note: 'Nothing was decreed. Pass teach and retire to actually change the shelf.'
        };
    }

    const outcome = resolveAct(view.house, cost);
    const rng = new CultivationRNG(
        `${view.run.seed}:curriculum:${view.cultivator.id}:${view.sectId}:${next.join(',')}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    const landed = !applied.obstructed && !applied.lostTheSeat;
    if (landed) {
        view.ledger.teaches = next;
        view.ledger.curriculumSetOnDay = view.run.elapsedDays;
    }

    repos.db.transaction(() => {
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;
    const landsOnDay = view.run.elapsedDays + outcome.years * DAYS_PER_YEAR;

    return {
        decreed: landed,
        obstructed: applied.obstructed,
        sect: { id: view.sectId, name: view.sectName },
        added: teach,
        retired: retire,
        signatureRetired:
            view.signatureTechniqueId !== null && retire.includes(view.signatureTechniqueId),
        teachesNow: landed ? next : view.teaches,
        decreedOnDay: landed ? view.run.elapsedDays : null,
        landsOnDay: landed ? landsOnDay : null,
        yearsUntilItIsWhatTheHouseIs: outcome.years,
        standing: {
            before: round2(outcome.standingBefore),
            spent: round2(outcome.standingSpent),
            after: round2(outcome.standingAfter),
            level: outcome.level
        },
        eldersLeaving: outcome.eldersLeaving.length,
        disciplesLeaving: outcome.disciplesLeaving,
        lostTheSeat: applied.lostTheSeat,
        seatChallenged: outcome.seatChallenged,
        challengeHeld: applied.challengeHeld,
        narrationHint:
            (landed
                ? `The library list of ${view.sectName} was rewritten this morning. ${outcome.insult} ` +
                  `Nothing about the people standing in the yard changes today: it is ${outcome.years} years ` +
                  'before the house is made of cultivators raised on the new shelf, and the head who signed ' +
                  'it may not be there to see whether it worked. '
                : `The list was read out. ${applied.narration} `) +
            moodLine(outcome.level, view.sectName) +
            (applied.narration && landed ? ` ${applied.narration}` : ''),
        note:
            'Changing what a house teaches is a generational act. The decree is immediate in the books ' +
            'and takes a generation to be what the house is, because the effect of a curriculum is the ' +
            'intake raised on it.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

/** Dismiss an elder. The only act here that lands the day it is spoken. */
export async function handleExpel(args: z.infer<typeof ExpelSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    if (!powersAt(view.rankIndex, view.rankCount).includes('expel_elder')) {
        return noAuthority('expel_elder', view);
    }

    if (!args.elderId) {
        return {
            sect: { id: view.sectId, name: view.sectName, size: view.houseSize },
            elders: view.elders.map(e => {
                const cost = expulsionCost(e.following, view.houseSize, view.ledger.expelled.length);
                const would = affordable(view.house, cost);
                return {
                    elderId: e.id,
                    name: e.name,
                    rankTitle: e.rankTitle,
                    source: e.source,
                    following: e.following,
                    disciplesLostWithThem: e.following,
                    standingCost: round2(would.spends),
                    wouldLeaveStandingAt: round2(would.wouldLandAt),
                    wouldTrigger: would.wouldTrigger
                };
            }),
            narrationHint:
                `${view.sectName} has ${view.elders.length} elder${view.elders.length === 1 ? '' : 's'} ` +
                'and nobody was dismissed. They do not leave alone: an elder walks out with the disciples ' +
                'they brought in, so the price of each one is written in people as well as in credit. ' +
                'The expensive ones are expensive because half the yard answers to them.',
            note: 'Nothing was done. Pass an elderId to actually dismiss somebody.'
        };
    }

    const elder = view.elders.find(e => e.id === args.elderId);
    if (!elder) {
        return guidingError(
            'no_such_elder',
            `${view.sectName} has no elder with id ${args.elderId}.`,
            {
                elders: view.elders.map(e => ({ id: e.id, name: e.name, following: e.following })),
                hint: 'sect_manage({ action: "expel" }) with no elderId lists every one of them and its price.'
            }
        );
    }

    const cost = expulsionCost(elder.following, view.houseSize, view.ledger.expelled.length);
    const outcome = resolveAct(view.house, cost);
    const rng = new CultivationRNG(
        `${view.run.seed}:expel:${view.cultivator.id}:${view.sectId}:${elder.id}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    const landed = !applied.obstructed && !applied.lostTheSeat;
    if (landed) {
        view.ledger.expelled.push(elder.id);
        view.ledger.membersLost += 1 + elder.following;
        view.ledger.externalElders = view.ledger.externalElders.filter(e => e.id !== elder.id);
    }

    repos.db.transaction(() => {
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;
    const who = elder.name ?? `the ${elder.rankTitle}`;

    return {
        expelled: landed,
        obstructed: applied.obstructed,
        sect: { id: view.sectId, name: view.sectName },
        elder: {
            id: elder.id,
            name: elder.name,
            rankTitle: elder.rankTitle,
            source: elder.source,
            following: elder.following
        },
        disciplesLostWithThem: landed ? elder.following : 0,
        houseSizeNow: Math.max(1, view.baseHouseSize + view.ledger.membersAdded - view.ledger.membersLost),
        expulsionsSoFar: view.ledger.expelled.length,
        standing: {
            before: round2(outcome.standingBefore),
            spent: round2(outcome.standingSpent),
            after: round2(outcome.standingAfter),
            level: outcome.level
        },
        eldersLeaving: outcome.eldersLeaving.length,
        disciplesLeaving: outcome.disciplesLeaving,
        lostTheSeat: applied.lostTheSeat,
        seatChallenged: outcome.seatChallenged,
        challengeHeld: applied.challengeHeld,
        narrationHint:
            (landed
                ? `${who} was dismissed from ${view.sectName} this morning, and ${elder.following} ` +
                  `disciple${elder.following === 1 ? '' : 's'} left the gate behind them without being asked to. ` +
                  `${outcome.insult} This is the only thing the head of a house can do that happens the day ` +
                  'it is said, which is exactly why the whole of its price is on the other side of it. '
                : `The dismissal was written and it was not carried out. ${applied.narration} `) +
            moodLine(outcome.level, view.sectName) +
            (applied.narration && landed ? ` ${applied.narration}` : ''),
        note:
            'An elder does not leave alone. The next dismissal costs more than this one, because every ' +
            'elder left standing has now been told the terms on which they hold their own seat.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

/** Make the house bigger. The only act that earns credit rather than spending it. */
export async function handleGrow(args: z.infer<typeof GrowSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const view = loadHouse(repos, args);
    if (isGuidingErrorBody(view)) return view;

    if (!powersAt(view.rankIndex, view.rankCount).includes('grow')) {
        return noAuthority('grow', view);
    }

    const channel = args.through ?? 'seat';
    const decades = args.decades ?? 1;
    const plan = planGrowth(
        view.houseSize, view.entryStipend, view.teaches.length, decades, channel
    );

    if (view.cultivator.spiritStones < plan.stonesRequired) {
        return guidingError(
            'cannot_pay_the_intake',
            `Growing ${view.sectName} by ${plan.intake} over ${plan.years} years means carrying them: ` +
            `${plan.stonesRequired.toLocaleString()} spirit stones. ${view.cultivator.name} holds ` +
            `${view.cultivator.spiritStones.toLocaleString()}.`,
            {
                intake: plan.intake,
                required: plan.stonesRequired,
                held: view.cultivator.spiritStones,
                shortBy: plan.stonesRequired - view.cultivator.spiritStones,
                hint: 'A house grows on somebody\'s money. The reserves are one place it has come from before - see siphon.'
            }
        );
    }

    const cost: ActCost = {
        act: 'grow',
        standingCost: 0,
        standingEarned: plan.standingEarned,
        years: plan.years,
        insult:
            channel === 'seat'
                ? 'Nobody objects to a bigger house. They object to who the new people answer to, and these ones answer to the seat.'
                : 'The elders were handed the intake and they took it, and every one of the new names went into somebody else\'s line.'
    };
    const outcome = resolveAct(view.house, cost);
    const rng = new CultivationRNG(
        `${view.run.seed}:grow:${view.cultivator.id}:${view.sectId}:${view.run.elapsedDays}`
    );
    const applied = applyOutcome(repos, view, outcome, rng);

    view.ledger.membersAdded += plan.intake;
    if (channel === 'seat') view.ledger.ownFollowing += plan.intake;

    const sizeNow = Math.max(
        1, view.baseHouseSize + view.ledger.membersAdded - view.ledger.membersLost
    );
    const facts = getSect(view.sectId);
    const drift = powerOrdinalDrift(sizeNow, view.baseHouseSize);
    const powerNow = Math.max(
        0, Math.min(MAX_ORDINAL, (facts?.powerOrdinal ?? 0) + drift)
    );

    repos.db.transaction(() => {
        repos.cultivators.applyDeltas(view.cultivator.id, { spiritStones: -plan.stonesRequired });
        const row = repos.sects.getById(view.sectId)!;
        repos.sects.upsert({ ...row, powerOrdinal: powerNow });
        spendYears(repos, view, plan.years);
        writeLedger(repos, view.cultivator.id, view.sectId, view.ledger);
        repos.runs.incrementTurn(view.run.id, 1);
    })();

    const after = repos.cultivators.getById(view.cultivator.id)!;
    const runAfter = repos.runs.getById(view.run.id)!;

    return {
        grew: true,
        sect: { id: view.sectId, name: view.sectName },
        through: channel,
        attachesTo: plan.attachesTo,
        decades,
        intake: plan.intake,
        yearsSpent: plan.years,
        spiritStonesSpent: plan.stonesRequired,
        houseSizeBefore: view.houseSize,
        houseSizeNow: sizeNow,
        powerOrdinal: powerNow,
        powerRank: rankName(powerNow),
        powerOrdinalDrift: drift,
        ownFollowing: view.ledger.ownFollowing,
        standing: {
            before: round2(outcome.standingBefore),
            earned: round2(outcome.standingEarned),
            after: round2(outcome.standingAfter),
            level: outcome.level
        },
        narrationHint:
            `${plan.years} years of deliberate intake and ${view.sectName} is ${sizeNow} people where it ` +
            `was ${view.houseSize}, at ${plan.stonesRequired.toLocaleString()} spirit stones out of the ` +
            'head of the house\'s own purse. ' +
            (channel === 'seat'
                ? 'Every one of them was found by the seat and answers to the seat, which is slow and is the ' +
                  'only kind of growth that makes the next argument cheaper. '
                : 'The elders did the finding, which is roughly three times faster and means every one of the ' +
                  'new names went into somebody else\'s line. The house is bigger and the head of it is not. ') +
            (drift !== 0
                ? `The house now stands at ${rankName(powerNow)}. `
                : 'Numbers are not power here, and it will take a doubling before anybody outside notices. ') +
            moodLine(outcome.level, view.sectName) +
            (applied.narration ? ` ${applied.narration}` : ''),
        note:
            'Growth is the only act that earns standing rather than spending it, which is why it is slow ' +
            'and expensive. Delegating it is faster and builds exactly the power base that will later ' +
            'refuse the person who delegated it.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}
