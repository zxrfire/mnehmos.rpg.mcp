/**
 * Who came through, and what they brought.
 *
 * discovery.md names the traveller as one of the scarce sources a step up the
 * ladder can come from, and of that list it is the only one available to a
 * cultivator with no sect, no archive, no money and no reason to have been
 * anywhere. So these tests are about the thing being reliable enough to be the
 * engine of discovery for the ordinary case, and about it still granting a
 * name rather than a meaning.
 */

import { describe, it, expect } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng';
import {
    TRAVELLER_AMBIENT_CHANCE,
    TRAVELLER_LISTENING_CHANCE,
    passingThrough,
    placedStatement,
    travellerProse,
    whisperStatement,
    type TravellerPlace
} from '../../../src/engine/social/travellers';

const HERE = 'region-home';

const PLACES: TravellerPlace[] = [
    { id: 'Nextvillage', name: 'Nextvillage', regionId: HERE },
    { id: 'Kettle', name: 'Kettle', regionId: 'region-far' },
    { id: 'Hollowmarket', name: 'Hollowmarket', regionId: 'region-far' },
    { id: 'Sixmile', name: 'Sixmile', regionId: 'region-far' }
];

function draw(occasion: string, extra: Partial<Parameters<typeof passingThrough>[0]> = {}) {
    return passingThrough({
        rng: forStream('traveller-seed', 'test', occasion),
        unknownPlaces: PLACES,
        hereRegionId: HERE,
        ...extra
    });
}

describe('somebody came through', () => {
    it('happens often enough to be the route out for a cultivator with nothing', () => {
        let seen = 0;
        for (let i = 0; i < 400; i++) if (draw(`amb-${i}`)) seen++;
        // The channel that has to work for somebody who never leaves. Not
        // every scene, and not so rare that a year in one village produces
        // nobody.
        expect(seen).toBeGreaterThan(20);
        expect(seen).toBeLessThan(200);
    });

    it('pays off more for somebody deliberately watching the road', () => {
        const count = (listening: boolean) => {
            let seen = 0;
            for (let i = 0; i < 400; i++) if (draw(`l-${listening}-${i}`, { listening })) seen++;
            return seen;
        };
        expect(count(true)).toBeGreaterThan(count(false));
        expect(TRAVELLER_LISTENING_CHANCE).toBeGreaterThan(TRAVELLER_AMBIENT_CHANCE);
    });

    it('comes through a busy door more than a dead end', () => {
        const count = (traffic: number) => {
            let seen = 0;
            for (let i = 0; i < 400; i++) if (draw(`t-${traffic}-${i}`, { traffic })) seen++;
            return seen;
        };
        expect(count(1)).toBeGreaterThan(count(0));
        // And a dead end is not sealed. Somebody walks through everywhere.
        expect(count(0)).toBeGreaterThan(0);
    });

    it('is replayable: the same seed and occasion produce the same person', () => {
        for (let i = 0; i < 20; i++) {
            expect(draw(`rep-${i}`)).toEqual(draw(`rep-${i}`));
        }
    });

    it('says nothing when the listener already knows everywhere', () => {
        expect(passingThrough({
            rng: forStream('traveller-seed', 'empty'),
            unknownPlaces: [],
            hereRegionId: HERE
        })).toBeNull();
    });
});

describe('what a traveller is worth', () => {
    it('mostly comes from somewhere else, which is the whole point of a road', () => {
        let foreign = 0;
        let total = 0;
        for (let i = 0; i < 300; i++) {
            const traveller = draw(`far-${i}`);
            if (!traveller) continue;
            total++;
            if (traveller.from.regionId !== HERE) foreign++;
        }
        expect(total).toBeGreaterThan(10);
        // Local geography is what everybody already has. A road that only ever
        // brings news of the next village over is not a road.
        expect(foreign).toBe(total);
    });

    it('falls back to whatever is left when only local names are unheard of', () => {
        let seen = 0;
        for (let i = 0; i < 200; i++) {
            const traveller = passingThrough({
                rng: forStream('traveller-seed', 'local-only', `x-${i}`),
                unknownPlaces: [PLACES[0]],
                hereRegionId: HERE
            });
            if (traveller) {
                expect(traveller.from.id).toBe('Nextvillage');
                seen++;
            }
        }
        expect(seen).toBeGreaterThan(0);
    });

    it('names at most two places, and usually one', () => {
        let withMention = 0;
        let total = 0;
        for (let i = 0; i < 300; i++) {
            const traveller = draw(`m-${i}`);
            if (!traveller) continue;
            total++;
            expect(traveller.mentions.length).toBeLessThanOrEqual(1);
            expect(traveller.mentions.some(m => m.id === traveller.from.id)).toBe(false);
            if (traveller.mentions.length > 0) withMention++;
        }
        expect(withMention).toBeGreaterThan(0);
        expect(withMention).toBeLessThan(total);
    });

    it('records where it came from honestly, and never says it was right', () => {
        const traveller = firstTraveller();
        expect(traveller.note).toContain(traveller.from.name);
        expect(traveller.note).toMatch(/days/);
        // A stranger with no reason to lie and no reason to be accurate.
        expect(traveller.confidence).toBeGreaterThan(0.2);
        expect(traveller.confidence).toBeLessThan(0.6);
        expect(traveller.note).not.toMatch(/true|reliable|correct|trustworthy/i);
    });

    it('gives a shape rather than a name, because they did not give one', () => {
        const traveller = firstTraveller();
        expect(traveller.shape.length).toBeGreaterThan(0);
        expect(traveller.shape).toMatch(/^(A|An|Somebody)\b/);
    });
});

describe('the prose grants the name and not the meaning', () => {
    it('says where they came from and explains nothing about it', () => {
        const traveller = firstTraveller();
        const prose = travellerProse(traveller);

        expect(prose).toContain(traveller.from.name);
        // discovery.md: "If the next paragraph tells the player what the Sill
        // is, the moment has been spent for nothing."
        expect(prose).not.toMatch(/which is|that is the|a sect|a province|famous|known for/i);
        expect(prose).toMatch(/the way you would say a weekday/);
        // And it never calls the player "this cultivator", which is the engine
        // talking about the player in the third person.
        expect(prose).not.toMatch(/this cultivator/i);
    });

    it('writes two different sentences for the two different stages', () => {
        const place = PLACES[1];
        expect(placedStatement(place, 11)).toContain('11 days');
        expect(placedStatement(place, 11)).toMatch(/road goes/);
        expect(whisperStatement(place)).toMatch(/remains unknown/);
    });
});

function firstTraveller() {
    for (let i = 0; i < 200; i++) {
        const traveller = draw(`first-${i}`);
        if (traveller) return traveller;
    }
    throw new Error('no traveller in 200 draws, which is itself the bug');
}
