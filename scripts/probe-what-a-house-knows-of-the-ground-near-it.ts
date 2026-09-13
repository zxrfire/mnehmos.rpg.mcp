/**
 * What a house knows of the ground near it, and what knowing it would cost to store.
 *
 * Two questions in one sweep, because the answer to the second decides the shape
 * of the first.
 *
 * HOW MUCH IT WOULD COST TO STORE. Nothing anywhere writes a `knowledge_records`
 * row for a world NPC. The two counts below are what a writer would produce -
 * one row per person per FACT they were present at, and the same collapsed to
 * one per person per PLACE - and both are roughly linear in the world's age.
 *
 * WHAT THE READINGS ACTUALLY MOVE. The control arms run in this process, on this
 * world, so neither is a second tree:
 *
 *   standing-there alone   `whatStandingOnItGives` on its own, which is what the
 *                          world sim had before the other two existed.
 *   sendings at the seat   every sending row put back at its own house's seat,
 *                          which is where `applySendings` used to site them.
 *
 *   npx esbuild scripts/probe-what-a-house-knows-of-the-ground-near-it.ts  *       --bundle --platform=node --format=esm --external:better-sqlite3  *       --outfile=probe.mjs && node probe.mjs
 *
 * SEEDS and YEARS override the defaults (alpha,bravo,charlie and 200).
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import {
    whereTheOpenGroundIs,
    whatStandingOnItGives,
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatTheAirCarriesOfTheGround,
    aFindThisHouseCouldSendFor
} from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import {
    isInTheAirFor,
    regionOf,
    whereThisPersonIsStanding,
    type TellerStanding
} from '../src/engine/world/what-people-are-saying.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function line(s = ''): void { process.stdout.write(s + '\n'); }

function report(state: WorldState, label: string): void {
    const npcIds = new Set(state.npcs.map(n => n.id));
    const facts = state.history.facts;

    let perFactRows = 0;
    let sited = 0;
    const placePairs = new Set<string>();
    const factPairs = new Set<string>();
    for (const f of facts) {
        const here = new Set<string>();
        for (const a of f.actors) if (npcIds.has(a.id)) here.add(a.id);
        for (const w of f.witnessIds) if (npcIds.has(w)) here.add(w);
        perFactRows += here.size;
        for (const id of here) factPairs.add(`${id}|${f.id}`);
        if (f.locationId !== null) {
            sited++;
            for (const id of here) placePairs.add(`${id}|${f.locationId}`);
        }
    }

    const roll = new Map<string, { id: string; rankIndex: number }[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const b = roll.get(npc.factionId);
        const row = { id: npc.id, rankIndex: npc.factionRankIndex };
        if (b) b.push(row); else roll.set(npc.factionId, [row]);
    }

    // ── THE CONTROL ARM, IN THIS RUN, ON THIS WORLD ──────────────────────
    // A sending is identifiable off its own actor roles. Putting every sending
    // fact back at the sending house's seat reproduces exactly what the ledger
    // held before the re-siting, over the same world, so the two arms cannot be
    // two different trees.
    const seatOf = new Map(state.factions
        .filter(f => f.seatLocationId !== null)
        .map(f => [f.id, f.seatLocationId as string]));
    const isSending = (f: typeof facts[number]) =>
        f.actors.some(a => a.role === 'sent' || a.role === 'lost');
    let sendingFacts = 0;
    let sendingsOffSeat = 0;
    const asBefore = facts.map(f => {
        if (!isSending(f)) return f;
        sendingFacts++;
        const seat = f.factionIds.length > 0 ? seatOf.get(f.factionIds[0]) ?? null : null;
        if (f.locationId !== seat) sendingsOffSeat++;
        return { ...f, locationId: seat };
    });

    const ground = whereTheOpenGroundIs(state.locations);
    const standingOnIt = whatStandingOnItGives(facts);
    const standingOnItBefore = whatStandingOnItGives(asBefore);
    const cameBack = whatAHousesOwnErrandsBringBack(facts);
    const noErrands = () => 'unaware' as const;
    const day = Math.floor(state.currentDay);
    const region = new Map<string | null, string | null>();
    const regionFor = (id: string | null): string | null => {
        const had = region.get(id);
        if (had !== undefined) return had;
        const found = regionOf(state, id);
        region.set(id, found);
        return found;
    };
    const tellers = new Map<string, TellerStanding | null>();
    const tellerAt = (holderId: string): TellerStanding | null => {
        const had = tellers.get(holderId);
        if (had !== undefined) return had;
        const npc = state.npcs.find(n => n.id === holderId) ?? null;
        const built = npc ? whereThisPersonIsStanding(state, npc, regionFor) : null;
        tellers.set(holderId, built);
        return built;
    };
    const theAir = whatTheAirCarriesOfTheGround({
        facts,
        inTheAirFor: (fact, holderId) => {
            const teller = tellerAt(holderId);
            return teller !== null && isInTheAirFor(state, fact, teller, day);
        }
    });
    const knowsTheGround = whatAnybodyCouldHaveOfTheGround(standingOnIt, theAir);
    let houses = 0;
    let houseHasGroundNearby = 0;
    let houseCanPoint = 0;
    let houseCanPointWithoutErrands = 0;
    let houseAnybody = 0;
    let houseAnybodyBefore = 0;
    let houseCanPointBefore = 0;
    let errandRows = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        houses++;
        const province = ground.provinceOf(faction.seatLocationId);
        if (province !== null && ground.openGroundIn(province).length > 0) houseHasGroundNearby++;
        const ask = (
            errands: (f: string, l: string) => ReturnType<typeof standingOnIt>,
            stageFor: typeof standingOnIt
        ) =>
            aFindThisHouseCouldSendFor({
                ground,
                houseId: faction.id,
                seatLocationId: faction.seatLocationId,
                roll: roll.get(faction.id) ?? [],
                rankCount: faction.ranks.length,
                stageFor,
                errands
            });
        if (ask(cameBack, knowsTheGround) !== null) houseCanPoint++;
        if (ask(noErrands, standingOnIt) !== null) houseCanPointWithoutErrands++;
        if (ask(noErrands, standingOnItBefore) !== null) houseCanPointBefore++;
        if (province !== null) {
            for (const g of ground.openGroundIn(province)) {
                if (cameBack(faction.id, g.id) !== 'unaware') errandRows++;
            }
        }
        // anybody-on-the-roll version, for the gap between porter and elder
        if (province !== null) {
            const mine = roll.get(faction.id) ?? [];
            const near = ground.openGroundIn(province);
            if (near.some(g => mine.some(p => standingOnIt(p.id, g.id) !== 'unaware'))) houseAnybody++;
            if (near.some(g => mine.some(p => standingOnItBefore(p.id, g.id) !== 'unaware'))) {
                houseAnybodyBefore++;
            }
        }
    }

    line(`${label}`);
    line(`  npcs ${state.npcs.length} (alive ${state.npcs.filter(n => n.status === 'alive').length})`);
    line(`  locations ${state.locations.length}  ruins ${state.locations.filter(l => l.kind === 'ruin').length}`
        + `  unsealed ${state.locations.filter(l => l.kind === 'ruin' && !l.sealed).length}`);
    line(`  facts ${facts.length}  sited ${sited}`);
    line(`  rows if one per person per fact         ${perFactRows} (distinct ${factPairs.size})`);
    line(`  rows if one per person per PLACE        ${placePairs.size}`);
    line(`  houses ${houses}`);
    line(`    with open ground in own province      ${houseHasGroundNearby}`);
    line(`    whose ANYBODY has stood on some of it ${houseAnybody}`
        + `   (sendings back at the seat: ${houseAnybodyBefore})`);
    line(`    whose DECIDERS can point at it        ${houseCanPoint}`
        + `   (standing-there alone: ${houseCanPointWithoutErrands})`);
    line(`    whose DECIDERS could, sendings at seat ${houseCanPointBefore}`);
    line(`  house/ground pairs an errand reported  ${errandRows}`);
    line(`  sending facts ${sendingFacts}, sited away from their own seat ${sendingsOffSeat}`);

    const ruins = new Set(state.locations.filter(l => l.kind === 'ruin').map(l => l.id));
    const byKind = new Map<string, number>();
    const atRuinByKind = new Map<string, number>();
    const seats = new Set(state.factions.map(f => f.seatLocationId).filter(Boolean) as string[]);
    let atSeat = 0;
    for (const f of facts) {
        byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
        if (f.locationId && ruins.has(f.locationId)) {
            atRuinByKind.set(f.kind, (atRuinByKind.get(f.kind) ?? 0) + 1);
        }
        if (f.locationId && seats.has(f.locationId)) atSeat++;
    }
    line(`  facts sited at a ruin: ${[...atRuinByKind].map(([k, n]) => `${k}=${n}`).join(' ') || 'none'}`);
    line(`  facts sited at a house seat: ${atSeat}`);
    line(`  top fact kinds: ${[...byKind].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([k, n]) => `${k}=${n}`).join(' ')}`);
    line();
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const years = Number(process.env.YEARS ?? 200);
    for (const seed of (process.env.SEEDS ?? 'alpha,bravo,charlie').split(',')) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        report(state, `SEED ${seed} :: day 0`);
        const from = state.currentDay;
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        report(state, `SEED ${seed} :: ${years} years`);
    }
}

void main();
