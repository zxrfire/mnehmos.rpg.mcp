/**
 * Who sees a promotion, and how far the news of one goes.
 *
 * Two questions, and the engine had two different answers to the first and no
 * answer at all to the second:
 *
 *   HOW FAR THE NEWS WENT   `scale` on the ledger row. Derived twice, from two
 *                           different things, by the two paths a crossing can
 *                           take - so a player and an NPC crossing the same
 *                           wall filed different rows.
 *   WHO WAS THERE           `witnessIds`. Drawn from the one `locationId` and
 *                           capped at six, at every rung, so the courtyard and
 *                           the province saw the same number of people.
 *
 * Run:  npx tsx scripts/probe-who-sees-a-crossing.ts
 */

import { REALM_TIERS, rankName } from '../src/engine/cultivation/realms.js';
import { howFarACrossingCarries } from '../src/engine/world/a-crossing-enters-the-world-as-news.js';
import { howFarASeeingReaches, whoCouldHaveSeenIt } from '../src/engine/world/how-far-a-seeing-reaches.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { regionOf } from '../src/engine/world/what-people-are-saying.js';
import { whoWasThere } from '../src/engine/world/who-was-there-when-it-happened.js';
import type { EventScale } from '../src/engine/world/history.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(78)); line('  ' + t); line('='.repeat(78)); };

/**
 * The scale `recordCrossing` filed before this work, kept verbatim so the
 * before column is the code that ran rather than a memory of it.
 */
const FALSE_IMMORTAL_ORDINAL = 45;
function theOldNpcScale(ordinal: number): EventScale {
    return ordinal >= FALSE_IMMORTAL_ORDINAL
        ? 'world'
        : ordinal >= 34 ? 'continental' : ordinal >= 20 ? 'regional' : 'local';
}

async function main(): Promise<void> {
    rule('WHAT SCALE A CROSSING FILES AT, PER REALM');
    line();
    line('  arriving in                       player path   NPC path (was)   agree?');
    line('  ' + '-'.repeat(74));
    let disagreements = 0;
    for (let at = 1; at < REALM_TIERS.length; at++) {
        const realm = REALM_TIERS[at];
        const from = REALM_TIERS[at - 1].ordinalEnd;
        const to = realm.ordinalStart;
        const player = howFarACrossingCarries(from, to);
        const npcWas = theOldNpcScale(to);
        const agree = player?.scale === npcWas;
        if (!agree) disagreements++;
        line(
            '  ' + `${realm.name} (${rankName(to)})`.padEnd(34)
            + (player?.scale ?? 'null').padEnd(14)
            + npcWas.padEnd(17)
            + (agree ? 'yes' : 'NO')
        );
    }
    line();
    line(`  ${disagreements} of ${REALM_TIERS.length - 1} realms filed two different scales.`);

    rule('HOW FAR "THERE" REACHES, PER SCALE');
    line();
    for (const scale of ['personal', 'local', 'regional', 'continental', 'world'] as const) {
        line(`  ${scale.padEnd(14)} ${howFarASeeingReaches(scale)}`);
    }

    rule('HOW MANY PEOPLE ARE IN THE AREA TO SEE ONE, AT EACH RUNG');
    const seeded = seedWorld({ seed: 'probe-who-sees-a-crossing', catalog: await loadCultivationCatalog() });
    const state = seeded.state;
    const day = state.currentDay;

    // The place with the most people standing in it, so the figures are not a
    // report about an empty crossroads.
    const heads = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.locationId === null) continue;
        heads.set(npc.locationId, (heads.get(npc.locationId) ?? 0) + 1);
    }
    let where = '';
    let most = -1;
    for (const [id, n] of heads) if (n > most) { most = n; where = id; }
    const region = regionOf(state, where);
    const alive = state.npcs.filter(n => n.status === 'alive').length;
    const inRegion = state.npcs.filter(n =>
        n.status === 'alive' && regionOf(state, n.locationId) === region).length;

    line();
    line(`  world ${seeded.stats.locations} locations, ${alive} alive`);
    line(`  the place    ${where}`);
    line(`  standing in it        ${most}`);
    line(`  in its region         ${inRegion}`);
    line(`  alive anywhere        ${alive}`);
    line();
    line('  arriving in                    scale         named   could have seen it');
    line('  ' + '-'.repeat(74));
    for (let at = 1; at < REALM_TIERS.length; at++) {
        const realm = REALM_TIERS[at];
        const from = REALM_TIERS[at - 1].ordinalEnd;
        const to = realm.ordinalStart;
        const worth = howFarACrossingCarries(from, to);
        if (!worth) continue;
        const named = whoWasThere(state, {
            day,
            locationId: where,
            actorIds: [],
            visibility: 'public',
            scale: worth.scale
        });
        const couldSee = state.npcs.filter(n =>
            n.status === 'alive' && whoCouldHaveSeenIt(state, {
                scale: worth.scale,
                locationId: where,
                whoWasStandingAt: n.locationId
            })).length;
        line(
            '  ' + `${realm.name}`.padEnd(31)
            + worth.scale.padEnd(14)
            + String(named.length).padEnd(8)
            + String(couldSee)
        );
    }
    line();
}

main().catch(err => { console.error(err); process.exitCode = 1; });
