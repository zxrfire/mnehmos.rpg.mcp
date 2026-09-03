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
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';

const anArtToFortyFour: ArtAsFarAsThisMatters = {
    id: 'art-to-44',
    name: 'a canon of standing lines',
    subjects: [FORMATION_ROAD],
    requiredOrdinal: 29,
    cap: 44
};

const aSwordArt: ArtAsFarAsThisMatters = {
    id: 'art-sword',
    name: 'a sword canon',
    subjects: ['sword'],
    requiredOrdinal: 21,
    cap: 33
};

describe('which arts raise a formation at all', () => {
    it('reads the road off the art and refuses everything not on it', () => {
        expect(whatAnArtCanRaiseTo(anArtToFortyFour)).toBe(44);
        expect(whatAnArtCanRaiseTo(aSwordArt)).toBeNull();
        expect(whatAnArtCanRaiseTo({ ...anArtToFortyFour, subjects: [] })).toBeNull();
    });

    it('falls back to the rung it is pitched at when the book has no ceiling', () => {
        expect(whatAnArtCanRaiseTo({ ...anArtToFortyFour, cap: null })).toBe(29);
    });

    it('raising arrays is UNCOMMON: two arts in the whole catalog, not a category', () => {
        // Ruled: "not every sword art is also a formation art. maybe one or two
        // is". If this count ever climbs toward the number of sword arts, the
        // ability has become a property of being a sword art, which is the exact
        // thing the widening exists to prevent. Change it deliberately, with the
        // rows, never as a side effect.
        const raisers = TECHNIQUES.filter(t => whatAnArtCanRaiseTo(t) !== null);
        expect(raisers.map(t => t.id).sort()).toEqual([
            'star-quenching-blade-domain',
            'void-piercing-sword-domain'
        ]);
        expect(TECHNIQUES.length).toBeGreaterThan(100);
    });

    it('both of them are on the sword road first, so what they raise is a sword formation', () => {
        for (const t of TECHNIQUES.filter(t => whatAnArtCanRaiseTo(t) !== null)) {
            expect(t.subjects[0]).toBe('sword');
            expect(t.subjects).toContain(FORMATION_ROAD);
        }
    });

    it('the other three sword arts were passed over and stay passed over', () => {
        for (const id of [
            'hundred-cut-flying-blade', 'nine-rivers-sword-chant', 'gale-riding-sword-flight'
        ]) {
            const art = TECHNIQUES.find(t => t.id === id)!;
            expect(art.subjects).toEqual(['sword']);
            expect(whatAnArtCanRaiseTo(art)).toBeNull();
        }
    });

    it('a category default supplies one road and never a second', () => {
        // An attack art that names no road is on the weapon road and nothing
        // else. If a default ever produced two, every art in a category would
        // gain an incidental ability nobody authored.
        for (const t of TECHNIQUES) expect(t.subjects.length).toBeLessThanOrEqual(2);
        const defaulted = TECHNIQUES.filter(t => t.category === 'attack' && t.subjects[0] === 'weapon');
        expect(defaulted.length).toBeGreaterThan(20);
        for (const t of defaulted) expect(t.subjects).toHaveLength(1);
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

    it('lands on the anchor: a 44-cap art at half mastery in a 29 builds 27', () => {
        // The owner's own case, and the numbers were explicitly fudged - "27 or
        // 28" - so this asserts the band rather than pretending to a precision
        // nobody claimed.
        const stands = whereAFormationStands({
            art: anArtToFortyFour, builderOrdinal: 29, mastery: 0.5
        });
        expect(stands!.standsAt).toBeGreaterThanOrEqual(27);
        expect(stands!.standsAt).toBeLessThanOrEqual(28);
        expect(stands!.theLowerOfTheTwo).toBe(29);
        expect(stands!.rungsMasteryCost).toBe(2);
        // What it must NOT be: cap x mastery is 22, six rungs adrift, and it
        // lets the book's ceiling dominate a builder nowhere near it.
        expect(stands!.standsAt).not.toBe(22);
    });

    it('full mastery costs exactly nothing, so the term is provably additive', () => {
        for (const builder of [1, 5, 13, 21, 29, 37, 44, 46]) {
            const whole = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: builder, mastery: 1 });
            const unstated = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: builder });
            expect(whole!.rungsMasteryCost).toBe(0);
            expect(whole!.standsAt).toBe(Math.min(44, builder));
            expect(unstated!.standsAt).toBe(whole!.standsAt);
        }
    });

    it('costs a low builder a fraction of a rung and a high one rather more', () => {
        const low = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 5, mastery: 0.5 });
        const high = whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 44, mastery: 0.5 });
        expect(low!.rungsMasteryCost).toBe(0);
        expect(low!.standsAt).toBe(5);
        expect(high!.rungsMasteryCost).toBe(3);
        expect(high!.standsAt).toBe(41);
        expect(high!.rungsMasteryCost).toBeGreaterThan(low!.rungsMasteryCost);
    });

    it('only ever subtracts: the hard ceilings still bind at any mastery', () => {
        for (const mastery of [0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
            const tightCap = whereAFormationStands({
                art: { ...anArtToFortyFour, requiredOrdinal: 0, cap: 10 },
                builderOrdinal: 44, mastery
            });
            expect(tightCap!.standsAt).toBeLessThanOrEqual(10);
            const tightBuilder = whereAFormationStands({
                art: anArtToFortyFour, builderOrdinal: 30, mastery
            });
            expect(tightBuilder!.standsAt).toBeLessThanOrEqual(30);
        }
    });

    it('is monotone in mastery and never goes below the bottom of the ladder', () => {
        let previous = -1;
        for (const mastery of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
            const stands = whereAFormationStands({
                art: anArtToFortyFour, builderOrdinal: 44, mastery
            })!;
            expect(stands.standsAt).toBeGreaterThanOrEqual(previous);
            expect(stands.standsAt).toBeGreaterThanOrEqual(0);
            previous = stands.standsAt;
        }
    });

    it('mastery zero is a refusal, not a feeble formation', () => {
        expect(whereAFormationStands({ art: anArtToFortyFour, builderOrdinal: 44, mastery: 0 }))
            .toBeNull();
        const refused = raiseFormation({
            id: 'f0', name: 'nothing', art: anArtToFortyFour, builderOrdinal: 44, mastery: 0,
            builderId: null, builderName: 'Elder Shen', locationId: 'loc',
            stance: 'defensive', onDay: 0
        });
        expect(refused.row).toBeNull();
        // The two refusals are distinguishable, because they are different facts.
        expect(refused.account).toMatch(/never practised it/);
        expect(refused.account).not.toMatch(/not an art that raises formations/);
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

describe('somebody in a generated world can actually reach one', () => {
    /**
     * The check AGENTS.md's "a module nothing calls" section asks for, applied
     * to content rather than code: two arts in a 138-row catalog could easily
     * be held by nobody, and then the system is unreachable in play for a
     * reason that has nothing to do with the engine.
     *
     * POOLED over five worlds rather than asserted per seed. Measured: 1 to 2
     * holders per world, 8 across five - a per-seed bar would go red the first
     * time a world drew zero, and the claim being made is about the catalog,
     * not about any one world.
     */
    it('holds at roughly one or two people per world, which is what uncommon means', async () => {
        const catalog = await loadCultivationCatalog();
        const raisers = TECHNIQUES.filter(t => whatAnArtCanRaiseTo(t) !== null).map(t => t.id);
        let holders = 0;
        let npcs = 0;
        for (const seed of ['probe-a', 'probe-b', 'probe-c', 'probe-d', 'probe-e']) {
            const { state } = seedWorld({ seed, catalog });
            const people = state.npcs ?? [];
            npcs += people.length;
            holders += people.filter(
                n => (n.cultivation?.techniqueIds ?? []).some(id => raisers.includes(id))
            ).length;
        }
        // Reachable at all - the thing actually worth knowing.
        expect(holders).toBeGreaterThan(0);
        // And still rare. If this ever approaches the population, the ability
        // has stopped being incidental and the catalog has drifted.
        expect(holders).toBeLessThan(npcs * 0.01);
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
