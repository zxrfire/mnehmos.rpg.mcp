/**
 * When somebody does not come back.
 *
 * The world layer already makes things happen while a cultivator is sealed in a
 * cave: `the-world-changing-on-its-own.ts` kills elders, moves borders, folds
 * houses and promotes people, and `advanceTime` fires whatever was on the books.
 * What none of it does is notice that the cultivator is GONE. The events happen
 * near the ties to an absent person and never TO them, so forty years of
 * seclusion costs exactly forty years and nothing else, and coming out is a
 * status update rather than a homecoming.
 *
 * This module is that missing half, and it is deliberately not a second world
 * simulation. It does three things and no more:
 *
 *   1. it opens an ABSENCE - a dated object holding who was gone, from when,
 *      who saw them go and who was told, and a snapshot of every tie that
 *      pointed at them on the day they left;
 *   2. once a year, it lets the people holding those ties reach the conclusions
 *      the passage of time actually forces - somebody stops waiting, a house
 *      writes a member off, a register is struck through;
 *   3. it reports, on return, what is materially different and where the
 *      surviving accounts of the absence DISAGREE.
 *
 * ── The product is the disagreement ───────────────────────────────────────
 *
 * Every account this module writes is somebody's, dated, sourced, and allowed
 * to be wrong, because they are ordinary `knowledge.ts` rows on one shared
 * `claimKey`. After a long enough absence a single person's fate reads:
 *
 *     truth (engine)             in seclusion under Stone Fall, alive throughout
 *     the enemy who watched      knows      witnessed    still alive, still in there
 *     the sect                   believes   inferred     died, year 47
 *     the register at the town   believes   read         struck out, year 47
 *     the woman who waited       believes   inferred     he left and did not come back
 *     her heir                   believes   told         there was somebody, once
 *
 * Six positions, six dates, six provenances, one of them right. None of that
 * needed a new table: `disagreementsAbout(claimKey)` already returns exactly
 * this, and the only thing missing was anybody writing the rows.
 *
 * ── No meter ──────────────────────────────────────────────────────────────
 *
 * There is no abandonment score and no decay curve. A person who stopped
 * waiting did so ON A DAY, for a stated number of years of silence, and what
 * changed is a closed goal, a rewritten tie, a fact in the chronicle and a
 * knowledge row - all of them things the engine already stored. Ask the world
 * "how much has she given up on him" and it has no answer; ask it "did she stop,
 * and when" and it has a date.
 *
 * The social layer's prohibition on decay is not violated by this, and the
 * distinction is worth stating because it is easy to get backwards. That layer
 * is STORAGE and must never quietly shrink a record. This is the world layer,
 * whose whole job is to make dated events happen from seeded rolls, exactly as
 * `applyPressure` does. The event is generated here; the record of it never
 * moves again.
 *
 * ── Proportional, and bought off by telling people ────────────────────────
 *
 * The per-year rates are small enough that a two-year absence usually costs
 * nothing and a forty-year one usually costs somebody. Two of them are halved
 * for a tie that was defining and halved again for somebody who was TOLD where
 * the absentee was going, which is the one lever a player has: an absence
 * nobody was warned about is written off roughly twice as fast, and the people
 * who cared give up in about a quarter of the time. Telling three people before
 * you seal the door is a real decision with a real price attached to skipping
 * it.
 *
 * ── Nothing bespoke, and nothing about the player ─────────────────────────
 *
 * The absentee is an id and a name. Nothing here reads a run, a cultivator or a
 * player flag, and nothing branches on whether the absentee has an `NpcRecord`
 * at all - which is what lets the same pass serve both a sealed player and the
 * ordinary `disappearance` event, where an NPC walks into the hills and the
 * chronicle already says "treated as dead by everyone except one person"
 * without anybody ever having been that person.
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
import { FRIENDSHIP_STANDING } from './gatherings.js';
import { appendFact, makeFact, yearOfDay, type HistoricalFact } from './history.js';
import {
    addGoal,
    closeGoal,
    isActing,
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
 *
 * Chosen so that the shape of the curve matches the shape of the fiction rather
 * than to hit a target: at 0.045 an ordinary tie has about a one-in-eleven
 * chance of being given up inside two years, better than even odds by twenty,
 * and is nearly certain to have been let go by a hundred. Two years stings,
 * forty is devastating, and ten is survivable - which is the whole requirement.
 */
