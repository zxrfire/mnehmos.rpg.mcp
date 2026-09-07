/**
 * WHERE THE ONE-STORE REFACTOR ACTUALLY IS.
 *
 * This repository had 237 SQL write statements over 91 tables plus 265 in-place
 * mutations of an in-memory `WorldState`, reaching durability through 85
 * independent `db.transaction()` calls and two deferred world flushes. No write
 * site declared what it needed to be atomic with; 85 callers each decided
 * separately, and one `cultivate` turn committed six times at minimum.
 *
 * The work of joining them up is long and lands over many commits, so it needs
 * something that says where it is. This is that: a ratchet on the claims that
 * have actually been won, so none of them can be quietly given back.
 *
 * ── WHY THESE NUMBERS AND NOT A TRANSACTION COUNT ────────────────────────
 *
 * The obvious metric - how many `db.transaction(` calls there are - moves the
 * WRONG WAY when the refactor is going well. Adding a transaction to a bare loop
 * of autocommits raises the count and is exactly the right change. Atomicity is
 * the goal; the number of boundaries is not.
 *
 * So what is ratcheted is: one writer per fact, one write mode per intent, and
 * a deferred-flush count that only ever falls.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');

function everySourceFile(dir = SRC, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) everySourceFile(full, out);
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

const FILES = everySourceFile();
const SOURCE = new Map(FILES.map(f => [f, readFileSync(f, 'utf8')]));

function occurrences(needle: string): number {
    let n = 0;
    for (const text of SOURCE.values()) {
        let at = text.indexOf(needle);
        while (at >= 0) { n++; at = text.indexOf(needle, at + needle.length); }
    }
    return n;
}

function filesContaining(needle: string): string[] {
    return [...SOURCE.entries()].filter(([, t]) => t.includes(needle)).map(([f]) => f);
}

describe('one writer per fact', () => {
    it('writes an obligation from exactly one statement', () => {
        // There were two - `encounters.ts` and `obligation.repo.ts` - the same
        // 23-column INSERT OR REPLACE from the same record type, reached from
        // 41 sites between them.
        expect(occurrences('INSERT OR REPLACE INTO obligations')).toBe(1);
    });

    it('persists a time skip from exactly one function', () => {
        // The play loop and the tool path had drifted four ways, and the play
        // loop was the one missing the Lid bar.
        expect(occurrences('export function applyTimeSkip')).toBe(1);
    });

    it('holds a pouch stack under exactly one key', () => {
        // `cultivator_pouch` was keyed on `cultivator_id` with a cascade, so a
        // dead person's stock ceased to exist. It is keyed on a holder now, and
        // nothing may reintroduce the old column.
        expect(occurrences('cultivator_pouch WHERE cultivator_id')).toBe(0);
    });
});

describe('one write mode per intent', () => {
    it('keeps `saveWorld` to the world layer, where a lifecycle event is', () => {
        // `saveWorld` CLEARS all 25 world tables before re-inserting. A caller
        // outside the module that owns a world's lifecycle is a caller that
        // will eventually use it to "just save", and destroy a world.
        const callers = filesContaining('saveWorld(')
            .filter(f => !f.includes('world-state.repo') && !f.includes('cultivation-world'));
        expect(callers).toEqual([]);
    });

    it('and the transition boundary is the only thing that bumps a revision', () => {
        // A revision that moved without the change it describes tells every
        // cache that a stale world is current, which is worse than no revision.
        const callers = filesContaining('advanceWorldRevision')
            .filter(f => !f.includes('world-revision'));
        expect(callers.map(f => f.split(/[\\/]/).pop())).toEqual(['transition-runner.ts']);
    });
});

describe('nothing defers a world write any more', () => {
    /**
     * There were 29. A boolean called `worldDirty` marked "the world changed,
     * write it at the end of the turn", and the end of the turn is strictly
     * after every SQLite row of that turn has already committed - so a crash
     * between the two tore, and the deferral was invisible at all 29 sites.
     *
     * The field is DELETED rather than the sites converted one at a time,
     * because a boolean anybody can set is a boolean somebody will set again.
     * With nothing to defer to, a new deferred world write does not compile.
     */
    it('has no flag to set, so a new deferral cannot be written', () => {
        expect(occurrences('worldDirty')).toBe(0);
    });

    it('and no second flush point pretending to be one', () => {
        // `saveWorldForRun` is the deferred-write door. It survives for the two
        // handlers that genuinely have no transaction open and no world change
        // to join; the turn engine must not be one of them again.
        const engine = SOURCE.get(join(SRC, 'web', 'turn-engine.ts')) ?? '';
        expect(engine.includes('saveWorldForRun')).toBe(false);
    });

    it('writes the world through the boundary and nowhere else', () => {
        // `theWorldMoved` is the one primitive, and it commits through
        // `commitOneTransition` - which NESTS, so a caller already inside a
        // transaction gets its world write joined to the rows rather than
        // deferred, and a caller outside one gets a single atomic write.
        const engine = SOURCE.get(join(SRC, 'web', 'turn-engine.ts')) ?? '';
        expect(engine.includes('theWorldMoved()')).toBe(true);
        expect(engine.includes('commitOneTransition')).toBe(true);
    });
});
