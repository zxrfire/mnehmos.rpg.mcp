/**
 * A beast with a core is an individual. Below it, a count.
 *
 * ── THE DEFECT, AS IT WAS WALKED ─────────────────────────────────────────
 *
 * `ObligationRecord.holderId` and `subjectId` are plain strings and would
 * happily point at a beast. Nothing ever gave one an id. `whatIsOnThisGround`
 * answers what is on a piece of ground out of the CATALOG, so the hawk somebody
 * spared was one of a count, there was nothing to hang a favour on, and
 * `whoAnswersForTheKill` says so in its own comment - *"NEVER the beast"*.
 * Nothing moved a beast's ordinal either, so "it crossed 29 and became a
 * person" was not an event the world could perform.
 *
 * ── WHY THE ROW IS MINTED ON CONTACT AND NOT SEEDED ──────────────────────
 *
 * MEASURED FIRST, by `scripts/probe-how-many-beasts-have-a-core.ts` on seed
 * `cored-beast-measure`. A world opens holding 1,158
 * locations - 126 of them ground rather than rooms inside a compound - and 610
 * living people, 96 of whom stand at the core rung or above. Giving every piece
 * of ground every species that could survive on it is 761 rows at day 0 and 844
 * at two hundred years: more rows than there are people, and eight times as
 * many as there are people at the same height, for things nobody has met. The
 * per-year pass walks `npcs`, so that is the world's cost doubled to remember
 * animals nobody has stood in front of. A core is worth money and money is what
 * makes a thing singular, which is `items.md`'s rule that an object becomes
 * tracked when it acquires a holder and a history. The living version of that
 * rule is: the row is written when somebody meets it. The figure is not stable
 * either - the same probe forty minutes later said 913, purely because another
 * agent's location work had added settlements, so a store keyed on ground grows
 * with whatever happens to the ground.
 *
 * ── WHAT THESE ASSERTIONS ARE FOR ────────────────────────────────────────
 *
 * The last one is the whole trope and the rest are what it needs. A favour
 * written about an animal is still held by the person it became, because the id
 * is a function of the species and the ground and neither moves when the rung
 * does. If that ever fails, the saved fox stops arriving.
 *
 * RED-CHECKED. Returning `null` from `standUpTheOneOnThisGround` for a cored
 * beast fails the row assertions; re-deriving the id off the individual's
 * current ordinal fails the survival assertion, which is exactly the way the
 * trope would break in practice.
 *
 * ── AND SPEECH STOPPED BEING A SECOND QUESTION ───────────────────────────
 *
 * `itSpeaksNow` used to sit beside `itHasCrossed` and differ from it: the
 * catalog could author a species mute above the change, so the species row was
 * consulted first and the individual's crossing only answered for a kind
 * written below it. The design owner removed that - *"species can't be
 * categorized as speaks false. under 29 = speaks false."* - and the two
 * functions collapsed into one, which is why only `itHasCrossed` is imported
 * here now. Crossing IS the speech.
 *
 * The same ruling gives the crossed one a name of its own: below the change the
 * row carries the species name, and at or above it a person-name is rolled,
 * because *"calling them an ape in human form is disrespectful."*
 */

import { describe, expect, it } from 'vitest';
import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    type Beast
} from '../../../src/data/cultivation/beasts.js';
import {
    BEAST_TAG_PREFIX,
    idOfTheOneOnThisGround,
    isOneOfTheBeasts,
    itHasCrossed,
    standUpTheOneOnThisGround,
    theSpeciesItIs,
    whatItIsNow,
    whyThisOneIsNotAnybodyInParticular
} from '../../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { bandOf, hasACore } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { isTheWorldsToMove, setRealm } from '../../../src/engine/world/npc-state.js';
import { ObligationLedger, createFavor } from '../../../src/engine/social/grudges.js';

const SEED = 'a-beast-with-a-core';
const GROUND = 'loc-high-ledge';
const DAY = 365_000;

const cored = BEASTS.filter(hasACore);
const counted = BEASTS.filter(b => !hasACore(b));
/** Authored below the change, so climbing past it is a thing that can happen. */
const canStillCross = cored.filter(b => b.ordinal < BEAST_CHANGE_ORDINAL);

function standUp(beast: Beast, locationId = GROUND) {
    return standUpTheOneOnThisGround({ beast, locationId, seed: SEED, onDay: DAY });
}

