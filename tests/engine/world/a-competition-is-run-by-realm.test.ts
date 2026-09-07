/**
 * A sect competition has a winner per realm, and a placing is a ranking.
 *
 * The design owner: *"remember those competitions are by realm too, so you can
 * have a qi condensation winner, a foundation establishment winner, and so on."*
 *
 * Which is how the genre works and also the only way a board means anything:
 * ranking a Qi Condensation disciple against a Core Formation one measures which
 * of them is further along, and everybody in the room already knew that.
 *
 * TWO DEFECTS THIS ALSO CLOSES, both measured before the change.
 *
 * A CHALLENGE PLACING WAS BOUT ORDER, not merit. `place` was
 * `placings.length + 1`, so place 3 was the winner of the second drawn bout,
 * and the fact's `beneficiaries` - which reads `place === 1` - named whoever
 * happened to be drawn first.
 *
 * AND THE SCORE WAS THE WRONG PERSON'S 18% of the time. `result.aggressor` is
 * side A of an exchange, not whoever won it, so a bout B took recorded the
 * LOSER's power as the winner's score. 30 of 167 replayed bouts, against only 5
 * genuine upsets - so the 30 were the swap, not the world.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { realmForOrdinal } from '../../../src/engine/cultivation/realms';
import type { WorldState } from '../../../src/engine/world/world-state';
import { applyGatherings, type Gathering } from '../../../src/engine/world/gatherings';

const SEEDS = ['brk-a', 'brk-b'];
const YEARS = 200;
let cached: { state: WorldState; held: Gathering[] }[] | null = null;

/**
 * Worlds lived, and the gatherings they actually returned.
 *
 * `applyGatherings` RETURNS the `Gathering[]`, placings and all - which is the
 * only surface that carries a structured placing. `WorldState` has no
 * `gatherings` field, and a first cut of this file iterated one: three
 * assertions ran over an empty array and passed without touching the engine.
 * A test that cannot fail is worse than no test, so these read the return.
 */
async function worldsLived() {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        // Keep driving until the circles actually hold something, so the
        // structured assertions below have rows to run over.
        const held: Gathering[] = [];
        for (let year = 0; year < 60 && held.length < 6; year++) {
            held.push(...applyGatherings(state, YEARS + year, (YEARS + year) * 365 + 200));
        }
        return { state, held };
    });
    return cached;
}

const gatherings = (s: WorldState) => s.history.facts.filter(f => f.kind === 'gathering');

describe('a competition is run by realm', () => {
    it('happens at all, over a long enough span', async () => {
        for (const { state } of await worldsLived()) {
            expect(gatherings(state).length).toBeGreaterThan(0);
        }
    });

    it('and names the realm each board was run at', async () => {
        // Rendered flat, a bracketed field reads as a broken ranking: two
        // people both placed first and no way to see why. The realm is what
        // makes it legible, and it is what a house is boasting about.
        let named = 0;
        for (const { state } of await worldsLived()) {
            for (const fact of gatherings(state)) {
                if (/Qi Condensation:|Foundation Establishment:|Core Formation:/.test(fact.summary)) {
                    named++;
                }
            }
        }
        expect(named).toBeGreaterThan(0);
    });

    it('and more than one person can come first, because there is more than one board', async () => {
        // The thing the owner asked for, stated as the thing it looks like: a
        // gathering with two brackets has two winners and that is correct.
        let withTwoWinners = 0;
        for (const { state } of await worldsLived()) {
            for (const fact of gatherings(state)) {
                const raw = String((fact.data as Record<string, unknown>)?.placings ?? '');
                const firsts = (raw.match(/(^|\| )1\. /g) ?? []).length;
                if (firsts > 1) withTwoWinners++;
            }
        }
        expect(withTwoWinners).toBeGreaterThan(0);
    });
});

describe('a placing is a ranking', () => {
    it('produced boards at all, so nothing below is vacuous', async () => {
        let placed = 0;
        for (const { held } of await worldsLived()) {
            for (const gathering of held) placed += gathering.placings.length;
        }
        expect(placed).toBeGreaterThan(0);
    });

    it('never ranks two people first on the same board', async () => {
        for (const { held } of await worldsLived()) {
            for (const gathering of held) {
                const firstsPerBoard = new Map<string, number>();
                for (const p of gathering.placings) {
                    if (p.place !== 1) continue;
                    firstsPerBoard.set(p.bracket, (firstsPerBoard.get(p.bracket) ?? 0) + 1);
                }
                for (const [, n] of firstsPerBoard) expect(n).toBe(1);
            }
        }
    });

    it('and every board is one realm, which is what a bracket means', async () => {
        for (const { state, held } of await worldsLived()) {
            const byId = new Map(state.npcs.map(n => [n.id, n]));
            for (const gathering of held) {
                for (const p of gathering.placings) {
                    const npc = byId.get(p.npcId);
                    if (!npc) continue;
                    // The bracket is the realm they were at. Nothing else.
                    expect(p.bracket).toBe(realmForOrdinal(npc.cultivation.realmOrdinal).key);
                }
            }
        }
    });

    it('and places run 1..n on a board with no gaps', async () => {
        for (const { held } of await worldsLived()) {
            for (const gathering of held) {
                const boards = new Map<string, number[]>();
                for (const p of gathering.placings) {
                    const places = boards.get(p.bracket) ?? [];
                    places.push(p.place);
                    boards.set(p.bracket, places);
                }
                for (const [, places] of boards) {
                    const sorted = [...places].sort((a, b) => a - b);
                    expect(sorted).toEqual(sorted.map((_, i) => i + 1));
                }
            }
        }
    });
});
