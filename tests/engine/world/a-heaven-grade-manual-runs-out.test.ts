/**
 * A manual above a certain grade holds a finite number of uses.
 *
 * Ruled by the design owner: heaven grade and above run out, mortal and earth
 * do not. The cut is stated once, in
 * `src/engine/world/what-a-manual-has-left-in-it.ts`, and this file is the
 * ratchet on it.
 *
 * WHY THE CUT FALLS WHERE IT DOES: the storage is the CAUSE, and the design
 * owner drew both lines on purpose. `items.md`, on damage: *"Counted things
 * cannot be damaged. They stop existing. There is nowhere to write the scar."*
 * A spent use is a scar, so a manual runs out exactly where the world keeps a
 * history it could be written in - which is `howAGradeIsStored`, counted at
 * mortal and earth and tracked at heaven and above. One rule, two names. The
 * second assertion below holds them together so that a change to either is
 * made knowing it moves both.
 *
 * THE NUMBERS. Three for heaven, one for immortal, one for chaos. Sized off
 * what the world already says about copies rather than off taste - `copiesOf`
 * gives an inner or elders shelf one to three copies, so three uses a copy is
 * a house founding a handful of people on its own art and then having to write
 * it out again, which is the scarcity `manuals.md` already asserts. Immortal
 * and chaos are one because `possessions.ts` says nothing below the Lid makes
 * either, there is a finite number in the world and no process that adds
 * another; a book like that is inherited once. They are the SAME number
 * because `GRADE_ORDINAL_BANDS` makes the top two grades peers and
 * `GRADE_ORDER` says in as many words that it is not a power ordering, so this
 * table must not invent one.
 */

import { describe, expect, it } from 'vitest';
import { TechniqueGradeSchema, type TechniqueGrade } from '../../../src/schema/cultivation';
import { howAGradeIsStored, isRuined, makeObject } from '../../../src/engine/world/possessions';
import {
    USES_A_MANUAL_OF_THIS_GRADE_HOLDS,
    aManualOfThisGradeRunsOut,
    takeTheArtOffThePage,
    theManualInThisHandFor,
    whatIsLeftIn
} from '../../../src/engine/world/what-a-manual-has-left-in-it';

const GRADES = TechniqueGradeSchema.options as readonly TechniqueGrade[];

function aCopyOf(grade: TechniqueGrade, copies = 1) {
    return makeObject({
        id: `book-${grade}`,
        name: `a ${grade} manual`,
        kind: 'manual',
        possessorId: 'reader',
        data: { techniqueId: `art-${grade}`, copies }
    });
}

describe('where the cut is', () => {
    it('heaven and above run out; mortal and earth do not', () => {
        expect(GRADES.filter(aManualOfThisGradeRunsOut))
            .toEqual(['heaven', 'immortal', 'chaos']);
        expect(GRADES.filter(g => !aManualOfThisGradeRunsOut(g)))
            .toEqual(['mortal', 'earth']);
    });

    it('is the line the world already drew between an amount and a row', () => {
        // Not a coincidence and not a second opinion: a use spent is a scar,
        // and a counted thing has nowhere to write one. Moving one of these
        // moves the other, which is why they are asserted against each other
        // rather than each against a list.
        for (const grade of GRADES) {
            expect(aManualOfThisGradeRunsOut(grade), grade)
                .toBe(howAGradeIsStored(grade) === 'tracked');
        }
    });

    it('holds the numbers, so a retune is an edit somebody argued for', () => {
        expect(USES_A_MANUAL_OF_THIS_GRADE_HOLDS).toEqual({
            mortal: null,
            earth: null,
            heaven: 3,
            immortal: 1,
            chaos: 1
        });
    });
});

describe('a lesser manual does not run out', () => {
    it('GIVEN an earth-grade copy WHEN the art is taken off it twenty times THEN it stands', () => {
        let book = aCopyOf('earth');
        for (let i = 0; i < 20; i++) {
            const taken = takeTheArtOffThePage(book, {
                grade: 'earth', byId: `student-${i}`, onDay: i
            });
            expect(taken.took, `taking ${i + 1}`).toBe(true);
            expect(taken.ruined).toBe(false);
            book = taken.object;
        }
        const left = whatIsLeftIn(book, 'earth');
        expect(left.runsOut).toBe(false);
        expect(left.left).toBeNull();
        expect(isRuined(book)).toBe(false);
        // AND NOTHING WAS WRITTEN ON IT. A counted row has nowhere to carry a
        // count of its own readings, which is the same sentence as the cut.
        expect(book.data.usesSpent).toBeUndefined();
    });
});

