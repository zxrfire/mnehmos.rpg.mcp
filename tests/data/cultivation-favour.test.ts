/**
 * A favour skips the admission ordinal, and the three apexes differ on whether
 * they will let it.
 *
 * The mechanic exists because of an arithmetic fact this suite re-derives
 * rather than trusts: a child has an ordinal of zero, no origin waives an
 * admission bar, and so without a favour the greatest name in the province can
 * only place a seven-year-old at the handful of houses that admit at the floor
 * - all of which would have taken a farmer's child the same morning. If that
 * stops being true the mechanic needs rethinking, so the first test measures it
 * instead of asserting it.
 */

import { describe, expect, it } from 'vitest';
import { SECTS, SECT_ADMISSION, getSect } from '../../src/data/cultivation/sects.js';
import {
    A_NEWBORN_WITH_POTENTIAL,
    FAVOUR_STANCES,
    FavourStanceSchema,
    THE_APEXES_THAT_TRADE,
    favourIsWorthSomethingAt,
    favourStanceOf,
    willNotBeMoved
} from '../../src/data/cultivation/a-favour-skips-the-admission-bar.js';
import { APEX_INSTITUTIONS, getApexInstitution } from '../../src/data/cultivation/hierarchy.js';

const barOf = (id: string): number => {
    const sect = getSect(id)!;
    return SECT_ADMISSION[id]?.minOrdinal ?? sect.admissionOrdinal;
};

describe('why the mechanic has to exist', () => {
    it('leaves a child at zero with only the floor-level houses to go to', () => {
        // The arithmetic the favour answers. If this ever comes back empty or
        // covers most of the catalog, the problem has changed shape.
        const openToAChildWithNoOrdinal = SECTS.filter(s => barOf(s.id) <= 0);
        expect(openToAChildWithNoOrdinal.length, 'nowhere takes a child at all')
            .toBeGreaterThan(0);
        expect(openToAChildWithNoOrdinal.length, 'everywhere takes a child, so a favour buys nothing')
            .toBeLessThan(SECTS.length / 3);

        // And every one of them takes anybody, which is the sting: the name
        // buys a place somewhere that was never going to refuse.
        for (const s of openToAChildWithNoOrdinal) {
            expect(s.recruits, `${s.id} admits at the floor but does not recruit`).toBe(true);
        }
    });

    it('makes a favour worth something at most of the catalog', () => {
        const worth = favourIsWorthSomethingAt();
        expect(worth.length, 'a favour buys nothing anywhere').toBeGreaterThan(SECTS.length / 2);
        for (const id of worth) {
            expect(barOf(id), `${id} trades a bar it does not have`).toBeGreaterThan(0);
        }
    });
});

describe('every house has an answer, and it agrees with its own bar', () => {
    it('parses, and covers the whole sect catalog', () => {
        for (const f of FAVOUR_STANCES) FavourStanceSchema.parse(f);
        for (const s of SECTS) {
            const f = favourStanceOf(s.id);
            expect(f, `${s.id} has no answer about a favour`).toBeTruthy();
            FavourStanceSchema.parse(f!);
        }
    });

    it('never says a bar can be bought where there is no bar', () => {
        for (const s of SECTS) {
            const f = favourStanceOf(s.id)!;
            if (f.answer === 'yes, at a price') {
                expect(barOf(s.id), `${s.id} sells a bar of zero`).toBeGreaterThan(0);
                expect(f.andWhatItTakes, `${s.id} trades for nothing`).toBeTruthy();
            }
            if (f.answer === 'no bar to speak of' && s.id !== 'sect-azure-cloud-pavilion') {
                expect(barOf(s.id), `${s.id} claims no bar and states one`).toBe(0);
            }
            // A house that will not move must give a reason that is about
            // consequence rather than about taste, so the reason is required to
            // be substantial. A one-line refusal is the failure mode here.
            if (f.answer === 'no, and the bar does not move') {
                expect(f.why.length, `${s.id} refuses without a reason`).toBeGreaterThan(200);
                expect(f.andWhatItTakes, `${s.id} will not move and yet has a price`).toBeNull();
            }
        }
    });

    it('gives each immovable bar a different reason', () => {
        // Five houses refuse and none of them refuses for the same reason:
        // it would kill the applicant, it would admit a contribution the house
        // has no use for, it is a family rather than a door, it would dissolve
        // the belief the house lives on, or nobody can make the choice for you.
        const refusing = willNotBeMoved();
        expect(refusing.length).toBeGreaterThan(3);
        const reasons = refusing.map(f => f.why);
        expect(new Set(reasons).size, 'two houses refuse in the same words').toBe(reasons.length);
    });
});

