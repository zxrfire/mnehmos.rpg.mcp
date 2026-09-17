/**
 * What merit costs when somebody buys a thing a house wants and hands it in,
 * against what the board pays in stones for the same merit.
 *
 *   loop ratio    stones paid at the counter (catalog value times a region's
 *                 price multiplier: cheapest, median and dearest region) over
 *                 the stones the board pays alongside the same merit
 *                 (`STONES_PER_ERRAND_OF_CONTRIBUTION` per point). Above 1, buying
 *                 merit costs more stones than earning it pays.
 *   books         every live house against every capped art it lacks: wanted,
 *                 or a copy is for sale to it (`aCopyIsForSaleTo`), by grade
 *   one house     everything the catalog holds that a seeded house wants, the
 *                 merit it would credit for all of it, and the stones to buy it
 *                 all at list: how far a wealthy buyer gets before the want fills
 *
 * Run: npx tsx scripts/probe-what-buying-merit-costs.ts
 */
import { writeFileSync } from 'node:fs';
import { HERBS } from '../src/data/cultivation/herbs.js';
import { BEAST_MATERIALS } from '../src/data/cultivation/beasts.js';
import { PILLS } from '../src/data/cultivation/pills.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { REGIONS } from '../src/data/cultivation/regions/the-map.js';
import { STONES_PER_ERRAND_OF_CONTRIBUTION } from '../src/engine/encounters/duties.js';
import { makeObject } from '../src/engine/world/possessions.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { aCopyIsForSaleTo, whatTheHouseMakesOf, whatItIsWorthToAHouse, whatThisThingIs } from '../src/engine/world/what-a-house-gives-merit-for.js';
import { whatACopyIsSoldFor } from '../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const DIR = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';
const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

const multipliers = REGIONS.map(r => r.priceMultiplier).sort((a, b) => a - b);
const cheap = multipliers[0]!, mid = multipliers[Math.floor(multipliers.length / 2)]!, dear = multipliers[multipliers.length - 1]!;
say(`region price multipliers: cheapest ${cheap}, median ${mid}, dearest ${dear}`);

type Row = { id: string; name: string; grade: string; value: number; kind: 'material' | 'pill' };
const goods: Row[] = [
    ...HERBS.map(h => ({ id: h.id, name: h.name, grade: h.grade, value: h.value, kind: 'material' as const })),
    ...BEAST_MATERIALS.map(m => ({ id: m.id, name: m.name, grade: m.grade, value: m.value, kind: 'material' as const })),
    ...PILLS.map(p => ({ id: p.id, name: p.name, grade: p.grade, value: Number(p.value), kind: 'pill' as const }))
];
function rowFor(g: Row, owner: string | null) {
    return makeObject({
        id: `probe-${g.id}`, name: g.name, kind: g.kind, significance: 'significant', description: '',
        possessorId: owner, ownerId: owner, ownerName: '', locationId: null,
        tags: [g.kind, `grade:${g.grade}`],
        data: g.kind === 'pill' ? { pillId: g.id, grade: g.grade, quantity: 1 } : { materialId: g.id, grade: g.grade, value: g.value, quantity: 1 }
    });
}

function bookRow(id: string, name: string) {
    return makeObject({
        id: `probe-book-${id}`, name, kind: 'manual', significance: 'significant', description: '',
        possessorId: null, ownerId: null, ownerName: '', locationId: null, tags: ['manual'], data: { techniqueId: id, copies: 1 }
    });
}

