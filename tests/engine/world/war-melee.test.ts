/**
 * A war is a fight between two rosters, and nothing else.
 *
 * The design owner's ruling: *obviously this can be easily simulated as a group
 * fight, right? not bespoke.* So what is pinned here is not the arithmetic of a
 * melee - `combat.test.ts` owns that - but the four things that make a war one:
 *
 *   IT IS FOUGHT       two houses at war meet, and the record says what the
 *                      RESOLVER said rather than what the inputs suggested.
 *   IT COSTS THEM      the quantity three queued features read moves while the
 *                      war runs, and it moves in opposite directions for the
 *                      two sides.
 *   IT BREAKS THINGS ONCE  only what somebody carried into the fighting is at
 *                      risk. A house's stores are not in it, and there is no
 *                      second route by which a war reaches an object.
 *   IT ENDS SOMEWHERE  the settlement reads the loser off what the fighting
 *                      cost, and a house whose war took its seniors breaks up -
 *                      which is the third fate in `war-spoils.ts` finally
 *                      having a producer.
 */
import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    fightTheWarsThisYear,
    highestRankAlive,
    howAHouseIsFaring,
    whatAHouseCanPutOut
} from '../../../src/engine/world/war-melee.js';
import { isRuined, makeObject } from '../../../src/engine/world/possessions.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

interface AtWar {
    state: WorldState;
    a: string;
    b: string;
    aName: string;
    bName: string;
}

/** Two houses openly fighting, with the war's opening row on the schedule. */
async function twoHousesAtWar(
    seed = 'war-melee',
    opts: { dueOnDay?: number; mustered?: [number, number]; led?: [number, number] } = {}
): Promise<AtWar> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed, catalog });

    const withPeople = state.factions.filter(f =>
        f.dissolvedOnDay === null
        && state.npcs.some(n => n.status === 'alive' && n.factionId === f.id)
    );
    const a = withPeople[0];
    const b = withPeople[1];
    a.tags = a.tags.concat('at_war');
    b.tags = b.tags.concat('at_war');

    const mustered = opts.mustered ?? [
        whatAHouseCanPutOut(state, a.id).summed,
        whatAHouseCanPutOut(state, b.id).summed
    ];
    const led = opts.led ?? [highestRankAlive(state, a.id), highestRankAlive(state, b.id)];

    state.schedule.push({
        id: 'e-test-war',
        kind: 'war_resolves',
        dueOnDay: opts.dueOnDay ?? 999_999,
        summary: 'a war',
        actorIds: [],
        locationId: null,
        factionId: a.id,
        repeatDays: null,
        interrupts: false,
        chance: 1,
        fired: false,
        firedOnDay: null,
        data: {
            kind: 'war_resolution',
            sideA: a.id,
            sideB: b.id,
            magnitude: 0.7,
            openedOnDay: 0,
            musteredA: mustered[0],
            musteredB: mustered[1],
            ledA: led[0],
            ledB: led[1]
        }
    });

    return { state, a: a.id, b: b.id, aName: a.name, bName: b.name };
}

describe('a war is a group fight', () => {
    it('two houses at war meet, and the record says what the resolver said', async () => {
        const { state } = await twoHousesAtWar();
        const did = fightTheWarsThisYear(state, 400, forStream('war-melee', 'war-melee', 1));

        expect(did.fought).toHaveLength(1);
        const [year] = did.fought;

        // THE THING THIS TEST EXISTS FOR. A melee has three endings the caller
        // does not choose, and a summary composed from the inputs will
        // confidently narrate a defeat that did not happen. So the line has to
        // agree with the verdict rather than with who was bigger.
        if (year.winningSideId === null) {
            expect(year.line).not.toMatch(/held the field/);
            expect(year.line).toMatch(/neither/);
        } else {
            const winner = year.winningSideId === year.aId ? year.aName : year.bName;
            expect(year.line).toContain(`The ${winner} held the field`);
        }
        // And every name in the line came off the result.
        for (const name of [...year.fell, ...year.brokeOff]) {
            expect(year.line).toContain(name);
        }
    });

    it('a stalemate is not narrated as a defeat, across eight seeds', async () => {
        // Pooled rather than single-seed, because which of the three endings a
        // year lands on is a draw. What is asserted is that no year ever
        // produces a line that contradicts its own verdict.
        for (let i = 0; i < 8; i++) {
            const { state } = await twoHousesAtWar(`pool-${i}`);
            const did = fightTheWarsThisYear(state, 400, forStream(`pool-${i}`, 'war-melee', 1));
            for (const year of did.fought) {
                const claimsAWinner = /held the field/.test(year.line);
                expect(claimsAWinner).toBe(year.winningSideId !== null);
            }
        }
    });

    it('nobody is fought who is not on the roster', async () => {
        const { state, a, b } = await twoHousesAtWar();
        const roster = new Set(
            state.npcs.filter(n => n.factionId === a || n.factionId === b).map(n => n.id)
        );
        const did = fightTheWarsThisYear(state, 400, forStream('war-melee', 'war-melee', 1));
        for (const actor of did.fought[0].fact.actors) {
            expect(roster.has(actor.id)).toBe(true);
        }
    });
});

