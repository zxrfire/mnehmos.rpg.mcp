/**
 * Where the world's literacy actually goes, over a long horizon.
 *
 * Distinct books held by the living falls from 71 to about 13 over five
 * thousand years. This asks which of the three places a book can be is the one
 * emptying: the library objects a house holds, the shelves those objects add up
 * to, or the people practising them.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualIdOf, shelfOf } from '../src/engine/world/manuals.js';
import type { WorldState } from '../src/engine/world/world-state.js';

function line(tag: string, state: WorldState) {
    const alive = state.npcs.filter(n => n.status === 'alive');
    const live = state.factions.filter(f => f.dissolvedOnDay === null);

    const inPeople = new Set<string>();
    for (const n of alive) for (const t of n.cultivation.techniqueIds) inPeople.add(t);

    const inObjects = new Set<string>();
    let manualRows = 0, copies = 0;
    for (const o of state.objects) {
        const id = manualIdOf(o);
        if (id === null) continue;
        manualRows++;
        copies += Number(o.data?.copies ?? 1);
        inObjects.add(id);
    }

    const onShelves = new Set<string>();
    let housesWithShelf = 0, deepShelves = 0, topShelf = 0;
    for (const f of live) {
        const shelf = shelfOf(state, f.id);
        if (shelf.length > 0) housesWithShelf++;
        const top = shelf.reduce((m, x) => Math.max(m, x.cap), 0);
        if (top >= 33) deepShelves++;
        topShelf = Math.max(topShelf, top);
        for (const m of shelf) onShelves.add(m.id);
    }
    const writtenOut = state.objects.filter(o => o.tags.includes('written-out')).length;

    console.log(
        tag.padEnd(10)
        + `alive ${String(alive.length).padStart(4)}`
        + `  houses ${String(live.length).padStart(3)} (${String(housesWithShelf).padStart(3)} with a shelf)`
        + `  distinct: people ${String(inPeople.size).padStart(3)}`
        + ` shelves ${String(onShelves.size).padStart(3)}`
        + ` objects ${String(inObjects.size).padStart(3)}`
        + `  rows ${String(manualRows).padStart(4)}/${String(copies).padStart(5)}c`
        + `  writtenOut ${String(writtenOut).padStart(3)}`
        + `  shelves>=33: ${String(deepShelves).padStart(2)} deepest ${topShelf}`
    );
}

const catalog = await loadCultivationCatalog();
for (const seed of (process.env.SEEDS ?? 'a,b').split(',')) {
    const { state } = seedWorld({ seed: `books-${seed}`, catalog });
    line(`${seed} @0`, state);
    let done = 0;
    for (const h of [500, 1500, 3000, 5000]) {
        advanceWorldYears(state, h - done, { stopOnInterrupt: false });
        done = h;
        line(`${seed} @${h}`, state);
    }
    console.log('');
}
