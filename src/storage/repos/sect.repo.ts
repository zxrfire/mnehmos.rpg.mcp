import Database from 'better-sqlite3';
import { Sect, SectSchema } from '../../schema/cultivation.js';
import { whereAHouseLetsYouKeepThings } from '../../engine/world/the-room-a-house-gives-you.js';

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
    private readonly recordDepartureStmt: Database.Statement;
    private readonly selectDepartureStmt: Database.Statement;
    private readonly selectMembershipStmt: Database.Statement;
    private readonly listMembersStmt: Database.Statement;
    private readonly setRankStmt: Database.Statement;
    private readonly addContributionStmt: Database.Statement;
    private readonly mirrorOnCultivatorStmt: Database.Statement;
    private readonly clearOnCultivatorStmt: Database.Statement;
    private readonly handBackTheirThingsStmt: Database.Statement;
    private readonly emptyTheirQuartersStmt: Database.Statement;

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

        // ── WHAT WAS IN THE ROOM COMES BACK TO THE PERSON ────────────────
        //
        // The design owner, on losing your place: an outer disciple just hands
        // you your stuff. Expelled or walked out, the house does not keep what
        // is yours, and nobody makes a speech about it.
        //
        // HERE RATHER THAN AT A CALL SITE. Four places above this layer remove
        // a member, and a handback one of them forgot would leave somebody's
        // possessions under a key no verb can reach once the membership row is
        // gone - the orphan this has to be impossible rather than careful about.
        //
        // AND IT REACHES THEM WHEREVER THEY ARE. The alternative is holding
        // the goods at the house for a collection somebody off in another
        // province can no longer make, which is the same orphan wearing a
        // politer word. Onto the body, and an over-full pouch is then an
        // ordinary problem the carry read already reports.
        //
        // Merged rather than moved, because `holder_id` is half the primary
        // key: a plain UPDATE collides the moment somebody is carrying a pill
        // they also left three of at home.
        this.handBackTheirThingsStmt = db.prepare(`
            INSERT INTO cultivator_pouch (holder_id, item_id, item_kind, quantity, updated_at)
            SELECT @cultivatorId, item_id, item_kind, quantity, datetime('now')
            FROM cultivator_pouch WHERE holder_id = @quartersId
            ON CONFLICT(holder_id, item_id) DO UPDATE SET
                quantity = cultivator_pouch.quantity + excluded.quantity,
                updated_at = excluded.updated_at
        `);
        this.emptyTheirQuartersStmt = db.prepare(
            'DELETE FROM cultivator_pouch WHERE holder_id = ?'
        );

        // Written in the same transaction as the delete. A house remembers who
        // used to be in it, and without that a returning member was a stranger
        // - which made leaving and re-entering a free promotion. See the table
        // comment in `migrations.cultivation.ts`.
        //
        // Most recent departure wins, because it is the honest record: somebody
        // who came back and left again at a lower seat left at the lower seat.
        this.recordDepartureStmt = db.prepare(`
            INSERT INTO sect_departures
                (sect_id, cultivator_id, rank_index, rank_title, contribution, left_at)
            SELECT sect_id, cultivator_id, rank_index, rank_title, contribution, datetime('now')
            FROM sect_members
            WHERE sect_id = @sectId AND cultivator_id = @cultivatorId
            ON CONFLICT(sect_id, cultivator_id) DO UPDATE SET
                rank_index = excluded.rank_index,
                rank_title = excluded.rank_title,
                contribution = excluded.contribution,
                left_at = excluded.left_at
        `);

        this.selectDepartureStmt = db.prepare(`
            SELECT * FROM sect_departures WHERE sect_id = ? AND cultivator_id = ?
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

        // cultivators.sect_id mirrors the membership row so the cultivator's
        // own record answers "whose roll are you on" without a join. The RUNG
        // is not mirrored and must not be: this row is written back from stale
        // snapshots all day, and a rung that travelled with the house was a
        // third copy of what `sect_members.rank_index` and the world row
        // already hold. See `where-somebody-stands-on-a-houses-roll.ts`.
        this.mirrorOnCultivatorStmt = db.prepare(`
            UPDATE cultivators SET sect_id = @sectId, updated_at = datetime('now')
            WHERE id = @cultivatorId
        `);
        this.clearOnCultivatorStmt = db.prepare(`
            UPDATE cultivators SET sect_id = NULL, updated_at = datetime('now')
            WHERE id = ?
        `);
    }

    // CATALOG

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

    // MEMBERSHIP

    /**
     * Enrol a cultivator. Membership is exclusive (a unique index enforces
     * it), so joining a second sect is a defection, not an addition - the old
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
            this.mirrorOnCultivatorStmt.run({ sectId, cultivatorId });
        });
        enrol();

        return this.getMembership(cultivatorId);
    }

    /** Expulsion or departure. Clears the mirror on the cultivator row too. */
    removeMember(sectId: string, cultivatorId: string): boolean {
        const expel = this.db.transaction(() => {
            // BEFORE the delete, because it copies out of the row being
            // deleted. A house remembers who used to be in it: without this a
            // returning member reads as a stranger, and entry rank is computed
            // from ordinal alone - which made walking out and back in a free
            // promotion.
            this.recordDepartureStmt.run({ sectId, cultivatorId });
            const changed = this.removeMemberStmt.run(sectId, cultivatorId).changes > 0;
            if (changed) {
                this.clearOnCultivatorStmt.run(cultivatorId);
                const quartersId = whereAHouseLetsYouKeepThings(sectId, cultivatorId);
                this.handBackTheirThingsStmt.run({ cultivatorId, quartersId });
                this.emptyTheirQuartersStmt.run(quartersId);
            }
            return changed;
        });
        return expel();
    }

    /**
     * The seat somebody held in this house on the day they left it, or null.
     *
     * Read at ENTRY, where it caps the rank a returning member may re-enter at.
     * Contribution is recorded too, and is forfeited rather than restored - the
     * game already says so on the way out, and it is the thing they have to
     * re-earn.
     */
    formerMembership(
        sectId: string,
        cultivatorId: string
    ): { rankIndex: number; rankTitle: string; contribution: number; leftAt: string } | null {
        const row = this.selectDepartureStmt.get(sectId, cultivatorId) as {
            rank_index: number; rank_title: string; contribution: number; left_at: string;
        } | undefined;
        if (!row) return null;
        return {
            rankIndex: row.rank_index,
            rankTitle: row.rank_title,
            contribution: row.contribution,
            leftAt: row.left_at
        };
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
                this.mirrorOnCultivatorStmt.run({ sectId, cultivatorId });
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
