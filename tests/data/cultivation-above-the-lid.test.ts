/**
 * The top two rungs, and the one asymmetry that runs through both of them.
 *
 * The catalog now authors at ordinal 45 and 46. Nothing about that is a new
 * system: the arts are chaos-grade rows read by the same lookups, the objects
 * are `ObjectRecord`s in the same table as a notched sabre, and no code
 * anywhere branches on rung or on who is holding something. What this suite
 * asserts is the handful of rules that make writing them down safe.
 *
 *   a manual may exceed the Lid, and an object may not be HELD above 45
 *   a 46 object is carried, by somebody no faction can reach, and never left
 *   every art up here has a route, and reach declared on purpose
 *   Lu Sheng holds nothing at all, and that is the point rather than a gap
 *
 * The last one is the reason the rest matter. He is the only figure at the top
 * of this world who is the person and nothing else, so his three arts are the
 * whole account of him, and an entry that quietly handed him an object would
 * dissolve the sharpest thing in the setting without changing a single word of
 * prose. This suite is what makes that a failure rather than a drift.
 */

import { describe, it, expect } from 'vitest';

import {
    BREATHS_IN_THE_LOWER_REALM,
    FALSE_IMMORTAL_ORDINAL,
    MANUALS_MAY_EXCEED_THE_LID,
    MAX_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL,
    WHAT_AN_ART_BUYS,
    isExpelledFromBelow
} from '../../src/engine/cultivation/realms.js';
import { shardPower } from '../../src/engine/world/possessions.js';
import {
    ARTIFACTS,
    NOTHING_AT_FORTY_SIX_IS_EVER_LEFT,
    artifactsOwnedBy,
    getArtifact
} from '../../src/data/cultivation/artifacts.js';
import {
    ABOVE_THE_LID_TRANSMISSION,
    CONTENT_MAX_ORDINAL,
    GRADE_ORDINAL_BANDS,
    GRADE_QI_BANDS,
    TECHNIQUES,
    getTechnique
} from '../../src/data/cultivation/techniques.js';
import {
    LU_SHENG_CARVINGS,
    THE_ARTS_ARE_THE_WHOLE_INVENTORY,
    THE_PRESENT_COUNT,
    allDaoCarvings,
    techniquesFromCarvings
} from '../../src/data/cultivation/false-immortals.js';
import { SECTS, SECT_ANCESTRY, getSect } from '../../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS, COURTS, idsForFaction } from '../../src/data/cultivation/hierarchy.js';
import { NAMED_FIGURES } from '../../src/data/cultivation/named-figures.js';
import { WANDERERS } from '../../src/data/cultivation/wanderers.js';
import { getEncountersForOrdinal, rollEncounter } from '../../src/data/cultivation/encounters.js';

const ARTS_AT = (ordinal: number) => TECHNIQUES.filter(t => t.requiredOrdinal === ordinal);
const OBJECTS_AT = (power: number) => ARTIFACTS.filter(a => a.power === power);