describe('the Pavilion takes the child and grants no favour', () => {
    it('has the only probation door in the world, at the floor', () => {
        // The fact the whole characterisation rests on. If a second house grows
        // one, the Pavilion's position stops being singular and the prose here
        // and in the catalog needs revisiting.
        const withProbation = SECTS.filter(s => SECT_ADMISSION[s.id]?.guestFromOrdinal !== undefined);
        expect(withProbation.map(s => s.id)).toEqual(['sect-azure-cloud-pavilion']);
        expect(SECT_ADMISSION['sect-azure-cloud-pavilion'].guestFromOrdinal).toBe(0);
    });

    it('keeps a disciple bar above that probation floor', () => {
        // Two doors, and the point is that only one of them is open. A favour
        // cannot move the second and does not need to move the first.
        const a = SECT_ADMISSION['sect-azure-cloud-pavilion'];
        expect(a.minOrdinal, 'the disciple bar has collapsed onto the probation floor')
            .toBeGreaterThan(a.guestFromOrdinal!);
        expect(a.requirement, 'the refusal is no longer stated').toMatch(/will not be skipped|bar it moves once/i);
    });

    it('says so at the apex layer, and is the one of the three that will not trade', () => {
        const pavilion = getApexInstitution('apex-azure-cloud')!;
        expect(pavilion.whetherItsWordSkipsABar).toMatch(/\bNo\b/);

        // And the other two say the opposite, which is the distinction.
        for (const id of ['apex-deep-survey', 'apex-long-cut']) {
            const a = getApexInstitution(id)!;
            expect(a.whetherItsWordSkipsABar, `${id} has no position on a favour`).toBeTruthy();
            expect(a.whetherItsWordSkipsABar, `${id} should trade`).toMatch(/will|price|trade/i);
        }
        // Every apex has an answer, because this is the axis they differ on.
        for (const a of APEX_INSTITUTIONS) {
            expect(a.whetherItsWordSkipsABar.length, `${a.id} is silent about favours`)
                .toBeGreaterThan(200);
        }
        expect(THE_APEXES_THAT_TRADE.andWhyThePavilionIsNotHere).toMatch(/will not/i);
    });
});

describe('the mechanic sits correctly beside the two things it touches', () => {
    it('cannot reach a posting, because a posting has no bar', () => {
        // Arrival at the two postings is by appointment, so there is nothing for
        // a word to skip. A favour aimed at one is aimed at the wrong
        // instrument, and the right one is a nomination.
        for (const id of ['court-kiln', 'sect-kiln-wardens']) {
            const f = FAVOUR_STANCES.find(x => x.factionId === id);
            expect(f, `${id} has no stated position on a favour`).toBeTruthy();
            expect(f!.answer).toBe('no bar to skip, because there is no door');
            expect(f!.andWhatItTakes, `${id} charges for a door it does not have`).toBeNull();
        }
    });

    it('is what the Hollow Court is using when it places a child', () => {
        // The Court's own bar cannot move - that is why its children go
        // elsewhere - and a Seat's word is exactly the instrument that moves
        // somebody else's. The two facts have to hold at once.
        const court = FAVOUR_STANCES.find(x => x.factionId === 'sect-hollow-court')!;
        expect(court.answer).toBe('no, and the bar does not move');
        expect(barOf('sect-hollow-court'), 'the Court has stopped having a bar to refuse to move')
            .toBeGreaterThan(0);
    });

    it('makes the Pavilion the one placement where nobody owes anything', () => {
        // A child placed at the Pavilion is placed on no favour, because the
        // Pavilion would have taken them. It is the only door on the sheet
        // where that is true of a high placement.
        const pavilion = favourStanceOf('sect-azure-cloud-pavilion')!;
        expect(pavilion.answer).toBe('no bar to speak of');
        expect(pavilion.andWhatItTakes, 'the Pavilion has started charging').toBeNull();
        expect(pavilion.andWhetherItsOwnWordMovesAnybody, 'the Pavilion has started spending')
            .toMatch(/does not use it|never/i);
    });

    it('states what is actually being asked for a newborn', () => {
        for (const [key, text] of Object.entries(A_NEWBORN_WITH_POTENTIAL)) {
            expect(String(text).length, `${key} is too thin to be an answer`).toBeGreaterThan(150);
        }
        expect(A_NEWBORN_WITH_POTENTIAL.whoCanAskForIt).toMatch(/Tribulation Transcendence/);
    });
});