export const STOP_WAITING_PER_YEAR = 0.045;

/** Above this standing the tie was the kind people wait a lifetime on. */
export const DEFINING_STANDING = 0.8;

/**
 * What a defining tie multiplies the give-up rate by. They wait twice as long.
 *
 * Patience factors take the SMALLER of whatever applies rather than the
 * product - see the comment at the roll. Two reasons to keep a door open are
 * usually the same reason twice.
 */
export const DEFINING_TIE_PATIENCE = 0.5;

/**
 * What being told where the absentee went multiplies the rates by.
 *
 * The one lever the absentee has, and it is symmetrical: somebody who knows
 * this was a seclusion and not a disappearance waits about twice as long, and a
 * house with a member who filed their intentions writes them off about twice as
 * slowly.
 */
export const INFORMED_PATIENCE = 0.5;

/** Chance per year that the world concludes an unexplained absence was a death. */
export const WRITTEN_OFF_PER_YEAR = 0.035;

/**
 * Years before anybody starts drawing conclusions.
 *
 * A three-year seclusion is a normal thing for a cultivator to do and produces
 * no paperwork anywhere. Without a grace period the write-off roll fires on a
 * two-year retreat about seven percent of the time, which is not a world where
 * cultivators routinely sit down for a decade.
 */
export const WRITTEN_OFF_GRACE_YEARS = 3;

/**
 * Chance that somebody who stopped waiting on a household tie takes another.
 *
 * Only reached by a tie that WAS a household - a spouse, or kin at a defining
 * standing - and only after the giving-up event, so it is a consequence of one
 * rather than an independent event about marriage. This module does not marry
 * anybody who was not already somebody's.
 */
export const NEW_HOUSEHOLD_CHANCE = 0.5;

/** The topic every account of one person's fate is filed against. */
export const FATE_CLAIM_PREFIX = 'fate:';

export function fateClaimKey(absenteeId: string): string {
    return `${FATE_CLAIM_PREFIX}${absenteeId}`;
}

/**
 * Ties that carry an expectation of return.
 *
 * A household or a teaching line waits; a business partner does not. Kept as a
 * set rather than a standing threshold because the two questions are different:
 * how much somebody matters to you is `standing`, and whether their absence is
 * the kind you sit up for is what they are to you.
 */
const WAITING_KINDS = new Set<RelationshipKind>([
    'spouse', 'kin', 'parent', 'child', 'master', 'disciple', 'ally'
]);

/** Ties where a household actually ended, and could be replaced by another. */
const HOUSEHOLD_KINDS = new Set<RelationshipKind>(['spouse', 'kin']);

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
 *
 * Snapshotted rather than re-read, because the whole question this module
 * answers is what CHANGED, and a comparison against the current record is the
 * only way to answer it after the world has spent forty years moving people
 * around. `settledAs` is how a tie is only decided once: a woman who stopped
 * waiting in year nineteen does not stop waiting again in year twenty.
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
 *
 * Mutates `state` to open a `reunion` goal on everybody who has reason to
 * expect a return. That goal is the representation of waiting, and it is not
 * new machinery: `GoalKind` has carried `'reunion'` since the NPC record was
 * written and nothing in the engine had ever produced one, so a world could
 * contain a disciple who had waited three hundred years for a master and no
 * query anywhere could find them. Goals also INHERIT, which means a search can
 * outlive the searcher - the childhood friend's grandchild still looking is a
 * consequence of using this shape rather than a feature written for it.
 */
