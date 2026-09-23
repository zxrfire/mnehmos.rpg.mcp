/**
 * Who runs Internal Affairs in each house, and how many serve under one.
 *
 * The design owner: *"the internal affairs elder crafts them, or his disciples
 * who work in internal affairs - probably his disciples craft them for
 * disciples, the elder crafts them for elders."* Two thirds of that rule had
 * nowhere to land: `theInternalAffairsElderIn` carried a header saying it
 * answers null in every house, and `theDisciplesPostedToInternalAffairs`
 * returns nobody by construction.
 *
 * This measures the first half before anything is built, because the header and
 * the doc disagree: `offices-and-succession.md` says the life lamp hall is one
 * of the two offices without locks and that Internal Affairs was dealt in the
 * second round, and `architecture.ts` does carry `office: true` on it.
 *
 * What it reports, at world open and at each horizon:
 *
 *   seated          live houses with a seat
 *   with the hall   those whose compound holds a life lamp hall at all
 *   held            those where somebody answers about it (`whoAnswersAbout`)
 *   acting          those where the holder is covering it from another room
 *   under it        people `theDisciplesPostedToInternalAffairs` names
 *   at the hall     of the holders, how many are standing at their own seat,
 *                   which is what the reads that need one actually ask
 *
 * Run: npx tsx scripts/probe-who-runs-internal-affairs.ts
 *   PROBE_SEEDS   comma-separated world seeds
 *   PROBE_YEARS   horizons to report at
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { portfoliosIn } from '../src/engine/social-leverage/authority-for-an-order.js';
import { whoAnswersAbout } from '../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import { theRoomsThisHouseHas } from '../src/engine/social-leverage/authority-for-an-order.js';
import { THE_ROOM_THE_ROLL_IS_KEPT_IN } from '../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { theDisciplesPostedToInternalAffairs } from '../src/engine/world/what-a-house-hears-from-its-people-away.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'shape-a,shape-b').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '500').split(',').map(Number);

interface Reading {
    seated: number;
    withTheHall: number;
    held: number;
    acting: number;
    atTheHall: number;
    underIt: number;
}

function read(state: WorldState): Reading {
    const out: Reading = { seated: 0, withTheHall: 0, held: 0, acting: 0, atTheHall: 0, underIt: 0 };
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || house.seatLocationId === null) continue;
        out.seated++;
        if (!theRoomsThisHouseHas(state.locations, house.id).includes(THE_ROOM_THE_ROLL_IS_KEPT_IN)) continue;
        out.withTheHall++;
        const roll = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id)
            .map(n => ({ id: n.id, rankIndex: n.factionRankIndex }));
        const portfolios = portfoliosIn({
            locations: state.locations, sectId: house.id, roll, rankCount: house.ranks.length
        });
        const holderId = whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN);
        const row = portfolios.find(p => p.purpose === THE_ROOM_THE_ROLL_IS_KEPT_IN);
        if (holderId !== null) {
            out.held++;
            const who = state.npcs.find(n => n.id === holderId);
            if (who?.locationId === house.seatLocationId) out.atTheHall++;
        } else if (row?.actingId) {
            out.acting++;
        }
        out.underIt += theDisciplesPostedToInternalAffairs(state, house.id).length;
    }
    return out;
}

const say = (label: string, r: Reading): void => {
    console.log(
        `${label.padEnd(14)} seated ${String(r.seated).padStart(3)}  with the hall ${String(r.withTheHall).padStart(3)}`
        + `  held ${String(r.held).padStart(3)}  acting ${String(r.acting).padStart(3)}`
        + `  at the hall ${String(r.atTheHall).padStart(3)}  under it ${String(r.underIt).padStart(3)}`
    );
};

const catalog = await loadCultivationCatalog();
for (const seed of SEEDS) {
    console.log(`\n── ${seed} ──`);
    const { state } = seedWorld({ seed, catalog });
    say('world open', read(state));
    let at = 0;
    for (const years of HORIZONS) {
        advanceWorldYears(state, years - at, { stopOnInterrupt: false });
        at = years;
        say(`${years} years`, read(state));
    }
}