describe('how badly a house is losing', () => {
    it('is null for a house that is not at war', async () => {
        const { state } = await twoHousesAtWar();
        const peaceful = state.factions.find(f => !f.tags.includes('at_war'))!;
        expect(howAHouseIsFaring(state, peaceful.id)).toBeNull();
    });

    it('reads zero on both sides on the day the war opens', async () => {
        const { state, a, b } = await twoHousesAtWar();
        expect(howAHouseIsFaring(state, a)!.spent).toBe(0);
        expect(howAHouseIsFaring(state, b)!.spent).toBe(0);
        expect(howAHouseIsFaring(state, a)!.losing).toBe(0);
    });

    it('moves when a house is ground down, and moves the other way for the other side', async () => {
        // Arranged rather than fought, so the reading is what is under test
        // rather than the draw: the war opened when A could put out twice what
        // it can put out now, and B is untouched.
        const { state, a, b } = await twoHousesAtWar('faring');
        const broughtA = whatAHouseCanPutOut(state, a).summed;
        const broughtB = whatAHouseCanPutOut(state, b).summed;
        const row = state.schedule.find(e => e.id === 'e-test-war')!;
        row.data = { ...row.data, musteredA: broughtA * 2, musteredB: broughtB };

        const faringA = howAHouseIsFaring(state, a)!;
        const faringB = howAHouseIsFaring(state, b)!;

        expect(faringA.spent).toBeCloseTo(0.5, 5);
        expect(faringB.spent).toBe(0);
        expect(faringA.losing).toBeGreaterThan(0);
        // The two readings are mirrors of one another. A war one side is losing
        // is a war the other side is winning, by construction and not by two
        // separate calculations.
        expect(faringB.losing).toBeCloseTo(-faringA.losing, 10);
    });

    it('a war opened before anything measured one reads as untouched, not as a gap', async () => {
        const { state, a } = await twoHousesAtWar('old-war');
        const row = state.schedule.find(e => e.id === 'e-test-war')!;
        row.data = {
            kind: 'war_resolution',
            sideA: row.data.sideA,
            sideB: row.data.sideB,
            magnitude: 0.7,
            openedOnDay: 0
        };
        const faring = howAHouseIsFaring(state, a)!;
        expect(faring.mustered).toBeNull();
        expect(faring.spent).toBe(0);
        expect(faring.ledStill).toBe(true);
    });
});

describe('a war breaks what is carried, once', () => {
    it('a house\'s stores are not in the fighting', async () => {
        const { state, a } = await twoHousesAtWar('stores');
        // In the hold: possessor and owner are the same house. Nobody carried
        // it out of the gate, so nothing in the year's fighting can reach it.
        state.objects.push(makeObject({
            id: 'obj-in-the-vault',
            name: 'a dose on the shelf',
            kind: 'pill',
            significance: 'significant',
            power: 29,
            ownerId: a,
            ownerName: 'the house',
            possessorId: a
        }));

        for (let year = 1; year <= 25; year++) {
            fightTheWarsThisYear(state, year * 365, forStream('stores', 'war-melee', year));
        }
        expect(isRuined(state.objects.find(o => o.id === 'obj-in-the-vault')!)).toBe(false);
    });

    it('every object a war ruined is one the melee reported, and there is no second route', async () => {
        // The whole reason `war-breakage.ts` was deleted. A war that ran both
        // it and a melee would break a house's things twice a year by two
        // routes; this asserts there is exactly one, and that it is the strike
        // record.
        for (let i = 0; i < 4; i++) {
            const { state } = await twoHousesAtWar(`breakage-${i}`);
            const wasRuined = new Set(
                state.objects.filter(o => isRuined(o)).map(o => o.id)
            );
            const reported = new Set<string>();
            for (let year = 1; year <= 25; year++) {
                const did = fightTheWarsThisYear(
                    state, year * 365, forStream(`breakage-${i}`, 'war-melee', year)
                );
                for (const engagement of did.fought) {
                    for (const thing of engagement.thingsBroken) reported.add(thing.objectId);
                }
            }
            const nowRuined = state.objects.filter(o => isRuined(o) && !wasRuined.has(o.id));
            for (const object of nowRuined) {
                expect(reported.has(object.id)).toBe(true);
            }
        }
    });
});

