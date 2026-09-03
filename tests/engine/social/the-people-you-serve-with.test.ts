/**
 * A member of a house could not name one person in it.
 *
 * Found by playing, as a Sword Elder of the Azure Cloud Pavilion - enrolled, at
 * the fifth of six ranks, standing on the house's own ground:
 *
 *   who are the other elders here?
 *   7 present: 0 this cultivator can put a name to, 7 they cannot.
 *
 * The ground writer had already fixed the HOUSE; the people were still
 * strangers, because joining a house wrote nothing about the people in it.
 */

import {
    howServingTogetherPutIt,
    thePeopleYouServeWith,
    type SomebodyStandingHere
} from '../../../src/engine/social/the-people-you-serve-with';

const MINE = 'sect-azure-cloud-pavilion';

function person(over: Partial<SomebodyStandingHere> = {}): SomebodyStandingHere {
    return {
        id: 'npc-1', name: 'Somebody', realmOrdinal: 20,
        factionId: MINE, known: false, ...over
    };
}

const asAnElder = (here: SomebodyStandingHere[]) => thePeopleYouServeWith({
    factionId: MINE, realmOrdinal: 25, selfId: 'me', here
});

describe('the people you serve with', () => {
    it('names the ones on your own roll who are in the room', () => {
        const read = asAnElder([person({ id: 'a', name: 'Yan Shuling' }), person({ id: 'b', name: 'Hou Baiyu' })]);
        expect(read.theyMayName.map(p => p.name)).toEqual(['Yan Shuling', 'Hou Baiyu']);
    });

    /**
     * BOTH CONDITIONS, and neither on its own. The room alone is the thing
     * `presence.test.ts` guards: seeing somebody is not knowing them, and a look
     * is not a source a name may arrive through. What makes this different from
     * a stranger in a square is that the two of them serve in one place.
     */
    it('names nobody from another house standing in the same square', () => {
        expect(asAnElder([
            person({ id: 'a', factionId: 'sect-somebody-else' }),
            person({ id: 'b', factionId: null })
        ]).theyMayName).toHaveLength(0);
    });

    it('names nobody at all to somebody who serves nowhere', () => {
        expect(thePeopleYouServeWith({
            factionId: null, realmOrdinal: 25, selfId: 'me', here: [person()]
        }).theyMayName).toHaveLength(0);
    });

    it('never introduces somebody to themselves', () => {
        expect(asAnElder([person({ id: 'me' })]).theyMayName).toHaveLength(0);
    });

    /**
     * THE HEIGHT GATE STILL RULES. A member does not acquire the name of a
     * figure nine rungs above them merely by enrolling - in the played case the
     * seven present included one the narrator described as "out of reach in a
     * way that does not invite comparison", and that one staying unnamed is
     * correct.
     */
    it('withholds somebody too far above to be perceived, and counts them apart', () => {
        const read = asAnElder([
            person({ id: 'near', realmOrdinal: 27 }),
            person({ id: 'far', realmOrdinal: 41 })
        ]);
        expect(read.theyMayName.map(p => p.id)).toEqual(['near']);
        expect(read.hiddenByHeight).toBe(1);
    });

    /** Unless they are already known, because knowledge wins over the gap. */
    it('keeps somebody already known, at any height', () => {
        const read = asAnElder([person({ id: 'far', realmOrdinal: 41, known: true })]);
        expect(read.hiddenByHeight).toBe(0);
        // Known already, so nothing new to write - but not hidden either.
        expect(read.theyMayName).toHaveLength(0);
    });

    /** Only what is new comes back, so a hundredth walk through writes nothing. */
    it('reports only the people not already held', () => {
        const read = asAnElder([person({ id: 'a', known: true }), person({ id: 'b' })]);
        expect(read.theyMayName.map(p => p.id)).toEqual(['b']);
    });

    it('says the row in the words a member would use', () => {
        expect(howServingTogetherPutIt('Azure Cloud Pavilion', person({ name: 'Yan Shuling' })))
            .toContain('serves Azure Cloud Pavilion as you do');
    });
});
