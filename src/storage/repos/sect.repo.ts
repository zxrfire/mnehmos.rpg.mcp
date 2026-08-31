import Database from 'better-sqlite3';
import { Sect, SectSchema } from '../../schema/cultivation.js';

interface SectRow {
    id: string;
    name: string;
    alignment: string;
    power_ordinal: number;
    ranks: string;
    admission_ordinal: number;
    stipend: string;
    description: string;
    created_at: string;
    updated_at: string;
}

interface SectMemberRow {
    sect_id: string;
    cultivator_id: string;
    rank_index: number;
    rank_title: string;
    contribution: number;
    joined_at: string;
    updated_at: string;
}

export interface SectMembership {
    sectId: string;
    cultivatorId: string;
    /** Index into the sect's `ranks` and `stipend` arrays. This is the authority. */
    rankIndex: number;
    /** Denormalised display title, resolved from `ranks[rankIndex]` at write time. */
    rankTitle: string;
    contribution: number;
    joinedAt: string;
}

/**
 * Sects, membership, and the stipend that keeps a low-realm disciple fed.
 *
 * rank_index is stored rather than rank title because rank is *ordered*:
 * promotion, stipend lookup, and "may this disciple enter the inner library"
 * are all comparisons, and comparing strings against a sect's own rank list on
 * every check is how off-by-one bugs get into a game with permadeath.
 */
export class SectRepository {
    private readonly upsertStmt: Database.Statement;
    private readonly selectByIdStmt: Database.Statement;
    private readonly listStmt: Database.Statement;
    private readonly deleteStmt: Database.Statement;
    private readonly addMemberStmt: Database.Statement;
    private readonly removeMemberStmt: Database.Statement;
    private readonly selectMembershipStmt: Database.Statement;
    private readonly listMembersStmt: Database.Statement;
    private readonly setRankStmt: Database.Statement;
    private readonly addContributionStmt: Database.Statement;
    private readonly mirrorOnCultivatorStmt: Database.Statement;
    private readonly clearOnCultivatorStmt: Database.Statement;

    constructor(private db: Database.Database) {
        this.upsertStmt = db.prepare(`
            INSERT INTO sects (
                id, name, alignment, power_ordinal, ranks,
                admission_ordinal, stipend, description
            ) VALUES (
                @id, @name, @alignment, @powerOrdinal, @ranks,
                @admissionOrdinal, @stipend, @description
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                alignment = excluded.alignment,
                power_ordinal = excluded.power_ordinal,
                ranks = excluded.ranks,
                admission_ordinal = excluded.admission_ordinal,
                stipend = excluded.stipend,
                description = excluded.description,
                updated_at = datetime('now')
        `);

        this.selectByIdStmt = db.prepare('SELECT * FROM sects WHERE id = ?');
        this.listStmt = db.prepare('SELECT * FROM sects ORDER BY power_ordinal DESC, name ASC');
        this.deleteStmt = db.prepare('DELETE FROM sects WHERE id = ?');

        this.addMemberStmt = db.prepare(`
            INSERT INTO sect_members (sect_id, cultivator_id, rank_index, rank_title)
            VALUES (@sectId, @cultivatorId, @rankIndex, @rankTitle)
            ON CONFLICT(sect_id, cultivator_id) DO UPDATE SET
                rank_index = excluded.rank_index,
                rank_title = excluded.rank_title,
                updated_at = datetime('now')
        `);

        this.removeMemberStmt = db.prepare(`
            DELETE FROM sect_members WHERE sect_id = ? AND cultivator_id = ?
        `);

        this.selectMembershipStmt = db.prepare(`
            SELECT * FROM sect_members WHERE cultivator_id = ?
        `);

        this.listMembersStmt = db.prepare(`
            SELECT * FROM sect_members WHERE sect_id = ?
            ORDER BY rank_index DESC, joined_at ASC
        `);

        this.setRankStmt = db.prepare(`
            UPDATE sect_members
            SET rank_index = @rankIndex, rank_title = @rankTitle, updated_at = datetime('now')
            WHERE sect_id = @sectId AND cultivator_id = @cultivatorId
        `);

        this.addContributionStmt = db.prepare(`
            UPDATE sect_members
            SET contribution = MAX(0, contribution + @delta), updated_at = datetime('now')
            WHERE sect_id = @sectId AND cultivator_id = @cultivatorId
        `);

        // cultivators.sect_id / sect_rank mirror the membership row so the
        // cultivator's own record answers "who do you answer to" without a join.
        this.mirrorOnCultivatorStmt = db.prepare(`
            UPDATE cultivators SET sect_id = @sectId, sect_rank = @sectRank, updated_at = datetime('now')
            WHERE id = @cultivatorId
        `);
        this.clearOnCultivatorStmt = db.prepare(`
            UPDATE cultivators SET sect_id = NULL, sect_rank = NULL, updated_at = datetime('now')
            WHERE id = ?
        `);
    }

    // ── CATALOG ──────────────────────────────────────────────────────────

