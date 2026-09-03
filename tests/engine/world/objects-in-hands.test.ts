/**
 * A rated object is in somebody's hands, and a fight prices it.
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────
 *
 * `bestObjectHeldBy` in `gatherings.ts` compares `possessorId` against
 * `npc.id`, and NOTHING IN A SEEDED WORLD PUT A RATED OBJECT IN A PERSON'S
 * HANDS - so it returned null for everybody and the weapon slot in every fight
 * the world simulation runs was empty. Measured at seeding, identical across
 * seeds: of eighteen rated objects, ZERO were possessed by an `NpcRecord`.
 *
 * The cause was one unmade join. The artifact catalog named the Hollow Court's
 * four Seats with a positional key (`seat-first`) that predated
 * `hollow-court-roster.ts` naming them as people, so four of the five strongest
 * reachable objects in the world were keyed to nobody. The catalog now names
 * them by the id it holds people under, and `artifact-placement.ts` translates
 * a catalog person to the world row the seeder instantiates them as.
 *
 * ── WHAT IS BEING ASSERTED, AND WHAT IS DELIBERATELY NOT ─────────────────
 *
 * That an object whose holder is a PERSON reaches that person. Not that
 * everybody is armed: a house's vault is a coherent place for a thing to be, an
 * object lying in a ruin is a real thing in this world, and the three rows held
 * above the Lid must stay unreachable. Each of those is checked to stay put.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { combatantOf } from '../../../src/engine/world/gatherings.js';
import { assessPower } from '../../../src/engine/cultivation/combat.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { WorldCatalog } from '../../../src/engine/world/catalog.js';

let catalog: WorldCatalog;

beforeAll(async () => {
    catalog = await loadCultivationCatalog();
});

function world(seed: string): WorldState {
    return seedWorld({ seed, catalog }).state;
}

/** Every rated object a living person is actually holding. */
function inSomebodysHands(state: WorldState) {
    const alive = new Set(state.npcs.filter(n => n.status === 'alive').map(n => n.id));
    return state.objects.filter(
        o => o.power !== null && o.possessorId !== null && alive.has(o.possessorId)
    );
}

describe('a rated object reaches the person the catalog says is holding it', () => {
    it('puts the withdrawn Seats\' objects in the Seats\' hands, on every seed', () => {
        // Seeding is deterministic in the placement of artifacts - there is no
        // draw here at all - so three seeds is a check that nothing upstream
        // perturbs it rather than a sample.
        for (const seed of ['hands-a', 'hands-b', 'hands-c']) {
            const state = world(seed);
            const held = inSomebodysHands(state);
            expect(held.length).toBeGreaterThan(0);

            const byHolder = new Map(held.map(o => [o.possessorId, o]));
            for (const seat of ['first', 'second', 'third', 'fourth']) {
                expect(byHolder.has(`npc-hollow-court-${seat}-seat`)).toBe(true);
            }
        }
    });

    it('prices what they are carrying into the fight, through the ordinary resolver', () => {
        const state = world('hands-priced');
        const seat = state.npcs.find(n => n.id === 'npc-hollow-court-first-seat');
        expect(seat).toBeDefined();

        const armed = combatantOf(seat!, state);
        expect(armed.weapon).not.toBeNull();
        expect(armed.weapon!.id).toBe('hollow-unwritten-length');

        // The same person with nothing in their hands, priced by the same call.
        // An object is worth what the catalog says it is worth in any hand, and
        // the whole of the difference is that one line.
        const bare = assessPower({ ...armed, weapon: null }, { ambient: 'normal' });
        const carrying = assessPower(armed, { ambient: 'normal' });
        expect(carrying.total).toBeGreaterThan(bare.total);
        expect(carrying.weapon).not.toBeNull();
    });

    it('leaves a vault a vault, a ruin a ruin, and the far side of the Lid unreachable', () => {
        const state = world('hands-untouched');
        const npcIds = new Set(state.npcs.map(n => n.id));
        const byId = new Map(state.objects.map(o => [o.id, o]));

        // In its owner's hold. `war-melee.ts` excludes a house's stores from
        // breakage on exactly this test, so moving one out of the vault is a
        // decision and not a tidy-up.
        expect(byId.get('sent-datum-lamp')?.possessorId).toBe('apex-deep-survey');
        expect(byId.get('artifact-the-standing-weight')?.possessorId).toBe('house-anchorhold');

        // Held by nobody, which is a real state and not a gap.
        expect(byId.get('artifact-the-severed-ledger-blade')?.possessorId).toBeNull();
        expect(byId.get('artifact-azure-sword-tally')?.possessorId).toBeNull();

        // NOTHING_AT_FORTY_SIX_IS_EVER_LEFT. These three are carried by people
        // above the Lid, and no party in this world can reach, ask, rob or
        // inherit from them - so their holder must NOT resolve to a world row.
        for (const id of ['carried-the-first-course', 'carried-the-second-edge', 'carried-the-first-datum']) {
            const object = byId.get(id);
            expect(object?.power).toBe(46);
            expect(npcIds.has(object!.possessorId!)).toBe(false);
        }
    });
});
