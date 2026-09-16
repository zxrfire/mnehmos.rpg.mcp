/**
 * Does a posting bring anybody home, and what is left of the ladder when it
 * does?
 *
 * ── THE DEFECT THIS WAS BUILT TO MEASURE ─────────────────────────────────
 *
 * Every writer of an away activity wrote `returnTo` as wherever the person was
 * standing. The yearly return runs on day 62 and postings are written on day 64,
 * so a posting stood in its town for most of a year with its term over, free to
 * be drafted, and the party that drafted it wrote the town as home. The
 * conclave's walk to a door overwrote a posting still running the same way. And
 * a posting itself ended wherever the person had been rather than at the house.
 * `a-posting-ends-at-the-house.test.ts` pins both halves.
 *
 * ── WHAT IT SAID, SIX SEEDS, THE DEFAULTS BELOW ──────────────────────────
 *
 * Both arms and the half-fix were taken in ONE process off a temporary switch,
 * since removed, so no other agent's work could land between them.
 *
 *                              world open    25 years      100 years
 *   at their own seat, summed
 *     before                   2634/3205     1035/2909      341/3050
 *     posting ends at house    2634/3205     1084/2909      436/2963
 *     and away keeps its home  2634/3205     1212/2907      697/3054
 *   gate unanswerable
 *     before                      0/228        17/231        80/236
 *     after                       0/228         6/231        19/239
 *   rank slots empty
 *     before                      4/1470      159/1499      260/1530
 *     after                       4/1470      162/1499      254/1548
 *   elder rungs empty
 *     before                      4/660        34/672        81/688
 *     after                       4/660        34/672        77/698
 *
 * THE SEAT COUNT MOVED AND THE LADDER DID NOT. Per seed the elder figure at a
 * century went both ways (26 vs 22, 14 vs 22, 6 vs 8), which is the worlds
 * diverging rather than a signal. And what is still not at the seat after is not
 * the original cohort: nobody on a house's roll at world open was idle away from
 * it, on `afford-a` at a century (24 before) and on `town-a` and `town-b` at two
 * hundred years (23 and 26 before). It is people who JOINED since, enrolled where they stood -
 * in a flow over 100 years on `afford-a`, 656 person-years joined into
 * somewhere else and 9 into the compound. That is `applyRecruitment`, not this.
 *
 * Elder churn over the century, summed, after:
 *
 *   off an elder rung  803   age 290, killed 163, walked out 213, expedition
 *                            52, breakthrough 32, old wound 19, demoted 27,
 *                            unknown 7
 *   onto one           737   every one already on a roll; none a new row
 *
 * Age is not small: 230 of the 882 elders at world open have under a century
 * left, because small houses seat Qi Condensation and Foundation elders.
 *
 * ── WHAT IT REPORTS ──────────────────────────────────────────────────────
 *
 *   at their own seat    living members of a seated house standing on the
 *                        house's own seat, over all such members.
 *   rank / elder slots   how many rungs anybody stands on, the reading
 *                        `probe-whether-a-house-has-a-middle.ts` takes.
 *   gate unanswerable    nobody at the seat who `couldHostAGuest`.
 *   elder churn          who left an elder rung over the span and why, and how
 *                        many reached one. The balance of the two is the seat
 *                        count, and neither half is the culprit on its own:
 *                        elders do die on expeditions and in fights, and
 *                        reaching an elder rung is hard.
 *
 * Cause is read off `NpcRecord.endNote`, or off the advance's own events where
 * the world forgot a mortal's row and its death fact inside the year.
 *
 * Run: npx tsx scripts/probe-does-a-posting-bring-anybody-home.ts
 *   PROBE_SEEDS   comma-separated world seeds
 *   PROBE_YEARS   horizons to report at
 *   PROBE_OUT     name for the JSON dropped beside the log
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { couldHostAGuest } from '../src/engine/world/standing-at-the-gate-of-a-house.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import { npcsAt, type WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,afford-c,roster-d,roster-e,demography').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '25,100').split(',').map(Number);
const OUT = process.env.PROBE_OUT ?? 'arm';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

interface Reading {
    houses: number;
    living: number;
    /** Living members of a seated house, and how many stand on its own seat. */
    onTheRoll: number;
    atTheirSeat: number;
    /** Where the rest are: in a town on a station, out with a party, elsewhere. */
    stationed: number;
    withAParty: number;
    elsewhere: number;
    slots: number;
    filled: number;
    elderSlots: number;
    elderFilled: number;
    elders: number;
    gateUnanswerable: number;
    /** The guards `demography.test.ts` holds: who lives on sect ground and in settlements. */
    onSectGround: number;
    inSettlements: number;
    emptySettlements: number;
}

type Cause =
    | 'age'
    | 'killed'
    | 'expedition'
    | 'breakthrough'
    | 'old_wound'
    | 'other_death'
    /** Died, and the world forgot the row and the fact inside the same year. */
    | 'unknown_death'
    | 'walked_out'
    | 'demoted'
    | 'house_gone';

