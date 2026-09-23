/**
 * Do cultivators stay in their houses, leave on their own clock, and does the map
 * still move?
 *
 * The arms were taken in one process off temporary switches, since removed; the
 * figures are in `being-held-back-in-a-house.ts`, `why-somebody-walks-out-of-a-compound.ts`
 * and `who-splits-a-house-and-who-goes-with-them.ts`. Per seed, at each horizon:
 *
 *   departures     people who left a live roll (walked out, or went with a
 *                  splinter), per century, by the rung they left from
 *   ever moved     of everybody seen on a roll, the share ever on a second one,
 *                  and by the rung they left their first house from
 *   splinters      `faction_founded` facts per century, and live splinters now
 *   houses         live houses; catalog houses (live at year 0) still standing,
 *                  by alignment and by `bloodline` governance
 *   distinct       per catalog house kind: the share of its living members never
 *                  seen on another roll, and how many arts taught by other houses
 *                  and not by this one its members carry on average
 *   stir           senior departures (news over `WORTH_REPEATING`) and the ties
 *                  each cooled
 *   top            living people below the Lid above 29 / 35 / 41, at 44, max;
 *                  the Court's Seats at the Court; Lu Sheng's row, his lectures
 *                  and his inheritors, and how many rungs they have climbed
 *   loyalty        what leaving would cost the living members of each rung
 *                  (`whatLeavingTheirHouseCosts`), mean and spread
 *   towns          towns and cities with nobody in them; people on region nodes
 *
 * Run: npx tsx scripts/probe-do-cultivators-leave-on-their-own-clock.ts
 *   PROBE_PLAN  arm@seed:horizon,horizon;...   PROBE_OUT
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { whoseArt } from '../src/engine/world/manuals.js';
import { npcsAt } from '../src/engine/world/world-state.js';
import { WORTH_REPEATING } from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { INHERITOR_OF } from '../src/engine/world/the-wanderer-the-catalog-names-is-somebody.js';
import { whatLeavingTheirHouseCosts } from '../src/engine/world/why-somebody-walks-out-of-a-compound.js';
import { lifespanForOrdinal } from '../src/engine/cultivation/realms.js';

const PLAN = (process.env.PROBE_PLAN ?? 'old@shape-a:500;now@shape-a:500').split(';').map(part => {
    const [armSeed, horizons] = part.split(':');
    const [arm, seed] = armSeed!.split('@');
    return { arm: arm!, seed: seed!, horizons: horizons!.split(',').map(Number) };
});
const OUT = process.env.PROBE_OUT ?? 'stay';
const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';
const LOG = `${DIR}/probe-${OUT}.log`;

type Where = 'r0' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5+';
const where = (rank: number): Where => (rank >= 5 ? 'r5+' : `r${Math.max(0, rank)}`) as Where;
const kindOf = (f: { alignment: string; tags: string[] }) => (f.tags.includes('bloodline') ? 'bloodline' : f.alignment);

function say(line: string): void {
    console.log(line);
    appendFileSync(LOG, `${line}\n`, 'utf8');
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    writeFileSync(LOG, '', 'utf8');
    const dump: Record<string, unknown> = {};
    for (const { arm, seed, horizons } of PLAN) {
        // THE ARMS ARE GONE WITH THE SWITCHES. The three temporary switches this
        // probe drove - the old departures, whether the wanderer is seeded, and
        // whether people on no roll move on - have been removed now that the
        // measurement is taken, so every arm runs the world as it is.
        const started = Date.now();
        const { state } = seedWorld({ seed, catalog });
        const catalogHouses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, kindOf(f)] as const));
        const housesEver = new Map<string, Set<string>>();
        const leftFrom = new Map<string, number>();
        const stoodAt: Record<Where, Set<string>> = { r0: new Set(), r1: new Set(), r2: new Set(), r3: new Set(), r4: new Set(), 'r5+': new Set() };
        const departures: Record<Where, number> = { r0: 0, r1: 0, r2: 0, r3: 0, r4: 0, 'r5+': 0 };
        let splinters = 0, seniorLeavings = 0, tiesCooled = 0, lectures = 0;
        const whyTheyWent: Record<string, number> = {};
        const byRoute: Record<string, number> = {};
        const transferredFrom = new Map<string, number>();
        const inheritorStart = new Map<string, number>();
        const seen = new Set(state.history.facts.map(f => f.id));
        const note = () => {
            for (const n of state.npcs) {
                if (n.factionId === null || n.status !== 'alive') continue;
                const set = housesEver.get(n.id) ?? new Set<string>();
                set.add(n.factionId);
                housesEver.set(n.id, set);
                stoodAt[where(n.factionRankIndex)].add(n.id);
            }
        };
        note();
        let y = 0;
        for (const horizon of horizons) {
            for (; y < horizon; y++) {
                const before = new Map(state.npcs
                    .filter(n => n.status === 'alive' && n.factionId !== null)
                    .map(n => [n.id, { house: n.factionId!, rank: n.factionRankIndex, tags: n.tags.length }] as const));
                advanceWorldYears(state, 1, { stopOnInterrupt: false });
                for (const f of state.history.facts) {
                    if (seen.has(f.id)) continue;
                    seen.add(f.id);
                    if (f.kind === 'faction_founded') splinters++;
                    if (f.data?.walkedOut === true) {
                        for (const why of String(f.data.why ?? 'unsaid').split('; ')) {
                            whyTheyWent[why] = (whyTheyWent[why] ?? 0) + 1;
                        }
                    }
                    if (f.data?.walkedOut === true && f.magnitude > WORTH_REPEATING) {
                        seniorLeavings++;
                        tiesCooled += Number(f.data.tiesCooled ?? 0);
                    }
                }
                const lu = state.npcs.find(n => n.name === 'Lu Sheng');
                if (lu?.activity?.kind === 'teaching' && lu.activity.sinceDay >= state.currentDay - 365
                    && lu.activity.withIds.some(id => id.includes('seat'))) lectures++;
                for (const n of state.npcs) {
                    const was = before.get(n.id);
                    if (!was || n.factionId === was.house) continue;
                    if (n.status !== 'alive') continue;
                    const house = state.factions.find(f => f.id === was.house);
                    if (!house || house.dissolvedOnDay !== null) continue;
                    departures[where(was.rank)]++;
                    if (!leftFrom.has(n.id)) leftFrom.set(n.id, was.rank);
                    // BY WHICH ROUTE, because they are not the same event.
                    // Founding a house of your own is not transferring to one,
                    // and being written off as lost is nobody's decision at all:
                    // measured at 1,000 years on `afford-a`, of 665 ways off a
                    // roll, 348 were the house losing track of somebody, 183
                    // were a splinter, 84 were a walk-out and 10 an expulsion.
                    const fresh = n.tags.slice(was.tags);
                    const route = fresh.some(t => t.startsWith('walked-out:')) ? 'walked out'
                        : fresh.some(t => t.startsWith('rogue:expelled:')) ? 'expelled'
                        : fresh.some(t => t.startsWith('rogue:house-fell:')) ? 'the house fell'
                        : fresh.some(t => t.startsWith('rogue:fled:')) ? 'fled a destruction'
                        : fresh.some(t => t.startsWith('taken-in-as-an-elder:')) ? 'hired from outside'
                        : n.factionId !== null && n.factionId.startsWith('sect-splinter-')
                            ? (n.factionId === `sect-splinter-${n.id}` ? 'founded their own' : 'went with a founder')
                        : n.factionId === null ? 'written off as lost' : 'joined another house';
                    byRoute[`${where(was.rank)}|${route}`] = (byRoute[`${where(was.rank)}|${route}`] ?? 0) + 1;
                    if (route !== 'founded their own' && route !== 'went with a founder') {
                        if (!transferredFrom.has(n.id) && n.factionId !== null) transferredFrom.set(n.id, was.rank);
                    }
                }
                for (const n of state.npcs) {
                    if (n.tags.some(t => t.startsWith(INHERITOR_OF)) && !inheritorStart.has(n.id)) {
                        inheritorStart.set(n.id, n.cultivation.realmOrdinal);
                    }
                }
                note();
            }

            const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
            const standingByKind: Record<string, string> = {};
            const distinctByKind: Record<string, { raised: string; otherArts: string }> = {};
            for (const kind of ['righteous', 'neutral', 'demonic', 'bloodline']) {
                const ofKind = [...catalogHouses].filter(([, k]) => k === kind).map(([id]) => id);
                const standing = live.filter(f => ofKind.includes(f.id));
                standingByKind[kind] = `${standing.length}/${ofKind.length}`;
                let members = 0, raised = 0, otherArts = 0;
                for (const house of standing) {
                    for (const n of state.npcs) {
                        if (n.status !== 'alive' || n.factionId !== house.id) continue;
                        members++;
                        if ((housesEver.get(n.id)?.size ?? 1) <= 1) raised++;
                        for (const id of n.cultivation.techniqueIds) {
                            const owners = whoseArt(id);
                            if (owners.length > 0 && !owners.includes(house.id)) otherArts++;
                        }
                    }
                }
                distinctByKind[kind] = {
                    raised: members === 0 ? '-' : (raised / members).toFixed(3),
                    otherArts: members === 0 ? '-' : (otherArts / members).toFixed(2)
                };
            }
            const everOnARoll = housesEver.size;
            const moved = [...housesEver.values()].filter(s => s.size > 1).length;
            const movedByRung: Record<string, string> = {};
            for (const w of Object.keys(stoodAt) as Where[]) {
                const people = stoodAt[w].size;
                const leftHere = [...leftFrom].filter(([id, r]) => where(r) === w && (housesEver.get(id)?.size ?? 1) > 1).length;
                movedByRung[w] = people === 0 ? '-' : (leftHere / people).toFixed(4);
            }
            const ords = state.npcs
                .filter(n => n.status === 'alive' && isBelowTheLid(n) && theSpeciesItIs(n) === null)
                .map(n => n.cultivation.realmOrdinal);
            const lu = state.npcs.find(n => n.name === 'Lu Sheng') ?? null;
            // EACH ONE WITH WHETHER THEY ARE STILL ALIVE. This printed the
            // delta alone, so somebody who died of age at 90 having climbed
            // nothing read as a live inheritor stuck at zero - the taper working
            // and somebody stuck look identical until the dead are named.
            const inheritors = [...inheritorStart].map(([id, from]) => {
                const n = state.npcs.find(x => x.id === id);
                if (n === undefined) return 'swept';
                const age = Math.round((state.currentDay - n.identity.bornOnDay) / 365);
                const climbed = n.cultivation.realmOrdinal - from;
                return `${n.status === 'alive' ? 'alive' : 'dead'}:o${n.cultivation.realmOrdinal}:+${climbed}:age${age}`;
            });
            const costByRung: Record<string, number[]> = {};
            const byId = new Map(state.npcs.map(n => [n.id, n] as const));
            for (const n of state.npcs) {
                if (n.status !== 'alive' || n.factionId === null) continue;
                const house = state.factions.find(f => f.id === n.factionId);
                if (!house) continue;
                const cost = whatLeavingTheirHouseCosts({
                    npc: n, house, lifespanYears: lifespanForOrdinal(n.cultivation.realmOrdinal), day: state.currentDay,
                    onTheRoll: id => byId.get(id)?.status === 'alive' && byId.get(id)?.factionId === house.id
                });
                (costByRung[where(n.factionRankIndex)] ??= []).push(cost);
            }
            const spread = Object.fromEntries(Object.entries(costByRung).map(([k, v]) => {
                const sorted = [...v].sort((a, b) => a - b);
                const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!.toFixed(2);
                return [k, `mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)}`];
            }));
            const towns = state.locations.filter(l => l.kind === 'settlement'
                && (l.tags.includes('market_town') || l.tags.includes('sect_town') || l.tags.includes('city')));
            const r = {
                houses: live.length,
                splintersLive: live.filter(f => f.tags.includes('splinter')).length,
                splintersPerCentury: Number((splinters * 100 / horizon).toFixed(1)),
                catalogStanding: standingByKind,
                distinct: distinctByKind,
                departuresPerCentury: Object.fromEntries(Object.entries(departures).map(([k, v]) => [k, Number((v * 100 / horizon).toFixed(1))])),
                departuresPerMillenniumByRung: Object.fromEntries(Object.entries(departures).map(([k, v]) => [k, Number((v * 1000 / horizon).toFixed(1))])),
                whyTheyWentPerMillennium: Object.fromEntries(Object.entries(whyTheyWent).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Number((v * 1000 / horizon).toFixed(1))])),
                everMovedShare: Number((moved / Math.max(1, everOnARoll)).toFixed(4)),
                everMovedByRungLeftFrom: movedByRung,
                // The same share with a founding taken out of it: somebody who
                // left to be the head of their own house did not transfer to
                // anybody's, and counting it as one is what made the elder band
                // read as the most mobile part of a house.
                everTransferredByRungLeftFrom: Object.fromEntries((Object.keys(stoodAt) as Where[]).map(w => {
                    const people = stoodAt[w].size;
                    const moved = [...transferredFrom].filter(([, r]) => where(r) === w).length;
                    return [w, people === 0 ? '-' : (moved / people).toFixed(4)];
                })),
                departuresByRungAndRoutePerMillennium: Object.fromEntries(Object.entries(byRoute).sort()
                    .map(([k, v]) => [k, Number((v * 1000 / horizon).toFixed(1))])),
                seniorLeavings, tiesCooledPerSeniorLeaving: seniorLeavings === 0 ? 0 : Number((tiesCooled / seniorLeavings).toFixed(2)),
                over29: ords.filter(o => o > 29).length,
                over35: ords.filter(o => o > 35).length,
                over41: ords.filter(o => o > 41).length,
                at44: ords.filter(o => o === 44).length,
                max: ords.reduce((m, o) => Math.max(m, o), 0),
                seatsAtTheCourt: state.npcs.filter(n => /^npc-hollow-court-(first|second|third|fourth)-seat$/.test(n.id)
                    && n.status === 'alive' && n.factionId === 'sect-hollow-court').length,
                luSheng: lu === null ? 'no row' : `${lu.status} ${lu.factionId ?? 'no roll'} ${lu.locationId}`,
                lectureYears: lectures,
                inheritors: inheritors.length,
                inheritorRungsClimbed: inheritors.join(' '),
                whatLeavingCostsByRung: spread,
                emptyTowns: towns.filter(l => npcsAt(state, l.id).length === 0).length,
                onRegionNodes: state.locations.filter(l => l.kind === 'region').reduce((s, l) => s + npcsAt(state, l.id).length, 0),
                minutes: Number(((Date.now() - started) / 60000).toFixed(1))
            };
            dump[`${arm}:y${horizon}:${seed}`] = r;
            say(`${arm} ${seed} @${horizon} ${JSON.stringify(r)}`);
            writeFileSync(`${DIR}/probe-${OUT}.json`, JSON.stringify(dump, null, 1), 'utf8');
        }
    }
}
void main();
