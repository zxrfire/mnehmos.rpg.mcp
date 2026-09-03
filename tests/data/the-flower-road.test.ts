/**
 * The flower road, and the two decisions in it that live only as numbers.
 *
 * AGENTS.md: a design decision that lives only as a number needs a test that
 * says so in its name, because prose gets read and argued about and a number
 * does not. There are two here and both have already been "fixed" once in
 * drafting:
 *
 *   the road stops at 33 and the house stands at 34. That gap is the Orchid
 *   Court's entire thesis - she is the only one who ever crossed it, the house
 *   has never claimed to have taught her, and what is behind that gate is
 *   ground rather than a curriculum. A road extended to 34 deletes it.
 *
 *   the school's take costs the bed a third, and never zero. A defence
 *   reduces and never zeroes, so there is no amount of skill at which a valley
 *   stops being worked.
 *
 * The rest of this file pins the road against the SWORD road it was built
 * from, because a second road invented on its own terms would be a second way
 * of being a road.
 */

import { describe, it, expect } from 'vitest';

import {
    FLOWER_ARTS,
    FLOWER_SUBJECT,
    SWORD_ARTS,
    SWORD_SUBJECT,
    TECHNIQUES,
    getTechnique,
    isFlowerArt,
    takesWithoutEndingTheStand
} from '../../src/data/cultivation/techniques.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { isOnRoad, primaryRoadOf } from '../../src/schema/cultivation.js';
import { domainForSubject } from '../../src/engine/cultivation/understanding.js';

const COURT = 'sect-orchid-court';
const court = SECTS.find(s => s.id === COURT)!;
const canons = FLOWER_ARTS.filter(t => t.class === 'cultivation');

describe('the flower road is built the way the sword road is', () => {
    it('names its subject on the row rather than being inferred from an element', () => {
        // The sword note is emphatic that element is what an art is MADE OF
        // and subject is what it is ABOUT, and that reading one for the other
        // is what produced the hole it was written to close.
        expect(FLOWER_ARTS.length).toBeGreaterThan(0);
        for (const t of FLOWER_ARTS) {
            expect(isOnRoad(t, FLOWER_SUBJECT), t.id).toBe(true);
        }
        // Wood and ice, and neither of them is the road.
        const elements = new Set(FLOWER_ARTS.map(t => t.element));
        expect(elements.size, 'a one-element road is an element wearing a road').toBeGreaterThan(1);
    });

    it('puts the road first and any extra ability after it', () => {
        for (const t of FLOWER_ARTS) {
            expect(primaryRoadOf(t), `${t.id} is primarily on another road`).toBe(FLOWER_SUBJECT);
        }
    });

    it('raises no arrays, because that ruling was made about the sword', () => {
        // Drafted with the crossover and taken back off. Raising arrays is two
        // arts in the whole catalog by an owner ruling, and a second school
        // picking it up would double that as a side effect of building a road.
        // Pinned here so the next person to notice that frost channels are
        // obviously an array finds the reason before the edit.
        for (const t of FLOWER_ARTS) expect(isOnRoad(t, 'formation'), t.id).toBe(false);
        // The relation between the two domain-shaped arts is carried by reach.
        expect(getTechnique('orchid-domain')!.reach).toBe('field');
    });

    it('matches a comprehension, which is what naming a subject buys', () => {
        // `SUBJECT_BY_CATEGORY` defaults an unnamed attack art to 'weapon',
        // which is a DOMAIN name and matches no insight in the world - so an
        // unnamed road cannot be understood, only practised.
        expect(domainForSubject(FLOWER_SUBJECT)).toBe('alchemy');
        expect(domainForSubject(SWORD_SUBJECT)).toBe('weapon');
    });

    it('does not leak onto the sword road, or the sword onto it', () => {
        for (const t of SWORD_ARTS) expect(isOnRoad(t, FLOWER_SUBJECT), t.id).toBe(false);
        for (const t of FLOWER_ARTS) expect(isOnRoad(t, SWORD_SUBJECT), t.id).toBe(false);
    });
});

