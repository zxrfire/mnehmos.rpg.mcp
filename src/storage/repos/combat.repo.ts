/**
 * Persistence for confrontations.
 *
 * Three tables, three different lifetimes, which is why they are three tables:
 *
 *   combat_encounters    the fight while it is happening - initiative order,
 *                        round, whose move it is. Dies with the fight.
 *   combat_participants  who is in it and where they stand in the order.
 *   combat_records       one row per resolved confrontation, forever. This is
 *                        the history a player reads back and the count
 *                        `assessPower` prices battle experience from.
 *
 * HP and injuries are deliberately not here. They belong to the cultivator and
 * outlive the fight; `CultivatorRepository` owns them and this repository never
 * writes them.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { AmbientQi } from '../../schema/cultivation.js';

export interface CombatEncounter {
    id: string;
    runId: string | null;
    seed: string;
    status: 'active' | 'ended';
    round: number;
    turnIndex: number;
    location: string | null;
    ambient: AmbientQi;
    createdAt: string;
    endedAt: string | null;
}

export interface CombatParticipant {
    participantId: string;
    name: string;
    cultivatorId: string | null;
    ordinal: number;
    initiative: number;
    slot: number;
    active: boolean;
}

export interface CombatRecord {
    id: number;
    cultivatorId: string;
    opponentId: string | null;
    opponentName: string;
    opponentOrdinal: number;
    outcome: string;
    won: boolean;
    realmGap: number;
    edges: string[];
    onDay: number;
    turn: number;
    summary: string;
}

export interface CreateEncounterInput {
    id?: string;
    runId?: string | null;
    seed: string;
    location?: string | null;
    ambient?: AmbientQi;
    participants: Array<{
        participantId: string;
        name: string;
        cultivatorId?: string | null;
        ordinal?: number;
        initiative: number;
    }>;
}

export interface RecordBattleInput {
    cultivatorId: string;
    opponentId?: string | null;
    opponentName: string;
    opponentOrdinal: number;
    outcome: string;
    won: boolean;
    realmGap: number;
    edges?: readonly string[];
    onDay: number;
    turn: number;
    summary: string;
}

interface EncounterRow {
    id: string;
    run_id: string | null;
    seed: string;
    status: string;
    round: number;
    turn_index: number;
    location: string | null;
    ambient: string;
    created_at: string;
    ended_at: string | null;
}

interface ParticipantRow {
    participant_id: string;
    name: string;
    cultivator_id: string | null;
    ordinal: number;
    initiative: number;
    slot: number;
    active: number;
}

interface RecordRow {
    id: number;
    cultivator_id: string;
    opponent_id: string | null;
    opponent_name: string;
    opponent_ordinal: number;
    outcome: string;
    won: number;
    realm_gap: number;
    edges: string;
    on_day: number;
    turn: number;
    summary: string;
}

export class CombatRepository {
    constructor(private db: Database.Database) { }

    // ── ENCOUNTERS ───────────────────────────────────────────────────────

    /**
     * Open an encounter with its order already rolled.
     *
     * The caller rolls initiative through `rollInitiative` and hands the result
     * in sorted; this writes the order down so the sequence is a fact rather
     * than something recomputed - and therefore re-rolled - on every read.
     */
    createEncounter(input: CreateEncounterInput): CombatEncounter {
        const id = input.id ?? randomUUID();
        const write = this.db.transaction(() => {
            this.db.prepare(`
                INSERT INTO combat_encounters (id, run_id, seed, status, round, turn_index, location, ambient)
                VALUES (?, ?, ?, 'active', 1, 0, ?, ?)
            `).run(id, input.runId ?? null, input.seed, input.location ?? null, input.ambient ?? 'normal');

            const insert = this.db.prepare(`
                INSERT INTO combat_participants
                    (encounter_id, participant_id, name, cultivator_id, ordinal, initiative, slot, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `);
            input.participants.forEach((p, slot) => {
                insert.run(
                    id, p.participantId, p.name, p.cultivatorId ?? null,
                    Math.max(0, Math.floor(p.ordinal ?? 0)), p.initiative, slot
                );
            });
        });
        write();

        return this.getEncounter(id)!;
    }

    getEncounter(id: string): CombatEncounter | null {
        const row = this.db
            .prepare('SELECT * FROM combat_encounters WHERE id = ?')
            .get(id) as EncounterRow | undefined;
        return row ? toEncounter(row) : null;
    }

    /** The live encounter for a run, when there is exactly one. */
    activeEncounter(runId?: string | null): CombatEncounter | null {
        const row = (runId
            ? this.db.prepare(
                "SELECT * FROM combat_encounters WHERE status = 'active' AND run_id = ? ORDER BY created_at DESC LIMIT 1"
            ).get(runId)
            : this.db.prepare(
                "SELECT * FROM combat_encounters WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
            ).get()) as EncounterRow | undefined;
        return row ? toEncounter(row) : null;
    }

    listParticipants(encounterId: string): CombatParticipant[] {
        const rows = this.db
            .prepare('SELECT * FROM combat_participants WHERE encounter_id = ? ORDER BY slot ASC')
            .all(encounterId) as ParticipantRow[];
        return rows.map(toParticipant);
    }

    /**
     * Advance to the next active participant, wrapping the round.
     *
     * Returns null when nobody is left standing, which is a real state: an
     * encounter where every participant has been removed is over, and saying so
     * is better than handing back an actor who is not there.
     */
    advanceTurn(encounterId: string): { encounter: CombatEncounter; current: CombatParticipant | null } {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) throw new Error(`Unknown encounter ${encounterId}`);

        const participants = this.listParticipants(encounterId).filter(p => p.active);
        if (participants.length === 0) {
            return { encounter, current: null };
        }

        const nextIndex = encounter.turnIndex + 1;
        const wrapped = nextIndex >= participants.length;
        const turnIndex = wrapped ? 0 : nextIndex;
        const round = wrapped ? encounter.round + 1 : encounter.round;

        this.db.prepare(
            'UPDATE combat_encounters SET turn_index = ?, round = ? WHERE id = ?'
        ).run(turnIndex, round, encounterId);

        return {
            encounter: this.getEncounter(encounterId)!,
            current: participants[turnIndex]
        };
    }

    currentParticipant(encounterId: string): CombatParticipant | null {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return null;
        const participants = this.listParticipants(encounterId).filter(p => p.active);
        if (participants.length === 0) return null;
        return participants[Math.min(encounter.turnIndex, participants.length - 1)];
    }

    /** Take somebody out of the order without deleting the record of them being in it. */
    deactivateParticipant(encounterId: string, participantId: string): boolean {
        return this.db.prepare(
            'UPDATE combat_participants SET active = 0 WHERE encounter_id = ? AND participant_id = ?'
        ).run(encounterId, participantId).changes > 0;
    }

    endEncounter(encounterId: string): CombatEncounter | null {
        this.db.prepare(
            "UPDATE combat_encounters SET status = 'ended', ended_at = datetime('now') WHERE id = ?"
        ).run(encounterId);
        return this.getEncounter(encounterId);
    }

    // ── THE RECORD ───────────────────────────────────────────────────────

    /**
     * Write down that this happened, and bump the denormalised counters.
     *
     * One transaction, because `battles_survived` on the cultivator row is an
     * index over these rows and a count that disagrees with its own history is
     * worse than no count: `assessPower` would price a veteran who is not one.
     */
    recordBattle(input: RecordBattleInput): CombatRecord {
        const write = this.db.transaction(() => {
            const info = this.db.prepare(`
                INSERT INTO combat_records (
                    cultivator_id, opponent_id, opponent_name, opponent_ordinal,
                    outcome, won, realm_gap, edges, on_day, turn, summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                input.cultivatorId,
                input.opponentId ?? null,
                input.opponentName,
                Math.max(0, Math.floor(input.opponentOrdinal)),
                input.outcome,
                input.won ? 1 : 0,
                Math.floor(input.realmGap),
                JSON.stringify([...(input.edges ?? [])]),
                input.onDay,
                Math.max(0, Math.floor(input.turn)),
                input.summary
            );

            this.db.prepare(`
                UPDATE cultivators
                SET battles_survived = battles_survived + 1,
                    battles_won = battles_won + ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(input.won ? 1 : 0, input.cultivatorId);

            return Number(info.lastInsertRowid);
        });

        const id = write();
        return this.getRecord(id)!;
    }

    getRecord(id: number): CombatRecord | null {
        const row = this.db
            .prepare('SELECT * FROM combat_records WHERE id = ?')
            .get(id) as RecordRow | undefined;
        return row ? toRecord(row) : null;
    }

    /** Everything this cultivator has been through, oldest first. */
    listRecords(cultivatorId: string, limit = 50): CombatRecord[] {
        const rows = this.db
            .prepare('SELECT * FROM combat_records WHERE cultivator_id = ? ORDER BY id ASC LIMIT ?')
            .all(cultivatorId, Math.max(1, Math.floor(limit))) as RecordRow[];
        return rows.map(toRecord);
    }

    /**
     * Whether these two have met before, and how it went.
     *
     * Familiarity with a specific opponent is a real advantage in this setting -
     * "a veteran and a novice at identical cultivation must not fight
     * identically" cuts both ways when the veteran has fought this exact person.
     */
    priorEncounters(cultivatorId: string, opponentId: string): CombatRecord[] {
        const rows = this.db
            .prepare('SELECT * FROM combat_records WHERE cultivator_id = ? AND opponent_id = ? ORDER BY id ASC')
            .all(cultivatorId, opponentId) as RecordRow[];
        return rows.map(toRecord);
    }
}

