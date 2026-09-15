/**
 * A FACT A CATALOG STATES IS NOT THE WORLD'S TO UNDO.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * `a-family-that-came-down-from-a-changed-beast.ts` states in its own header
 * that the Old River line's ancestor is the one person in the family still
 * alive, and the four rows under him are read as a ladder DOWN FROM him. Across
 * 24 pinned worlds run 200 years he came out `physically_dead` in 3 and
 * `missing` in 2 - roughly one world in five contradicting a fact the catalog
 * states outright. Re-measured on 24 fresh seeds while this was written: 3 of 24
 * dead, and the end notes name two passes, `Killed when the <house> came` and
 * `The crossing out of <rank> did not open`.
 *
 * Both failure modes are RANDOM DRAWS OVER A POOL HE QUALIFIES FOR - the
 * disappearance pass takes anybody at ordinal 13 or above, the killing pass
 * takes anybody below the Lid - which is why the rule this file pins is general
 * rather than about a man: **the world's random draws must not contradict a
 * stated fact.**
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ───────────────────────
 *
 * Nothing here names Duan Ankuan. A test that says "Duan Ankuan lives" is the
 * bespoke rule wearing a different hat, and it would go green on a guard that
 * hard-codes an id. Every assertion reads the claim off the catalog or off the
 * roster, so a second subject - in this catalog or another - is covered by these
 * same tests on the day somebody adds the field.
 *
 * Three claims, and the third is the one that does not decay:
 *
 *   THE RULE      the world's own ending seam refuses a stated row and takes an
 *                 ordinary one.
 *   NOT INERT     a stated row is still the world's to move. It is not filtered
 *                 out of anything; only its END is withheld.
 *   THE RATCHET   no pass of the world's own calls the primitives directly.
 *                 Eight sites in `the-world-changing-on-its-own.ts` alone end
 *                 somebody, and a guard written out by hand at each is a guard
 *                 the ninth pass does not have.
 *
 * ── THE LINE BETWEEN THE WORLD AND THE PLAYER ────────────────────────────
 *
 * A stated fact binds the world's own passes and says nothing about the person
 * playing. `markDead` stays the unguarded primitive, and the player's paths in
 * `src/web/` keep calling it, so a player who kills somebody has killed them.
 * The last test in the first block is that carve-out, asserted rather than
 * assumed.
 *
 * ── CONTROL ARM ──────────────────────────────────────────────────────────
 *
 * Drop the `theCatalogStatesTheyAreStanding` term from `theWorldMayEnd` and the
 * first block goes red. Drop the tag from the catalog row and the seeding block
 * goes red. Route any world pass back to `markDead` and the ratchet goes red
 * naming the file.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CATALOG_STATES_STANDING_TAG,
    createNpc,
    isTheWorldsToMove,
    markDead,
    PLAYER_ROW_TAG,
    theCatalogStatesTheyAreStanding,
    theWorldEnds,
    theWorldLoses,
    theWorldMayEnd,
    whatACatalogStatesAsTags,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { THE_LINE_AT_OLD_RIVER } from '../../../src/data/cultivation/a-family-that-came-down-from-a-changed-beast.js';
import { MEMBERS } from '../../../src/data/cultivation/members.js';

function somebody(id: string, tags: string[]): NpcRecord {
    return createNpc('a-stated-fact', { id, bornOnDay: 0, onDay: 1000, tags });
}

describe('the world may not end somebody a catalog states is standing', () => {
    it('refuses both endings for a stated row and performs them for an ordinary one', () => {
        const stated = somebody('npc-stated', [CATALOG_STATES_STANDING_TAG]);
        const ordinary = somebody('npc-ordinary', []);

        expect(theWorldMayEnd(stated)).toBe(false);
        expect(theWorldEnds(stated, 1000, 'The world came for them.')).toBeNull();
        expect(theWorldLoses(stated, 1000, 'Walked into the hills.')).toBeNull();

        expect(theWorldMayEnd(ordinary)).toBe(true);
        expect(theWorldEnds(ordinary, 1000, 'The world came for them.')?.status)
            .toBe('physically_dead');
        expect(theWorldLoses(ordinary, 1000, 'Walked into the hills.')?.status)
            .toBe('missing');
    });

    it('withholds the same two endings from the player row, which is the same rule', () => {
        const player = somebody('npc-player', [PLAYER_ROW_TAG]);
        expect(theWorldMayEnd(player)).toBe(false);
        expect(theWorldEnds(player, 1000, 'Died in a pass nobody played.')).toBeNull();
        expect(theWorldLoses(player, 1000, '')).toBeNull();
    });

    it('does not make a stated row invulnerable to the person playing', () => {
        const stated = somebody('npc-stated', [CATALOG_STATES_STANDING_TAG]);
        // The player's own door, which is the one every path in `src/web/` uses.
        const killed = markDead(stated, 1200, 'Killed by the player.');
        expect(killed.status).toBe('physically_dead');
        expect(killed.diedOnDay).toBe(1200);
    });

    it('leaves a stated row the world\'s to move in every other respect', () => {
        const stated = somebody('npc-stated', [CATALOG_STATES_STANDING_TAG]);
        // The predicate every pass reads to decide whether this row is theirs at
        // all. A guard that answered false here would take them out of the
        // climb, the roster and the scene as well as out of the grave.
        expect(isTheWorldsToMove(stated)).toBe(true);
    });
});

describe('a catalog states it and a seeder carries it', () => {
    it('turns the declaration into the tag the world reads', () => {
        expect(whatACatalogStatesAsTags({ theCatalogStatesTheyAreStanding: true }))
            .toEqual([CATALOG_STATES_STANDING_TAG]);
        expect(whatACatalogStatesAsTags({})).toEqual([]);
        expect(whatACatalogStatesAsTags({ theCatalogStatesTheyAreStanding: false })).toEqual([]);
    });

    it('puts a stated row into the world stating exactly what the catalogs state', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'a-stated-fact-is-seeded', catalog });

        const stated = state.npcs.filter(theCatalogStatesTheyAreStanding);
        // Counted off the catalogs rather than written down here, so adding a
        // third subject moves both sides of this at once.
        const declared = [
            ...THE_LINE_AT_OLD_RIVER.people,
            ...MEMBERS
        ].filter(row => row.theCatalogStatesTheyAreStanding).length;

        // TWO CATALOGS AND TWO SUBJECTS, which is the whole claim that this is a
        // rule rather than a rule about one man. The second is a member row
        // whose being alive is the stated cause of a measurable world
        // mechanism, and she is reached by the same predicate through a
        // different seeder.
        expect(declared).toBeGreaterThan(1);
        expect(stated.length).toBe(declared);
        expect(new Set(stated.map(n => n.tags.find(t => t.startsWith('catalog:')) ?? 'npc-line')).size)
            .toBeGreaterThan(1);
        for (const npc of stated) {
            expect(npc.status).toBe('alive');
            expect(theWorldMayEnd(npc)).toBe(false);
        }
    });
});

describe('the world ends people in one place', () => {
    /**
     * The files in `src/engine/world/` that may still call the primitives, and
     * why each one may. Anything else is a pass of the world's own and goes
     * through the seam.
     */
    const NOT_A_PASS_OF_THE_WORLDS_OWN = new Map<string, string>([
        ['npc-state.ts', 'where the primitives and the seam both live'],
        ['legacy.ts', 'applies a death somebody else already decided, from either side of the line'],
        [
            'what-a-confrontation-does-to-somebody-the-world-holds.ts',
            'the player standing in front of them, which is the carve-out'
        ]
    ]);

    it('has no world pass calling markDead or markMissing directly', () => {
        const dir = join(process.cwd(), 'src', 'engine', 'world');
        const offenders: string[] = [];
        for (const file of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
            if (NOT_A_PASS_OF_THE_WORLDS_OWN.has(file)) continue;
            const src = readFileSync(join(dir, file), 'utf8');
            // The call, not the word: a header naming the primitive is prose and
            // an import is how the seam itself reaches it.
            //
            // `setExistence` is on the list because it is the third door and it
            // has no callers anywhere in `src/` today. An unwired capability is
            // exactly the kind of thing somebody wires next year, and it can put
            // a row into `physically_dead` or `missing` without either primitive
            // being involved - so it is fenced before it has a caller rather
            // than after.
            for (const name of ['markDead', 'markMissing', 'setExistence']) {
                if (new RegExp(`(?<![\\w.])${name}\\s*\\(`).test(src)) {
                    offenders.push(`${file} calls ${name}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('keeps the two primitives the only way a row reaches a dead or missing status', () => {
        // Audited across `src/` while this was written: every write of these two
        // statuses is inside `markDead` and `markMissing`. That is what makes a
        // seam over the two of them a seam over the whole of it, and it is
        // pinned here because the claim is only worth what it is still true of.
        const dir = join(process.cwd(), 'src', 'engine', 'world');
        const writers: string[] = [];
        for (const file of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
            if (file === 'npc-state.ts') continue;
            const src = readFileSync(join(dir, file), 'utf8');
            if (/status:\s*'(physically_dead|missing)'/.test(src)) writers.push(file);
        }
        expect(writers).toEqual([]);
    });
});
