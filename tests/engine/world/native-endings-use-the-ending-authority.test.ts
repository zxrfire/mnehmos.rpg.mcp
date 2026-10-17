/** The8210cf97 long catalog file found an autonomous dao-oath ending
 * bypassing the ordinary ending authority. Explicit played seal/attack appliers
 * are shared mechanics, not autonomous passes. These exact three source guards
 * move intact out of the historical fixture file so they can diagnose a route
 * in milliseconds. The separate oath test exercises the actual fatal branch.
 * This remains a coarse call-name ratchet, not a complete call-graph proof. */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('the world ends people in one place', () => {
    /**
     * The files in `src/engine/world/` that may still call the primitives, and
     * why each one may. Anything else is a pass of the world's own and goes
     * through the seam.
     */
    const NOT_A_PASS_OF_THE_WORLDS_OWN = new Map<string, string>([
        ['npc-state.ts', 'where the primitives and the seam both live'],
        ['legacy.ts', 'applies a death somebody else already decided, from either side of the line'],
        ['something-acting-in-your-place.ts', 'shared player and NPC possession; its autonomous caller consults the ending seam'],
        ['person-seals.ts', 'the seal ending is called by the explicit played seal action'],
        ['slave-orders.ts', 'attack resolves an explicit command; autonomous contract service only orders guard duty'],
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
            // Existence transitions can end a person without calling markDead.
            for (const name of ['markDead', 'markMissing', 'setExistence']) {
                if (new RegExp(`(?<![\\w.])${name}\\s*\\(`).test(src)) {
                    offenders.push(`${file} calls ${name}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('has no world pass reaching an ending through a shared applier either', () => {
        /**
         * THE HOLE THE FIRST RATCHET HAD, found by the wall fixture rather than
         * by reading. `war-melee.ts` never calls `markDead` - it hands a fight
         * to `whatTheConfrontationDidToThem`, which does. So a war between two
         * houses, with no player anywhere near it, ended somebody the catalog
         * states is standing, through a file exempted as "the player's door".
         * It is BOTH doors, which is exactly why the guard cannot live inside
         * it: putting it there would make a stated row invulnerable to a player.
         *
         * So the rule is one step wider than "do not call the primitives": a
         * world pass that reaches an ending through somebody else's applier
         * consults the seam itself. Checked by name rather than by call graph,
         * which is coarse and is the reason it is a grep rather than a promise.
         */
        const dir = join(process.cwd(), 'src', 'engine', 'world');
        const appliers: string[] = [];
        for (const file of NOT_A_PASS_OF_THE_WORLDS_OWN.keys()) {
            if (file === 'npc-state.ts') continue;
            const src = readFileSync(join(dir, file), 'utf8');
            for (const m of src.matchAll(/^export function (\w+)/gm)) {
                const body = src.slice(src.indexOf(`export function ${m[1]}`));
                // Only the ones that actually end somebody.
                if (/markDead\s*\(|markMissing\s*\(/.test(body.slice(0, 6000))) appliers.push(m[1]);
            }
        }
        expect(appliers.length).toBeGreaterThan(0);

        const offenders: string[] = [];
        for (const file of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
            if (NOT_A_PASS_OF_THE_WORLDS_OWN.has(file)) continue;
            const src = readFileSync(join(dir, file), 'utf8');
            for (const applier of appliers) {
                if (!new RegExp(`(?<![\\w.])${applier}\\s*\\(`).test(src)) continue;
                if (/theWorldMayEnd|theWorldEnds|theWorldLoses/.test(src)) continue;
                offenders.push(`${file} reaches an ending through ${applier}`);
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
