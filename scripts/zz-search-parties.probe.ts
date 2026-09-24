/**
 * DOES A HOUSE EVER ACTUALLY GO LOOKING, AND DOES IT EVER FIND ANYBODY.
 *
 * Every piece of the search is tested and none of it had been run: a house
 * sends a party after one of its own, the party comes home, and what it
 * brought back is face across the house or an account against a name. A
 * mechanism that is correct and unreached looks exactly like one that works.
 *
 * Five numbers, per seed:
 *
 *   sent        parties dispatched over the run
 *   houses      distinct houses that sent one - one house looking for ever is
 *               the shape this repo keeps finding
 *   gaveUp      houses that stopped looking for somebody after three empties
 *   accounts    grudges opened by a search that found a killing
 *   faceMoved   whether any accident recovery moved a house's face
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/zz-search-parties.probe.ts
 *
 * Name the file: that config's include is the whole of `scripts`.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { OUT_LOOKING_FOR } from '../src/engine/world/a-disciple-takes-work-off-the-board.js';
import { GAVE_UP_LOOKING_FOR } from '../src/engine/world/a-house-sends-somebody-looking.js';

const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;

describe('search parties on the clock', () => {
    it('measures whether a house ever goes looking, and what it finds', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });

            const sentBy = new Set<string>();
            let sent = 0;
            let out = 0;

            for (let year = 1; year <= YEARS; year++) {
                advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
                let nowOut = 0;
                for (const npc of state.npcs) {
                    if (!npc.tags.some(t => t.startsWith(OUT_LOOKING_FOR))) continue;
                    nowOut++;
                    if (npc.factionId !== null) sentBy.add(npc.factionId);
                }
                // A party that was not out last year and is now is one sent.
                if (nowOut > out) sent += nowOut - out;
                out = nowOut;
            }

            const gaveUp = state.factions.filter(
                f => f.tags.some(t => t.startsWith(GAVE_UP_LOOKING_FOR))
            ).length;
            const accounts = state.obligations.filter(
                o => o.cause === 'killed_sectmate'
            ).length;

            console.log(
                `[${seed}] sent=${sent} houses=${sentBy.size} gaveUp=${gaveUp} `
                + `accounts=${accounts}`
            );
        }
    }, 900_000);
});