function toEncounter(row: EncounterRow): CombatEncounter {
    return {
        id: row.id,
        runId: row.run_id,
        seed: row.seed,
        status: row.status === 'ended' ? 'ended' : 'active',
        round: row.round,
        turnIndex: row.turn_index,
        location: row.location,
        ambient: row.ambient as AmbientQi,
        createdAt: row.created_at,
        endedAt: row.ended_at
    };
}

function toParticipant(row: ParticipantRow): CombatParticipant {
    return {
        participantId: row.participant_id,
        name: row.name,
        cultivatorId: row.cultivator_id,
        ordinal: row.ordinal,
        initiative: row.initiative,
        slot: row.slot,
        active: row.active === 1
    };
}

function toRecord(row: RecordRow): CombatRecord {
    let edges: string[] = [];
    try {
        const parsed = JSON.parse(row.edges);
        if (Array.isArray(parsed)) edges = parsed.map(String);
    } catch {
        edges = [];
    }
    return {
        id: row.id,
        cultivatorId: row.cultivator_id,
        opponentId: row.opponent_id,
        opponentName: row.opponent_name,
        opponentOrdinal: row.opponent_ordinal,
        outcome: row.outcome,
        won: row.won === 1,
        realmGap: row.realm_gap,
        edges,
        onDay: row.on_day,
        turn: row.turn,
        summary: row.summary
    };
}
