/**
 * How much sooner does a house hear from its people away on communication
 * talismans, and does hearing sooner change the shape of the world?
 *
 * ── WHAT IT SAID, BOTH ARMS, TWO SEEDS AT TWO HUNDRED YEARS ──────────────
 *
 * Taken in ONE process off a temporary pressure switch that turned the yearly
 * word pass off, since removed, seeds `afford-a` and `demography`, summed, in the
 * order off, on, on, off. The tree held other agents' uncommitted work at the
 * time (recruits and the Internal Affairs office, house survival, the board-work
 * pass), so the arms are only comparable with each other.
 *
 * THREE TIMES. The earlier cuts are kept because each is what the next was built
 * against.
 *
 *                             first cut          second           third
 *   reports                       1,578             611             692
 *     of them promotions          1,145             218               -
 *     seat not by the end           151              68               -
 *   look-ins                     10,199           9,901           9,776
 *     found somebody gone           249             267             213
 *     due, nobody to spare        1,741           1,666           1,895
 *   stacks handed out            11,186           7,733           9,959
 *   recruits reported on a slip   1,558             952           1,327
 *     still owed at the end           7              16               2
 *   houses with none at 200 years     -          30 of 87       5 of 93
 *   advance, on against off   47.5s / 39.0s   38.9s / 37.8s   40.8s / 38.9s
 *                                                             40.6s / 37.6s
 *
 * WHAT MOVED BETWEEN THEM. Speed: a person's stack and a house's stock are read
 * through one index a pass (`theStacksInHand`) rather than a walk of every object
 * per hand-out and per burn, and how far a slip carries is read over the
 * provinces rather than a full walk per seat (`howFarFromTheSeat`). Both were
 * held identical to what they replaced, in one process, over sixty years: the
 * same ledger, the same people, the same objects in the same order. Noise: a
 * fact about another house or the ground has to weigh `WORTH_REPEATING`, so a
 * rival's elder raised is sent and a master taken is not. And the stock: the
 * pass no longer cuts. The house posts the work on its board while it is short
 * and it lands when whoever took it is done. Taken 55 times in 945 short
 * house-years on `afford-a` over a century, because the people who can cut are
 * mostly teaching, posted, or on other board work; so at two hundred years 30 of
 * 87 houses had none (13 of 90 without the pass, which are houses founded since
 * that were never stocked) and 58 were short, and fewer hand-outs is why fewer
 * recruits went on a slip.
 *
 * THE THIRD: a week's work at home is taken by somebody at the seat who is
 * teaching or at the work of their rank, without taking them off it
 * (`aSittingAtHomeIsTaken`). House-years a house had none while somebody at
 * Foundation or above stood at its seat: 35 of 14,165, the longest six years
 * running and two longer than three, against 67 and fourteen years when an old
 * board term's tag still kept a teacher off it. Of the five houses with none at
 * the end, two were never stocked, one of those with somebody who could cut
 * away from its seat. Without the pass the board and the sittings still run, so
 * that arm's 3 of 91 are houses founded since that nothing was handed out of.
 *
 *   second, by what the word was about    n     sooner than the seat,  seat not
 *                                               mean days, where heard  by the end
 *     promotion                          218     20.0                    4
 *     opportunity                        120     20.0                   35
 *     said_in_public                      80     19.9                    0
 *     inheritance                         46     20.0                   16
 *     territory_changed                   30     24.7                    0
 *     catastrophe                         26     20.0                    2
 *     death                               25     20.0                    0
 *     resource_contested                  20     20.0                    0
 *     grudge_opened                       18     20.0                    1
 *     gave_up_waiting                     12     20.0                   10
 *     faction_founded, zone_forbidden, treasure_found, war, spirit_tide,
 *     marriage, gathering                 16     20.0                    0
 *
 *   world shape, second      word on     word off
 *     living                   1,500       1,519
 *     live seated houses          87          90
 *     members at own seat        364         380
 *     members away               554         594
 *     gate unanswerable            7           9
 *     find-errand news rows      317         317
 *
 * WHAT THAT MEANS. A post sits in its house's own province, so the usual gain is
 * the province's own delay, twenty days (`DAYS_NEWS_TAKES`), and more where the
 * news would not have reached the seat at all. A door opening is rarely where a
 * post is, and in the second run none was sent. A fact that already names the
 * house is never sent, because it is already the house's.
 *
 * Nothing blew up. Across the two runs every shape figure moved both ways by a
 * few per cent, which is the worlds diverging rather than a direction.
 *
 * ── WHAT IT READS NOW ────────────────────────────────────────────────────
 *
 * The switch is gone, so this reads one arm off the ledger: word sent home by the
 * kind of fact it was about and how many days after that fact it went, the
 * look-ins that found somebody gone or hurt, and the world's shape.
 *
 * Run: npx tsx scripts/probe-how-soon-a-house-hears-from-its-people-away.ts
 *   PROBE_SEEDS   comma-separated world seeds (default afford-a,demography)
 *   PROBE_YEARS   horizon in years (default 200)
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { couldHostAGuest } from '../src/engine/world/standing-at-the-gate-of-a-house.js';
import { isWordSentHome } from '../src/engine/world/a-communication-talisman-carries-word-home.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,demography').split(',');
const YEARS = Number(process.env.PROBE_YEARS ?? 200);

const catalog = await loadCultivationCatalog();
const byKind: Record<string, { n: number; days: number }> = {};
let recruits = 0;
const lookIns = { gone: 0, hurt: 0 };
let living = 0, houses = 0, atSeat = 0, away = 0, gate = 0;
for (const seed of SEEDS) {
    const { state } = seedWorld({ seed, catalog });
    const started = Date.now();
    advanceWorldYears(state, YEARS, { stopOnInterrupt: false });
    const byId = new Map(state.history.facts.map(f => [f.id, f] as const));
    for (const word of state.history.facts.filter(isWordSentHome)) {
        const about = typeof word.data.wordOf === 'string' ? byId.get(word.data.wordOf) : undefined;
        if (!about) { recruits++; continue; }
        const row = byKind[about.kind] ?? { n: 0, days: 0 };
        row.n++;
        row.days += word.day - about.day;
        byKind[about.kind] = row;
    }
    for (const f of state.history.facts) {
        if (typeof f.data.lookedInOn !== 'string') continue;
        if (f.data.status === 'alive') lookIns.hurt++; else lookIns.gone++;
    }
    const seated = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId);
    houses += seated.length;
    living += state.npcs.filter(n => n.status === 'alive').length;
    for (const f of seated) {
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === f.id);
        atSeat += roll.filter(n => n.locationId === f.seatLocationId).length;
        away += roll.filter(n => n.activity?.kind === 'stationed' || n.activity?.kind === 'out_with_a_party').length;
        if (!roll.some(n => n.locationId === f.seatLocationId && couldHostAGuest(n.factionRankIndex, f.ranks.length))) gate++;
    }
    console.log(`${seed}: ${Date.now() - started}ms`);
}
console.log(`\n== ${SEEDS.length} seeds x ${YEARS} years ==`);
for (const [kind, row] of Object.entries(byKind).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${kind.padEnd(22)} n=${String(row.n).padStart(5)}  sent a mean ${(row.days / row.n).toFixed(1)} days after it happened`);
}
console.log(`  word not about a fact (recruits and the like): ${recruits}`);
console.log(`  look-ins that found somebody gone ${lookIns.gone}, hurt ${lookIns.hurt}`);
console.log(`  living ${living}, houses ${houses}, at own seat ${atSeat}, away ${away}, gate unanswerable ${gate}`);