    upsert(sect: Sect): Sect {
        const valid = SectSchema.parse(sect);
        this.upsertStmt.run({
            id: valid.id,
            name: valid.name,
            alignment: valid.alignment,
            powerOrdinal: valid.powerOrdinal,
            ranks: JSON.stringify(valid.ranks),
            admissionOrdinal: valid.admissionOrdinal,
            stipend: JSON.stringify(valid.stipend),
            description: valid.description
        });
        return valid;
    }

    getById(id: string): Sect | null {
        const row = this.selectByIdStmt.get(id) as SectRow | undefined;
        return row ? rowToSect(row) : null;
    }

    list(): Sect[] {
        return (this.listStmt.all() as SectRow[]).map(rowToSect);
    }

    delete(id: string): boolean {
        return this.deleteStmt.run(id).changes > 0;
    }

    // ── MEMBERSHIP ───────────────────────────────────────────────────────

    /**
     * Enrol a cultivator. Membership is exclusive (a unique index enforces
     * it), so joining a second sect is a defection, not an addition — the old
     * row is removed in the same transaction rather than left to collide.
     */
    addMember(sectId: string, cultivatorId: string, rankIndex = 0): SectMembership | null {
        const sect = this.getById(sectId);
        if (!sect) return null;

        const index = clampRank(rankIndex, sect.ranks.length);
        const title = sect.ranks[index] ?? '';

        const enrol = this.db.transaction(() => {
            const existing = this.getMembership(cultivatorId);
            if (existing && existing.sectId !== sectId) {
                this.removeMemberStmt.run(existing.sectId, cultivatorId);
            }
            this.addMemberStmt.run({ sectId, cultivatorId, rankIndex: index, rankTitle: title });
            this.mirrorOnCultivatorStmt.run({ sectId, sectRank: title, cultivatorId });
        });
        enrol();

        return this.getMembership(cultivatorId);
    }

    /** Expulsion or departure. Clears the mirror on the cultivator row too. */
    removeMember(sectId: string, cultivatorId: string): boolean {
        const expel = this.db.transaction(() => {
            const changed = this.removeMemberStmt.run(sectId, cultivatorId).changes > 0;
            if (changed) this.clearOnCultivatorStmt.run(cultivatorId);
            return changed;
        });
        return expel();
    }

    getMembership(cultivatorId: string): SectMembership | null {
        const row = this.selectMembershipStmt.get(cultivatorId) as SectMemberRow | undefined;
        return row ? rowToMembership(row) : null;
    }

    listMembers(sectId: string): SectMembership[] {
        return (this.listMembersStmt.all(sectId) as SectMemberRow[]).map(rowToMembership);
    }

    /** Promote or demote. The title is re-resolved from the sect's own rank list. */
    setRank(sectId: string, cultivatorId: string, rankIndex: number): SectMembership | null {
        const sect = this.getById(sectId);
        if (!sect) return null;

        const index = clampRank(rankIndex, sect.ranks.length);
        const title = sect.ranks[index] ?? '';

        const promote = this.db.transaction(() => {
            const changed = this.setRankStmt.run({ sectId, cultivatorId, rankIndex: index, rankTitle: title }).changes;
            if (changed > 0) {
                this.mirrorOnCultivatorStmt.run({ sectId, sectRank: title, cultivatorId });
            }
            return changed;
        });
        if (promote() === 0) return null;

        return this.getMembership(cultivatorId);
    }

    addContribution(sectId: string, cultivatorId: string, delta: number): SectMembership | null {
        const changed = this.addContributionStmt.run({
            sectId,
            cultivatorId,
            delta: Math.round(delta)
        }).changes;
        if (changed === 0) return null;
        return this.getMembership(cultivatorId);
    }

    /**
     * Monthly stipend in spirit stones for a rank. Ranks beyond the end of the
     * stipend table pay nothing rather than crashing: a sect may legitimately
     * define more titles than it pays for.
     */
    stipendForRank(sectId: string, rankIndex: number): number {
        const sect = this.getById(sectId);
        if (!sect) return 0;
        return sect.stipend[rankIndex] ?? 0;
    }

    /** Stipend for whichever sect this cultivator currently serves; 0 if unaffiliated. */
    stipendForCultivator(cultivatorId: string): number {
        const membership = this.getMembership(cultivatorId);
        if (!membership) return 0;
        return this.stipendForRank(membership.sectId, membership.rankIndex);
    }
}

function rowToSect(row: SectRow): Sect {
    return SectSchema.parse({
        id: row.id,
        name: row.name,
        alignment: row.alignment,
        powerOrdinal: row.power_ordinal,
        ranks: JSON.parse(row.ranks),
        admissionOrdinal: row.admission_ordinal,
        stipend: JSON.parse(row.stipend),
        description: row.description
    });
}

function rowToMembership(row: SectMemberRow): SectMembership {
    return {
        sectId: row.sect_id,
        cultivatorId: row.cultivator_id,
        rankIndex: row.rank_index,
        rankTitle: row.rank_title,
        contribution: row.contribution,
        joinedAt: row.joined_at
    };
}

function clampRank(index: number, rankCount: number): number {
    const highest = Math.max(0, rankCount - 1);
    return Math.max(0, Math.min(highest, Math.round(index)));
}
