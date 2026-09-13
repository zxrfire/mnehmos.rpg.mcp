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
 * beast fails the row assertions; having `itSpeaksNow` read the species'
 * `speaks` unconditionally fails the crossing; re-deriving the id off the
 * individual's current ordinal fails the survival assertion, which is exactly
 * the way the trope would break in practice.
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
    itSpeaksNow,
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
            expect(row.name).toBe(beast.name);
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
            expect(itSpeaksNow(before), beast.id).toBe(false);
            expect(whatItIsNow(before)?.band).toBe('tracked');

            const after = setRealm(before, BEAST_CHANGE_ORDINAL, DAY);
            expect(itHasCrossed(after), beast.id).toBe(true);
            expect(itSpeaksNow(after), beast.id).toBe(true);

            const now = whatItIsNow(after)!;
            expect(now.band).toBe('person');
            expect(now.ability.canTakeTheBeastForm).toBe(true);
            expect(now.rungsClimbed).toBe(BEAST_CHANGE_ORDINAL - beast.ordinal);
            // The species row did not move. Only this one did.
            expect(now.species.ordinal).toBe(beast.ordinal);
        }
    });

    it('leaves silent what the catalog placed above the change and left silent', () => {
        // `speaks` is a floor and not an iff: the catalog carries entries well
        // above the change that say nothing, and they are the worst things in
        // it precisely because there is nothing to negotiate with. That
        // authorship is a ruling about a kind that has already crossed, so it
        // stands, and a rung cannot overrule it.
        const silentAbove = BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL && !b.speaks);
        expect(silentAbove.length).toBeGreaterThan(0);
        for (const beast of silentAbove) {
            const row = standUp(beast);
            expect(itHasCrossed(row), beast.id).toBe(true);
            expect(itSpeaksNow(row), beast.id).toBe(false);
        }
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
        expect(itSpeaksNow(crossed)).toBe(true);

        const held = ledger.heldBy(crossed.id);
        expect(held).toHaveLength(1);
        expect(held[0]!.cause).toBe('spared');
        expect(held[0]!.subjectId).toBe('player-1');
        expect(ledger.against('player-1')).toHaveLength(1);
    });
});
