/**
 * How much of the map can put the question at all, and what the answer wants.
 *
 * The road exists: a thing past the change holds no stock and can still be
 * asked for a piece of itself. Two things about it are properties of the WORLD
 * rather than of the code, and neither can be asserted from a catalog read:
 *
 *   how many squares hold something that could be asked, which is
 *   `beastsOnThisGround` over every location of a pinned world; and
 *
 *   which rung each of them stands on, which decides whether a kindness is
 *   enough or whether they want something DONE.
 *
 *   npx tsx scripts/probe-what-a-changed-beast-will-be-asked-for.ts [seeds...]
 *
 * No provider, no model, no network. Seconds per world.
 */

import { makeGameInWorld } from '../tests/web/harness.js';
import { resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import { beastsOnThisGround } from '../src/engine/world/hunting-a-spirit-beast.js';
import { idOfTheOneOnThisGround } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { theRungTheyAreOn } from '../src/web/asking-something-that-can-refuse-for-a-piece-of-it.js';
import {
    whatGivingItCosts,
    whatItCouldPartWith
} from '../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself.js';
import { BEASTS, type Beast } from '../src/data/cultivation/beasts.js';

const SEEDS = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ['probe-one', 'probe-two', 'probe-three', 'probe-four', 'probe-five'];

async function main(): Promise<void> {
    console.log('WHAT EACH SPEAKING ENTRY WOULD PART WITH, AND WHAT IT WANTS FOR IT');
    for (const beast of BEASTS.filter(one => one.speaks)) {
        const pieces = whatItCouldPartWith(beast);
        for (const piece of pieces) {
            const cost = whatGivingItCosts({
                beast, piece, subjectId: beast.id, turn: 0, onDay: 0, seenBy: ['x']
            });
            console.log(
                `  ${beast.id.padEnd(34)} ${piece.material.name.padEnd(22)} `
                + `${piece.material.grade.padEnd(9)} ${String(piece.material.value).padStart(6)}st  `
                + `${cost.growsBackInYears}y/${cost.wound.severity}`
                + `${cost.doesNotComeBack ? '/permanent' : ''} `
                + `shame=${cost.shame?.severity ?? 'none'} `
                + `${piece.inTheCatalog ? '(catalog)' : '(minted)'}`
            );
        }
    }

    console.log('\nHOW MANY SQUARES CAN PUT THE QUESTION, PER PINNED WORLD');
    for (const seed of SEEDS) {
        resetCultivationWorlds();
        const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
        await harness.game.newRun('Probe');
        const world = (await harness.game.loadWorld())!;

        const reach = new Map<number, number>();
        const byBeast = new Map<string, number>();
        const wants = new Map<string, number>();
        for (const place of world.locations) {
            // The verb's own read of the ground it is standing on.
            const ground = {
                sealed: place.sealed,
                onAVein: place.qiDensity >= 60 || place.environment.resources.includes('qi')
            };
            const speaking = beastsOnThisGround(ground).filter(one => one.speaks);
            reach.set(speaking.length, (reach.get(speaking.length) ?? 0) + 1);
            for (const one of speaking) {
                byBeast.set(one.id, (byBeast.get(one.id) ?? 0) + 1);
                // THE RUNG IS PER INDIVIDUAL, so it is asked per piece of
                // ground: the one holding this gorge is not the one holding
                // the next, and `openHandednessOf` reads the individual.
                const rung = theRungTheyAreOn(idOfTheOneOnThisGround(one.id, place.id), one);
                const key = `${one.id} wants ${rung}`;
                wants.set(key, (wants.get(key) ?? 0) + 1);
            }
        }
        const total = world.locations.length;
        const spread = [...reach.entries()].sort((a, b) => a[0] - b[0])
            .map(([n, count]) => `${n}: ${count} (${Math.round(100 * count / total)}%)`)
            .join('  ');
        console.log(`  ${seed.padEnd(14)} ${total} locations   reachable count -> ${spread}`);
        for (const [id, count] of [...byBeast.entries()].sort()) {
            console.log(`      ${id.padEnd(34)} reachable at ${count} `
                + `(${Math.round(100 * count / total)}%)`);
        }
        for (const [key, count] of [...wants.entries()].sort()) {
            console.log(`        ${key.padEnd(48)} ${count}`);
        }
        harness.db.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