describe('the settlement', () => {
    it('moves the hold of the side the war cost more', async () => {
        const { state, a, b } = await twoHousesAtWar('settle', { dueOnDay: 100 });
        const broughtA = whatAHouseCanPutOut(state, a).summed;
        const row = state.schedule.find(e => e.id === 'e-test-war')!;
        row.data = { ...row.data, musteredA: broughtA * 4 };
        state.objects.push(makeObject({
            id: 'obj-a-hold', name: 'the house blade', kind: 'artifact',
            significance: 'significant', power: 20,
            ownerId: a, ownerName: 'the house', possessorId: a
        }));

        const did = fightTheWarsThisYear(state, 400, forStream('settle', 'war-melee', 2));
        expect(did.settled).toHaveLength(1);
        expect(did.settled[0].loserId).toBe(a);
        expect(did.settled[0].winnerId).toBe(b);
        // And the summary agrees with what actually moved, rather than with
        // what the inputs implied.
        expect(did.settled[0].scattered)
            .toBe(did.settled[0].moved.some(m => m.fate === 'carried off'));
    });

    it('a house whose war took everybody it was led by breaks up, and its things go out in arms', async () => {
        // THE THIRD FATE, WHICH HAD NO PRODUCER. `carried off` needs a house
        // with living members that still scatters, and that is exactly a house
        // whose seniors are gone: the war opened with it led from a rank nobody
        // left is standing at.
        const { state, a, b } = await twoHousesAtWar('scatter', { dueOnDay: 100 });
        const broughtA = whatAHouseCanPutOut(state, a).summed;
        const row = state.schedule.find(e => e.id === 'e-test-war')!;
        row.data = {
            ...row.data,
            musteredA: broughtA * 4,
            ledA: highestRankAlive(state, a) + 1
        };
        state.objects.push(makeObject({
            id: 'obj-the-vault', name: 'the ancestral tablet', kind: 'artifact',
            significance: 'significant', power: 20,
            ownerId: a, ownerName: 'the house', possessorId: a
        }));

        const did = fightTheWarsThisYear(state, 400, forStream('scatter', 'war-melee', 2));
        expect(did.settled).toHaveLength(1);
        const settled = did.settled[0];
        expect(settled.loserId).toBe(a);
        expect(settled.scattered).toBe(true);
        expect(settled.moved.some(m => m.fate === 'carried off')).toBe(true);
        expect(settled.line).toContain('broke up');
        // And the house is gone while its people are not. Disbanding is not
        // being destroyed - the members scatter with their ties intact.
        expect(state.factions.find(f => f.id === a)!.dissolvedOnDay).toBe(400);
        expect(state.npcs.some(n => n.status === 'alive' && n.factionId === null)).toBe(true);
        expect(state.factions.find(f => f.id === b)!.dissolvedOnDay).toBeNull();
    });

    it('a war that cost both sides the same moves nothing', async () => {
        const { state, a } = await twoHousesAtWar('even', { dueOnDay: 100 });
        const row = state.schedule.find(e => e.id === 'e-test-war')!;
        // No baseline on either side, so both read spent 0 and neither lost.
        row.data = {
            kind: 'war_resolution',
            sideA: row.data.sideA, sideB: row.data.sideB,
            magnitude: 0.7, openedOnDay: 0
        };
        state.objects.push(makeObject({
            id: 'obj-untouched', name: 'a blade', kind: 'artifact',
            significance: 'significant', power: 20,
            ownerId: a, ownerName: 'the house', possessorId: a
        }));

        const did = fightTheWarsThisYear(state, 400, forStream('even', 'war-melee', 2));
        expect(did.settled).toHaveLength(0);
        expect(state.objects.find(o => o.id === 'obj-untouched')!.possessorId).toBe(a);
    });
});
