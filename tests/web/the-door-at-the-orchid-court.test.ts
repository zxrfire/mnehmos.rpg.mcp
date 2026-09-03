/**
 * The rate test for a closed house: can a player actually find it, reach it,
 * and be admitted or turned away for the right reason?
 *
 * AGENTS.md's most-repeated defect is a subsystem with every artefact of a
 * finished feature except the one that matters - somebody in the running world
 * reaching it by doing something. A house is nine catalog files, and nine
 * catalog files passing their guards says nothing about whether a person can
 * walk up to the door. So this measures at the door.
 *
 * WHAT IS BEING PINNED, and it is a decision rather than a behaviour: the bar
 * and the door are different objects. The Orchid Court's `admissionOrdinal` is
 * 3, deliberately low, because the rung is not the gate here - the gate is
 * `A_HOUSE_THAT_TAKES_ONE_SEX`, and a bar a player could climb to would make
 * a closed door a delay rather than a fact. A refusal that named a rung would
 * be the wrong refusal even though it would read as a refusal.
 *
 * WORLD PINNED, because sex is dealt at birth and the door reads it.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { PLACE } from '../../src/data/cultivation/place-names.js';
import { placeRoadDays } from '../../src/data/cultivation/regions.js';
import {
    theDoorIsShutTo,
    whoAHouseWillTake
} from '../../src/data/cultivation/the-three-floors-a-house-admits-at.js';
import { getSect } from '../../src/data/cultivation/index.js';

const COURT = 'sect-orchid-court';

describe('the door is a fact about the house, not a rung', () => {
    it('turns a man away without ever mentioning what he stands at', () => {
        const shut = theDoorIsShutTo(COURT, 'male')!;
        expect(shut, 'the door is open to men').toBeTruthy();
        // The refusal names a route, which is the rule for every refusal here -
        // and the only honest route is that there is not one.
        expect(shut).toMatch(/another house/i);
        // And it must not read as a bar. A rung, a realm or a number in this
        // sentence would be the wrong refusal.
        expect(shut).not.toMatch(/ordinal|layer|realm|rung|Qi Condensation/i);
        expect(shut).toMatch(/not a bar you can climb to/i);
    });

    it('does not shut it to a woman at any rung, including below the bar', () => {
        expect(theDoorIsShutTo(COURT, 'female')).toBeNull();
        expect(whoAHouseWillTake(COURT)).toBe('female');
    });

    it('keeps the bar low, so the door is what decides', () => {
        // If these ever converge, the closed door has quietly become a rung
        // and the design is gone. Both halves are asserted so that moving
        // either one fails here.
        const court = getSect(COURT)!;
        expect(court.admissionOrdinal).toBeLessThanOrEqual(5);
        expect(court.powerOrdinal).toBe(34);
    });
});

describe('a player can find the valley and walk to it', () => {
    it('prices the stair between the Court and its ground', () => {
        // The pair piece one exists to express: a house and the ground it
        // works, a day apart, inside one province.
        expect(placeRoadDays(PLACE.ORCHID_TERRACE, PLACE.ORCHID_VALLEY)).toBe(1);
        expect(placeRoadDays(PLACE.ORCHID_VALLEY, PLACE.ORCHID_TERRACE)).toBe(1);
    });

    it('takes somebody there and spends the day the catalog states', async () => {
        const { game } = await makeGameInWorld({ seed: 'orchid-door', worldSeed: 'orchid-world' });
        await game.newRun('Probe');

        await game.act(`I travel to ${PLACE.ORCHID_TERRACE}`);
        expect((await game.state()).cultivator.location).toContain(PLACE.ORCHID_TERRACE);

        const before = (await game.state()).run.elapsedDays;
        await game.act(`I travel to ${PLACE.ORCHID_VALLEY}`);
        const after = await game.state();
        expect(after.cultivator.location).toContain(PLACE.ORCHID_VALLEY);
        expect(after.run.elapsedDays - before).toBe(1);
    });
});

describe('and the refusal reaches the player through the join verb', () => {
    it('answers a man who asks to join with the door rather than with a bar', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'orchid-join', worldSeed: 'orchid-world-2'
        });
        const { cultivator } = await game.newRun('Probe');

        // Sex is dealt at birth, so the run is forced to the case under test
        // rather than the test being forced to whatever the world dealt.
        db.prepare('UPDATE cultivators SET sex = ? WHERE id = ?').run('male', cultivator.id);

        // THE GROUNDS, NOT THE TOWN, and the game says so itself. Asked at
        // the town, the refusal is a discovery one - "a name is where a door
        // starts, and you do not have this one" - and it names the route:
        // somebody puts you in front of them, or you walk up on your own.
        // `seedSectGround` is the ground you walk up to, and this is the
        // player taking the route the refusal named.
        await game.act('I travel to Orchid Court grounds');
        const said = await game.act('I join the Orchid Court') as {
            narration?: string; error?: string;
        };
        const text = `${said.narration ?? ''} ${said.error ?? ''}`;

        // The engine decided this, not the reader: it is a fact about the
        // world and is produced by code.
        expect(text).toMatch(/only women|takes only/i);
        // He is not on the roll.
        expect((await game.state()).cultivator.sectId ?? null).not.toBe(COURT);
    });
});
