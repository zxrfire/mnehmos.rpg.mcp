/**
 * A landed theft moves something out of one purse and into another.
 *
 * The verb resolved, wrote a grudge and drew a reprisal for a while before it
 * moved any value at all, which made every consequence downstream of it a
 * consequence of nothing. Rich and poor are both here because the deed is
 * priced on what the loss was against what they had, so the same kind of taking
 * from two people is two different wrongs.
 *
 * WHAT THIS FILE USED TO BE: a played loop of up to ten steals against each of
 * two people, printing what came back and asserting nothing, for minutes. What
 * is asserted now is the lift itself (`whatALiftTook`, the one write every
 * landed theft goes through) and the price the ledger reads off it
 * (`whatItWasWorth`, at the cost `asking-verbs.ts` hands it). Whether a steal
 * lands is the resolver's question and is not this file's.
 *
 * THE WORLD IS PINNED, because rich and poor are picked off its people.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness';
import { earningsPerYear } from '../../src/engine/cultivation/origin';
import { whatItWasWorth } from '../../src/engine/social-leverage/what-a-deed-leaves';
import { severityRank } from '../../src/engine/social/grudges';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import type { WorldState } from '../../src/engine/world/world-state';
import type { Cultivator } from '../../src/schema/cultivation';
import type { WhatALiftTook } from '../../src/web/asking-verbs';

const WORLD = 'a-theft-takes-something';

type Thief = {
    atHand: WorldState | null;
    loadWorld(): Promise<WorldState | null>;
    whatALiftTook(cultivator: Cultivator, party: { id: string; name: string }): WhatALiftTook | null;
};

describe('a landed theft', () => {
    let h: Harness;
    let thief: Thief;
    let cultivatorId: string;
    const loose = (npc: NpcRecord) => Math.floor(earningsPerYear(npc.cultivation.realmOrdinal));
    /** The purse the lift reads: a person the roster stores, and the world's row otherwise. */
    const purseOf = (npc: NpcRecord) => h.repos.cultivators.getById(npc.id)?.spiritStones ?? npc.spiritStones;

    beforeAll(async () => {
        h = await makeGameInWorld({ seed: WORLD, worldSeed: WORLD, worldEnabled: true });
        const { cultivator } = await h.game.newRun('Wen Shuyi');
        cultivatorId = cultivator.id;
        thief = h.game as unknown as Thief;
        thief.atHand = await thief.loadWorld();
    }, 300_000);

    /** Lift off one person and say what moved where. */
    function liftOff(pick: (npc: NpcRecord) => boolean) {
        const npc = thief.atHand!.npcs
            // Never the player's own row: they are on the roster too, and robbing
            // yourself reads the same sheet on both sides of the transfer.
            .filter(row => row.status === 'alive' && row.id !== cultivatorId && pick(row))
            .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
        expect(npc, 'nobody in this world fits').toBeDefined();
        const purse = h.repos.cultivators.getById(cultivatorId)!;
        const took = thief.whatALiftTook(purse, { id: npc!.id, name: npc!.name })!;
        // Two places a person can live, and the lift reads the stored one first.
        const stored = h.repos.cultivators.getById(npc!.id);
        const victimNow = stored ? stored.spiritStones : thief.atHand!.npcs.find(row => row.id === npc!.id)!.spiritStones;
        return {
            took,
            had: took.hadBefore,
            victimNow,
            thiefGained: h.repos.cultivators.getById(cultivatorId)!.spiritStones - purse.spiritStones,
            worth: whatItWasWorth({
                cause: 'robbery', paidBy: 'subject', cost: took.taken / took.hadBefore, onDay: 0, description: 'Lifted.'
            })
        };
    }

    let rich: ReturnType<typeof liftOff>;
    let poor: ReturnType<typeof liftOff>;

    it('moves stones from somebody with a great deal, and not all of it', () => {
        rich = liftOff(npc => purseOf(npc) > 4 * loose(npc) && loose(npc) > 0);
        expect(rich.took.taken).toBeGreaterThan(0);
        expect(rich.took.taken).toBeLessThan(rich.had);
        expect(rich.victimNow).toBe(rich.had - rich.took.taken);
        expect(rich.thiefGained).toBe(rich.took.taken);
    });

    it('moves everything from somebody with next to nothing', () => {
        poor = liftOff(npc => purseOf(npc) > 0 && purseOf(npc) <= loose(npc));
        expect(poor.took.taken).toBe(poor.had);
        expect(poor.victimNow).toBe(0);
        expect(poor.thiefGained).toBe(poor.had);
    });

    it('prices taking everything from the poor as the heavier wrong', () => {
        expect(severityRank(poor.worth)).toBeGreaterThan(severityRank(rich.worth));
    });
});
