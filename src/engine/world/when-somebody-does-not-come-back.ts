/**
 * When somebody does not come back.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
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
    upsertRelationship,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// RATES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance per year that somebody who was waiting stops.
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
 * Years before anybody starts drawing conclusions.
 */
export const WRITTEN_OFF_GRACE_YEARS = 3;

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
        const rel = npc.relationships.find(r => r.targetId === input.absenteeId);
        if (!rel) continue;
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
            rel.standing >= FRIENDSHIP_STANDING &&
            WAITING_KINDS.has(rel.kind);

        let goalId: string | null = null;
        if (waiting) {
            const before = state.npcs[at].nextGoalSeq;
            state.npcs[at] = addGoal(
                state.npcs[at],
                {
                    kind: 'reunion',
                    text: `Be here when ${input.absenteeName} comes back.`,
                    priority: Math.min(1, Math.max(0.2, rel.standing)),
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
            kind: rel.kind,
            standing: rel.standing,
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
    const alreadyOpen = new Set(state.absences.map(a => a.absenteeId));
    const opened: AbsenceOpening[] = [];

    // Snapshot the roster first: `beginAbsence` writes goals onto `state.npcs`,
    // and iterating a list something is replacing entries in is how a person
    // gets skipped for reasons nobody can reproduce.
    const unaccountedFor = state.npcs
        .filter(npc => isUnadjudicated(npc.status) && !alreadyOpen.has(npc.id))
        // Sorted so the list this appends to comes back off SQLite in the
        // order it is held in memory: the repo reads absences ordered by day
        // and then by id, and roster order is neither.
        .sort((a, b) => a.updatedOnDay - b.updatedOnDay || (a.id < b.id ? -1 : 1))
        .map(npc => ({
            id: npc.id,
            name: npc.name,
            // `markMissing` stamps `updatedOnDay`, and nothing else moves
            // somebody the world has stopped being able to see, so this is the
            // day they stopped being accounted for rather than the day this
            // sweep happened to notice.
            leftOnDay: Math.min(npc.updatedOnDay, onDay),
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
    for (const tie of absence.ties) {
        if (tie.settledOnDay !== null) continue;

        const at = state.npcs.findIndex(npc => npc.id === tie.holderId);
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
        if (!rng.chance(STOP_WAITING_PER_YEAR * patience)) continue;

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
        state.npcs[at] = upsertRelationship(
            state.npcs[at],
            {
                targetId: absence.absenteeId,
                targetName: absence.absenteeName,
                kind: 'acquaintance',
                standing: Math.round(tie.standing * 0.35 * 1e4) / 1e4,
                note: `Waited ${n} years for them and stopped.`,
                factIds: [fact.id]
            },
            day
        );

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
    const at = state.npcs.findIndex(npc => npc.id === tie.holderId);
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

    const at = state.npcs.findIndex(npc => npc.id === tie.holderId);
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
    const partnerAt = state.npcs.findIndex(npc => npc.id === partner.id);

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
    if (n <= WRITTEN_OFF_GRACE_YEARS) return;

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
    const seat = state.npcs.findIndex(npc => npc.id === absence.absenteeId);
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
        state.npcs[seat] = setFaction(struck, null, -1, day);
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
        const rel = holder?.relationships.find(r => r.targetId === absence.absenteeId) ?? null;
        const lost = !holder || !isActing(holder.status);

        let outcome: TieOutcome;
        if (lost) {
            outcome = holder && holder.status === 'missing' ? 'gone_missing' : 'dead';
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
