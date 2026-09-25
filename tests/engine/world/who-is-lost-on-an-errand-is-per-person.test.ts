/**
 * Who goes on a house's errand, and who does not come back, is per person.
 *
 * Two defects, one errand. A party's losses were drawn once for the whole party
 * off its strongest member, so a Tribulation Transcendence Seat was lost at the
 * rate of the disciple beside them. And a party was the strongest names on the
 * roll, pitched off the house's own best, so the Empyrean Court's Seats went on
 * every errand the Court had: looking for disciples, an escort, a visit, and a
 * ruin whose own survival ask is 12.
 *
 * RED-CHECKED. Drawing the losses off the party's tier again turns the
 * per-person test red; pitching the yearly pass's errands off the house's own
 * best again turns the world test red.
 */
import { describe, it, expect } from 'vitest';

import { forStream } from '../../../src/engine/cultivation/rng.js';
import { soakedWorld } from '../../support/soaked-world.js';
import { summonable } from '../../../src/engine/encounters/duties.js';
import { regardFor } from '../../../src/engine/cultivation/regard.js';
import {
    WENT_AND_CAME_BACK,
    WENT_AND_DID_NOT,
    postingFor,
    resolveSending,
    whoThisErrandIsPitchedFor,
    type Candidate
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';

const reason = getSendingReason('sending-to-open-an-inheritance')!;
const house = { id: 'sect-nobody', name: 'Nobody' };
const person = (id: string, ordinal: number): Candidate => ({ id, name: id, ordinal });

describe('who does not come back', () => {
    it('is read off each member against the pitch, not off the party', () => {
        // Pitched at 40. The 38 is a stretch; the 20 is out of their depth.
        const posting = postingFor({ reason, house, pitchOrdinal: 40 });
        let near = 0, far = 0, short = 0;
        for (let seed = 0; seed < 400; seed++) {
            const sending = resolveSending({
                posting,
                party: [person('near', 38), person('far', 20)],
                departsOnDay: 1000,
                rng: forStream('per-person', 'errand', seed)
            });
            if (sending.outcome === 'finished') continue;
            short++;
            if (sending.lost.some(m => m.id === 'near')) near++;
            if (sending.lost.some(m => m.id === 'far')) far++;
        }
        expect(short).toBeGreaterThan(50);
        expect(far).toBeGreaterThan(near * 3);
    });
});

describe('who goes', () => {
    it('is whoever the errand is pitched for, and nobody it is beneath', () => {
        const posting = postingFor({ reason, house, pitchOrdinal: 12 });
        const hall = [44, 42, 30, 20, 14, 12, 10, 5].map(o => person(`o${o}`, o));
        const party = whoThisErrandIsPitchedFor(posting, hall);
        expect(party.length).toBeGreaterThan(0);
        for (const member of party) expect(summonable(regardFor(12, member.ordinal).band)).toBe(true);
        expect(party[0]!.ordinal).toBe(12);
        expect(party.map(m => m.ordinal)).not.toContain(44);
    });

    it('pitches an errand at what the ground asks, and sends the people that pitch is for', async () => {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        const seeded = await soakedWorld('afford-a', { years: 0 });
        const seats = new Set(seeded.npcs.filter(n => /^npc-hollow-court-(first|second|third|fourth)-seat$/.test(n.id)).map(n => n.id));
        expect(seats.size).toBe(4);
        const before = new Set(seeded.history.facts.map(f => f.id));
        const state = await soakedWorld('afford-a', { years: 300 });

        // THE PITCH IS THE GROUND'S, NOT THE HOUSE'S. Every errand onto ground
        // that asks anything of somebody standing on it is pitched at what it
        // asks; pitched off the house's own best instead, the Empyrean Court sent
        // parties "at ordinal 45" onto a ruin whose survival ask is 12, and the
        // First and Second Seats were lost in one.
        const overpitched: string[] = [];
        const seatsBeneath: string[] = [];
        let counted = 0;
        for (const fact of state.history.facts) {
            if (before.has(fact.id)) continue;
            const pitch = Number(/at ordinal (\d+)/.exec(fact.summary)?.[1] ?? NaN);
            if (Number.isNaN(pitch)) continue;
            // Except the one errand a house reaches on: a house that cannot pay
            // its people walks onto ground that would, with whoever it has, and
            // its elders decide that knowing what it is.
            if (/taking what pays/.test(fact.summary)) continue;
            const ground = state.locations.find(l => l.id === fact.locationId);
            if (ground && ground.thresholds.survival > 0 && pitch > ground.thresholds.survival) {
                overpitched.push(`${ground.name} asks ${ground.thresholds.survival}: ${fact.summary}`);
            }
            for (const actor of fact.actors) {
                if (actor.role !== WENT_AND_CAME_BACK && actor.role !== WENT_AND_DID_NOT) continue;
                const who = state.npcs.find(n => n.id === actor.id);
                if (!who) continue;
                counted++;
                if (summonable(regardFor(pitch, who.cultivation.realmOrdinal).band)) continue;
                if (seats.has(actor.id)) seatsBeneath.push(`${who.name} on ${fact.summary}`);
            }
        }
        expect(counted, 'no house put anybody on an errand in three centuries').toBeGreaterThan(50);
        expect(overpitched.slice(0, 5)).toEqual([]);
        // And not one of the Court's Seats went on work beneath them.
        expect(seatsBeneath).toEqual([]);
    }, 600_000);
});
