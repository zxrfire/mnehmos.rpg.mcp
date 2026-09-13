/**
 * Which OCCASIONS a house has for putting a senior on the road, and how many of
 * them ever reach one.
 *
 * The escort path asks a senior to go out with juniors, and the occasion is
 * whatever the house had on its board. So the spread of occasions is bounded by
 * `SENDING_REASONS` filtered through `NEED_PREDICATES` against the house as the
 * world actually left it - and a reason whose `needs` key nothing satisfies is
 * content nothing can reach, which is the defect this probe exists to find.
 *
 * BOTH ARMS IN ONE RUN. The "before" column is the same walk restricted to the
 * eleven reasons that existed before the visit, the competition and the
 * forbidden ground were added, so the comparison is over one tree and one world.
 *
 * Read off a freshly seeded world, which is the world a new run opens into.
 *
 *   node --loader ts-node/esm scripts/probe-what-occasions-a-house-can-offer.ts
 *   PROBE_SEEDS=a,b,c node --loader ts-node/esm scripts/...
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { circleCandidatesFor } from '../src/engine/world/gatherings.js';
import {
    aFindThisHouseCouldSendFor,
    forbiddenGroundInTheProvinceOf,
    whatStandingOnItGives,
    whereTheOpenGroundIs,
    type WhereTheOpenGroundIs,
    reasonsOpenTo,
    ALLIED_STANDING,
    RIVAL_STANDING,
    type HouseAsItStands
} from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { SENDING_REASONS } from '../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { whatAHouseWouldSendYouOn } from '../src/engine/encounters/duties.js';
import { theReasonBehind } from '../src/engine/encounters/what-a-house-has-on-its-board.js';
import { whoASeniorIsAskedToTakeOut } from '../src/engine/encounters/who-a-senior-is-asked-to-take-out.js';
import type { Membership } from '../src/engine/encounters/types.js';
import type { WorldState, FactionRecord } from '../src/engine/world/world-state.js';
import type { KnowingStage } from '../src/engine/social/discovery.js';

/** The eleven that existed before this change. The control arm. */
const BEFORE = new Set([
    'sending-for-materials',
    'sending-to-stand-to',
    'sending-to-recruit',
    'sending-an-escort',
    'sending-to-collect-tribute',
    'sending-to-open-an-inheritance',
    'sending-to-answer-a-call',
    'sending-to-a-marriage',
    'sending-after-a-quiet-subsidiary',
    'sending-to-dispel-a-leak',
    'sending-to-a-war'
]);

function line(s = ''): void {
    process.stdout.write(s + '\n');
}

interface Counts {
    /** Houses where the reason is open at all. */
    open: number;
    /** Seniors the reason was put to as an ask. */
    offered: number;
    /** Seniors it reached with named juniors on it: the escort. */
    escort: number;
}

function emptyCounts(): Map<string, Counts> {
    return new Map(SENDING_REASONS.map(r => [r.id, { open: 0, offered: 0, escort: 0 }]));
}

/**
 * The house as `src/web/encounters.ts` builds it, plus the two columns the
 * world can answer and a catalog cannot.
 */
function houseAsItStands(
    state: WorldState,
    faction: FactionRecord,
    openGround: WhereTheOpenGroundIs,
    standingOnIt: (holderId: string, locationId: string) => KnowingStage
): HouseAsItStands {
    return {
        id: faction.id,
        name: faction.name,
        holdsGround: faction.controlledLocationIds.length > 0,
        standing: faction.standing,
        hasAFind: aFindThisHouseCouldSendFor({
            ground: openGround,
            seatLocationId: faction.seatLocationId,
            roll: state.npcs
                .filter(npc => npc.factionId === faction.id && npc.status === 'alive')
                .map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
            rankCount: faction.ranks.length,
            stageFor: standingOnIt
        }) !== null,
        sitsDownWith: circleCandidatesFor(state, faction).map(f => f.id),
        standsNearForbiddenGround:
            forbiddenGroundInTheProvinceOf(state.locations, faction.seatLocationId)
    };
}

interface WorldReading {
    houses: number;
    seniors: number;
    counts: Map<string, Counts>;
    /** Raw world facts the predicates read, for when a count is zero. */
    forbiddenZones: number;
    housesWithACircle: number;
    housesWithAnAlly: number;
    housesWithARival: number;
}

