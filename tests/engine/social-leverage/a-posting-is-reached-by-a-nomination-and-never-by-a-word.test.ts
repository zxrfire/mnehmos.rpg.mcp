/**
 * THE MOST PRESTIGIOUS POSTING IN THE WORLD HAD A ROAD AND NO ROAD.
 *
 * The defect as found: `a-favour-skips-the-admission-bar.ts` answers "no bar to
 * skip, because there is no door" at both posting bodies, says in both entries
 * that the right instrument is a NOMINATION, and the Deeproot Court's entry says
 * its own names have never once been declined. `whyYouCannotBePostedThere` told
 * a player the same thing off the board. Grepping `nominat` across `src/engine`,
 * `src/web` and `src/server` returned ONE line - a comment in
 * `spending-a-word-to-place-a-child.ts` saying the right instrument was a
 * nomination and doing nothing with it. Roughly fifteen prose mentions, zero
 * machinery, and a road that named itself and led nowhere.
 *
 * WHAT THIS PINS, and none of it is a number typed in by hand:
 *
 *   - A favour and a nomination are different instruments, and the difference
 *     shows in WHO PAYS. `spendAWord` writes a `favor` held by the person asked,
 *     about the asker. `aNameGoesUp` writes a `blocked_advancement` GRUDGE held
 *     by somebody who was passed over, about the NOMINATOR. That inversion is
 *     the design, and a test that did not pin it would let somebody "simplify"
 *     the nomination into a second favour.
 *   - Who may nominate is DERIVED from the parentage chain, `Parentage.standing`
 *     and the relationship layer. Measured on the catalog as it stands: 13 of 38
 *     sects reach a posting at all; the Tripod Court's apex reads 4 sects' names
 *     plus the Court's own; the Deeproot Court's reads 8 plus its own. A per-
 *     house table would have been wrong the day one of these two bodies changed
 *     apexes, which is a thing that has already happened in this world.
 *   - THE HONEST LIMIT. The lowest rung anybody in fact stands on is 25 at the
 *     Tripod (its weakest serving Warden) and 21 at the Deeproot (its own stated
 *     figure). A player opens at Qi Condensation, so a starting cultivator is 24
 *     and 20 rungs short respectively. This is a mid-game road and the engine
 *     says so with the number rather than pretending.
 *
 * RED-CHECKED. With `howFarANameGoes` returning `'read'` unconditionally, the
 * standing case, the stranger case and the apex case all fail; with the grudge
 * in `aNameGoesUp` swapped for a `createFavor` the inversion test fails.
 */

import { describe, expect, it } from 'vitest';

import {
    A_NOMINATION_WEIGHS,
    aNameGoesUp,
    howFarANameGoes,
    howFarShortOfThePosting,
    thePostingAt,
    thePostings,
    whatANominationWouldTake,
    whatThisHousesNameReaches,
    whatWouldPutYouThere,
    whoCouldNominateInto,
    type ANameWentUp
} from '../../../src/engine/social-leverage/who-can-put-your-name-up-for-a-posting';
import { spendAWord, wasPlaced } from '../../../src/engine/birth/spending-a-word-to-place-a-child';
import { thereIsNoDoorAt } from '../../../src/data/cultivation/a-favour-skips-the-admission-bar';
import { SECTS } from '../../../src/data/cultivation/sects';
import { getParentage, chainToApex } from '../../../src/data/cultivation/governance-and-water-rights';

/** Whether `aNameGoesUp` came back with a nomination rather than a refusal. */
const aNameWasPutUp = (result: ReturnType<typeof aNameGoesUp>): result is ANameWentUp =>
    typeof result !== 'string';

// The two bodies are read out of the catalog, never named here: which bodies
// have no door is a property of the stance table, and a third one appearing is
// a fact about the catalog rather than a change to any of this.
const POSTINGS = thePostings();

describe('the postings are the bodies with no door, and they are found rather than listed', () => {
    it('finds every body that admits nobody, and only those', () => {
        expect(POSTINGS.length).toBeGreaterThan(0);
        for (const posting of POSTINGS) {
            expect(thereIsNoDoorAt(posting.bodyId)).toBe(true);
        }
    });

    it('reads what the work requires off people who are standing there, not off a bar', () => {
        for (const posting of POSTINGS) {
            // Nobody is ever refused on this figure - there is no procedure to
            // be refused by - so what it has to be is a real rung somebody real
            // occupies. Well above the floor at both, which is the distance the
            // catalog calls fifteen rungs from outside.
            expect(posting.theWorkRequires).toBeGreaterThan(15);
        }
    });

    it('names the apex that appoints, and it is not the same apex at both', () => {
        const apexes = new Set(POSTINGS.map(p => p.appointingApexId));
        // The schism: one of these two changed patrons and the other did not.
        // A derivation that produced one apex for both would have lost it.
        expect(apexes.size).toBe(POSTINGS.length);
    });
});

