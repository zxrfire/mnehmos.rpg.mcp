/**
 * When somebody does not come back.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { REALM_TIERS, lifespanForOrdinal, realmIndexOf } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import {
    confidenceForStage,
    stageTag,
    stanceForStage,
    type KnowingStage
} from '../social/discovery.js';
import {
    recordFact as recordTruth,
    recordKnowledge,
    recordPublicBelief,
    type Fact,
    type KnowledgeRecord,
    type SourceKind
} from '../social/knowledge.js';
import { createObligation, type GrudgeCause, type ObligationInput, type Severity } from '../social/grudges.js';
import { NO_NAME_ON_IT, theSearchItOpens, withNoNameOnIt } from '../social/accounts-with-no-name.js';
import { FRIENDSHIP_STANDING } from './gatherings.js';
import { makeFact, yearOfDay, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    addGoal,
    closeGoal,
    isActing,
    isUnadjudicated,
    setFaction,
    theTieBecomes,
    upsertRelationship,
    type NpcRecord,
    type NpcRelationship,
    type RelationshipKind
} from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import { indexById, type WorldState } from './world-state.js';
import {
    THE_WORLD_LOST_SIGHT_OF,
    theHouseKnowsAgain,
    theHouseLosesTrackOf,
    whenTheWorldLostSightOf,
    whenTheyWereLastAccountedFor,
    whoTheHouseHasLostTrackOf
} from './who-a-house-has-lost-track-of.js';
import { whoHasALampBurningIn } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';

// ─────────────────────────────────────────────────────────────────────────
// RATES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance in a year that somebody who was waiting stops, STATED IN A MORTAL LIFE.
 *
 * MEASURED, AND THE FIGURE THAT SENT IT BACK. Three worlds, fifteen centuries,
 * a census every hundred years: people stopped waiting after a median of 19, 21
 * and 19 years - while the write-off in the same run, which IS on a
 * cultivator's clock, waited a median of 473, 458 and 457 years before
 * concluding anybody was dead. So the world gave up on a person four centuries
 * before it would admit they might be dead, and a Nascent Soul wife who will
 * live two thousand years put her husband down in half a mortal lifetime.
 *
 * A YEAR IS A SHARE OF A LIFE - AND THE LIFE IS THE ABSENTEE'S, NOT THE
 * WAITER'S. This module is not allowed to rank a waiter by their cultivation:
 * a mortal wife waits exactly as long as a Nascent Soul one, which is the
 * social layer's prohibition enforced from the world side and is pinned by
 * `never ranks anybody by cultivation when deciding who waits`. What may be
 * consulted is the MISSING person's span, which is what the write-off beside
 * this already reads (`theYearsTheyCouldStillBeAlive`), and it is the more
 * honest term anyway: you stop waiting when you conclude they are not coming
 * back, and how long somebody could still be alive is a fact about them.
 *
 * So the rate is a mortal's, thinned by the span of whoever went missing.
 * Arithmetically that leaves a missing mortal at the measured 19 years, puts a
 * missing Core Formation cultivator at about 77, and a missing Nascent Soul at
 * about 300 - under the write-off's four and a half centuries rather than two
 * orders of magnitude below it, which is the relation the two should have had
 * all along. The measured medians after this are the next run's to report.
 */
export const STOP_WAITING_PER_YEAR = 0.045;

/** Above this standing the tie was the kind people wait a lifetime on. */
export const DEFINING_STANDING = 0.8;

/**
 * What a defining tie multiplies the give-up rate by. They wait twice as long.
 */
export const DEFINING_TIE_PATIENCE = 0.5;

/**
 * What being told where the absentee went multiplies the rates by.
 */
export const INFORMED_PATIENCE = 0.5;

/** Chance per year that the world concludes an unexplained absence was a death. */
export const WRITTEN_OFF_PER_YEAR = 0.035;

/**
 * How long a house waits before it will conclude a missing person is dead: the
 * years they could still be alive for, and not a fixed few.
 *
 * The design owner, on what makes a house write somebody off: they do it *"when
 * they die at their realm they went missing at, or one realm above"*. It was
 * three years, which is a human figure on a road where people sit in a cave for
 * forty. A Foundation cultivator who walked into a mountain range at ninety has
 * a century left in them at the realm they were lost at; nobody sensible calls
 * them dead at ninety-three.
 *
 * So the grace is their own remaining lifespan at the realm they were lost at,
 * PLUS what one realm above would have added, since somebody out in the world
 * for a century may well have advanced. Past that, nobody could still be alive,
 * and the house closes the book. A lamp going out, word of their death or their
 * walking back in all end it sooner, and none of them wait on this.
 */
export const A_MORTAL_LIFE_YEARS = REALM_TIERS[0]!.lifespanYears;

export function theYearsTheyCouldStillBeAlive(input: {
    /** Their rung on the day they were lost. */
    ordinal: number;
    /** How old they were, in years, on that day. */
    ageInYears: number;
}): number {
    const here = realmIndexOf(input.ordinal);
    const at = REALM_TIERS[here] ?? REALM_TIERS[0]!;
    const above = REALM_TIERS[Math.min(REALM_TIERS.length - 1, here + 1)] ?? at;
    return Math.max(0, above.lifespanYears - Math.max(0, input.ageInYears));
}

/**
 * Chance that somebody who stopped waiting on a household tie takes another.
 */
export const NEW_HOUSEHOLD_CHANCE = 0.5;

/** The topic every account of one person's fate is filed against. */
export const FATE_CLAIM_PREFIX = 'fate:';

export function fateClaimKey(absenteeId: string): string {
    return `${FATE_CLAIM_PREFIX}${absenteeId}`;
}

/**
 * Ties that carry an expectation of return.
 */
const WAITING_KINDS = new Set<RelationshipKind>([
    'spouse', 'kin', 'parent', 'child', 'master', 'disciple', 'ally'
]);

/** Ties where a household actually ended, and could be replaced by another. */
const HOUSEHOLD_KINDS = new Set<RelationshipKind>(['spouse', 'kin']);

/**
 * What the person holding the tie thinks was done, when nobody can say.
 */
const WHAT_THEY_THINK_WAS_DONE: Readonly<Partial<Record<RelationshipKind, GrudgeCause>>> =
    Object.freeze({
        spouse: 'killed_kin',
        kin: 'killed_kin',
        parent: 'killed_kin',
        child: 'killed_kin',
        master: 'killed_master',
        disciple: 'killed_sectmate',
        ally: 'killed_sectmate'
    });

/**
 * Whether anybody at all can say where the absentee went.
 */
