/**
 * A formation stands at the lower of the art and the builder.
 *
 * The ruling under test, verbatim:
 *
 *   > the strength of a formation is the min of (cultivation technique; you).
 *   > not every technique allows formation building and you can't build a
 *   > formation stronger than you, even if your technique caps out at 44 and
 *   > you're 42, you build 42.
 *
 * Pure functions throughout - no world, no seed, no RNG - so there is nothing
 * here to pin. The two tests that reach the wider engine (`canUnmake`,
 * `whatBecomesOfIt`, `whatGettingPastItTakes`) exist to prove the row this file
 * mints is an ORDINARY object those modules already handle, which is the whole
 * claim: no second sheltering rule, no second damage model.
 */

import { describe, expect, it } from 'vitest';
import {
    FORMATION_ROAD,
    formationsStandingAt,
    isFormation,
    raiseFormation,
    stanceOf,
    whatAnArtCanRaiseTo,
    whatItsBuilderMustHaveBeen,
    whereAFormationStands,
    type ArtAsFarAsThisMatters
} from '../../../src/engine/world/a-formation-stands-at-the-lower-of-the-art-and-the-builder.js';
import { canUnmake } from '../../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import { whatBecomesOfIt } from '../../../src/engine/world/object-damage.js';
import { whatGettingPastItTakes } from '../../../src/engine/world/sheltering.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';

const anArtToFortyFour: ArtAsFarAsThisMatters = {
    id: 'art-to-44',
    name: 'a canon of standing lines',
    subject: FORMATION_ROAD,
    requiredOrdinal: 29,
    cap: 44
};

const aSwordArt: ArtAsFarAsThisMatters = {
    id: 'art-sword',
    name: 'a sword canon',
    subject: 'sword',
    requiredOrdinal: 21,
    cap: 33
};

describe('which arts raise a formation at all', () => {
    it('reads the road off the art and refuses everything not on it', () => {
        expect(whatAnArtCanRaiseTo(anArtToFortyFour)).toBe(44);
        expect(whatAnArtCanRaiseTo(aSwordArt)).toBeNull();
        expect(whatAnArtCanRaiseTo({ ...anArtToFortyFour, subject: null })).toBeNull();
    });

    it('falls back to the rung it is pitched at when the book has no ceiling', () => {
        expect(whatAnArtCanRaiseTo({ ...anArtToFortyFour, cap: null })).toBe(29);
    });

    it('nothing defaults to yes: no art in the live catalog raises one', () => {
        // The finding, asserted so it cannot regress into a permissive default.
        // When the catalog starts authoring formation arts this assertion is the
        // one to change, deliberately, in the same commit as the rows.
        const raisers = TECHNIQUES.filter(t => whatAnArtCanRaiseTo({
            id: t.id,
            name: t.name,
            subject: t.subject ?? null,
            requiredOrdinal: t.requiredOrdinal,
            cap: t.cap ?? null
        }) !== null);
        expect(raisers).toHaveLength(0);
        expect(TECHNIQUES.length).toBeGreaterThan(100);
    });
});

describe('the min, in both directions', () => {
    it("the owner's own case: a 44 art in a 42's hands builds 42", () => {
        const stands = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 42 });
        expect(stands?.standsAt).toBe(42);
        expect(stands?.artReachedTo).toBe(44);
        expect(stands?.builderStoodAt).toBe(42);
        expect(stands?.limitedBy).toBe('the builder');
        expect(stands?.rungsTheArtHadSpare).toBe(2);
    });

    it('and the other way: a 44 hand working a book that stops at 33 builds 33', () => {
        const stands = whereAFormationStands({
            art: { ...anArtToFortyFour, cap: 33 },
            builderOrdinal: 44
        });
        expect(stands?.standsAt).toBe(33);
        expect(stands?.limitedBy).toBe('the art');
        expect(stands?.rungsTheArtHadSpare).toBe(0);
    });

    it('never the higher of the two, at any pairing', () => {
        for (const artReach of [5, 13, 21, 29, 37, 44]) {
            for (const builder of [5, 13, 21, 29, 37, 44]) {
                const stands = whereAFormationStands({
                    art: { ...anArtToFortyFour, requiredOrdinal: 0, cap: artReach },
                    builderOrdinal: builder
                });
                expect(stands?.standsAt).toBe(Math.min(artReach, builder));
                expect(stands!.standsAt).toBeLessThanOrEqual(builder);
                expect(stands!.standsAt).toBeLessThanOrEqual(artReach);
            }
        }
    });

    it('refuses rather than answering zero when the art is not a formation art', () => {
        expect(whereAFormationStands({ art: aSwordArt, builderOrdinal: 44 })).toBeNull();
    });

    it('says which half bound it, in words, in all three cases', () => {
        const byBuilder = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 42 });
        const byArt = whereAFormationStands({
            art: { ...anArtToFortyFour, cap: 30 }, builderOrdinal: 42
        });
        const level = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 44 });
        expect(byBuilder?.account).toMatch(/went nowhere/);
        expect(byArt?.account).toMatch(/book ran out/);
        expect(level?.limitedBy).toBe('neither, they are level');
    });
});

