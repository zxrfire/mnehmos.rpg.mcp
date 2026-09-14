/**
 * A changed beast wanted nothing, and then wanted a person's things.
 *
 * THE DEFECT, AS OBSERVED. `createNpc` hands every row `goals: []` and nothing
 * filled one in for a beast, so every reader of `NpcGoal` answered nothing
 * about one: `goalsHeldBy` came back empty, `whatSomebodyIsAfter` had nothing
 * to read out, and `givingYourWordToDoIt` in `doing-somebody-a-service.ts` took
 * its documented fallback - *"nothing in the world says what they want done, so
 * what was undertaken is what you said it was"* - which is the player writing
 * the terms of a service on behalf of the person they were doing it for. The
 * design owner: *"The engine ought to give them a goal."*
 *
 * AND THE FIRST FIX WAS WRONG IN A WAY WORTH RECORDING, because it is the
 * intuitive one and the next person will re-derive it. It rolled a want from a
 * pool of person-shaped goals at the moment the thing stood up. The ruling
 * against it: *"i mean maybe a beast likes raising small animals and that's
 * what they do as a person"*, and *"there's no reason the goals suddenly
 * shift"*. A changed beast does not acquire a person's ends. It has the ends it
 * already had, and the human shape is a new set of MEANS.
 *
 * So the assertions here are about CONTINUITY rather than about existence. A
 * want is written at the core, twelve rungs below the change, and the crossing
 * has to leave it byte-identical: same id, same kind, same text, same day it
 * was opened. A test that only checked a changed beast has a goal would pass on
 * the design that was overruled.
 *
 * RED-CHECKED. Writing the goal at the crossing instead of at stand-up fails
 * the first arm; re-deriving it in the advance with the row's new rung fails
 * the continuity arm; keying any of the three tables on `beast.id` fails the
 * no-species-name arm.
 */

import { describe, expect, it } from 'vitest';
import {
    itsWantIsAboutTheGround,
    whatThisOneHasAlwaysWanted
} from '../../../src/engine/world/what-a-beast-has-always-wanted.js';
import {
    itHasCrossed,
    standUpTheOneOnThisGround
} from '../../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { activeGoals, setRealm } from '../../../src/engine/world/npc-state.js';
import { goalsHeldBy } from '../../../src/engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import { BEASTS, BEAST_CHANGE_ORDINAL } from '../../../src/data/cultivation/beasts.js';
import { hasACore, readsAsSomebody } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import {
    thePaceThisOneKeeps
} from '../../../src/engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();

const SEED = 'what-a-beast-wanted';
const GROUND = 'loc-high-ledge';
const DAY = 365_000;

const cored = BEASTS.filter(hasACore);
const belowTheChange = cored.filter(b => !readsAsSomebody(b));

