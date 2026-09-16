/**
 * Does somebody who joins a house after the world opens ever reach it, and do
 * they ever hold its plate?
 *
 * Per seed, at each horizon, over the people on a roll who were NOT on that roll
 * at world open (joined, or changed house):
 *
 *   joiners        alive and still on the roll they joined
 *   in compound    standing on the seat or a room inside it
 *   robed          carrying this house's robes
 *   owed a token   at a rung that carries one, in a house that can cut them
 *   hold a token   of those, carrying this house's token
 *   plate hangs    a plate for them owned by this house
 *   on the road    `travelling` to the seat right now
 *   no proof       what a doorway finds: `theHouseTheirTokenNames` is null
 *   years          join to robes, and join to token, median and p90
 *
 * And the founding roll, which must not be walked to its own gate: how many of
 * the people on a roll at world open were ever put on the road to be entered.
 *
 * ── WHAT IT SAID, SIX SEEDS, SUMMED ──────────────────────────────────────
 *
 * Both arms in one process off a temporary switch, since removed.
 *
 *                                  25 years            100 years
 *   before  joiners                980                 2178
 *           robed                    0                    0
 *           owed a token, hold       0 of 369             0 of 1278
 *           no proof at a doorway  980                 2178
 *   after   joiners                977                 2196
 *           robed                  889                 2108
 *           owed a token, hold     241 of 377          1065 of 1263
 *           plates on the wall     241                 1065
 *           on the road now         57                   55
 *           never entered, away     88                   88
 *
 * Robes in the year somebody joins at the median, a year later at p90. A token
 * a median of 3 years after joining at 25 years and 12 at 100 (p90 16 and 46),
 * which is the climb from rung 0 to the first rung that carries one rather than
 * the road. The owed-and-unheld are mostly people promoted while away on the
 * house's business, who make the trip the next year they are free.
 *
 * The founding roll: 127 and 136 made the trip by 25 and 100 years. On one seed
 * sampled, every one of them had been promoted onto the token rung since world
 * open, which is the same trip for the same reason.
 *
 * AND THE TRIP IS THERE AND BACK, checked against settlements at 80 years in
 * one process with the pass on and off: on `demography` and `afford-a/b/c` the
 * empty settlements were the same set, or one fewer, and the share on sect
 * ground moved from 21-25% to 23-26%. A one-way trip had taken the `demography`
 * seed from 557 people in settlements to 338 and emptied one.
 *
 * Run: npx tsx scripts/probe-does-a-recruit-reach-the-house.ts
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import {
    carriesATokenAt,
    theHouseTheirTokenNames,
    thisHouseCanIssue,
    tokenIdFor,
    plateIdFor
} from '../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c,roster-d,roster-e,demography').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '25,100').split(',').map(Number);
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

function inside(state: WorldState, locationId: string | null, seat: string): boolean {
    const byId = new Map(state.locations.map(l => [l.id, l]));
    let at = locationId;
    for (let hops = 0; hops <= 3 && at !== null; hops++) {
        if (at === seat) return true;
        at = byId.get(at)?.parentId ?? null;
    }
    return false;
}

function quantile(xs: number[], q: number): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.round((s.length - 1) * q))]!;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};
    const arm = 'now';
    {
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            const founding = new Map<string, string>();
            for (const n of state.npcs) if (n.status === 'alive' && n.factionId) founding.set(n.id, n.factionId);
            const tokensAtOpen = state.objects.filter(o => o.tags.includes('identity')).length;
            const joinedOn = new Map<string, number>();
            const robedOn = new Map<string, number>();
            const tokenOn = new Map<string, number>();
            const foundingSent = new Set<string>();
            let y = 0;
            for (const horizon of HORIZONS) {
                for (; y < horizon; y++) {
                    advanceWorldYears(state, 1, { stopOnInterrupt: false });
                    const objects = new Map(state.objects.map(o => [o.id, o]));
                    const robes = new Set(state.objects.filter(o => o.tags.includes('uniform') && o.possessorId).map(o => `${o.possessorId}|${o.ownerId}`));
                    for (const n of state.npcs) {
                        if (n.status !== 'alive' || !n.factionId) continue;
                        const key = `${n.id}|${n.factionId}`;
                        if (founding.get(n.id) === n.factionId) {
                            if (n.activity?.kind === 'travelling' && (n.activity.untilDay ?? null) !== null) foundingSent.add(n.id);
                            continue;
                        }
                        if (!joinedOn.has(key)) joinedOn.set(key, y);
                        if (!robedOn.has(key) && robes.has(`${n.id}|${n.factionId}`)) robedOn.set(key, y);
                        const token = objects.get(tokenIdFor(n.id));
                        if (!tokenOn.has(key) && token?.ownerId === n.factionId && token.possessorId === n.id) tokenOn.set(key, y);
                    }
                }
                const seatOf = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, f.seatLocationId]));
                const ordinals = new Map<string, number[]>();
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || !n.factionId) continue;
                    const xs = ordinals.get(n.factionId) ?? [];
                    xs.push(n.cultivation.realmOrdinal);
                    ordinals.set(n.factionId, xs);
                }
                const objects = new Map(state.objects.map(o => [o.id, o]));
                const robes = new Set(state.objects.filter(o => o.tags.includes('uniform') && o.possessorId).map(o => `${o.possessorId}|${o.ownerId}`));
                const r = {
                    tokensAtOpen,
                    termlessTravellers: state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'travelling' && (n.activity.untilDay ?? null) === null).length,
                    joiners: 0, inCompound: 0, robed: 0, owedAToken: 0, holdAToken: 0, plateHangs: 0,
                    onTheRoad: 0, noProof: 0, noProofOutside: 0, outsideNeverEntered: 0,
                    outsideNeverEnteredBusy: 0, foundingSent: foundingSent.size,
                    yearsToRobes: [] as number[], yearsToToken: [] as number[]
                };
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || !n.factionId) continue;
                    if (founding.get(n.id) === n.factionId) continue;
                    const seat = seatOf.get(n.factionId);
                    if (!seat) continue;
                    r.joiners++;
                    const here = inside(state, n.locationId, seat);
                    const robed = robes.has(`${n.id}|${n.factionId}`);
                    if (here) r.inCompound++;
                    if (robed) r.robed++;
                    const owed = carriesATokenAt(n.factionRankIndex) && thisHouseCanIssue(ordinals.get(n.factionId) ?? []);
                    const token = objects.get(tokenIdFor(n.id));
                    const holds = token?.ownerId === n.factionId && token.possessorId === n.id;
                    if (owed) { r.owedAToken++; if (holds) r.holdAToken++; }
                    if (objects.get(plateIdFor(n.id))?.ownerId === n.factionId) r.plateHangs++;
                    if (n.activity?.kind === 'travelling' && (n.activity.untilDay ?? null) !== null) r.onTheRoad++;
                    const proof = theHouseTheirTokenNames(state.objects, n.id, id => state.npcs.some(x => x.id === id && x.status === 'alive'));
                    if (proof !== n.factionId) { r.noProof++; if (!here) r.noProofOutside++; }
                    if (!here && !robed) {
                        r.outsideNeverEntered++;
                        if (n.activity !== null && (n.activity.untilDay ?? null) === null) r.outsideNeverEnteredBusy++;
                    }
                }
                for (const [key, joined] of joinedOn) {
                    const robed = robedOn.get(key);
                    if (robed !== undefined) r.yearsToRobes.push(robed - joined);
                    const token = tokenOn.get(key);
                    if (token !== undefined) r.yearsToToken.push(token - joined);
                }
                dump[`${arm}:y${horizon}:${seed}`] = r;
                console.log(
                    `${arm} ${seed} @${horizon}y joiners ${r.joiners}: in compound ${r.inCompound}, robed ${r.robed}, `
                    + `owed a token ${r.owedAToken} hold one ${r.holdAToken}, plates ${r.plateHangs}, on the road ${r.onTheRoad}, `
                    + `no proof ${r.noProof} (outside ${r.noProofOutside}), outside never entered ${r.outsideNeverEntered} `
                    + `(busy ${r.outsideNeverEnteredBusy}) | years to robes p50 ${quantile(r.yearsToRobes, 0.5)} `
                    + `p90 ${quantile(r.yearsToRobes, 0.9)} (n ${r.yearsToRobes.length}), to token p50 `
                    + `${quantile(r.yearsToToken, 0.5)} p90 ${quantile(r.yearsToToken, 0.9)} (n ${r.yearsToToken.length}) `
                    + `| founding roll sent ${r.foundingSent} | tokens at open ${tokensAtOpen} | termless travellers ${r.termlessTravellers}`
                );
            }
        }
    }
    const path = `${DIR}/recruit-reach-${OUT}.json`;
    writeFileSync(path, JSON.stringify(dump, null, 1), 'utf8');
    console.log(`wrote ${path}`);
}

void main();
