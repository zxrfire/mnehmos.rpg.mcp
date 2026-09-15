/**
 * An entrant with no house is called out in the same shape as one with a house.
 *
 * The design owner, on what an open competition is for: *"like xya from the abc
 * sect"* - *"or abc rogue cultivator, no sect"*. The announcer is not
 * decoration. It is the mechanism by which a reputation is made in public in
 * this genre, and a rogue cultivator's placing means something precisely
 * because it is said the same way as everybody else's.
 *
 * ── WHAT IS PINNED, AND WHAT DELIBERATELY IS NOT ─────────────────────────
 *
 * Not the wording. The claim held down here is STRUCTURAL: the two announcements
 * differ in the affiliation and in nothing else - same separator, same order,
 * same one clause of standing each. A board that named houses and then went
 * quiet at somebody who had none would be the engine deciding that a person
 * without a house does not count, which is the one thing AGENTS.md's epigraph
 * forbids it to have a view about.
 *
 * ── AND IT IS DERIVED, WITH NOTHING STORED ───────────────────────────────
 *
 * There is no announcement field. `GatheringPlacing` already carries the name
 * and the faction, and what a crowd hears is a reading over that row - so it
 * cannot drift from it, which is the rule AGENTS.md states as "derive it" and
 * the reason `theBoardAsItIsCalledOut` takes rows rather than being handed text.
 *
 * ── THE DEFECT FOUND WHILE WIRING IT ─────────────────────────────────────
 *
 * `runCompetition` wrote the tie between adjacent placings behind
 * `if (below.factionId === above.factionId) continue` - "skip housemates". Two
 * entrants with NO house both carry null, `null === null` is true, and so the
 * one pair on an open board with most reason to remember each other wrote no
 * tie at all.
 *
 * FIXED AND NOT PINNED, which is a gap written down rather than licensed. Its
 * trigger is unreachable today: every attendee of a gathering comes from
 * `chosenOf`, every one of those has a house, and `runCompetition` does not
 * export the tie-writing, so there is no way to drive two house-less entrants
 * onto one board from outside the module. The assertion belongs with the slice
 * that puts entrants into an open competition, and it is owed at that point -
 * this note exists so the next person knows it is owed rather than done.
 */

import { describe, it, expect } from 'vitest';

import {
    howAnEntrantIsAnnounced,
    theBoardAsItIsCalledOut
} from '../../../src/engine/world/how-an-entrant-is-announced.js';

describe('how an entrant is announced', () => {
    it('says the name and the affiliation, whichever the affiliation is', () => {
        expect(howAnEntrantIsAnnounced({ name: 'Xiao Yaozhi', houseName: 'Dawn Sect' }))
            .toContain('Xiao Yaozhi');
        expect(howAnEntrantIsAnnounced({ name: 'Xiao Yaozhi', houseName: 'Dawn Sect' }))
            .toContain('Dawn Sect');
        expect(howAnEntrantIsAnnounced({ name: 'Lu Rongwu', houseName: null }))
            .toContain('Lu Rongwu');
    });

    /**
     * THE LOAD-BEARING ONE. Read structurally rather than by matching a string,
     * so it keeps holding when somebody rewords the announcement: strip the
     * name off each, and what is left has to be the same shape - one separator,
     * one clause - with only the affiliation differing.
     */
    it('is the same shape with a house and without one', () => {
        const withHouse = howAnEntrantIsAnnounced({ name: 'A', houseName: 'Dawn Sect' });
        const without = howAnEntrantIsAnnounced({ name: 'A', houseName: null });

        // Same opening: the name comes first and nothing is prepended to one of
        // them - no "the unaffiliated", no apology, no qualifier.
        expect(withHouse.startsWith('A')).toBe(true);
        expect(without.startsWith('A')).toBe(true);

        const tailOf = (said: string) => said.slice(1);
        // One separator each, and the same separator.
        expect(tailOf(withHouse).replace(/[^,]/g, '')).toBe(',');
        expect(tailOf(without).replace(/[^,]/g, '')).toBe(',');
        expect(tailOf(withHouse)[0]).toBe(tailOf(without)[0]);

        // And they differ in the affiliation and in nothing else.
        const affiliationOf = (said: string) => said.split(',')[1]!.trim();
        expect(affiliationOf(withHouse)).not.toBe(affiliationOf(without));
        expect(withHouse.replace(affiliationOf(withHouse), ''))
            .toBe(without.replace(affiliationOf(without), ''));
    });

    it('says something about the affiliation rather than leaving a hole', () => {
        // The failure this rules out is a bare "A, " - an entrant whose standing
        // is simply not said, which reads as the announcer trailing off.
        const without = howAnEntrantIsAnnounced({ name: 'A', houseName: null });
        expect(without.split(',')[1]!.trim().length).toBeGreaterThan(0);
    });
});

describe('a board, called out', () => {
    it('numbers every row and skips nobody for having no house', () => {
        const said = theBoardAsItIsCalledOut([
            { place: 1, name: 'Lu Rongwu', houseName: null },
            { place: 2, name: 'Xiao Yaozhi', houseName: 'Dawn Sect' },
            { place: 3, name: 'Shen Bai', houseName: null }
        ]);

        expect(said).toContain('1. ');
        expect(said).toContain('2. ');
        expect(said).toContain('3. ');
        for (const name of ['Lu Rongwu', 'Xiao Yaozhi', 'Shen Bai']) {
            expect(said, `${name} stood on the board and was not called out`).toContain(name);
        }
    });

    /**
     * A winner with no house is not quietly demoted to a shorter sentence. The
     * two rows are compared to each other rather than to a fixed string, so the
     * assertion survives any rewording of either.
     */
    it('gives a house-less winner the same room as a house-backed one', () => {
        const rogueFirst = theBoardAsItIsCalledOut([
            { place: 1, name: 'Lu Rongwu', houseName: null }
        ]);
        const housedFirst = theBoardAsItIsCalledOut([
            { place: 1, name: 'Lu Rongwu', houseName: 'Dawn Sect' }
        ]);
        expect(rogueFirst.startsWith('1. Lu Rongwu')).toBe(true);
        expect(housedFirst.startsWith('1. Lu Rongwu')).toBe(true);
        expect(rogueFirst.replace('no house', 'X')).toBe(housedFirst.replace('Dawn Sect', 'X'));
    });
});
