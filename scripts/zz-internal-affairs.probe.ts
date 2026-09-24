/**
 * DOES INTERNAL AFFAIRS EVER NOTICE ANYBODY.
 *
 * The office whose job is personnel - the one that knows a week's errand has
 * taken a month and tells everybody something is wrong. It was written whole,
 * has a reader, has prose, and has a test named after it.
 *
 * It had never fired. Measured across two worlds and two hundred years, both
 * seeds: ZERO notices, while 439 and 425 people stood with a term lapsed past
 * its margin. The cause was one line in `bringHomeWhoeverIsDue`, which runs at
 * day 62 and cleared the activity of everybody at or past their due day - a
 * superset of what Internal Affairs looks at on day 63, including the people
 * the world had lost, whose activity `markMissing` deliberately leaves standing
 * so that there is something to notice.
 *
 * Nobody caught it because a second pass had been given its sentence seventeen
 * days earlier, and the test selects on the string. A name collision concealed
 * a dead mechanism behind a live one.
 *
 * Three numbers, per seed:
 *
 *   noticed        `overdue` facts written in the run
 *   people         distinct people they were about - one notice each is the
 *                  claim, so this should equal `noticed`
 *   stillLate      people standing at the end with a term lapsed past the
 *                  margin and no notice ever written about them
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/zz-internal-affairs.probe.ts
 *
 * Name the file: that config's include is the whole of `scripts`.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { isAwayOnSomething } from '../src/engine/world/npc-state.js';

const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;

/** The share of its own term a posting has to run over before the house says so. */
const LATE_ENOUGH_TO_SAY_SO = 0.5;

describe('internal affairs on the clock', () => {
    it('measures whether a house ever says somebody has not come back', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });

            for (let year = 1; year <= YEARS; year++) {
                advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
            }

            // COUNTED BY THE SENTENCE AND SPLIT BY THE DATA, because both
            // producers write the byte-identical summary and only one of them
            // carries `lostTrackOf`. Counting the pressure kind does not work:
            // 'overdue' is a PressureKind and never a HistoricalEventKind, so
            // a filter on `f.kind` silently returns nothing - which is how a
            // first cut of this probe reported zero for the wrong reason.
            const said = state.history.facts.filter(
                f => f.summary.includes('The hall has started asking')
            );
            const notices = said.filter(
                f => (f.data as { lostTrackOf?: string } | undefined)?.lostTrackOf === undefined
            );
            const byTheAbsencePass = said.length - notices.length;
            const about = new Set<string>();
            for (const fact of notices) {
                for (const actor of fact.actors) about.add(actor.id);
            }

            // Standing late at the end, and never spoken about. A non-zero here
            // beside a non-zero `noticed` is the world working: somebody who
            // went out last year is late and has not been given up on yet.
            const day = state.currentDay;
            let stillLate = 0;
            for (const npc of state.npcs) {
                if (npc.status === 'physically_dead') continue;
                const doing = npc.activity;
                if (!doing || !isAwayOnSomething(doing.kind)) continue;
                if (doing.untilDay === null || doing.untilDay === undefined) continue;
                const term = Math.max(1, doing.untilDay - doing.sinceDay);
                if (day < doing.untilDay + term * LATE_ENOUGH_TO_SAY_SO) continue;
                if (about.has(npc.id)) continue;
                stillLate++;
            }

            console.log(
                `[${seed}] internalAffairs=${notices.length}  absencePass=${byTheAbsencePass}`
                + `  people=${about.size}  stillLate=${stillLate}`
            );
        }
    }, 600_000);
});