interface Churn {
    left: Record<Cause, number>;
    /** Of the deaths, how many happened to somebody away when the year opened. */
    diedWhileStationed: number;
    diedWithAParty: number;
    /** Who came onto an elder rung, and whether the world already held the row. */
    arrivedFromTheRoll: number;
    arrivedNew: number;
    /** Distinct end notes seen, so a cause bucket can be checked rather than trusted. */
    notes: Record<string, number>;
}

function emptyChurn(): Churn {
    return {
        left: {
            age: 0, killed: 0, expedition: 0, breakthrough: 0, old_wound: 0,
            other_death: 0, unknown_death: 0, walked_out: 0, demoted: 0, house_gone: 0
        },
        diedWhileStationed: 0,
        diedWithAParty: 0,
        arrivedFromTheRoll: 0,
        arrivedNew: 0,
        notes: {}
    };
}

function seatedHouses(state: WorldState): Map<string, { seat: string; ranks: number }> {
    const out = new Map<string, { seat: string; ranks: number }>();
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        out.set(faction.id, { seat: faction.seatLocationId, ranks: faction.ranks.length });
    }
    return out;
}

function read(state: WorldState): Reading {
    const houses = seatedHouses(state);
    const roll = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        if (!houses.has(npc.factionId)) continue;
        const bucket = roll.get(npc.factionId);
        if (bucket) bucket.push(npc); else roll.set(npc.factionId, [npc]);
    }

    const out: Reading = {
        houses: 0, living: state.npcs.filter(n => n.status === 'alive').length,
        onTheRoll: 0, atTheirSeat: 0, stationed: 0, withAParty: 0, elsewhere: 0,
        slots: 0, filled: 0, elderSlots: 0, elderFilled: 0, elders: 0,
        gateUnanswerable: 0,
        onSectGround: 0, inSettlements: 0, emptySettlements: 0
    };
    for (const l of state.locations) {
        if (l.kind === 'sect_seat') out.onSectGround += npcsAt(state, l.id).length;
        if (l.kind === 'settlement') {
            const here = npcsAt(state, l.id).length;
            out.inSettlements += here;
            if (here === 0) out.emptySettlements++;
        }
    }

    for (const [id, house] of houses) {
        const members = roll.get(id) ?? [];
        if (members.length === 0) continue;
        out.houses++;
        out.onTheRoll += members.length;
        const here = members.filter(p => p.locationId === house.seat);
        out.atTheirSeat += here.length;
        for (const p of members) {
            if (p.locationId === house.seat) continue;
            if (p.activity?.kind === 'stationed') out.stationed++;
            else if (p.activity?.kind === 'out_with_a_party') out.withAParty++;
            else out.elsewhere++;
        }

        const held = new Set(members.map(p => p.factionRankIndex));
        out.slots += house.ranks;
        for (let r = 0; r < house.ranks; r++) {
            if (held.has(r)) out.filled++;
            if (isElderRank(r, house.ranks)) {
                out.elderSlots++;
                if (held.has(r)) out.elderFilled++;
            }
        }
        out.elders += members.filter(p => isElderRank(p.factionRankIndex, house.ranks)).length;
        if (!here.some(p => couldHostAGuest(p.factionRankIndex, house.ranks))) out.gateUnanswerable++;
    }
    return out;
}

/** Everybody standing on an elder rung right now, and what they were at. */
function eldersNow(state: WorldState): Map<string, { doing: string | null }> {
    const houses = seatedHouses(state);
    const out = new Map<string, { doing: string | null }>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const house = houses.get(npc.factionId);
        if (!house) continue;
        if (!isElderRank(npc.factionRankIndex, house.ranks)) continue;
        out.set(npc.id, { doing: npc.activity?.kind ?? null });
    }
    return out;
}

const AGE = /lifespan exhausted|died of age|died of old age|in the world's own time/i;
const KILLED = /\bkilled\b|was at .* grounds|went down at/i;
const EXPEDITION = /did not come back|was not seen again/i;
const BREAKTHROUGH = /breakthrough that did not hold|crossing out of .* did not open/i;
const OLD_WOUND = /old wound/i;