describe('the road stops below the house that teaches it', () => {
    it('caps at 33 while the Orchid Court stands at 34', () => {
        // THE LOAD-BEARING NUMBER IN THIS FILE. Do not "fix" the ladder to
        // reach its own head: the gap is the house.
        const deepest = Math.max(...canons.map(t => t.cap ?? 0));
        expect(deepest, 'the flower road no longer stops short of its own head').toBe(33);
        expect(court.powerOrdinal).toBe(34);
        expect(deepest).toBeLessThan(court.powerOrdinal);
    });

    it('says so in the house entry and in the road, so neither can drift alone', () => {
        expect(court.description).toMatch(/never (once )?claimed to have taught her/i);
        const top = getTechnique('unhurried-canon')!;
        expect(top.description).toMatch(/short of where the Matriarch stands/i);
    });

    it('is a complete climb from the floor to that cap, with no wall in it', () => {
        // A road with a hole in it is not a road. Walk it: from the entry rung
        // upward, some book the Court teaches must always continue.
        const shelf = court.teaches
            .map(id => getTechnique(id)!)
            .filter(t => t.class === 'cultivation');
        for (let ordinal = court.admissionOrdinal; ordinal < 33; ordinal++) {
            const continues = shelf.some(
                t => t.requiredOrdinal <= ordinal && (t.cap ?? 0) > ordinal
            );
            expect(continues, `nothing the Court teaches continues past ordinal ${ordinal}`).toBe(true);
        }
    });

    it('does not reach into the stretch the summit agents are holding', () => {
        // Measured elsewhere: no cultivation manual anywhere caps between 38
        // and 44, and that is the owner's to fill. This road must not drift
        // upward to "complete" anything.
        for (const t of canons) {
            expect(t.cap ?? 0, `${t.id} has drifted into the summit`).toBeLessThan(38);
        }
    });
});

describe('what the road buys, which is what makes it a road', () => {
    it('is held by somebody of the school and by nobody else', () => {
        expect(takesWithoutEndingTheStand({ knownTechniqueIds: [] })).toBe(false);
        expect(takesWithoutEndingTheStand({ knownTechniqueIds: ['iron-thread-finger'] })).toBe(false);
        expect(takesWithoutEndingTheStand({ knownTechniqueIds: ['frost-setting-bud'] })).toBe(true);
        // A road that is the flower, the way the flight gate accepts a sword dao.
        expect(takesWithoutEndingTheStand({ knownTechniqueIds: [], daoSubject: FLOWER_SUBJECT }))
            .toBe(true);
    });

    it('opens at the bottom of the road rather than at a rung', () => {
        // Taking a cutting without killing the stand is the first thing a bed
        // hand is shown. It is the one part of this road that is not about
        // height, and the gate deliberately does not read an ordinal.
        const first = FLOWER_ARTS[0];
        expect(first.id).toBe('frost-setting-bud');
        expect(first.requiredOrdinal).toBeLessThan(10);
        expect(takesWithoutEndingTheStand({ knownTechniqueIds: [first.id] })).toBe(true);
    });

    it('reads off the row rather than a list', () => {
        expect(isFlowerArt('orchid-domain')).toBe(true);
        expect(isFlowerArt('void-piercing-sword-domain')).toBe(false);
        expect(isFlowerArt('no-such-art')).toBe(false);
    });
});

describe('the road is somebody\'s, and reachable', () => {
    it('is taught by exactly one house, which is what a school means here', () => {
        for (const t of FLOWER_ARTS) {
            const holders = SECTS.filter(s => s.teaches.includes(t.id));
            expect(holders.map(s => s.id), `${t.id} holders`).toEqual([COURT]);
        }
    });

    it('is signed by an art of its own school', () => {
        expect(court.signatureTechniqueId).toBe('orchid-domain');
        expect(isFlowerArt(court.signatureTechniqueId!)).toBe(true);
        expect(court.teaches).toContain(court.signatureTechniqueId);
    });

    it('leaves every flower art with a surviving copy, since a house transmits them', () => {
        // The alternative was `survivingCopy: false`, which would be a lie
        // about a road a living house teaches. See the sequencing note in the
        // commit that landed this.
        for (const t of FLOWER_ARTS) expect(t.survivingCopy, t.id).toBe(true);
        for (const t of FLOWER_ARTS) expect(t.provenance, t.id).toBe('taught');
    });

    it('leaves the road on every art that has one, cultivation aside', () => {
        // `SUBJECT_BY_CATEGORY` maps cultivation to null on purpose: a manual
        // you climb on is not ABOUT anything the way a technique is, so most
        // canons carry no road and should not. The five flower canons are the
        // exception and name one explicitly, which is what makes them a road
        // rather than five books that happen to be wood.
        for (const t of TECHNIQUES.filter(x => x.category !== 'cultivation')) {
            expect(t.subjects.length, t.id).toBeGreaterThan(0);
        }
        for (const t of canons) {
            expect(t.subjects, `${t.id} climbs on no road`).toContain(FLOWER_SUBJECT);
        }
        expect(canons.length).toBe(5);
    });
});
