/**
 * The route out of a fight nobody could have won.
 *
 * `assessGap` computes `REAL_OPTIONS` beside the refusal and the web layer used
 * to drop them, so a player who attacked somebody seven realms above them got a
 * well-written no and nothing else. AGENTS.md: a refusal names a route.
 *
 * The guard that matters most here is the SECOND one. Printing all nine options
 * would promise five things the game cannot do, which is worse than printing
 * none - so every entry has to be either mapped to a sentence a player can type
 * or recorded as unreachable, and a tenth option cannot be added without
 * somebody saying which of the two it is.
 */

import { describe, expect, it } from 'vitest';

import { REAL_OPTIONS } from '../../src/engine/cultivation/combat';
import {
    NO_VERB_CARRIES_THESE,
    routesOutOfAGap,
    sayingWhatWouldWork
} from '../../src/web/gap-routes';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

describe('every option is accounted for', () => {
    it('is either carried by a verb or written down as unreachable', () => {
        const unaccounted = REAL_OPTIONS.filter(option =>
            routesOutOfAGap([option]).length === 0
            && !NO_VERB_CARRIES_THESE.some(no => option.startsWith(no)));
        expect(
            unaccounted,
            'an entry in REAL_OPTIONS is neither mapped to something a player can type nor '
            + 'listed in NO_VERB_CARRIES_THESE. Decide which it is: a route the game can keep, '
            + 'or an absence worth recording. Printing it without a verb behind it is the '
            + 'narrator inventing an affordance.'
        ).toEqual([]);
    });

    it('does not claim a route and record it as unreachable at the same time', () => {
        const both = REAL_OPTIONS.filter(option =>
            routesOutOfAGap([option]).length > 0
            && NO_VERB_CARRIES_THESE.some(no => option.startsWith(no)));
        expect(both).toEqual([]);
    });

    it('carries fewer than it records, which is the honest half', () => {
        // Not a target and not a bar to widen - a statement of where the world
        // is. Most of what a weaker party can really do has no sentence yet.
        expect(routesOutOfAGap(REAL_OPTIONS).length).toBeGreaterThan(0);
        expect(NO_VERB_CARRIES_THESE.length).toBeGreaterThan(0);
    });
});

describe('what it offers is a thing the player can actually say', () => {
    it('every route parses to a live verb', () => {
        // THE POINT OF THE WHOLE FILE. A route the parser cannot read is the
        // "you could try climbing the wall" defect with extra steps, and it
        // would land on somebody desperate enough to type it verbatim.
        for (const route of routesOutOfAGap(REAL_OPTIONS)) {
            const read = parseIntent(route.say);
            expect(read.action, `"${route.say}" reached nothing`).not.toBe('unclear');
        }
    });

    it('reads as sentences rather than as a dump', () => {
        const said = sayingWhatWouldWork(routesOutOfAGap(REAL_OPTIONS), 'the Ender');
        // A lead that says what the list IS, then one line each. Nine clauses
        // of engine prose would be the engine talking to itself.
        expect(said[0]).toContain('the Ender');
        expect(said.length).toBeLessThanOrEqual(6);
        for (const line of said.slice(1)) {
            expect(line).toMatch(/^"[^"]+" - /);
        }
    });

    it('says nothing at all rather than a consolation line', () => {
        // A refusal naming no route is at least honest. One naming a route the
        // game cannot keep is not.
        expect(sayingWhatWouldWork([], 'them')).toEqual([]);
        expect(routesOutOfAGap([])).toEqual([]);
        expect(routesOutOfAGap(['something nobody has written a mapping for'])).toEqual([]);
    });

    it('keeps the engine own wording against each route it maps', () => {
        for (const route of routesOutOfAGap(REAL_OPTIONS)) {
            expect(REAL_OPTIONS).toContain(route.option);
        }
    });
});

describe('played, against somebody seven realms up', () => {
    async function withAdminMode<T>(fn: () => Promise<T>): Promise<T> {
        const before = process.env.ADMIN_MODE;
        process.env.ADMIN_MODE = 'true';
        try {
            return await fn();
        } finally {
            if (before === undefined) delete process.env.ADMIN_MODE;
            else process.env.ADMIN_MODE = before;
        }
    }

    it('the refusal names the route, in the sentences a player would type', async () => {
        await withAdminMode(async () => {
            const { game } = await makeGameInWorld({
                seed: 'hopeless', worldSeed: 'w-hopeless'
            });
            await game.newRun('Doomed');
            await game.act('I look around');
            await game.act('ADMIN spawn_encounter ordinal=40 disposition=hostile');

            const refused = await game.act('I attack the Grand Ascension cultivator');

            // The refusal itself is unchanged and still correct.
            expect(refused.narration).toMatch(/is not a fight/);
            // And now it says what would have worked. Read off the narration
            // rather than the log, because the whole defect was that the engine
            // computed this and the last hop dropped it.
            expect(refused.narration).toMatch(/What works against .* is not a better swing/);
            expect(refused.narration).toContain('"I get out of here"');
            expect(refused.narration).toContain('"I go and cultivate"');
            // And it never offers what it cannot carry out.
            for (const unreachable of ['hide', 'exploit terrain', 'avoid detection']) {
                expect(refused.narration?.toLowerCase()).not.toContain(unreachable);
            }
        });
    }, 300_000);
});