describe('a beast with a core is somebody in particular', () => {
    it('carries the whole cored band as solitary, which is what makes one ground one animal', () => {
        // The id is a function of the species and the ground, and that is only
        // honest while nothing at this height moves in numbers. Asserted rather
        // than assumed, because a herd entry added at 17 would silently make
        // one row stand for twenty animals.
        expect(cored.length).toBeGreaterThan(0);
        expect(cored.filter(b => b.groupSize !== 1)).toEqual([]);
    });

    it('writes nothing for what has no core, and says what would have changed that', () => {
        expect(counted.length).toBeGreaterThan(0);
        for (const beast of counted) {
            const why = whyThisOneIsNotAnybodyInParticular(beast);
            expect(why, beast.id).not.toBeNull();
            expect(why).toContain('core');
            expect(bandOf(beast)).toBe('counted');
        }
        for (const beast of cored) {
            expect(whyThisOneIsNotAnybodyInParticular(beast), beast.id).toBeNull();
        }
    });

    it('stands a cored beast up as an ordinary row the world is free to move', () => {
        for (const beast of cored) {
            const row = standUp(beast);
            expect(row.id, beast.id).toBe(idOfTheOneOnThisGround(beast.id, GROUND));
            // The name is the species' only while it is still an animal - what
            // is called what is its own arm below.
            expect(row.name.length, beast.id).toBeGreaterThan(0);
            expect(row.locationId).toBe(GROUND);
            expect(row.status).toBe('alive');
            expect(row.cultivation.realmOrdinal).toBe(beast.ordinal);
            // It takes no orders and holds no purse.
            expect(row.factionId).toBeNull();
            expect(row.spiritStones).toBe(0);
            // And the world moves it exactly as it moves anybody.
            expect(isTheWorldsToMove(row)).toBe(true);
        }
    });

    it('makes the species readable off the row, and off nothing else', () => {
        for (const beast of cored) {
            const row = standUp(beast);
            expect(isOneOfTheBeasts(row)).toBe(true);
            expect(theSpeciesItIs(row)?.id).toBe(beast.id);
            expect(row.tags).toContain(`${BEAST_TAG_PREFIX}${beast.id}`);
        }
        // An ordinary person carries no such tag and reads as nobody's species.
        const person = { ...standUp(cored[0]!), tags: ['catalog:member'] };
        expect(isOneOfTheBeasts(person)).toBe(false);
        expect(theSpeciesItIs(person)).toBeNull();
    });

    it('puts the same ground twice at the same row and different ground at different rows', () => {
        const beast = cored[0]!;
        expect(standUp(beast).id).toBe(standUp(beast).id);
        expect(standUp(beast, 'loc-other-ledge').id).not.toBe(standUp(beast).id);
    });

    it('is as old as the band it outlasted, because time is the whole of its method', () => {
        for (const beast of cored) {
            const row = standUp(beast);
            expect(row.identity.bornOnDay, beast.id).toBeLessThan(DAY);
            // Old, and not already out of time: a beast that arrives dead is
            // not a beast anybody can spare.
            expect(row.cultivation.lifespanEndsOnDay, beast.id).toBeGreaterThan(DAY);
        }
    });

    it('lets one cross, and the crossing is what gives it a shape and a voice', () => {
        expect(canStillCross.length).toBeGreaterThan(0);
        for (const beast of canStillCross) {
            const before = standUp(beast);
            expect(itHasCrossed(before), beast.id).toBe(false);
            expect(whatItIsNow(before)?.band).toBe('tracked');

            const after = setRealm(before, BEAST_CHANGE_ORDINAL, DAY);
            expect(itHasCrossed(after), beast.id).toBe(true);

            const now = whatItIsNow(after)!;
            expect(now.band).toBe('person');
            expect(now.ability.canTakeTheBeastForm).toBe(true);
            expect(now.rungsClimbed).toBe(BEAST_CHANGE_ORDINAL - beast.ordinal);
            // The species row did not move. Only this one did.
            expect(now.species.ordinal).toBe(beast.ordinal);
        }
    });

    it('gives the ones the catalog placed above the change a voice and a name', () => {
        // THIS ARM ASSERTED THE OPPOSITE. It required that a species authored
        // above the change with `speaks: false` stay silent no matter what rung
        // its individual stood on, on the reasoning that the authorship was a
        // ruling about a kind that had already crossed. The design owner
        // overruled it, the column is gone, and what stands above the change
        // now answers.
        const above = BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL);
        expect(above.length).toBeGreaterThan(0);
        for (const beast of above) {
            const row = standUp(beast);
            expect(itHasCrossed(row), beast.id).toBe(true);
            // AND IT IS NOT CALLED BY ITS SPECIES. Something that stood up gave
            // itself a name, and addressing one by the catalog row is the
            // disrespect the ruling names. The name is read out of the row
            // rather than pinned, because any name the world prints is one the
            // world had to mint.
            expect(row.name, beast.id).not.toBe(beast.name);
            expect(row.name.length, beast.id).toBeGreaterThan(0);
        }
        // Below the change it is an animal, and the species name is what
        // anybody standing there would say.
        for (const beast of canStillCross) {
            expect(standUp(beast).name, beast.id).toBe(beast.name);
        }
    });

    it('gives two on different ground two different names', () => {
        // `takenNames` is what keeps a rolled name unique, and the reason is
        // not cosmetic: the knowledge table is keyed by id while everything the
        // player reads is keyed by name.
        const crossed = BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL);
        expect(crossed.length).toBeGreaterThan(1);
        const first = standUp(crossed[0]!);
        const second = standUpTheOneOnThisGround({
            beast: crossed[1]!,
            locationId: 'loc-other-ledge',
            seed: SEED,
            onDay: DAY,
            takenNames: new Set([first.name])
        });
        expect(second.name).not.toBe(first.name);
    });

    it('keeps the favour it holds about you when it stops being an animal', () => {
        // THE WHOLE TROPE, and it needs no beast code: an ordinary favour, held
        // by the row, about the player, and the row survives the rung moving.
        const beast = canStillCross[0]!;
        const spared = standUp(beast);
        const ledger = new ObligationLedger();
        ledger.put(createFavor({
            holderId: spared.id,
            subjectId: 'player-1',
            cause: 'spared',
            severity: 'serious',
            onDay: DAY,
            description: `${spared.name} was beaten and let go by the player.`
        }));

        const crossed = setRealm(spared, BEAST_CHANGE_ORDINAL, DAY + 3_650);
        expect(crossed.id).toBe(spared.id);
        expect(itHasCrossed(crossed)).toBe(true);

        const held = ledger.heldBy(crossed.id);
        expect(held).toHaveLength(1);
        expect(held[0]!.cause).toBe('spared');
        expect(held[0]!.subjectId).toBe('player-1');
        expect(ledger.against('player-1')).toHaveLength(1);
    });
});