say('\n== loop ratio, goods, by grade (median of the grade) ==');
for (const grade of ['mortal', 'earth', 'heaven', 'immortal', 'chaos']) {
    const rows = goods.filter(g => g.grade === grade).sort((a, b) => a.value - b.value);
    if (rows.length === 0) continue;
    for (const pick of [rows[0]!, rows[Math.floor(rows.length / 2)]!, rows[rows.length - 1]!]) {
        const row = rowFor(pick, null);
        const merit = whatItIsWorthToAHouse(row, whatThisThingIs(row)!);
        const boardStones = merit * STONES_PER_ERRAND_OF_CONTRIBUTION;
        const ratio = (m: number) => boardStones > 0 ? (pick.value * m / boardStones).toFixed(2) : '-';
        say(`${grade.padEnd(8)} ${pick.name.padEnd(34)} value ${String(pick.value).padStart(7)}  merit ${String(merit).padStart(6)}  `
            + `board pays ${Math.round(boardStones).toString().padStart(7)} stones  ratio cheap/median/dear ${ratio(cheap)}/${ratio(mid)}/${ratio(dear)}`);
    }
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: 'shape-a', catalog });
    say('\n== one house: everything the catalog holds that it wants, bought at list in a median region ==');
    const houses = state.factions.filter(f => f.dissolvedOnDay === null)
        .sort((a, b) => Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0));
    const sample = [houses[0]!, houses[Math.floor(houses.length / 2)]!, houses[houses.length - 1]!];

    say('\n== books: every live house against every capped art it does not hold ==');
    const tally: Record<string, Record<string, number>> = {};
    let wantedButForSale = 0;
    for (const house of houses) {
        for (const art of TECHNIQUES) {
            if (art.cap == null) continue;
            const made = whatTheHouseMakesOf(state as WorldState, house.id, bookRow(art.id, art.name));
            if (made.why === 'it_already_has_one') continue;
            const forSale = aCopyIsForSaleTo(state as WorldState, house, art.id);
            const byGrade = (tally[art.grade] ??= {});
            const bump = (key: string) => { byGrade[key] = (byGrade[key] ?? 0) + 1; };
            bump(made.wanted ? 'wanted' : made.why);
            if (forSale !== null) bump(forSale.from === 'a_stall' ? 'forSaleAtAStall' : 'forSaleBySomebody');
            if (made.wanted && forSale !== null) wantedButForSale++;
            if (made.wanted) byGrade.wantedMerit = (byGrade.wantedMerit ?? 0) + made.merit;
        }
    }
    for (const [grade, counts] of Object.entries(tally)) say(`${grade.padEnd(8)} ${JSON.stringify(counts)}`);
    say(`wanted and also for sale to that house (should be none): ${wantedButForSale}`);

    for (const house of sample) {
        let merit = 0, stones = 0, kinds = 0, meritCounted = 0, meritBooks = 0, books = 0, booksCopyStones = 0;
        const byGrade: Record<string, number> = {};
        for (const g of goods) {
            const made = whatTheHouseMakesOf(state as WorldState, house.id, rowFor(g, null));
            if (!made.wanted) continue;
            kinds++;
            merit += made.merit;
            stones += g.value * mid;
            byGrade[g.grade] = (byGrade[g.grade] ?? 0) + made.merit;
            if (made.why === 'it_cannot_afford_one') meritCounted += made.merit;
        }
        for (const art of TECHNIQUES) {
            if (art.cap == null) continue;
            const made = whatTheHouseMakesOf(state as WorldState, house.id, bookRow(art.id, art.name));
            if (!made.wanted) continue;
            books++;
            meritBooks += made.merit;
            booksCopyStones += whatACopyIsSoldFor(art.id) ?? 0;
        }
        say(`${house.name} (power ${house.resources.power_ordinal}, purse ${house.resources.spirit_stones}): `
            + `${kinds} kinds of goods wanted, ${merit} merit for one of each (${meritCounted} of it counted grades it cannot afford), `
            + `${Math.round(stones)} stones at list; by grade ${JSON.stringify(byGrade)}; `
            + `${books} books wanted, ${meritBooks} merit, ${booksCopyStones} stones if copies were sold`);
    }
    writeFileSync(`${DIR}/probe-what-buying-merit-costs.txt`, lines.join('\n'), 'utf8');
}
void main();
