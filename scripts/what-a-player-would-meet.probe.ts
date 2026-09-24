/**
 * HOW SATURATED THE WORLD IS WITH INHERITED GRUDGES, IN A PLAYER'S UNITS.
 *
 * The design owner, on the heir-found rate: *"i don't really care. you take
 * this as a lever to tune the amount of content in the world"* - and he named
 * the failure mode himself: *"if a player sees everyone with a grudge"*, it
 * *"gets stale"*.
 *
 * So the rate is a dial and the thing it is set against is SATURATION. Ties per
 * death is not a unit a player meets. What a player meets is people, and the
 * question is what share of them are carrying something.
 *
 * Measured on the living at the end of a run, not on the dead who handed it on:
 *
 *   any        share of the living carrying at least one inherited tie
 *   spread     how many carry one, two, three, four or more
 *
 * NO PLAYER-MEETS PREDICATE EXISTS, so none is invented here. `nameableNames`
 * and `nameableSites` are about awareness rows and sites, not about which of
 * the world's people a run puts in front of somebody, and inventing a
 * plausible-looking filter would put a number on a definition nobody has ruled.
 * The living are the honest denominator: if a third of everybody alive carries
 * an inherited grudge, a player meeting any of them meets one.
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/what-a-player-would-meet.probe.ts
 *
 * Name the file: that config's include is the whole of `scripts`.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { FRIENDSHIP_STANDING, GRUDGE_STANDING } from '../src/engine/world/gatherings.js';

/** Mirrors `a-death-passes-something-on.test.ts`, so the two can be compared. */
const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;

describe('what a player would meet', () => {
    it('counts the living carrying an inherited tie', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });

            const living = state.npcs.filter(n => n.status === 'alive');
            const inherited = (n: (typeof living)[number]) =>
                n.relationships.filter(tie => tie.inheritedFromId !== null);
            // ── GRUDGES AND FRIENDSHIPS ARE DIFFERENT CONTENT ────────────
            //
            // The live handoff passes every account outside the neutral middle,
            // so an heir inherits their master's friends as well as their
            // enemies. The owner's staleness worry - "if a player sees everyone
            // with a grudge" - is about one half of that. A world where a
            // disciple is owed a kindness their master was owed reads as a world
            // with history; a world where everybody is owed blood reads as a
            // feud simulator. Counted apart, because a dial set on the total
            // would be set against the wrong thing.
            const grudges = living.map(n =>
                inherited(n).filter(tie => tie.standing <= GRUDGE_STANDING).length);
            const friends = living.map(n =>
                inherited(n).filter(tie => tie.standing >= FRIENDSHIP_STANDING).length);
            const carried = living.map(n => inherited(n).length);
            const withAny = carried.filter(n => n > 0).length;
            const withGrudge = grudges.filter(n => n > 0).length;
            const withFriend = friends.filter(n => n > 0).length;
            const withBoth = living.filter((_, i) => grudges[i]! > 0 && friends[i]! > 0).length;
            const bucket = (of: number[], lo: number, hi: number) =>
                of.filter(n => n >= lo && n <= hi).length;

            const pct = (n: number) => `${Math.round((100 * n) / Math.max(1, living.length))}%`;
            // eslint-disable-next-line no-console
            console.log(
                `${seed}: ${living.length} alive, ${withAny} carry an inherited tie (${pct(withAny)})`
                + `\n    grudge ${withGrudge} (${pct(withGrudge)})  friendship ${withFriend} (${pct(withFriend)})`
                + `  both ${withBoth} (${pct(withBoth)})`
                + `\n    grudge depth   1: ${bucket(grudges, 1, 1)}  2: ${bucket(grudges, 2, 2)}`
                + `  3: ${bucket(grudges, 3, 3)}  4+: ${bucket(grudges, 4, 9999)}`
                + `\n    total inherited: ${carried.reduce((a, b) => a + b, 0)}`
                + ` (grudge ${grudges.reduce((a, b) => a + b, 0)}, friendship ${friends.reduce((a, b) => a + b, 0)})`
            );
        }
        // eslint-disable-next-line no-console
        console.log(
            '\nThe denominator is everybody alive, because no predicate for "somebody a player'
            + '\nwould meet" exists in the tree and inventing one would put a number on a'
            + '\ndefinition nobody has ruled. Read the share, not the total.'
        );
    }, 6 * 60 * 60_000);
});
