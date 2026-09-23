/**
 * How big a death is, and what the world does about it.
 *
 * Three constants decided the size of every death and none of them read the
 * dead: `elder_died` emitted `local`/`faction`/0.8-at-most, a killing emitted
 * `personal`/`regional`/0.45, so the First Seat of the Hollow Court dying and an
 * outer disciple dying were the same event to four tenths of one number. The
 * design owner's bar is that a Seat dying is *"earth-shaking"*.
 *
 * What is pinned here: the scale comes off the rung, and the world moves - the
 * power index falls, the oaths the dead swore are released, and a chair at the
 * top of a house emptying is an event with a name.
 *
 * See `src/engine/world/what-a-death-at-this-height-is-worth.ts`.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    theWakeOfADeath,
    theWorldTakesNoticeOf,
    whatADeathIsWorth
} from '../../../src/engine/world/what-a-death-at-this-height-is-worth.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

async function world(): Promise<WorldState> {
    return seedWorld({ seed: 'afford-a', catalog: await loadCultivationCatalog() }).state;
}

describe('a death is as big as whoever died', () => {
    it('carries a rung further than a hall and further again from the top of the ladder', async () => {
        const state = await world();
        const house = state.factions.find(f => f.ranks.length > 1 && state.npcs.some(n => n.factionId === f.id))!;
        const anybody = state.npcs.find(n => n.factionId === house.id)!;

        const outer = {
            ...anybody,
            factionRankIndex: 0,
            cultivation: { ...anybody.cultivation, realmOrdinal: 5 }
        };
        const seat = {
            ...anybody,
            factionRankIndex: house.ranks.length - 1,
            cultivation: { ...anybody.cultivation, realmOrdinal: 44 }
        };

        const small = whatADeathIsWorth(outer, house);
        const large = whatADeathIsWorth(seat, house);

        // A death in a compound is that compound's business.
        expect(small.scale).toBe('personal');
        expect(small.visibility).toBe('faction');
        // The top of the ladder is not, and the two are not near each other.
        expect(large.scale).toBe('continental');
        expect(large.visibility).toBe('public');
        expect(large.magnitude).toBeGreaterThan(small.magnitude * 2);

        expect(theWorldTakesNoticeOf(small)).toBe(false);
        expect(theWorldTakesNoticeOf(large)).toBe(true);
    });

    it('drops the house power index when its strongest dies, which nothing did before', async () => {
        const state = await world();
        const house = state.factions.find(f =>
            f.ranks.length > 1 && state.npcs.filter(n => n.factionId === f.id && n.status === 'alive').length > 2)!;
        const roll = state.npcs.filter(n => n.factionId === house.id && n.status === 'alive');
        const strongest = roll.reduce((top, n) =>
            n.cultivation.realmOrdinal > top.cultivation.realmOrdinal ? n : top, roll[0]!);

        // Put them at the top of the ladder and at the top of the roll, which is
        // the case the rule is about.
        const at = state.npcs.findIndex(n => n.id === strongest.id);
        state.npcs[at] = {
            ...strongest,
            factionRankIndex: house.ranks.length - 1,
            cultivation: { ...strongest.cultivation, realmOrdinal: 44 }
        };
        house.resources.power_ordinal = 44;
        const facts = state.history.facts.length;

        // They are gone: the wake reads the roll as it now stands.
        state.npcs[at] = { ...state.npcs[at]!, status: 'physically_dead' };
        const wake = theWakeOfADeath(state, state.npcs[at]!, state.currentDay, 'They died of age.');

        expect(wake).not.toBeNull();
        expect(wake!.seatEmptied).toBe(true);
        expect(wake!.powerWas).toBe(44);
        expect(wake!.powerNow).toBeLessThan(44);
        expect(Number(house.resources.power_ordinal)).toBeLessThan(44);
        // And the succession is an event rather than the promotion pass quietly
        // refilling a chair.
        expect(state.history.facts.length).toBeGreaterThan(facts);
        expect(state.history.facts.some(f => f.kind === 'succession')).toBe(true);
    });

    it('does nothing at all for an ordinary death, which is nearly all of them', async () => {
        const state = await world();
        const house = state.factions.find(f => state.npcs.some(n => n.factionId === f.id))!;
        const anybody = state.npcs.find(n => n.factionId === house.id)!;
        const at = state.npcs.findIndex(n => n.id === anybody.id);
        state.npcs[at] = {
            ...anybody,
            factionRankIndex: 0,
            status: 'physically_dead',
            cultivation: { ...anybody.cultivation, realmOrdinal: 5 }
        };
        const facts = state.history.facts.length;

        expect(theWakeOfADeath(state, state.npcs[at]!, state.currentDay, 'They died of age.')).toBeNull();
        expect(state.history.facts.length).toBe(facts);
    });
});
