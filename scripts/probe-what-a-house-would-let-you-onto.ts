/**
 * Whether dao ground a house holds can be reached, before and after it had an
 * access kind.
 *
 * The affordance probe measures this as one row among five and takes about a
 * hundred minutes, because most of its cost is replaying every affordance
 * sentence at the engine. This reads the same thing the affordance probe reads
 * for `kind: 'road'` - `groundTheyCanPointAt`, scored on `shortBy === null` -
 * and nothing else, so it runs in a couple of minutes.
 *
 * BOTH ARMS RUN IN ONE COMMAND. `AGENTS.md` is explicit that a stash-and-rerun
 * is not a control arm, and the old rule is exactly recoverable here: before the
 * access kind existed, held ground answered any non-member `not_of_the_house`
 * without reading anything else, which is what the rule still does for a row
 * that admits `its own`. So the control arm is the same arranged state read with
 * every held ground forced to `its own`, computed in the same process off the
 * same world.
 *
 *   npx tsx scripts/probe-what-a-house-would-let-you-onto.ts
 */

import { REGISTER_BANDS, type RegisterBand } from '../src/web/prompt.js';
import { PLACES, WORLDS } from './probe-is-there-enough-to-do-and-can-it-be-reached.js';
import { floorOf } from './probe-what-a-refusal-is-still-for.js';
import { resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { situatedReads } from '../src/web/situated-reads.js';
import { makeGameInWorld } from '../tests/web/harness.js';

interface Tally {
    offered: number;
    reachable: number;
    by: Map<string, number>;
}

const empty = (): Tally => ({ offered: 0, reachable: 0, by: new Map() });

function note(tally: Tally, shortBy: string | null): void {
    tally.offered += 1;
    if (shortBy === null) tally.reachable += 1;
    else tally.by.set(shortBy, (tally.by.get(shortBy) ?? 0) + 1);
}

async function run(): Promise<void> {
    const now = new Map<RegisterBand, Tally>();
    const before = new Map<RegisterBand, Tally>();
    for (const band of REGISTER_BANDS) {
        now.set(band, empty());
        before.set(band, empty());
    }

    const wasAdmin = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        for (const worldSeed of WORLDS) {
            for (const band of REGISTER_BANDS) {
                const ordinal = floorOf(band);
                const harness = await makeGameInWorld({
                    seed: `${worldSeed}-${band}`, worldSeed, adminMode: true
                });
                await harness.game.newRun('Prober');
                for (const line of [
                    `ADMIN set_realm ordinal=${ordinal}`,
                    'ADMIN grant_knowledge kind=place'
                ]) {
                    try { await harness.game.act(line); } catch { /* a refusal is a state */ }
                }

                for (const place of PLACES) {
                    for (const line of [`ADMIN set_location ${place.name}`, 'look']) {
                        try { await harness.game.act(line); } catch { /* still a state */ }
                    }
                    const game = harness.game as never;
                    const { cultivator } = (harness.game as unknown as {
                        currentRun(): { cultivator: { sectId: string | null } };
                    }).currentRun();
                    for (const row of situatedReads.groundTheyCanPointAt.call(
                        game, cultivator as never
                    )) {
                        note(now.get(band)!, row.standing.shortBy);
                        // THE CONTROL ARM, exactly. Before the access kind
                        // existed, held ground answered any non-member
                        // `not_of_the_house` and read nothing else; for a member
                        // the rule is unchanged, so their row carries over.
                        const ofTheHouse = cultivator.sectId !== null
                            && cultivator.sectId === row.ground.heldByFactionId;
                        note(before.get(band)!,
                            row.ground.access === 'held' && !ofTheHouse
                                ? 'not_of_the_house'
                                : row.standing.shortBy);
                    }
                }
                resetCultivationWorlds();
            }
        }
    } finally {
        if (wasAdmin === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = wasAdmin;
    }

    const pct = (t: Tally) => t.offered === 0
        ? '  none offered'
        : `${((100 * t.reachable) / t.offered).toFixed(1)}% of ${t.offered}`;

    console.log('\nDAO GROUND WITHIN REACH, by band');
    for (const band of REGISTER_BANDS) {
        console.log(`  ${band.padEnd(22)} before ${pct(before.get(band)!).padEnd(18)}`
            + `after ${pct(now.get(band)!)}`);
    }
    console.log('\nWHAT THE REFUSAL SAID');
    for (const [label, table] of [['before', before], ['after', now]] as const) {
        const pooled = new Map<string, number>();
        for (const band of REGISTER_BANDS) {
            for (const [reason, count] of table.get(band)!.by) {
                pooled.set(reason, (pooled.get(reason) ?? 0) + count);
            }
        }
        console.log(`  ${label}: ${[...pooled].sort((a, b) => b[1] - a[1])
            .map(([r, c]) => `${r} ${c}`).join(', ')}`);
    }
}

void run();