export function beginAbsence(state: WorldState, input: BeginAbsenceInput): AbsenceOpening {
    const claimKey = fateClaimKey(input.absenteeId);
    const witnessIds = [...new Set(input.witnessIds ?? [])].sort();
    const toldIds = [...new Set(input.toldIds ?? [])].sort();
    const informed = new Set([...witnessIds, ...toldIds]);

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
        const waiting =
            isInformed && rel.standing >= FRIENDSHIP_STANDING && WAITING_KINDS.has(rel.kind);

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
                        : 'Was told where they were going.'
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
// THE YEARLY PASS
// ─────────────────────────────────────────────────────────────────────────

export interface AbsencePass {
    consequences: AbsenceConsequence[];
    /** Chronicle facts appended to `state.history` by this pass. */
    facts: HistoricalFact[];
    /** Knowledge rows to file. Every one is dated, sourced and possibly wrong. */
    accounts: KnowledgeRecord[];
    /** Absence-years actually processed. */
    yearsStepped: number;
}

/**
 * Run the absence forward to `toDay`.
 *
 * Keyed on the ABSENCE-year rather than the calendar year, and idempotent
 * against `settledThroughDay`, so running ten years and then thirty produces
 * the same world as running forty in one call. That is the same decomposability
 * property `driver.ts` protects for the rest of the layer, and it is what lets
 * this be called once per yearly slice from inside the play loop.
 *
 * Mutates `state` and `absence`, as its neighbours in this directory do: a play
 * loop advances one world hundreds of times and cloning it each time costs more
 * than the whole simulation.
 */
export function applyAbsence(state: WorldState, absence: Absence, toDay: number): AbsencePass {
    const consequences: AbsenceConsequence[] = [];
    const facts: HistoricalFact[] = [];
    const accounts: KnowledgeRecord[] = [];

    const elapsed = Math.floor((toDay - absence.leftOnDay) / DAYS_PER_YEAR);
    const done = Math.floor((absence.settledThroughDay - absence.leftOnDay) / DAYS_PER_YEAR);
    if (elapsed <= done) return { consequences, facts, accounts, yearsStepped: 0 };

    for (let n = done + 1; n <= elapsed; n++) {
        const day = absence.leftOnDay + n * DAYS_PER_YEAR;
        stepTies(state, absence, n, day, consequences, facts, accounts);
        stepWriteOff(state, absence, n, day, consequences, facts, accounts);
    }

    absence.settledThroughDay = absence.leftOnDay + elapsed * DAYS_PER_YEAR;
    return { consequences, facts, accounts, yearsStepped: elapsed - done };
}

function stepTies(
    state: WorldState,
    absence: Absence,
    n: number,
    day: number,
    consequences: AbsenceConsequence[],
    facts: HistoricalFact[],
    accounts: KnowledgeRecord[]
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
        const fact = appendFact(
            state.history,
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

        maybeNewHousehold(state, absence, tie, n, day, consequences, facts);
    }
}

/**
 * Somebody whose household ended takes another one.
 *
 * Reached only from a household tie that was just given up, and bound to real
 * state the same way every pressure template is: it looks for somebody living,
 * in the same place, unattached, and if the world does not currently offer one
 * then nothing happens and the person simply stays alone. That is a legitimate
 * and common outcome, and it is why this is not a marriage generator.
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

    const fact = appendFact(
        state.history,
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
 *
 * Three things come out of it and they are deliberately three, because they can
 * disagree with each other and routinely will: an UNRESOLVED chronicle fact,
 * which is the engine declining to pretend it knows; what the surrounding
 * public came to hold; and what the written register says, which is a document
 * with its own date and its own author and outlives everybody who agreed with
 * it. "The local records say you died thirty-one years ago" is that third row,
 * and it is wrong in exactly the way a record can be wrong.
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

    const fact = appendFact(
        state.history,
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
        const strikeFact = appendFact(
            state.history,
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
 *
 * `FactionRecord.ranks` runs Outer Disciple at 0 to Patriarch at the end, and
 * `-1` means unaffiliated. So a rise is an increase, a fall is a decrease, and
 * leaving is a different event from both - which is worth stating because the
 * first version of this reported "rank 4 then, -1 now" as a promotion.
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
 *
 * Pure reporting. Reads the snapshot against the world as it now stands and
 * says what is materially different, without touching anything - a homecoming
 * is a question, and asking it must not change the answer. It reports the
 * WORLD's state, not what anybody believes: the belief side is
 * `disagreementsAbout(absence.claimKey)` on whatever ledger the accounts were
 * filed in, and keeping them separate is the same separation `knowledge.ts`
 * enforces between the fact and the claim.
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
 *
 * Stance and confidence come off the stage rather than being chosen at the call
 * site, so an account written here is indistinguishable from one written by a
 * traveller or by an archive, and every query in the social layer reads it
 * without knowing this module exists.
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