/** Every id that names a faction, under either of the ids one may have. */
const FACTION_IDS = new Set<string>([
    ...SECTS.map(s => s.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...COURTS.map(c => c.id)
]);
const namesAFaction = (id: string): boolean =>
    FACTION_IDS.has(id) || idsForFaction(id).some(x => FACTION_IDS.has(x));

// ─────────────────────────────────────────────────────────────────────────
// THE CEILING, WHICH IS TWO DIFFERENT NUMBERS ABOUT TWO DIFFERENT THINGS
// ─────────────────────────────────────────────────────────────────────────

describe('what the catalog authors, and what may be held', () => {
    it('authors arts to the top of the ladder and objects only to the Lid', () => {
        expect(CONTENT_MAX_ORDINAL).toBe(MAX_ORDINAL);
        expect(MANUALS_MAY_EXCEED_THE_LID).toBe(true);
        expect(OBJECT_CEILING_BELOW_THE_LID).toBe(FALSE_IMMORTAL_ORDINAL);
        // The two are separate constants because they answer separate
        // questions, and the whole design depends on them not being the same
        // number. An art buys nothing across the Lid; an object is the only
        // thing that crosses.
        expect(OBJECT_CEILING_BELOW_THE_LID).toBeLessThan(CONTENT_MAX_ORDINAL);
        expect(WHAT_AN_ART_BUYS.acrossTheLid).toMatch(/nothing at all/i);
        expect(WHAT_AN_ART_BUYS.whatDoesCross).toMatch(/object/i);
    });

    it('keeps the top rungs inside the ordinary grade machinery', () => {
        // No sixth grade, no parallel band, no special-cased qi table. Chaos
        // simply runs to the top now, and the entries sit in it like anything
        // else does.
        expect(GRADE_ORDINAL_BANDS.chaos.max).toBe(CONTENT_MAX_ORDINAL);
        for (const t of [...ARTS_AT(FALSE_IMMORTAL_ORDINAL), ...ARTS_AT(TRUE_IMMORTAL_ORDINAL)]) {
            expect(t.grade, `${t.id} is not on the ordinary top band`).toBe('chaos');
            expect(t.qiCost, `${t.id} qiCost`).toBeGreaterThanOrEqual(GRADE_QI_BANDS.chaos.min);
            expect(t.qiCost, `${t.id} qiCost`).toBeLessThanOrEqual(GRADE_QI_BANDS.chaos.max);
        }
    });

    it('gives both rungs arts and both rungs somewhere to be met', () => {
        for (const ordinal of [FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL]) {
            expect(ARTS_AT(ordinal).length, `nothing authored at ${ordinal}`).toBeGreaterThan(0);
            // An empty band is worse than a low ceiling: the ceiling at least
            // says where the content stops.
            expect(getEncountersForOrdinal(ordinal).length, `nothing happens at ${ordinal}`)
                .toBeGreaterThan(0);
            expect(rollEncounter(ordinal, 0.5), `${ordinal} cannot be drawn for`).toBeDefined();
        }
    });

    it('makes nothing at either rung a fight the ladder below could pick', () => {
        // Danger scaling with ordinal is the assumption that breaks up here.
        // Nothing below the Lid meaningfully threatens either rung, so an
        // entry carrying a threat would be the table arguing with the resolver.
        for (const ordinal of [FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL]) {
            for (const e of getEncountersForOrdinal(ordinal)) {
                expect(e.threatOrdinal, `${e.id} offers a fight at ordinal ${ordinal}`).toBeNull();
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// FORTY-SIX OBJECTS: CARRIED, AND NEVER ANYWHERE ELSE
// ─────────────────────────────────────────────────────────────────────────

describe('objects at the True Immortal rung', () => {
    it('puts them in the one table, at the top of it, sorted like everything else', () => {
        expect(OBJECTS_AT(TRUE_IMMORTAL_ORDINAL).length, 'the rung is unrepresented')
            .toBeGreaterThan(0);
        const powers = ARTIFACTS.map(a => a.power ?? 0);
        expect([...powers].sort((x, y) => y - x), 'ARTIFACTS must stay sorted').toEqual(powers);
        // Artifacts and manuals, in ONE table. A scattered work is objects with
        // holders, and the design rule is one object catalog rather than a
        // parallel one per kind - which is the same rule that keeps the
        // strongest thing in the world in the same array as a notched sabre.
        expect(new Set(ARTIFACTS.map(a => a.kind)))
            .toEqual(new Set(['artifact', 'manual']));
        for (const a of ARTIFACTS) {
            expect(a.power ?? 0, `${a.id} is rated above the ladder`).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });

    it('never lets a faction own or hold one', () => {
        for (const a of OBJECTS_AT(TRUE_IMMORTAL_ORDINAL)) {
            expect(a.ownerId, `${a.id} is owned by a party in this world`).toBeNull();
            expect(a.claims, `${a.id} carries a claim somebody could press`).toEqual([]);
            expect(a.possessorId, `${a.id} is not in anybody's hand`).not.toBeNull();
            expect(namesAFaction(a.possessorId!), `${a.id} is held by the faction ${a.possessorId}`)
                .toBe(false);
        }
        // And the accessor cannot produce one for anybody, without a branch:
        // it filters on a non-null owner and there is not one on this band.
        for (const id of [...FACTION_IDS]) {
            for (const held of artifactsOwnedBy(id)) {
                expect(held.power ?? 0, `${id} owns ${held.id} above the object ceiling`)
                    .toBeLessThanOrEqual(OBJECT_CEILING_BELOW_THE_LID);
            }
        }
    });

    it('puts each one in a named hand that is genuinely above the Lid', () => {
        const figures = new Map(NAMED_FIGURES.map(f => [f.id, f]));
        for (const a of OBJECTS_AT(TRUE_IMMORTAL_ORDINAL)) {
            const holder = figures.get(a.possessorId!);
            expect(holder, `${a.id} is held by unknown ${a.possessorId}`).toBeDefined();
            expect(holder!.kind, `${a.id} is held by somebody who did not complete a crossing`)
                .toBe('immortal_ancestor');
        }
    });

    it('states why one is never left behind, and does not restate it as a rule', () => {
        expect(isExpelledFromBelow(TRUE_IMMORTAL_ORDINAL)).toBe(true);
        expect(isExpelledFromBelow(OBJECT_CEILING_BELOW_THE_LID)).toBe(false);
        expect(BREATHS_IN_THE_LOWER_REALM.max).toBeGreaterThan(BREATHS_IN_THE_LOWER_REALM.min);
        const n = NOTHING_AT_FORTY_SIX_IS_EVER_LEFT;
        expect(n.theyAreCarriedAndOnlyCarried).toMatch(/carried|hand/i);
        expect(n.andThereforeNeverLooted).toMatch(/taken|dropped|sold|found/i);
        // The one residue is pieces, and it is the ordinary shard arithmetic
        // meeting a boundary rather than a rule about immortals.
        expect(shardPower(TRUE_IMMORTAL_ORDINAL)).toBe(OBJECT_CEILING_BELOW_THE_LID);
        expect(shardPower(6)).toBe(5);
        expect(n.theOnlyResidueIsPieces).toMatch(/one rung/i);
    });

    it('pairs each one with the lesser thing a house was actually left', () => {
        // The reading that makes the ceiling mean something: what came down was
        // made to be leavable, at the rung that can stay. It is not a shard.
        expect(getArtifact('carried-the-first-course')!.description).toMatch(/Ninth Nail/);
        expect(getArtifact('carried-the-second-edge')!.description).toMatch(/Standing Edge/);
        expect(getArtifact('carried-the-first-datum')!.description).toMatch(/Datum Lamp/);
        for (const id of ['sent-ninth-nail', 'artifact-the-standing-edge', 'sent-datum-lamp']) {
            const lesser = getArtifact(id);
            expect(lesser, `${id} left the catalog`).toBeDefined();
            expect(lesser!.power!, `${id} is above what may be held`)
                .toBeLessThanOrEqual(OBJECT_CEILING_BELOW_THE_LID);
            expect(lesser!.ownerId, `${id} is nobody's`).not.toBeNull();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// FORTY-SIX ARTS: READ, SLOWLY, BY A HOUSE THAT CANNOT PERFORM THEM
// ─────────────────────────────────────────────────────────────────────────

describe('arts at the True Immortal rung', () => {
    it('reaches a reader only through the channel the catalog already named', () => {
        expect(ABOVE_THE_LID_TRANSMISSION.trueImmortal.mode).toBe('read');
        const gifted = new Set(
            Object.values(SECT_ANCESTRY).flatMap(r => r.partingGift?.techniqueIds ?? [])
        );
        for (const t of ARTS_AT(TRUE_IMMORTAL_ORDINAL)) {
            expect(gifted.has(t.id), `${t.id} has no sent-down copy anywhere`).toBe(true);
            expect(t.provenance, `${t.id} has a living teacher`).not.toBe('taught');
            expect(t.survivingCopy, `${t.id} is both held and declared absent`).toBe(true);
        }
    });

    it('leaves the holding house no stronger than it was', () => {
        for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
            const sect = getSect(sectId);
            for (const id of records.partingGift?.techniqueIds ?? []) {
                const art = getTechnique(id)!;
                if (art.requiredOrdinal !== TRUE_IMMORTAL_ORDINAL) continue;
                expect(sect, `${sectId} holds ${id} and is not a sect`).toBeDefined();
                expect(sect!.teaches, `${sectId} teaches out of the estate`).not.toContain(id);
                expect(art.requiredOrdinal, `${sectId} could actually perform ${id}`)
                    .toBeGreaterThan(sect!.powerOrdinal);
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// FORTY-FIVE: ONE MAN, THREE ARTS, AND NO OBJECT ANYWHERE
// ─────────────────────────────────────────────────────────────────────────

describe('the rung that is one person wide', () => {
    it('has exactly one person standing on it and names him as the sole source', () => {
        const at45 = WANDERERS.filter(w => w.lastOrdinal === FALSE_IMMORTAL_ORDINAL);
        expect(at45).toHaveLength(1);
        expect(ABOVE_THE_LID_TRANSMISSION.falseImmortal.soleTeacher).toBe(at45[0].id);
        expect(ABOVE_THE_LID_TRANSMISSION.falseImmortal.mode).toBe('shown');
    });

    it('gives him no object, at any rung, under any owner or possessor column', () => {
        // The sharpest fact about him and the easiest one to erase by accident.
        // He was of the Hollow Court and is not now, so nothing of theirs is
        // his to carry, and nothing else in the world would be handed to him.
        const him = WANDERERS.find(w => w.lastOrdinal === FALSE_IMMORTAL_ORDINAL)!;
        const names = [him.id, him.recordName, him.commonName];
        for (const a of ARTIFACTS) {
            for (const name of names) {
                expect(a.ownerId, `${a.id} is owned by him`).not.toBe(name);
                expect(a.possessorId, `${a.id} is in his hand`).not.toBe(name);
                expect(a.ownerName, `${a.id} names him as owner`).not.toBe(name);
            }
        }
        const inventory = THE_ARTS_ARE_THE_WHOLE_INVENTORY;
        expect(inventory.heHoldsNothing).toMatch(/no object at all/i);
        expect(inventory.doNotFixIt).toMatch(/may give him an object/i);
    });

    it('says the arts are the account, and says the measurement rather than a rule', () => {
        const inventory = THE_ARTS_ARE_THE_WHOLE_INVENTORY;
        // Reported from the harness, not computed here. No margin constant, no
        // weight function and no arithmetic lives in the lore layer.
        expect(inventory.andItIsMeasuredRatherThanClaimed).toMatch(/Deep Survey/);
        expect(inventory.andItIsMeasuredRatherThanClaimed).toMatch(/Long Cut/);
        expect(inventory.andTheOneInFiveIsThePoint).toMatch(/one time in five/i);
        // And the ordering it reports tracks objects rather than rungs, which
        // is checkable against the catalog the objects are in.
        const longCut = artifactsOwnedBy('apex-long-cut').map(a => a.power ?? 0);
        const deepSurvey = artifactsOwnedBy('apex-deep-survey').map(a => a.power ?? 0);
        expect(Math.max(...longCut)).toBeGreaterThan(Math.max(...deepSurvey));
    });

    it('gives every art at his rung a face to come off, and only faces', () => {
        const carved = new Set(techniquesFromCarvings());
        for (const t of ARTS_AT(FALSE_IMMORTAL_ORDINAL)) {
            expect(carved.has(t.id), `${t.id} has no route at all`).toBe(true);
            expect(t.provenance, `${t.id} has a living teacher`).not.toBe('taught');
            for (const s of SECTS) {
                expect(s.teaches, `${s.id} teaches ${t.id}`).not.toContain(t.id);
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE FACES
// ─────────────────────────────────────────────────────────────────────────

describe('the carvings of somebody still alive', () => {
    it('is the same route and the same type as the seven historical ones', () => {
        expect(LU_SHENG_CARVINGS.length).toBeGreaterThan(0);
        const all = allDaoCarvings();
        for (const c of LU_SHENG_CARVINGS) {
            expect(all, `${c.id} is not in the one carving list`).toContain(c);
        }
        // Anything asking what a face can hand somebody must ask the whole
        // list, or it answers for a fraction of the faces in the world.
        expect(all.length).toBeGreaterThan(LU_SHENG_CARVINGS.length);
        const ids = all.map(c => c.id);
        expect(new Set(ids).size, 'duplicate carving id').toBe(ids.length);
    });

    it('resolves its holders and everything it yields', () => {
        for (const c of LU_SHENG_CARVINGS) {
            if (c.heldByFactionId !== null) {
                expect(namesAFaction(c.heldByFactionId), `${c.id} held by unknown faction`).toBe(true);
            }
            expect(c.yieldedTechniqueIds.length, `${c.id} yields nothing`).toBeGreaterThan(0);
            for (const id of c.yieldedTechniqueIds) {
                const art = getTechnique(id);
                expect(art, `${c.id} yields unknown art ${id}`).toBeDefined();
                expect(art!.requiredOrdinal, `${c.id} yields ${id}, which is not his rung`)
                    .toBe(FALSE_IMMORTAL_ORDINAL);
            }
        }
        // One face each, so a reader who finds one gets one art and not a body
        // of work. The rung has no canon and is not accumulating one.
        const yielded = LU_SHENG_CARVINGS.flatMap(c => c.yieldedTechniqueIds);
        expect(new Set(yielded).size, 'two faces carry the same art').toBe(yielded.length);
    });

    it('keeps the faces a residue of teaching rather than a second channel', () => {
        // He has not done the durable carving and the file must go on saying
        // so: that is what path three does when there is nobody left to hand
        // anything to, and he still has students.
        expect(THE_PRESENT_COUNT.whyHeHasNotCarved).toMatch(/still has students/i);
        expect(THE_PRESENT_COUNT.andTheFacesAreNotThat).toMatch(/different act/i);
        expect(ABOVE_THE_LID_TRANSMISSION.falseImmortal.andTheFacesHeLeavesBehind)
            .toMatch(/could simply have been asked/i);
        // And the read channel costs what it always costs, which is why his
        // arts carry the highest opacity figures in the catalog.
        const his = ARTS_AT(FALSE_IMMORTAL_ORDINAL);
        const highest = Math.max(...TECHNIQUES.map(t => t.opacity ?? 0));
        expect(Math.max(...his.map(t => t.opacity ?? 0))).toBe(highest);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// REACH, WHICH IS WHAT MAKES THE TOP OF THE LADDER MEAN ANYTHING
// ─────────────────────────────────────────────────────────────────────────

describe('reach at the top of the ladder', () => {
    it('is declared on every art above the Lid, deliberately', () => {
        // Measured: at these rungs a single-target art does not take a
        // mobilised apex at all, and a wide one takes it in about two rounds.
        // So an entry that left reach off would be quietly deciding that the
        // top of the ladder does not matter.
        for (const t of [...ARTS_AT(FALSE_IMMORTAL_ORDINAL), ...ARTS_AT(TRUE_IMMORTAL_ORDINAL)]) {
            expect(t.reach, `${t.id} declares no reach`).toBeDefined();
        }
    });

    it('gives each rung something that lands on a place rather than a person', () => {
        for (const ordinal of [FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL]) {
            expect(ARTS_AT(ordinal).some(t => t.reach === 'field'),
                `everything at ordinal ${ordinal} is single-target`).toBe(true);
        }
    });

    it('does not make width free: the widest art at each rung is the dearest', () => {
        for (const ordinal of [FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL]) {
            const arts = ARTS_AT(ordinal);
            const field = arts.filter(t => t.reach === 'field');
            const narrow = arts.filter(t => t.reach !== 'field');
            if (narrow.length === 0) continue;
            expect(Math.max(...field.map(t => t.qiCost)),
                `width is cheap at ordinal ${ordinal}`)
                .toBeGreaterThan(Math.min(...narrow.map(t => t.qiCost)));
        }
    });
});