function nobodyCanSayWhereTheyWent(absence: {
    witnessIds: readonly string[];
    toldIds: readonly string[];
}): boolean {
    return absence.witnessIds.length === 0 && absence.toldIds.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ABSENCE
// ─────────────────────────────────────────────────────────────────────────

export type AbsenceConsequenceKind =
    /** They gave up. Dated, with the number of years on it. */
    | 'stopped_waiting'
    /** They died still expecting a return, which is the worst of the outcomes. */
    | 'died_waiting'
    /** They died, or went missing themselves, without a stake in it. */
    | 'died'
    /** Somebody who stopped waiting on a household tie took another one. */
    | 'took_another_household'
    /** The world concluded the absence was a death. */
    | 'written_off'
    /** The absentee's house stopped counting them as a member. */
    | 'struck_from_the_rolls'
    /** The only person who knew the truth is no longer able to tell anyone. */
    | 'witness_lost';

export interface AbsenceConsequence {
    kind: AbsenceConsequenceKind;
    onDay: number;
    year: number;
    /** Years of absence elapsed when it happened. The number the fiction turns on. */
    afterYears: number;
    /** Whose life this is about. The absentee, for the world-level ones. */
    subjectId: string;
    subjectName: string;
    summary: string;
    /** Chronicle fact, when this consequence wrote one. */
    factId: string | null;
    /** Knowledge rows it produced, so a caller can file them without matching. */
    accountIds: string[];
}

/**
 * One tie as it stood on the day the absentee left.
 */
export interface TieAtDeparture {
    holderId: string;
    holderName: string;
    kind: RelationshipKind;
    standing: number;
    locationId: string | null;
    factionId: string | null;
    factionRankIndex: number;
    realmOrdinal: number;
    /** They saw the absentee go, or were told where. */
    informed: boolean;
    /** They had reason to expect a return, and a goal was opened saying so. */
    waiting: boolean;
    /** The `reunion` goal opened for them, when one was. */
    goalId: string | null;
    settledOnDay: number | null;
    settledAs: AbsenceConsequenceKind | null;
}

export interface Absence {
    absenteeId: string;
    absenteeName: string;
    leftOnDay: number;
    /** Where they went, when anybody could say. */
    locationId: string | null;
    /** The house they belonged to on the way in. */
    factionId: string | null;
    factionRankIndex: number;
    /** Who watched them go, and therefore knows they were alive. */
    witnessIds: string[];
    /** Who was told where they were going. */
    toldIds: string[];
    ties: TieAtDeparture[];
    /** How far the yearly pass has been run. Absences never resolve twice. */
    settledThroughDay: number;
    /** The day the world concluded they were dead. Null while nobody has. */
    writtenOffOnDay: number | null;
    /** The engine's own row saying what was actually the case. */
    truthFactId: string;
    claimKey: string;
}

export interface BeginAbsenceInput {
    absenteeId: string;
    absenteeName: string;
    onDay: number;
    locationId?: string | null;
    factionId?: string | null;
    factionRankIndex?: number;
    /** People who were physically there. They reach `knows` and stay right. */
    witnessIds?: readonly string[];
    /** People who were told where and for how long. */
    toldIds?: readonly string[];
    /** What is actually true, in the engine's words. Never shown to a character. */
    truth?: string;
    /** The chronicle fact that caused the absence, when one already exists. */
    causeFactId?: string | null;
}

export interface AbsenceOpening {
    absence: Absence;
    /** Objective reality. ENGINE ONLY - see `knowledge.ts`. */
    truth: Fact;
    /** Rows for the people who actually know something. File them in a ledger. */
    accounts: KnowledgeRecord[];
}

/**
 * Open an absence, and write down what the few people who know actually know.
 */
export function beginAbsence(state: WorldState, input: BeginAbsenceInput): AbsenceOpening {
    const claimKey = fateClaimKey(input.absenteeId);
    const witnessIds = [...new Set(input.witnessIds ?? [])].sort();
    const toldIds = [...new Set(input.toldIds ?? [])].sort();
    const informed = new Set([...witnessIds, ...toldIds]);
    const unexplained = nobodyCanSayWhereTheyWent({ witnessIds, toldIds });

    const truth = recordTruth({
        claimKey,
        onDay: input.onDay,
        statement:
            input.truth ??
            `${input.absenteeName} withdrew from the world and was alive when they did.`,
        detail: {
            absenteeId: input.absenteeId,
            leftOnDay: input.onDay,
            locationId: input.locationId ?? '',
            outcome: 'absent'
        },
        subjects: [input.absenteeId],
        tags: ['absence'],
        // Nobody saw it: the world has no honest way to find out what happened.
        concealed: witnessIds.length === 0
    });

    const ties: TieAtDeparture[] = [];
    const accounts: KnowledgeRecord[] = [];

    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at];
        if (npc.id === input.absenteeId) continue;
        // EVERY ROW, AND THE WARMEST ONE THAT WAITS. Rows are keyed by the pair
        // AND the kind, so a person can hold several things about one other
        // person at once, sorted with the most defining kind first. Reading one
        // row asked the sort rather than the world: `former_master` sorts ahead
        // of `ally` and is not a kind that waits, so somebody who would have sat
        // up for a friend read as somebody who would not. Waiting is a question
        // about the warmest real reason to wait, so `waits` is the warmest row
        // whose kind carries an expectation of return, and `rel` is only the
        // existence of anything at all between them.
        let rel: NpcRelationship | null = null;
        let waits: NpcRelationship | null = null;
        for (const row of npc.relationships) {
            if (row.targetId !== input.absenteeId) continue;
            if (rel === null) rel = row;
            if (!WAITING_KINDS.has(row.kind)) continue;
            if (waits === null || row.standing > waits.standing) waits = row;
        }
        if (rel === null) continue;
        // AND THE RECORD IS WRITTEN OFF THE ROW THE DECISION WAS MADE ON, or it
        // would name one kind and have waited for another.
        const held = waits ?? rel;
        if (!isActing(npc.status)) continue;

        const isInformed = informed.has(npc.id);
        // ── WHO SITS UP ──────────────────────────────────────────────────
        //
        // Two roads to expecting somebody back, and the second one is what
        // makes this module reachable at all.
        //
        // The first is being told. That is the seclusion case, and the gate is
        // right there: a man announces a forty-year retreat, the people he told
        // wait, and the rest of the province gets on with its life.
        //
        // The second is that nobody said anything and he simply did not come
        // home. This used to fall through the same gate and produce nothing -
        // an absence with no witnesses and nobody told had no waiting ties at
        // all, so the yearly pass had nothing to do and every road the WORLD
        // has into somebody going missing was inert. That is the wrong shape
        // twice over: it reads as a value, and it says a wife waits for a
        // husband who filed his intentions and does not wait for one who
        // vanished. This module's own header wanted the opposite - the
        // `disappearance` event's chronicle line is "treated as dead by
        // everyone except one person", and that one person is a waiting tie.
        //
        // Being told is still the lever, and it is priced where it belongs:
        // `INFORMED_PATIENCE` halves the give-up rate for somebody who was
        // told. Not being told does not stop you waiting - it costs you the
        // patience of knowing.
        const waiting =
            (isInformed || unexplained) &&
            waits !== null &&
            waits.standing >= FRIENDSHIP_STANDING;

        let goalId: string | null = null;
        if (waiting) {
            const before = state.npcs[at].nextGoalSeq;
            state.npcs[at] = addGoal(
                state.npcs[at],
                {
                    kind: 'reunion',
                    text: `Be here when ${input.absenteeName} comes back.`,
                    priority: Math.min(1, Math.max(0.2, held.standing)),
                    targetId: input.absenteeId,
                    progress: 'Waiting.',
                    obstacles: ['No word.'],
                    note: witnessIds.includes(npc.id)
                        ? 'Saw them go.'
                        : toldIds.includes(npc.id)
                            ? 'Was told where they were going.'
                            : 'Nobody ever said what happened.'
                },
                input.onDay
            );
            goalId = `${npc.id}-g${before}`;
        }

        ties.push({
            holderId: npc.id,
            holderName: npc.name,
            kind: held.kind,
            standing: held.standing,
            locationId: npc.locationId,
            factionId: npc.factionId,
            factionRankIndex: npc.factionRankIndex,
            realmOrdinal: npc.cultivation.realmOrdinal,
            informed: isInformed,
            waiting,
            goalId,
            settledOnDay: null,
            settledAs: null
        });
    }

    ties.sort((a, b) => (a.holderId < b.holderId ? -1 : a.holderId > b.holderId ? 1 : 0));

    // What the people who were actually there hold. A witness reaches the top
    // of the ladder and stays right about it for as long as they live, which is
    // how an enemy who watched the door ends up the only correct account in the
    // world - not as an exception, but because they were standing there.
    for (const holderId of witnessIds) {
        accounts.push(
            account({
                holderId,
                claimKey,
                factId: truth.id,
                onDay: input.onDay,
                stage: 'encountered',
                source: { kind: 'witnessed' },
                statement: `${input.absenteeName} went into seclusion and was alive when they did.`,
                detail: { outcome: 'absent', leftOnDay: input.onDay }
            })
        );
    }
    for (const holderId of toldIds) {
        if (witnessIds.includes(holderId)) continue;
        accounts.push(
            account({
                holderId,
                claimKey,
                factId: truth.id,
                onDay: input.onDay,
                stage: 'placed',
                source: { kind: 'told', fromHolderId: input.absenteeId },
                statement: `${input.absenteeName} said they were going into seclusion and would come back.`,
                detail: { outcome: 'absent', leftOnDay: input.onDay }
            })
        );
    }

    return {
        absence: {
            absenteeId: input.absenteeId,
            absenteeName: input.absenteeName,
            leftOnDay: input.onDay,
            locationId: input.locationId ?? null,
            factionId: input.factionId ?? null,
            factionRankIndex: input.factionRankIndex ?? -1,
            witnessIds,
            toldIds,
            ties,
            settledThroughDay: input.onDay,
            writtenOffOnDay: null,
            truthFactId: truth.id,
            claimKey
        },
        truth,
        accounts
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A HOUSE KNOWS OF ITS OWN
// ─────────────────────────────────────────────────────────────────────────

/**
 * The chance somebody lost finds their way back to their house, rather than going
 * their own way.
 *
 * Half. Nothing in the world yet says who a lost person is or what they would
 * rather do, so this is the one place a lost life forks; everything after it -
 * ageing, climbing, dying, being robbed on the road - is the world's own passes
 * running on a living person.
 */
export const A_LOST_PERSON_FINDS_THEIR_WAY_BACK = 0.5;

/** The fewest and most years a lost person is on the road back. */
export const YEARS_FINDING_THE_WAY_BACK: readonly [number, number] = [1, 6];

/** What houses learned this slice, for measuring. Nothing stores it. */
export interface WhatHousesLearned {
    /** People a pass lost sight of, now marked on their house. */
    lostTrackOf: number;
    /** Of those, how many set out for home, and how many went their own way. */
    headedHome: number;
    wentTheirOwnWay: number;
    /** People the house had lost whose lamp went out. */
    theLampWentOut: number;
    /** People the house had lost who are back in front of it. */
    cameBack: number;
}

/**
 * What houses learn of their own. Mutates `state`.
 *
 * The design owner: *"they still die of old age unless they advance, and they
 * still die or reappear and can be found dead. Missing people are still somewhere
 * physical, just the sect doesn't know."* So:
 *
 *   lost        a pass lost sight of somebody (`markMissing`). Their house now
 *               holds that it does not know where they are
 *               (`theHouseLosesTrackOf`), and they are somewhere real: on the
 *               road home ({@link A_LOST_PERSON_FINDS_THEIR_WAY_BACK}, walked back
 *               by the ordinary return pass), or gone their own way off the roll
 *               from wherever they were lost
 *   dead        the lamp goes out and the house knows. One fact, at the house
 *   back        they are standing at the house's seat, one of its own again, and
 *               the house knows. One fact
 *
 * Somebody who went their own way stays lost to the house until one of those.
 * The absence opened for them closes when their house knows.
 */
export function whatHousesLearnOfTheirOwn(state: WorldState, onDay: number): WhatHousesLearned {
    const learned: WhatHousesLearned = { lostTrackOf: 0, headedHome: 0, wentTheirOwnWay: 0, theLampWentOut: 0, cameBack: 0 };
    const houseAt = new Map(state.factions.map((f, i) => [f.id, i] as const));

    // ── LOST ─────────────────────────────────────────────────────────────
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        const since = whenTheWorldLostSightOf(npc);
        if (since === null) continue;
        let row: NpcRecord = { ...npc, tags: npc.tags.filter(t => !t.startsWith(THE_WORLD_LOST_SIGHT_OF)) };
        const h = npc.factionId === null ? undefined : houseAt.get(npc.factionId);
        const house = h === undefined ? null : state.factions[h]!;
        if (house && house.dissolvedOnDay === null && npc.status === 'alive') {
            state.factions[h!] = theHouseLosesTrackOf(house, npc.id, since);
            learned.lostTrackOf++;
            // THE HALL STARTS ASKING. The house knowing one of its own has not
            // come back is somebody at the house saying so.
            appendWorldFact(state, makeFact({
                day: since,
                kind: 'said_in_public',
                scale: 'local',
                visibility: 'faction',
                magnitude: 0.3 + Math.min(0.3, npc.cultivation.realmOrdinal * 0.01),
                summary: `${npc.name} was due back at the ${house.name.replace(/^[Tt]he\s+/, '')} and is overdue. `
                    + 'The hall has started asking.',
                actors: [{ id: npc.id, name: npc.name, role: 'missing' }],
                locationId: house.seatLocationId,
                factionIds: [house.id],
                data: {
                    lostTrackOf: npc.id,
                    outcome: 'lost',
                    unattributed: 'Somebody at the compound has been asking after a name.'
                }
            }), { bystanders: false, recur: false });
            // Whatever term they were out on is over: nobody is bringing them
            // back on it, and no board pays for it.
            row = { ...row, tags: row.tags.filter(t => !t.startsWith('board-work|')) };
            const rng = forStream(state.seed, 'somebody-lost', npc.id, String(since));
            if (house.seatLocationId !== null && rng.chance(A_LOST_PERSON_FINDS_THEIR_WAY_BACK)) {
                const years = rng.int(YEARS_FINDING_THE_WAY_BACK[0], YEARS_FINDING_THE_WAY_BACK[1]);
                row = {
                    ...row,
                    activity: {
                        kind: 'travelling',
                        note: `Lost to ${house.name}, and finding the way back to it.`,
                        withIds: [],
                        sinceDay: since,
                        untilDay: since + years * DAYS_PER_YEAR,
                        returnTo: house.seatLocationId
                    }
                };
                learned.headedHome++;
            } else {
                row = { ...setFaction(row, null, -1, since), activity: null };
                learned.wentTheirOwnWay++;
            }
        }
        // AND THE ROW THE FACT WAS JUST LINKED ONTO IS THE ONE THAT SURVIVES.
        // `row` was taken before the hall said anything, so writing it back
        // dropped the link `appendWorldFact` had just made and left a fact
        // naming somebody whose record did not carry it - which
        // `what-a-world-must-never-contain` refuses.
        const linked = state.npcs[i]!;
        state.npcs[i] = {
            ...row,
            historyFactIds: linked.historyFactIds,
            lastConfirmedOnDay: Math.max(row.lastConfirmedOnDay, linked.lastConfirmedOnDay)
        };
    }

    // ── DEAD, OR BACK ────────────────────────────────────────────────────
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const settled = new Set<string>();
    for (let h = 0; h < state.factions.length; h++) {
        let house = state.factions[h]!;
        const lost = whoTheHouseHasLostTrackOf(house);
        if (lost.length === 0) continue;
        if (house.dissolvedOnDay !== null) {
            for (const one of lost) house = theHouseKnowsAgain(house, one.personId);
            state.factions[h] = house;
            continue;
        }
        const lamps = whoHasALampBurningIn(state.objects, house.id);
        for (const one of lost) {
            const person = byId.get(one.personId);
            const sinceYear = yearOfDay(one.sinceDay);
            if (!person || person.status !== 'alive') {
                house = theHouseKnowsAgain(house, one.personId);
                settled.add(one.personId);
                learned.theLampWentOut++;
                const name = person?.name ?? 'somebody of the house';
                appendWorldFact(state, makeFact({
                    day: Math.max(one.sinceDay, person?.diedOnDay ?? onDay),
                    kind: 'said_in_public',
                    scale: 'personal',
                    visibility: 'faction',
                    magnitude: 0.3,
                    summary: lamps.has(one.personId)
                        ? `The life lamp of ${name} went out in the hall of ${house.name}. Nobody of the house had known where they were since year ${sinceYear}.`
                        : `${house.name} learned that ${name}, whom nobody of the house had known the whereabouts of since year ${sinceYear}, is dead.`,
                    actors: person ? [{ id: person.id, name: person.name, role: 'lost to the house' }] : [],
                    locationId: house.seatLocationId,
                    factionIds: [house.id],
                    data: { lostTrackOf: one.personId, outcome: 'dead', sinceDay: one.sinceDay }
                }), { bystanders: false, recur: false });
                continue;
            }
            if (person.factionId === house.id && house.seatLocationId !== null && person.locationId === house.seatLocationId) {
                house = theHouseKnowsAgain(house, one.personId);
                settled.add(one.personId);
                learned.cameBack++;
                appendWorldFact(state, makeFact({
                    day: onDay,
                    kind: 'said_in_public',
                    scale: 'personal',
                    visibility: 'faction',
                    magnitude: 0.3,
                    summary: `${person.name} came back to ${house.name}, where nobody had known where they were since year ${sinceYear}.`,
                    actors: [{ id: person.id, name: person.name, role: 'came back' }],
                    locationId: house.seatLocationId,
                    factionIds: [house.id],
                    data: { lostTrackOf: one.personId, outcome: 'came back', sinceDay: one.sinceDay }
                }), { bystanders: false, recur: false });
            }
        }
        state.factions[h] = house;
    }
    if (settled.size > 0 && state.absences) {
        state.absences = state.absences.filter(a => !settled.has(a.absenteeId));
    }
    return learned;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO OPENS ONE, AND WHERE THE LIST LIVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Open an absence for everybody the world cannot account for and has not opened one
 * for yet.
 */
export function openAbsencesForTheUnaccountedFor(
    state: WorldState,
    onDay: number
): AbsenceOpening[] {
    // A world saved before this column existed loads with nothing here. One
    // normalisation, at the only place that appends, rather than a `?? []` at
    // every read - see AGENTS.md on what a scattered fallback hides.
    if (!state.absences) state.absences = [];
    // WHO NOBODY CAN ACCOUNT FOR, read before houses learn anything this slice:
    // somebody with no house has nobody to hold the mark, and the people waiting
    // on them are the absence itself.
    const lostOnDay = new Map<string, number>();
    for (const npc of state.npcs) {
        const lostOn = whenTheyWereLastAccountedFor(state, npc);
        if (lostOn !== null) lostOnDay.set(npc.id, lostOn);
    }
    whatHousesLearnOfTheirOwn(state, onDay);
    const alreadyOpen = new Set(state.absences.map(a => a.absenteeId));
    const opened: AbsenceOpening[] = [];

    // Snapshot the roster first: `beginAbsence` writes goals onto `state.npcs`,
    // and iterating a list something is replacing entries in is how a person
    // gets skipped for reasons nobody can reproduce.
    const unaccountedFor = state.npcs
        .map(npc => ({ npc, lostOn: lostOnDay.get(npc.id) ?? null }))
        // Not somebody a house learned the end of this very slice.
        .filter(({ npc, lostOn }) => (lostOn === null || npc.status === 'alive'))
        .filter(({ npc, lostOn }) => (lostOn !== null || isUnadjudicated(npc.status)) && !alreadyOpen.has(npc.id))
        .map(({ npc, lostOn }) => ({ npc, leftOn: lostOn ?? npc.updatedOnDay }))
        // Sorted so the list this appends to comes back off SQLite in the
        // order it is held in memory: the repo reads absences ordered by day
        // and then by id, and roster order is neither.
        .sort((a, b) => a.leftOn - b.leftOn || (a.npc.id < b.npc.id ? -1 : 1))
        .map(({ npc, leftOn }) => ({
            id: npc.id,
            name: npc.name,
            // The day their house lost track of them, or for somebody whose
            // existence is unresolved the day the world last wrote them.
            leftOnDay: Math.min(leftOn, onDay),
            locationId: npc.locationId,
            factionId: npc.factionId,
            factionRankIndex: npc.factionRankIndex,
            endNote: npc.endNote
        }));

    for (const person of unaccountedFor) {
        opened.push(
            beginAbsence(state, {
                absenteeId: person.id,
                absenteeName: person.name,
                onDay: person.leftOnDay,
                locationId: person.locationId,
                factionId: person.factionId,
                factionRankIndex: person.factionRankIndex,
                // The engine's own row, and it says what the engine actually
                // knows rather than asserting an outcome it has not got. A
                // missing person is not a person in seclusion, and the default
                // sentence would have claimed they were alive.
                truth:
                    `The world cannot account for ${person.name}. ` +
                    (person.endNote || 'Nobody saw what happened.')
            })
        );
    }

    state.absences.push(...opened.map(o => o.absence));
    return opened;
}

// ─────────────────────────────────────────────────────────────────────────
// THE YEARLY PASS
// ─────────────────────────────────────────────────────────────────────────

export interface AbsencePass {
    consequences: AbsenceConsequence[];
    /** Chronicle facts appended to `state.history` by this pass. */
    facts: HistoricalFact[];
    /** Knowledge rows to file. Every one is dated, sourced and possibly wrong. */
    accounts: KnowledgeRecord[];
    /**
     * Ledger rows the pass decided, for whoever holds a database.
     */
    opens: ObligationInput[];
    /** Absence-years actually processed. */
    yearsStepped: number;
}

/**
 * Run the absence forward to `toDay`.
 */
export function applyAbsence(state: WorldState, absence: Absence, toDay: number): AbsencePass {
    const consequences: AbsenceConsequence[] = [];
    const facts: HistoricalFact[] = [];
    const accounts: KnowledgeRecord[] = [];
    const opens: ObligationInput[] = [];

    const elapsed = Math.floor((toDay - absence.leftOnDay) / DAYS_PER_YEAR);
    const done = Math.floor((absence.settledThroughDay - absence.leftOnDay) / DAYS_PER_YEAR);
    if (elapsed <= done) return { consequences, facts, accounts, opens, yearsStepped: 0 };

    for (let n = done + 1; n <= elapsed; n++) {
        const day = absence.leftOnDay + n * DAYS_PER_YEAR;
        stepTies(state, absence, n, day, consequences, facts, accounts, opens);
        stepWriteOff(state, absence, n, day, consequences, facts, accounts);
    }

    absence.settledThroughDay = absence.leftOnDay + elapsed * DAYS_PER_YEAR;
    return { consequences, facts, accounts, opens, yearsStepped: elapsed - done };
}

function stepTies(
    state: WorldState,
    absence: Absence,
    n: number,
    day: number,
    consequences: AbsenceConsequence[],
    facts: HistoricalFact[],
    accounts: KnowledgeRecord[],
    opens: ObligationInput[]
): void {
    // What the absentee's own span does to every wait in this pass. A person the
    // roster does not hold - the player, or anybody an absence was opened about
    // from outside it - is waited for as a mortal is, the same default the
    // write-off takes.
    const absentee = state.npcs.find(npc => npc.id === absence.absenteeId);
    const ofTheirLife = absentee === undefined
        ? 1
        : A_MORTAL_LIFE_YEARS
            / Math.max(A_MORTAL_LIFE_YEARS, lifespanForOrdinal(absentee.cultivation.realmOrdinal));

    for (const tie of absence.ties) {
        if (tie.settledOnDay !== null) continue;

        const at = indexById(state.npcs, tie.holderId);
        const holder = at >= 0 ? state.npcs[at] : null;

        // ── They did not last the absence ────────────────────────────────
        //
        // Not generated here. The world's own pressure and lifespan passes
        // killed them; all this does is notice that the tie died with its
        // holder, and that somebody who was waiting died waiting. The account
        // they held is not deleted - it stays in the ledger, dated, and now
        // unreachable, which is what makes "she died still expecting you"
        // answerable two hundred years later.
        if (!holder || !isActing(holder.status)) {
            tie.settledOnDay = day;
            tie.settledAs = tie.waiting ? 'died_waiting' : 'died';
            if (holder && tie.goalId) {
                state.npcs[at] = closeGoal(
                    holder,
                    tie.goalId,
                    'impossible',
                    day,
                    `Waited ${n} years and did not live to see it settled.`
                );
            }
            consequences.push({
                kind: tie.settledAs,
                onDay: day,
                year: yearOfDay(day),
                afterYears: n,
                subjectId: tie.holderId,
                subjectName: tie.holderName,
                summary: tie.waiting
                    ? `${tie.holderName} died still expecting ${absence.absenteeName} to come back, after ${n} years.`
                    : `${tie.holderName} did not outlast the absence.`,
                factId: null,
                accountIds: []
            });
            if (absence.witnessIds.includes(tie.holderId)) {
                consequences.push({
                    kind: 'witness_lost',
                    onDay: day,
                    year: yearOfDay(day),
                    afterYears: n,
                    subjectId: tie.holderId,
                    subjectName: tie.holderName,
                    summary: `${tie.holderName} saw ${absence.absenteeName} go in, and can no longer say so.`,
                    factId: null,
                    accountIds: []
                });
            }
            continue;
        }

        if (!tie.waiting || !tie.goalId) continue;

        // The strongest reason to wait sets the pace; reasons do not stack.
        //
        // Multiplying them was the first shape and it was wrong: a spouse who
        // had been told took 0.045 x 0.5 x 0.5, which is an expected wait of
        // eighty-nine years and a forty-year absence she notices about a third
        // of the time. The two factors are not independent - loving somebody
        // and having been told by them are the same reason to keep the door
        // open - so counting both double-counts it, and the result was a world
        // where the people who mattered most were the ones a long absence cost
        // you least. Taking the smaller factor gives an expected wait of about
        // forty-four years, which is the shape the design asks for: two years
        // stings, ten is survivable, forty usually costs you somebody.
        const rng = forStream(state.seed, 'absence', absence.absenteeId, tie.holderId, n);
        const patience = Math.min(
            tie.standing >= DEFINING_STANDING ? DEFINING_TIE_PATIENCE : 1,
            absence.toldIds.includes(tie.holderId) ? INFORMED_PATIENCE : 1
        );
        // A year is a share of a life, and the life is the one that went
        // missing: see the constant. Nothing here reads the waiter's realm.
        if (!rng.chance(STOP_WAITING_PER_YEAR * patience * ofTheirLife)) continue;

        // ── They stopped ─────────────────────────────────────────────────
        const fact = appendWorldFact(
            state,
            makeFact({
                day,
                kind: 'gave_up_waiting',
                scale: 'personal',
                summary:
                    `${tie.holderName} stopped waiting for ${absence.absenteeName} ` +
                    `after ${n} years without word.`,
                actors: [
                    { id: tie.holderId, name: tie.holderName, role: 'waited' },
                    { id: absence.absenteeId, name: absence.absenteeName, role: 'absent' }
                ],
                locationId: holder.locationId,
                factionIds: holder.factionId ? [holder.factionId] : [],
                visibility: 'faction',
                magnitude: 0.25,
                causeKnown: false,
                data: {
                    unattributed: 'Somebody has taken a name off a door.',
                    years: n
                }
            })
        );
        facts.push(fact);

        state.npcs[at] = closeGoal(
            state.npcs[at],
            tie.goalId,
            'abandoned',
            day,
            `Waited ${n} years. No word ever came.`
        );
        // The tie itself changes, once, on this day, with the fact that did it
        // written onto the row. It does not become hostile - being let go is
        // not the same as being hated - it becomes what a tie is when the
        // person has been gone longer than the relationship was alive.
        // BECOMES, and is not written beside. Rows are keyed by the pair and
        // the kind, so adding an acquaintance row would leave them still holding
        // a husband who has been gone forty years. The tie that was waiting is
        // the one that stops.
        state.npcs[at] = theTieBecomes(
            state.npcs[at],
            absence.absenteeId,
            tie.kind,
            'acquaintance',
            day,
            {
                standing: Math.round(tie.standing * 0.35 * 1e4) / 1e4,
                note: `Waited ${n} years for them and stopped.`,
                factIds: [fact.id]
            }
        );
        andTheOtherEnd(state.npcs, state.npcs[at], { targetId: absence.absenteeId, kind: 'acquaintance', standing: 0 }, day);

        const belief = account({
            holderId: tie.holderId,
            claimKey: absence.claimKey,
            factId: null,
            onDay: day,
            stage: 'named',
            source: { kind: 'inferred', note: `${n} years of silence.` },
            statement: `${absence.absenteeName} is not coming back.`,
            detail: { outcome: 'gone', silentYears: n },
            tags: ['stopped_waiting']
        });
        accounts.push(belief);

        tie.settledOnDay = day;
        tie.settledAs = 'stopped_waiting';
        consequences.push({
            kind: 'stopped_waiting',
            onDay: day,
            year: yearOfDay(day),
            afterYears: n,
            subjectId: tie.holderId,
            subjectName: tie.holderName,
            summary: fact.summary,
            factId: fact.id,
            accountIds: [belief.id]
        });

        openTheAccountItLeaves(state, absence, tie, n, day, opens);
        maybeNewHousehold(state, absence, tie, n, day, consequences, facts);
    }
}

/**
 * What somebody is left holding when they finally stop waiting.
 */
function openTheAccountItLeaves(
    state: WorldState,
    absence: Absence,
    tie: TieAtDeparture,
    n: number,
    day: number,
    opens: ObligationInput[]
): void {
    if (!nobodyCanSayWhereTheyWent(absence)) return;
    const cause = WHAT_THEY_THINK_WAS_DONE[tie.kind];
    if (!cause) return;

    // Two words rather than four, off the threshold the module already uses to
    // decide who waits twice as long. What a wrong is worth is a judgement
    // about the size of the loss, and the only thing the engine honestly knows
    // about the size of this one is what the tie was.
    const severity: Severity = tie.standing >= DEFINING_STANDING ? 'grave' : 'serious';

    const row = withNoNameOnIt({
        kind: 'grudge',
        holderId: tie.holderId,
        // There is no name to put here and there never was one. It goes
        // through `withNoNameOnIt` anyway, because that is the one place that
        // knows how a row says so - the null AND the tag the ledger queries on.
        subjectId: NO_NAME_ON_IT,
        cause,
        severity,
        // The day they were wronged, not the day they worked it out. Same
        // treatment `aNameAttaches` gives it: the wrong happened when the
        // person stopped coming back, and finding out is a separate date that
        // lands in the description and the tags.
        onDay: absence.leftOnDay,
        triggeringEventId: absence.truthFactId,
        description:
            `${absence.absenteeName} did not come back, and nobody could say what became of ` +
            `them. ${tie.holderName} waited ${n} years before allowing that something had been ` +
            'done. There is no name on it.',
        participants: [absence.absenteeId],
        tags: ['absence', `gave-up:${yearOfDay(day)}`],
        // It rests on an inference from silence, which is exactly what the flag
        // is for: if the truth ever surfaces the row can be settled as
        // `proven_false`, and the man walking back through the door is the
        // commonest way that happens.
        fromBelief: true
    });
    opens.push(row);

    // And what it makes them do. `targetId` is null and that is the content.
    const at = indexById(state.npcs, tie.holderId);
    if (at < 0) return;
    const search = theSearchItOpens(createObligation(row), {
        lost: `what happened to ${absence.absenteeName}`
    });
    if (search) state.npcs[at] = addGoal(state.npcs[at], search, day);
}

/**
 * Somebody whose household ended takes another one.
 */
function maybeNewHousehold(
    state: WorldState,
    absence: Absence,
    tie: TieAtDeparture,
    n: number,
    day: number,
    consequences: AbsenceConsequence[],
    facts: HistoricalFact[]
): void {
    const household =
        HOUSEHOLD_KINDS.has(tie.kind) &&
        (tie.kind === 'spouse' || tie.standing >= DEFINING_STANDING);
    if (!household) return;

    const rng = forStream(state.seed, 'absence.household', absence.absenteeId, tie.holderId, n);
    if (!rng.chance(NEW_HOUSEHOLD_CHANCE)) return;

    const at = indexById(state.npcs, tie.holderId);
    if (at < 0) return;
    const holder = state.npcs[at];

    const candidates = state.npcs
        .filter(
            npc =>
                npc.id !== holder.id &&
                npc.id !== absence.absenteeId &&
                isActing(npc.status) &&
                npc.locationId === holder.locationId &&
                !npc.relationships.some(r => r.kind === 'spouse') &&
                !holder.relationships.some(r => r.targetId === npc.id)
        )
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (candidates.length === 0) return;

    const partner = rng.pick(candidates);
    const partnerAt = indexById(state.npcs, partner.id);

    const fact = appendWorldFact(
        state,
        makeFact({
            day,
            kind: 'marriage',
            scale: 'personal',
            summary: `${holder.name} and ${partner.name} joined households.`,
            actors: [
                { id: holder.id, name: holder.name, role: 'married' },
                { id: partner.id, name: partner.name, role: 'married' }
            ],
            locationId: holder.locationId,
            factionIds: [holder.factionId, partner.factionId].filter(
                (id): id is string => id !== null
            ),
            visibility: 'regional',
            magnitude: 0.2,
            data: { unattributed: 'There was a wedding at the low end of the valley.' }
        })
    );
    facts.push(fact);

    state.npcs[at] = upsertRelationship(
        state.npcs[at],
        {
            targetId: partner.id,
            targetName: partner.name,
            kind: 'spouse',
            standing: 0.7,
            note: `Married after ${n} years of waiting for ${absence.absenteeName}.`,
            factIds: [fact.id]
        },
        day
    );
    state.npcs[partnerAt] = upsertRelationship(
        state.npcs[partnerAt],
        {
            targetId: holder.id,
            targetName: holder.name,
            kind: 'spouse',
            standing: 0.7,
            note: 'Married.',
            factIds: [fact.id]
        },
        day
    );

    consequences.push({
        kind: 'took_another_household',
        onDay: day,
        year: yearOfDay(day),
        afterYears: n,
        subjectId: holder.id,
        subjectName: holder.name,
        summary: `${holder.name} married ${partner.name}${
            partner.factionId ? ` of ${partner.factionId}` : ''
        }, ${n} years after ${absence.absenteeName} left.`,
        factId: fact.id,
        accountIds: []
    });
}

/**
 * The world decides the absence was a death.
 */
function stepWriteOff(
    state: WorldState,
    absence: Absence,
    n: number,
    day: number,
    consequences: AbsenceConsequence[],
    facts: HistoricalFact[],
    accounts: KnowledgeRecord[]
): void {
    if (absence.writtenOffOnDay !== null) return;
    // NOT BEFORE THEY COULD POSSIBLY BE DEAD. See `theYearsTheyCouldStillBeAlive`:
    // the grace is the lifespan they were carrying, not a number of years.
    const them = state.npcs.find(npc => npc.id === absence.absenteeId);
    // Somebody the world holds no row for - the player, or anybody an absence was
    // opened about from outside the roster - is waited for as a mortal would be.
    const grace = them === undefined
        ? A_MORTAL_LIFE_YEARS
        : theYearsTheyCouldStillBeAlive({
            ordinal: them.cultivation.realmOrdinal,
            ageInYears: Math.max(0, (absence.leftOnDay - them.identity.bornOnDay) / DAYS_PER_YEAR)
        });
    if (n <= grace) return;

    const rng = forStream(state.seed, 'absence.writeoff', absence.absenteeId, n);
    let chance = WRITTEN_OFF_PER_YEAR;
    if (absence.toldIds.length > 0 || absence.witnessIds.length > 0) chance *= INFORMED_PATIENCE;
    if (!rng.chance(chance)) return;

    absence.writtenOffOnDay = day;

    const fact = appendWorldFact(
        state,
        makeFact({
            day,
            kind: 'presumed_dead',
            scale: 'personal',
            summary: `${absence.absenteeName} has not been accounted for in ${n} years.`,
            actors: [{ id: absence.absenteeId, name: absence.absenteeName, role: 'unaccounted' }],
            locationId: absence.locationId,
            factionIds: absence.factionId ? [absence.factionId] : [],
            visibility: 'regional',
            // The engine does not know they are dead, because they are not.
            truth: 'unresolved',
            claimedOutcomes: [
                'died in seclusion',
                'died elsewhere and was never found',
                'is still sitting where they sat down',
                'left the province under another name'
            ],
            causeKnown: false,
            fidelity: 'rumour',
            magnitude: 0.3,
            data: {
                unattributed: 'A name has been struck out of a register at the hall.',
                silentYears: n
            }
        })
    );
    facts.push(fact);

    const audience = absence.locationId ?? absence.factionId ?? 'the province';
    const publicBelief = recordPublicBelief({
        audienceId: audience,
        claimKey: absence.claimKey,
        stance: 'believes',
        statement: `${absence.absenteeName} died about ${n} years ago.`,
        onDay: day,
        source: { kind: 'inferred', note: `${n} years without word.` },
        factId: null,
        detail: { outcome: 'dead', silentYears: n },
        confidence: confidenceForStage('named'),
        tags: [stageTag('named'), 'absence', 'presumed_dead']
    });
    accounts.push(publicBelief);

    // The document, which is a different holder from the people who wrote it
    // and will still be saying this when none of them are alive.
    const register = recordPublicBelief({
        audienceId: `register:${audience}`,
        claimKey: absence.claimKey,
        stance: 'believes',
        statement: `${absence.absenteeName}: deceased, entered in year ${yearOfDay(day)}.`,
        onDay: day,
        source: { kind: 'read', note: 'The entry as it stands in the register.' },
        factId: null,
        detail: { outcome: 'dead', enteredInYear: yearOfDay(day) },
        confidence: confidenceForStage('placed'),
        tags: [stageTag('placed'), 'absence', 'written_record']
    });
    accounts.push(register);

    consequences.push({
        kind: 'written_off',
        onDay: day,
        year: yearOfDay(day),
        afterYears: n,
        subjectId: absence.absenteeId,
        subjectName: absence.absenteeName,
        summary: `After ${n} years, ${audience} settled on ${absence.absenteeName} being dead.`,
        factId: fact.id,
        accountIds: [publicBelief.id, register.id]
    });

    // ── And the seat is freed ────────────────────────────────────────────
    //
    // The house does not hold a rank open for a dead member, and this module
    // does NOT then fill it: `promotion-inside-a-house.ts` promotes people on
    // its own schedule, and the whole point is that the junior disciple who
    // becomes an elder does so through the ordinary machinery rather than
    // through a rule about the player. All this does is stop counting a member
    // the house has decided is gone.
    const seat = indexById(state.npcs, absence.absenteeId);
    if (seat >= 0 && state.npcs[seat].factionId) {
        const struck = state.npcs[seat];
        const strikeFact = appendWorldFact(
            state,
            makeFact({
                day,
                kind: 'expulsion',
                scale: 'personal',
                summary: `${struck.name} was taken off the rolls, presumed dead.`,
                actors: [{ id: struck.id, name: struck.name, role: 'removed' }],
                locationId: struck.locationId,
                factionIds: [struck.factionId!],
                causes: [fact.id],
                visibility: 'faction',
                magnitude: 0.2,
                data: { unattributed: 'A place at the hall has been given to somebody else.' }
            })
        );
        facts.push(strikeFact);
        // ── OFF THE CURRENT ROW, NOT OFF THE SNAPSHOT ────────────────────
        //
        // `struck` was read before the fact existed. `appendWorldFact` links a
        // fact onto everybody it names, so by this line `state.npcs[seat]` is a
        // NEWER object carrying the expulsion in its `historyFactIds` - and
        // writing `setFaction(struck, ...)` put the pre-fact copy back, taking
        // the link with it.
        //
        // Measured: nine facts in an eighty-year world named somebody who did
        // not carry them, all of them expulsions, all of them the person struck
        // off. The one thing `what-a-world-must-never-contain.ts` calls a fact
        // that cannot be reached from the person it is about - and here it was
        // the person's own removal.
        state.npcs[seat] = setFaction(state.npcs[seat], null, -1, day);
        consequences.push({
            kind: 'struck_from_the_rolls',
            onDay: day,
            year: yearOfDay(day),
            afterYears: n,
            subjectId: struck.id,
            subjectName: struck.name,
            summary: strikeFact.summary,
            factId: strikeFact.id,
            accountIds: []
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────
// COMING BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Higher rank indices are further up a house's ladder.
 */
export type TieOutcome =
    | 'dead'
    | 'gone_missing'
    | 'stopped_waiting'
    | 'still_waiting'
    | 'moved'
    | 'rose'
    | 'fell'
    | 'left_house'
    | 'unchanged';

/** What one tie looks like on the day the absentee walks back in. */
export interface TieOnReturn {
    holderId: string;
    holderName: string;
    outcome: TieOutcome;
    /** What they were to the absentee then, and what the row says now. */
    kindThen: RelationshipKind;
    kindNow: RelationshipKind | null;
    standingThen: number;
    standingNow: number | null;
    /** True when the holder is no longer able to act in the world. */
    lost: boolean;
    movedTo: string | null;
    /** Faction rank indices. A fall in index is a rise in a house. */
    rankThen: number;
    rankNow: number | null;
    realmThen: number;
    realmNow: number | null;
    /** Years of absence at the moment their part of it was settled. */
    settledAfterYears: number | null;
    summary: string;
}

export interface Homecoming {
    absenteeId: string;
    absenteeName: string;
    leftOnDay: number;
    returnedOnDay: number;
    yearsAway: number;
    ties: TieOnReturn[];
    /** Ties that were waiting and are still waiting. The ones you got back. */
    stillWaiting: string[];
    /** People who died still expecting you. */
    diedWaiting: string[];
    /** Set when the world settled on them being dead, and the year it did. */
    writtenOffInYear: number | null;
    /** Witnesses to the truth who are still able to speak. */
    survivingWitnesses: string[];
}

/**
 * What the absentee walks back into.
 */
export function homecoming(
    state: WorldState,
    absence: Absence,
    returnedOnDay: number
): Homecoming {
    const ties: TieOnReturn[] = [];
    const stillWaiting: string[] = [];
    const diedWaiting: string[] = [];

    for (const tie of absence.ties) {
        const holder = state.npcs.find(npc => npc.id === tie.holderId) ?? null;
        // THE SAME ROW IT WAITED ON. `kindNow` is read against `kindThen`, so it
        // has to be the row the absence was recorded from: the kind that was
        // written down, else the warmest row that waits, else whatever stands.
        // Taking the first row reported the marriage where the waiting was done
        // by the bond beside it, and the record contradicted its own reason.
        const rows = holder === null
            ? []
            : holder.relationships.filter(r => r.targetId === absence.absenteeId);
        let rel: NpcRelationship | null = rows.find(r => r.kind === tie.kind) ?? null;
        if (rel === null) {
            for (const row of rows) {
                if (!WAITING_KINDS.has(row.kind)) continue;
                if (rel === null || row.standing > rel.standing) rel = row;
            }
        }
        if (rel === null) rel = rows[0] ?? null;
        const goneMissing = holder !== null && isActing(holder.status) && whenTheyWereLastAccountedFor(state, holder) !== null;
        const lost = !holder || !isActing(holder.status) || goneMissing;

        let outcome: TieOutcome;
        if (lost) {
            outcome = goneMissing ? 'gone_missing' : 'dead';
            if (tie.settledAs === 'died_waiting') diedWaiting.push(tie.holderName);
        } else if (tie.settledAs === 'stopped_waiting') {
            outcome = 'stopped_waiting';
        } else if (holder!.factionId !== tie.factionId) {
            outcome = 'left_house';
        } else if (holder!.factionRankIndex > tie.factionRankIndex) {
            outcome = 'rose';
        } else if (holder!.factionRankIndex < tie.factionRankIndex) {
            outcome = 'fell';
        } else if (holder!.cultivation.realmOrdinal > tie.realmOrdinal) {
            outcome = 'rose';
        } else if (holder!.locationId !== tie.locationId) {
            outcome = 'moved';
        } else if (tie.waiting) {
            outcome = 'still_waiting';
        } else {
            outcome = 'unchanged';
        }
        if (!lost && tie.waiting && tie.settledOnDay === null) stillWaiting.push(tie.holderName);

        ties.push({
            holderId: tie.holderId,
            holderName: tie.holderName,
            outcome,
            kindThen: tie.kind,
            kindNow: rel?.kind ?? null,
            standingThen: tie.standing,
            standingNow: rel?.standing ?? null,
            lost,
            movedTo: holder && holder.locationId !== tie.locationId ? holder.locationId : null,
            rankThen: tie.factionRankIndex,
            rankNow: holder?.factionRankIndex ?? null,
            realmThen: tie.realmOrdinal,
            realmNow: holder?.cultivation.realmOrdinal ?? null,
            settledAfterYears:
                tie.settledOnDay === null
                    ? null
                    : Math.round((tie.settledOnDay - absence.leftOnDay) / DAYS_PER_YEAR),
            summary: describeTie(absence, tie, holder, outcome)
        });
    }

    return {
        absenteeId: absence.absenteeId,
        absenteeName: absence.absenteeName,
        leftOnDay: absence.leftOnDay,
        returnedOnDay,
        yearsAway: Math.round((returnedOnDay - absence.leftOnDay) / DAYS_PER_YEAR),
        ties,
        stillWaiting,
        diedWaiting,
        writtenOffInYear:
            absence.writtenOffOnDay === null ? null : yearOfDay(absence.writtenOffOnDay),
        survivingWitnesses: absence.witnessIds.filter(id => {
            const npc = state.npcs.find(n => n.id === id);
            return npc != null && isActing(npc.status);
        })
    };
}

function describeTie(
    absence: Absence,
    tie: TieAtDeparture,
    holder: NpcRecord | null,
    outcome: TieOutcome
): string {
    const years =
        tie.settledOnDay === null
            ? null
            : Math.round((tie.settledOnDay - absence.leftOnDay) / DAYS_PER_YEAR);
    switch (outcome) {
        case 'dead':
            return years === null
                ? `${tie.holderName} is dead.`
                : `${tie.holderName} died ${years} years into the absence.`;
        case 'gone_missing':
            return `${tie.holderName} is unaccounted for, the same as you were.`;
        case 'stopped_waiting':
            return `${tie.holderName} waited ${years} years and stopped.`;
        case 'rose':
            return holder && holder.factionRankIndex > tie.factionRankIndex
                ? `${tie.holderName} has risen in the house: rank ${tie.factionRankIndex} then, ${holder.factionRankIndex} now.`
                : `${tie.holderName} has climbed past where they were: ordinal ${tie.realmOrdinal} then, ${holder?.cultivation.realmOrdinal ?? tie.realmOrdinal} now.`;
        case 'fell':
            return `${tie.holderName} has lost ground in the house: rank ${tie.factionRankIndex} then, ${holder?.factionRankIndex ?? -1} now.`;
        case 'left_house':
            return tie.factionId === null
                ? `${tie.holderName} has joined ${holder?.factionId ?? 'a house'}.`
                : `${tie.holderName} is no longer of ${tie.factionId}.`;
        case 'moved':
            return `${tie.holderName} is no longer at ${tie.locationId ?? 'the same place'}.`;
        case 'still_waiting':
            return `${tie.holderName} is still waiting.`;
        default:
            return `${tie.holderName} is where you left them.`;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

interface AccountInput {
    holderId: string;
    claimKey: string;
    factId: string | null;
    onDay: number;
    stage: KnowingStage;
    source: { kind: SourceKind; fromHolderId?: string; note?: string };
    statement: string;
    detail?: Record<string, string | number>;
    tags?: readonly string[];
}

/**
 * One account, written the way `discovery.ts` says it has to be written.
 */
function account(input: AccountInput): KnowledgeRecord {
    return recordKnowledge({
        holderId: input.holderId,
        claimKey: input.claimKey,
        stance: stanceForStage(input.stage),
        statement: input.statement,
        onDay: input.onDay,
        source: input.source,
        factId: input.factId,
        detail: input.detail,
        confidence: confidenceForStage(input.stage),
        tags: [stageTag(input.stage), 'absence', ...(input.tags ?? [])]
    });
}