describe('a heaven-grade manual runs out', () => {
    it('GIVEN three uses WHEN the third is taken THEN the book is ruined', () => {
        let book = aCopyOf('heaven');
        expect(whatIsLeftIn(book, 'heaven').left).toBe(3);

        const first = takeTheArtOffThePage(book, { grade: 'heaven', byId: 'a', onDay: 1 });
        expect(first.took).toBe(true);
        expect(first.ruined).toBe(false);
        expect(whatIsLeftIn(first.object, 'heaven').left).toBe(2);

        const second = takeTheArtOffThePage(first.object, { grade: 'heaven', byId: 'b', onDay: 2 });
        expect(second.ruined).toBe(false);
        // THE FACT WORTH STATING, and it is stated BEFORE the last is taken.
        expect(whatIsLeftIn(second.object, 'heaven').onItsLastUse).toBe(true);

        const third = takeTheArtOffThePage(second.object, { grade: 'heaven', byId: 'c', onDay: 3 });
        expect(third.took).toBe(true);
        expect(third.ruined).toBe(true);
        expect(isRuined(third.object)).toBe(true);
        // SPENT IS NOT GONE. The row stays, and it says what became of it.
        expect(third.object.provenance[third.object.provenance.length - 1].how).toBe('lost');
        expect(third.object.power).toBeNull();
    });

    it('GIVEN a spent book WHEN somebody tries again THEN nothing is taken and it says so', () => {
        let book = aCopyOf('heaven');
        for (const who of ['a', 'b', 'c']) {
            book = takeTheArtOffThePage(book, { grade: 'heaven', byId: who, onDay: 1 }).object;
        }
        const again = takeTheArtOffThePage(book, { grade: 'heaven', byId: 'd', onDay: 4 });
        expect(again.took).toBe(false);
        expect(again.ruined).toBe(false);
        expect(whatIsLeftIn(again.object, 'heaven').isSpent).toBe(true);
        expect(again.line).toMatch(/nothing/i);
    });

    it('counts the copies on the row rather than inventing a second answer', () => {
        // A holding of two copies is two books. `copyCount` is already the
        // world's answer to how many a row carries.
        const two = aCopyOf('heaven', 2);
        expect(whatIsLeftIn(two, 'heaven').allowed).toBe(6);
    });

    it('an immortal-grade manual is inherited once', () => {
        const book = aCopyOf('immortal');
        expect(whatIsLeftIn(book, 'immortal').onItsLastUse).toBe(true);
        const taken = takeTheArtOffThePage(book, { grade: 'immortal', byId: 'a', onDay: 1 });
        expect(taken.took).toBe(true);
        expect(taken.ruined).toBe(true);
    });
});

describe('what the engine states', () => {
    it('names the number and never a mood', () => {
        const book = aCopyOf('heaven');
        expect(whatIsLeftIn(book, 'heaven').line).toContain('3');

        const once = takeTheArtOffThePage(book, { grade: 'heaven', byId: 'a', onDay: 1 }).object;
        const twice = takeTheArtOffThePage(once, { grade: 'heaven', byId: 'b', onDay: 2 }).object;
        const last = whatIsLeftIn(twice, 'heaven');
        expect(last.onItsLastUse).toBe(true);
        expect(last.line).toMatch(/last/i);
    });

    it('says nothing runs out where nothing does', () => {
        expect(whatIsLeftIn(aCopyOf('mortal'), 'mortal').line).toMatch(/does not run out/i);
    });
});

describe('finding the book in a hand', () => {
    it('is the copy this person is holding of this art, and nothing else', () => {
        const mine = makeObject({
            id: 'mine', name: 'a manual', kind: 'manual',
            possessorId: 'me', data: { techniqueId: 'art-x' }
        });
        const theirs = makeObject({
            id: 'theirs', name: 'a manual', kind: 'manual',
            possessorId: 'you', data: { techniqueId: 'art-x' }
        });
        const sword = makeObject({
            id: 'sword', name: 'a sword', kind: 'artifact',
            possessorId: 'me', data: { techniqueId: 'art-x' }
        });
        const objects = [theirs, sword, mine];
        expect(theManualInThisHandFor(objects, 'me', 'art-x')?.id).toBe('mine');
        expect(theManualInThisHandFor(objects, 'me', 'art-y')).toBeNull();
        // A ruined book is not a book in anybody's hand.
        const spent = takeTheArtOffThePage(
            makeObject({
                id: 'spent', name: 'a manual', kind: 'manual',
                possessorId: 'me', data: { techniqueId: 'art-z' }
            }),
            { grade: 'immortal', byId: 'me', onDay: 1 }
        ).object;
        expect(theManualInThisHandFor([spent], 'me', 'art-z')).toBeNull();
    });
});
