/**
 * A count is not a roster, and nobody at the last rung is a remainder.
 *
 * This suite exists because of a specific failure. `LINEAGE_STANDINGS` recorded
 * how many people a house had ever put through the Lid, and the names lived
 * somewhere else or nowhere. The Hollow Court's six were carried as a count
 * plus one line reading "five more in succession, named on no tablet outside
 * the Court" - a row shaped like a person carrying a number - and everything
 * downstream then reported three of the most significant people in the setting
 * as names that had gone. They had not gone. Nobody had written them down.
 *
 * So `roll` sits beside `count`, and these tests hold the two together. A house
 * may withhold a NAME - several do, and that is a fact about the house rather
 * than a gap in the data - but it may not withhold that somebody existed.
 */

import { describe, it, expect } from 'vitest';

import { LINEAGE_STANDINGS, IMMORTAL_CHANNELS } from '../../src/data/cultivation/crossings.js';
import { TRUE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';

describe('every crossing is somebody', () => {
    it('gives every house a roll as long as its count', () => {
        for (const house of LINEAGE_STANDINGS) {
            expect(house.roll.length, `${house.factionId}: ${house.count} crossings`)
                .toBe(house.count);
        }
    });

    it('titles every one of them, even where the name is refused', () => {
        for (const house of LINEAGE_STANDINGS) {
            for (const person of house.roll) {
                // Low floor on purpose: a real name can be short. 'Yin Que'
                // is seven characters and is a whole person. What must never
                // appear here is a count, which the next assertion covers.
                expect(person.title.length, `${house.factionId}`).toBeGreaterThan(2);
                // The failure mode this replaces: an entry that is a number
                // wearing a person's shape.
                expect(person.title, `${house.factionId}: ${person.title}`)
                    .not.toMatch(/^(several|some|five|four|three|two|\d+)\b/i);
                expect(person.was.length, `${house.factionId}: ${person.title}`)
                    .toBeGreaterThan(20);
            }
        }
    });

    it('orders each roll oldest first, which is how a house reads its own wall', () => {
        for (const house of LINEAGE_STANDINGS) {
            const years = house.roll.map(p => p.yearsAgo);
            expect([...years].sort((a, b) => b - a), house.factionId).toEqual(years);
        }
    });

    it('ends each roll on the crossing the house calls its most recent', () => {
        for (const house of LINEAGE_STANDINGS) {
            const last = house.roll[house.roll.length - 1];
            expect(last.yearsAgo, `${house.factionId} most recent`)
                .toBe(house.mostRecentCrossingYearsAgo);
            if (house.mostRecentCrossingName !== null) {
                expect(last.title, `${house.factionId}`).toContain(house.mostRecentCrossingName);
            }
        }
    });

    it('accounts for the founder each answering channel names', () => {
        // A channel names somebody who crossed and still answers. That person
        // has to be on their own house's roll, or the house is answering to
        // somebody it does not remember producing.
        for (const channel of IMMORTAL_CHANNELS) {
            const house = LINEAGE_STANDINGS.find(h => h.factionId === channel.factionId);
            if (!house) continue;
            const named = house.roll.some(p =>
                p.title === channel.ancestor.name
                || p.yearsAgo === channel.ancestor.crossedYearsAgo);
            expect(named, `${channel.factionId}: ${channel.ancestor.name} is not on the roll`)
                .toBe(true);
        }
    });

    it('says of each what became of them, or says nothing rather than guessing', () => {
        for (const house of LINEAGE_STANDINGS) {
            for (const person of house.roll) {
                expect(
                    person.afterCrossing === null
                    || person.afterCrossing === 'still_above'
                    || person.afterCrossing === 'died_above',
                    `${house.factionId}: ${person.title}`
                ).toBe(true);
            }
        }
    });

    it('has somebody die up there, or the layer above has no stakes', () => {
        // `docs/world/climbing/immortals.md` is explicit that ascension removes exactly
        // two of the things that kill a cultivator and none of the rest. If
        // every crossing in the world is still alive, nothing in the catalog
        // says so.
        const everyone = LINEAGE_STANDINGS.flatMap(h => h.roll);
        expect(everyone.some(p => p.afterCrossing === 'died_above'),
            'nobody in the world has died above the Lid').toBe(true);
    });

    it('puts the whole roll at the rung the ladder ends on', () => {
        // Nothing to assert per person - a crossing IS ordinal 46 by
        // definition - but the constant should be the one the engine uses, so
        // a change to the ladder cannot leave this file describing another one.
        expect(TRUE_IMMORTAL_ORDINAL).toBe(46);
        expect(LINEAGE_STANDINGS.reduce((n, h) => n + h.roll.length, 0))
            .toBe(LINEAGE_STANDINGS.reduce((n, h) => n + h.count, 0));
    });
});
