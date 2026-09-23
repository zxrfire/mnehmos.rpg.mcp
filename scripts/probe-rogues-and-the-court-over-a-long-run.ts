/**
 * Where the world's rogues come from, and what becomes of the Hollow Court's own
 * people on a Tribulation Transcendence clock.
 *
 * Per seed, at each horizon:
 *
 *   rogues      living people on no roll, below the Lid, not beasts, at
 *               Foundation (13) or above, and above 21 and 29; by where the row
 *               came from (`rogue:` tag), where one is carried
 *   top         living people above 29 / 35 / 41, and the max
 *   houses      live houses; catalog houses (live at year 0) standing, by kind
 *   distinct    per catalog house kind, the share of living members never seen
 *               on a second roll
 *   ground      share of the living standing on a sect seat
 *   errands     people who went out on a house's errand and did not come back,
 *               by the rung they held and by how far above the pitch they stood
 *   court       every catalog member of the Hollow Court: status, roll,
 *               location, and the cause where the row ended; and every errand a
 *               Seat went on, with the ground and what it asks
 *
 * Run: npx tsx scripts/probe-rogues-and-the-court-over-a-long-run.ts
 *   PROBE_PLAN  seed:horizon,horizon;...   PROBE_OUT
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { npcsAt } from '../src/engine/world/world-state.js';
import { WENT_AND_CAME_BACK, WENT_AND_DID_NOT } from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { WHAT_IT_HAS_COME_TO } from '../src/engine/world/a-year-of-people-acting-on-why-they-would-kill.js';
import {
    REMOVED_FROM_OFFICE,
    theDayTheyLostTheOffice,
    theRemovalTheyCarry,
    theRoomWouldDealToThemAgain,
    whatServiceIsWorthBesideAWin,
    whatTheyAreWorthToTheirHouseNow
} from '../src/engine/world/bringing-what-you-know-about-somebody-to-the-room.js';

const PLAN = (process.env.PROBE_PLAN ?? 'afford-a:150,500,1000,2500,5000;demography:150,500,1000,2500,5000').split(';').map(part => {
    const [seed, horizons] = part.split(':');
    return { seed: seed!, horizons: horizons!.split(',').map(Number) };
});
const OUT = process.env.PROBE_OUT ?? 'long';
const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';
const LOG = `${DIR}/probe-${OUT}.log`;
const COURT = 'sect-hollow-court';
const kindOf = (f: { alignment: string; tags: string[] }) => (f.tags.includes('bloodline') ? 'bloodline' : f.alignment);
const rung = (r: number) => (r >= 5 ? 'r5+' : `r${Math.max(0, r)}`);
const gapBand = (g: number) => (g >= 12 ? '+12..' : g >= 6 ? '+6..11' : g >= 0 ? '+0..5' : g >= -5 ? '-5..-1' : '..-6');

function say(line: string): void {
    console.log(line);
    appendFileSync(LOG, `${line}\n`, 'utf8');
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    writeFileSync(LOG, '', 'utf8');
    for (const { seed, horizons } of PLAN) {
        const started = Date.now();
        for (const k of Object.keys(WHAT_IT_HAS_COME_TO)) delete WHAT_IT_HAS_COME_TO[k];
        const { state } = seedWorld({ seed, catalog });
        const catalogHouses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, kindOf(f)] as const));
        const courtIds = state.npcs.filter(n => n.factionId === COURT && n.id.includes('hollow-court')).map(n => n.id);
        const housesEver = new Map<string, Set<string>>();
        const went: Record<string, number> = {}, lost: Record<string, number> = {};
        const wentGap: Record<string, number> = {}, lostGap: Record<string, number> = {};
        const killings: Record<string, number> = {};
        const attempts: Record<string, number> = {};
        const exposes: Record<string, number> = {};
        const seatChanges: Record<string, number> = {};
        const away: Record<string, [number, number]> = {};
        const hiddenVictims = new Set<string>();
        const seen = new Set(state.history.facts.map(f => f.id));
        const note = () => {
            for (const n of state.npcs) {
                if (n.factionId === null || n.status !== 'alive') continue;
                const set = housesEver.get(n.id) ?? new Set<string>();
                set.add(n.factionId);
                housesEver.set(n.id, set);
            }
        };
        note();
        say(`${seed} court at open: ${courtIds.map(id => {
            const n = state.npcs.find(x => x.id === id)!;
            return `${n.name}(${id.replace('npc-hollow-court-', '')}) o${n.cultivation.realmOrdinal} r${n.factionRankIndex}`;
        }).join('; ')}`);
        let y = 0;
        for (const horizon of horizons) {
            for (; y < horizon; y++) {
                const before = new Map(state.npcs.map(n => [n.id, { rank: n.factionRankIndex, ordinal: n.cultivation.realmOrdinal, house: n.factionId, alive: n.status === 'alive' }] as const));
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || n.factionId === null) continue;
                    const house = state.factions.find(f => f.id === n.factionId);
                    if (!house || house.seatLocationId === null) continue;
                    const top = house.ranks.length - 1;
                    const band = n.factionRankIndex >= top ? 'head' : n.factionRankIndex >= top - 2 ? 'elder' : rung(n.factionRankIndex);
                    const cell = away[band] ?? [0, 0];
                    const place = n.locationId === null ? null : state.locations.find(l => l.id === n.locationId);
                    const home = n.locationId === house.seatLocationId || place?.data?.factionId === house.id;
                    cell[0] += home ? 0 : 1;
                    cell[1] += 1;
                    away[band] = cell;
                }
                advanceWorldYears(state, 1, { stopOnInterrupt: false });
                for (const f of state.history.facts) {
                    if (seen.has(f.id)) continue;
                    seen.add(f.id);
                    if (typeof f.data?.motive === 'string') {
                        const how = String(f.data?.outcome ?? (f.data?.hidden ? 'hidden' : 'killed'));
                        const key = `${f.data.motive}|${String(f.data.relation ?? '?')}|${how}`;
                        attempts[key] = (attempts[key] ?? 0) + 1;
                        if (f.data?.hidden) for (const a of f.actors) if (a.role === 'victim') hiddenVictims.add(a.id);
                    }
                    if (f.data?.expose === true && typeof f.data?.sentence === 'string') {
                        const house = state.factions.find(h => f.factionIds.includes(h.id));
                        const key = `${house?.alignment ?? '?'}|${String(f.data.place)}`;
                        exposes[key] = (exposes[key] ?? 0) + 1;
                    }
                    if (f.data?.madeUp === true) exposes['made up'] = (exposes['made up'] ?? 0) + 1;
                    if (f.actors.some(a => a.role === 'killer')) {
                        const why = String(f.data?.motive ?? f.data?.pressure ?? f.kind);
                        killings[why] = (killings[why] ?? 0) + 1;
                    }
                    const party = f.actors.filter(a => a.role === WENT_AND_CAME_BACK || a.role === WENT_AND_DID_NOT);
                    if (party.length === 0) continue;
                    const pitch = Number(/at ordinal (\d+)/.exec(f.summary)?.[1] ?? NaN);
                    for (const a of party) {
                        const was = before.get(a.id);
                        if (!was) continue;
                        const r = rung(was.rank);
                        const g = Number.isNaN(pitch) ? 'n/a' : gapBand(was.ordinal - pitch);
                        went[r] = (went[r] ?? 0) + 1;
                        wentGap[g] = (wentGap[g] ?? 0) + 1;
                        if (a.role === WENT_AND_DID_NOT) {
                            lost[r] = (lost[r] ?? 0) + 1;
                            lostGap[g] = (lostGap[g] ?? 0) + 1;
                        }
                    }
                    if (party.some(a => courtIds.includes(a.id))) {
                        const place = state.locations.find(l => l.id === f.locationId);
                        say(`  ${seed} y${y + 1} court errand: ${f.summary} | ${party.map(a => `${a.name} o${before.get(a.id)?.ordinal}:${a.role}`).join(', ')} | at ${place?.name ?? f.locationId} (${place?.kind}) thresholds ${JSON.stringify(place?.thresholds ?? null)} kind ${f.kind}`);
                    }
                }
                for (const n of state.npcs) {
                    const was = before.get(n.id);
                    if (!was || !was.alive || was.house === null || was.rank < 1) continue;
                    const house = state.factions.find(f => f.id === was.house);
                    const alignment = house?.alignment ?? '?';
                    let cause: string | null = null;
                    if (n.status !== 'alive') {
                        cause = hiddenVictims.has(n.id) ? 'killed, hidden' : /^Killed by/.test(n.endNote ?? '') ? 'killed' : 'died';
                    } else if (n.factionId === null && n.tags.some(t => t.startsWith('rogue:expelled:'))) cause = 'expelled';
                    else if (n.factionId === was.house && n.tags.includes(`removed-from-office:${was.house}`) && !seatChanges[`seen:${n.id}`]) {
                        cause = 'removed from office';
                        seatChanges[`seen:${n.id}`] = 1;
                    } else if (n.factionId === was.house && n.factionRankIndex > was.rank) cause = 'promoted';
                    if (cause === null) continue;
                    const key = `${alignment}|${cause}`;
                    seatChanges[key] = (seatChanges[key] ?? 0) + 1;
                }
                note();
            }

            const living = state.npcs.filter(n => n.status === 'alive' && isBelowTheLid(n) && theSpeciesItIs(n) === null);
            const rogues = living.filter(n => n.factionId === null);
            const bySource: Record<string, number> = {};
            for (const n of rogues) {
                if (n.cultivation.realmOrdinal < 13) continue;
                const src = n.tags.find(t => t.startsWith('rogue:'))?.split(':').slice(0, 2).join(':')
                    ?? (n.tags.some(t => t.startsWith('walked-out:')) ? 'walked-out'
                        : housesEver.has(n.id) ? 'left a roll' : 'never on a roll');
                bySource[src] = (bySource[src] ?? 0) + 1;
            }
            // WHERE THE HIGH ROGUES CAME FROM, which is the owner's question:
            // how they are getting there, and whether the road makes sense. One
            // row per source, split by where they were standing when they came
            // off a roll - MINTED at height (a fallen house's elder, which is
            // the genre working) against CLIMBED there afterwards with nobody
            // behind them (which mostly should not happen).
            const highRogues: Record<string, number> = {};
            for (const n of rogues) {
                if (n.cultivation.realmOrdinal <= 29) continue;
                const src = n.tags.find(t => t.startsWith('rogue:'))?.split(':').slice(0, 2).join(':')
                    ?? (n.tags.some(t => t.startsWith('walked-out:')) ? 'walked-out'
                        : housesEver.has(n.id) ? 'left a roll' : 'never on a roll');
                const cameOffAt = n.tags.find(t => t.startsWith('came-off-a-roll-at:'));
                const stood = cameOffAt === undefined
                    ? null : Number(cameOffAt.slice('came-off-a-roll-at:'.length));
                const road = stood === null ? 'no roll to come off'
                    : stood > 29 ? 'minted at height' : `climbed from ${stood}`;
                const key = `${src} | ${road}`;
                highRogues[key] = (highRogues[key] ?? 0) + 1;
            }
            // DOES A ROOM EVER COME BACK TO SOMEBODY IT WAS TAKEN FROM. The
            // owner ruled the removal is not permanent and that influence is
            // what decides, so what has to be read is whether anybody ever
            // outgrows it: nobody ever means the weight is a gate in different
            // clothes, most of them inside a century means it costs nothing.
            const lostAnOffice = living.filter(n => n.tags.some(t => t.startsWith(REMOVED_FROM_OFFICE)));
            // AND HOW MANY OF THEM ARE STANDING SOMEWHERE ELSE NOW. The lookup
            // used to be keyed on the current house, so a person who lost an
            // office at one house and joined another carried a tag nobody could
            // find and the weight evaluated to zero. This is the count that says
            // whether that population exists at all, which it did not before the
            // doors opened.
            const carriedFromElsewhere = lostAnOffice.filter(n => {
                const carried = theRemovalTheyCarry(n);
                return carried !== null && carried.houseId !== n.factionId;
            }).length;
            const wouldBeDealtAgain: number[] = [];
            for (const n of lostAnOffice) {
                const house = state.factions.find(f => f.id === n.factionId);
                if (house === undefined) continue;
                if (!theRoomWouldDealToThemAgain(state, n, house, state.currentDay)) continue;
                const when = theDayTheyLostTheOffice(n);
                wouldBeDealtAgain.push(when === null ? 0 : Math.round((state.currentDay - when) / 365));
            }
            wouldBeDealtAgain.sort((a, b) => a - b);
            // WHICH TERM CLEARS THE BAR. Taking the rung out of the influence
            // read moved neither the count nor the median, so the bar is being
            // cleared by something else and the fix belongs wherever that is.
            // Face, service and who speaks for them, summed over the carriers.
            let face = 0, service = 0, spokenFor = 0, worthTotal = 0;
            for (const n of lostAnOffice) {
                const house = state.factions.find(f => f.id === n.factionId);
                if (house === undefined) continue;
                face += Math.max(0, Number(n.face ?? 0));
                service += (n.merit?.houseId === house.id ? n.merit.points : 0)
                    / whatServiceIsWorthBesideAWin(house);
                let speaks = 0;
                for (const other of state.npcs) {
                    if (other.id === n.id || other.factionId !== house.id || other.status !== 'alive') continue;
                    const tie = other.relationships.find(r => r.targetId === n.id);
                    if (tie && tie.standing >= 0.4) speaks += 0.5;
                }
                spokenFor += Math.min(2, speaks);
                worthTotal += whatTheyAreWorthToTheirHouseNow(state, n, house);
            }
            const per = (x: number) => lostAnOffice.length === 0
                ? null : Number((x / lostAnOffice.length).toFixed(2));
            // IS FACE A CURRENCY YET. It was minted only by violence: mean zero
            // over the carriers, because none of them had ever been in a duel.
            // If it is still near zero for ordinary members, the writers fire
            // for a handful of people and it is still not a currency.
            let anyFace = 0, faceTotal = 0;
            for (const n of living) {
                const f = Number(n.face ?? 0);
                if (f !== 0) anyFace++;
                faceTotal += f;
            }
            // HOW PEOPLE DIED, BY WHAT KILLED THEM AND WHERE THEY STOOD.
            //
            // Off `endNote` and `diedOnDay` on the row, which every path that
            // ends anybody writes through `markDead`, so nothing is counted
            // twice and nothing is missed by reading one template's facts. The
            // question this answers: did tonight's work shift death from
            // unmotivated to motivated, or did it just make the world safe.
            const bandOf = (o: number) => o < 13 ? 'a: mortal-ish <13'
                : o < 29 ? 'b: middle 13-28'
                    : o < 41 ? 'c: high 29-40' : 'd: apex 41+';
            const causeOf = (note: string) => {
                const t = note.toLowerCase();
                if (t.includes('lifespan exhausted')) return 'their span ran out';
                if (t.includes('old wound')) return 'a wound that never closed';
                if (t.includes('died of age')) return 'age (SHOULD NOT APPEAR)';
                if (t.includes('killed by')) return 'another cultivator or a beast';
                if (t.includes('taken when')) return 'a beast came down';
                if (t.includes('tribulation') || t.includes('crossing') || t.includes('wall')) return 'a wall or a crossing';
                if (t.includes('war') || t.includes('fell with') || t.includes('house')) return 'a war or a house falling';
                if (t === '') return 'nothing written';
                return `other: ${note.slice(0, 40)}`;
            };
            const deathsByBand: Record<string, number> = {};
            const deathsByCause: Record<string, number> = {};
            let deadInRun = 0;
            for (const n of state.npcs) {
                if (n.diedOnDay === null || n.diedOnDay === undefined) continue;
                if (theSpeciesItIs(n)) continue;
                deadInRun++;
                const band = bandOf(n.cultivation.realmOrdinal);
                const cause = causeOf(String(n.endNote ?? ''));
                deathsByBand[band] = (deathsByBand[band] ?? 0) + 1;
                deathsByCause[`${band} | ${cause}`] = (deathsByCause[`${band} | ${cause}`] ?? 0) + 1;
            }

            // AND HOW MANY OF THEM THE WORLD HAD TO REARRANGE ITSELF AROUND.
            // An age does not turn often: a tenth would convict the property.
            const deathFacts = state.history.facts.filter(f =>
                f.kind === 'death' || String(f.data?.pressure ?? '') === 'killing');
            const byScale: Record<string, number> = {};
            for (const f of deathFacts) byScale[f.scale] = (byScale[f.scale] ?? 0) + 1;
            const shook = (byScale.regional ?? 0) + (byScale.continental ?? 0) + (byScale.world ?? 0);

            const ords = living.map(n => n.cultivation.realmOrdinal);
            const pyramid: Record<string, number> = {};
            for (const o of ords) pyramid[bandOf(o)] = (pyramid[bandOf(o)] ?? 0) + 1;
            const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
            const standing: Record<string, string> = {}, raised: Record<string, string> = {};
            for (const kind of ['righteous', 'neutral', 'demonic', 'bloodline']) {
                const ofKind = [...catalogHouses].filter(([, k]) => k === kind).map(([id]) => id);
                const up = live.filter(f => ofKind.includes(f.id));
                standing[kind] = `${up.length}/${ofKind.length}`;
                let members = 0, once = 0;
                for (const n of living) {
                    if (n.factionId === null || !up.some(f => f.id === n.factionId)) continue;
                    members++;
                    if ((housesEver.get(n.id)?.size ?? 1) <= 1) once++;
                }
                raised[kind] = members === 0 ? '-' : (once / members).toFixed(3);
            }
            let onSeat = 0;
            for (const l of state.locations) if (l.kind === 'sect_seat') onSeat += npcsAt(state, l.id).length;
            const alive = state.npcs.filter(n => n.status === 'alive').length;
            const rate = (w: Record<string, number>, l: Record<string, number>) => Object.fromEntries(
                Object.keys(w).sort().map(k => [k, `${l[k] ?? 0}/${w[k]}`]));
            const r = {
                roguesFoundationUp: rogues.filter(n => n.cultivation.realmOrdinal >= 13).length,
                roguesOver21: rogues.filter(n => n.cultivation.realmOrdinal > 21).length,
                roguesOver29: rogues.filter(n => n.cultivation.realmOrdinal > 29).length,
                roguesBelowFoundation: rogues.filter(n => n.cultivation.realmOrdinal < 13).length,
                roguesBySource: bySource,
                whereTheHighRoguesCameFrom: highRogues,
                pyramid,
                deadInRun,
                deathsPerLivingHeadPerCentury: Number(
                    (deadInRun / Math.max(1, living.length) / Math.max(1, horizon / 100)).toFixed(3)),
                deathsByBand,
                deathsPerCenturyByBandAndCause: Object.fromEntries(
                    Object.entries(deathsByCause).sort()
                        .map(([k, v]) => [k, Number((v * 100 / horizon).toFixed(2))])),
                deathFactsByScale: byScale,
                earthShakingShare: deathFacts.length === 0
                    ? null : Number((shook / deathFacts.length).toFixed(3)),
                lostAnOffice: lostAnOffice.length,
                lostItAtAHouseTheyHaveSinceLeft: carriedFromElsewhere,
                andCouldHoldOneAgain: wouldBeDealtAgain.length,
                yearsToOutgrowIt: wouldBeDealtAgain.length === 0
                    ? null
                    : wouldBeDealtAgain[Math.floor(wouldBeDealtAgain.length / 2)],
                over29: ords.filter(o => o > 29).length,
                over35: ords.filter(o => o > 35).length,
                over41: ords.filter(o => o > 41).length,
                max: ords.reduce((m, o) => Math.max(m, o), 0),
                houses: live.length,
                catalogStanding: standing,
                raisedShare: raised,
                onSectGround: Number((onSeat / Math.max(1, alive)).toFixed(3)),
                alive,
                killingsPerCentury: Object.fromEntries(Object.entries(killings).map(([k, v]) => [k, Number((v * 100 / horizon).toFixed(1))])),
                attemptsPerCenturyByMotiveRelationOutcome: Object.fromEntries(Object.entries(attempts).sort().map(([k, v]) => [k, Number((v * 100 / horizon).toFixed(2))])),
                exposesByAlignmentAndPlace: exposes,
                hiddenKillings: (() => {
                    const hidden = state.history.facts.filter(f => f.data?.hidden === true);
                    const out = hidden.filter(f => typeof f.data?.cameToLight === 'number');
                    const within = (years: number) => out.filter(f =>
                        (Number(f.data!.cameToLight) - f.day) / 365 <= years
                        && (state.currentDay - f.day) / 365 >= years).length;
                    const old = (years: number) => hidden.filter(f => (state.currentDay - f.day) / 365 >= years).length;
                    return {
                        hidden: hidden.length,
                        cameOut: out.length,
                        withinACentury: `${within(100)}/${old(100)}`,
                        withinAMillennium: `${within(1000)}/${old(1000)}`
                    };
                })(),
                whatTheYearsCameTo: Object.fromEntries(Object.entries(WHAT_IT_HAS_COME_TO).sort()),
                seatChangesByAlignmentAndCause: Object.fromEntries(Object.entries(seatChanges).filter(([k]) => !k.startsWith('seen:')).sort()),
                awayFromTheSeatByRung: Object.fromEntries(Object.entries(away).sort().map(([k, [a, t]]) => [k, Number((a / Math.max(1, t)).toFixed(3))])),
                errandLostByRung: rate(went, lost),
                errandLostByGapAbovePitch: rate(wentGap, lostGap),
                minutes: Number(((Date.now() - started) / 60000).toFixed(1))
            };
            say(`${seed} @${horizon} ${JSON.stringify(r)}`);
            for (const id of courtIds) {
                const n = state.npcs.find(x => x.id === id);
                if (!n) { say(`  ${seed} @${horizon} ${id}: no row`); continue; }
                say(`  ${seed} @${horizon} ${n.name}: ${n.status} o${n.cultivation.realmOrdinal} ${n.factionId ?? 'no roll'} r${n.factionRankIndex} at ${n.locationId}`
                    + (n.status === 'alive' ? '' : ` y${n.diedOnDay === null ? '?' : Math.round((n.diedOnDay - (state.currentDay - horizon * 365)) / 365)} ${n.endNote}`));
            }
        }
    }
}
void main();