describe('the row it mints', () => {
    const raised = raiseFormation({
        id: 'formation-1',
        name: 'the south array',
        art: anArtToFortyFour,
        builderOrdinal: 42,
        builderId: 'npc-1',
        builderName: 'Elder Shen',
        locationId: 'loc-seat',
        stance: 'defensive',
        onDay: 1000,
        ownerId: 'sect-1',
        ownerName: 'the Azure Cloud Pavilion'
    });

    it('is an ordinary object rated at the min', () => {
        expect(raised.row?.kind).toBe('formation');
        expect(raised.row?.power).toBe(42);
        expect(isFormation(raised.row!)).toBe(true);
        expect(stanceOf(raised.row!)).toBe('defensive');
    });

    it('is never carried: possessorId is null and locationId is where it stands', () => {
        expect(raised.row?.possessorId).toBeNull();
        expect(raised.row?.locationId).toBe('loc-seat');
    });

    it('can be owned by a house, and by nobody at all', () => {
        expect(raised.row?.ownerId).toBe('sect-1');
        const inARuin = raiseFormation({
            id: 'formation-2',
            name: 'the gate array',
            art: anArtToFortyFour,
            builderOrdinal: 38,
            builderId: null,
            builderName: 'somebody nobody now names',
            locationId: 'loc-ruin',
            stance: 'defensive',
            onDay: 0
        });
        expect(inARuin.row?.ownerId).toBeNull();
        expect(inARuin.row?.ownerName).toBe('');
    });

    it('keeps the two halves and the builder on the row, and mints nothing on a refusal', () => {
        expect(raised.row?.data.artReachedTo).toBe(44);
        expect(raised.row?.data.builderStoodAt).toBe(42);
        expect(raised.row?.data.raisedFromArtId).toBe('art-to-44');
        expect(raised.row?.provenance).toHaveLength(1);

        const refused = raiseFormation({
            id: 'formation-3', name: 'nothing', art: aSwordArt, builderOrdinal: 44,
            builderId: null, builderName: 'x', locationId: 'loc', stance: 'offensive', onDay: 0
        });
        expect(refused.row).toBeNull();
        expect(refused.account).toMatch(/not an art that raises formations/);
    });

    it('finds what is standing at a place', () => {
        const others = [raised.row!, { ...raised.row!, id: 'elsewhere', locationId: 'loc-other' }];
        expect(formationsStandingAt(others, 'loc-seat').map(o => o.id)).toEqual(['formation-1']);
        expect(formationsStandingAt(others, 'loc-nowhere')).toHaveLength(0);
    });
});

describe('what it is worth to the rest of the engine, with no new code anywhere', () => {
    const raised = raiseFormation({
        id: 'f', name: 'the array', art: anArtToFortyFour, builderOrdinal: 42,
        builderId: 'b', builderName: 'Elder Shen', locationId: 'loc',
        stance: 'defensive', onDay: 0
    }).row!;

    it('shelters through the ordinary gate: a 41 cannot reach past it, a 42 can', () => {
        const under = whatGettingPastItTakes(raised, { ordinal: 41, byName: 'a besieger' });
        expect(under.reachesThem).toBe(false);
        expect(under.standsAt).toBe(42);
        const level = whatGettingPastItTakes(raised, { ordinal: 42, byName: 'a besieger' });
        expect(level.reachesThem).toBe(true);
        // Not a second rule: it is exactly canUnmake.
        expect(canUnmake(41, 42).reaches).toBe(false);
        expect(canUnmake(42, 42).reaches).toBe(true);
    });

    it('gets weaker as it is attacked, through the ordinary damage resolver', () => {
        const holed = whatBecomesOfIt(
            raised,
            { standing: 1e9, bare: 1e9, ordinal: 44, byId: null, byName: 'a war', cause: 'a war' },
            { next: () => 0.999 }
        );
        // Either it ended or it took a hole; both are the generic resolver's
        // answers and neither is a formation-shaped branch. What is asserted is
        // that it was NOT simply held: a rated thing under a force above its
        // rung is at risk, which is the ruling's "gets weaker as it is attacked".
        expect(holed.state).not.toBe('held');
        expect(holed.ratedBefore).toBe(42);
    });

    it('is untouchable by a force below its rung, so degradation has a floor', () => {
        const safe = whatBecomesOfIt(
            raised,
            { standing: 1, bare: 1, ordinal: 20, byId: null, byName: 'a mob', cause: 'a mob' },
            { next: () => 0.0001 }
        );
        expect(safe.state).toBe('held');
        expect(safe.ratedAfter).toBe(42);
    });

    it('is a floor on what its builder was, and a holed one understates them', () => {
        expect(whatItsBuilderMustHaveBeen(raised)).toBe(42);
        const holed = { ...raised, power: 41 };
        // ratedWhole was written at making, so the inference does not decay
        // with the object - and where it is missing, power understates rather
        // than overstates, which is the safe direction.
        expect(whatItsBuilderMustHaveBeen(holed)).toBe(42);
        expect(whatItsBuilderMustHaveBeen({ ...holed, data: {} })).toBe(41);
        expect(whatItsBuilderMustHaveBeen({ kind: 'artifact', power: 46, data: {} })).toBeNull();
    });

    it('does not grow with its builder: there is no re-rating path', () => {
        // The `min` is taken once, at making. Raising the same art again at a
        // higher rung is a NEW formation standing beside the old one; nothing
        // in this module re-rates a row that already exists.
        expect(raised.power).toBe(42);
        const later = raiseFormation({
            id: 'f2', name: 'the array, relaid', art: anArtToFortyFour, builderOrdinal: 45,
            builderId: 'b', builderName: 'Elder Shen', locationId: 'loc',
            stance: 'defensive', onDay: 9999
        }).row!;
        expect(later.power).toBe(44);
        expect(raised.power).toBe(42);
    });
});