/** Read off the end note, which every death path writes. */
function causeOf(note: string): Cause {
    if (KILLED.test(note)) return 'killed';
    if (EXPEDITION.test(note)) return 'expedition';
    if (AGE.test(note)) return 'age';
    if (BREAKTHROUGH.test(note)) return 'breakthrough';
    if (OLD_WOUND.test(note)) return 'old_wound';
    return 'other_death';
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};

    for (const seed of SEEDS) {
        const { state } = seedWorld({ seed, catalog });
        console.log(seed);
        say('@0y', read(state));
        dump[`y0:${seed}`] = read(state);

        const churn = emptyChurn();
        let at = 0;
        for (const horizon of HORIZONS) {
            for (let y = at; y < horizon; y++) {
                const before = eldersNow(state);
                const wasOnTheRoll = new Set(
                    state.npcs.filter(n => n.status === 'alive' && n.factionId).map(n => n.id));
                const moved = advanceWorldYears(state, 1, { stopOnInterrupt: false });
                // A mortal's row and its death fact are both forgotten at the end
                // of the advance, so the cause is read off what the advance
                // reported rather than off the row.
                const diedOf = new Map<string, string>();
                for (const fact of moved.events) {
                    if (fact.kind !== 'death') continue;
                    for (const actor of fact.actors) {
                        if (actor.role === 'deceased') diedOf.set(actor.id, fact.summary);
                    }
                }
                // Deaths a pass of the world's own caused carry the event that
                // caused them, whether or not a death fact survived.
                for (const event of moved.pressure) {
                    for (const death of event.deaths) {
                        if (!diedOf.has(death.deceasedId)) {
                            diedOf.set(death.deceasedId, `[${event.kind}] ${event.fact.summary}`);
                        }
                    }
                }
                for (const fact of moved.events) {
                    for (const actor of fact.actors) {
                        if (diedOf.has(actor.id)) continue;
                        if (actor.role === 'lost' || actor.role === 'missing') {
                            diedOf.set(actor.id, `[${fact.kind}:${actor.role}] did not come back. ${fact.summary}`);
                        } else if (/killed|slain|fell|victim|dead/i.test(actor.role)) {
                            diedOf.set(actor.id, `[${fact.kind}:${actor.role}] killed. ${fact.summary}`);
                        }
                    }
                }
                for (const death of moved.deaths) {
                    if (!diedOf.has(death.deceasedId)) {
                        // `advanceTime`'s own pass, which is the lifespan running out.
                        diedOf.set(death.deceasedId, '[lifespan] died in the world\'s own time');
                    }
                }
                const after = eldersNow(state);
                const byId = new Map(state.npcs.map(n => [n.id, n]));
                const houses = seatedHouses(state);

                for (const [id, was] of before) {
                    if (after.has(id)) continue;
                    const npc = byId.get(id);
                    if (npc === undefined || npc.status !== 'alive') {
                        const note = npc?.endNote || diedOf.get(id) || '';
                        const cause = note === '' ? 'unknown_death' : causeOf(note);
                        churn.left[cause]++;
                        if (was.doing === 'stationed') churn.diedWhileStationed++;
                        if (was.doing === 'out_with_a_party') churn.diedWithAParty++;
                        const said = (note || '(none)').slice(0, 90);
                        churn.notes[said] = (churn.notes[said] ?? 0) + 1;
                        continue;
                    }
                    if (npc.factionId === null) { churn.left.walked_out++; continue; }
                    if (!houses.has(npc.factionId)) { churn.left.house_gone++; continue; }
                    churn.left.demoted++;
                }
                for (const id of after.keys()) {
                    if (before.has(id)) continue;
                    if (wasOnTheRoll.has(id)) churn.arrivedFromTheRoll++;
                    else churn.arrivedNew++;
                }
            }
            at = horizon;
            const r = read(state);
            dump[`y${horizon}:${seed}`] = r;
            say(`@${horizon}y`, r);
            dump[`churn-to-y${horizon}:${seed}`] = JSON.parse(JSON.stringify(churn));
            sayChurn(`  churn 0..${horizon}y`, churn);
        }
        console.log('');
    }

    const path = `${DIR}/posting-home-${OUT}.json`;
    writeFileSync(path, JSON.stringify(dump, null, 1), 'utf8');
    console.log(`wrote ${path}`);
}

function say(label: string, r: Reading): void {
    console.log(
        `  ${label.padEnd(8)} houses ${String(r.houses).padStart(2)} living ${String(r.living).padStart(4)}  `
        + `AT THEIR OWN SEAT ${r.atTheirSeat}/${r.onTheRoll}  `
        + `(stationed ${r.stationed}, with a party ${r.withAParty}, elsewhere ${r.elsewhere})`
    );
    console.log(
        `  ${' '.repeat(8)} rank slots ${r.filled}/${r.slots} filled (${r.slots - r.filled} empty)  `
        + `elder rungs ${r.elderFilled}/${r.elderSlots} (${r.elderSlots - r.elderFilled} empty)  `
        + `elders ${r.elders}  gate unanswerable ${r.gateUnanswerable}/${r.houses}`
    );
    console.log(
        `  ${' '.repeat(8)} on sect ground ${r.onSectGround}/${r.living} `
        + `(${Math.round(100 * r.onSectGround / Math.max(1, r.living))}%)  in settlements ${r.inSettlements}  `
        + `empty settlements ${r.emptySettlements}`
    );
}

function sayChurn(label: string, c: Churn): void {
    const left = Object.entries(c.left).filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} ${n}`).join(', ');
    const total = Object.values(c.left).reduce((s, n) => s + n, 0);
    console.log(
        `${label}  off an elder rung ${total}: ${left || 'nobody'}  `
        + `(of the dead: ${c.diedWhileStationed} stationed, ${c.diedWithAParty} with a party)`
    );
    console.log(
        `  ${' '.repeat(label.length - 2)} onto one ${c.arrivedFromTheRoll + c.arrivedNew}: `
        + `${c.arrivedFromTheRoll} already on a roll, ${c.arrivedNew} a row the world did not hold`
    );
}

void main();