describe('whose name is taken is read off standing, not off a list', () => {
    it('reads the names of houses under the apex on good terms', () => {
        for (const posting of POSTINGS) {
            const under = SECTS.filter(s =>
                s.id !== posting.bodyId
                && chainToApex(s.id).includes(posting.appointingApexId)
                && getParentage(s.id)?.standing === 'good');
            expect(under.length, `${posting.bodyId} has houses under it`).toBeGreaterThan(0);
            for (const sect of under) {
                expect(howFarANameGoes(sect.id, posting.bodyId)).toBe('read');
            }
        }
    });

    it('owes no answer to a house whose grant is strained or on probation', () => {
        const shaky = SECTS.filter(s => {
            const standing = getParentage(s.id)?.standing;
            return standing === 'strained' || standing === 'probationary';
        });
        expect(shaky.length, 'the catalog has houses in arrears').toBeGreaterThan(0);
        for (const sect of shaky) {
            for (const posting of POSTINGS) {
                if (!chainToApex(sect.id).includes(posting.appointingApexId)) continue;
                expect(howFarANameGoes(sect.id, posting.bodyId))
                    .toBe('read, and they are owed no answer');
            }
        }
    });

    it('has nothing to put up from a house the apex has no arrangement with', () => {
        for (const posting of POSTINGS) {
            const strangers = SECTS.filter(s =>
                !chainToApex(s.id).includes(posting.appointingApexId)
                && howFarANameGoes(s.id, posting.bodyId) === 'nothing to put up');
            expect(strangers.length, 'most houses reach neither posting').toBeGreaterThan(0);
        }
        // And that is the majority position, which is what makes a nomination
        // worth having. Measured on the catalog as it stands: 13 of 38.
        const reaching = SECTS.filter(s => whatThisHousesNameReaches(s.id).length > 0);
        expect(reaching.length).toBeLessThan(SECTS.length / 2);
    });

    it('never declines a name the posting puts up out of its own roll', () => {
        for (const posting of POSTINGS) {
            expect(howFarANameGoes(posting.bodyId, posting.bodyId)).toBe('never declined');
        }
    });

    it('calls the apex\'s own act an appointment rather than a nomination', () => {
        for (const posting of POSTINGS) {
            expect(howFarANameGoes(posting.appointingApexId, posting.bodyId))
                .toBe('it is an appointment, not a nomination');
        }
    });

    it('reads the same answer in both directions', () => {
        // Every read runs both ways. The backward list is filtered through the
        // forward resolver, so a disagreement here is the two having drifted.
        for (const posting of POSTINGS) {
            for (const carrier of whoCouldNominateInto(posting.bodyId)) {
                const back = whatThisHousesNameReaches(carrier.nominatorId)
                    .find(r => r.intoBodyId === posting.bodyId);
                expect(back?.howFar, `${carrier.nominatorId} -> ${posting.bodyId}`)
                    .toBe(carrier.howFar);
            }
        }
    });
});

describe('the price is different from a favour\'s, and it is paid by somebody else', () => {
    it('is never bought with stones', () => {
        for (const posting of POSTINGS) {
            const carrier = whoCouldNominateInto(posting.bodyId)
                .find(c => c.howFar === 'read' || c.howFar === 'read, and they are owed no answer');
            expect(carrier, `${posting.bodyId} has a carrier`).toBeDefined();
            const would = whatANominationWouldTake({
                askerId: 'npc-asker',
                askerOrdinal: posting.theWorkRequires,
                nominatorId: carrier!.nominatorId,
                askedOfId: 'npc-elder',
                intoBodyId: posting.bodyId
            });
            expect(typeof would).not.toBe('string');
            if (typeof would === 'string') return;
            expect(would.weighs).toBe(A_NOMINATION_WEIGHS);
            // The ladder in `what-they-will-take-instead-of-money.ts` runs
            // stones < goods < a favour < a service < a hold, and this weight
            // sits at the cash line, so the two mild rungs are unreachable.
            expect(would.theyWillTake).not.toBe('stones');
            expect(would.theyWillTake).not.toBe('goods');
        }
    });

    it('leaves a grudge against the nominator, where a favour leaves a debt to the asker', () => {
        const posting = POSTINGS[0];
        const carrier = whoCouldNominateInto(posting.bodyId)
            .find(c => c.howFar === 'read')!;

        const went = aNameGoesUp({
            askerId: 'npc-asker',
            nominatorId: carrier.nominatorId,
            intoBodyId: posting.bodyId,
            askedOfId: 'npc-elder',
            passedOverId: 'npc-passed-over',
            onDay: 500
        });
        expect(aNameWasPutUp(went)).toBe(true);
        if (!aNameWasPutUp(went)) return;

        const cost = went.whatItCostThem!;
        expect(cost.kind).toBe('grudge');
        expect(cost.cause).toBe('blocked_advancement');
        // Held by the person passed over, ABOUT THE HOUSE THAT CHOSE. Not about
        // the person whose name went up, and the catalog says why: no
        // explanation is ever given to anybody, so there is nothing to hold
        // against the appointee except that they went.
        expect(cost.holderId).toBe('npc-passed-over');
        expect(cost.subjectId).toBe(carrier.nominatorId);
        expect(cost.subjectId).not.toBe('npc-asker');

        // The favour, for contrast, points the other way entirely: the person
        // who was asked holds it, and the ASKER is what it is about.
        const word = spendAWord({
            askerId: 'npc-asker',
            childId: 'npc-child',
            houseId: SECTS.find(s => !thereIsNoDoorAt(s.id)
                && whatThisHousesNameReaches(s.id).length === 0
                && spendableAt(s.id))!.id,
            askedOfId: 'npc-elder',
            onDay: 500
        });
        expect(wasPlaced(word)).toBe(true);
        if (!wasPlaced(word)) return;
        expect(word.obligation.kind).toBe('favor');
        expect(word.obligation.holderId).toBe('npc-elder');
        expect(word.obligation.subjectId).toBe('npc-asker');
    });
});

