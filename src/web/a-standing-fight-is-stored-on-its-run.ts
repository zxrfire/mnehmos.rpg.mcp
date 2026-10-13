import type Database from 'better-sqlite3';
import type { Run } from '../schema/cultivation.js';
import { clearFlag, readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import type { StandingFight } from './fight-answers.js';

const FLAG_STANDING_FIGHT = 'standing_fight';

/** The flag holds the unfinished fight; the parsed value is only its cache. */
export class StoredStandingFight {
    private cached: { raw: string; value: StandingFight } | null = null;

    constructor(private readonly db: Database.Database, private readonly currentRun: () => Run | null) {}

    get(): StandingFight | null {
        const run = this.currentRun();
        if (!run) return null;
        const raw = readFlag(this.db, run.cultivatorId, FLAG_STANDING_FIGHT);
        if (raw === null) { this.cached = null; return null; }
        if (this.cached?.raw !== raw) {
            try {
                this.cached = { raw, value: JSON.parse(raw) as StandingFight };
            } catch {
                this.cached = null;
                return null;
            }
        }
        const fight = this.cached.value;
        return fight.runId === run.id && fight.cultivatorId === run.cultivatorId ? fight : null;
    }

    set(fight: StandingFight | null): void {
        if (fight) {
            const raw = JSON.stringify(fight);
            writeFlag(this.db, fight.cultivatorId, FLAG_STANDING_FIGHT, raw);
            this.cached = { raw, value: fight };
        } else {
            const holder = this.currentRun()?.cultivatorId;
            if (holder) clearFlag(this.db, holder, FLAG_STANDING_FIGHT);
            this.cached = null;
        }
    }
}