function readOneWorld(state: WorldState): WorldReading {
    const counts = emptyCounts();
    // Both built once for the whole walk. The reading is per house per ruin,
    // and each half of it walks something long.
    const standingOnIt = whatStandingOnItGives(state.history.facts);
    const openGround = whereTheOpenGroundIs(state.locations);
    const roll = new Map<string, { id: string; name: string; rankIndex: number; realmOrdinal: number }[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null || !isBelowTheLid(npc)) continue;
        const row = {
            id: npc.id,
            name: npc.name,
            rankIndex: Math.max(0, npc.factionRankIndex),
            realmOrdinal: npc.cultivation.realmOrdinal
        };
        const bucket = roll.get(npc.factionId);
        if (bucket) bucket.push(row); else roll.set(npc.factionId, [row]);
    }

    let houses = 0;
    let seniors = 0;
    let housesWithACircle = 0;
    let housesWithAnAlly = 0;
    let housesWithARival = 0;

    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const roster = (roll.get(faction.id) ?? [])
            .slice()
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal || (a.id < b.id ? -1 : 1));
        if (roster.length < 2) continue;
        houses++;

        const house = houseAsItStands(state, faction, openGround, standingOnIt);
        if ((house.sitsDownWith?.length ?? 0) > 0) housesWithACircle++;
        if (Object.values(faction.standing).some(v => v >= ALLIED_STANDING)) housesWithAnAlly++;
        if (Object.values(faction.standing).some(v => v <= RIVAL_STANDING)) housesWithARival++;

        for (const reason of reasonsOpenTo(house)) {
            counts.get(reason.id)!.open++;
        }

        const senior = roster[0]!;
        const rest = roster.slice(1);
        const reachOfTheRest = rest.reduce((n, p) => Math.max(n, p.realmOrdinal), 0);
        const reach = Math.max(reachOfTheRest, senior.realmOrdinal);
        const membership: Membership = {
            factionId: faction.id,
            factionName: faction.name,
            rankIndex: senior.rankIndex,
            rankCount: Math.max(2, faction.ranks.length),
            contribution: 0
        };
        seniors++;

        for (const candidate of whatAHouseWouldSendYouOn({
            ordinal: senior.realmOrdinal,
            membership,
            house,
            reachOfTheHouse: reach,
            reachOfTheRest,
            givenBy: { rankIndex: membership.rankCount - 1, isHead: true }
        })) {
            const reason = theReasonBehind(candidate.entry.id);
            if (!reason) continue;
            const row = counts.get(reason.id);
            if (!row) continue;
            row.offered++;
            if (candidate.terms.pitchOrdinal >= senior.realmOrdinal) continue;
            const party = whoASeniorIsAskedToTakeOut({
                pitchOrdinal: candidate.terms.pitchOrdinal,
                hands: reason.hands,
                roster,
                seniorId: senior.id,
                seniorOrdinal: senior.realmOrdinal
            });
            if (party.length > 0) row.escort++;
        }
    }

    return {
        houses,
        seniors,
        counts,
        forbiddenZones: state.locations.filter(l => l.kind === 'forbidden_zone' && isBelowTheLid(l)).length,
        housesWithACircle,
        housesWithAnAlly,
        housesWithARival
    };
}

const YEAR = 365;

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = process.env.PROBE_SEEDS?.split(',')
        ?? Array.from({ length: 12 }, (_, i) => `occasion-${i}`);
    // A run opens on a freshly seeded world, and a saved world is one somebody
    // has already lived in. Both are read, because one occasion's availability
    // is a property of world time rather than of any house.
    const horizons = (process.env.PROBE_YEARS?.split(',') ?? ['0', '200']).map(Number);

    for (const years of horizons) await oneHorizon(catalog, seeds, years);
}

async function oneHorizon(
    catalog: Awaited<ReturnType<typeof loadCultivationCatalog>>,
    seeds: readonly string[],
    years: number
): Promise<void> {
    const total = emptyCounts();
    let houses = 0;
    let seniors = 0;
    let forbiddenZones = 0;
    let withCircle = 0;
    let withAlly = 0;
    let withRival = 0;

    for (const seed of seeds) {
        const { state } = seedWorld({ seed, catalog, population: 250 });
        if (years > 0) {
            const from = state.currentDay;
            applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        }
        const reading = readOneWorld(state);
        houses += reading.houses;
        seniors += reading.seniors;
        forbiddenZones += reading.forbiddenZones;
        withCircle += reading.housesWithACircle;
        withAlly += reading.housesWithAnAlly;
        withRival += reading.housesWithARival;
        for (const [id, row] of reading.counts) {
            const into = total.get(id)!;
            into.open += row.open;
            into.offered += row.offered;
            into.escort += row.escort;
        }
    }

    line();
    line(`WHAT OCCASIONS A HOUSE CAN OFFER   ${seeds.length} pinned worlds, ${years} years in`);
    line(`${houses} houses with a roll of two or more, ${seniors} seniors asked`);
    line();
    line('reason                                    needs               open   offered   escort');
    for (const reason of SENDING_REASONS) {
        const row = total.get(reason.id)!;
        line(
            `${(BEFORE.has(reason.id) ? '  ' : '+ ') + reason.id.padEnd(40)}`
            + `${reason.needs.padEnd(18)}`
            + `${String(row.open).padStart(6)}`
            + `${String(row.offered).padStart(10)}`
            + `${String(row.escort).padStart(9)}`
        );
    }
    line();

    const arm = (only: (id: string) => boolean): { open: number; offered: number; escort: number; kinds: number } => {
        let open = 0; let offered = 0; let escort = 0; let kinds = 0;
        for (const [id, row] of total) {
            if (!only(id)) continue;
            open += row.open; offered += row.offered; escort += row.escort;
            if (row.escort > 0) kinds++;
        }
        return { open, offered, escort, kinds };
    };
    const before = arm(id => BEFORE.has(id));
    const after = arm(() => true);
    line('                     open   offered   escort   occasions that ever escort');
    line(`before  ${String(before.open).padStart(13)}${String(before.offered).padStart(10)}`
        + `${String(before.escort).padStart(9)}${String(before.kinds).padStart(29)}`);
    line(`after   ${String(after.open).padStart(13)}${String(after.offered).padStart(10)}`
        + `${String(after.escort).padStart(9)}${String(after.kinds).padStart(29)}`);
    line();
    line('what the predicates are reading:');
    line(`  forbidden zones below the lid, summed over worlds: ${forbiddenZones}`);
    line(`  houses with somebody to sit down with:             ${withCircle} of ${houses}`);
    line(`  houses with an ally:                               ${withAlly} of ${houses}`);
    line(`  houses with a rival:                               ${withRival} of ${houses}`);
}

void main();