/** Whether a word can be spent at this house at all. Asked, never assumed. */
function spendableAt(houseId: string): boolean {
    return wasPlaced(spendAWord({
        askerId: 'a', childId: 'b', houseId, askedOfId: 'c', onDay: 1
    }));
}

describe('where no nomination reaches, and what the refusal says instead', () => {
    it('points at the other instrument when the body asked about has a door', () => {
        const ordinary = SECTS.find(s => !thereIsNoDoorAt(s.id))!;
        expect(whatANominationWouldTake({
            askerId: 'npc-asker',
            askerOrdinal: 30,
            nominatorId: 'sect-frostmirror-court',
            askedOfId: 'npc-elder',
            intoBodyId: ordinary.id
        })).toBe('there is a door there');
    });

    it('says the distance rather than refusing, for somebody at the bottom', () => {
        for (const posting of POSTINGS) {
            const carrier = whoCouldNominateInto(posting.bodyId)
                .find(c => c.howFar === 'read')!;
            expect(whatANominationWouldTake({
                askerId: 'npc-asker',
                askerOrdinal: 0,
                nominatorId: carrier.nominatorId,
                askedOfId: 'npc-elder',
                intoBodyId: posting.bodyId
            })).toBe('the work stands further up than they do');

            const short = howFarShortOfThePosting(posting.bodyId, 0)!;
            // A STARTING PLAYER CANNOT REACH THIS AND IS TOLD HOW FAR. Both
            // postings sit twenty rungs or more above where a run opens, which
            // makes this a mid-game road and not an early one.
            expect(short.rungsShort).toBeGreaterThanOrEqual(20);
            expect(short.theyStandAt).toMatch(/Qi Condensation/);
        }
    });

    it('names the bodies whose names are read, and does not leave the road empty', () => {
        for (const posting of POSTINGS) {
            const said = whatWouldPutYouThere({
                intoBodyId: posting.bodyId,
                readerOrdinal: 1,
                readerHouseId: null
            }).join(' ');

            // Three things a good refusal carries: the distance, the apex, and
            // at least one body a player could actually go and stand in front of.
            expect(said).toContain('rungs under it');
            expect(said).toContain(posting.appointingApexName);
            const carriers = whoCouldNominateInto(posting.bodyId)
                .filter(c => c.howFar !== 'it is an appointment, not a nomination');
            expect(carriers.length).toBeGreaterThan(0);
            expect(said).toContain(carriers[0].nominatorName);
        }
    });

    it('tells somebody in a house that does not reach it that serving it further is not the road', () => {
        const posting = POSTINGS[0];
        const outsider = SECTS.find(s => howFarANameGoes(s.id, posting.bodyId) === 'nothing to put up')!;
        const said = whatWouldPutYouThere({
            intoBodyId: posting.bodyId,
            readerOrdinal: 30,
            readerHouseId: outsider.id
        }).join(' ');
        expect(said).toContain('is not one of them');
        // And the distance is still said, in the other direction, because it is
        // a fact about the reader rather than about anybody else.
        expect(said).toContain('The distance is not what is between you and it');
    });

    it('says nothing at all about a body that is not a posting', () => {
        expect(thePostingAt('sect-azure-cloud-pavilion')).toBeUndefined();
        expect(whatWouldPutYouThere({
            intoBodyId: 'sect-azure-cloud-pavilion',
            readerOrdinal: 30,
            readerHouseId: null
        })).toEqual([]);
    });
});
