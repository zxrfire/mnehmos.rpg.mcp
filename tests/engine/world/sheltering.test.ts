/**
 * Being inside something, and the reason it is worth anything.
 *
 * The design owner asked for the derivation rather than the rule: *being inside
 * a boat means structurally you are safer right? find reasons for this derived
 * not bespoke.* The reason is `canUnmake`, so what these assert is that this
 * file adds no arithmetic - the same gate that stops a blade being broken is
 * the one that stops a passenger being reached - and that the four openings
 * AGENTS.md requires of any defence are real.
 */
import { describe, it, expect } from 'vitest';
import {
    bestShelterAmong,
    whatGettingPastItTakes,
    whatIsBehindIt
} from '../../../src/engine/world/sheltering.js';
import {
    whatBecomesOfIt,
    writeBack,
    type ThingUnderForce
} from '../../../src/engine/world/object-damage.js';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { canUnmake } from '../../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import { combatPowerForOrdinal } from '../../../src/engine/cultivation/combat.js';

function hull(power: number | null, extra: Partial<ThingUnderForce> = {}): ThingUnderForce {
    return {
        id: 'h', name: 'the Nine Vane', power,
        significance: 'significant', tags: [], data: {}, ...extra
    };
}

const at = (ordinal: number) => ({ ordinal, byName: 'Yun Shu' });

describe('the shelter is the gate, read with the thing in the way', () => {
    it('a hull rated 29 stands between its passengers and everybody below 29', () => {
        for (const rung of [0, 10, 20, 28]) {
            const r = whatGettingPastItTakes(hull(29), at(rung));
            expect(r.reachesThem).toBe(false);
            expect(r.account).toMatch(/does not reach/);
        }
    });

    it('and stops nobody at or above it - the "you can still die" half', () => {
        for (const rung of [29, 34, 44]) {
            expect(whatGettingPastItTakes(hull(29), at(rung)).reachesThem).toBe(true);
        }
    });

    it('it computes nothing: the answer IS `canUnmake`, argument for argument', () => {
        for (let rung = 0; rung <= 44; rung++) {
            expect(whatGettingPastItTakes(hull(29), at(rung)).reachesThem)
                .toBe(canUnmake(rung, 29).reaches);
        }
    });

    it('there is no probability anywhere in it', () => {
        const r = whatGettingPastItTakes(hull(29), at(28));
        // Nothing to roll and nothing to show odds for. A near miss is not a
        // thing a gate has.
        expect(Object.values(r)).not.toContainEqual(expect.any(Function));
        expect(r.reachesThem).toBe(false);
    });
});

describe('it knows about none of the four things it covers', () => {
    it('a hull, a vault, a hall and a formation with the same row answer the same', () => {
        const rows: ThingUnderForce[] = [
            hull(29, { id: 'a', name: 'a spirit boat', tags: ['conveyance'] }),
            hull(29, { id: 'b', name: 'a vault' }),
            hull(29, { id: 'c', name: 'a hall' }),
            hull(29, { id: 'd', name: 'a formation', tags: ['formation'] })
        ];
        const answers = rows.map(r => whatGettingPastItTakes(r, at(25)));
        for (const a of answers) {
            expect(a.reachesThem).toBe(answers[0].reachesThem);
            expect(a.standsAt).toBe(answers[0].standsAt);
        }
    });

    it('passengers behind a hull and objects in a vault are the same call', () => {
        const people = ['npc-a', 'npc-b'];
        const things = [makeObject({ id: 'o1', name: 'a relic', kind: 'material' })];
        const kept = whatIsBehindIt(hull(29), at(20), people);
        const alsoKept = whatIsBehindIt(hull(29), at(20), things);
        expect(kept.kept).toEqual(people);
        expect(kept.reached).toEqual([]);
        expect(alsoKept.kept).toEqual(things);
        expect(alsoKept.reached).toEqual([]);
    });

    it('once a force is through, everything behind it is in front of it', () => {
        const behind = whatIsBehindIt(hull(29), at(34), ['npc-a', 'npc-b', 'npc-c']);
        expect(behind.reached).toHaveLength(3);
        expect(behind.kept).toHaveLength(0);
    });
});

describe('the openings, all four of them', () => {
    it('holing it lowers the bar, for free, because `power` was written down', () => {
        let row: ObjectRecord = makeObject({
            id: 'h', name: 'the Nine Vane', kind: 'artifact',
            significance: 'significant', power: 29
        });
        expect(whatGettingPastItTakes(row, at(28)).reachesThem).toBe(false);

        // One hole. Nothing here was told about it.
        const force = {
            standing: combatPowerForOrdinal(34), bare: combatPowerForOrdinal(34),
            ordinal: 34, byId: 'x', byName: 'somebody', cause: 'a raid',
            standingOf: combatPowerForOrdinal
        };
        const harmed = whatBecomesOfIt(row, force, { next: () => 0.999999 });
        expect(harmed.state).toBe('holed');
        row = writeBack(row, harmed, { onDay: 1, source: 'a raid' }).row as ObjectRecord;

        expect(row.power).toBe(28);
        expect(whatGettingPastItTakes(row, at(28)).reachesThem).toBe(true);
        expect(whatGettingPastItTakes(row, at(28)).scars).toBe(1);
    });

    it('it stops nothing that is inside it with you', () => {
        const boarded = whatGettingPastItTakes(hull(29), at(3), 'past it');
        expect(boarded.reachesThem).toBe(true);
        expect(boarded.account).toMatch(/is not between them/);
        // The answer to a hull nobody can break is to get onto it.
        expect(whatIsBehindIt(hull(29), at(3), ['npc-a'], 'past it').reached).toHaveLength(1);
    });

    it('it hides nobody - shelter is not concealment', () => {
        expect(whatGettingPastItTakes(hull(29), at(3)).hidesThem).toBe(false);
        expect(whatGettingPastItTakes(hull(29), at(40)).hidesThem).toBe(false);
        expect(whatGettingPastItTakes(hull(29), at(3)).account).toMatch(/still findable/);
    });

    it('a thing that ended shelters nobody', () => {
        const ended = hull(null, { tags: ['ruined'] });
        expect(whatGettingPastItTakes(ended, at(1)).reachesThem).toBe(true);
        const emptied = hull(null, { tags: ['inert'], data: { scars: 3 } });
        expect(whatGettingPastItTakes(emptied, at(1)).reachesThem).toBe(true);
    });

    it('it makes nobody stronger - take it away and there is no residue', () => {
        // The reading carries the shelter's rung and nothing about the person.
        const r = whatGettingPastItTakes(hull(29), at(20));
        expect(r.standsAt).toBe(29);
        expect(Object.keys(r)).not.toContain('passengerPower');
        expect(Object.keys(r)).not.toContain('bonus');
    });
});

describe('shelters do not stack', () => {
    it('the best one is what has to be got past, and it is the highest rung', () => {
        const best = bestShelterAmong([
            hull(12, { id: 'wall', name: 'a wall' }),
            hull(29, { id: 'formation', name: 'a formation' }),
            hull(20, { id: 'hall', name: 'a hall' })
        ]);
        expect(best?.id).toBe('formation');
    });

    it('an ended or emptied thing is not among them, and nor is an unrated one', () => {
        expect(bestShelterAmong([
            hull(40, { id: 'gone', name: 'a gone thing', tags: ['ruined'] }),
            hull(38, { id: 'empty', name: 'an empty thing', tags: ['inert'] }),
            hull(null, { id: 'plain', name: 'a plain door' })
        ])).toBeNull();
    });
});
