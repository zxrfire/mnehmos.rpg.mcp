/**
 * What a century of sendings costs the houses that lose people, and whether the
 * ledger is coherent at a span boundary.
 *
 * Two questions, one instrument, because both are about the same pass:
 *
 *   1. A house declares what is at stake on every errand it opens. What does a
 *      failure actually take off it, in the columns the rest of the world reads?
 *   2. `driver.test.ts > nothing is incoherent` requires every fact to be dated
 *      at or before the world's clock. A party still out when a simulated span
 *      ends was writing the news of its return anyway.
 *
 * Run: npx tsx scripts/probe-what-a-failed-sending-costs.ts [label]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { howStrongThisHouseIsNow } from '../src/engine/world/how-strong-a-house-actually-is.js';
import { cloneWorld, type WorldState } from '../src/engine/world/world-state.js';

const label = process.argv[2] ?? 'arm';
const catalog = await loadCultivationCatalog();

function fresh(seed: string): WorldState {
    return seedWorld({ seed, catalog, presentYear: 1000, population: 400 }).state;
}

const isASending = (f: { actors: readonly { role: string }[] }): boolean =>
    f.actors.some(a => a.role === 'sent' || a.role === 'lost');

// ── 1. FACTS DATED PAST THE CLOCK, ACROSS SEVERAL SPAN BOUNDARIES ────────
console.log(`### ${label}: facts dated past the world's clock`);
for (const years of [100, 200, 300, 497, 498, 499, 500, 501, 502]) {
    const state = fresh('soak-500');
    advanceWorldYears(state, years);
    const ahead = state.history.facts.filter(f => f.day > state.currentDay);
    console.log(
        `  ${String(years).padStart(4)}y  facts ${String(state.history.facts.length).padStart(6)}`
        + `  past the clock ${String(ahead.length).padStart(3)}`
        + (ahead.length > 0
            ? `  worst +${Math.max(...ahead.map(f => f.day - state.currentDay))}d`
            : '')
    );
    for (const f of ahead.slice(0, 3)) {
        console.log(`        +${f.day - state.currentDay}d ${f.kind}  ${f.summary}`);
    }
}

// ── 2. A CENTURY OF SENDINGS ─────────────────────────────────────────────
for (const seed of ['soak-500', 'soak-b', 'soak-c']) {
    const state = fresh(seed);
    const day0 = state.currentDay;
    const before = new Map(state.factions.map(f => [
        f.id,
        {
            name: f.name,
            index: howStrongThisHouseIsNow(state, f).index,
            stones: Number(f.resources.spirit_stones ?? 0),
            ground: f.controlledLocationIds.length,
            roll: state.npcs.filter(n => n.status === 'alive' && n.factionId === f.id).length
        }
    ]));
    advanceWorldYears(state, 100);

    const sendings = state.history.facts.filter(f => f.day >= day0 && isASending(f));
    const failures = sendings.filter(
        f => /None of them came back|It was not finished/.test(f.summary)
    );
    const costed = failures.filter(f => f.data && f.data.whatItTook !== undefined);
    console.log(`\n### ${label}: ${seed} - a century`);
    console.log(`  sendings in the ledger ${sendings.length}, failures ${failures.length},`
        + ` failures that cost the house anything ${costed.length}`);
    const stillOut = state.history.facts.filter(
        f => f.day >= day0 && f.actors.some(a => a.role === 'out')
    );
    console.log(`  parties still out when a span ended ${stillOut.length}`);
    for (const f of stillOut.slice(0, 2)) console.log(`    e.g. ${f.summary}`);
    const byStake = new Map<string, number>();
    for (const f of failures) {
        const key = `${String(f.data?.errand ?? 'settled elsewhere').padEnd(38)}`
            + `${String(f.data?.atStake ?? '-').padEnd(24)}`
            + `${String(f.data?.whatItTook ?? '-')}`;
        byStake.set(key, (byStake.get(key) ?? 0) + 1);
    }
    for (const [k, n] of [...byStake].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${k.padEnd(72)} ${n}`);
    }
    for (const f of costed.slice(0, 5)) {
        console.log(`    e.g. ${f.summary}`);
        console.log(`         ${JSON.stringify(f.data)}`);
    }

    const moved: { name: string; d: number; s: string }[] = [];
    for (const f of state.factions) {
        const was = before.get(f.id);
        if (!was || f.dissolvedOnDay !== null) continue;
        const now = howStrongThisHouseIsNow(state, f);
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === f.id).length;
        moved.push({
            name: f.name,
            d: now.index - was.index,
            s: `${was.index.toFixed(2)} -> ${now.index.toFixed(2)}`
                + `  stones ${was.stones} -> ${Number(f.resources.spirit_stones ?? 0)}`
                + `  ground ${was.ground} -> ${f.controlledLocationIds.length}`
                + `  roll ${was.roll} -> ${roll}`
        });
    }
    moved.sort((a, b) => a.d - b.d);
    console.log('  the five that fell furthest:');
    for (const m of moved.slice(0, 5)) console.log(`    ${m.name.padEnd(32)} ${m.s}`);
}

// ── 2b. ONE HOUSE, WITH AND WITHOUT ONE FAILURE ──────────────────────────
//
// A COUNTERFACTUAL AND NOT A SNAPSHOT PAIR. Reading the rating at the start of
// the year and again at the end measures a year of income against one afternoon
// of loss, and the income wins: the first cut of this had a house lose two
// people and a district and come out 0.25 HIGHER. So the arm is the world as it
// stands against the same world with that one failure undone.
//
// One example per column the stake can land in, because they do not behave
// alike and a single worst case would have said the rating moves when only one
// of them moves it.
{
    const state = fresh('soak-500');
    console.log(`\n### ${label}: the same house with and without one failure`);
    type Case = { summary: string; data: Record<string, unknown>; houseId: string; lost: string[] };
    const worstOf = new Map<string, { cost: number; hit: Case }>();
    advanceWorldYears(state, 100);
    for (const f of state.history.facts) {
        if (!isASending(f) || !f.data || f.data.whatItTook === undefined) continue;
        const took = String(f.data.whatItTook);
        if (took === 'nothing the world holds') continue;
        const ground = String(f.data.groundGivenUp ?? '').split(' ').filter(Boolean);
        const cost = Number(f.data.stonesLost ?? 0)
            + ground.length * 100_000
            + f.actors.filter(a => a.role === 'lost').length * 20_000;
        const held = worstOf.get(took);
        if (held && held.cost >= cost) continue;
        worstOf.set(took, {
            cost,
            hit: {
                summary: f.summary,
                data: f.data as Record<string, unknown>,
                houseId: f.factionIds[0],
                lost: f.actors.filter(a => a.role === 'lost').map(a => a.id)
            }
        });
    }
    for (const worst of [...worstOf.values()].map(v => v.hit)) {
        const data = worst.data as Record<string, unknown>;
        const faction = state.factions.find(f => f.id === worst!.houseId)!;
        console.log(`  ${faction.name}: ${worst.summary}`);
        console.log(`  ${JSON.stringify(data)}`);
        const arm = (name: string, put: {
            stones?: boolean; ground?: boolean; people?: boolean;
        }): void => {
            const undone = cloneWorld(state);
            const back = undone.factions.find(f => f.id === worst!.houseId)!;
            if (put.stones) {
                back.resources.spirit_stones =
                    Number(back.resources.spirit_stones ?? 0) + Number(data.stonesLost ?? 0);
            }
            if (put.ground) {
                for (const id of String(data.groundGivenUp ?? '').split(' ').filter(Boolean)) {
                    const at = undone.locations.findIndex(l => l.id === id);
                    if (at < 0) continue;
                    undone.locations[at] = {
                        ...undone.locations[at], controllingFactionId: back.id
                    };
                    if (!back.controlledLocationIds.includes(id)) {
                        back.controlledLocationIds.push(id);
                    }
                    if (undone.locations[at].kind === 'vein') {
                        back.resources.veins = Number(back.resources.veins ?? 0) + 1;
                    }
                }
            }
            if (put.people) {
                for (const id of worst!.lost) {
                    const at = undone.npcs.findIndex(n => n.id === id);
                    if (at >= 0) {
                        undone.npcs[at] = {
                            ...undone.npcs[at], status: 'alive', factionId: back.id
                        };
                    }
                }
            }
            const r = howStrongThisHouseIsNow(undone, back);
            console.log(`    ${name.padEnd(34)} index ${r.index.toFixed(2).padStart(6)}`
                + `  rungs ${r.rungsItCouldField.toFixed(2).padStart(6)}`
                + `  ranks ${r.components.ranks.toFixed(4)}`
                + `  finance ${r.components.finance.toFixed(4)}`);
        };
        arm('as it actually stands', {});
        arm('with the stones back', { stones: true });
        arm('with the ground back', { ground: true });
        arm('with the people back', { people: true });
        arm('had the errand simply gone well', { stones: true, ground: true, people: true });
    }
}

// ── 3. DOES A HOUSE RECOVER? FIVE CENTURIES ──────────────────────────────
{
    const state = fresh('soak-500');
    console.log(`\n### ${label}: five centuries`);
    for (let c = 1; c <= 5; c++) {
        advanceWorldYears(state, 100);
        const live = state.factions.filter(f => f.dissolvedOnDay === null);
        const idx = live.map(f => howStrongThisHouseIsNow(state, f).index).sort((a, b) => a - b);
        const broke = live.filter(f => Number(f.resources.spirit_stones ?? 0) <= 0).length;
        const noGround = live.filter(f => f.controlledLocationIds.length === 0).length;
        console.log(
            `  ${c * 100}y  houses ${String(live.length).padStart(3)}`
            + `  median index ${(idx[Math.floor(idx.length / 2)] ?? 0).toFixed(2)}`
            + `  min ${(idx[0] ?? 0).toFixed(2)}  max ${(idx[idx.length - 1] ?? 0).toFixed(2)}`
            + `  broke ${broke}  holding nothing ${noGround}`
        );
    }
}