describe('what a beast wanted before it could say so', () => {
    it('gives every cored species a want, and derives it rather than drawing it', () => {
        for (const beast of cored) {
            const want = whatThisOneHasAlwaysWanted({ beast, locationId: GROUND });
            expect(want.text!.length, beast.id).toBeGreaterThan(40);
            expect(want.obstacles!.length, beast.id).toBe(1);
            expect(want.progress!.length, beast.id).toBeGreaterThan(10);
            // Asked twice, the same want. There is no roll in this at all: a
            // species' want is a fact about the species the way its element is.
            expect(whatThisOneHasAlwaysWanted({ beast, locationId: GROUND })).toEqual(want);
        }
    });

    it('says the want and never what the want looks like in a life', () => {
        // The engine states the want; what raising something or holding ground
        // looks like from outside is the narrator's. Nothing here may name a
        // human shape, a voice or a house, because the row is written below the
        // change and has to still be true above it - a line saying "can now say
        // so in words" would be a goal that shifted at the crossing.
        const said = cored
            .map(beast => whatThisOneHasAlwaysWanted({ beast, locationId: GROUND }))
            .flatMap(want => [want.text ?? '', want.progress ?? '', ...(want.obstacles ?? [])]);
        for (const line of said) {
            expect(line).not.toMatch(/human|in words|speak|voice|person now/i);
        }
    });

    it('carries no species name anywhere in it', () => {
        // The pool is keyed on columns. A table keyed on an id would give one
        // creature a want nothing else could have, which is the drift the
        // manner file makes the same argument against.
        const byNature = new Set(cored.map(b => b.nature));
        const kinds = new Set(cored.map(
            b => whatThisOneHasAlwaysWanted({ beast: b, locationId: GROUND }).kind));
        // As many distinct wants as there are distinct natures in the cored
        // band, and no more: one column, one job.
        expect(kinds.size).toBeLessThanOrEqual(byNature.size);
        expect(kinds.size).toBeGreaterThan(1);
        for (const beast of cored) {
            const want = whatThisOneHasAlwaysWanted({ beast, locationId: GROUND });
            expect(want.text, beast.id).not.toContain(beast.name);
        }
    });

    it('points a ground want at the ground and everything else at nothing', () => {
        for (const beast of cored) {
            const want = whatThisOneHasAlwaysWanted({ beast, locationId: GROUND });
            expect(want.targetId, beast.id)
                .toBe(itsWantIsAboutTheGround(beast) ? GROUND : null);
        }
    });

    /**
     * THE ROW CARRIES IT FROM THE DAY THE ROW EXISTS, which is the core and not
     * the change. Everything that reads a want then reaches an animal as well
     * as a person, and the service path stops asking the player what the person
     * they are serving wanted.
     */
    it('writes the want on an animal, twelve rungs below the change', () => {
        for (const beast of belowTheChange) {
            const row = standUpTheOneOnThisGround({
                beast, locationId: GROUND, seed: SEED, onDay: DAY
            });
            expect(itHasCrossed(row), beast.id).toBe(false);
            expect(row.goals.length, beast.id).toBe(1);
            expect(goalsHeldBy(row).length, beast.id).toBe(1);
            expect(activeGoals(row)[0].status).toBe('active');
            // It has wanted it for as long as it has been what it is, which is
            // what `howLongTheyHaveWantedIt` reads out of the opening day.
            expect(activeGoals(row)[0].openedOnDay).toBeLessThan(DAY);
        }
    });

    /**
     * THE RULING, AS ONE ASSERTION. *"There's no reason the goals suddenly
     * shift."*
     */
    it('leaves the want untouched when the thing holding it takes a human shape', () => {
        for (const beast of belowTheChange) {
            const animal = standUpTheOneOnThisGround({
                beast, locationId: GROUND, seed: SEED, onDay: DAY
            });
            const person = setRealm(animal, BEAST_CHANGE_ORDINAL, DAY + 365);
            expect(itHasCrossed(person), beast.id).toBe(true);
            // Not "also has a goal". The SAME goal, unchanged in every field.
            expect(person.goals, beast.id).toEqual(animal.goals);
            expect(person.nextGoalSeq).toBe(animal.nextGoalSeq);
        }
    });

    /**
     * The same ruling put to the pass that moves the row, because that is where
     * a re-derivation would plausibly be written: the branch already has the
     * species row and the new rung in its hand.
     *
     * The rung the row lands on is not the point here and is pinned next door.
     * What is pinned is that the pass CHANGED the creature and did not touch
     * what it wanted.
     */
    it('moves a row in world time and does not touch what it wanted', async () => {
        const { state } = seedWorld({ seed: 'beast-want-advance', catalog });
        const beast = belowTheChange.find(b => b.ordinal === 20)!;
        const ground = state.locations.filter(l => l.kind !== 'region');
        const where = (ground.find(l => thePaceThisOneKeeps({
            beast, locationId: l.id, worldSeed: state.seed
        }) >= 1) ?? ground[0]).id;

        state.npcs.push(standUpTheOneOnThisGround({
            beast, locationId: where, seed: state.seed, onDay: state.currentDay
        }));
        const before = state.npcs[state.npcs.length - 1];
        const wanted = before.goals.map(g => ({ ...g }));
        expect(wanted).toHaveLength(1);

        advanceWorldYears(state, 150);

        const after = state.npcs.find(n => n.id === before.id)!;
        expect(after.cultivation.realmOrdinal)
            .toBeGreaterThan(before.cultivation.realmOrdinal);
        expect(after.goals).toEqual(wanted);
        expect(after.nextGoalSeq).toBe(before.nextGoalSeq);
    }, 300_000);

    it('gives one already past the change the same want its species always had', () => {
        for (const beast of cored.filter(readsAsSomebody)) {
            const row = standUpTheOneOnThisGround({
                beast, locationId: GROUND, seed: SEED, onDay: DAY
            });
            expect(itHasCrossed(row), beast.id).toBe(true);
            expect(activeGoals(row)[0].text)
                .toBe(whatThisOneHasAlwaysWanted({ beast, locationId: GROUND }).text);
        }
    });
});
